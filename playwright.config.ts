import { defineConfig, devices } from '@playwright/test';

// Some environments ship their own Chromium; point PLAYWRIGHT_CHROMIUM_PATH at it if needed.
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'];

export default defineConfig({
  testDir: 'e2e',
  // The game renders with software WebGL here and on CI, so it runs well below 60 frames per
  // second and anything that waits for frames (a fall, a match end) takes seconds of wall time.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          ...(executablePath ? { executablePath } : {}),
          // Software WebGL so the game renders on CI machines without a GPU.
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env['CI'],
  },
});
