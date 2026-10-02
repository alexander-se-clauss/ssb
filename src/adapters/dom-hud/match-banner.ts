import { COUNTDOWN, playedFrames, type MatchState } from '../../core';

/** The big blade banner across the middle of the screen. */
export type BannerKind = 'ready' | 'go' | 'game';

export const BANNER_TEXT: Readonly<Record<BannerKind, string>> = {
  ready: 'Ready',
  go: 'Go!',
  game: 'Game!',
};

/** READY during the countdown, GO! for a moment after it, and GAME! once the match is over. */
export const bannerKind = (match: MatchState): BannerKind | null => {
  if (match.phase === 'countdown') return 'ready';
  if (match.phase === 'finished') return 'game';
  if (
    match.phase === 'playing' &&
    match.goFrame > 0 &&
    playedFrames(match) < COUNTDOWN.goBannerFrames
  ) {
    return 'go';
  }
  return null;
};
