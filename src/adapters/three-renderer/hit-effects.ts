import type { GameEvent } from '../../core';

/** A one-off spray of particles for a match event (#48). */
export interface Burst {
  readonly effect: string;
  readonly x: number;
  readonly y: number;
  readonly count: number;
  /** Scales how fast the particles fly out. */
  readonly power: number;
}

/** Launch speed (units per frame) at which a hit's sparks are as big as they get: a KO smash. */
const STRONGEST_LAUNCH = 1.2;

/**
 * The burst an event shows: sparks where a hit landed, more and faster the harder it launched,
 * and a blast of light where a fighter left the blast zone. Nothing for the end of a match.
 */
export const burstFor = (event: GameEvent): Burst | undefined => {
  switch (event.type) {
    case 'hit': {
      const strength = Math.min(event.launch / STRONGEST_LAUNCH, 1);
      return {
        effect: 'spark',
        ...event.position,
        count: Math.round(6 + 44 * strength),
        power: 0.6 + 1.4 * strength,
      };
    }
    case 'ko':
      return { effect: 'ko', ...event.position, count: 160, power: 1 };
    case 'match-end':
      return undefined;
  }
};
