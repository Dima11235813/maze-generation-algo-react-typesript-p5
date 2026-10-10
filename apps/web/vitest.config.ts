import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Route journeys take 1.5-2 s alone but take 5-20 s when the whole suite runs in parallel on a
    // busy machine (they all timed out on an unchanged develop, L-32). 30 s still catches hangs.
    testTimeout: 30_000,
  },
});
