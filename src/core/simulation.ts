import { FIGHTER, RULE_LIMITS } from './config';
import { resolveCombat } from './combat';
import { createFighter, updateFighter } from './fighter';
import { NEUTRAL_INPUT } from './input';
import { findCharacter, findStage } from './registry';
import { leader, timeLeftFrames } from './rules';
import type {
  FighterState,
  GameEvent,
  MatchConfig,
  MatchRules,
  MatchState,
  PlayerInput,
  PlayerSlot,
} from './types';

const inRange = (value: number, min: number, max: number): boolean =>
  Number.isInteger(value) && value >= min && value <= max;

/** Rules may come from another client later, so they are checked like ids are. */
const validateRules = (rules: MatchRules): void => {
  const limits = RULE_LIMITS;
  if (rules.mode !== 'stock' && rules.mode !== 'time') {
    throw new Error(`Unknown rule mode "${String(rules.mode)}"`);
  }
  if (!inRange(rules.stocks, limits.minStocks, limits.maxStocks)) {
    throw new Error(`Stocks out of range: ${rules.stocks}`);
  }
  if (!inRange(rules.timeLimitSeconds, limits.minTimeLimitSeconds, limits.maxTimeLimitSeconds)) {
    throw new Error(`Time limit out of range: ${rules.timeLimitSeconds}`);
  }
};

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
  validateRules(config.rules);
  const stocks = config.rules.mode === 'stock' ? config.rules.stocks : 0;
  return {
    frame: 0,
    phase: 'playing',
    stage,
    rules: config.rules,
    fighters: config.players.map((player, slot) =>
      createFighter(slot, player.characterId, stage, stocks),
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

/** Handles one fighter leaving the blast zone: a fall, a lost stock, and a respawn if allowed. */
const handleKo = (fighter: FighterState, state: MatchState, events: GameEvent[]): FighterState => {
  const stockMatch = state.rules.mode === 'stock';
  const stocks = stockMatch ? fighter.stocks - 1 : 0;
  const falls = fighter.falls + 1;
  events.push({ type: 'ko', slot: fighter.slot, stocksLeft: stockMatch ? stocks : null });
  if (stockMatch && stocks <= 0) {
    return {
      ...fighter,
      stocks: 0,
      falls,
      action: 'eliminated',
      velocity: { x: 0, y: 0 },
    };
  }
  const respawned = createFighter(fighter.slot, fighter.characterId, state.stage, stocks);
  return {
    ...respawned,
    kos: fighter.kos,
    falls,
    invulnerableFrames: FIGHTER.respawnInvulnerabilityFrames,
    previousInput: fighter.previousInput,
  };
};

/** Credits each KO this frame to whoever hit the fallen fighter last. */
const creditKos = (fighters: FighterState[], fallen: readonly FighterState[]): FighterState[] =>
  fallen.reduce((all, victim) => {
    const killer = victim.lastHitBy;
    if (killer === null || killer === victim.slot) return all;
    return all.map((f) => (f.slot === killer ? { ...f, kos: f.kos + 1 } : f));
  }, fighters);

const matchResult = (
  fighters: readonly FighterState[],
  state: MatchState,
): { finished: boolean; winner: PlayerSlot | null } => {
  if (state.rules.mode === 'time') {
    // This step ends the match when it brings the clock to zero.
    const finished = (timeLeftFrames(state) ?? 0) <= 1;
    return { finished, winner: finished ? leader(fighters) : null };
  }
  const alive = fighters.filter((f) => f.action !== 'eliminated');
  const finished = fighters.length > 1 ? alive.length <= 1 : alive.length === 0;
  return { finished, winner: finished ? (alive[0]?.slot ?? null) : null };
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

  const fallen = combat.fighters.filter(
    (f) => f.action !== 'eliminated' && isOutsideBlastZone(f, state),
  );
  const afterKos = combat.fighters.map((fighter) =>
    fallen.includes(fighter) ? handleKo(fighter, state, events) : fighter,
  );
  const fighters = creditKos(afterKos, fallen);

  const { finished, winner } = matchResult(fighters, state);
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
