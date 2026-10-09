// These settings launch the development server and run the maintained browser checks. The
// test viewport is measured in browser pixels; Phaser scales its logical canvas inside it.
// A retained trace helps inspect a failed interaction after the run.

import { defineConfig, devices } from '@playwright/test';

// ?? uses the fallback only for null or undefined. A real zero or false stays intact.
const port = process.env.DELVE_QA_PORT ?? '4173';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 90000,
  workers: 2,
  use: {
    ...devices['Desktop Chrome'],

    // Override these browser-pixel dimensions for phone landscape checks. Phaser still
    // draws on its unchanged 2400 by 1080 logical canvas.
    viewport: { width: Number(process.env.DELVE_QA_WIDTH ?? 1920), height: Number(process.env.DELVE_QA_HEIGHT ?? 1080) },
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure'
  },

  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  reporter: [['list']],
  outputDir: '../../output/qa/test-results'
});
