import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Stage real characters with four sphere styles and two nearby protection badges.
// These checks measure actual Phaser drawings rather than only catalog metadata.
test('Shield spheres enclose their owners and fade with paused combat', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.enemies?.some(unit => !unit.landing) && !scene.waveTransitioning;
  });
  await mkdir('output/qa/shield-spheres', { recursive: true });
  const result = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');

    // Browser scheduling can start idle catch-up while large sprite sheets load.
    // This staged live-view check takes ownership of cosmetic playback afterward.
    scene.idleSimulating = false;
    if (scene.game.backgroundProgress) scene.game.backgroundProgress.isReplaying = false;
    scene.combatPaused = true;
    scene.time.paused = true;
    effects.clearAbilityEffects(scene);
    for (const unit of [...scene.partyUnits, ...scene.enemies]) unit.status = {};
    const [ward, vigilance, iron, readiness, ally] = scene.partyUnits;
    [ward, vigilance, iron, readiness, ally].forEach((unit, index) => unit.setArenaPosition(210 + index * 150, 280));
    const until = scene.time.now + 6000;
    ward.status = { temporaryHp: 50, sunlitWardVisualUntil: until };
    vigilance.status = { replacementReactions: [{ ability: { id: 'ability_v2_oathwarden_vigilance' }, until }] };
    iron.status = { replacementEffects: [{ key: 'ability_v2_gladiator_iron_guard:beneficial', until }] };
    readiness.status = { replacementFreeItem: { until } };
    iron.status.replacementEffects.push({ key: 'ability_v2_generic_physical_hold_the_line:beneficial', until });
    ally.status.replacementIntercept = { ownerId: iron.id, until };
    effects.updateAbilityEffects(scene, 0);
    const spheres = scene.abilityEffects.filter(effect => effect.definition.surroundTarget);
    const ready = scene.prepareAbilityEffects.find(effect => effect.sheet.sphere);
    const badges = scene.physicalAbilityEffects.filter(effect => !effect.brief);
    const enclosed = spheres.every(effect => {
      const bounds = effects.visibleUnitBounds(scene, effect.target);
      const radius = 38 * effect.scaleX;
      return effect.scaleX === effect.scaleY
        && Math.hypot((bounds.right - bounds.left) / 2, (bounds.bottom - bounds.top) / 2) < radius;
    });
    const layers = spheres.every(effect => effect.pieces.length === 2
      && effect.pieces[0].image.depth < effect.target.container.depth
      && effect.pieces[1].image.depth > effect.target.container.depth);
    const owned = badges.every(effect => {
      const bounds = effects.visibleUnitBounds(scene, effect.target);
      return effect.image.x >= bounds.left && effect.image.x <= bounds.right
        && effect.image.y >= bounds.top && effect.image.y <= bounds.bottom;
    });
    const bubble = spheres.find(effect => effect.target === ward);
    const oldX = bubble.origin.x;
    ward.setArenaPosition(ward.arenaX + 35, ward.arenaY);
    effects.updateAbilityEffects(scene, 0);
    const follows = bubble.origin.x !== oldX;
    ward.status.temporaryHp = 0;
    effects.updateAbilityEffects(scene, 0);
    effects.updateAbilityEffects(scene, 1000);
    const paused = bubble.fadeElapsed === 0;
    scene.combatPaused = false;
    effects.updateAbilityEffects(scene, 200);
    const fading = bubble.pieces.every(piece => piece.image.active && piece.image.alpha === 0.5);
    effects.updateAbilityEffects(scene, 200);
    const removed = bubble.pieces.every(piece => !piece.image.active);

    // Restore the ward for the comparison image; pause keeps this frame inspectable.
    ward.status.temporaryHp = 50;
    effects.updateAbilityEffects(scene, 0);
    scene.combatPaused = true;
    return { sphereCount: spheres.length, enclosed, layers, owned, follows, paused, fading, removed,
      readinessLayers: Boolean(ready.rearImage?.active && ready.image.active) };
  });
  expect(result).toEqual({ sphereCount: 3, enclosed: true, layers: true, owned: true, follows: true,
    paused: true, fading: true, removed: true, readinessLayers: true });
  await page.screenshot({ path: `output/qa/shield-spheres/battle-${page.viewportSize().width}.png` });
  expect(errors).toEqual([]);
});
