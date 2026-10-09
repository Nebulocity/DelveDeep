// Verify difficulty lengths and real status resolution in Chromium. The QA profile is
// isolated from the player's save, and paused combat prevents unrelated AI hits.
import { test, expect } from '@playwright/test';

test('Revised catalog waves, farm positions and Rongar stun in the live game', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  const counts = await page.evaluate(async () => {
    const { default: delves } = await import('/data/delves.js');
    const { createEncounterWaves } = await import('/data/encounters.js');
    return ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'old-quarry', 'sunken-watch', 'murmuring-abyss'].map(id => {
      const delve = delves.find(d => d.id === id);
      const waves = createEncounterWaves(delve);
      return { id, count: waves.length, farmBoss: !!waves.at(-2).boss, boss: waves.at(-1).enemies[0].type };
    });
  });
  expect(counts.map(d => d.count)).toEqual([6, 6, 10, 16, 24, 34]);
  expect(counts.every(d => !d.farmBoss)).toBe(true);
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'thornbriar-hollow' }));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').enemies?.length > 0);
  const result = await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    scene.combatPaused = true;
    const boss = scene.createEnemy('rongarTheCrusher', { x: 700, y: 790 }, 20);
    const target = scene.partyUnits[0];
    target.hp = target.maxHp = 100000;
    target.arenaX = boss.arenaX;
    target.arenaY = boss.arenaY;
    const ability = boss.abilities.secondary;
    scene.beginGroundSlam(boss, target, scene.time.now, ability, 'secondary');
    const warning = scene.activeTelegraphs.at(-1);
    const before = target.hp;
    scene.resolveGroundSlam(boss, boss.pendingAction, { arenaX: boss.arenaX, arenaY: boss.arenaY }, ability, warning);
    return { health: boss.maxHp, armor: boss.armor, name: ability.name,
      damage: before - target.hp, stun: target.status.stunnedUntil - scene.time.now,
      pending: boss.pendingAction, warningRemoved: !scene.activeTelegraphs.includes(warning) };
  });
  expect(result.health).toBe(36000);
  expect(result.armor).toBe(310);
  expect(result.name).toBe('Intimidating Stomp');
  expect(result.damage).toBeGreaterThan(0);
  expect(result.stun).toBeCloseTo(3000, 6);
  expect(result.pending).toBe(null);
  expect(result.warningRemoved).toBe(true);
  expect(errors).toEqual([]);
});
