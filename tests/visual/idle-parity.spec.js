// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('the reported party uses identical live and hidden combat rules', async ({ page, context, baseURL }) => {
  test.setTimeout(180000);
  const other = page;
  for (const target of [page]) {
    await target.bringToFront();
    await target.goto('/?visualQa=1');
    await target.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await target.evaluate(() => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      qa.activate('BattleScene');
      clearInterval(qa.game.backgroundProgress.timer);
    });

    await target.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').sys.isActive());
  }

  const snapshot = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    qa.game.backgroundProgress.setHidden(true);

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { resumeIdleBattle } = await import('/combat/IdleBattle.js');
    resumeIdleBattle(scene);
    scene.idleSummaryOpen = false;
    const { default: BattleUnit } = await import('/combat/BattleUnit.js');
    const { getEquippedAdventurer } = await import('/game/Equipment.js');
    const { battleAbilities } = await import('/game/AdventurerAbilities.js');
    const names = ['Dalamar', 'Laurana', 'Tasslehoff', 'Raistlin', 'Fistandantilus'];

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    qa.state.activeParty = names.map(name => qa.state.roster.find(hero => hero.name === name));
    scene.partyUnits.forEach(unit => unit.container.destroy());
    scene.partyUnits = qa.state.activeParty.map(hero => new BattleUnit(scene, {
      ...getEquippedAdventurer(hero), abilities: battleAbilities(hero), battlefield: scene.battlefield
    }));
    scene.tactics.registerParty(scene.partyUnits);
    scene.waveReturnPositions.clear();

    scene.partyUnits.forEach((unit, index) => {
      const point = scene.tactics.getSpawnPosition(unit, index);
      unit.setArenaPosition(point.x, point.y);
      scene.movement.validateUnitPosition(unit);
      scene.waveReturnPositions.set(unit.id, point);
    });
    scene.battleEvents.forEach(event => event.timer.remove(false));

    scene.battleEvents.clear();
    scene.enemies.forEach(unit => unit.container.destroy());
    scene.enemies = [];
    scene.time.removeAllEvents();
    const { default: ClassAbilitySystem } = await import('/combat/ClassAbilitySystem.js');
    const { default: CombatMovement } = await import('/combat/CombatMovement.js');
    scene.classAbilitySystem = new ClassAbilitySystem(scene);

    scene.movement = new CombatMovement(scene);

    // WeakMap stores object references without keeping unused objects alive. That is
    // useful for temporary per-object bookkeeping.
    scene.terrain.avoidanceStates = new WeakMap();
    scene.waveRetreating = false;
    scene.idleSummary = null;
    qa.state.delveCheckpoints[qa.state.currentDelve.id] = { nextWave: scene.bossWaveIndex, campUnlocked: true };
    qa.state.run.entry = 'farm';
    scene.startWave(scene.bossWaveIndex - 1);
    const { captureBattle } = await import('/game/BattleSnapshot.js');

    return captureBattle(scene, qa.state);
  });

  const run = async (target, hidden) => target.evaluate(async ({ snapshot, hidden }) => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    const progress = qa.game.backgroundProgress;

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { resumeIdleBattle, advanceIdleBattle } = await import('/combat/IdleBattle.js');
    resumeIdleBattle(scene);
    progress.hidden = true;
    progress.now = () => snapshot.savedAtMs;
    scene.battleEvents.forEach(event => event.timer.remove(false));
    scene.battleEvents.clear();
    scene.enemies.forEach(unit => unit.container.destroy());

    scene.enemies = [];
    const { default: BattleUnit } = await import('/combat/BattleUnit.js');
    const { unpackBattleValue, captureBattle } = await import('/game/BattleSnapshot.js');
    qa.state.activeParty = unpackBattleValue(snapshot.partyTemplates);
    scene.partyUnits.forEach(unit => unit.container.destroy());

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    scene.partyUnits = qa.state.activeParty.map(hero => new BattleUnit(scene, { ...hero, battlefield: scene.battlefield }));
    const { restoreBattle } = await import('/combat/BattlePersistence.js');
    restoreBattle(scene, snapshot);
    qa.state.delveCheckpoints[qa.state.currentDelve.id] = { nextWave: scene.bossWaveIndex, campUnlocked: true };
    progress.pendingMs = 0;
    progress.time = snapshot.time;
    scene.combatLog.entries.length = 0;

    scene.combatLog.record.summary = { partyDamageTaken: 0, partyHealing: 0, partyDeaths: 0, enemyDamageTaken: 0 };
    scene.combatLog.record.simulationStartedAt = snapshot.time;
    scene.combatRngState = 123456;
    let seed = 123456;
    const originalRandom = Math.random;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const originalReplay = progress.isReplaying;

    try {
      if (hidden) {
        progress.isReplaying = true;
        advanceIdleBattle(scene, 45000, () => 0);
      } else {
        for (let elapsed = 0; elapsed < 45000 && !scene.isWaitingForPlayer(); elapsed += 50) progress.step(50, true);
      }
      const result = captureBattle(scene, qa.state);

      for (const enemy of result.enemies) delete enemy.landingVisualY;
      return { party: result.party, enemies: result.enemies, movement: result.movement, rng: scene.combatRngState,
        time: result.time, events: result.events, threat: result.scene.enemyThreat,
        entries: scene.combatLog.entries, summary: scene.combatLog.record.summary };
    } finally {
      Math.random = originalRandom;
      progress.isReplaying = originalReplay;
    }
  }, { snapshot, hidden });

  const visible = await run(page, false);
  const hidden = await run(other, true);
  await mkdir('output/qa/idle-parity', { recursive: true });
  await writeFile('output/qa/idle-parity/visible.json', JSON.stringify(visible, null, 2));
  await writeFile('output/qa/idle-parity/hidden.json', JSON.stringify(hidden, null, 2));
  const firstDifference = visible.entries.findIndex((entry, index) => JSON.stringify(entry) !== JSON.stringify(hidden.entries[index]));
  expect(firstDifference, JSON.stringify({ visible: visible.entries[firstDifference], hidden: hidden.entries[firstDifference] })).toBe(-1);

  expect(hidden).toEqual(visible);

  // some stops with true as soon as one entry passes the check; an empty list gives false.
  expect(hidden.entries.some(entry => entry.type === 'damage' && entry.actor === 'Fistandantilus')).toBe(true);
  expect(hidden.entries.some(entry => entry.type === 'healing')).toBe(true);
});
