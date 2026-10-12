import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Review real Lasher artwork and the vine's growing front at phone and desktop sizes.
test('Thornbriar vine and impact sheets remain anchored and pause in combat', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'thornbriar-hollow' }));
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.partyUnits?.length === 5 && scene.enemies?.some(unit => !unit.landing);
  });
  const result = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const travel = await import('/combat/TravelingEffects.js');
    const thorn = await import('/combat/ThornbriarAbilityEffects.js');
    const { THORNBRIAR_ABILITY_EFFECTS } = await import('/data/thornbriarAbilityEffects.js');
    scene.combatPaused = true;
    scene.time.paused = true;
    scene.idleSimulating = false;
    if (scene.game.backgroundProgress) scene.game.backgroundProgress.isReplaying = false;
    travel.clearTravelingEffects(scene);
    thorn.clearThornbriarAbilityEffects(scene);
    const lasher = scene.enemies.find(unit => unit.enemyType === 'lasher')
      ?? scene.createEnemy('lasher', { x: 700, y: 250 }, 900);
    if (!scene.enemies.includes(lasher)) scene.enemies.push(lasher);
    const target = scene.partyUnits[1];
    lasher.setArenaPosition(700, 250);
    target.setArenaPosition(340, 250);
    const action = { startAt: scene.time.now, duration: 500 };
    lasher.pendingAction = action;
    travel.startTravelingEffect(scene, lasher, target, { name: 'Whip Lash' }, action);
    const whip = scene.travelingEffects[0];
    scene.combatPaused = false;
    travel.updateTravelingEffects(scene, 350);
    scene.combatPaused = true;
    const frame = whip.image.frame.name;
    const crop = whip.image._crop.width;
    travel.updateTravelingEffects(scene, 1000);
    const paused = whip.image.frame.name === frame && whip.image._crop.width === crop;
    const anchored = whip.image.x === whip.from.x && whip.image.y === whip.from.y;
    const textured = whip.sheet.name === 'thorn-whip' && !whip.graphics.visible;
    const partial = crop > 4 && crop < 156;
    thorn.startThornbriarAbilityEffect(scene, lasher, target, { name: 'Bramble Shroud' }, 'impact');
    const bramble = scene.thornbriarEffects[0];

    // A saved combat timestamp is enough to choose an inspectable effect frame.
    bramble.startedAt -= 700;
    thorn.updateThornbriarAbilityEffects(scene);
    const loaded = Object.values(THORNBRIAR_ABILITY_EFFECTS).every(sheet => scene.textures.get(sheet.key).has(31));
    return { paused, anchored, textured, partial, loaded, brambleFrame: bramble.image.frame.name };
  });
  expect(result).toEqual({ paused: true, anchored: true, textured: true, partial: true, loaded: true, brambleFrame: 14 });
  await mkdir('output/qa/thornbriar-vfx', { recursive: true });
  await page.screenshot({ path: `output/qa/thornbriar-vfx/battle-${page.viewportSize().width}.png` });
  expect(errors).toEqual([]);
});
