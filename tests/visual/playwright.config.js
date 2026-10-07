import { defineConfig, devices } from '@playwright/test';

const port = process.env.DELVE_QA_PORT ?? '4173';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 90000,
  workers: 2,
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1920, height: 1080 },
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
  outputDir: './test-results'
});
