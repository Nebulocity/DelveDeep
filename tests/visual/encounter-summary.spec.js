// Verify defeat and retreat retry and browser-only log export in the live Phaser summary.
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Translate logical game positions into browser pixels so clicks exercise actual input.
async function clickSummaryLabel(page, label) {
  const point = await page.evaluate(text => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('EncounterSummaryScene');
    const object = scene.children.list.find(child => child.text === text);
    const rect = qa.game.canvas.getBoundingClientRect();
    return { x: rect.x + object.x * rect.width / qa.game.scale.width,
      y: rect.y + object.y * rect.height / qa.game.scale.height };
  }, label);
  await page.mouse.click(point.x, point.y);
}

for (const result of ['fled', 'defeat']) {
  for (const native of [false, true]) {
    for (const camp of [false, true]) {
      test(`${result === 'defeat' ? 'Defeat' : 'Party Fled'} ${native ? 'Android host' : 'browser'} ${camp ? 'camp' : 'wave'} retry`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setViewportSize(native ? { width: 915, height: 412 } : { width: 1920, height: 1080 });
        if (native) {

          // Capacitor reads this host signal when its module initializes. This simulates
          // native platform detection without requiring a device or native plugin calls.
          await page.addInitScript(() => { window.androidBridge = {}; });
        }
        await page.goto('/?visualQa=1');
        await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
        await page.locator('#loading-screen').waitFor({ state: 'hidden' });
        const before = await page.evaluate(({ unlocked, result }) => {
          const qa = window.__DELVE_DEEP_VISUAL_QA__;

          // Use a legal lineup: the roster's first five can include multiple tanks.
          const roles = ['Tank', 'Healer', 'Melee DPS', 'Melee DPS', 'Ranged DPS'];
          const selected = [];
          for (const role of roles) {
            selected.push(qa.state.roster.find(hero => hero.role === role && !selected.includes(hero)));
          }
          qa.state.activeParty = selected.map(hero => ({ ...hero }));
          qa.state.delveCheckpoints['slime-cave'] = { nextWave: unlocked ? 5 : 2, campUnlocked: unlocked };
          localStorage.setItem('delveDeep.lastCombatLog.v1', JSON.stringify({
            result, entries: [{ type: 'retreat', time: 65 }],
            summary: { partyDamageTaken: 100, partyHealing: 50, partyDeaths: 1 }
          }));
          qa.activate('EncounterSummaryScene', { result });
          return { gold: qa.state.gold, points: qa.state.leader.tacticsPoints,
            checkpoint: qa.state.delveCheckpoints['slime-cave'], party: qa.state.activeParty.map(hero => hero.id) };
        }, { unlocked: camp, result });
        await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('EncounterSummaryScene').sys.isActive());
        await page.evaluate(() => document.fonts.ready);
        const screen = await page.evaluate(() => {
          const qa = window.__DELVE_DEEP_VISUAL_QA__;
          const scene = qa.game.scene.getScene('EncounterSummaryScene');
          return { labels: scene.children.list.filter(child => child.type === 'Text').map(child => child.text),
            bounds: qa.inspect('EncounterSummaryScene') };
        });
        expect(screen.labels.includes('DOWNLOAD COMBAT LOG')).toBe(!native);
        expect(screen.labels).toContain('Try again!');
        expect(screen.bounds.warnings).toEqual([]);
        await mkdir('output/qa/encounter-summary', { recursive: true });
        await page.screenshot({ path: `output/qa/encounter-summary/${result}-${native ? 'android' : 'web'}-${camp ? 'camp' : 'wave'}.png` });
        if (!native) {
          const downloading = page.waitForEvent('download');
          await clickSummaryLabel(page, 'DOWNLOAD COMBAT LOG');
          const download = await downloading;
          expect(download.suggestedFilename()).toMatch(/^delve-combat-\d+\.json$/);
          expect(await download.failure()).toBeNull();
        }

        // Even an old farm/boss entry must reenter normal preparation at the saved checkpoint.
        await page.evaluate(() => { window.__DELVE_DEEP_VISUAL_QA__.state.run.entry = 'farm'; });
        await clickSummaryLabel(page, 'Try again!');
        await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').sys.isActive());
        const after = await page.evaluate(() => {
          const qa = window.__DELVE_DEEP_VISUAL_QA__;
          return { gold: qa.state.gold, points: qa.state.leader.tacticsPoints,
            checkpoint: qa.state.delveCheckpoints['slime-cave'], party: [...qa.game.scene.getScene('PartySelectScene').selectedIds],
            delve: qa.state.currentDelve.id, entry: qa.state.run.entry };
        });
        expect(after).toEqual({ ...before, delve: 'slime-cave', entry: camp ? 'camp' : 'progress' });
        expect(errors).toEqual([]);
      });
    }
  }
}
