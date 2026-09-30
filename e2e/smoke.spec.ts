import { expect, test, type Page } from '@playwright/test';

/** Reads the debug handle installed in src/app/debug.ts. */
const screen = (page: Page) => page.evaluate(() => window.__SSB__?.screen());

const gameState = (page: Page) =>
  page.evaluate(() => {
    const state = window.__SSB__?.state();
    if (!state) throw new Error('No match running');
    return state;
  });

/** Title -> main menu -> character select -> stage select -> match, taking the first option. */
const startMatch = async (page: Page) => {
  await page.goto('/');
  for (const next of ['main-menu', 'character-select', 'stage-select', 'match']) {
    await page.keyboard.press('Enter');
    await expect.poll(() => screen(page)).toBe(next);
  }
};

test('the game boots into the title screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Title' })).toBeVisible();
  expect(await screen(page)).toBe('title');
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
