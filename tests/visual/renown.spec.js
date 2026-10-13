// Verify that future tactics remain inspectable and that real purchases respect RP gates.
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`Renown purchases and locked previews at ${viewport.width}`, async ({ page }) => {

    // This flow loads the full asset catalog twice to verify saved purchases on reload.
    test.setTimeout(180000);
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('PartyLeaderScene'));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartyLeaderScene').sys.isActive());
    const labels = () => page.evaluate(() => {
      const flatten = list => list.flatMap(child => [child, ...(child.list ? flatten(child.list) : [])]);
      return flatten(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartyLeaderScene').children.list)
        .filter(child => child.type === 'Text').map(child => child.text);
    });
    const state = () => page.evaluate(() => {
      const leader = window.__DELVE_DEEP_VISUAL_QA__.state.leader;
      return { level: leader.level, points: leader.renownPoints, unlocked: leader.unlockedAbilities, equipped: leader.battleLoadout };
    });

    // Convert Phaser's logical 2400x1080 coordinates into the browser canvas rectangle.
    const click = async (name, text = false) => {
      const point = await page.evaluate(({ name, text }) => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('PartyLeaderScene');
        const flatten = list => list.flatMap(child => [child, ...(child.list ? flatten(child.list) : [])]);
        const object = flatten(scene.children.list).find(child => text ? child.text === name : child.name === name);
        if (!object) throw new Error('Missing tactic control: ' + name);
        const bounds = object.getBounds(), canvas = qa.game.canvas.getBoundingClientRect();
        return { x: canvas.x + (bounds.x + bounds.width / 2) * canvas.width / 2400,
          y: canvas.y + (bounds.y + bounds.height / 2) * canvas.height / 1080 };
      }, { name, text });
      await page.mouse.click(point.x, point.y, { delay: 70 });
    };

    expect(await state()).toEqual({ level: 1, points: 1, unlocked: [], equipped: [] });
    expect((await labels()).some(label => label.includes('Uncommon · Renown 10 · 15 RP'))).toBe(true);
    await mkdir('output/qa/renown', { recursive: true });
    await page.screenshot({ path: `output/qa/renown/tactics-${viewport.width}.png` });
    await click('hall-tactic-coordinatedAttack');
    await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartyLeaderScene').selectionDetailsClose));
    expect((await labels()).some(label => label.includes('Requires Renown Level 10'))).toBe(true);
    expect((await state()).points).toBe(1);
    await click('CLOSE', true);
    await click('hall-tactic-focusFire');
    await click('CONFIRM', true);
    expect((await state()).points).toBe(0);
    await click('hall-tactic-focusFire');
    expect((await state()).equipped).toEqual(['focusFire']);

    // Supplying extra points does not satisfy the level gate; eligible standing does.
    await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      qa.state.leader.renownPoints = 20;
      qa.game.scene.getScene('PartyLeaderScene').render();
    });
    await click('hall-tactic-coordinatedAttack');
    expect((await state()).unlocked).not.toContain('coordinatedAttack');
    await click('CLOSE', true);
    await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      qa.state.leader.level = 10;
      qa.game.scene.getScene('PartyLeaderScene').render();
    });
    await click('hall-tactic-coordinatedAttack');
    await click('CONFIRM', true);
    expect((await state()).points).toBe(5);
    await page.reload();
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    expect((await state()).unlocked).toContain('coordinatedAttack');
    expect((await state()).equipped).toEqual(['focusFire']);
    expect(errors).toEqual([]);
  });
}
