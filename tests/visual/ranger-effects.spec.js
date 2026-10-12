import { test, expect } from '@playwright/test';

// Render each pack on real character silhouettes, then inspect all five shot paths.
test('Ranger effects render, travel and fade on a landscape battlefield', async ({ page }) => {
  test.setTimeout(150000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(async () => {
    const { default: state } = await import('/game/GameState.js');
    const ranger = state.roster.find(unit => unit.className === 'Ranger');
    if (ranger) state.roster = [ranger, ...state.roster.filter(unit => unit !== ranger)];
    window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene');
  });
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.enemies?.some(unit => !unit.landing) && !scene.waveTransitioning;
  });
  for (let group = 0; group < 4; group++) {
    const result = await page.evaluate(async group => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      const effects = await import('/combat/AbilityEffect.js');
      const { RANGER_ABILITY_EFFECTS } = await import('/data/rangerAbilityEffects.js');
      const { replacementAbilities } = await import('/data/replacementAbilities.js');
      const kit = replacementAbilities('Ranger');
      scene.combatPaused = true;
      scene.time.paused = true;
      effects.clearAbilityEffects(scene);
      scene.rangerReviewLabels?.forEach(label => label.destroy());
      scene.rangerReviewLabels = [];
      for (const unit of [...scene.partyUnits, ...scene.enemies]) {
        unit.status.replacementEffects = [];
        unit.status.replacementPreparations = [];
        unit.status.replacementPeriodic = [];
        unit.status.replacementZones = [];
        unit.status.huntersMarkVisual = false;
        unit.status.rootedUntil = 0;
      }
      scene.partyUnits.forEach((unit, index) => {
        const point = scene.battlefield.clampPoint(index < 4 ? 400 + index * 325 : 900,
          index < 4 ? 550 : 790, 55, 55);
        unit.setArenaPosition(point.x, point.y);
      });
      const definitions = RANGER_ABILITY_EFFECTS.slice(group * 4, group * 4 + 4);
      for (let index = 0; index < definitions.length; index++) {
        const definition = definitions[index];
        const target = scene.partyUnits[index];
        const caster = definition.targetCaster || definition.groundZone ? target : scene.partyUnits[4];
        const ability = { ...kit[definition.abilityId], vfxPhase: definition.vfxPhase };
        const record = { ability, until: scene.time.now + 6000, wave: scene.currentWaveIndex,
          point: { arenaX: target.arenaX, arenaY: target.arenaY } };
        const kind = definition.rangerStatus;
        if (['beneficial', 'harmful', 'secondary'].includes(kind)) target.status.replacementEffects = [{
          key: ability.id + (kind === 'secondary' ? ':secondary:harmful' : ':' + kind), until: record.until }];
        if (kind === 'root') target.status.rootedUntil = record.until;
        if (kind === 'zone') target.status.replacementZones = [record];
        if (kind === 'periodic') target.status.replacementPeriodic = [record];
        if (kind === 'preparation') target.status.replacementPreparations = [record];
        effects.createAbilityEffect(scene, caster, target, ability, [target]);
        const point = scene.battlefield.arenaToScreen(target.arenaX, target.arenaY);
        scene.rangerReviewLabels.push(scene.add.text(point.x, point.y + 45, definition.slug,
          { fontSize: '25px', color: '#ffffff', backgroundColor: '#15231a' }).setOrigin(0.5).setDepth(5000));
      }
      scene.combatPaused = false;
      effects.updateAbilityEffects(scene, 600);
      scene.combatPaused = true;
      const frames = scene.abilityEffects.map(effect => effect.pieces[0].image.frame.name);
      effects.updateAbilityEffects(scene, 1000);
      return { count: scene.abilityEffects.length,
        ready: scene.abilityEffects.every(effect => effect.pieces[0].image.visible
          && scene.textures.get(effect.pieces[0].clip.key).has(31)),
        paused: scene.abilityEffects.every((effect, index) => effect.pieces[0].image.frame.name === frames[index]) };
    }, group);
    expect(result).toEqual({ count: group === 3 ? 1 : 4, ready: true, paused: true });
    await page.screenshot({ path: `output/qa/ranger/battle-${group}-${page.viewportSize().width}.png` });
  }
  const result = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    const travel = await import('/combat/TravelingEffects.js');
    const { replacementAbilities } = await import('/data/replacementAbilities.js');
    effects.clearAbilityEffects(scene);
    scene.rangerReviewLabels.forEach(label => label.destroy());
    for (const unit of [...scene.partyUnits, ...scene.enemies]) {
      unit.status.replacementEffects = [];
      unit.status.replacementPeriodic = [];
      unit.status.replacementZones = [];
      unit.status.replacementPreparations = [];
      unit.status.rootedUntil = 0;
    }
    const names = ['Piercing Shot', 'Pinning Arrow', 'Crippling Shot', 'Exploding Arrow', 'Volley'];
    const kit = replacementAbilities('Ranger');
    const target = scene.enemies[0];
    target.setArenaPosition(1300, 250);
    names.forEach((name, index) => {
      const caster = scene.partyUnits[index];
      caster.setArenaPosition(300, 230 + index * 90);
      caster.pendingAction = { startAt: scene.time.now, duration: 300 };
      const ability = Object.values(kit).find(entry => entry.name === name);
      effects.createAbilityTelegraph(scene, caster, target, ability, caster.pendingAction);
    });
    scene.combatPaused = false;
    travel.updateTravelingEffects(scene, 150);
    scene.combatPaused = true;
    const flights = scene.travelingEffects;
    window.__RANGER_FLIGHTS__ = flights;
    const volley = flights.find(effect => effect.ability.name === 'Volley');
    return { count: flights.length, sheets: flights.every(effect => effect.image?.visible),
      fan: volley.volleyImages.length === 2 && volley.volleyImages.every(image => image.visible),
      arc: volley.pose.y < (volley.from.y + volley.to.y) / 2,
      doubledExplosive: scene.abilityEffects.some(effect => effect.definition.projectile) };
  });
  expect(result).toEqual({ count: 5, sheets: true, fan: true, arc: true, doubledExplosive: false });
  await page.screenshot({ path: `output/qa/ranger/flights-${page.viewportSize().width}.png` });
  const fade = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const travel = await import('/combat/TravelingEffects.js');
    const flights = window.__RANGER_FLIGHTS__;
    flights.forEach(effect => { effect.caster.pendingAction = null; });
    scene.combatPaused = false;
    travel.updateTravelingEffects(scene, 200);
    scene.combatPaused = true;
    const half = flights.every(effect => effect.image.active && effect.image.alpha === 0.5);
    travel.updateTravelingEffects(scene, 1000);
    const paused = flights.every(effect => effect.image.active && effect.image.alpha === 0.5);
    scene.combatPaused = false;
    travel.updateTravelingEffects(scene, 200);
    scene.combatPaused = true;
    return { half, paused, cleared: flights.every(effect => !effect.image.active
      && (effect.volleyImages ?? []).every(image => !image.active)) };
  });
  expect(fade).toEqual({ half: true, paused: true, cleared: true });

  // Exercise early-return support handlers too: Covering Fire has only a saved
  // preparation, and Field Dressing records resistance after its cleanse callback.
  const callbacks = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    const { replacementAbilities } = await import('/data/replacementAbilities.js');
    const kit = replacementAbilities('Ranger');
    const caster = scene.partyUnits[0], ally = scene.partyUnits[1], enemy = scene.enemies[0];
    const observed = [];
    for (const name of ['Camouflage', 'Farsight', 'Field Dressing', "Hunter's Mark", "Hunter's Trap", "Scout's Route", 'Covering Fire']) {
      effects.clearAbilityEffects(scene);
      for (const unit of [...scene.partyUnits, ...scene.enemies]) {
        unit.status.replacementEffects = [];
        unit.status.replacementZones = [];
        unit.status.replacementPeriodic = [];
        unit.status.replacementPreparations = [];
        unit.status.rootedUntil = 0;
      }
      const ability = Object.values(kit).find(entry => entry.name === name);
      const target = name === 'Field Dressing' ? ally
        : name === "Hunter's Mark" || name === "Hunter's Trap" ? enemy : caster;
      scene.classAbilitySystem.replacement.resolve(caster, target, ability, scene.time.now);
      effects.updateAbilityEffects(scene, 0);
      observed.push(scene.abilityEffects.some(effect => effect.definition.abilityId === ability.id));
      if (name === "Hunter's Trap") {
        scene.classAbilitySystem.replacement.tickZones(caster, scene.time.now);
        effects.updateAbilityEffects(scene, 0);
        observed.push(scene.abilityEffects.some(effect => effect.target === enemy
          && effect.definition.vfxPhase === 'poison'));
      }
    }
    return observed;
  });
  expect(callbacks).toEqual(Array(8).fill(true));
  expect(errors).toEqual([]);
});
