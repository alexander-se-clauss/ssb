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

/** Title -> main menu -> character select. */
const toCharacterSelect = async (page: Page) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('main-menu');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('character-select');
};

/** On character select: P1 moves up to the rules banner and opens the rules overlay. */
const openRules = async (page: Page) => {
  await tap(page, 'KeyW');
  await tap(page, 'KeyF');
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
};

/** (Title -> main menu ->) character select (both pick) -> stage select -> match. */
const startMatch = async (page: Page, { onCharacterSelect = false } = {}) => {
  if (!onCharacterSelect) await toCharacterSelect(page);
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
  await expect(page.getByRole('button')).toHaveText(['◀ Back', 'VS. Mode', 'Options']);
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('title');
});

test('VS. Mode leads to character select', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'VS. Mode' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('character-select');
});

test('Options holds game settings and shows the controls', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Options' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('options');
  await expect(page.getByRole('button', { name: /^Screen: Window/ })).toBeFocused();

  await page.getByRole('button', { name: 'Controls' }).click();
  await expect.poll(() => screen(page)).toBe('controls');
  await expect(page.locator('.menu-table tbody tr').first()).toHaveText(/Move\s*A \/ D\s*← \/ →/);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect.poll(() => screen(page)).toBe('options');
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('main-menu');
});

test('two players pick, change their minds and confirm on character select', async ({ page }) => {
  await toCharacterSelect(page);
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

test('character select goes back to the main menu with its Back button', async ({ page }) => {
  await toCharacterSelect(page);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect.poll(() => screen(page)).toBe('main-menu');
});

test('the rules banner opens the rules by click and the next match uses them', async ({ page }) => {
  await toCharacterSelect(page);
  await expect(page.locator('.css-rules')).toContainText('Stock · 3 lives');
  await page.locator('.css-rules').click();
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: /^Rule: Time/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: /^Time: 3 min/ })).toBeFocused();
  // Nothing applies until Done.
  await expect(page.locator('.css-rules')).toContainText('Stock · 3 lives');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeHidden();
  await expect(page.locator('.css-rules')).toContainText('Time · 3 min');
  // Arrow keys in the overlay must not have moved player two's cursor.
  expect(await page.evaluate(() => window.__SSB__?.characterSelect()?.cursors)).toEqual([0, 0]);

  await startMatch(page, { onCharacterSelect: true });
  const rules = (await gameState(page)).rules;
  expect(rules).toMatchObject({ mode: 'time', timeLimitSeconds: 180 });
  await expect(page.locator('.hud-clock')).toHaveText(/^[23]:\d\d$/);
});

test('the rules overlay steps lives up and down within limits, and Escape discards', async ({
  page,
}) => {
  await toCharacterSelect(page);
  await page.locator('.css-rules').click();
  const raise = page.getByRole('button', { name: 'Raise Stocks: 3' });
  await raise.click();
  await expect(page.getByRole('button', { name: 'Stocks: 4', exact: true })).toBeVisible();
  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: /^Lower Stocks/ }).click();
  }
  await expect(page.getByRole('button', { name: 'Stocks: 1', exact: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeHidden();
  await expect(page.locator('.css-rules')).toContainText('Stock · 3 lives');
  expect(await page.evaluate(() => window.__SSB__?.rules().stocks)).toBe(3);
});

/** Title -> main menu -> character select (both pick) -> stage select. */
const toStageSelect = async (page: Page) => {
  await toCharacterSelect(page);
  await tap(page, 'KeyF');
  await tap(page, 'Period');
  await expect.poll(() => picks(page)).toEqual(['capsule', 'capsule']);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('stage-select');
};

test('stage select previews the focused stage and starts the match there', async ({ page }) => {
  await toStageSelect(page);
  await expect(page.getByLabel('Battlefield preview')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Plateau' })).toBeFocused();
  await expect(page.getByLabel('Plateau preview')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('match');
  expect((await gameState(page)).stage.id).toBe('plateau');
});

test('stage select goes back to character select', async ({ page }) => {
  await toStageSelect(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('character-select');
  await tap(page, 'KeyF');
  await tap(page, 'Period');
  // Picks land on the next frame; wait for them before confirming.
  await expect.poll(() => picks(page)).toEqual(['capsule', 'capsule']);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('stage-select');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect.poll(() => screen(page)).toBe('character-select');
});

test('results show the winner and stats, and Rematch starts a new match', async ({ page }) => {
  // One stock, so walking off the stage once ends the match.
  await toCharacterSelect(page);
  await openRules(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: /^Stocks: 1/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeHidden();
  await expect(page.locator('.css-rules')).toContainText('Stock · 1 life');
  await expect.poll(() => screen(page)).toBe('character-select');
  // Back down from the banner onto the grid.
  await tap(page, 'KeyS');
  await startMatch(page, { onCharacterSelect: true });

  await page.keyboard.down('KeyA');
  await expect.poll(() => screen(page), { timeout: 20_000 }).toBe('results');
  await page.keyboard.up('KeyA');

  await expect(page.getByRole('heading', { name: 'Player 2 wins!' })).toBeVisible();
  const rows = page.locator('.results-table tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('P1');
  await expect(rows.nth(1)).toHaveClass(/winner/);
  await expect(rows.nth(0).locator('td').nth(3)).toHaveText('1');

  await expect(page.getByRole('button', { name: 'Rematch' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('match');
  expect((await gameState(page)).frame).toBeLessThan(120);
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

test('full flow: title, menus, a match ended through the debug handle, results, menu', async ({
  page,
}) => {
  await page.goto('/');
  expect(await screen(page)).toBe('title');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('main-menu');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('character-select');

  // One stock, so a single fall ends the match.
  await openRules(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.css-rules')).toContainText('Stock · 1 life');
  await tap(page, 'KeyS');

  await tap(page, 'KeyF');
  await tap(page, 'Period');
  await expect.poll(() => picks(page)).toEqual(['capsule', 'capsule']);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('stage-select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('match');
  expect((await gameState(page)).stage.id).toBe('plateau');
  expect((await gameState(page)).rules.stocks).toBe(1);

  // End the match: take over player one and walk off the stage.
  await page.evaluate(() => window.__SSB__?.hold(0, { x: -1 }));
  await expect.poll(() => screen(page), { timeout: 20_000 }).toBe('results');
  await page.evaluate(() => window.__SSB__?.release(0));
  await expect(page.getByRole('heading', { name: 'Player 2 wins!' })).toBeVisible();

  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect.poll(() => screen(page)).toBe('main-menu');
  await expect(page.getByRole('button', { name: 'VS. Mode' })).toBeFocused();
});
