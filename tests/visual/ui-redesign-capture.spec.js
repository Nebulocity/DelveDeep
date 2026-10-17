// Delve Deep UI redesign capture pack. No game changes and no Codex required.
// Captures distinct screens and safe UI states for a human-led redesign review.
import { test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('output/qa/redesign-captures');
const alias = { AdventurersHallScene: 'RosterScene' };
const allScenes = [
  'TitleScene', 'TownScene', 'AdventurersHallScene', 'BlacksmithScene',
  'FacilityScene', 'ItemsScene', 'RosterScene', 'PartyLeaderScene',
  'DelveSelectScene', 'PartySelectScene', 'DungeonScene', 'BattleScene',
  'RewardScene', 'EncounterSummaryScene'
];
const selected = (process.env.UI_CAPTURE_SCENES || allScenes.join(','))
  .split(',').map(x => x.trim()).filter(Boolean);
const settle = Math.max(350, Number(process.env.UI_CAPTURE_SETTLE_MS || 900));
const maxPerBranch = Math.max(0, Math.min(12, Number(process.env.UI_CAPTURE_BRANCH_LIMIT || 5)));
const records = [];
const safeName = s => String(s).replace(/[^\w-]/g, '-').slice(0, 100);

test('Delve Deep redesign screenshot inventory', async ({ page }) => {
  test.setTimeout(Math.max(180000, selected.length * 35000 + 180000));
  await mkdir(output, { recursive: true });
  const flush = () => writeFile(path.join(output, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2));

  async function capture(scene, state, extra = {}) {
    const name = `${safeName(scene)}--${safeName(state)}.png`;
    await page.screenshot({ path: path.join(output, name), timeout: 20000 });
    records.push({ scene, state, image: name, ...extra });
    await flush();
  }
  async function reset(scene) {
    await page.goto('/?visualQa=1', { timeout: 30000 });
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game?.scene?.getScene('TitleScene')?.sys?.isActive(), null, { timeout: 30000 });
    await page.evaluate(s => window.__DELVE_DEEP_VISUAL_QA__.activate(s), scene);
    const expected = alias[scene] || scene;
    await page.waitForFunction(s => window.__DELVE_DEEP_VISUAL_QA__?.game?.scene?.getScene(s)?.sys?.isActive(), expected, { timeout: 25000 });
    await page.locator('#loading-screen').waitFor({ state: 'hidden', timeout: 25000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(settle);
  }
  async function info() {
    return page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const scenes = qa.game.scene.getScenes(true).map(s => s.sys.settings.key);
      const scene = scenes.at(-1);
      return { scene, scenes, objects: scene ? qa.discover(scene).objects : [], canvas: qa.game.canvas.getBoundingClientRect().toJSON() };
    });
  }
  async function click(label, kind = 'click') {
    const state = await info();
    const hit = state.objects.find(o => o.label === label && o.inViewport);
    const p = hit?.browserCenter;
    const box = state.canvas;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < box.x || p.x > box.right || p.y < box.y || p.y > box.bottom || p.x < 0 || p.y < 0 || p.x >= page.viewportSize().width || p.y >= page.viewportSize().height) {
      throw new Error(`Control not reachable: ${label}`);
    }
    await page.mouse.move(p.x, p.y);
    if (kind === 'hold') {
      await page.mouse.down();
      await page.waitForTimeout(950);
      // Capture before release, so a touch/press tooltip remains visible.
    } else {
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(settle);
    }
  }
  async function branch(root, children = []) {
    try {
      await reset('AdventurersHallScene');
      await click(root);
      const first = await info();
      await capture('AdventurersHallScene', root, { activeScene: first.scene, controlCount: first.objects.length });
      for (const child of children.slice(0, maxPerBranch)) {
        try {
          await reset('AdventurersHallScene');
          await click(root);
          await click(child);
          const after = await info();
          await capture('AdventurersHallScene', `${root}--${child}`, { activeScene: after.scene, controlCount: after.objects.length });
        } catch (error) {
          records.push({ scene: 'AdventurersHallScene', state: `${root}--${child}`, error: String(error.message || error) });
          await flush();
        }
      }
    } catch (error) {
      records.push({ scene: 'AdventurersHallScene', state: root, error: String(error.message || error) });
      await flush();
    }
  }

  for (const scene of selected) {
    try {
      await reset(scene);
      const current = await info();
      await capture(scene, 'overview', { activeScene: current.scene, controlCount: current.objects.length });
    } catch (error) {
      records.push({ scene, state: 'overview', error: String(error.message || error) });
      await flush();
    }
  }

  if (selected.includes('AdventurersHallScene')) {
    await branch('hall-tab-skills', []);
    await branch('hall-nav-items', [
      'hall-category-equipment', 'hall-category-items', 'hall-category-potions',
      'hall-category-materials', 'hall-category-recipes'
    ]);
    await branch('hall-nav-tactics');
    for (const label of ['hall-class-info', 'hall-summary-stat-Health', 'hall-summary-stat-Attack', 'hall-summary-stat-Armor']) {
      try {
        await reset('AdventurersHallScene');
        await click(label, 'hold');
        await capture('AdventurersHallScene', `${label}--hold`);
      } catch (error) {
        records.push({ scene: 'AdventurersHallScene', state: `${label}--hold`, error: String(error.message || error) });
        await flush();
      } finally {
        await page.mouse.up().catch(() => {});
      }
    }
  }
  await flush();
  console.log(`Redesign capture completed: ${records.filter(r => r.image).length} screenshots, ${records.filter(r => r.error).length} skipped/failed states`);
});
