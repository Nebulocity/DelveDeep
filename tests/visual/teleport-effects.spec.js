import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Cast the five actual abilities on the real phone-sized battlefield, rather than
// testing a separate canvas approximation of their scale, layers or callbacks.
test('Teleport PixelLab layers preserve immediate combat at phone size', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const ids = ['valtheris', 'nadira', 'alhanna', 'garrick', 'sylva'];
    qa.state.roster.sort((a, b) => {
      const rank = unit => ids.includes(unit.id) ? ids.indexOf(unit.id) : 100;
      return rank(a) - rank(b);
    });
    qa.activate('BattleScene');
  });
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.enemies?.some(enemy => !enemy.landing) && !scene.waveTransitioning;
  });
  await mkdir('output/qa/teleport', { recursive: true });
  for (const name of ['Semistatic Pulse', 'Crimson Cascade', 'Lightweaving', 'Neutral Ground', 'Garnet Spring']) {
    const result = await page.evaluate(async name => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      const art = await import('/combat/TeleportEffects.js');
      const { clearAbilityEffects } = await import('/combat/AbilityEffect.js');
      const { replacementAbilities } = await import('/data/replacementAbilities.js');
      scene.combatPaused = true;
      scene.time.paused = true;
      art.clearTeleportEffects(scene);
      clearAbilityEffects(scene);
      scene.abilityDecoys.forEach(decoy => decoy.container.destroy());
      scene.abilityDecoys = [];
      scene.heldUnitIds.clear();
      scene.attackTargets.clear();
      for (const [index, unit] of [...scene.partyUnits, ...scene.enemies].entries()) {
        unit.status = {};
        unit.finishAction();
        unit.criticalKnockback = null;
        unit.critChance = 0;
        unit.maxHp = unit.hp = 100000;
        unit.setArenaPosition(450 + index % 5 * 240, index < 5 ? 540 : 260);
      }
      const className = name === 'Lightweaving' ? 'Mage of the Luminous Archive'
        : name === 'Garnet Spring' ? 'Runedancer' : 'Mage of the Crimson Spire';
      const casterId = name === 'Lightweaving' ? 'nadira' : name === 'Garnet Spring' ? 'alhanna' : 'valtheris';
      const caster = scene.partyUnits.find(unit => unit.id === casterId);
      const ability = Object.values(replacementAbilities(className)).find(a => a.name === name);
      const ally = scene.partyUnits.find(unit => unit.id === 'garrick');
      const enemy = scene.getLivingEnemies()[0];
      enemy.setArenaPosition(caster.arenaX + 90, caster.arenaY);
      const target = name === 'Lightweaving' ? ally : name === 'Semistatic Pulse' || name === 'Neutral Ground' ? caster : enemy;
      scene.classAbilitySystem.replacement.resolve(caster, target, ability, scene.time.now);
      const count = scene.teleportEffects?.length ?? 0;

      // Advance just the cosmetic records while keeping gameplay paused and unchanged.
      for (const effect of scene.teleportEffects ?? []) effect.startedAt = scene.time.now - 650;
      art.updateTeleportEffects(scene);
      const frames = () => scene.teleportEffects.flatMap(effect => [...effect.images.values()]
        .filter(image => image.visible).map(image => [image.texture.key, image.frame.name, image.alpha]));
      const before = JSON.stringify(frames());
      art.updateTeleportEffects(scene);
      const outcome = { count, visible: frames().length,
        paused: before === JSON.stringify(frames()),
        available: (scene.teleportEffects ?? []).every(effect => effect.unit.alive && effect.unit.container.visible
          && effect.unit.spriteVisual.image.alpha > 0 && !effect.unit.status.teleportTransit),
        layers: [...new Set(frames().map(frame => frame[0]))] };
      window.__TELEPORT_REVIEW__ = { art, scene };
      return outcome;
    }, name);
    expect(result.count).toBeGreaterThan(0);
    expect(result.visible).toBeGreaterThan(2);
    expect(result.paused).toBe(true);
    expect(result.available).toBe(true);
    expect(result.layers.some(key => key.startsWith('teleport-'))).toBe(true);
    await page.screenshot({ path: `output/qa/teleport/${name.toLowerCase().replaceAll(' ', '-')}.png` });
  }
  const cleanup = await page.evaluate(() => {
    const { art, scene } = window.__TELEPORT_REVIEW__;
    const images = scene.teleportEffects.flatMap(effect => [...effect.images.values()]);
    art.updateTeleportEffects(scene, true);
    return scene.teleportEffects.length === 0 && images.every(image => !image.active);
  });
  expect(cleanup).toBe(true);
  expect(errors).toEqual([]);
});
