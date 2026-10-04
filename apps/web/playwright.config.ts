import { defineConfig, devices } from '@playwright/test';

/**
 * Fixed port from the Maze Lab block (41920-41939, D:\GDrive\proj-mgmt\inventory\local-ports.md) so
 * the tests never collide with the long-running dev server on 41920.
 */
export const E2E_PORT = 41922;
const baseURL = `http://127.0.0.1:${E2E_PORT}`;
const isCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Software-rendered WebGL is CPU heavy: four parallel pages starve each other into
  // navigation timeouts on a busy machine, two are reliable. Override with --workers.
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Animations are driven by prefers-reduced-motion in the app (see fixtures.ts).
    reducedMotion: 'reduce',
    launchOptions: {
      // Software WebGL so the three.js renderer works in headless Chromium (CI has no GPU).
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    // A production build served by `vite preview`: the dev server's dependency optimiser
    // reloads pages mid-navigation on a cold cache, which aborts `page.goto`.
    command: `pnpm exec vite build --logLevel warn && pnpm exec vite preview --port ${E2E_PORT} --strictPort --host 127.0.0.1`,
    url: `${baseURL}/`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
