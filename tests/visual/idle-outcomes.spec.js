import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function start(page) {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').sys.isActive());
}

test('eight idle hours settle farm outcomes without scene replay and summarize once', async ({ page }) => {
  test.setTimeout(180000);
  page.on('console', message => { if (message.text().startsWith('Idle benchmark debt:')) console.log(message.text()); });
  await page.setViewportSize({ width: 915, height: 412 });
  await start(page);
  const outcome = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    const progress = qa.game.backgroundProgress;
    progress.setHidden(true);
    const { resumeIdleBattle } = await import('/combat/IdleBattle.js');
    resumeIdleBattle(scene);
    scene.battleEvents.forEach(event => event.timer.remove(false));
    scene.battleEvents.clear();
    scene.enemies.forEach(unit => unit.container.destroy());
    scene.enemies = [];
    scene.waveRetreating = false;
    scene.idleSummary = null;
    scene.partyUnits.forEach(unit => {
      unit.maxHp = unit.hp = 1000000;
      unit.attackPower = unit.spellDamage = 100000;
    });
    qa.state.delveCheckpoints[qa.state.currentDelve.id] = { nextWave: scene.bossWaveIndex, campUnlocked: true };
    qa.state.run.entry = 'farm';
    scene.startWave(scene.bossWaveIndex - 1);
    const gold = qa.state.gold;
    let steps = 0;
    const original = progress.originalUpdate;
    progress.originalUpdate = function (...args) { if (progress.isReplaying) steps += 1; return original.apply(this, args); };
    const wall = progress.now();
    progress.now = () => wall + 8 * 3600000;
    const began = performance.now();
    const monitor = setInterval(() => console.log(`Idle benchmark debt: ${progress.pendingMs}; time ${scene.time.now}; hidden ${document.hidden}`), 5000);
    progress.pump();
    progress.setHidden(false);
    while (progress.pendingMs >= 50) await new Promise(resolve => setTimeout(resolve, 0));
    const elapsed = performance.now() - began;
    clearInterval(monitor);
    return { elapsed, steps, gold: qa.state.gold - gold, summary: scene.idleSummary,
      debt: progress.pendingMs, open: scene.idleSummaryOpen };
  });
  expect(outcome.steps).toBe(0);
  expect(outcome.debt).toBeLessThan(50);
  expect(outcome.elapsed).toBeLessThan(120000);
  expect(outcome.summary.waves).toBeGreaterThan(1000);
  expect(outcome.gold).toBe(outcome.summary.gold);
  expect(outcome.summary.xp).toBe(outcome.summary.waves * 4);
  expect(outcome.summary.deaths).toEqual([]);
  expect(outcome.open).toBe(true);
  console.log(`Eight idle hours: ${outcome.summary.waves} waves in ${outcome.elapsed.toFixed(1)} ms; ${outcome.steps} scene replay steps.`);
  await mkdir('tests/visual/screenshots', { recursive: true });
  await page.screenshot({ path: 'tests/visual/screenshots/IdleReturn-phone.png' });
  const panel = await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const text = scene.children.getByName('idle-summary-text');
    return { y: text.y, bottom: text.getBounds().bottom, width: text.width, viewport: scene.scale.width };
  });
  expect(panel.width).toBeLessThan(panel.viewport * 0.71);
  const button = await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const label = qa.game.scene.getScene('BattleScene').children.list.find(object => object.text === 'CONTINUE');
    const rect = qa.game.canvas.getBoundingClientRect();
    return { x: rect.x + label.x * rect.width / qa.game.scale.width,
      y: rect.y + label.y * rect.height / qa.game.scale.height };
  });
  await page.mouse.click(button.x, button.y);
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').idleSummary)).toBeNull();
});

test('idle deaths stop a lost run, persist the summary and do not repay on reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await start(page);
  const result = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    const progress = qa.game.backgroundProgress;
    progress.setHidden(true);
    scene.isLeaderAbilityReady = () => false;
    scene.partyUnits.forEach(unit => {
      unit.hp = 1;
      unit.attackPower = unit.spellDamage = unit.spellHealing = unit.basicHealPower = 0;
      unit.abilities = {};
    });
    const wall = progress.now();
    progress.now = () => wall + 3600000;
    progress.pump();
    progress.setHidden(false);
    while (progress.pendingMs >= 50) await new Promise(resolve => setTimeout(resolve, 0));
    await Promise.resolve();
    return { deaths: scene.idleSummary.deaths, over: scene.battleOver, gold: qa.state.gold };
  });
  expect(result.over).toBe(true);
  expect(result.deaths).toHaveLength(5);
  await page.screenshot({ path: 'tests/visual/screenshots/IdleDeaths-desktop.png' });
  await page.reload();
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene').idleSummaryOpen);
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.gold)).toBe(result.gold);
  expect(errors).toEqual([]);
});

test('idle party loss keeps enemies for the Arise decision and grants no clear', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    const progress = qa.game.backgroundProgress;
    progress.setHidden(true);
    scene.isLeaderAbilityReady = () => true;
    scene.partyUnits.forEach(unit => {
      unit.hp = 1;
      unit.attackPower = unit.spellDamage = unit.spellHealing = unit.basicHealPower = 0;
      unit.abilities = {};
    });
    const gold = qa.state.gold;
    const wall = progress.now();
    progress.now = () => wall + 3600000;
    progress.pump();
    while (progress.pendingMs >= 50) {
      progress.pump();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return { waiting: scene.awaitingRevive, over: scene.battleOver,
      enemies: scene.enemies.filter(unit => unit.alive).length, gold: qa.state.gold - gold };
  });
  expect(result.waiting).toBe(true);
  expect(result.over).toBe(false);
  expect(result.enemies).toBeGreaterThan(0);
  expect(result.gold).toBe(0);
});
