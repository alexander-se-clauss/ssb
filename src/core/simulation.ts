import { FIGHTER } from './config';
import { resolveCombat } from './combat';
import { createFighter, updateFighter } from './fighter';
import { NEUTRAL_INPUT } from './input';
import { findCharacter, findStage } from './registry';
import type { FighterState, GameEvent, MatchConfig, MatchState, PlayerInput } from './types';

/** Builds the first state of a match. Throws on ids the registry does not know. */
export const createMatch = (config: MatchConfig): MatchState => {
  if (config.players.length < 1) throw new Error('A match needs at least one player');
  const stage = findStage(config.stageId);
  if (!stage) throw new Error(`Unknown stage "${config.stageId}"`);
  for (const player of config.players) {
    if (!findCharacter(player.characterId)) {
      throw new Error(`Unknown character "${player.characterId}"`);
    }
  }
  return {
    frame: 0,
    phase: 'playing',
    stage,
    fighters: config.players.map((player, slot) =>
      createFighter(slot, player.characterId, stage, config.stocks),
    ),
    events: [],
    winner: null,
  };
};

const isOutsideBlastZone = (fighter: FighterState, state: MatchState): boolean => {
  const zone = state.stage.blastZone;
  const { x, y } = fighter.position;
  return x < zone.left || x > zone.right || y < zone.bottom || y > zone.top;
};

const handleKo = (fighter: FighterState, state: MatchState, events: GameEvent[]): FighterState => {
  const stocks = fighter.stocks - 1;
  events.push({ type: 'ko', slot: fighter.slot, stocksLeft: stocks });
  if (stocks <= 0) {
    return { ...fighter, stocks: 0, action: 'eliminated', velocity: { x: 0, y: 0 } };
  }
  const respawned = createFighter(fighter.slot, fighter.characterId, state.stage, stocks);
  return {
    ...respawned,
    invulnerableFrames: FIGHTER.respawnInvulnerabilityFrames,
    previousInput: fighter.previousInput,
  };
};

/**
 * The heart of the game: a pure function from (state, inputs) to the next state.
 *
 * Pure and deterministic on purpose: the same inputs always give the same result. That is what
 * lets us unit-test gameplay, record replays, and later run this exact code on a server or use
 * it for rollback netcode.
 */
export const step = (state: MatchState, inputs: readonly PlayerInput[]): MatchState => {
  if (state.phase === 'finished') return { ...state, events: [] };

  const moved = state.fighters.map((fighter) =>
    updateFighter(fighter, inputs[fighter.slot] ?? NEUTRAL_INPUT, state.stage),
  );
  const combat = resolveCombat(moved);
  const events = [...combat.events];

  const fighters = combat.fighters.map((fighter) =>
    fighter.action !== 'eliminated' && isOutsideBlastZone(fighter, state)
      ? handleKo(fighter, state, events)
      : fighter,
  );

  const alive = fighters.filter((f) => f.action !== 'eliminated');
  const finished = fighters.length > 1 ? alive.length <= 1 : alive.length === 0;
  const winner = finished ? (alive[0]?.slot ?? null) : null;
  if (finished) events.push({ type: 'match-end', winner });

  return {
    ...state,
    frame: state.frame + 1,
    phase: finished ? 'finished' : 'playing',
    fighters,
    events,
    winner,
  };
};
