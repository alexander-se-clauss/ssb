import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../../core';
import { CHARACTER_LOOKS, fighterModel, NEUTRAL_COLOR } from './fighter-model';
import { OVERALLS } from './models/rivet';
import { PLATES } from './models/vela';

const colors = (characterId: string, color: number) =>
  fighterModel(characterId, color).materials.map((material) => material.color.getHex());

describe('fighter models', () => {
  it('gives every registry character its own look', () => {
    for (const character of CHARACTERS) expect(CHARACTER_LOOKS[character.id]).toBeDefined();
  });

  it("paints Rivet's overalls in the player's colour and keeps them for the neutral portrait", () => {
    expect(colors('rivet', NEUTRAL_COLOR)).toContain(OVERALLS);
    expect(colors('rivet', 0xe94f4f)).toContain(0xe94f4f);
    expect(colors('rivet', 0xe94f4f)).not.toContain(OVERALLS);
  });

  it("paints Vela's armour plates in the player's colour", () => {
    expect(colors('vela', NEUTRAL_COLOR)).toContain(PLATES);
    expect(colors('vela', 0x4f8fe9)).toContain(0x4f8fe9);
    expect(colors('vela', 0x4f8fe9)).not.toContain(PLATES);
  });

  it('draws the whole capsule in the player colour', () => {
    expect(colors('capsule', 0x4f8fe9)).toContain(0x4f8fe9);
  });
});
