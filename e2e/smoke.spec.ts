import { expect, test, type Page } from '@playwright/test';

/** Reads the debug handle installed in src/app/debug.ts. */
const screen = (page: Page) => page.evaluate(() => window.__SSB__?.screen());

const gameState = (page: Page) =>
  page.evaluate(() => {
    const state = window.__SSB__?.state();
    if (!state) throw new Error('No match running');
    return state;
  });

/** Holds a key long enough for the game to sample it on a frame. */
const tap = async (page: Page, key: string) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(50);
  await page.keyboard.up(key);
  await page.waitForTimeout(50);
};

const picks = (page: Page) => page.evaluate(() => window.__SSB__?.characterSelect()?.picks);

/** (Title ->) main menu -> character select (both pick) -> stage select -> match. */
const startMatch = async (page: Page, { fromMainMenu = false } = {}) => {
  if (!fromMainMenu) {
    await page.goto('/');
    await page.keyboard.press('Enter');
    await expect.poll(() => screen(page)).toBe('main-menu');
  }
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('character-select');
  await tap(page, 'KeyF');
  await tap(page, 'Period');
  await expect.poll(() => picks(page)).toEqual(['capsule', 'capsule']);
  for (const next of ['stage-select', 'match']) {
    await page.keyboard.press('Enter');
    await expect.poll(() => screen(page)).toBe(next);
  }
};

test('the game boots into the title screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SSB' })).toBeVisible();
  await expect(page.getByText('Press start')).toBeVisible();
  expect(await screen(page)).toBe('title');
});

test('start opens the main menu, and Escape goes back', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Space');
  await expect.poll(() => screen(page)).toBe('main-menu');
  await expect(page.getByRole('button')).toHaveText(['Versus', 'Options']);
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('title');
});

test('Versus leads to character select', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Versus' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('character-select');
});

test('Options leads to the options screen', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Options' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('options');
});

test('two players pick, change their minds and confirm on character select', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('character-select');
  await expect(page.locator('.css-cell')).toHaveCount(1);

  await tap(page, 'KeyF');
  await expect.poll(() => picks(page)).toEqual(['capsule', null]);
  await page.keyboard.press('Enter');
  expect(await screen(page)).toBe('character-select');

  await tap(page, 'KeyG');
  await expect.poll(() => picks(page)).toEqual([null, null]);
  await tap(page, 'KeyF');
  await tap(page, 'Period');
  await expect.poll(() => picks(page)).toEqual(['capsule', 'capsule']);
  await expect(page.getByText('Ready! Press Enter')).toBeVisible();

  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('stage-select');
  await expect(page.locator('.css')).toBeHidden();
});

test('rules changed in options apply to the next match', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('options');

  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: /Rule: Time/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: /Time: 3 min/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('main-menu');

  await startMatch(page, { fromMainMenu: true });
  const rules = (await gameState(page)).rules;
  expect(rules).toMatchObject({ mode: 'time', timeLimitSeconds: 180 });
  await expect(page.locator('.hud-clock')).toHaveText(/^[23]:\d\d$/);
});

test('a match starts from the menus, renders and simulates', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await startMatch(page);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.hud-card')).toHaveCount(2);

  await expect.poll(async () => (await gameState(page)).frame).toBeGreaterThan(60);
  expect(errors).toEqual([]);
});

test('player one moves right when D is held', async ({ page }) => {
  await startMatch(page);
  await expect.poll(async () => (await gameState(page)).fighters[0]?.grounded).toBe(true);
  const startX = (await gameState(page)).fighters[0]?.position.x ?? 0;

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyD');

  const endX = (await gameState(page)).fighters[0]?.position.x ?? 0;
  expect(endX).toBeGreaterThan(startX);
});
