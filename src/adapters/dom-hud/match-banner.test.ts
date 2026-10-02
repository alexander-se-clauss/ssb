import { describe, expect, it } from 'vitest';
import { COUNTDOWN, createMatch, DEFAULT_RULES, type MatchState } from '../../core';
import { bannerKind } from './match-banner';

const match = createMatch({
  stageId: 'battlefield',
  players: [{ characterId: 'capsule' }, { characterId: 'capsule' }],
  rules: DEFAULT_RULES,
  countdownFrames: COUNTDOWN.frames,
});
const at = (frame: number, phase: MatchState['phase']): MatchState => ({ ...match, frame, phase });

describe('match banner', () => {
  it('shows READY during the countdown and GO! for a moment after it', () => {
    expect(bannerKind(at(0, 'countdown'))).toBe('ready');
    expect(bannerKind(at(COUNTDOWN.frames, 'playing'))).toBe('go');
    expect(bannerKind(at(COUNTDOWN.frames + COUNTDOWN.goBannerFrames, 'playing'))).toBeNull();
  });

  it('shows GAME! once the match is over, whoever won', () => {
    expect(bannerKind({ ...at(5000, 'finished'), winner: 1 })).toBe('game');
    expect(bannerKind({ ...at(5000, 'finished'), winner: null })).toBe('game');
    // Even when it ends while GO! would still be up.
    expect(bannerKind(at(COUNTDOWN.frames + 1, 'finished'))).toBe('game');
  });
});
