import { test, expect } from '@playwright/test';

test.use({ trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false } });

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`Delve tactics, formation portraits and settled rewards at ${viewport.width}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize(viewport);
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'thornbriar-hollow' }));
    await page.waitForFunction(() => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      return s.sys.isActive() && s.enemies?.some(e => e.alive && !e.landing);
    });
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    for (const count of [0, 1, 3, 5]) {
      await page.evaluate(count => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        qa.state.leader.battleLoadout = ['focusFire', 'coordinatedAttack', 'lunarAssault', 'brace', 'encouragement'].slice(0, count);
        const scene = qa.game.scene.getScene('BattleScene');
        scene.children.list.filter(object => object.depth === 4700 || object.depth === 4701).forEach(object => object.destroy());
        scene.createLeaderLoadoutBar(scene.scale.width);
      }, count);
      const state = await page.evaluate(() => {
        const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        if (!s.combatPaused) s.togglePause();
        const boxes = s.leaderButtons.map(b => b.box);
        const first = boxes[0], last = boxes.at(-1);
        const formation = [...s.partyUnits].sort((a, b) => {
          const pa = s.waveReturnPositions.get(a.id), pb = s.waveReturnPositions.get(b.id);
          return s.battlefield.arenaToScreen(pa.x, pa.y).x - s.battlefield.arenaToScreen(pb.x, pb.y).x;
        });
        return { center: first ? (first.x + last.x) / 2 : s.scale.width / 2, width: s.scale.width,
          tacticsBottom: first?.getBounds().bottom ?? 0, portraitIds: s.partyHud.map(c => c.unit.id),
          formationIds: formation.map(u => u.id) };
      });
      expect(state.center).toBeCloseTo(state.width / 2);
      expect(state.tacticsBottom).toBeLessThan(240);
      expect(state.portraitIds).toEqual(state.formationIds);
      await page.screenshot({ path: `output/qa/delve-lineup/tactics-${count}-${viewport.width}.png` });
    }
    const before = await page.evaluate(() => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      s.completeWave();
      const returning = s.partyUnits.find(unit => unit.alive);
      const home = s.waveReturnTargets.get(returning.id);
      returning.setArenaPosition(home.x + 80, home.y + 80);
      s.waveRewardText.setText(s.formatWaveReward({ gold: 30, xp: 17, materials: { cloth: 2, iron: 1 }, items: [{ name: 'Health Potion', count: 1 }] }));
      const time = s.time.now;
      s.updateWaveRetreat(time + 1000, 0, 0);
      return { text: s.waveRewardText.text, active: s.waveRewardText.active, plaque: s.battleMessagePlaque.visible,
        ready: s.waveReturnReadyAt };
    });
    expect(before.text).toContain('+1 Health Potion');
    expect(before.text).toContain('+2 Linen Cloth');
    expect(before.active).toBe(true);
    expect(before.plaque).toBe(false);
    expect(before.ready).toBeNull();
    const delay = await page.evaluate(() => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      for (const unit of s.partyUnits.filter(u => u.alive)) {
        const home = s.waveReturnTargets.get(unit.id);
        unit.setArenaPosition(home.x, home.y);
      }
      const time = s.time.now + 2000;
      s.updateWaveRetreat(time, 0, 0);
      return s.waveReturnReadyAt - time;
    });
    expect(delay).toBeCloseTo(3000, 6);
    expect(await page.evaluate(() => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      s.updateWaveRetreat(s.waveReturnReadyAt - 1, 0, 0);
      return s.waveRewardText.active;
    })).toBe(true);
    await page.screenshot({ path: `output/qa/delve-lineup/rewards-${viewport.width}.png` });
    expect(await page.evaluate(() => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      s.updateWaveRetreat(s.waveReturnReadyAt, 0, 0);
      return s.waveRewardText === null;
    })).toBe(true);
  });
}
