// The camp description must grow downward from the title, even when rewards take four lines.
// Check real text bounds on both a phone-sized page and a desktop page. Phaser still draws
// on its logical canvas, so bounds checks use that space and screenshots show the scaling.

import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`camp disables an already defeated boss at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });

    for (const cleared of [false, true]) {
      await page.evaluate(cleared => new Promise(resolve => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;

        // Wait for this restart's create event, not the previous scene's active flag.
        // Otherwise a fast fixture can inspect a camp that is about to be destroyed.
        qa.game.scene.getScene('BattleScene').events.once('create', () => resolve());
        qa.state.activeBattle = null;

        // A world clear with no checkpoint is the format used by older saves.
        qa.state.world.clearedDelves = cleared ? ['slime-cave'] : [];
        qa.state.delveCheckpoints = {};
        qa.activate('BattleScene', { delve: 'slime-cave' });
      }), cleared);
      await page.waitForFunction(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        return scene.sys.isActive() && scene.partyUnits?.length === 5 && scene.encounterStatusText;
      });
      await page.locator('#loading-screen').waitFor({ state: 'hidden' });
      const cards = await page.evaluate(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        const state = window.__DELVE_DEEP_VISUAL_QA__.state;
        state.delveCheckpoints[state.currentDelve.id] = { nextWave: scene.bossWaveIndex, campUnlocked: true };
        scene.togglePause();
        scene.showDelveCamp();
        return [672, 1200, 1728].map(x => {
          const button = scene.children.list.find(object => object.name === 'carved-stone-button'
            && object.x === x && object.y === 599);
          return { enabled: button.input.enabled, alpha: button.pressVisuals[0].alpha,
            labels: scene.children.list.filter(object => object.type === 'Text' && object.x === x && object.depth === 12003)
              .map(object => object.text) };
        });
      });
      expect(cards[0].enabled).toBe(true);
      expect(cards[0].labels).toContain('LEAVE DELVE');
      expect(cards[1].enabled).toBe(true);
      expect(cards[1].labels).toContain('Gold, XP, Happiness, and Materials');
      expect(cards[2].enabled).toBe(!cleared);
      expect(cards[2].alpha).toBe(cleared ? 0.45 : 1);
      expect(cards[2].labels).toContain(cleared ? 'Boss already defeated' : 'Challenge the boss of this Delve to earn better rewards and unlock the next Delve!');

      const canvas = await page.locator('canvas').boundingBox();
      await page.mouse.click(canvas.x + 1728 * canvas.width / 2400, canvas.y + 650 * canvas.height / 1080);
      expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.run.entry)).toBe(cleared ? 'camp' : 'boss');
      if (cleared) {
        await page.screenshot({ path: `output/qa/camp-cleared-${viewport.width}.png` });
        await page.mouse.click(canvas.x + 1200 * canvas.width / 2400, canvas.y + 650 * canvas.height / 1080);
        expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.run.entry)).toBe('farm');
      }
    }
  });

  test(`camp rewards stay below their title at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });

    // A fresh scene for each difficulty removes the previous overlay. Changing only the
    // test's Delve copy checks every reward label without modifying the authored catalog.
    for (const difficulty of ['Easy', 'Difficult', 'Tough', 'Very Tough', 'Incredibly Tough', 'Impossible']) {
      await page.evaluate(difficulty => new Promise(resolve => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        qa.game.scene.getScene('BattleScene').events.once('create', () => resolve());
        qa.state.activeBattle = null;
        qa.activate('BattleScene', { delve: 'slime-cave' });
        qa.state.currentDelve = { ...qa.state.currentDelve, difficulty };
      }), difficulty);

      await page.waitForFunction(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        return scene.sys.isActive() && scene.partyUnits?.length === 5 && scene.encounterStatusText;
      });
      await page.locator('#loading-screen').waitFor({ state: 'hidden' });

      const cards = await page.evaluate(() => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        const scene = qa.game.scene.getScene('BattleScene');
        qa.state.delveCheckpoints[qa.state.currentDelve.id] = { nextWave: scene.bossWaveIndex, campUnlocked: true };
        scene.togglePause();
        scene.showDelveCamp();

        // Match each description to the card at the same x. getBounds includes actual
        // font measurement, wrapping and origin, which is what caused the original overlap.
        return ['LEAVE DELVE', `FARM WAVE ${scene.bossWaveIndex}`, 'FACE THE BOSS'].map(title => {
          const label = scene.children.list.find(object => object.text === title);
          const detail = scene.children.list.find(object => object.type === 'Text'
            && object.x === label.x && object.depth === label.depth && object.y > label.y);
          const button = scene.children.list.find(object => object.name === 'carved-stone-button'
            && object.x === label.x && object.y === 599);
          const heading = scene.children.list.find(object => object.name === 'delve-camp-heading-window');
          const textBounds = detail.getBounds();
          const buttonBounds = button.getBounds();
          return { title, gap: textBounds.top - label.getBounds().bottom,
            bottom: textBounds.bottom, cardBottom: buttonBounds.bottom,
            left: textBounds.left, right: textBounds.right,
            cardLeft: buttonBounds.left, cardRight: buttonBounds.right,
            cardTop: buttonBounds.top, headingBottom: heading.getBounds().bottom };
        });
      });

      for (const card of cards) {
        expect(card.gap, `${difficulty}: ${card.title} title gap`).toBeGreaterThanOrEqual(12);
        expect(card.bottom, `${difficulty}: description fits vertically`).toBeLessThanOrEqual(card.cardBottom - 8);
        expect(card.left).toBeGreaterThan(card.cardLeft);
        expect(card.right).toBeLessThan(card.cardRight);
        expect(card.cardTop).toBeGreaterThan(card.headingBottom);
      }

      if (difficulty === 'Easy') {
        await page.screenshot({ path: `output/qa/camp-layout-${viewport.width}.png` });
      }
    }

    // Leaving camp opens the map without moving the party or losing its checkpoint.
    const before = await page.evaluate(() => {
      const state = window.__DELVE_DEEP_VISUAL_QA__.state;
      return { location: state.world.currentLocation, gold: state.gold, checkpoints: state.delveCheckpoints };
    });
    const canvas = await page.locator('canvas').boundingBox();
    await page.mouse.click(canvas.x + 672 * canvas.width / 2400, canvas.y + 650 * canvas.height / 1080);
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('TitleScene').sys.isActive());
    const after = await page.evaluate(() => {
      const state = window.__DELVE_DEEP_VISUAL_QA__.state;
      return { location: state.world.currentLocation, gold: state.gold, checkpoints: state.delveCheckpoints,
        party: state.activeParty, battle: state.activeBattle };
    });
    expect(after).toEqual({ ...before, party: [], battle: null });
  });
}
