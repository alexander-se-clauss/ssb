import type { MusicTrack, SoundCue } from '../ports';
import type { SelectState } from './character-select';
import type { Screen } from './screens';

/** The devices that are in `state` and not in `other`. */
const missingFrom = (state: SelectState, other: SelectState): boolean =>
  state.devices.some((device) => device !== null && !other.devices.includes(device));

/** A device's cursor, followed by device rather than slot, since slots shift when one leaves. */
const cursorOf = (state: SelectState, device: number): number | undefined =>
  state.cursors[state.devices.indexOf(device)];

/** Whether a device that plays in both states has a pick in `state` and none in `other`. */
const pickedIn = (state: SelectState, other: SelectState): boolean =>
  state.devices.some(
    (device, slot) =>
      device !== null &&
      state.picks[slot] != null &&
      other.devices.includes(device) &&
      other.picks[other.devices.indexOf(device)] == null,
  );

/**
 * The one sound for a frame of character select, from the state before and after it. The most
 * important change wins: someone joining or leaving, then a pick or un-pick, then the rules
 * opening or closing, then a cursor moving. Nothing changed, no sound, so a held button is quiet.
 */
export const selectCue = (before: SelectState, after: SelectState): SoundCue | null => {
  if (missingFrom(after, before)) return 'join';
  if (missingFrom(before, after)) return 'leave';
  if (pickedIn(after, before)) return 'pick';
  if (pickedIn(before, after)) return 'menu-back';
  if (after.rulesOpen !== before.rulesOpen) return after.rulesOpen ? 'menu-confirm' : 'menu-back';
  const moved =
    after.devices.some(
      (device) => device !== null && cursorOf(after, device) !== cursorOf(before, device),
    ) ||
    Object.entries(after.guestCursors).some(
      ([device, cursor]) => cursor !== (before.guestCursors[Number(device)] ?? 0),
    );
  return moved ? 'menu-move' : null;
};

/** The music for a screen: the stage's own track in a match, a jingle on results, else the menu theme. */
export const screenMusic = (screen: Screen, stageId: string): MusicTrack => {
  if (screen === 'match') return stageId;
  if (screen === 'results') return 'results';
  return 'menu';
};
