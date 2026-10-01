import { describe, expect, it } from 'vitest';
import type { AttackDirection, AttackStrength } from './attack-input';
import { MOVES } from './move-data';
import { MOVE_SLOTS, moveSlot, type MoveSlot, type SlotChoice } from './move-slots';
import { CHARACTERS, findCharacter } from './registry';
import { fighter, inputOf, run, settled, withFighter } from './test-helpers';

type Row = readonly [
  grounded: boolean,
  button: 'attack' | 'special',
  direction: AttackDirection,
  strength: AttackStrength,
  slot: MoveSlot,
  turnAround: boolean,
];

// Every situation, direction and strength, and the slot it resolves to.
const TABLE: readonly Row[] = [
  // Ground attacks: tilts and smashes. Back turns the fighter around first.
  [true, 'attack', 'neutral', 'tilt', 'jab', false],
  [true, 'attack', 'forward', 'tilt', 'forwardTilt', false],
  [true, 'attack', 'back', 'tilt', 'forwardTilt', true],
  [true, 'attack', 'up', 'tilt', 'upTilt', false],
  [true, 'attack', 'down', 'tilt', 'downTilt', false],
  [true, 'attack', 'forward', 'smash', 'forwardSmash', false],
  [true, 'attack', 'back', 'smash', 'forwardSmash', true],
  [true, 'attack', 'up', 'smash', 'upSmash', false],
  [true, 'attack', 'down', 'smash', 'downSmash', false],
  // Aerials: strength does not matter, and the fighter keeps facing the same way.
  [false, 'attack', 'neutral', 'tilt', 'neutralAir', false],
  [false, 'attack', 'forward', 'tilt', 'forwardAir', false],
  [false, 'attack', 'forward', 'smash', 'forwardAir', false],
  [false, 'attack', 'back', 'tilt', 'backAir', false],
  [false, 'attack', 'back', 'smash', 'backAir', false],
  [false, 'attack', 'up', 'smash', 'upAir', false],
  [false, 'attack', 'down', 'tilt', 'downAir', false],
  // Specials: the same on the ground and in the air; side turns to the stick.
  [true, 'special', 'neutral', 'tilt', 'neutralSpecial', false],
  [true, 'special', 'forward', 'smash', 'sideSpecial', false],
  [true, 'special', 'back', 'tilt', 'sideSpecial', true],
  [false, 'special', 'back', 'smash', 'sideSpecial', true],
  [false, 'special', 'up', 'tilt', 'upSpecial', false],
  [true, 'special', 'down', 'smash', 'downSpecial', false],
];

describe('move slots', () => {
  it.each(TABLE)(
    'grounded %s, %s %s %s -> %s (turn around: %s)',
    (grounded, button, direction, strength, slot, turnAround) => {
      const choice: SlotChoice = moveSlot({ grounded, button, attack: { direction, strength } });
      expect(choice).toEqual({ slot, turnAround });
    },
  );

  it('covers every slot in the table', () => {
    expect(new Set(TABLE.map((row) => row[4]))).toEqual(new Set(MOVE_SLOTS));
  });

  it('maps every character slot to a move that exists', () => {
    for (const character of CHARACTERS) {
      for (const id of Object.values(character.moves)) expect(MOVES).toHaveProperty([id]);
    }
  });
});

describe('fighters pick moves by slot', () => {
  const press = (button: 'attack' | 'special', x: number) => [
    inputOf({ x, [button]: true }),
    inputOf({ x }),
  ];

  it('plays the move in the slot the input asks for', () => {
    // A soft push forward with attack is a forward tilt; the capsule fills it with the jab.
    expect(findCharacter('capsule')?.moves.forwardTilt).toBe('jab');
    const state = run(settled(), 1, press('attack', 0.5));
    expect(fighter(state, 0).action).toBe('attack');
    expect(fighter(state, 0).moveId).toBe('jab');
  });

  it('does nothing when the slot is empty', () => {
    expect(findCharacter('capsule')?.moves.neutralSpecial).toBeUndefined();
    const state = run(settled(), 1, press('special', 0));
    expect(fighter(state, 0).action).toBe('idle');
    expect(fighter(state, 0).moveId).toBeNull();
  });

  it('turns around for a ground attack aimed behind', () => {
    const facingRight = withFighter(settled(), 0, { facing: 1 });
    const state = run(facingRight, 1, press('attack', -0.5));
    expect(fighter(state, 0).facing).toBe(-1);
    expect(fighter(state, 0).action).toBe('attack');
  });

  it('keeps facing for an aerial aimed behind: that is the back aerial', () => {
    const airborne = withFighter(settled(), 0, {
      grounded: false,
      action: 'airborne',
      facing: 1,
      position: { x: 0, y: 6 },
    });
    const state = run(airborne, 1, press('attack', -0.5));
    expect(fighter(state, 0).facing).toBe(1);
    expect(fighter(state, 0).action).toBe('attack');
  });

  it('attacks downwards on a pass-through platform instead of dropping through it', () => {
    // Fighter 0 settles on a pass-through platform on Battlefield.
    const start = fighter(settled(), 0);
    expect(start.grounded).toBe(true);
    const state = run(settled(), 1, [inputOf({ y: -1, attack: true })]);
    expect(fighter(state, 0).grounded).toBe(true);
    expect(fighter(state, 0).position.y).toBe(start.position.y);
    expect(fighter(state, 0).action).toBe('attack');
  });
});
