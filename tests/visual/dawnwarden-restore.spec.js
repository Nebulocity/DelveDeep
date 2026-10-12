import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Exercise actual resolved Restore abilities against battlefield sprites, then
// inspect their paused frames and final combat-time fade at phone landscape size.
test('Dawnwarden Restore plays and fades all four sheets', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.enemies?.some(enemy => !enemy.landing) && !scene.waveTransitioning;
  });
  await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    scene.combatPaused = true;
    scene.time.paused = true;
    scene.sys.pause();
  });
  await mkdir('output/qa/dawnwarden-restore', { recursive: true });
  for (const name of ['Renewing Light', 'Devotion', 'Cleansing Radiance', "Dawn's Guidance"]) {
    const result = await page.evaluate(async name => {
      const effects = await import('/combat/AbilityEffect.js');
      const { replacementAbilities } = await import('/data/replacementAbilities.js');
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      effects.clearAbilityEffects(scene);
      const caster = scene.partyUnits[0];
      const ability = Object.values(replacementAbilities('Dawnwarden')).find(ability => ability.name === name);
      const target = name === "Dawn's Guidance" ? scene.partyUnits[1] : caster;
      caster.mana = Math.min(caster.mana, caster.maxMana / 2);
      target.hp = target.maxHp / 2;
      scene.classAbilitySystem.replacement.resolve(caster, target, ability, scene.time.now);
      const effect = scene.abilityEffects.find(effect => effect.definition.abilityId === ability.id);
      if (!effect) return { found: false };
      effects.updateAbilityEffects(scene, 1000);
      const paused = effect.elapsed === 0;
      scene.combatPaused = false;
      effects.updateAbilityEffects(scene, 650);
      scene.combatPaused = true;
      window.__dawnRestorePreview = effect;
      return { found: true, paused, recipient: effect.target === target,
        visible: effect.pieces[0].image.visible, frame: effect.pieces[0].image.frame.name };
    }, name);
    expect(result).toEqual({ found: true, paused: true, recipient: true, visible: true, frame: 13 });
    await page.screenshot({ path: `output/qa/dawnwarden-restore/${name.replaceAll(/[^a-zA-Z]+/g, '-').toLowerCase()}.png` });
    const fade = await page.evaluate(async () => {
      const { updateAbilityEffects } = await import('/combat/AbilityEffect.js');
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      const effect = window.__dawnRestorePreview;
      scene.combatPaused = false;
      updateAbilityEffects(scene, 750);
      const alpha = effect.pieces[0].image.alpha;
      const frame = effect.pieces[0].image.frame.name;
      scene.combatPaused = true;
      updateAbilityEffects(scene, 1000);
      const frozen = effect.pieces[0].image.alpha === alpha && effect.pieces[0].image.frame.name === frame;
      scene.combatPaused = false;
      updateAbilityEffects(scene, 200);
      scene.combatPaused = true;
      return { fraction: alpha / effect.definition.opacity, frozen, removed: !effect.pieces[0].image.active };
    });
    expect(fade).toEqual({ fraction: 0.5, frozen: true, removed: true });
  }
  expect(errors).toEqual([]);
});
