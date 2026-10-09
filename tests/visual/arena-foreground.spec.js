// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`Foreground scenery permits lower-floor movement and returns at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await mkdir('output/qa/foreground', { recursive: true });

    for (const delve of ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'murmuring-abyss', 'verdant-tear']) {
      await page.evaluate(id => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        window.__previousArenaParty = qa.game.scene.getScene('BattleScene').partyUnits;
        qa.activate('BattleScene', { delve: id });
      }, delve);
      await page.waitForFunction(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');

        // ?. only follows this link when the value exists; a missing optional value gives
        // undefined.
        return scene.sys.isActive() && scene.partyHud?.length === 5 && scene.partyUnits !== window.__previousArenaParty;
      });

      await page.locator('#loading-screen').waitFor({ state: 'hidden' });
      const result = await page.evaluate(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        if (!scene.combatPaused) scene.togglePause();
        const geometry = scene.battlefield;

        // find returns the first matching entry, or undefined when none matches. Check for
        // that missing result before using its fields.
        const frame = scene.children.list.find(child => child.name === 'carved-stone-panel' && child.depth === 4500 && child.y > scene.scale.height / 2);
        const foreground = scene.children.list.find(child => child.depth === 4300 && child.mask);

        // map builds one output entry for each input entry, in the same order. The
        // callback's return value becomes that output entry.
        const units = scene.partyUnits.map((unit, index) => {

          // ... copies the source's own fields into this object; fields listed later
          // replace earlier ones. This is a shallow copy, so nested objects are still
          // shared.
          const home = { ...scene.waveReturnPositions.get(unit.id) };
          unit.status.stunnedUntil = 0;
          unit.status.rootedUntil = 0;

          // The condition before ? chooses the first value when true and the value after :
          // when false. % gives the remainder. With a nonnegative index and positive list
          // length, it wraps the index back to the start of the list.
          const target = scene.movement.getSafeArenaPoint(geometry.logicalWidth * (index % 2 ? 0.1 : 0.9), scene.movement.config.edgePadding + 12, unit);
          unit.setArenaPosition(geometry.logicalWidth - target.x, target.y);
          let safe = true;

          // Math.ceil rounds upward to the next integer, including when the value has a
          // fractional part.
          for (let step = 0; step < Math.ceil(geometry.logicalWidth / unit.moveSpeed * 60) + 60; step += 1) {
            unit.moveToward(target.x, target.y, 1 / 60, 0, false);

            // &&= assigns only when the current value is truthy.
            safe &&= !scene.terrain.isUnitBlocked(unit, unit.arenaX, unit.arenaY, 12);
          }

          // Math.hypot calculates straight-line length from the x/y differences: square
          // each, add them, then take the square root.
          const crossed = Math.hypot(unit.arenaX - target.x, unit.arenaY - target.y) < 1;
          for (let step = 0; step < Math.ceil(geometry.logicalWidth / unit.moveSpeed * 60) + 60; step += 1) {
            unit.moveToward(home.x, home.y, 1 / 60, 0, false);
            safe &&= !scene.terrain.isUnitBlocked(unit, unit.arenaX, unit.arenaY, 12);
          }
          const returned = Math.hypot(unit.arenaX - home.x, unit.arenaY - home.y) < 1;
          unit.setArenaPosition(home.x, target.y);

          return { safe, crossed, returned, occluded: !foreground || foreground.depth > unit.container.depth };
        });

        return { bottom: geometry.bottomY, frameTop: frame.y - frame.displayHeight / 2, units };
      });

      expect(result.bottom).toBeCloseTo(result.frameTop, 6);
      expect(result.units).toEqual(Array(5).fill({ safe: true, crossed: true, returned: true, occluded: true }));
      await page.screenshot({ path: `output/qa/foreground/${delve}-${viewport.width}.png` });
    }

    expect(errors).toEqual([]);
  });

  // Sample the rendered cave, because checking depth alone cannot catch a mask that
  // accidentally draws open floor over a character's boots.
  test(`Cave foreground hides rocks while leaving floor gaps visible at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;

      // The QA bridge uses the first five roster members. Put the reported lineup first
      // in this isolated browser session so the screenshot includes Flint's actual art.
      const ids = ['flint', 'fistandantilus', 'caramon-gladiator', 'tika', 'tasslehoff'];
      qa.state.roster = [...ids.map(id => qa.state.roster.find(unit => unit.id === id)),
        ...qa.state.roster.filter(unit => !ids.includes(unit.id))];
      qa.activate('BattleScene', { delve: 'slime-cave' });
    });
    await page.waitForFunction(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      return scene.sys.isActive() && scene.partyHud?.length === 5;
    });
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await mkdir('output/qa/cave-clipping', { recursive: true });

    const samples = await page.evaluate(async () => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      if (!scene.combatPaused) scene.togglePause();
      const t = scene.battlefieldVisualLayers.transform;

      // Coordinates are measured in the original 1672 by 941 cave artwork. A bright
      // rectangle stands in for a sprite behind the rocks and should show through gaps.
      const marker = scene.add.rectangle(t.x + 835 * t.scale, t.y + 800 * t.scale,
        1050 * t.scale, 140 * t.scale, 0xff00ff).setDepth(4200);
      const floor = [[390, 780], [450, 805], [470, 805], [500, 785], [540, 760],
        [790, 820], [870, 780], [940, 760], [950, 785], [1200, 810], [1310, 780]];
      const rocks = [[340, 790], [420, 805], [565, 775], [610, 790],
        [895, 780], [920, 780], [1240, 815]];
      const result = { floor: [], rocks: [] };

      // Phaser reads one canvas pixel after the next frame renders. Await each read so
      // another sample cannot replace the pending snapshot in that same frame.
      for (const [kind, points] of Object.entries({ floor, rocks })) {
        for (const [x, y] of points) {
          const color = await new Promise(resolve => scene.game.renderer.snapshotPixel(
            t.x + x * t.scale, t.y + y * t.scale, resolve));
          result[kind].push({ point: [x, y], markerVisible: color.red === 255
            && color.green === 0 && color.blue === 255 });
        }
      }
      marker.destroy();

      // Put Flint above the left-hand gap from the reported clipping. Keep his gameplay
      // position on the same walkable floor and use an ordinary idle frame for review.
      const flint = scene.partyUnits.find(unit => unit.id === 'flint');
      const position = scene.battlefield.screenToArenaUnchecked(t.x + 450 * t.scale,
        t.y + 770 * t.scale);
      flint.setArenaPosition(position.x, position.y);
      flint.spriteVisual.action = null;
      flint.spriteVisual.motion.state = 'idle';
      flint.spriteVisual.motion.direction = 'south-east';
      flint.spriteVisual.applyFrame(flint.spriteVisual.currentFrame());
      flint.spriteVisual.applyPose();

      // Dismiss the paused opening-wave announcement so the review shows his whole body.
      scene.clearWaveAnnouncement();
      return result;
    });

    await page.screenshot({ path: `output/qa/cave-clipping/flint-${viewport.width}.png` });
    for (const sample of samples.floor) {
      expect(sample.markerVisible, `Open floor at artwork ${sample.point}`).toBe(true);
    }
    for (const sample of samples.rocks) {
      expect(sample.markerVisible, `Foreground rock at artwork ${sample.point}`).toBe(false);
    }
    expect(errors).toEqual([]);
  });
}
