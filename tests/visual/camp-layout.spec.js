// The camp description must grow downward from the title, even when rewards take four lines.
// Check real text bounds on both a phone-sized page and a desktop page. Phaser still draws
// on its logical canvas, so bounds checks use that space and screenshots show the scaling.

import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`camp rewards stay below their title at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });

    // A fresh scene for each difficulty removes the previous overlay. Changing only the
    // test's Delve copy checks every reward label without modifying the authored catalog.
    for (const difficulty of ['Easy', 'Difficult', 'Tough', 'Very Tough', 'Incredibly Tough', 'Impossible']) {
      await page.evaluate(difficulty => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        qa.activate('BattleScene', { delve: 'slime-cave' });
        qa.state.currentDelve = { ...qa.state.currentDelve, difficulty };
      }, difficulty);

      await page.waitForFunction(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        return scene.sys.isActive() && scene.partyUnits?.length === 5 && scene.encounterStatusText;
      });
      await page.locator('#loading-screen').waitFor({ state: 'hidden' });

      const cards = await page.evaluate(() => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        const scene = qa.game.scene.getScene('BattleScene');
        scene.togglePause();
        scene.showDelveCamp();

        // Match each description to the card at the same x. getBounds includes actual
        // font measurement, wrapping and origin, which is what caused the original overlap.
        return ['RETURN TO TOWN', `FARM WAVE ${scene.bossWaveIndex}`, 'FACE THE BOSS'].map(title => {
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
  });
}
