import { test, expect } from './helpers.js';

async function battle(page, audit, delve = 'slime-cave') {
  await audit.boot();
  await audit.activate('BattleScene', { delve });
  await page.waitForFunction(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return s.partyHud?.length === 5 && s.enemies.some(e => !e.landing) && !s.waveTransitioning;
  });
  await page.evaluate(() => { const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene'); if (!s.combatPaused) s.togglePause(); });
}

async function clickObject(page, audit, expression, edge = 'center') {
  const logical = await page.evaluate(({ expression, edge }) => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    // The expression is authored test code, never player or discovered text.
    const object = Function('s', `return ${expression}`)(s);
    const b = object.getBounds();
    return { x: edge === 'left' ? b.x + b.width * 0.15 : b.centerX, y: b.centerY };
  }, { expression, edge });
  const p = await audit.point(logical.x, logical.y);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(180);
  audit.interactions.push({ scene: 'BattleScene', label: expression, edge, kind: 'pointer-click', point: p });
}

test('combat roster full cards, radials, Move, Focus and Slowly Fade', async ({ page, audit }) => {
  test.setTimeout(180000);
  await battle(page, audit);
  const state = () => page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return { selected: [...s.selectedUnitIds], command: s.commandMode, menu: s.radialHud.openMenu,
      targets: [...s.manualTargets], plan: s.leaderOrderPlan.orders?.length, neutral: s.radialHud.neutral };
  });
  await audit.capture('BattleScene', 'paused-hud');
  for (let index = 0; index < 5; index++) {
    await clickObject(page, audit, `s.partyHud[${index}].statusHitZone`, 'left');
    const id = await page.evaluate(i => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyHud[i].unit.id, index);
    expect((await state()).selected).toEqual([id]);
    await clickObject(page, audit, `s.partyHud[${index}].statusHitZone`);
    expect((await state()).selected).toEqual([]);
  }
  await clickObject(page, audit, 's.partyHud[0].statusHitZone');
  await clickObject(page, audit, 's.radialHud.centers.ABILITIES.hit');
  expect((await state()).menu).toBe('ABILITIES');
  await audit.capture('BattleScene', 'ability-radial');
  await clickObject(page, audit, 's.radialHud.options.find(o => o.ability).hit');
  expect(await page.evaluate(() => !!window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').selectionDetailsClose)).toBe(true);
  await audit.capture('BattleScene', 'autonomous-ability-details');
  await audit.click('BattleScene', 'CLOSE');
  await clickObject(page, audit, 's.partyHud[0].statusHitZone');
  await clickObject(page, audit, 's.radialHud.centers.SELECT.hit');
  expect((await state()).menu).toBe('SELECT');
  await audit.capture('BattleScene', 'select-radial');
  await clickObject(page, audit, "s.radialHud.options.find(o => o.value === 'All').hit");
  expect((await state()).selected).toHaveLength(5);
  await clickObject(page, audit, 's.radialHud.centers.ACTION.hit');
  await audit.capture('BattleScene', 'action-radial');
  await clickObject(page, audit, "s.radialHud.options.find(o => o.value === 'MOVE').hit");
  expect((await state()).command).toBe('MOVE');
  // Expire only presentation feedback while a real command remains armed.
  await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    s.radialHud.feedbackAt = s.time.now - 3100;
    s.radialHud.update();
  });
  expect((await state()).selected).toHaveLength(5);
  expect((await state()).command).toBe('MOVE');
  await audit.capture('BattleScene', 'slowly-fade-command-still-armed');
  const floor = await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const objects = s.children.list.filter(o => o.input?.enabled);
    for (let y = 400; y < 850; y += 50) for (let x = 700; x < 1900; x += 75) {
      const p = s.battlefield.screenToArena(x, y);
      if (!p || s.terrain.isBlocked(p.x, p.y)) continue;
      const hits = s.input.manager.hitTest({ x, y }, objects, s.cameras.main, []);
      s.input.sortGameObjects(hits, { camera: s.cameras.main });
      if (hits[0]?.type === 'Zone') return { x, y };
    }
    throw new Error('No reachable walkable floor point');
  });
  const point = await audit.point(floor.x, floor.y);
  await page.mouse.click(point.x, point.y);
  await expect.poll(async () => (await state()).selected).toEqual([]);
  expect((await state()).command).toBeNull();
  await audit.capture('BattleScene', 'move-confirmation');
  // Resume through the visible control so the prepared Move dispatches normally.
  await clickObject(page, audit, 's.pauseButton');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').combatPaused)).toBe(false);
  await clickObject(page, audit, 's.pauseButton');
  await clickObject(page, audit, 's.partyHud[0].statusHitZone');
  const enemyPoint = await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    for (const e of s.enemies.filter(e => !e.landing && e.alive)) {
      const bounds = e.hitZone.getBounds();
      for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.2], [0.2, 0.5], [0.8, 0.5]]) {
        const point = { x: bounds.x + bounds.width * fx, y: bounds.y + bounds.height * fy };
        const hits = s.input.manager.hitTest(point, s.input._list, s.cameras.main, []);
        s.input.sortGameObjects(hits, { camera: s.cameras.main });
        if (hits[0] === e.hitZone) return { x: point.x, y: point.y, id: e.id };
      }
    }
    throw new Error('No unobstructed enemy hit surface');
  });
  const enemy = await audit.point(enemyPoint.x, enemyPoint.y);
  await page.mouse.click(enemy.x, enemy.y, { delay: 70 });
  await expect.poll(async () => (await state()).selected).toEqual([]);
  expect(await page.evaluate(id => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').pendingLeaderOrders.some(order => order.type === 'ATTACK' && order.targetId === id), enemyPoint.id)).toBe(true);
  await clickObject(page, audit, 's.pauseButton');
  await expect.poll(() => page.evaluate(id => [...window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').attackTargets.values()].includes(id), enemyPoint.id)).toBe(true);
  await audit.capture('BattleScene', 'focus-confirmation');
});

test('combat pause options, radial preferences, retreat cancel and defeat results', async ({ page, audit }) => {
  await battle(page, audit);
  // The settings cog is the only 84px header control; use its live bounds.
  const point = await audit.point(2060, 48);
  await page.mouse.click(point.x, point.y);
  await audit.capture('BattleScene', 'pause-options');
  for (const label of ['Clear', 'Sticky', 'Memory', 'Slowly Fade']) {
    await audit.click('BattleScene', label);
    expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.preferences.delveRadialBehavior)).toBe(label.toLowerCase().replace(' ', '-'));
  }
  await audit.click('BattleScene', 'RETREAT');
  await audit.capture('BattleScene', 'retreat-confirmation');
  await audit.click('BattleScene', 'CANCEL');
  expect(await page.evaluate(() => !!window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').selectionDetailsClose)).toBe(false);
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').combatPaused)).toBe(true);
  await audit.click('BattleScene', 'RETREAT');
  // The upper confirmation button is above the pause menu's covered Retreat surface.
  await audit.click('BattleScene', 'RETREAT');
  await audit.active('EncounterSummaryScene');
  await audit.capture('EncounterSummaryScene', 'retreat-from-combat');
  await audit.activate('EncounterSummaryScene', { result: 'defeat' });
  expect((await audit.capture('EncounterSummaryScene', 'defeat')).texts.some(o => o.text === 'PARTY DEFEATED')).toBe(true);
});

test('camp ordinary boss intro, victory and reward presentation', async ({ page, audit }) => {
  await battle(page, audit);
  await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    s.showDelveCamp();
  });
  await audit.capture('BattleScene', 'camp');
  // Choose the real continue card and verify it removes the camp instead of merely firing a callback.
  const camp = await audit.snapshot('BattleScene');
  const advance = camp.objects.find(o => ['FACE THE BOSS', 'CONTINUE DELVE'].includes(o.label) && o.probes?.[0]?.topmost);
  expect(advance).toBeTruthy();
  await audit.click('BattleScene', advance.label);
  expect((await audit.snapshot('BattleScene')).texts.some(o => o.text === 'DELVE CAMP')).toBe(false);
  await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    s.startWave(s.bossWaveIndex);
    if (s.combatPaused) s.togglePause();
  });
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').enemies.some(e => e.isBoss && !e.landing));
  await audit.capture('BattleScene', 'boss-encounter');
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').announceBossCast({ isBoss: true, name: 'Slime Sovereign' }, { name: 'Consume', responseHint: 'Move outside or Interrupt.' }, 6000));
  await audit.capture('BattleScene', 'boss-cast-warning');
  await audit.activate('RewardScene');
  const data = await audit.capture('RewardScene', 'victory-rewards');
  expect(data.texts.some(o => /Last Muster/.test(o.text))).toBe(true);
});

test('delve preparation follows actual navigation and restores party selection', async ({ page, audit }) => {
  await audit.boot();
  await audit.activate('DelveSelectScene');
  await audit.click('DelveSelectScene', 'PARTY SELECT', 1);
  await audit.active('PartySelectScene');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').selectedIds.size)).toBe(0);
  await audit.click('PartySelectScene', 'BATTLE OVERVIEW');
  expect((await audit.capture('PartySelectScene', 'empty-party-feedback')).texts.some(o => /Choose five/.test(o.text))).toBe(true);
  await audit.click('PartySelectScene', 'AUTO-SELECT');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').selectedIds.size)).toBe(5);
  await audit.capture('PartySelectScene', 'full-lineup');
  await audit.click('PartySelectScene', 'BATTLE OVERVIEW');
  await audit.active('DungeonScene');
  await audit.capture('DungeonScene', 'prepared-party');
  await audit.click('DungeonScene', 'PARTY SELECT');
  await audit.active('PartySelectScene');
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartySelectScene').selectedIds.size)).toBe(5);
});
