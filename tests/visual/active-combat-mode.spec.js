// Exercise real scene spawns, idle entry/return and both new and older saved units.
import { test, expect } from '@playwright/test';

test('active monster pressure survives pause, idle transitions and saved battles', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'slime-cave' }));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits?.length === 5);
  const result = await page.evaluate(async () => {
    const { game, state } = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = game.scene.getScene('BattleScene');
    const progress = game.backgroundProgress;
    const { beginIdleBattle, resumeIdleBattle } = await import('/combat/IdleBattle.js');
    const { captureBattle } = await import('/game/BattleSnapshot.js');
    const { restoreBattle } = await import('/combat/BattlePersistence.js');
    clearInterval(progress.timer);
    game.loop.stop();
    progress.hidden = false;
    progress.isReplaying = false;
    progress.pendingMs = 0;
    scene.combatPaused = true;
    scene.time.paused = true;
    scene.combatLog.persist = () => {};
    const enemy = scene.createEnemy('caveSlime', { x: 500, y: 500 }, 0);
    scene.enemies.push(enemy);
    const base = { ...enemy.activeCombatBalance };
    enemy.hp = enemy.maxHp * 0.4;
    const activeHp = enemy.hp;

    // Browser window events use the same immediate switch even while combat is paused.
    progress.pageUnavailable = false;
    progress.nativeInactive = false;
    progress.windowFocused = true;
    window.dispatchEvent(new Event('blur'));
    const blurred = { maxHp: enemy.maxHp, hp: enemy.hp, power: enemy.attackPower };
    progress.pendingMs = 0;
    progress.lastWallTime = Date.now();
    window.dispatchEvent(new Event('focus'));
    scene.syncActiveCombatBalance();
    const focused = { maxHp: enemy.maxHp, hp: enemy.hp, power: enemy.attackPower };

    // Pause prevents combat progress, but changing presentation mode must still preserve
    // the partially damaged monster. Run the actual idle lifecycle in both directions.
    beginIdleBattle(scene);
    const idle = { maxHp: enemy.maxHp, hp: enemy.hp, power: enemy.attackPower };
    resumeIdleBattle(scene);
    const returned = { maxHp: enemy.maxHp, hp: enemy.hp, power: enemy.attackPower };
    const saved = captureBattle(scene, state);
    scene.restoringBattle = true;
    restoreBattle(scene, saved);
    scene.restoringBattle = false;
    const restored = scene.enemies.find(unit => unit.id === enemy.id);
    beginIdleBattle(scene);
    const reloadedIdle = { maxHp: restored.maxHp, hp: restored.hp, power: restored.attackPower };
    resumeIdleBattle(scene);

    // Older snapshots do not opt into the new profile. The constructor must not leak
    // fresh-spawn metadata into a restored unit whose original save lacks that field.
    const legacy = captureBattle(scene, state);
    for (const unit of legacy.enemies) delete unit.activeCombatBalance;
    scene.restoringBattle = true;
    restoreBattle(scene, legacy);
    scene.restoringBattle = false;
    scene.syncActiveCombatBalance();
    const old = scene.enemies.find(unit => unit.id === enemy.id);
    return { base, activeHp, blurred, focused, idle, returned, reloadedIdle,
      legacyHasBonus: Boolean(old.activeCombatBalance), legacyHp: old.hp };
  });
  expect(result.idle.maxHp).toBe(result.base.maxHp);
  expect(result.idle.hp).toBeCloseTo(result.base.maxHp * 0.4, 8);
  expect(result.idle.power).toBe(result.base.attackPower);
  expect(result.returned.maxHp).toBe(Math.round(result.base.maxHp * 1.15));
  expect(result.returned.hp).toBeCloseTo(result.activeHp, 8);
  expect(result.returned.power).toBe(result.base.attackPower * result.base.powerScale);
  expect(result.reloadedIdle).toEqual(result.idle);
  expect(result.blurred).toEqual(result.idle);
  expect(result.focused).toEqual(result.returned);
  expect(result.legacyHasBonus).toBe(false);
  expect(result.legacyHp).toBeCloseTo(result.activeHp, 8);
});
