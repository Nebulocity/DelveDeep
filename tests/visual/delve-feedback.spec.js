// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';

test('Delve selection highlights cards only and ally taps command the group', async ({ page }) => {
  const errors = [];

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').enemies?.some(enemy => enemy.alive && !enemy.landing));
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').togglePause());

  const clickCard = async index => {
    const point = await page.evaluate(i => {
      const game = window.__DELVE_DEEP_VISUAL_QA__.game, scene = game.scene.getScene('BattleScene');
      const zone = scene.partyHud[i].statusHitZone, canvas = game.canvas.getBoundingClientRect();
      return { x: canvas.x + zone.x * canvas.width / game.scale.width, y: canvas.y + (zone.y - 30) * canvas.height / game.scale.height };
    }, index);
    await page.mouse.click(point.x, point.y);
  };

  await clickCard(0);
  expect(await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene'), c = s.partyHud[0];
    return { selected: s.selectedUnitIds.size, portrait: Boolean(c.portraitHighlight), card: c.cardHighlight.visible, battlefield: c.unit.hitZone.isStroked };
  })).toEqual({ selected: 1, portrait: false, card: true, battlefield: false });
  await clickCard(1);
  expect(await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return s.selectedUnitIds.size === 0 && s.manualTargets.has(s.partyHud[0].unit.id);
  })).toBe(true);

  await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    s.selectRole('All');

    // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
    s.partyHud[0].unit.hp = Math.floor(s.partyHud[0].unit.maxHp / 2);
  });

  await clickCard(0);
  expect(await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place. every requires all entries to pass the check; an empty
    // list gives true.
    return { selected: s.selectedUnitIds.size, highlights: s.partyHud.filter(c => c.cardHighlight.visible).length,
      healers: s.partyUnits.filter(u => u.role === 'Healer').every(u => s.healerPriorityTargets.get(u.id) === s.partyHud[0].unit.id) };
  })).toEqual({ selected: 0, highlights: 0, healers: true });

  await page.screenshot({ path: 'output/qa/delve-feedback/group-selection.png' });
  await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    s.showBattleMessage(s.formatWaveReward({ gold: 30, xp: 17, materials: { cloth: 2, iron: 1, herb: 1 } }), '#bef264', true);
  });
  expect(await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return s.battleMessageText.text.includes('+2 Linen Cloth') && s.battleMessagePlaque.getBounds().height >= s.battleMessageText.height + 29;
  })).toBe(true);

  await page.screenshot({ path: 'output/qa/delve-feedback/named-rewards.png' });
  const inspectPoint = await page.evaluate(() => {
    const game = window.__DELVE_DEEP_VISUAL_QA__.game, scene = game.scene.getScene('BattleScene');
    const zone = scene.partyHud[0].statusHitZone, canvas = game.canvas.getBoundingClientRect();
    return { x: canvas.x + zone.x * canvas.width / game.scale.width, y: canvas.y + (zone.y - 30) * canvas.height / game.scale.height };
  });
  await page.mouse.move(inspectPoint.x, inspectPoint.y);

  await page.mouse.down();
  await page.waitForFunction(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').selectionDetailsClose));
  await page.mouse.up();
  expect(await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const body = s.children.list.find(o => o.type === 'Text' && o.depth === 10002 && o.text.includes('HP:'));
    return { align: body.style.align, origin: body.originX, paused: s.combatPaused, selected: s.selectedUnitIds.size };
  })).toEqual({ align: 'center', origin: 0.5, paused: true, selected: 0 });

  await page.screenshot({ path: 'output/qa/delve-feedback/centered-details.png' });
  expect(errors).toEqual([]);
});
