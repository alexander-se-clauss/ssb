/** Embers rise through a band of the menu backdrop and start again at its bottom. */
export const emberHeight = (
  start: number,
  speed: number,
  seconds: number,
  band: { readonly bottom: number; readonly top: number },
): number => {
  const span = band.top - band.bottom;
  const risen = start - band.bottom + speed * seconds;
  return band.bottom + (((risen % span) + span) % span);
};
