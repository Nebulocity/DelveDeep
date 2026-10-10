// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';

test('tanks and melee units move out of active ground telegraphs', async ({ page }) => {
  const errors = [];

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const scene = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.partyUnits?.length === 5;
  });

  const movement = await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const outcomes = [];
    for (const role of ['Tank', 'Melee DPS']) {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const unit = scene.partyUnits[role === 'Tank' ? 0 : 1];
      unit.role = role;
      unit.finishAction();
      const center = { x: unit.arenaX, y: unit.arenaY };
      scene.activeTelegraphs = [{ arenaX: center.x, arenaY: center.y, radius: 120, attacker: null }];
      scene.tactics.tactics.mechanicResponse = 'avoid';
      const before = unit.distanceToPoint(center.x, center.y);

      scene.updatePartyUnit(unit, scene.time.now + 100, 0.05);
      outcomes.push({ role, before, after: unit.distanceToPoint(center.x, center.y) });
      scene.activeTelegraphs = [];
    }

    return outcomes;
  });

  expect(movement).toHaveLength(2);
  for (const unit of movement) expect(unit.after).toBeGreaterThan(unit.before);
  expect(errors).toEqual([]);
});

test('pursuit and retreat navigate around fallen allies and blocked terrain', async ({ page }) => {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  const outcome = await page.evaluate(async () => {

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { default: CombatMovement } = await import('/combat/CombatMovement.js');
    const battlefield = {
      logicalWidth: 2400,
      logicalHeight: 1080,

      // We handle clamp point here, keeping this operation in one place for its callers.
      clampPoint: (x, y) => ({ x: Math.max(0, Math.min(2400, x)), y: Math.max(0, Math.min(1080, y)) })
    };

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    const bodies = [350, 425, 500, 575, 650].map((y, index) => ({
      id: `body-${index}`, alive: false, isEnemy: false, bodyRadius: 20, arenaX: 1100, arenaY: y,
      role: 'Melee DPS', spacingMode: 'normal', container: { active: true }
    }));
    const run = (startX, destinationX) => {
      const unit = { id: 'runner', alive: true, isEnemy: false, bodyRadius: 20, arenaX: startX, arenaY: 500,
        role: 'Melee DPS', spacingMode: 'normal', status: {} };

      // ... expands these entries into the new list or call. It does not deep-copy the
      // objects inside.
      const scene = { partyUnits: [unit, ...bodies], enemies: [], time: { now: 0 }, battlefield,
        terrain: { isUnitBlocked: (_unit, x, y) => x > 990 && x < 1210 && y > 300 && y < 700,

          // We handle resolve step here, keeping this operation in one place for its
          // callers.
          resolveStep: (_unit, x, y) => ({ x, y }) }, isPositionLocked: () => false };
      const movement = new CombatMovement(scene);
      scene.movement = movement;

      const goal = { x: destinationX, y: 500 };
      let clear = true;
      for (let frame = 0; frame < 1200; frame += 1) {
        scene.time.now += 50;
        const waypoint = movement.getNavigationWaypoint(unit, goal);
        const dx = waypoint.x - unit.arenaX, dy = waypoint.y - unit.arenaY;

        // Math.hypot calculates straight-line length from the x/y differences: square
        // each, add them, then take the square root.
        const length = Math.hypot(dx, dy);
        if (length < 1) continue;

        // Math.min chooses the smallest value; pairing it with Math.max can keep a result
        // inside both a lower and an upper bound.
        const travel = Math.min(12, length);
        const next = movement.getSteeredMovementPoint(unit, dx / length * travel, dy / length * travel, false);
        unit.arenaX = next.x;
        unit.arenaY = next.y;

        // some stops with true as soon as one entry passes the check; an empty list gives
        // false.
        if (bodies.some(body => Math.hypot(unit.arenaX - body.arenaX, unit.arenaY - body.arenaY)
          < movement.getRequiredUnitSpacing(unit, body) - 1)
          || scene.terrain.isUnitBlocked(unit, unit.arenaX, unit.arenaY)) clear = false;

        if (Math.hypot(unit.arenaX - destinationX, unit.arenaY - 500) < 32) break;
      }

      return { x: unit.arenaX, y: unit.arenaY, reached: Math.hypot(unit.arenaX - destinationX, unit.arenaY - 500) < 32, clear };
    };

    return [run(700, 1600), run(1600, 700)];
  });

  expect(outcome).toEqual([{ x: expect.any(Number), y: expect.any(Number), reached: true, clear: true },
    { x: expect.any(Number), y: expect.any(Number), reached: true, clear: true }]);
});
