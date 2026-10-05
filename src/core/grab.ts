/**
 * Grabs (#159): a grab box catches instead of hitting, the holder can pummel, and the held fighter
 * breaks free in time, sooner when it mashes. Run by the simulation after all hits of a frame, as
 * a catch, a pummel or a release changes two fighters at once.
 */
import { characterOf } from './character';
import { anchorPoint, touchesBody } from './combat';
import { GRAB } from './config';
import { findMove } from './move-data';
import { standsOn } from './stages';
import type { Vec2 } from './math';
import type {
  FighterAction,
  FighterState,
  GameEvent,
  PlayerInput,
  PlayerSlot,
  StageDef,
} from './types';

/** The holder's side of a grab: holding, or pummelling. */
export const isHolding = (action: FighterAction): boolean =>
  action === 'holding' || action === 'pummel';

/** A circle that catches the fighter whose body it touches. */
export interface GrabBox {
  readonly center: Vec2;
  readonly radius: number;
}

/** The fighter's grab box this frame, if its move is a grab on its catching frames. */
export const activeGrabBox = (fighter: FighterState): GrabBox | undefined => {
  if (fighter.action !== 'attack' || fighter.moveId === null) return undefined;
  const { grab } = findMove(fighter.moveId);
  const frame = fighter.actionFrame;
  if (!grab || frame < grab.from || frame >= grab.to) return undefined;
  return { center: anchorPoint(fighter, grab.anchor), radius: grab.radius };
};

/** Fresh button presses and stick flicks on this frame, each of which shortens the hold. */
export const mashes = (input: PlayerInput, previous: PlayerInput): number => {
  const buttons = (['attack', 'special', 'jump', 'shortHop', 'shield', 'grab'] as const).filter(
    (button) => input[button] && !previous[button],
  ).length;
  const flicked = (now: number, before: number): boolean =>
    Math.abs(now) >= GRAB.mash.stick &&
    (Math.abs(before) < GRAB.mash.stick || Math.sign(now) !== Math.sign(before));
  return buttons + (flicked(input.x, previous.x) || flicked(input.y, previous.y) ? 1 : 0);
};

/** Keeps `x` on the platform the holder stands on, so nobody in a grab hangs past its edge. */
const onHoldersGround = (x: number, holder: FighterState, stage: StageDef): number => {
  const { x: hx, y: hy } = holder.position;
  const ground = stage.platforms.find((platform) => standsOn(hx, hy, platform));
  return ground ? Math.min(Math.max(x, ground.bounds.left), ground.bounds.right) : x;
};

/** Where a holder holds its catch: at arm's length in front, on the holder's ground. */
const heldPosition = (holder: FighterState, stage: StageDef): Vec2 => ({
  x: onHoldersGround(holder.position.x + holder.facing * GRAB.holdDistance, holder, stage),
  y: holder.position.y,
});

/** Out of a grab with nothing else to do: standing, or falling if there is no ground. */
const freed = (fighter: FighterState): FighterState => ({
  ...fighter,
  action: fighter.grounded ? 'idle' : 'airborne',
  actionFrame: 0,
  holding: null,
  heldBy: null,
  escapeFrames: 0,
});

/**
 * Both pushed apart into the short grab release, the holder back and the held one away, but not
 * off the holder's ground: the release plays out on the stage.
 */
const release = (
  holder: FighterState,
  held: FighterState,
  stage: StageDef,
): [FighterState, FighterState] => {
  const push = (fighter: FighterState, way: number): FighterState => ({
    ...fighter,
    position: {
      x: onHoldersGround(fighter.position.x + way * (GRAB.release.distance / 2), holder, stage),
      y: fighter.position.y,
    },
    velocity: { x: 0, y: 0 },
    action: 'grabRelease',
    actionFrame: 0,
    holding: null,
    heldBy: null,
    escapeFrames: 0,
  });
  return [push(holder, -holder.facing), push(held, holder.facing)];
};

/** Can be caught: in the match, not invulnerable, not frozen by a hit, not in a grab already. */
const catchable = (fighter: FighterState): boolean =>
  fighter.action !== 'eliminated' &&
  fighter.action !== 'grabbed' &&
  !isHolding(fighter.action) &&
  fighter.invulnerableFrames === 0 &&
  fighter.hitlagFrames === 0;

