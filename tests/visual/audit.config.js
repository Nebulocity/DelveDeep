import { defineConfig } from '@playwright/test';
import path from 'node:path';

const port = process.env.DELVE_QA_PORT ?? '4173';
export default defineConfig({
  testDir: './audit', testMatch: '*.spec.js', timeout: 120000,
  globalTimeout: 7200000, workers: 1, retries: 0,
  updateSnapshots: 'none',
  snapshotPathTemplate: path.resolve(process.env.DELVE_QA_APPROVED_BASELINES ?? 'tests/visual/audit/approved-baselines', '{projectName}/{arg}{ext}'),
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true,
    viewport: { width: 976, height: 440 }, actionTimeout: 15000,
    navigationTimeout: 30000, screenshot: { mode: 'only-on-failure', scale: 'css' }, trace: 'off', video: 'off' },
  projects: [
    { name: 'pixel9', use: { viewport: { width: 976, height: 440 }, deviceScaleFactor: 2.625, hasTouch: true } },
    { name: 'small-phone', use: { viewport: { width: 740, height: 360 }, deviceScaleFactor: 2, hasTouch: true } },
    { name: 'tablet', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, hasTouch: true } }
  ],
  webServer: { command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 120000 },
  reporter: [['list'], ['./audit/reporter.js']],
  outputDir: path.resolve(process.env.DELVE_QA_REPORT_ROOT ?? 'output/qa/overnight-ui-audit', 'test-results')
});
