import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Review the real sheets on a battlefield at desktop and phone landscape sizes.
// Combat stays paused between deliberately chosen frames so captures are repeatable.
test('Magical protection is readable, follows targets and fades with combat', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return s?.sys.isActive() && s.enemies?.some(e => !e.landing) && !s.waveTransitioning;
  });
  await mkdir('output/qa/magical-protection', { recursive: true });
  for (const name of ['Hex', 'Nullify', 'Spellbind', 'Spellward']) {
    const result = await page.evaluate(async name => {
      const effects = await import('/combat/AbilityEffect.js');
      const { MAGICAL_PROTECTION_EFFECTS } = await import('/data/magicalProtectionEffects.js');
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      s.combatPaused = true;
      s.time.paused = true;
      for (const unit of [...s.partyUnits, ...s.enemies]) {
        unit.status.huntersMarkVisual = false;
        unit.status.sunlitWardVisualUntil = 0;
        unit.status.spellLockUntil = 0;
        unit.status.replacementEffects = [];
      }
      effects.clearAbilityEffects(s);
      const definition = MAGICAL_PROTECTION_EFFECTS.find(effect => effect.abilityName === name);
      const caster = s.partyUnits[0];
      const target = name === 'Spellward'
        ? s.partyUnits.find(unit => unit.className === 'Dawnwarden') ?? s.partyUnits[1]
        : s.getLivingEnemies()[0];

      // Keep the monster clear of the spawn crowd so its effect and silhouette
      // can be judged together at the actual phone display scale.
      if (target.isEnemy) target.setArenaPosition(700, 250);
      if (name === 'Hex') target.status.replacementEffects = [{ key: `${definition.abilityId}:harmful`, until: s.time.now + 6000 }];
      if (name === 'Spellbind') target.status.spellLockUntil = s.time.now + 2000;
      const started = effects.createAbilityEffect(s, caster, target, { id: definition.abilityId, name, replacement: true });
      const effect = s.abilityEffects[0];
      if (!effect) return { started };
      effects.updateAbilityEffects(s, 1000);
      const frozen = effect.elapsed === 0;
      s.combatPaused = false;
      effects.updateAbilityEffects(s, 650);
      s.combatPaused = true;
      return { started, frozen, frames: effect.definition.frames,
        visible: effect.pieces.every(piece => piece.image.visible), scale: effect.scale,
        wrapped: name !== 'Spellward' || effect.pieces[0].image.depth < target.container.depth
          && effect.pieces[1].image.depth > target.container.depth
          && effect.pieces[0].image._crop.height === effect.pieces[1].image._crop.y };
    }, name);
    expect(result.started).toBe(true);
    expect(result.frozen).toBe(true);
    expect(result.frames).toBe(32);
    expect(result.visible).toBe(true);
    expect(result.wrapped).toBe(true);
    await page.screenshot({ path: `output/qa/magical-protection/${name.toLowerCase()}-${page.viewportSize().width}.png` });
    const fade = await page.evaluate(async () => {
      const { updateAbilityEffects, clearAbilityEffects } = await import('/combat/AbilityEffect.js');
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      const effect = s.abilityEffects[0];
      const x = effect.origin.x;
      effect.target.setArenaPosition(effect.target.arenaX + 20, effect.target.arenaY);
      updateAbilityEffects(s, 0);
      const followed = effect.origin.x !== x;
      s.combatPaused = false;
      if (effect.definition.persistentStatus) {
        effect.target.status.spellLockUntil = 0;
        effect.target.status.replacementEffects = [];
        updateAbilityEffects(s, 0);
      } else updateAbilityEffects(s, 550);
      updateAbilityEffects(s, 200);
      const half = effect.pieces[0].image.alpha;
      s.combatPaused = true;
      updateAbilityEffects(s, 1000);
      const paused = half === effect.pieces[0].image.alpha;
      s.combatPaused = false;
      updateAbilityEffects(s, 200);
      const removed = !s.abilityEffects.includes(effect) && effect.pieces.every(piece => !piece.image.active);
      s.combatPaused = true;
      clearAbilityEffects(s);
      return { followed, half, paused, removed };
    });
    expect(fade.followed).toBe(true);
    expect(fade.half).toBeCloseTo(0.425);
    expect(fade.paused).toBe(true);
    expect(fade.removed).toBe(true);
  }
  expect(errors).toEqual([]);
});
