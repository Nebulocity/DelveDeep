import { test, expect } from '@playwright/test';

// Inspect finished missile sheets on the real battlefield at phone and desktop size.
test('PixelLab missiles visibly travel and pause without changing direct effects', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return s?.sys.isActive() && s.enemies?.some(unit => !unit.landing) && !s.waveTransitioning;
  });
  const result = await page.evaluate(async () => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const travel = await import('/combat/TravelingEffects.js');
    const effects = await import('/combat/AbilityEffect.js');
    s.combatPaused = true;
    s.time.paused = true;
    effects.clearAbilityEffects(s);
    const enemy = s.getLivingEnemies()[0];
    enemy.setArenaPosition(1000, 200);
    const names = ['Piercing Shot', 'Radiant Spear', 'Seaspray Orb'];
    for (let index = 0; index < names.length; index++) {
      const caster = s.partyUnits[index];
      caster.setArenaPosition(230, 190 + index * 65);
      caster.pendingAction = { startAt: s.time.now, duration: 300, name: names[index] };
      travel.startTravelingEffect(s, caster, enemy, { name: names[index] }, caster.pendingAction);
    }
    s.combatPaused = false;
    travel.updateTravelingEffects(s, 150);
    s.combatPaused = true;
    const flights = s.travelingEffects.filter(effect => names.includes(effect.ability.name));
    const poses = flights.map(effect => ({ x: effect.image.x, y: effect.image.y, frame: effect.image.frame.name }));
    travel.updateTravelingEffects(s, 1000);
    const paused = flights.every((effect, index) => effect.image.x === poses[index].x
      && effect.image.y === poses[index].y && effect.image.frame.name === poses[index].frame);
    const shot = flights.find(effect => effect.ability.name === 'Piercing Shot');
    const orb = flights.find(effect => effect.ability.name === 'Seaspray Orb');
    const straightMidpoint = Math.abs(shot.pose.x - (shot.from.x + shot.to.x) / 2) < 0.01;
    const lob = orb.pose.y < (orb.from.y + orb.to.y) / 2 - 20;
    const direct = effects.createAbilityTelegraph(s, s.partyUnits[0], enemy,
      { id: 'ability_v2_generic_magical_brand', name: 'Brand', castRange: 600 }, { duration: 300 });
    window.__RANGED_ART_REVIEW__ = { flights };
    return { count: flights.length, paused, straightMidpoint, lob, direct,
      sheets: flights.map(effect => effect.sheet.name),
      frames: flights.every(effect => s.textures.get(effect.sheet.key).has(31)) };
  });
  expect(result).toEqual({ count: 3, paused: true, straightMidpoint: true, lob: true, direct: false,
    sheets: ['arrow', 'lance', 'bolt'], frames: true });
  await page.screenshot({ path: `output/qa/ranged-delivery/battle-${page.viewportSize().width}.png` });
  const fade = await page.evaluate(async () => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const travel = await import('/combat/TravelingEffects.js');
    const flights = window.__RANGED_ART_REVIEW__.flights;
    for (const effect of flights) effect.caster.pendingAction = null;
    s.combatPaused = false;
    travel.updateTravelingEffects(s, 200);
    const fading = flights.every(effect => effect.image.active && effect.image.alpha > 0 && effect.image.alpha < 1);
    travel.updateTravelingEffects(s, 200);
    const removed = flights.every(effect => !effect.image.active);
    s.combatPaused = true;
    return { fading, removed };
  });
  expect(fade).toEqual({ fading: true, removed: true });
  expect(errors).toEqual([]);
});
