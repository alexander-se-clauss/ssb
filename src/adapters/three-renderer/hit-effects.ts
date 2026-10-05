import { launchSpeed, type GameEvent } from '../../core';

/** A one-off spray of particles for a match event (#48). */
export interface Burst {
  readonly effect: string;
  readonly x: number;
  readonly y: number;
  readonly count: number;
  /** Scales how fast the particles fly out. */
  readonly power: number;
}

/**
 * Launch speed (units per frame) at which a hit's sparks are as big as they get: 200 knockback
 * (#153), harder than a smash at its KO percent.
 */
const STRONGEST_LAUNCH = launchSpeed(200);

/**
 * The burst an event shows: sparks where a hit landed, more and faster the harder it launched,
 * shards where a block took or broke under one, a gold flash where a counter caught one, and a
 * blast of light where a fighter left the blast zone. Nothing for the end of a match.
 */
export const burstFor = (event: GameEvent): Burst | undefined => {
  switch (event.type) {
    case 'hit': {
      // A block (#50) throws off shards of light instead of sparks; a breaking hit shatters it.
      if (event.guard === 'blocked') {
        return { effect: 'guard', ...event.position, count: 16, power: 0.8 };
      }
      // A counter (#51) flashes gold where it caught the hit.
      if (event.guard === 'countered') {
        return { effect: 'counter', ...event.position, count: 40, power: 1.2 };
      }
      if (event.guard === 'broken') {
        return { effect: 'guard', ...event.position, count: 70, power: 1.8 };
      }
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
