import { test, expect } from '@playwright/test';

// Inspect the exported sheets on actual Phaser silhouettes at landscape phone size.
test('Umbral artwork, growing connections and fades at phone size', async ({ page }) => {
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
      const { UMBRAL_MAGE_EFFECTS } = await import('/data/umbralMageEffects.js');
      const { replacementAbilities } = await import('/data/replacementAbilities.js');
      const kit = replacementAbilities('Mage of the Umbral Veil');
      scene.combatPaused = true;
      scene.time.paused = true;
      effects.clearAbilityEffects(scene);
      scene.umbralReviewLabels?.forEach(label => label.destroy());
      scene.umbralReviewLabels = [];
      scene.abilityDecoys.forEach(decoy => decoy.container.destroy());
      scene.abilityDecoys = [];
      for (const unit of [...scene.partyUnits, ...scene.enemies]) {
        unit.status = {};
        unit.pendingAction = null;
      }
      scene.battleEvents = [];
      scene.partyUnits.forEach((unit, index) => unit.setArenaPosition(400 + index * 285, 550));
      const definitions = UMBRAL_MAGE_EFFECTS.slice(group * 4, group * 4 + 4);
      for (const [index, definition] of definitions.entries()) {
        let target = scene.partyUnits[index];
        const ability = { ...kit[definition.abilityId], vfxPhase: definition.vfxPhase };
        const record = { ability, until: scene.time.now + 6000, wave: scene.currentWaveIndex,
          point: { arenaX: target.arenaX, arenaY: target.arenaY } };
        const kind = definition.umbralStatus;
        if (kind === 'channel') target.status.replacementChannel = record;
        if (kind === 'preparation') target.status.replacementPreparations = [record];
        if (kind === 'reaction') target.status.replacementReactions = [record];
        if (kind === 'zone') target.status.replacementZones = [record];
        if (kind === 'decoy') {
          const owner = scene.partyUnits[4];
          target = scene.createAbilityDecoy(owner, { ...target, className: 'Mage of the Umbral Veil' },
            { x: target.arenaX, y: target.arenaY }, 50, record.until);
        }
        effects.createAbilityEffect(scene, definition.targetCaster || definition.groundZone ? target : scene.partyUnits[4],
          target, ability, [target]);
        const point = scene.battlefield.arenaToScreen(target.arenaX, target.arenaY);
        scene.umbralReviewLabels.push(scene.add.text(point.x, point.y + 45, definition.abilityName
          + (definition.vfxPhase ? '\n' + definition.vfxPhase : ''),
          { fontSize: '25px', color: '#ffffff', backgroundColor: '#292333' }).setOrigin(0.5).setDepth(5000));
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
    expect(result).toEqual({ count: 4, ready: true, paused: true });
    await page.screenshot({ path: `output/qa/umbral-mage/battle-${group}.png` });
  }
  const flight = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    const travel = await import('/combat/TravelingEffects.js');
    const { replacementAbilities } = await import('/data/replacementAbilities.js');
    effects.clearAbilityEffects(scene);
    scene.umbralReviewLabels.forEach(label => label.destroy());
    for (const unit of [...scene.partyUnits, ...scene.enemies]) unit.status = {};
    const target = scene.enemies.find(unit => !unit.landing);
    target.setArenaPosition(1450, 350);
    const kit = replacementAbilities('Mage of the Umbral Veil');
    for (const [index, suffix] of ['shadow_bolt', 'siphon', 'essence_drain'].entries()) {
      const caster = scene.partyUnits[index];
      caster.setArenaPosition(400, 300 + index * 160);
      caster.pendingAction = { startAt: scene.time.now, duration: 300 };
      effects.createAbilityTelegraph(scene, caster, target, kit['ability_v2_umbral_mage_' + suffix], caster.pendingAction);
    }
    scene.combatPaused = false;
    travel.updateTravelingEffects(scene, 150);
    scene.combatPaused = true;
    const [bolt, ...tethers] = scene.travelingEffects;
    return { count: scene.travelingEffects.length, moved: bolt.image.x !== bolt.from.x,
      connected: tethers.every(effect => effect.image.x === effect.from.x && effect.image.y === effect.from.y),
      half: tethers.every(effect => effect.image._crop.width === 80) };
  });
  expect(flight).toEqual({ count: 3, moved: true, connected: true, half: true });
  await page.screenshot({ path: 'output/qa/umbral-mage/flights.png' });
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
