import type { SoundCue } from '../ports';
import type { SelectState } from './character-select';

/** The devices that are in `state` and not in `other`. */
const missingFrom = (state: SelectState, other: SelectState): boolean =>
  state.devices.some((device) => device !== null && !other.devices.includes(device));

const pickCount = (state: SelectState): number =>
  state.picks.filter((pick) => pick !== null).length;

/** A device's cursor, followed by device rather than slot, since slots shift when one leaves. */
const cursorOf = (state: SelectState, device: number): number | undefined =>
  state.cursors[state.devices.indexOf(device)];

/**
 * The one sound for a frame of character select, from the state before and after it. The most
 * important change wins: someone joining or leaving, then a pick or un-pick, then the rules
 * opening or closing, then a cursor moving. Nothing changed, no sound, so a held button is quiet.
 */
export const selectCue = (before: SelectState, after: SelectState): SoundCue | null => {
  if (missingFrom(after, before)) return 'join';
  if (missingFrom(before, after)) return 'leave';
  if (pickCount(after) > pickCount(before)) return 'pick';
  if (pickCount(after) < pickCount(before)) return 'menu-back';
  if (after.rulesOpen !== before.rulesOpen) return after.rulesOpen ? 'menu-confirm' : 'menu-back';
  const moved = after.devices.some(
    (device) => device !== null && cursorOf(after, device) !== cursorOf(before, device),
  );
  return moved ? 'menu-move' : null;
};
