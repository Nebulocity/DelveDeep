import { test, expect } from '@playwright/test';

// Real canvas taps exercise both menu rails and the paused floor input surface.
test('paused party orders, tactics and visible critical recoil', async ({ page }) => {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene');
    return s?.sys.isActive() && s.enemies?.some(e => !e.landing) && !s.waveTransitioning;
  });
  await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    if (!s.combatPaused) s.togglePause();
  });

  // Map Phaser logical coordinates to the fitted canvas in either phone or desktop viewports.
  const tap = async (kind) => {
    const point = await page.evaluate(kind => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const s = qa.game.scene.getScene('BattleScene');
      const canvas = qa.game.canvas.getBoundingClientRect();
      let point;
      if (kind === 'ALL') point = s.roleButtons.find(b => b.role === 'All').box;
      else if (kind === 'FOCUS') point = s.leaderButtons.find(b => b.ability.id === 'focusFire').box;
      else if (kind === 'FLOOR') {
        const safe = s.terrain.nearestSafePoint(350, 200);
        point = s.battlefield.arenaToScreen(safe.x, safe.y);
      } else point = s.commandButtons.find(b => b.label === kind).box;
      return { x: canvas.x + point.x * canvas.width / qa.game.scale.width,
        y: canvas.y + point.y * canvas.height / qa.game.scale.height };
    }, kind);
    await page.mouse.click(point.x, point.y);
  };
  await tap('ALL');
  await tap('MOVE');
  await tap('FLOOR');
  const readOrders = () => page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return { held: [...s.heldUnitIds], targets: [...s.manualTargets], paused: s.combatPaused };
  });
  const orders = await readOrders();
  expect(orders.held).toHaveLength(5);
  expect(orders.targets).toHaveLength(5);
  await tap('HOLD');
  expect(await readOrders()).toEqual(orders);
  await tap('FOCUS');
  const queued = await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    s.handleEnemyTap(s.getLivingEnemies()[0]);
    return { count: s.pendingPausedTactics.length, focus: s.focusTargetId ?? null };
  });
  expect(queued).toEqual({ count: 1, focus: null });

  await tap('SPREAD');
  const spread = await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const anchor = s.partyUnits[0];
    s.toggleUnitSelection(anchor);
    const positions = s.partyUnits.map(unit => s.manualTargets.get(unit.id));
    return { anchor: anchor.distanceToPoint(positions[0].x, positions[0].y),
      safe: s.partyUnits.every((unit, index) => !s.terrain.isUnitBlocked(unit, positions[index].x, positions[index].y, 12)),
      minimum: Math.min(...positions.flatMap((point, index) => positions.slice(index + 1)
        .map(other => Math.hypot(point.x - other.x, point.y - other.y)))) };
  });
  expect(spread.anchor).toBe(0);
  expect(spread.safe).toBe(true);
  expect(spread.minimum).toBeGreaterThan(150);

  const recoil = await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const enemy = s.getLivingEnemies()[0];
    const visual = enemy.spriteVisual;
    const before = { x: enemy.x, y: enemy.y };
    s.combatPaused = false;
    enemy.playCriticalHit(s.partyUnits[0]);
    enemy.updateCriticalRecoil(1000);
    visual.update(1000);
    const after = { x: enemy.x, y: enemy.y };
    s.combatPaused = true;
    visual.update(1000);
    return { distance: Math.hypot(after.x - before.x, after.y - before.y), elapsed: enemy.criticalKnockback.elapsed };
  });
  expect(recoil.distance).toBeGreaterThan(15);
  expect(recoil.elapsed).toBe(110);
  await page.screenshot({ path: `output/qa/battle-feedback/paused-orders-${page.viewportSize().width}.png` });

  await page.evaluate(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    s.announceBossCast({ isBoss: true, name: 'Slime Sovereign' }, { name: 'Consume', responseHint: 'Move outside or Interrupt.' }, 6000);
  });
  await page.screenshot({ path: `output/qa/battle-feedback/boss-banner-${page.viewportSize().width}.png` });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').togglePause());
  await expect.poll(() => page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').pendingPausedTactics.length)).toBe(0);
});
