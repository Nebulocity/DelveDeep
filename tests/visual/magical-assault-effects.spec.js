import { test, expect } from '@playwright/test';

// Review the finished sheets against real combat sprites at the configured viewport.
test('Magical Assault effects stay readable and fade with combat', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.enemies?.some(unit => !unit.landing) && !scene.waveTransitioning;
  });
  const result = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    const { MAGICAL_ASSAULT_EFFECTS } = await import('/data/magicalAssaultEffects.js');
    scene.combatPaused = true;
    scene.time.paused = true;
    effects.clearAbilityEffects(scene);
    const caster = scene.partyUnits[0];
    const targets = [...scene.getLivingEnemies(), ...scene.partyUnits];
    for (let index = 0; index < MAGICAL_ASSAULT_EFFECTS.length; index++) {
      const definition = MAGICAL_ASSAULT_EFFECTS[index];
      const target = targets[index];
      const ability = { id: definition.abilityId, name: definition.abilityName, replacement: true,
        anchor: 'Target', shape: definition.abilityName === 'Vengeance' ? 'Circle' : 'None', radius: 200 };
      if (definition.persistentStatus) target.status.replacementEffects = [
        { key: `${ability.id}:secondary:harmful`, until: scene.time.now + 6000 }
      ];
      effects.createAbilityEffect(scene, caster, target, ability);
    }
    scene.combatPaused = false;
    effects.updateAbilityEffects(scene, 300);
    scene.combatPaused = true;
    const brand = scene.abilityEffects.find(effect => effect.definition.abilityName === 'Brand');
    const image = brand.pieces[0].image;
    const x = image.x;
    brand.target.setArenaPosition(brand.target.arenaX + 70, brand.target.arenaY);
    effects.updateAbilityEffects(scene, 0);
    const follows = image.x !== x;
    brand.target.status.replacementEffects = [];
    effects.updateAbilityEffects(scene, 0);
    scene.combatPaused = false;
    effects.updateAbilityEffects(scene, 200);
    scene.combatPaused = true;
    const alpha = image.alpha;
    effects.updateAbilityEffects(scene, 1000);
    return { count: scene.abilityEffects.length, follows, fading: alpha > 0 && alpha < 0.9,
      paused: image.alpha === alpha };
  });
  expect(result).toEqual({ count: 4, follows: true, fading: true, paused: true });
  await page.screenshot({ path: `output/qa/magical-assault/battle-${page.viewportSize().width}.png` });
  await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    effects.updateAbilityEffects(scene, 0, true);
    if (scene.abilityEffects.length) throw new Error('Replay retained artwork');
  });
  expect(errors).toEqual([]);
});
