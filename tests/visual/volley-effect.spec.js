import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Resolve the real Ranger skill, then freeze combat to inspect its layered playback.
test('Volley plays once with aligned impacts, pause and cleanup', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    qa.activate('BattleScene');

    // The shared QA party uses roster order. Include the actual Ranger explicitly
    // before Phaser starts creating this scene, without changing the player's save.
    qa.state.activeParty[3] = { ...qa.state.roster.find(hero => hero.className === 'Ranger') };
  });
  await page.waitForFunction(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return s?.sys.isActive() && s.enemies?.some(e => !e.landing) && !s.waveTransitioning;
  });

  await mkdir('output/qa/volley', { recursive: true });
  const warning = await page.evaluate(async () => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    s.combatPaused = true;
    s.time.paused = true;
    const { CLASS_DEFINITIONS } = await import('/data/classes.js');
    const { updateAbilityEffects } = await import('/combat/AbilityEffect.js');
    const ranger = s.partyUnits.find(unit => unit.className === 'Ranger');
    const target = s.getLivingEnemies()[0];
    ranger.finishAction();
    const ability = Object.values(CLASS_DEFINITIONS.Ranger.abilities).find(a => a.name === 'Volley');
    ranger.abilities.volleyReview = ability;
    s.classAbilitySystem.cast(ranger, target, 'volleyReview', s.time.now);
    const telegraph = s.abilityTelegraphs[0];
    updateAbilityEffects(s, 0);
    return { count: s.abilityTelegraphs.length, color: telegraph.zone.fillColor,
      rangerColor: ranger.color, radius: telegraph.ability.zone,
      width: telegraph.zone.displayWidth,
      expectedWidth: s.battlefield.getGroundEllipseRadii(200, target.arenaY).width * 2 };
  });
  expect(warning.count).toBe(1);
  expect(warning.color).toBe(warning.rangerColor);
  expect(warning.radius).toBe(2);
  expect(warning.width).toBeCloseTo(warning.expectedWidth);
  await page.screenshot({ path: `output/qa/volley/telegraph-${page.viewportSize().width}.png` });

  const canceled = await page.evaluate(async () => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const { updateAbilityEffects } = await import('/combat/AbilityEffect.js');
    const ranger = s.partyUnits.find(unit => unit.className === 'Ranger');
    const zone = s.abilityTelegraphs[0].zone;
    ranger.finishAction();
    updateAbilityEffects(s, 0);
    return !zone.active && s.abilityTelegraphs.length === 0;
  });
  expect(canceled).toBe(true);
  const result = await page.evaluate(async () => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    s.combatPaused = true;
    const { CLASS_DEFINITIONS } = await import('/data/classes.js');
    const { updateAbilityEffects } = await import('/combat/AbilityEffect.js');
    const ranger = s.partyUnits.find(unit => unit.className === 'Ranger');
    if (!ranger) throw new Error('The QA party needs its Ranger');
    const ability = Object.values(CLASS_DEFINITIONS.Ranger.abilities).find(a => a.name === 'Volley');
    const target = s.getLivingEnemies()[0];

    // High health prevents the capture from ending the wave. The real resolver still
    // selects its circular targets and applies damage through the unchanged rules.
    for (const enemy of s.enemies) enemy.hp = enemy.maxHp = 100000;
    s.classAbilitySystem.cast(ranger, target, 'volleyReview', s.time.now);
    const action = ranger.pendingAction;
    const castZone = s.abilityTelegraphs[0].zone;
    s.classAbilitySystem.resolveCast(ranger, action, target, ability);
    const count = s.abilityEffects.length;
    const effect = s.abilityEffects[0];
    updateAbilityEffects(s, 500);
    const pausedElapsed = effect.elapsed;
    s.combatPaused = false;
    updateAbilityEffects(s, 500);
    s.combatPaused = true;
    return { count, pausedElapsed, elapsed: effect.elapsed, scale: effect.scale,
      castZoneCleared: !castZone.active && s.abilityTelegraphs.length === 0,
      visiblePieces: effect.pieces.filter(p => p.image.visible).length,
      arrowsBehind: effect.pieces[0].image.depth < target.container.depth,
      impactsAhead: effect.pieces[1].image.depth > target.container.depth,
      arrowX: effect.pieces[0].image.x,
      oldScale: Math.max(1, Math.round(400 * effect.origin.widthAtDepth / s.battlefield.logicalWidth / 110)),
      zoneColor: effect.zone.fillColor, rangerColor: ranger.color,
      expectedArrowX: effect.origin.x - 72 * effect.scale };
  });
  expect(result.count).toBe(1);
  expect(result.castZoneCleared).toBe(true);
  expect(result.pausedElapsed).toBe(0);
  expect(result.elapsed).toBe(500);
  expect(result.visiblePieces).toBe(5);
  expect(Number.isInteger(result.scale)).toBe(true);
  expect(result.scale).toBeGreaterThan(result.oldScale);
  expect(result.zoneColor).toBe(result.rangerColor);
  expect(result.arrowsBehind).toBe(true);
  expect(result.impactsAhead).toBe(true);
  expect(result.arrowX).toBe(result.expectedArrowX);
  await mkdir('output/qa/volley', { recursive: true });
  await page.screenshot({ path: `output/qa/volley/impact-${page.viewportSize().width}.png` });

  const cleanup = await page.evaluate(async () => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const { updateAbilityEffects } = await import('/combat/AbilityEffect.js');
    const images = s.abilityEffects[0].pieces.map(p => p.image);
    s.combatPaused = false;
    updateAbilityEffects(s, 300);
    s.combatPaused = true;
    const ended = s.abilityEffects.length === 0 && images.every(image => !image.active);
    const ranger = s.partyUnits.find(unit => unit.className === 'Ranger');
    const target = s.getLivingEnemies()[0];
    s.createAbilityEffect(ranger, target, { name: 'Volley', zone: 2 });
    updateAbilityEffects(s, 0, true);
    const replayCleared = s.abilityEffects.length === 0;
    s.createAbilityEffect(ranger, target, { name: 'Volley', zone: 2 });
    window.volleyShutdownImages = s.abilityEffects[0].pieces.map(p => p.image);
    s.scene.stop();
    return { ended, replayCleared };
  });
  expect(cleanup).toEqual({ ended: true, replayCleared: true });

  // Phaser queues scene.stop until its next frame. Wait for actual shutdown before
  // checking the images, rather than inspecting them while the scene is still active.
  await page.waitForFunction(() => window.volleyShutdownImages.every(image => !image.active));
  expect(errors).toEqual([]);
});
