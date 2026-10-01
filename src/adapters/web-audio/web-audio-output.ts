import type { AudioChannel, AudioOutput, MusicTrack, SoundCue } from '../../ports';
import { shapeCue, type Tone } from './cues';
import { notesBetween, noteTone, stepSeconds, type Song } from './music';
import { songFor } from './songs';

/** Quietest level an exponential fade can reach (it cannot reach 0). */
const SILENT = 0.0001;
/** Fade-in at the start of every tone, so it starts without a click. */
const ATTACK_SECONDS = 0.005;
/**
 * How fast a volume change settles, in seconds (time constant): smooth enough not to click, quick
 * enough that the step sound played right after a change is heard at the new level.
 */
const VOLUME_SMOOTHING = 0.008;
/** How far ahead music notes are scheduled, and how often the scheduler runs. */
const LOOKAHEAD_SECONDS = 0.15;
const SCHEDULE_EVERY_MS = 25;
/** How long the old track fades out and the new one fades in on a change. */
const CROSSFADE_SECONDS = 1;
/** How long after its last step a jingle's notes may still ring. */
const JINGLE_TAIL_SECONDS = 1;
/** Events that count as the player's permission to play sound (autoplay policy). */
const UNLOCK_EVENTS = ['keydown', 'pointerdown'] as const;

/** The Web Audio nodes, created on first use. */
interface Graph {
  readonly context: AudioContext;
  readonly channels: Record<AudioChannel, GainNode>;
  /** One second of white noise, looped by noise tones. */
  readonly noise: AudioBuffer;
}

/** A song being played, on its own gain node so it can fade. */
interface PlayingSong {
  readonly song: Song;
  readonly gain: GainNode;
  /** Context time of step 0. */
  readonly start: number;
  /** The first step not scheduled yet. */
  nextStep: number;
  /** Context time it has faded out by and stops; undefined while it is the current track. */
  until?: number;
}

/** True while handling a key press or click; true where the browser cannot tell. */
const hasUserActivation = (): boolean => navigator.userActivation?.isActive ?? true;

const glide = (param: AudioParam, tone: Tone, start: number, end: number): void => {
  param.setValueAtTime(tone.from, start);
  param.exponentialRampToValueAtTime(tone.to, end);
};

/**
 * Plays cues by synthesizing them with the Web Audio API, so there are no files to download.
 *
 * Browsers keep audio suspended until the player presses a key or clicks (autoplay policy), so
 * the audio context is created on the first such event or the first cue, and resumed on each.
 * Gamepad buttons do not count as one in browsers; a player on a pad hears sound after their
 * first key press or click.
 *
 * Music is a step sequencer over the songs in `songs.ts`: a timer schedules the notes of the
 * next fraction of a second on the audio clock, so timing stays exact however busy the page is.
 * Browsers slow timers down in a hidden tab, so audio pauses while the tab is hidden.
 */