/**
 * Settles this frame's grabs, after its hits: grabs a hit broke up end, a fighter that broke free
 * and its holder go into the grab release, pummels land, and grab boxes catch.
 */
export const resolveGrabs = (
  fighters: readonly FighterState[],
  stage: StageDef,
): { fighters: FighterState[]; events: GameEvent[] } => {
  const next = [...fighters];
  const events: GameEvent[] = [];
  const at = (slot: PlayerSlot | null): FighterState | undefined =>
    slot === null ? undefined : next[slot];
  const set = (fighter: FighterState): void => {
    next[fighter.slot] = fighter;
  };

  // A grab one side left, by a hit or a KO, lets the other go too.
  for (const fighter of fighters) {
    const now = at(fighter.slot);
    if (!now) continue;
    if (now.heldBy !== null) {
      const holder = at(now.heldBy);
      const intact =
        now.action === 'grabbed' && holder?.holding === now.slot && isHolding(holder.action);
      if (!intact)
        set(now.action === 'grabbed' ? freed(now) : { ...now, heldBy: null, escapeFrames: 0 });
    }
    if (now.holding !== null) {
      const held = at(now.holding);
      const intact =
        isHolding(now.action) && held?.heldBy === now.slot && held.action === 'grabbed';
      if (!intact) set(isHolding(now.action) ? freed(now) : { ...now, holding: null });
    }
  }

  for (const holder of [...next]) {
    if (!isHolding(holder.action) || holder.holding === null) continue;
    const held = at(holder.holding);
    if (!held) continue;
    // Broke free: both pushed apart.
    if (held.escapeFrames <= 0) {
      const [h, t] = release(holder, held, stage);
      set(h);
      set(t);
      continue;
    }
    // A pummel lands on its hit frame: a little damage and no launch.
    if (holder.action === 'pummel' && holder.actionFrame === GRAB.pummel.hitFrame) {
      const { damage } = GRAB.pummel;
      set({ ...held, damage: held.damage + damage, lastHitBy: holder.slot });
      set({ ...holder, damageDealt: holder.damageDealt + damage });
      events.push({
        type: 'hit',
        attacker: holder.slot,
        target: held.slot,
        damage,
        position: heldPosition(holder, stage),
        launch: 0,
      });
    }
    // The catch stays at arm's length.
    const now = at(held.slot);
    if (now)
      set({ ...now, position: heldPosition(holder, stage), facing: holder.facing === 1 ? -1 : 1 });
  }

  // Grab boxes catch, in slot order: a fighter caught or catching this frame is taken.
  for (const fighter of fighters) {
    const grabber = at(fighter.slot);
    if (!grabber?.grounded || grabber.hitlagFrames > 0) continue;
    const box = activeGrabBox(grabber);
    if (!box) continue;
    const target = next.find(
      (other) =>
        other.slot !== grabber.slot &&
        catchable(other) &&
        touchesBody(box.center, box.radius, other),
    );
    if (!target) continue;
    const holder: FighterState = {
      ...grabber,
      action: 'holding',
      actionFrame: 0,
      moveId: null,
      hitTargets: [],
      buffer: null,
      velocity: { x: 0, y: 0 },
      knockback: { x: 0, y: 0 },
      holding: target.slot,
    };
    set(holder);
    set({
      ...target,
      action: 'grabbed',
      actionFrame: 0,
      moveId: null,
      hitTargets: [],
      buffer: null,
      position: heldPosition(holder, stage),
      velocity: { x: 0, y: 0 },
      knockback: { x: 0, y: 0 },
      facing: holder.facing === 1 ? -1 : 1,
      grounded: holder.grounded,
      tumbling: false,
      hitstunFrames: 0,
      ledge: null,
      // Held on the holder's ground: its jumps and air dodge come back, as on landing.
      jumpsRemaining: characterOf(target.characterId).stats.airJumps + 1,
      airDodgeUsed: false,
      heldBy: holder.slot,
      escapeFrames: Math.round(GRAB.hold.baseFrames + target.damage * GRAB.hold.perPercent),
    });
  }

  return { fighters: next, events };
};
