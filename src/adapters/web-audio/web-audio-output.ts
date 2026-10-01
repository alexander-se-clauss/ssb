import type { AudioChannel, AudioOutput, MusicTrack, SoundCue } from '../../ports';
import { shapeCue, type Tone } from './cues';

/** Quietest level an exponential fade can reach (it cannot reach 0). */
const SILENT = 0.0001;
/** Fade-in at the start of every tone, so it starts without a click. */
const ATTACK_SECONDS = 0.005;
/** How fast a volume change settles, in seconds (time constant). */
const VOLUME_SMOOTHING = 0.03;
/** Events that count as the player's permission to play sound (autoplay policy). */
const UNLOCK_EVENTS = ['keydown', 'pointerdown'] as const;

/** The Web Audio nodes, created on first use. */
interface Graph {
  readonly context: AudioContext;
  readonly channels: Record<AudioChannel, GainNode>;
  /** One second of white noise, looped by noise tones. */
  readonly noise: AudioBuffer;
}

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
 */
export class WebAudioOutput implements AudioOutput {
  private graph: Graph | undefined;
  private readonly volumes: Record<AudioChannel, number> = { music: 1, effects: 1 };
  private track: MusicTrack | null = null;

  constructor(private readonly unlockTarget: EventTarget = window) {
    for (const type of UNLOCK_EVENTS) {
      unlockTarget.addEventListener(type, this.unlock, { capture: true });
    }
  }

  play(cue: SoundCue, strength?: number): void {
    const graph = this.unlock();
    const now = graph.context.currentTime;
    for (const tone of shapeCue(cue, strength)) this.playTone(graph, tone, now + tone.at);
  }

  playMusic(track: MusicTrack | null): void {
    // Music arrives with #87; until then the track is only remembered.
    this.track = track;
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
    for (const type of UNLOCK_EVENTS) {
      this.unlockTarget.removeEventListener(type, this.unlock, { capture: true });
    }
    void this.graph?.context.close();
    this.graph = undefined;
  }

  /** Creates the audio graph if needed and resumes it if the browser suspended it. */
  private readonly unlock = (): Graph => {
    this.graph ??= this.createGraph();
    if (this.graph.context.state === 'suspended') void this.graph.context.resume();
    return this.graph;
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
    return { context, channels, noise };
  }

  private playTone(graph: Graph, tone: Tone, start: number): void {
    const { context } = graph;
    const end = start + tone.duration;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(SILENT, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(tone.gain, SILENT), start + ATTACK_SECONDS);
    envelope.gain.exponentialRampToValueAtTime(SILENT, end);
    envelope.connect(graph.channels.effects);

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