export class WebAudioOutput implements AudioOutput {
  private graph: Graph | undefined;
  private readonly volumes: Record<AudioChannel, number> = { music: 1, effects: 1 };
  private track: MusicTrack | null = null;
  /** The current song first, then songs still fading out. */
  private songs: PlayingSong[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  /** Audio was paused because the tab was hidden, and resumes when it shows again. */
  private pausedWhileHidden = false;
  private disposed = false;

  constructor(private readonly unlockTarget: EventTarget = window) {
    for (const type of UNLOCK_EVENTS) {
      unlockTarget.addEventListener(type, this.unlock, { capture: true });
    }
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  play(cue: SoundCue, strength?: number): void {
    // Audio the browser has not allowed yet would queue this cue on a stopped clock and play it
    // late, on whatever screen comes next. Drop it, unless it comes from a key press or click
    // that unlocks audio right now (a gamepad press does not).
    if (this.disposed) return;
    if (this.graph?.context.state !== 'running' && !hasUserActivation()) return;
    const graph = this.unlock();
    const now = graph.context.currentTime;
    for (const tone of shapeCue(cue, strength)) {
      this.playTone(graph, tone, now + tone.at, graph.channels.effects);
    }
  }

  playMusic(track: MusicTrack | null): void {
    if (track === this.track) return;
    this.track = track;
    if (this.disposed) return;
    // Without a graph yet, the track starts when audio is unlocked (`createGraph`).
    if (this.graph) this.switchSong(this.graph);
  }

  /** The music track asked for last, or null. */
  get currentTrack(): MusicTrack | null {
    return this.track;
  }

  setVolume(channel: AudioChannel, volume: number): void {
    const level = Math.min(1, Math.max(0, volume));
    this.volumes[channel] = level;
    if (!this.graph) return;
    const { context, channels } = this.graph;
    channels[channel].gain.setTargetAtTime(level, context.currentTime, VOLUME_SMOOTHING);
  }

  dispose(): void {
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    for (const type of UNLOCK_EVENTS) {
      this.unlockTarget.removeEventListener(type, this.unlock, { capture: true });
    }
    clearInterval(this.timer);
    void this.graph?.context.close();
    this.graph = undefined;
    this.songs = [];
  }

  /** Creates the audio graph if needed and resumes it if the browser suspended it. */
  private readonly unlock = (): Graph => {
    this.graph ??= this.createGraph();
    if (this.graph.context.state === 'suspended' && !document.hidden) {
      this.pausedWhileHidden = false;
      void this.graph.context.resume();
    }
    return this.graph;
  };

  private readonly onVisibilityChange = (): void => {
    const context = this.graph?.context;
    if (!context) return;
    if (document.hidden && context.state === 'running') {
      this.pausedWhileHidden = true;
      void context.suspend();
    } else if (!document.hidden && this.pausedWhileHidden) {
      this.pausedWhileHidden = false;
      void context.resume();
    }
  };

  private createGraph(): Graph {
    const context = new AudioContext();
    // A compressor keeps several loud cues at once (two hits and a KO) from clipping.
    const limiter = context.createDynamicsCompressor();
    limiter.connect(context.destination);
    const channels: Record<AudioChannel, GainNode> = {
      music: context.createGain(),
      effects: context.createGain(),
    };
    for (const [name, channel] of Object.entries(channels) as [AudioChannel, GainNode][]) {
      channel.gain.value = this.volumes[name];
      channel.connect(limiter);
    }
    const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const graph = { context, channels, noise };
    this.timer = setInterval(() => this.scheduleMusic(graph), SCHEDULE_EVERY_MS);
    this.switchSong(graph);
    return graph;
  }

  /** Fades out what plays and fades in the current track, if any. */
  private switchSong(graph: Graph): void {
    const { context } = graph;
    const now = context.currentTime;
    for (const playing of this.songs) {
      if (playing.until !== undefined) continue;
      playing.gain.gain.cancelScheduledValues(now);
      // `value` is the level reached so far, even mid fade-in, so the fade-out starts from there.
      playing.gain.gain.setValueAtTime(playing.gain.gain.value, now);
      playing.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS);
      playing.until = now + CROSSFADE_SECONDS;
    }
    if (this.track === null) return;
    const song = songFor(this.track);
    const gain = context.createGain();
    if (song.loop) {
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
    } else {
      // A jingle starts at full volume, or its first notes would be lost in the fade.
      gain.gain.setValueAtTime(1, now);
    }
    gain.connect(graph.channels.music);
    this.songs.unshift({ song, gain, start: now + 0.05, nextStep: 0 });
    this.scheduleMusic(graph);
  }

  /** Schedules every song's notes up to the lookahead, and drops songs that have faded out. */
  private scheduleMusic(graph: Graph): void {
    const now = graph.context.currentTime;
    this.songs = this.songs.filter((playing) => {
      const { song, start } = playing;
      const step = stepSeconds(song.bpm);
      // A faded-out track, or a jingle that has finished and rung out, is done.
      const over = song.loop ? Infinity : start + song.length * step + JINGLE_TAIL_SECONDS;
      if (now >= Math.min(playing.until ?? Infinity, over)) {
        playing.gain.disconnect();
        return false;
      }
      const horizon = Math.min(now + LOOKAHEAD_SECONDS, playing.until ?? Infinity);
      const upTo = Math.ceil((horizon - start) / step);
      if (upTo <= playing.nextStep) return true;
      for (const note of notesBetween(song, playing.nextStep, upTo)) {
        const at = start + note.step * step;
        // A throttled timer (a background tab) can fall behind; skip notes already past.
        if (at >= now) this.playTone(graph, noteTone(note, song.bpm), at, playing.gain);
      }
      playing.nextStep = upTo;
      return true;
    });
  }

  private playTone(graph: Graph, tone: Tone, start: number, output: AudioNode): void {
    const { context } = graph;
    const end = start + tone.duration;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(SILENT, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(tone.gain, SILENT), start + ATTACK_SECONDS);
    envelope.gain.exponentialRampToValueAtTime(SILENT, end);
    envelope.connect(output);

    let source: AudioScheduledSourceNode;
    if (tone.wave === 'noise') {
      // White noise through a band-pass filter that glides like an oscillator's pitch.
      const noise = context.createBufferSource();
      noise.buffer = graph.noise;
      noise.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.2;
      glide(filter.frequency, tone, start, end);
      noise.connect(filter).connect(envelope);
      source = noise;
    } else {
      const oscillator = context.createOscillator();
      oscillator.type = tone.wave;
      glide(oscillator.frequency, tone, start, end);
      oscillator.connect(envelope);
      source = oscillator;
    }
    source.addEventListener('ended', () => envelope.disconnect());
    source.start(start);
    source.stop(end);
  }
}
