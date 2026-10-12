import { test, expect } from '@playwright/test';

// Inspect the real Phaser projectile between actual sprites at phone landscape size.
test('Toxic Glob visibly arcs toward its recipient and lands with its splash', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  // Keep this review stable while other chats edit shared source and trigger Vite hot reload.
  await page.routeWebSocket('**', socket => socket.close());
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.enemies?.some(unit => !unit.landing) && !scene.waveTransitioning;
  });
  const result = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/SlimeAbilityEffects.js');
    scene.combatPaused = true;
    scene.time.paused = true;
    effects.clearSlimeAbilityEffects(scene);
    scene.battleEvents.clear();
    const caster = scene.getLivingEnemies()[0];
    const target = scene.partyUnits[0];
    caster.setArenaPosition(700, 350);
    target.setArenaPosition(1450, 420);
    const action = { startAt: scene.time.now, duration: 1200, name: 'Toxic Glob' };
    caster.pendingAction = action;
    effects.startSlimeGlobFlight(scene, caster, target, { name: 'Toxic Glob' }, action);
    const flight = scene.slimeGlobFlights[0];
    const launch = { x: flight.image.x, y: flight.image.y };
    scene.time.now += 600;
    scene.combatPaused = false;
    effects.updateSlimeAbilityEffects(scene, 600);
    scene.combatPaused = true;
    const mid = { x: flight.image.x, y: flight.image.y, frame: flight.image.frame.name };
    effects.updateSlimeAbilityEffects(scene, 2000);
    const frozen = flight.image.x === mid.x && flight.image.y === mid.y
      && flight.image.frame.name === mid.frame;
    window.__slimeGlobReview = { effects, scene, caster, target, action };
    return { visible: flight.image.visible && flight.image.active && flight.image.displayWidth >= 40,
      travels: mid.x > launch.x + 100, rises: mid.y < launch.y - 70, frozen };
  });
  expect(result).toEqual({ visible: true, travels: true, rises: true, frozen: true });
  await page.screenshot({ path: 'output/qa/slime-cave-vfx/toxic-glob-midflight.png' });
  const landing = await page.evaluate(() => {
    const { effects, scene, caster, target, action } = window.__slimeGlobReview;
    scene.time.now = action.startAt + action.duration;
    effects.landSlimeGlobFlight(scene, caster, action);
    effects.playSlimeAbilityEffect(scene, 'Toxic Glob', target);
    const flight = scene.slimeGlobFlights[0];
    const splash = scene.slimeAbilityEffects[0];
    const matches = flight.image.x === splash.image.x && flight.image.y === splash.image.y;
    caster.pendingAction = null;
    scene.combatPaused = false;
    effects.updateSlimeAbilityEffects(scene, 200);
    scene.combatPaused = true;
    return { matches, fading: flight.image.alpha === 0.5 && flight.image.active };
  });
  expect(landing).toEqual({ matches: true, fading: true });
  await page.screenshot({ path: 'output/qa/slime-cave-vfx/toxic-glob-touchdown.png' });
  expect(errors).toEqual([]);
});
