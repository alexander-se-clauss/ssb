import { expect, test, type Page } from '@playwright/test';

/** Reads game state through the debug handle installed in src/app/debug.ts. */
const gameState = (page: Page) =>
  page.evaluate(() => {
    const handle = window.__SSB__;
    if (!handle) throw new Error('Debug handle missing');
    return handle.state();
  });

test('the game boots, renders and simulates', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.hud-card')).toHaveCount(2);

  await expect.poll(async () => (await gameState(page)).frame).toBeGreaterThan(60);
  expect(errors).toEqual([]);
});

test('player one moves right when D is held', async ({ page }) => {
  await page.goto('/');
  await expect.poll(async () => (await gameState(page)).fighters[0]?.grounded).toBe(true);
  const startX = (await gameState(page)).fighters[0]?.position.x ?? 0;

  await page.keyboard.down('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyD');

  const endX = (await gameState(page)).fighters[0]?.position.x ?? 0;
  expect(endX).toBeGreaterThan(startX);
});
