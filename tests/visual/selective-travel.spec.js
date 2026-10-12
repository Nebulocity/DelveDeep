import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Inspect each delivery family in the real battlefield. Cosmetic casts have no
// gameplay callbacks, so this review cannot change damage or create extra hits.
test('Only moving payloads travel and all delivery families pause and fade', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return s?.sys.isActive() && s.enemies?.some(e => !e.landing) && !s.waveTransitioning;
  });
  await mkdir('output/qa/selective-travel', { recursive: true });
  const result = await page.evaluate(async () => {
    const travel = await import('/combat/TravelingEffects.js');
    const effects = await import('/combat/AbilityEffect.js');
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    s.combatPaused = true;
    s.time.paused = true;
    effects.clearAbilityEffects(s);
    const target = s.getLivingEnemies()[0];
    target.setArenaPosition(900, 250);
    const names = ['Piercing Shot', 'Stone Spit', 'Magic Missile', 'Refraction Beam', 'Tray Toss', 'Siphon'];
    const created = [];
    for (const [index, name] of names.entries()) {
      const action = { startAt: s.time.now, duration: 500 };

      // These stand-in casters borrow a real hero's silhouette and perspective,
      // while retaining distinct actions so no test flight cancels another one.
      const caster = { ...s.partyUnits[index % s.partyUnits.length],
        id: 'review-' + index, arenaX: 180, arenaY: 160 + index * 70, pendingAction: action };
      if (!travel.startTravelingEffect(s, caster, target, { name }, action)) throw new Error('No travel for ' + name);
      created.push(s.travelingEffects.at(-1));
    }
    const direct = ['Hex', 'Spellward', 'Brand', 'Smite', 'Entangling Roots', 'Gloomburst'];
    const stationary = direct.every(name => !travel.startTravelingEffect(s, s.partyUnits[0], target,
      { name, castRange: 600, damageType: 'spell' }, { startAt: s.time.now, duration: 500 }));
    s.combatPaused = false;
    travel.updateTravelingEffects(s, 250);
    s.combatPaused = true;
    const poses = created.map(effect => JSON.stringify(effect.pose));
    travel.updateTravelingEffects(s, 1000);
    const paused = created.every((effect, i) => JSON.stringify(effect.pose) === poses[i]);
    const straight = created[0].pose.x === (created[0].from.x + created[0].to.x) / 2;
    const lob = created[1].pose.y < (created[1].from.y + created[1].to.y) / 2 - 20;
    window.__SELECTIVE_TRAVEL_REVIEW__ = created;
    return { count: created.length, stationary, paused, straight, lob };
  });
  expect(result).toEqual({ count: 6, stationary: true, paused: true, straight: true, lob: true });
  await page.screenshot({ path: `output/qa/selective-travel/families-${page.viewportSize().width}.png` });
  const ended = await page.evaluate(async () => {
    const travel = await import('/combat/TravelingEffects.js');
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const flights = window.__SELECTIVE_TRAVEL_REVIEW__;
    for (const effect of flights) effect.caster.pendingAction = null;
    s.combatPaused = false;
    travel.updateTravelingEffects(s, 200);
    const fading = flights.every(effect => effect.fadeElapsed === 200);
    s.combatPaused = true;
    travel.updateTravelingEffects(s, 1000);
    const pause = flights.every(effect => effect.fadeElapsed === 200);
    s.combatPaused = false;
    travel.updateTravelingEffects(s, 200);
    s.combatPaused = true;
    return { fading, pause, removed: flights.every(effect => !effect.graphics.active && !effect.image?.active) };
  });
  expect(ended).toEqual({ fading: true, pause: true, removed: true });
  expect(errors).toEqual([]);
});
