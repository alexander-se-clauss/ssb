import { findCharacter, score, type MatchState } from '../core';

export interface Elimination {
  readonly slot: number;
  readonly frame: number;
}

export interface ResultPlacement {
  readonly slot: number;
  readonly place: number;
  readonly characterId: string;
  readonly character: string;
}

export const resultHeading = (state: MatchState): string =>
  state.winner === null ? 'Draw' : `Player ${state.winner + 1} wins!`;

/** Stock standings follow elimination time; timed standings use the simulation's score. */
export const resultPlacements = (
  state: MatchState,
  eliminations: readonly Elimination[] = [],
): ResultPlacement[] => {
  const standing = (slot: number): number => {
    const fighter = state.fighters.find((f) => f.slot === slot);
    if (!fighter) return -Infinity;
    if (state.rules.mode === 'time') return score(fighter);
    if (slot === state.winner || fighter.stocks > 0) return Infinity;
    return eliminations.find((entry) => entry.slot === slot)?.frame ?? -Infinity;
  };
  const fighters = [...state.fighters].sort((a, b) =>
    standing(a.slot) === standing(b.slot)
      ? a.slot - b.slot
      : standing(a.slot) > standing(b.slot)
        ? -1
        : 1,
  );
  let place = 1;
  return fighters.map((fighter, index) => {
    const previous = fighters[index - 1];
    if (previous && standing(previous.slot) !== standing(fighter.slot)) place = index + 1;
    return {
      slot: fighter.slot,
      place,
      characterId: fighter.characterId,
      character: findCharacter(fighter.characterId)?.name ?? fighter.characterId,
    };
  });
};

/** Text alternatives and player identification accompany the rendered podium. */
export const renderResults = (placements: readonly ResultPlacement[]): HTMLElement => {
  const root = document.createElement('section');
  root.className = 'results-podium';
  root.setAttribute('aria-label', 'Match standings');
  const scene = document.createElement('div');
  scene.className = 'results-scene';
  const list = document.createElement('ol');
  list.className = 'results-placements';
  for (const entry of placements) {
    const item = document.createElement('li');
    item.dataset['place'] = String(entry.place);
    item.dataset['player'] = String(entry.slot + 1);
    item.dataset['character'] = entry.characterId;
    const rank = document.createElement('strong');
    rank.textContent = `#${entry.place}`;
    const name = document.createElement('span');
    name.textContent = `P${entry.slot + 1} · ${entry.character}`;
    item.append(rank, name);
    list.append(item);
  }
  root.append(scene, list);
  return root;
};
