// Check the real Phaser units, supplied artwork, saved decoys, and phone-sized UI.
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const width of [915, 1920]) {
  test(`replacement starters, shields and ground preparation at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 915 ? 412 : 1080 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      qa.activate('BattleScene');
      const names = ['Gladiator', 'Barmaid', 'Ranger', 'Scoundrel', 'Cleric of the Everbright'];
      qa.state.activeParty = names.map(name => ({ ...qa.state.roster.find(hero => hero.className === name) }));
    });
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').enemies?.some(enemy => enemy.alive && !enemy.landing));
    const result = await page.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('BattleScene');
      scene.combatPaused = true; scene.time.paused = true;
      scene.partyUnits.forEach(unit => { unit.finishAction(); unit.hp = unit.maxHp; unit.status = {}; unit.criticalKnockback = null; });
      const tank = scene.partyUnits[0], barmaid = scene.partyUnits[1], ranger = scene.partyUnits[2], healer = scene.partyUnits[4];
      const drink = Object.values(barmaid.abilities).find(a => a.name === 'Spilled Drink');
      const ward = Object.values(healer.abilities).find(a => a.name === 'Sunlit Ward');
      scene.classAbilitySystem.replacement.resolve(barmaid, { arenaX: tank.arenaX, arenaY: tank.arenaY, alive: true }, drink, scene.time.now);
      scene.classAbilitySystem.replacement.resolve(healer, ranger, ward, scene.time.now);

      // Advance a paused Phaser frame beyond both durations. Status deadlines, timers,
      // and the field's drawing must still use the same frozen combat timestamp.
      const frozenTime = scene.time.now;
      scene.time.update(frozenTime + 20000, 20000);
      scene.classAbilitySystem.replacement.drawZones(scene.time.now);
      return { kits: scene.partyUnits.map(unit => Object.values(unit.abilities).map(a => ({ name: a.name, replacement: a.replacement }))),
        pausedTime: scene.time.now, frozenTime,
        shield: ranger.status.temporaryHp, expectedShield: Math.round(healer.maxMana * ward.primary.potency),
        zones: scene.classAbilitySystem.replacement.zoneViews.size,
        wardArtwork: scene.abilityEffects?.some(effect => effect.definition.id === 'sunlit-ward') };
    });
    expect(result.kits.every(kit => kit.length === 3 && kit.every(a => a.replacement))).toBe(true);
    expect(result.shield).toBe(result.expectedShield);
    expect(result.pausedTime).toBe(result.frozenTime);
    expect(result.zones).toBe(1);
    expect(result.wardArtwork).toBe(true);
    await mkdir('output/qa/ability-replacement', { recursive: true });
    await page.screenshot({ path: `output/qa/ability-replacement/replacement-${width}.png` });
    expect(errors).toEqual([]);
  });
}

test('decoy and ground field survive a real profile reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').enemies?.some(enemy => enemy.alive && !enemy.landing));
  const before = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('BattleScene');
    const { CLASS_DEFINITIONS } = await import('/data/classes.js');
    const { captureBattle, validBattleSnapshot } = await import('/game/BattleSnapshot.js');
    const { saveProfile } = await import('/game/GameStorage.js');
    scene.combatPaused = true; scene.time.paused = true;
    scene.battleEvents.forEach(event => event.timer.remove(false)); scene.battleEvents.clear();
    scene.partyUnits.forEach(unit => unit.finishAction());
    scene.getLivingEnemies().forEach(unit => unit.finishAction());
    const caster = scene.partyUnits.find(unit => unit.className === 'Mage of the Umbral Veil');
    const image = Object.values(CLASS_DEFINITIONS[caster.className].abilities).find(a => a.name === 'Shadow Image');
    const field = Object.values(CLASS_DEFINITIONS[caster.className].abilities).find(a => a.name === 'Eclipse Field');
    scene.classAbilitySystem.replacement.resolve(caster, caster, image, scene.time.now);
    scene.classAbilitySystem.replacement.resolve(caster, { arenaX: caster.arenaX, arenaY: caster.arenaY, alive: true }, field, scene.time.now);
    const snapshot = captureBattle(scene, qa.state);
    const valid = validBattleSnapshot(snapshot, qa.state.roster);
    saveProfile();
    return { valid, decoys: snapshot.decoys.length, id: scene.abilityDecoys[0]?.id,
      health: scene.abilityDecoys[0]?.hp, zoneCount: caster.status.replacementZones.length };
  });
  expect(before.valid).toBe(true);
  expect(before.decoys).toBe(1);
  expect(before.zoneCount).toBe(1);
  await page.reload();
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.abilityDecoys?.length === 1;
  });
  const after = await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const caster = scene.partyUnits.find(unit => unit.className === 'Mage of the Umbral Veil');
    return { id: scene.abilityDecoys?.[0]?.id, health: scene.abilityDecoys?.[0]?.hp,
      zoneCount: caster.status.replacementZones?.length, realPartyCount: scene.partyUnits.length,
      decoyInteractive: scene.abilityDecoys?.[0]?.hitZone.input?.enabled ?? false };
  });
  expect(after.id).toBe(before.id);
  expect(after.health).toBe(before.health);
  expect(after.zoneCount).toBe(1);
  expect(after.realPartyCount).toBe(5);
  expect(after.decoyInteractive).toBe(false);
  expect(errors).toEqual([]);
});
