import { expect, test, type Page, type TestInfo } from '@playwright/test';

/** Reads the debug handle installed in src/app/debug.ts. */
const screen = (page: Page) => page.evaluate(() => window.__SSB__?.screen());

/**
 * How long to wait for something that takes game frames, such as a fall off the stage or a
 * match end. With software WebGL, several parallel browsers can drop the game to a few frames
 * per second, so a fall of under two game seconds can take half a minute.
 */
const FRAMES_TIMEOUT = { timeout: 45_000 };

const gameState = (page: Page) =>
  page.evaluate(() => {
    const state = window.__SSB__?.state();
    if (!state) throw new Error('No match running');
    return state;
  });

/**
 * Waits until the game has run a frame or two. Inputs are sampled once per frame, so a press
 * must last that long, and two presses of one button need a frame between them to count twice.
 * Waiting for animation frames instead of a fixed time keeps this reliable under load.
 */
const nextFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

/** Holds a key long enough for the game to sample it on a frame, then lets go for a frame. */
const tap = async (page: Page, key: string) => {
  await page.keyboard.down(key);
  await nextFrames(page);
  await page.keyboard.up(key);
  await nextFrames(page);
};

const characterSelect = (page: Page) => page.evaluate(() => window.__SSB__?.characterSelect());
const picks = async (page: Page) => (await characterSelect(page))?.picks;

/** Title -> main menu -> character select. */
const toCharacterSelect = async (page: Page) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('main-menu');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('character-select');
};

/**
 * On character select: both keyboard players join (first press) and pick (second press). The
 * keyboard halves are P1 and P2 because they join in that order.
 */
const bothPick = async (page: Page) => {
  for (const [key, device] of [
    ['KeyF', 0],
    ['Period', 1],
  ] as const) {
    const joined = (await characterSelect(page))?.devices.includes(device) ?? false;
    if (!joined) {
      await tap(page, key);
      await expect.poll(async () => (await characterSelect(page))?.devices).toContain(device);
    }
    await tap(page, key);
  }
  await expect.poll(() => picks(page)).toEqual(['capsule', 'capsule', null, null]);
};

/** On character select: P1 joins, moves up to the rules banner and opens the rules overlay. */
const openRules = async (page: Page) => {
  await tap(page, 'KeyF');
  await tap(page, 'KeyW');
  await tap(page, 'KeyF');
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
};

/** (Title -> main menu ->) character select (both pick) -> stage select -> match. */
const startMatch = async (page: Page, { onCharacterSelect = false } = {}) => {
  if (!onCharacterSelect) await toCharacterSelect(page);
  await bothPick(page);
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

test('title illustration supports resizing, reduced motion and mouse start, and is disposed on exit', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const canvas = page.locator('canvas.title-scene');
  await expect(canvas).toBeVisible();
  await nextFrames(page);
  expect(await page.evaluate(() => window.__SSB__?.state())).toBeUndefined();
  await page.screenshot({ path: testInfo.outputPath('title-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await nextFrames(page);
  await expect(page.getByRole('heading', { name: 'SSB', exact: true })).toBeVisible();
  const start = page.getByRole('button', { name: 'Press start', exact: true });
  await expect(start).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('title-narrow.png') });
  await start.click();
  await expect.poll(() => screen(page)).toBe('main-menu');
  await expect(canvas).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('title');
  await expect(canvas).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('main-menu');
  await expect(canvas).toHaveCount(0);
});

test('start opens the main menu, and Escape goes back', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Space');
  await expect.poll(() => screen(page)).toBe('main-menu');
  await expect(page.getByRole('button')).toHaveText(['◀ Back', 'VS. Mode', 'Options']);
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('title');
});

/**
 * Notes on `<body data-screen-at-wipe>` which screen the app reports when the next screen wipe
 * appears ("none" until then). Observers run after the task, so a wipe that arrives together
 * with its new screen notes the new screen.
 */
const watchNextWipe = (page: Page) =>
  page.evaluate(() => {
    const app = document.querySelector('#app');
    if (!app) throw new Error('Missing #app');
    document.body.dataset['screenAtWipe'] = 'none';
    const observer = new MutationObserver((records) => {
      const added = records.flatMap((record) => [...record.addedNodes]);
      if (!added.some((node) => node instanceof Element && node.matches('.screen-wipe'))) return;
      document.body.dataset['screenAtWipe'] = window.__SSB__?.screen();
      observer.disconnect();
    });
    observer.observe(app, { childList: true });
  });

