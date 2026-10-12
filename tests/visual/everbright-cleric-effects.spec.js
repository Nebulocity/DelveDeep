import { test, expect } from '@playwright/test';

// Review all ability phases on real silhouettes, with the real Phaser textures.
test('Everbright effects play, travel and fade at phone landscape size', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.enemies?.some(unit => !unit.landing) && !scene.waveTransitioning;
  });
  for (let group = 0; group < 4; group++) {
    const result = await page.evaluate(async group => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      const effects = await import('/combat/AbilityEffect.js');
      const { EVERBRIGHT_CLERIC_EFFECTS } = await import('/data/everbrightClericEffects.js');
      const { replacementAbilities } = await import('/data/replacementAbilities.js');
      const kit = replacementAbilities('Cleric of the Everbright');
      scene.combatPaused = true;
      scene.time.paused = true;
      effects.clearAbilityEffects(scene);
      scene.everbrightReviewLabels?.forEach(label => label.destroy());
      scene.everbrightReviewLabels = [];
      for (const unit of [...scene.partyUnits, ...scene.enemies]) {
        unit.status.replacementEffects = [];
        unit.status.replacementPeriodic = [];
        unit.status.sunlitWardVisualUntil = 0;
        unit.status.temporaryHp = 0;
      }
      scene.partyUnits.forEach((unit, index) => {
        const point = scene.battlefield.clampPoint(index < 4 ? 400 + index * 325 : 900,
          index < 4 ? 550 : 790, 55, 55);
        unit.setArenaPosition(point.x, point.y);
      });
      const definitions = EVERBRIGHT_CLERIC_EFFECTS.slice(group * 4, group * 4 + 4);
      for (const [index, definition] of definitions.entries()) {
        const target = scene.partyUnits[index];
        const ability = { ...kit[definition.abilityId], vfxPhase: definition.vfxPhase };
        const kind = definition.everbrightStatus;
        if (kind === 'periodic') target.status.replacementPeriodic = [{ ability, until: scene.time.now + 6000 }];
        else if (kind) target.status.replacementEffects = [{ key: ability.id
          + (kind.startsWith('secondary-') ? ':secondary:' + kind.slice(10) : ':' + kind), until: scene.time.now + 6000 }];
        if (definition.ward) Object.assign(target.status, { temporaryHp: 50,
          temporaryHpUntil: scene.time.now + 6000, sunlitWardVisualUntil: scene.time.now + 6000 });
        effects.createAbilityEffect(scene, scene.partyUnits[4], target, ability, [target]);
        const point = scene.battlefield.arenaToScreen(target.arenaX, target.arenaY);
        scene.everbrightReviewLabels.push(scene.add.text(point.x, point.y + 45, definition.abilityName
          + (definition.vfxPhase ? '\n' + definition.vfxPhase : ''),
          { fontSize: '25px', color: '#ffffff', backgroundColor: '#302819' }).setOrigin(0.5).setDepth(5000));
      }
      scene.combatPaused = false;
      effects.updateAbilityEffects(scene, 600);
      scene.combatPaused = true;
      const frames = scene.abilityEffects.map(effect => effect.pieces[0].image.frame.name);
      effects.updateAbilityEffects(scene, 1000);
      return { count: scene.abilityEffects.length,
        ready: scene.abilityEffects.every(effect => effect.pieces.every(piece => piece.image.visible && scene.textures.get(piece.clip.key).has(31))),
        paused: scene.abilityEffects.every((effect, index) => effect.pieces[0].image.frame.name === frames[index]) };
    }, group);
    expect(result).toEqual({ count: group === 3 ? 3 : 4, ready: true, paused: true });
    await page.screenshot({ path: `output/qa/everbright-cleric/battle-${group}.png` });
  }
  const flight = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    const travel = await import('/combat/TravelingEffects.js');
    const { replacementAbilities } = await import('/data/replacementAbilities.js');
    effects.clearAbilityEffects(scene);
    scene.everbrightReviewLabels.forEach(label => label.destroy());
    for (const unit of [...scene.partyUnits, ...scene.enemies]) {
      unit.status.replacementEffects = [];
      unit.status.replacementPeriodic = [];
      unit.status.sunlitWardVisualUntil = 0;
    }
    const kit = replacementAbilities('Cleric of the Everbright');
    const target = scene.enemies.find(unit => !unit.landing);
    target.setArenaPosition(1400, 350);
    for (const [index, suffix] of ['radiant_bolt', 'judgement_ray'].entries()) {
      const caster = scene.partyUnits[index];
      caster.setArenaPosition(400, 300 + index * 100);
      caster.pendingAction = { startAt: scene.time.now, duration: 300 };
      effects.createAbilityTelegraph(scene, caster, target, kit['ability_v2_everbright_cleric_' + suffix], caster.pendingAction);
    }
    scene.combatPaused = false;
    travel.updateTravelingEffects(scene, 150);
    scene.combatPaused = true;
    const [bolt, ray] = scene.travelingEffects;
    return { count: scene.travelingEffects.length, boltMoved: bolt.image.x !== bolt.from.x,
      rayConnected: ray.image.x === ray.from.x && ray.image.y === ray.from.y,
      rayHalf: ray.image.cropWidth === 81 || ray.image._crop.width === 81 };
  });
  expect(flight).toEqual({ count: 2, boltMoved: true, rayConnected: true, rayHalf: true });
  await page.screenshot({ path: 'output/qa/everbright-cleric/flights.png' });
  const fade = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const travel = await import('/combat/TravelingEffects.js');
    const flights = [...scene.travelingEffects];
    flights.forEach(effect => { effect.caster.pendingAction = null; });
    scene.combatPaused = false;
    travel.updateTravelingEffects(scene, 200);
    scene.combatPaused = true;
    const half = flights.every(effect => effect.image.active && effect.image.alpha === 0.5);
    travel.updateTravelingEffects(scene, 1000);
    const frozen = flights.every(effect => effect.image.alpha === 0.5);
    scene.combatPaused = false;
    travel.updateTravelingEffects(scene, 200);
    scene.combatPaused = true;
    return { half, frozen, cleared: flights.every(effect => !effect.image.active) };
  });
  expect(fade).toEqual({ half: true, frozen: true, cleared: true });
  expect(errors).toEqual([]);
});
