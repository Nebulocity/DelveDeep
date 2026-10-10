// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

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

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined. some stops with true as soon as one entry passes the check; an empty
      // list gives false.
      return s.sys.isActive() && s.enemies?.some(e => e.alive && !e.landing);
    });

    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    for (const count of [0, 1, 3, 5]) {
      await page.evaluate(count => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        qa.state.leader.battleLoadout = ['focusFire', 'coordinatedAttack', 'lunarAssault', 'brace', 'encouragement'].slice(0, count);
        const scene = qa.game.scene.getScene('BattleScene');

        // filter keeps entries whose callback returns true. It builds a new list and
        // leaves the original list in place.
        scene.children.list.filter(object => object.depth === 4700 || object.depth === 4701).forEach(object => object.destroy());
        scene.createLeaderLoadoutBar(scene.scale.width);
      }, count);

      const state = await page.evaluate(() => {
        const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        if (!s.combatPaused) s.togglePause();

        // map builds one output entry for each input entry, in the same order. The
        // callback's return value becomes that output entry.
        const boxes = s.leaderButtons.map(b => b.box);
        const first = boxes[0], last = boxes.at(-1);

        // sort rearranges this array in place. A negative comparator result puts a before
        // b; positive puts it after; zero keeps them tied. ... expands these entries into
        // the new list or call. It does not deep-copy the objects inside.
        const formation = [...s.partyUnits].sort((a, b) => {
          const pa = s.waveReturnPositions.get(a.id), pb = s.waveReturnPositions.get(b.id);
          return s.battlefield.arenaToScreen(pa.x, pa.y).x - s.battlefield.arenaToScreen(pb.x, pb.y).x;
        });

        // The condition before ? chooses the first value when true and the value after :
        // when false. ?? uses the fallback only for null or undefined. A real zero or
        // false stays intact. ?. only follows this link when the value exists; a missing
        // optional value gives undefined.
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

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
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

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
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