test('a screen change wipes the old screen away without delaying the new one', async ({ page }) => {
  const screenAtWipe = page.locator('body');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SSB', exact: true })).toBeVisible();
  await watchNextWipe(page);
  await page.keyboard.press('Enter');
  await expect(screenAtWipe).toHaveAttribute('data-screen-at-wipe', 'main-menu');
  // Its copy of the old screen is hidden from the page: only the real menu is found.
  await expect(page.getByRole('button')).toHaveText(['◀ Back', 'VS. Mode', 'Options']);
  await expect(page.locator('.screen-wipe')).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await watchNextWipe(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('title');
  await nextFrames(page);
  await expect(screenAtWipe).toHaveAttribute('data-screen-at-wipe', 'none');
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

  await expect(page.locator('.css-slot.empty')).toHaveCount(4);
  await tap(page, 'KeyF');
  await expect
    .poll(() => characterSelect(page))
    .toMatchObject({
      devices: [0, null, null, null],
      picks: [null, null, null, null],
    });
  await tap(page, 'KeyF');
  await expect.poll(() => picks(page)).toEqual(['capsule', null, null, null]);
  await tap(page, 'Period');
  await page.keyboard.press('Enter');
  expect(await screen(page)).toBe('character-select');

  // Special un-picks, and again leaves the slot: the arrow-keys half moves up to P1.
  await tap(page, 'KeyG');
  await expect.poll(() => picks(page)).toEqual([null, null, null, null]);
  await tap(page, 'KeyG');
  await expect
    .poll(async () => (await characterSelect(page))?.devices)
    .toEqual([1, null, null, null]);
  await tap(page, 'Period');
  await expect.poll(() => picks(page)).toEqual(['capsule', null, null, null]);
  // One player alone cannot start a match: a second one joins and picks.
  await expect(page.getByText('Ready to Fight', { exact: true })).toBeHidden();
  await tap(page, 'KeyF');
  await tap(page, 'KeyF');
  await expect.poll(() => picks(page)).toEqual(['capsule', 'capsule', null, null]);
  await expect(page.getByText('Ready to Fight', { exact: true })).toBeVisible();

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
  // The arrow-keys half joins, so the test can check its cursor stays put below the overlay.
  await tap(page, 'Period');
  await expect.poll(async () => (await characterSelect(page))?.devices[0]).toBe(1);
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
  // Arrow keys in the overlay must not have moved the arrow-keys player's cursor.
  expect((await characterSelect(page))?.cursors[0]).toBe(0);

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
  await bothPick(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('stage-select');
};

test('stage grid centers rendered thumbnails and keyboard selection starts the chosen stage', async ({
  page,
}, testInfo) => {
  await toStageSelect(page);
  const grid = page.locator('.menu-grid');
  await expect(grid.locator('img')).toHaveCount(2);
  for (const image of await grid.locator('img').all()) {
    await expect
      .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
      .toBe(640);
    await expect(image).toHaveAttribute('src', /^data:image\/png;base64,/);
  }
  const box = await grid.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error('Missing grid or viewport');
  expect(box.x + box.width / 2).toBeCloseTo(viewport.width / 2, 0);
  expect(box.y + box.height / 2).toBeCloseTo(viewport.height / 2, 0);
  await page.screenshot({ path: testInfo.outputPath('stage-grid-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await grid.boundingBox();
  if (!narrow) throw new Error('Missing narrow grid');
  expect(narrow.x + narrow.width / 2).toBeCloseTo(195, 0);
  expect(narrow.y + narrow.height / 2).toBeCloseTo(422, 0);
  expect(narrow.x).toBeGreaterThanOrEqual(0);
  expect(narrow.x + narrow.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('stage-grid-narrow.png') });
  await page.setViewportSize(viewport);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Final Destination' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: 'Battlefield', exact: true })).toBeFocused();
  await page.keyboard.press('KeyD');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('match');
  expect((await gameState(page)).stage.id).toBe('final-destination');
});

test('a stage thumbnail can be selected with the mouse', async ({ page }) => {
  await toStageSelect(page);
  await page.getByRole('button', { name: 'Final Destination' }).locator('img').click();
  await expect.poll(() => screen(page)).toBe('match');
  expect((await gameState(page)).stage.id).toBe('final-destination');
});

test('stage select goes back to character select', async ({ page }) => {
  await toStageSelect(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('character-select');
  // Leaving cleared the joins, so both join and pick again.
  await bothPick(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('stage-select');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect.poll(() => screen(page)).toBe('character-select');
});

test('results show the winner podium, and Rematch starts a new match', async ({ page }) => {
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
  // The match says GAME! before the results screen names the winner.
  await expect(page.getByRole('status')).toHaveText('Game!', FRAMES_TIMEOUT);
  await expect.poll(() => screen(page), FRAMES_TIMEOUT).toBe('results');
  await page.keyboard.up('KeyA');

  await expect(page.getByRole('heading', { name: 'Player 2 wins!' })).toBeVisible();
  await expect(page.locator('.results-scene canvas')).toBeVisible();
  const standings = page.locator('.results-placements li');
  await expect(standings).toHaveCount(2);
  await expect(standings.nth(0)).toHaveAttribute('data-player', '2');
  await expect(standings.nth(0)).toHaveAttribute('data-place', '1');
  await expect(standings.nth(1)).toHaveAttribute('data-place', '2');
  await expect(page.locator('.results-table')).toHaveCount(0);

  await expect(page.getByRole('button', { name: 'Rematch' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('match');
  expect((await gameState(page)).frame).toBeLessThan(120);
  await expect(page.locator('.results-scene canvas')).toHaveCount(0);
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

  // Held until the game has stepped with it: a slow first frame (shader compile on CI) can
  // swallow a fixed-length hold before the simulation ever samples the key.
  await page.keyboard.down('KeyD');
  await expect
    .poll(async () => (await gameState(page)).fighters[0]?.position.x ?? 0)
    .toBeGreaterThan(startX);
  await page.keyboard.up('KeyD');
});

test('a match starts with READY, fighters wait for GO!, then move', async ({ page }) => {
  await startMatch(page);
  const banner = page.getByRole('status');
  await expect(banner).toHaveText('Ready');
  expect((await gameState(page)).phase).toBe('countdown');
  // Held through the countdown: nobody moves before GO.
  await page.keyboard.down('KeyD');
  await nextFrames(page);
  const startX = (await gameState(page)).fighters[0]?.position.x ?? 0;
  await expect.poll(async () => (await gameState(page)).phase, FRAMES_TIMEOUT).toBe('playing');
  await expect(banner).toHaveText('Go!');
  await expect
    .poll(async () => (await gameState(page)).fighters[0]?.position.x ?? 0, FRAMES_TIMEOUT)
    .toBeGreaterThan(startX);
  await page.keyboard.up('KeyD');
  await expect(banner).toBeHidden(FRAMES_TIMEOUT);
});

test('an idle fighter keeps moving, and running changes the pose', async ({ page }) => {
  await startMatch(page);
  await expect.poll(async () => (await gameState(page)).fighters[0]?.grounded).toBe(true);
  const torso = async () => (await gameState(page)).fighters[0]?.pose.torso ?? 0;
  const legs = async () => (await gameState(page)).fighters[0]?.pose.upperLegFront ?? 0;
  // Breathing: the torso angle drifts while standing still.
  const first = await torso();
  await expect.poll(torso).not.toBeCloseTo(first, 1);

  const idleLegs = await legs();
  await page.keyboard.down('KeyD');
  await expect.poll(async () => Math.abs((await legs()) - idleLegs)).toBeGreaterThan(10);
  await page.keyboard.up('KeyD');
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

  await bothPick(page);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('stage-select');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('match');
  expect((await gameState(page)).stage.id).toBe('final-destination');
  expect((await gameState(page)).rules.stocks).toBe(1);

  // End the match: take over player one and walk off the stage.
  await page.evaluate(() => window.__SSB__?.hold(0, { x: -1 }));
  await expect.poll(() => screen(page), FRAMES_TIMEOUT).toBe('results');
  await page.evaluate(() => window.__SSB__?.release(0));
  await expect(page.getByRole('heading', { name: 'Player 2 wins!' })).toBeVisible();

  await page.getByRole('button', { name: 'Main menu' }).click();
  await expect.poll(() => screen(page)).toBe('main-menu');
  await expect(page.getByRole('button', { name: 'VS. Mode' })).toBeFocused();
});

/**
 * Fake Standard Gamepads, so the tests need no hardware. Browsers may leave slot 0 empty, as
 * Alex's did, so the pads sit from slot 1 on.
 */
const installPads = (page: Page, count: number) =>
  page.addInitScript((padCount) => {
    const pads = Array.from({ length: padCount }, () => ({
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
    }));
    Object.assign(window, { fakePads: pads });
    navigator.getGamepads = () => [null, ...pads] as unknown as Gamepad[];
  }, count);

/** Button indices of the Standard Gamepad layout. */
const PAD = { a: 0, b: 1, start: 9 } as const;

type PadChange = { axes?: number[]; button?: number; on?: boolean };

/** Changes several fake pads at once, so the game sees all changes on the same frame. */
const setPads = (page: Page, changes: readonly (readonly [number, PadChange])[]) =>
  page.evaluate((list) => {
    const pads = (
      window as unknown as { fakePads: { axes: number[]; buttons: { pressed: boolean }[] }[] }
    ).fakePads;
    for (const [pad, change] of list) {
      const target = pads[pad];
      if (!target) throw new Error(`No fake pad ${pad}`);
      if (change.axes) target.axes = change.axes;
      const button = change.button === undefined ? undefined : target.buttons[change.button];
      if (button) button.pressed = change.on ?? false;
    }
  }, changes);

const setPad = (page: Page, pad: number, change: PadChange) => setPads(page, [[pad, change]]);

/** Presses A on both pads in the same frame, then lets go. */
const pressBoth = async (page: Page) => {
  await setPads(page, [
    [0, { button: PAD.a, on: true }],
    [1, { button: PAD.a, on: true }],
  ]);
  await nextFrames(page);
  await setPads(page, [
    [0, { button: PAD.a, on: false }],
    [1, { button: PAD.a, on: false }],
  ]);
  await nextFrames(page);
};

/** Presses a pad button for a few frames, then lets go. */
const press = async (page: Page, pad: number, button: number) => {
  await setPad(page, pad, { button, on: true });
  await nextFrames(page);
  await setPad(page, pad, { button, on: false });
  await nextFrames(page);
};

/** Pushes the left stick (x right, y down as the Gamepad API reports it), then centres it. */
const flick = async (page: Page, pad: number, x: number, y: number) => {
  await setPad(page, pad, { axes: [x, y, 0, 0] });
  await nextFrames(page);
  await setPad(page, pad, { axes: [0, 0, 0, 0] });
  await nextFrames(page);
};

test('the whole menu flow works with gamepads only', async ({ page }) => {
  await installPads(page, 2);
  await page.goto('/');
  // Let the game sample the pads at rest once, so the first A counts as a press.
  await nextFrames(page);
  // Both pads press A in the same frame: that leaves the title once, not twice.
  await pressBoth(page);
  await expect.poll(() => screen(page)).toBe('main-menu');

  // Down to Options, in and back out with B.
  await flick(page, 0, 0, 1);
  await expect(page.getByRole('button', { name: 'Options' })).toBeFocused();
  await press(page, 0, PAD.a);
  await expect.poll(() => screen(page)).toBe('options');
  await press(page, 0, PAD.b);
  await expect.poll(() => screen(page)).toBe('main-menu');

  // Up from the first entry reaches the Back button.
  await expect(page.getByRole('button', { name: 'VS. Mode' })).toBeFocused();
  await flick(page, 0, 0, -1);
  await expect(page.getByRole('button', { name: 'Back' })).toBeFocused();
  await flick(page, 0, 0, 1);
  await press(page, 0, PAD.a);
  await expect.poll(() => screen(page)).toBe('character-select');

  // Whoever presses A first joins as P1, here the second pad (device 4: two keyboard halves,
  // then the browser's pad slots 0-3, of which slots 1 and 2 hold our pads).
  await press(page, 1, PAD.a);
  await press(page, 0, PAD.a);
  await expect.poll(async () => (await characterSelect(page))?.devices).toEqual([4, 3, null, null]);

  // The rules overlay: up to the banner, open, raise the lives, Done.
  await flick(page, 1, 0, -1);
  await press(page, 1, PAD.a);
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
  await flick(page, 1, 0, 1);
  await flick(page, 1, 1, 0);
  await flick(page, 1, 0, 1);
  await expect(page.getByRole('button', { name: 'Done' })).toBeFocused();
  await press(page, 1, PAD.a);
  await expect(page.getByRole('heading', { name: 'Rules' })).toBeHidden();
  expect((await page.evaluate(() => window.__SSB__?.rules()))?.stocks).toBe(4);

  // Both pick, then A again starts.
  await flick(page, 1, 0, 1);
  await press(page, 1, PAD.a);
  await expect.poll(() => picks(page)).toEqual(['capsule', null, null, null]);
  await press(page, 0, PAD.a);
  await expect.poll(() => picks(page)).toEqual(['capsule', 'capsule', null, null]);
  await press(page, 0, PAD.a);
  await expect.poll(() => screen(page)).toBe('stage-select');
  await flick(page, 1, 1, 0);
  await expect(page.getByRole('button', { name: 'Final Destination' })).toBeFocused();
  await press(page, 1, PAD.a);
  await expect.poll(() => screen(page)).toBe('match');

  // P1 is the second pad.
  await expect.poll(async () => (await gameState(page)).fighters[0]?.grounded).toBe(true);
  const startX = (await gameState(page)).fighters[0]?.position.x ?? 0;
  await setPad(page, 1, { axes: [1, 0, 0, 0] });
  await expect
    .poll(async () => (await gameState(page)).fighters[0]?.position.x ?? 0)
    .toBeGreaterThan(startX + 1);
});

test('B un-picks, then leaves the slot, then backs out of character select', async ({ page }) => {
  await installPads(page, 1);
  await toCharacterSelect(page);
  await press(page, 0, PAD.a);
  await press(page, 0, PAD.a);
  await expect.poll(() => picks(page)).toEqual(['capsule', null, null, null]);
  await press(page, 0, PAD.b);
  await expect.poll(() => picks(page)).toEqual([null, null, null, null]);
  await press(page, 0, PAD.b);
  await expect
    .poll(async () => (await characterSelect(page))?.devices)
    .toEqual([null, null, null, null]);
  expect(await screen(page)).toBe('character-select');
  await press(page, 0, PAD.b);
  await expect.poll(() => screen(page)).toBe('main-menu');
});

test('a join on the same frame as a start keeps everyone on character select', async ({ page }) => {
  await installPads(page, 2);
  await toCharacterSelect(page);
  await press(page, 0, PAD.a);
  await press(page, 0, PAD.a);
  await expect.poll(() => picks(page)).toEqual(['capsule', null, null, null]);
  // Pad 0 confirms again (a start) while pad 1 joins, on one frame.
  await pressBoth(page);
  await expect.poll(async () => (await characterSelect(page))?.devices).toEqual([3, 4, null, null]);
  expect(await screen(page)).toBe('character-select');
});

for (const first of [0, 1]) {
  const other = 1 - first;

  test(`a pick and a start on one frame start the match (pad ${first} picked first)`, async ({
    page,
  }) => {
    await installPads(page, 2);
    await toCharacterSelect(page);
    await press(page, first, PAD.a);
    await press(page, first, PAD.a);
    await press(page, other, PAD.a);
    await expect.poll(async () => (await characterSelect(page))?.picks[1]).toBeNull();
    // The picked pad confirms again (a start) while the other one picks, on one frame.
    await pressBoth(page);
    await expect.poll(() => screen(page)).toBe('stage-select');
  });

  test(`opening the rules on the start frame keeps everyone on character select (pad ${first} starts)`, async ({
    page,
  }) => {
    await installPads(page, 2);
    await toCharacterSelect(page);
    for (const pad of [first, other]) {
      await press(page, pad, PAD.a);
      await press(page, pad, PAD.a);
    }
    await expect.poll(() => picks(page)).toEqual(['capsule', 'capsule', null, null]);
    await flick(page, other, 0, -1);
    // One pad confirms again (a start) while the other confirms the rules banner, on one frame.
    await pressBoth(page);
    await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
    expect(await screen(page)).toBe('character-select');
  });
}

test('Start leaves the title and starts the match once both players picked', async ({ page }) => {
  await installPads(page, 2);
  await page.goto('/');
  await nextFrames(page);
  await press(page, 0, PAD.start);
  await expect.poll(() => screen(page)).toBe('main-menu');
  await press(page, 0, PAD.a);
  await expect.poll(() => screen(page)).toBe('character-select');

  for (const pad of [0, 1]) await press(page, pad, PAD.a);
  await press(page, 0, PAD.a);
  // Start does nothing while a joined player has not picked yet.
  await press(page, 0, PAD.start);
  expect(await screen(page)).toBe('character-select');
  await press(page, 1, PAD.a);
  await expect.poll(() => picks(page)).toEqual(['capsule', 'capsule', null, null]);
  await press(page, 1, PAD.start);
  await expect.poll(() => screen(page)).toBe('stage-select');
});

/** Check foreground controls and titles at both desk and compact viewport sizes. */
const inspectMenu = async (page: Page, name: string, testInfo: TestInfo) => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await nextFrames(page);
    const menus = page.locator('.menu:visible');
    const root = (await menus.count()) ? menus.last() : page.locator('.css:visible');
    await expect(root.locator('.menu-atmosphere')).toBeVisible();
    const boxes = await root.evaluate((element) =>
      Array.from(element.querySelectorAll('h1, button, table, .css-slot, .css-cell'))
        .filter((node) => node.getClientRects().length > 0)
        .map((node) => {
          const box = node.getBoundingClientRect();
          return {
            label: node.textContent,
            x: box.x,
            y: box.y,
            right: box.right,
            bottom: box.bottom,
          };
        }),
    );
    for (const box of boxes) {
      const message = `${name} ${viewport.width}x${viewport.height}: ${box.label}`;
      expect(box.x, message).toBeGreaterThanOrEqual(0);
      expect(box.y, message).toBeGreaterThanOrEqual(0);
      expect(box.right, message).toBeLessThanOrEqual(viewport.width);
      expect(box.bottom, message).toBeLessThanOrEqual(viewport.height);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (const other of boxes.slice(i + 1)) {
        const box = boxes[i];
        if (!box) continue;
        const overlap =
          Math.min(box.right, other.right) - Math.max(box.x, other.x) > 1 &&
          Math.min(box.bottom, other.bottom) - Math.max(box.y, other.y) > 1;
        expect(
          overlap,
          `${name} ${viewport.width}x${viewport.height}: ${box.label} overlaps ${other.label}`,
        ).toBe(false);
      }
    }
    await page.screenshot({ path: testInfo.outputPath(`${name}-${viewport.width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
};

test('the menu family keeps titles and controls visible across desktop, portrait and landscape', async ({
  page,
}, testInfo) => {
  // This traverses a four-player match and captures all eight menus at four sizes.
  test.setTimeout(150_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installPads(page, 2);
  await page.goto('/');
  await page.keyboard.press('Enter');
  await inspectMenu(page, 'main', testInfo);
  const primary = await page.getByRole('button', { name: 'VS. Mode' }).boundingBox();
  const secondary = await page.getByRole('button', { name: 'Options', exact: true }).boundingBox();
  if (!primary || !secondary) throw new Error('Missing main-menu panels');
  expect(primary.width * primary.height).toBeGreaterThan(secondary.width * secondary.height * 2);
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await inspectMenu(page, 'options', testInfo);
  await page.getByRole('button', { name: 'Sound', exact: true }).click();
  await inspectMenu(page, 'sound', testInfo);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await inspectMenu(page, 'controls', testInfo);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'VS. Mode' }).click();
  await page.locator('.css-rules').click();
  await page.getByRole('button', { name: /^Lower Stocks/ }).click();
  await page.getByRole('button', { name: /^Lower Stocks/ }).click();
  await inspectMenu(page, 'rules', testInfo);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await bothPick(page);
  for (const pad of [0, 1]) {
    await press(page, pad, PAD.a);
    await press(page, pad, PAD.a);
  }
  await expect.poll(() => picks(page)).toEqual(['capsule', 'capsule', 'capsule', 'capsule']);
  await inspectMenu(page, 'fighters', testInfo);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('stage-select');
  await inspectMenu(page, 'stages', testInfo);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('match');
  await page.evaluate(() => {
    for (const player of [0, 1, 2]) window.__SSB__?.hold(player, { x: -1 });
  });
  await expect.poll(() => screen(page), FRAMES_TIMEOUT).toBe('results');
  await inspectMenu(page, 'results', testInfo);
  await page.getByRole('button', { name: 'Main menu', exact: true }).click();
  await expect.poll(() => screen(page)).toBe('main-menu');
});

test('hover and focus share outline and lift cues, and confirmation never delays navigation', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  const primary = page.getByRole('button', { name: 'VS. Mode' });
  const option = page.getByRole('button', { name: 'Options', exact: true });
  const appearance = () =>
    option.evaluate((button) => {
      const style = getComputedStyle(button);
      return { outline: style.outlineWidth, shadow: style.boxShadow, translate: style.translate };
    });
  await page.keyboard.press('ArrowDown');
  await expect(option).toBeFocused();
  await expect.poll(async () => (await appearance()).translate).toBe('4px -3px');
  const focused = await appearance();
  expect(focused.outline).toBe('2px');
  expect(focused.shadow).not.toBe('none');
  await primary.focus();
  await option.hover();
  await expect.poll(appearance).toEqual(focused);
  const confirmed = await option.evaluate((button: HTMLButtonElement) => {
    button.click();
    return {
      screen: window.__SSB__?.screen(),
      animating: Array.from(document.querySelectorAll('.menu-confirmation')).some(
        (node) => node.getAnimations().length > 0,
      ),
    };
  });
  expect(confirmed).toEqual({ screen: 'options', animating: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Escape');
  await expect(primary).toBeFocused();
  expect(await primary.evaluate((button) => getComputedStyle(button).transitionDuration)).toBe(
    '0s',
  );
  const reduced = await option.evaluate((button: HTMLButtonElement) => {
    button.click();
    return {
      screen: window.__SSB__?.screen(),
      animations: Array.from(document.querySelectorAll('.menu-confirmation')).flatMap((node) =>
        node.getAnimations(),
      ).length,
    };
  });
  expect(reduced).toEqual({ screen: 'options', animations: 0 });
});

test('Options directions navigate panels and screen mode changes only on confirmation', async ({
  page,
}) => {
  await installPads(page, 1);
  await page.goto('/');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.evaluate(() => {
    let requests = 0;
    document.documentElement.requestFullscreen = async () => {
      requests++;
    };
    Object.defineProperty(window, 'fullscreenRequests', { get: () => requests });
  });
  const requests = () =>
    page.evaluate(() => (window as unknown as { fullscreenRequests: number }).fullscreenRequests);
  const screenMode = page.getByRole('button', { name: /^Screen: Window/ });
  const sound = page.getByRole('button', { name: 'Sound', exact: true });
  const controls = page.getByRole('button', { name: 'Controls', exact: true });
  await expect(screenMode).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(sound).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(controls).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(screenMode).toBeFocused();
  await flick(page, 0, 1, 0);
  await expect(sound).toBeFocused();
  await flick(page, 0, -1, 0);
  await expect(screenMode).toBeFocused();
  expect(await requests()).toBe(0);
  await page.keyboard.press('Enter');
  expect(await requests()).toBe(1);
  await press(page, 0, PAD.a);
  expect(await requests()).toBe(2);
  await screenMode.click();
  expect(await requests()).toBe(3);
  await flick(page, 0, 1, 0);
  await flick(page, 0, 1, 0);
  await press(page, 0, PAD.a);
  await expect.poll(() => screen(page)).toBe('controls');
  await press(page, 0, PAD.b);
  await expect.poll(() => screen(page)).toBe('options');
});

test('Sound settings change the volumes and are remembered after a reload', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByRole('button', { name: 'Sound', exact: true }).click();
  await expect.poll(() => screen(page)).toBe('sound');
  const music = page.getByRole('button', { name: /^Music: / });
  await expect(music).toBeFocused();
  const start = Number((await music.textContent())?.replace('Music: ', ''));
  await page.keyboard.press('ArrowLeft');
  await expect(music).toHaveText(`Music: ${start - 1}`);
  await expect(music).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const effects = page.getByRole('button', { name: /^Effects: / });
  await expect(effects).toBeFocused();
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
  await expect(effects).toHaveText('Effects: 10');
  await page.getByRole('button', { name: 'Lower Effects: 10' }).click();
  await expect(effects).toHaveText('Effects: 9');
  await expect
    .poll(async () => (await page.evaluate(() => window.__SSB__?.sounds()))?.volumes)
    .toEqual({ music: ((start - 1) / 10) ** 2, effects: 0.81 });

  await page.reload();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Options', exact: true }).click();
  await page.getByRole('button', { name: 'Sound', exact: true }).click();
  await expect(music).toHaveText(`Music: ${start - 1}`);
  await expect(effects).toHaveText('Effects: 9');
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('options');
});

test('keyboard navigation reaches character-select rules and Back before joining and after picking', async ({
  page,
}, testInfo) => {
  await toCharacterSelect(page);
  const rules = page.getByRole('button', { name: 'Match rules', exact: true });
  const back = page.getByRole('button', { name: 'Back', exact: true });
  const initialBack = await back.boundingBox();
  const initialRules = await rules.boundingBox();
  await tap(page, 'ArrowRight');
  await expect(rules).toBeFocused();
  await expect(page.locator('.css-grid .css-badge')).toHaveCount(0);
  expect(await rules.boundingBox()).toEqual(initialRules);
  await tap(page, 'ArrowDown');
  await expect(rules).not.toBeFocused();
  await expect(page.locator('.css-grid .css-badge')).toHaveCount(0);
  await tap(page, 'ArrowUp');
  await expect(rules).toBeFocused();
  expect((await characterSelect(page))?.devices).toEqual([null, null, null, null]);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  expect((await characterSelect(page))?.devices).toEqual([null, null, null, null]);
  await page.keyboard.press('Escape');
  await tap(page, 'ArrowLeft');
  await expect(back).toBeFocused();
  expect(await back.boundingBox()).toEqual(initialBack);
  await page.screenshot({ path: testInfo.outputPath('guest-back-focus.png') });
  await page.setViewportSize({ width: 844, height: 390 });
  await nextFrames(page);
  await expect(back).toBeInViewport();
  await expect(page.locator('.css-topbar .css-badge')).toHaveCount(0);
  const button = await back.boundingBox();
  const banner = await rules.boundingBox();
  if (!button || !banner) throw new Error('Missing header navigation');
  expect(Math.abs(button.y + button.height / 2 - banner.y - banner.height / 2)).toBeLessThan(6);
  await page.screenshot({ path: testInfo.outputPath('guest-back-landscape.png') });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('main-menu');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('character-select');
  await bothPick(page);
  await tap(page, 'ArrowUp');
  await expect(rules).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  expect(await screen(page)).toBe('character-select');
  await page.keyboard.press('Escape');
  await tap(page, 'ArrowLeft');
  await expect(back).toBeFocused();
  expect(await picks(page)).toEqual(['capsule', 'capsule', null, null]);
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('main-menu');
});

test('controllers reach character-select header actions before joining, and Back wins over a simultaneous start', async ({
  page,
}) => {
  await installPads(page, 2);
  await toCharacterSelect(page);
  const rules = page.getByRole('button', { name: 'Match rules', exact: true });
  const back = page.getByRole('button', { name: 'Back', exact: true });
  await flick(page, 0, 0, -1);
  await expect(rules).toBeFocused();
  await press(page, 0, PAD.a);
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  expect((await characterSelect(page))?.devices).toEqual([null, null, null, null]);
  await press(page, 0, PAD.b);
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeHidden();
  expect(await screen(page)).toBe('character-select');
  await flick(page, 0, -1, 0);
  await expect(back).toBeFocused();
  await press(page, 0, PAD.a);
  await expect.poll(() => screen(page)).toBe('main-menu');
  await press(page, 0, PAD.a);
  await expect.poll(() => screen(page)).toBe('character-select');
  for (const pad of [0, 1]) {
    await press(page, pad, PAD.a);
    await press(page, pad, PAD.a);
  }
  await expect.poll(() => picks(page)).toEqual(['capsule', 'capsule', null, null]);
  await flick(page, 0, 0, -1);
  await expect(rules).toBeFocused();
  await press(page, 0, PAD.a);
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  await press(page, 0, PAD.b);
  await flick(page, 0, -1, 0);
  await expect(back).toBeFocused();
  await setPads(page, [
    [0, { button: PAD.a, on: true }],
    [1, { button: PAD.start, on: true }],
  ]);
  await nextFrames(page);
  await setPads(page, [
    [0, { button: PAD.a, on: false }],
    [1, { button: PAD.start, on: false }],
  ]);
  await expect.poll(() => screen(page)).toBe('main-menu');
});

test('matches omit the control instructions overlay', async ({ page }) => {
  await startMatch(page);
  await expect(page.locator('#app > .controls')).toHaveCount(0);
  await expect(page.getByText('Left keys:', { exact: false })).toHaveCount(0);
});

for (const count of [2, 3, 4]) {
  test(`results podium renders ${count} participants and releases the scene on Back`, async ({
    page,
  }, testInfo) => {
    // Up to three falls in a row, each with its own frame-bound wait, plus the menus around them.
    test.setTimeout(30_000 + (count - 1) * FRAMES_TIMEOUT.timeout);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await installPads(page, 2);
    await toCharacterSelect(page);
    await page.locator('.css-rules').click();
    await page.getByRole('button', { name: /^Lower Stocks/ }).click();
    await page.getByRole('button', { name: /^Lower Stocks/ }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await bothPick(page);
    for (let pad = 0; pad < count - 2; pad++) {
      await press(page, pad, PAD.a);
      await press(page, pad, PAD.a);
    }
    await page.keyboard.press('Enter');
    await expect.poll(() => screen(page)).toBe('stage-select');
    await page.keyboard.press('Enter');
    await expect.poll(() => screen(page)).toBe('match');
    // Eliminate one participant at a time to verify real stock placement, not slot order.
    for (let player = 0; player < count - 1; player++) {
      await page.evaluate((slot) => window.__SSB__?.hold(slot, { x: -1 }), player);
      if (player < count - 2) {
        await expect
          .poll(async () => (await gameState(page)).fighters[player]?.stocks, FRAMES_TIMEOUT)
          .toBe(0);
      }
    }
    await expect.poll(() => screen(page), FRAMES_TIMEOUT).toBe('results');
    const entries = page.locator('.results-placements li');
    await expect(entries).toHaveCount(count);
    for (let index = 0; index < count; index++) {
      await expect(entries.nth(index)).toHaveAttribute('data-place', String(index + 1));
      await expect(entries.nth(index)).toHaveAttribute('data-player', String(count - index));
      await expect(entries.nth(index)).toHaveAttribute('data-character', 'capsule');
    }
    await expect(page.locator('.results-scene canvas')).toBeVisible();
    await expect(page.getByText('Damage dealt', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`podium-${count}.png`) });
    await page.keyboard.press('Escape');
    await expect.poll(() => screen(page)).toBe('main-menu');
    await expect(page.locator('.results-scene canvas')).toHaveCount(0);
  });
}

test('fighter lobby shows neutral portraits, live colored previews, ownership and readiness', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installPads(page, 2);
  await toCharacterSelect(page);
  const portrait = page.locator('.css-cell .css-portrait');
  await expect(portrait).toHaveCount(1);
  await expect
    .poll(() => portrait.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  const root = page.locator('.css');
  const viewport = page.viewportSize();
  const roster = await page.locator('.css-roster').boundingBox();
  if (!viewport || !roster) throw new Error('Missing lobby layout');
  expect(roster.width / viewport.width).toBeGreaterThanOrEqual(0.9);
  expect(roster.width / viewport.width).toBeLessThanOrEqual(0.95);
  await expect(page.locator('.css-slot.empty')).toHaveCount(4);
  await inspectMenu(page, 'lobby-empty', testInfo);

  await tap(page, 'KeyF');
  await tap(page, 'Period');
  await expect(page.locator('.css-slot:not(.empty) img')).toHaveCount(2);
  await expect(page.locator('.css-slot.picked')).toHaveCount(0);
  await expect(page.locator('.css-slot').nth(0)).toContainText('Choosing');
  await expect(page.locator('.css-slot').nth(0)).toContainText('Left keys');
  await expect(page.locator('.css-slot').nth(1)).toContainText('Right keys');
  await expect(page.locator('.css-badge')).toHaveText(['P1', 'P2']);
  await inspectMenu(page, 'lobby-browsing', testInfo);

  await tap(page, 'KeyF');
  await tap(page, 'Period');
  await expect(page.locator('.css-slot.picked')).toHaveCount(2);
  await expect(page.getByText('Ready to Fight', { exact: true })).toBeVisible();
  await inspectMenu(page, 'lobby-ready', testInfo);
  await tap(page, 'KeyG');
  await expect(page.locator('.css-slot.picked')).toHaveCount(1);
  await expect(page.getByText('Ready to Fight', { exact: true })).toBeHidden();
  await expect(page.locator('.css-slot').nth(0)).toContainText('Choosing');
  await expect(page.locator('.css-slot').nth(0).locator('img')).toBeVisible();

  for (const pad of [0, 1]) await press(page, pad, PAD.a);
  await expect(page.locator('.css-slot:not(.empty) img')).toHaveCount(4);
  await expect(page.locator('.css-badge')).toHaveText(['P1', 'P2', 'P3', 'P4']);
  const pixels = await page.locator('.css-slot img').evaluateAll(async (images) => {
    return Promise.all(
      images.map(async (node) => {
        const image = node as HTMLImageElement;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 480;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Missing image context');
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, 480, 480).data;
        const rgb = [0, 0, 0];
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if ((data[i + 3] ?? 0) < 200) continue;
          rgb[0] = (rgb[0] ?? 0) + (data[i] ?? 0);
          rgb[1] = (rgb[1] ?? 0) + (data[i + 1] ?? 0);
          rgb[2] = (rgb[2] ?? 0) + (data[i + 2] ?? 0);
          count++;
        }
        return rgb.map((value) => value / count);
      }),
    );
  });
  const [red, blue, green, yellow] = pixels;
  if (!red || !blue || !green || !yellow) throw new Error('Missing player portraits');
  expect(red[0]).toBeGreaterThan((red[2] ?? 0) * 1.25);
  expect(blue[2]).toBeGreaterThan((blue[0] ?? 0) * 1.25);
  expect(green[1]).toBeGreaterThan((green[0] ?? 0) * 1.25);
  expect(yellow[0]).toBeGreaterThan((yellow[2] ?? 0) * 1.25);
  expect(yellow[1]).toBeGreaterThan((yellow[2] ?? 0) * 1.25);
  await inspectMenu(page, 'lobby-four', testInfo);
  await expect.poll(() => root.evaluate((node) => node.scrollHeight - node.clientHeight)).toBe(0);
});

/** What the game played so far, from the debug handle. */
const sounds = (page: Page) =>
  page.evaluate(() => {
    const log = window.__SSB__?.sounds();
    if (!log) throw new Error('No debug handle');
    return log;
  });
const cues = async (page: Page) => (await sounds(page)).cues;
const lastTrack = async (page: Page) => (await sounds(page)).tracks.at(-1);

test('menus, a hit, a KO and the music change are heard', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await expect.poll(() => lastTrack(page)).toBe('menu');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('main-menu');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect.poll(() => screen(page)).toBe('title');
  expect(await cues(page)).toEqual(['menu-confirm', 'menu-move', 'menu-back']);

  // One stock, so a single fall ends the match.
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('character-select');
  await openRules(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: 'Stocks: 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await tap(page, 'KeyS');
  await bothPick(page);
  expect(await cues(page)).toEqual(expect.arrayContaining(['join', 'pick']));
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('stage-select');
  expect(await lastTrack(page)).toBe('menu');
  // Final Destination: flat, so the fighters meet on the ground.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => screen(page)).toBe('match');
  await expect.poll(() => lastTrack(page)).toBe('final-destination');
  // Fighters drop in at the start, so a landing may already follow the match-start cue.
  expect(await cues(page)).toContain('match-start');

  // A hit: player one runs up to player two, walks the last bit into reach and jabs. They turn
  // back if a slow machine lets them pass player two, so they end up close and facing them.
  const gap = async () => {
    const [one, two] = (await gameState(page)).fighters;
    return (two?.position.x ?? 0) - (one?.position.x ?? 0);
  };
  await expect
    .poll(
      async () => {
        const distance = await gap();
        const close = Math.abs(distance) > 0.3 && Math.abs(distance) < 1.2;
        const speed = Math.abs(distance) > 3 ? 1 : 0.3;
        const x = close ? 0 : Math.sign(distance) * speed;
        await page.evaluate((x) => window.__SSB__?.hold(0, { x }), x);
        return close;
      },
      // Check often: the window where player one is in reach lasts a fraction of a second.
      { timeout: 30_000, intervals: [50] },
    )
    .toBe(true);
  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.__SSB__?.hold(0, { attack: true }));
        await nextFrames(page);
        await page.evaluate(() => window.__SSB__?.hold(0, {}));
        await nextFrames(page);
        return cues(page);
      },
      { timeout: 10_000 },
    )
    .toContain('hit');
  expect(await cues(page)).toContain('attack');

  // A KO: player one walks off the stage, which ends the one-stock match.
  await page.evaluate(() => window.__SSB__?.hold(0, { x: -1 }));
  await expect.poll(() => screen(page), { timeout: 20_000 }).toBe('results');
  await page.evaluate(() => window.__SSB__?.release(0));
  expect(await cues(page)).toEqual(expect.arrayContaining(['ko', 'match-end']));
  await expect.poll(() => lastTrack(page)).toBe('results');
});
