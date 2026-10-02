import { defineConfig, devices } from '@playwright/test';

/** Fixed port so the Vite dev server used by the tests never collides with `pnpm dev` (5173). */
export const E2E_PORT = 4174;
const baseURL = `http://127.0.0.1:${E2E_PORT}`;
const isCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
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
    command: `pnpm exec vite --port ${E2E_PORT} --strictPort --host 127.0.0.1`,
    url: `${baseURL}/`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
