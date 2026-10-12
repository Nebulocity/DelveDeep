import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Preview reserved physical skills as artwork without changing class permissions.
// Active magical effects use the same saved records as ordinary combat playback.
test('Generic Restore sheets fit the battlefield and fade on combat time', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.enemies?.some(enemy => !enemy.landing) && !scene.waveTransitioning;
  });

  // Freeze live combat before loading review modules. A slow desktop capture must
  // not let enemies finish the battle while the test is preparing its artwork.
  await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    scene.combatPaused = true;
    scene.time.paused = true;
    scene.sys.pause();
  });
  await mkdir('output/qa/generic-restore', { recursive: true });
  for (const name of ['Life Anchor', 'Rejuvenation Aura', 'First Aid', 'Second Wind']) {
    const result = await page.evaluate(async name => {
      const effects = await import('/combat/AbilityEffect.js');
      const { GENERIC_RESTORE_EFFECTS } = await import('/data/genericRestoreEffects.js');
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      scene.combatPaused = true;
      scene.time.paused = true;
      for (const unit of [...scene.partyUnits, ...scene.enemies]) {
        unit.status.replacementReactions = [];
        unit.status.replacementZones = [];
        unit.status.replacementPeriodic = [];
      }
      effects.clearAbilityEffects(scene);
      const definition = GENERIC_RESTORE_EFFECTS.find(effect => effect.abilityName === name);
      const caster = scene.partyUnits[0];
      const target = definition.floorAura || name === 'Second Wind' ? caster : scene.partyUnits[1];
      const ability = { id: definition.abilityId, name, replacement: true, radius: 240,
        anchor: definition.floorAura ? 'Caster' : 'None', shape: definition.floorAura ? 'Circle' : 'None' };
      const property = definition.restoreStatus === 'reaction' ? 'replacementReactions'
        : definition.restoreStatus === 'zone' ? 'replacementZones' : 'replacementPeriodic';
      if (definition.persistentStatus) target.status[property] = [{ ability, until: scene.time.now + 6000, wave: scene.currentWaveIndex }];
      const started = effects.createAbilityEffect(scene, caster, target, ability);
      const effect = scene.abilityEffects.find(effect => effect.definition === definition);
      if (!effect) return { started, found: false };
      effects.updateAbilityEffects(scene, 1000);
      const frozen = effect.elapsed === 0;
      scene.combatPaused = false;
      effects.updateAbilityEffects(scene, 650);
      scene.combatPaused = true;
      window.__restorePreviewEffect = effect;
      return { started, found: true, frozen, frame: effect.pieces[0].image.frame.name,
        visible: effect.pieces[0].image.visible, finite: Number.isFinite(effect.origin.x),
        width: effect.scaleX * 78, radius: scene.battlefield.getGroundEllipseRadii(240, target.arenaY).width * 2 };
    }, name);
    expect(result.started).toBe(true);
    expect(result.found).toBe(true);
    expect(result.frozen).toBe(true);
    expect(result.visible).toBe(true);
    expect(result.finite).toBe(true);
    if (name === 'Rejuvenation Aura') expect(result.width).toBeCloseTo(result.radius);
    await page.screenshot({ path: `output/qa/generic-restore/${name.toLowerCase().replaceAll(' ', '-')}-${page.viewportSize().width}.png` });
    const fade = await page.evaluate(async () => {
      const { updateAbilityEffects, clearAbilityEffects } = await import('/combat/AbilityEffect.js');
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      const effect = window.__restorePreviewEffect;
      scene.combatPaused = false;
      if (effect.definition.persistentStatus) {
        effect.target.status.replacementReactions = [];
        effect.target.status.replacementZones = [];
        effect.target.status.replacementPeriodic = [];
        updateAbilityEffects(scene, 0);
      } else updateAbilityEffects(scene, 550);
      updateAbilityEffects(scene, 200);
      const half = effect.pieces[0].image.alpha;
      scene.combatPaused = true;
      updateAbilityEffects(scene, 1000);
      const frozen = half === effect.pieces[0].image.alpha;
      scene.combatPaused = false;
      updateAbilityEffects(scene, 200);
      const removed = !effect.pieces[0].image.active;
      scene.combatPaused = true;
      clearAbilityEffects(scene);
      return { half, frozen, removed };
    });
    expect(fade.half).toBeCloseTo(0.4);
    expect(fade.frozen).toBe(true);
    expect(fade.removed).toBe(true);
  }
  expect(errors).toEqual([]);
});
