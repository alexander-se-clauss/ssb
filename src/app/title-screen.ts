/** HTML stays separate from the decorative 3D illustration so start is always accessible. */
export const titleScreenBody = (start: () => void): HTMLElement => {
  const body = document.createElement('div');
  body.className = 'title-content';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'title-eyebrow';
  eyebrow.textContent = 'Platform fighter / Local versus';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'title-start';
  button.textContent = 'Press start';
  button.addEventListener('click', start);
  body.append(eyebrow, button);
  return body;
};
