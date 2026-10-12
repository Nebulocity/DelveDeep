import { test, expect } from '@playwright/test';

// Review each finished effect on real combat sprites at phone landscape size.
// Freeze gameplay while advancing only the cosmetic clock for repeatable captures.
test('Verdant Cleric sheets, flight and fade render in combat', async ({ page }) => {
  test.setTimeout(150000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(async () => {
    const { default: state } = await import('/game/GameState.js');
    const goldmoon = state.roster.find(unit => unit.id === 'goldmoon');
    if (goldmoon) state.roster = [goldmoon, ...state.roster.filter(unit => unit !== goldmoon)];
    window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene');
  });
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.enemies?.some(unit => !unit.landing) && !scene.waveTransitioning;
  });
  for (let group = 0; group < 3; group++) {
    const result = await page.evaluate(async group => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      const effects = await import('/combat/AbilityEffect.js');
      const { VERDANT_CLERIC_EFFECTS } = await import('/data/verdantClericEffects.js');
      const { replacementAbilities } = await import('/data/replacementAbilities.js');
      const kit = replacementAbilities('Cleric of the Verdant Covenant');
      scene.combatPaused = true;
      scene.time.paused = true;
      effects.clearAbilityEffects(scene);

      // Spread the recipients across the walkable floor so each effect can be
      // inspected without other characters hiding its leaves, roots or layers.
      scene.partyUnits.forEach((unit, i) => {
        const point = scene.battlefield.clampPoint(i < 4 ? 350 + i * 330 : 900, i < 4 ? 560 : 780, 55, 55);
        unit.setArenaPosition(point.x, point.y);
      });
      scene.enemies.forEach((unit, i) => {
        const point = scene.battlefield.clampPoint(600 + i * 280, 130, 55, 55);
        unit.setArenaPosition(point.x, point.y);
      });
      for (const unit of [...scene.partyUnits, ...scene.enemies]) {
        unit.status.replacementEffects = [];
        unit.status.replacementZones = [];
        unit.status.replacementPeriodic = [];
        unit.status.replacementReactions = [];
        unit.status.rootedUntil = 0;
      }
      const definitions = VERDANT_CLERIC_EFFECTS.slice(group * 4, group * 4 + 4);
      for (let i = 0; i < definitions.length; i++) {
        const definition = definitions[i];
        const target = scene.partyUnits[i];
        const ability = kit[definition.abilityId];
        const caster = definition.groundZone ? target : scene.partyUnits[4];
        const record = { ability, until: scene.time.now + 6000, wave: scene.currentWaveIndex,
          point: { arenaX: target.arenaX, arenaY: target.arenaY } };
        if (definition.verdantStatus === 'modifier') target.status.replacementEffects = [{ key: ability.id + ':beneficial', until: record.until }];
        if (definition.verdantStatus === 'root') target.status.rootedUntil = record.until;
        if (definition.verdantStatus === 'zone') target.status.replacementZones = [record];
        if (definition.verdantStatus === 'periodic') target.status.replacementPeriodic = [record];
        if (['reaction', 'shield'].includes(definition.verdantStatus)) target.status.replacementReactions = [record];
        if (definition.verdantStatus === 'shield') Object.assign(target.status, { temporaryHp: 50, temporaryHpUntil: record.until });
        effects.createAbilityEffect(scene, caster, target, ability, [target]);
      }
      scene.combatPaused = false;
      effects.updateAbilityEffects(scene, 600);
      scene.combatPaused = true;
      return { count: scene.abilityEffects.length,
        ready: scene.abilityEffects.every(effect => effect.pieces.filter(piece => piece.image.visible)
          .every(piece => piece.image.frame.name === 12)) };
    }, group);
    expect(result).toEqual({ count: 4, ready: true });
    await page.screenshot({ path: `output/qa/verdant-cleric/revision/battle-${group}-${page.viewportSize().width}.png` });
    if (group === 1) {
      const phase = await page.evaluate(async () => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        const effects = await import('/combat/AbilityEffect.js');
        scene.combatPaused = false;
        effects.updateAbilityEffects(scene, 1400);
        scene.combatPaused = true;
        const quake = scene.abilityEffects.find(effect => effect.definition.slug === 'lifequake');
        const [cracks, rear, front] = quake.pieces;
        return { held: cracks.image.frame.name === 31, eruption: rear.image.frame.name === 8,
          layers: rear.image.depth < front.image.depth,
          upright: rear.image.scaleY === rear.image.scaleX,
          distinctProjection: cracks.image.scaleY !== rear.image.scaleY };
      });
      expect(phase).toEqual({ held: true, eruption: true, layers: true, upright: true, distinctProjection: true });
      await page.screenshot({ path: `output/qa/verdant-cleric/revision/lifequake-eruption-${page.viewportSize().width}.png` });
    }
  }
  const flight = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    const travel = await import('/combat/TravelingEffects.js');
    const { replacementAbilities } = await import('/data/replacementAbilities.js');
    effects.clearAbilityEffects(scene);
    const caster = scene.partyUnits[4], target = scene.enemies[0];
    const ability = replacementAbilities('Cleric of the Verdant Covenant').ability_v2_verdant_cleric_wrath;
    const action = { startAt: scene.time.now, duration: 300 };
    caster.pendingAction = action;
    scene.combatPaused = false;
    effects.createAbilityTelegraph(scene, caster, target, ability, action);
    travel.updateTravelingEffects(scene, 150);
    scene.combatPaused = true;
    const effect = scene.travelingEffects[0];
    const before = { ...effect.pose };
    travel.updateTravelingEffects(scene, 1000);
    return { sheet: Boolean(effect.image), halfway: effect.progress === 0.5,
      paused: before.x === effect.pose.x && before.y === effect.pose.y };
  });
  expect(flight).toEqual({ sheet: true, halfway: true, paused: true });
  await page.screenshot({ path: `output/qa/verdant-cleric/wrath-flight-${page.viewportSize().width}.png` });
  const fade = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    const travel = await import('/combat/TravelingEffects.js');
    const flight = scene.travelingEffects[0];
    travel.finishTravelingEffect(scene, flight.caster, flight.action);
    flight.caster.pendingAction = null;
    scene.combatPaused = false;
    travel.updateTravelingEffects(scene, 200);
    const alpha = flight.image.alpha;
    scene.combatPaused = true;
    travel.updateTravelingEffects(scene, 1000);
    const paused = flight.image.alpha === alpha;
    scene.combatPaused = false;
    travel.updateTravelingEffects(scene, 200);
    effects.clearAbilityEffects(scene);
    scene.combatPaused = true;
    return { halfway: alpha === 0.5, paused, cleared: scene.travelingEffects.length === 0 };
  });
  expect(fade).toEqual({ halfway: true, paused: true, cleared: true });
  expect(errors).toEqual([]);
});
