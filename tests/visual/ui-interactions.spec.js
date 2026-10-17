// Read-only interactive-object inventory for the existing Delve Deep visual QA bridge.
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const requestedScene = process.env.UI_DISCOVERY_SCENE || 'RosterScene';
const activeScene = requestedScene === 'AdventurersHallScene' ? 'RosterScene' : requestedScene;

test(`discover controls in ${requestedScene}`, async ({ page }) => {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    return qa && qa.game.scene.getScene('TitleScene').sys.isActive();
  });

  await page.evaluate(name => window.__DELVE_DEEP_VISUAL_QA__.activate(name), requestedScene);
  await page.waitForFunction(name => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene(name);
    return scene.sys.isActive() && scene.sys.settings.status === 5;
  }, activeScene);
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const result = await page.evaluate(name => window.__DELVE_DEEP_VISUAL_QA__.discover(name), activeScene);
  expect(result.active).toBe(true);

  const folder = path.resolve('output/qa/discovery');
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, `${requestedScene}.json`), JSON.stringify(result, null, 2));
  console.log(`${requestedScene}: ${result.count} enabled interactive objects found`);
  for (const object of result.objects.slice(0, 25)) {
    console.log(`  ${object.label} [${object.type}] at ${JSON.stringify(object.browserCenter)}`);
  }
});
