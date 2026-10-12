// Inspect real sprite drops, authored floors and pause behavior at phone landscape size.
import { test, expect } from '@playwright/test';

async function prepare(page) {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'thornbriar-hollow' }));
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && scene.partyUnits?.length === 5 && scene.enemies?.length;
  });
}

test('crowded waves spread over rear and inner arcs on every authored floor', async ({ page }) => {
  await prepare(page);
  const results = await page.evaluate(async () => {
    const { chooseWaveLandings } = await import('/combat/WaveLanding.js');
    const { default: delves } = await import('/data/delves.js');
    const { getDelveArena } = await import('/combat/LayeredEnvironment.js');
    const { default: Geometry } = await import('/combat/BattlefieldGeometry.js');
    const { default: Terrain } = await import('/combat/BattlefieldTerrain.js');
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    if (!scene.combatPaused) scene.togglePause();
    return delves.map(delve => {
      const floor = new Geometry(scene, { logicalWidth: 1750, logicalHeight: 900,
        ...getDelveArena(delve.visuals.environment, 2400, 1080) });
      const terrain = new Terrain(scene, floor);
      const points = chooseWaveLandings({ enemies: Array.from({ length: 13 }, () => ({ type: 'ruffian' })) },
        floor, terrain, scene.partyUnits, () => scene.combatRandom());
      return { id: delve.id, complete: points.every(Boolean),
        safe: points.every(p => p && !terrain.isBlocked(p.x, p.y, 12)),
        span: Math.max(...points.filter(Boolean).map(p => p.x)) - Math.min(...points.filter(Boolean).map(p => p.x)) };
    });
  });
  for (const result of results) {
    expect(result.complete, result.id).toBe(true);
    expect(result.safe, result.id).toBe(true);
    expect(result.span, result.id).toBeGreaterThan(1000);
  }
});

test('boss arrives after escorts, pauses midair, and emits drifting dust on impact', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  const initial = await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    if (!scene.combatPaused) scene.togglePause();
    for (const event of scene.battleEvents) event.timer.remove(false);
    scene.battleEvents.clear();
    scene.enemies.forEach(enemy => enemy.container.destroy());
    scene.enemies = [];
    scene.currentWaveIndex = scene.bossWaveIndex;
    scene.spawnWave(scene.bossWaveIndex);
    const boss = scene.enemies.find(enemy => enemy.definition.boss);
    scene.__entranceBoss = boss;
    scene.updatePartyUnit = () => {};
    scene.updateEnemies = () => {};
    const result = { hidden: !boss.container.visible,
      escorts: scene.enemies.filter(enemy => !enemy.definition.boss).length };
    scene.togglePause();
    return result;
  });
  expect(initial.hidden).toBe(true);
  expect(initial.escorts).toBeGreaterThan(0);
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const boss = scene.__entranceBoss;
    if (boss.landingWaiting || !boss.landing) return false;
    if (!scene.combatPaused) scene.togglePause();
    return scene.enemies.filter(enemy => !enemy.definition.boss).every(enemy => !enemy.landing);
  });
  const paused = await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return (scene.__entranceBoss.spriteVisual?.image ?? scene.__entranceBoss.body).y;
  });
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return (scene.__entranceBoss.spriteVisual?.image ?? scene.__entranceBoss.body).y;
  })).toBe(paused);
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').togglePause());
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    if (!scene.bossLandingEffects?.length) return false;
    if (scene.time.now - scene.bossLandingEffects[0].startedAt < 160) return false;
    scene.togglePause();
    return true;
  });
  await page.screenshot({ path: 'output/qa/enemy-boss-impact.png' });
  expect(errors).toEqual([]);
});

test('reload keeps a waiting boss hidden and preserves its entrance timer', async ({ page }) => {
  await prepare(page);
  const before = await page.evaluate(async () => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    if (!scene.combatPaused) scene.togglePause();
    for (const event of scene.battleEvents) event.timer.remove(false);
    scene.battleEvents.clear();
    scene.enemies.forEach(enemy => enemy.container.destroy());
    scene.enemies = [];
    scene.currentWaveIndex = scene.bossWaveIndex;
    scene.spawnWave(scene.bossWaveIndex);
    const { saveProfile } = await import('/game/GameStorage.js');
    saveProfile();
    await Promise.resolve();
    return scene.enemies.map(enemy => enemy.id);
  });
  await page.reload();
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && !scene.restoringBattle && scene.enemies?.some(enemy => enemy.landingWaiting);
  });
  const after = await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const boss = scene.enemies.find(enemy => enemy.definition.boss);
    return { ids: scene.enemies.map(enemy => enemy.id), paused: scene.combatPaused,
      hidden: !boss.container.visible, drop: [...scene.battleEvents].some(event =>
        event.data.kind === 'bossDrop' && event.data.unitId === boss.id) };
  });
  expect(after.ids).toEqual(before);
  expect(after.paused).toBe(true);
  expect(after.hidden).toBe(true);
  expect(after.drop).toBe(true);
});
