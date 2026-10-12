import { test, expect } from '@playwright/test';

// Check actual Phaser images and sprite bounds at desktop and phone sizes.
test('Prepare effects restore, follow, pause and fade', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return s?.sys.isActive() && s.enemies?.some(unit => !unit.landing) && !s.waveTransitioning;
  });
  const result = await page.evaluate(async () => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    const prepare = await import('/combat/PrepareAbilityEffects.js');
    s.combatPaused = true;
    s.time.paused = true;
    effects.clearAbilityEffects(s);

    // Clear naturally cast statuses before staging the four requested effects.
    for (const unit of [...s.partyUnits, ...s.enemies]) unit.status = {};
    const [mage, warrior] = s.partyUnits;
    const gladiator = s.partyUnits.find(unit => unit.className === 'Gladiator');
    mage.setArenaPosition(300, 245);
    warrior.setArenaPosition(560, 245);
    for (const sheet of prepare.PREPARE_EFFECT_SHEETS) {
      const unit = sheet.name === 'arcane-focus' || sheet.name === 'quick-casting' ? mage : warrior;
      if (sheet.name === 'combat-footwork') {
        unit.status.replacementEffects = [{ key: sheet.abilityId + ':beneficial', until: s.time.now + 6000 }];
      } else {
        (unit.status.replacementPreparations ??= []).push({ ability: { id: sheet.abilityId }, until: s.time.now + 8000 });
      }
    }
    const rally = prepare.GLADIATOR_PREPARE_EFFECT_SHEETS.find(sheet => sheet.name === 'rallying-cry');
    const reequip = prepare.GLADIATOR_PREPARE_EFFECT_SHEETS.find(sheet => sheet.name === 'reequip');
    const reset = prepare.GLADIATOR_PREPARE_EFFECT_SHEETS.find(sheet => sheet.name === 'tactical-reset');
    (gladiator.status.replacementPreparations ??= []).push({ ability: { id: rally.abilityId }, until: s.time.now + 8000 });
    warrior.status.replacementFreeItem = { until: s.time.now + 8000 };
    prepare.createPrepareAbilityEffect(s, gladiator, { id: reequip.abilityId });
    prepare.createPrepareAbilityEffect(s, warrior, { id: reset.abilityId });
    effects.updateAbilityEffects(s, 0);
    const count = s.prepareAbilityEffects.length;
    const focus = s.prepareAbilityEffects.find(effect => effect.sheet.name === 'arcane-focus');
    const quick = s.prepareAbilityEffects.find(effect => effect.sheet.name === 'quick-casting');
    const footwork = s.prepareAbilityEffects.find(effect => effect.sheet.name === 'combat-footwork');
    const separate = focus.image.y !== quick.image.y;
    const x = focus.image.x;
    mage.setArenaPosition(mage.arenaX + 60, mage.arenaY);
    effects.updateAbilityEffects(s, 0);
    const follows = focus.image.x !== x;
    mage.status.replacementPreparations = [];
    const frame = focus.image.frame.name;
    effects.updateAbilityEffects(s, 200);
    const paused = focus.fadeElapsed === 0 && focus.image.frame.name === frame;
    s.combatPaused = false;
    effects.updateAbilityEffects(s, 200);
    const fading = focus.image.active && focus.image.alpha > 0 && focus.image.alpha < 0.5;
    const footworkHeld = footwork.fadeElapsed === null;

    // Restore full opacity for the screenshot after verifying consumption fades.
    mage.status.replacementPreparations = [focus, quick].map(effect => ({ ability: { id: effect.sheet.abilityId }, until: s.time.now + 8000 }));
    effects.updateAbilityEffects(s, 0);
    s.combatPaused = true;
    return { count, separate, follows, paused, fading, footworkHeld,
      textures: [...prepare.PREPARE_EFFECT_SHEETS, ...prepare.GLADIATOR_PREPARE_EFFECT_SHEETS]
        .every(sheet => s.textures.get(sheet.key).has(31)) };
  });
  expect(result).toEqual({ count: 8, separate: true, follows: true, paused: true, fading: true, footworkHeld: true, textures: true });
  await page.screenshot({ path: `output/qa/gladiator-prepare/battle-${page.viewportSize().width}.png` });
  await page.evaluate(async () => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    const images = s.prepareAbilityEffects.map(effect => effect.image);
    effects.updateAbilityEffects(s, 0, true);
    if (images.some(image => image.active) || s.prepareAbilityEffects.length) throw new Error('Replay left Prepare art behind');
  });
  expect(errors).toEqual([]);
});
