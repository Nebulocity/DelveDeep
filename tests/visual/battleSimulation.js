export async function simulateBattles(page, options) { return page.evaluate(async options => {
  const qa = window.__DELVE_DEEP_VISUAL_QA__;
  const game = qa.game;
  const state = qa.state;
  const { default: enemies } = await import('/data/enemies.js');
  const { monsterStats, monsterAbilities } = await import('/game/MonsterStats.js');
  const original = structuredClone(enemies);
  const roster = structuredClone(state.roster);
  const inventory = structuredClone(state.inventory);
  const partyNames = ['Caramon', 'Flint', 'Tika', 'Tanis', 'Goldmoon'];
  console.info = () => {};
  game.loop.stop();
  const results = [];
  for (const candidate of options.candidates) {
    for (const [type, override] of Object.entries(candidate.stats ?? {})) {
      const definition = { ...original[type], ...override };
      const stats = monsterStats(definition);
      enemies[type] = { ...stats, abilities: override.abilities ? monsterAbilities(stats) : original[type].abilities };
    }
    for (const seed of options.seeds ?? [1]) {
      for (const wave of options.waves ?? [3, 5, 6]) {
        let randomState = seed;
        Math.random = () => {
          randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
          return randomState / 4294967296;
        };
        game.scene.stop('BattleScene');
        state.roster = structuredClone(roster);
        state.inventory = structuredClone(inventory);
        state.activeParty = partyNames.map(name => structuredClone(state.roster.find(hero => hero.name === name)));
        state.run.entry = 'progress';
        state.delveCheckpoints = {};
        game.scene.start('BattleScene');
        const scene = game.scene.getScene('BattleScene');
        for (let attempt = 0; attempt < 100 && !scene.sys.isActive(); attempt++) await new Promise(resolve => setTimeout(resolve, 10));
        if (!scene.sys.isActive()) throw new Error('Battle restart failed');
        for (const preference of scene.tactics.preferences.values()) preference.side = Math.random() < 0.5 ? -1 : 1;
        scene.createEnemy = (type, spawn, index) => {
          const enemy = Object.getPrototypeOf(scene).createEnemy.call(scene, type, spawn, index);
          const override = candidate.stats?.[type];
          if (override) {
            const stats = monsterStats({ ...enemy.definition, ...override });
            for (const key of Object.keys(override)) if (key !== 'abilities') enemy[key] = stats[key];
            enemy.hp = enemy.maxHp;
            if (override.abilities) enemy.abilities = monsterAbilities(stats);
          }
          return enemy;
        };
        scene.time.preUpdate();
        scene.time.removeAllEvents();
        scene.time.preUpdate();
        scene.tweens.getDelta = () => 1000 / 60;
        scene.clearWaveAnnouncement();
        const fullRun = wave === 0;
        scene.currentWaveIndex = fullRun ? 0 : wave - 1;
        scene.completeWave = fullRun ? Object.getPrototypeOf(scene).completeWave
          : () => { scene.battleOver = true; scene.testOutcome = 'cleared'; };
        scene.showDelveCamp = () => { state.run.entry = 'boss'; scene.startWave(scene.bossWaveIndex); };
        scene.finishVictory = () => { scene.battleOver = true; scene.testOutcome = 'cleared'; };
        scene.finishDefeat = () => { scene.battleOver = true; scene.testOutcome = 'defeat'; };
        scene.isLeaderAbilityReady = () => false;
        scene.createFloatingText = () => {};
        scene.createProjectile = () => {};
        scene.createMeleePulse = () => {};
        scene.flashPartyHudName = () => {};
        scene.announceAbility = () => {};
        scene.updateHud = () => {};
        scene.combatLog.persist = () => {};
        const initialNow = scene.time.now;
        const add = scene.combatLog.add.bind(scene.combatLog);
        scene.combatLog.add = (...args) => {
          const result = add(...args);
          result.time = (scene.time.now - initialNow) / 1000;
          return result;
        };
        scene.spawnWave(fullRun ? 0 : wave - 1);
        for (const unit of [...scene.partyUnits, ...scene.enemies]) unit.flash = () => {};
        const minimum = new Map(scene.partyUnits.map(unit => [unit.name, 1]));
        let duration = 0;
        const waveMinimums = {};
        for (let frame = 0; frame < 60 * (fullRun ? 600 : 180) && !scene.battleOver; frame++) {
          duration += 1000 / 60;
          scene.sys.step(initialNow + duration, 1000 / 60);
          for (const unit of scene.partyUnits) {
            minimum.set(unit.name, Math.min(minimum.get(unit.name), unit.hp / unit.maxHp));
            if (!scene.waveTransitioning) {
              const waveData = waveMinimums[scene.currentWaveIndex + 1] ??= {};
              waveData[unit.name] = Math.min(waveData[unit.name] ?? 1, unit.hp / unit.maxHp);
            }
          }
        }
        results.push({ candidate: candidate.name, seed, wave, seconds: Math.round(duration / 100) / 10,
          outcome: scene.testOutcome ?? 'timeout', summary: scene.combatLog.record.summary,
          party: scene.partyUnits.map(unit => ({ name: unit.name, maxHp: unit.maxHp, attackPower: unit.attackPower,
            hp: Math.round(unit.hp), lowestHp: Math.round(minimum.get(unit.name) * 100), alive: unit.alive })),
          enemyRemaining: scene.enemies.filter(unit => unit.alive).map(unit => ({ name: unit.name, hp: Math.round(unit.hp) })) });
        if (fullRun) results.at(-1).waves = Object.entries(waveMinimums).map(([number, values]) => {
          const entries = scene.combatLog.entries.filter(entry => entry.wave === Number(number));
          return { wave: Number(number), start: entries.find(entry => entry.type === 'wave' && entry.message.includes('started'))?.time,
            end: entries.find(entry => entry.type === 'wave' && entry.message.includes('cleared'))?.time,
            deaths: entries.filter(entry => entry.type === 'death' && entry.targetSide === 'party').length,
            damage: entries.filter(entry => entry.type === 'damage' && entry.targetSide === 'party').reduce((sum, entry) => sum + entry.amount, 0),
            lowestHp: Object.fromEntries(Object.entries(values).map(([name, fraction]) => [name, Math.round(fraction * 100)])) };
        });
      }
    }
    for (const [type, definition] of Object.entries(original)) enemies[type] = structuredClone(definition);
  }
  return results;
}, options);
}
