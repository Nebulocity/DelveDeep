// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

export async function simulateBattles(page, options) {
  return page.evaluate(async options => {
  const qa = window.__DELVE_DEEP_VISUAL_QA__;
  const game = qa.game;
  const state = qa.state;

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { default: enemies } = await import('/data/enemies.js');
  const { monsterStats, monsterAbilities } = await import('/game/MonsterStats.js');

  // structuredClone makes an independent copy of supported data, including nested values.
  // This differs from a shallow ... copy.
  const original = structuredClone(enemies);
  const roster = structuredClone(state.roster);
  const inventory = structuredClone(state.inventory);
  const partyNames = ['Caramon', 'Flint', 'Tika', 'Tanis', 'Goldmoon'];
  console.info = () => {};
  game.loop.stop();
  const results = [];

  for (const candidate of options.candidates) {

    // Object.entries turns own fields into [key, value] pairs so we can visit or transform
    // them. ?? uses the fallback only for null or undefined. A real zero or false stays
    // intact.
    for (const [type, override] of Object.entries(candidate.stats ?? {})) {

      // ... copies the source's own fields into this object; fields listed later replace
      // earlier ones. This is a shallow copy, so nested objects are still shared.
      const definition = { ...original[type], ...override };
      const stats = monsterStats(definition);

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      enemies[type] = { ...stats, abilities: override.abilities ? monsterAbilities(stats) : original[type].abilities };
    }

    for (const seed of options.seeds ?? [1]) {
      for (const wave of options.waves ?? [3, 5, 6]) {
        let randomState = seed;
        Math.random = () => {

          // These bit operators work with 32-bit integers. >>> shifts in zero bits, while
          // ^ mixes bits with XOR. They are different from ordinary multiplication or
          // exponentiation.
          randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
          return randomState / 4294967296;
        };

        game.scene.stop('BattleScene');
        state.roster = structuredClone(roster);
        state.inventory = structuredClone(inventory);

        // map builds one output entry for each input entry, in the same order. The
        // callback's return value becomes that output entry.
        state.activeParty = partyNames.map(name => structuredClone(state.roster.find(hero => hero.name === name)));
        state.run.entry = 'progress';
        state.delveCheckpoints = {};
        game.scene.start('BattleScene');
        const scene = game.scene.getScene('BattleScene');

        for (let attempt = 0; attempt < 100 && !scene.sys.isActive(); attempt++) await new Promise(resolve => setTimeout(resolve, 10));
        if (!scene.sys.isActive()) throw new Error('Battle restart failed');
        for (const preference of scene.tactics.preferences.values()) preference.side = Math.random() < 0.5 ? -1 : 1;
        scene.createEnemy = (type, spawn, index) => {

          // call runs this function with the supplied first argument as its this value.
          const enemy = Object.getPrototypeOf(scene).createEnemy.call(scene, type, spawn, index);

          // ?. only follows this link when the value exists; a missing optional value
          // gives undefined.
          const override = candidate.stats?.[type];
          if (override) {

            // ... copies the source's own fields into this object; fields listed later
            // replace earlier ones. This is a shallow copy, so nested objects are still
            // shared.
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
          : () => {
            scene.battleOver = true;
            scene.testOutcome = 'cleared';
          };
        scene.showDelveCamp = () => {
          state.run.entry = 'boss';
          scene.startWave(scene.bossWaveIndex);
        };
        scene.finishVictory = () => {
          scene.battleOver = true;
          scene.testOutcome = 'cleared';
        };
        scene.finishDefeat = () => {
          scene.battleOver = true;
          scene.testOutcome = 'defeat';
        };
        scene.isLeaderAbilityReady = () => false;
        scene.createFloatingText = () => {};

        scene.createProjectile = () => {};
        scene.createMeleePulse = () => {};
        scene.flashPartyHudName = () => {};
        scene.announceAbility = () => {};
        scene.updateHud = () => {};
        scene.combatLog.persist = () => {};
        const initialNow = scene.time.now;

        // bind makes a function with a fixed this value, so a later callback still uses
        // the intended owner.
        const add = scene.combatLog.add.bind(scene.combatLog);
        scene.combatLog.add = (...args) => {

          // ... expands these entries into the new list or call. It does not deep-copy the
          // objects inside.
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

            // Math.min chooses the smallest value; pairing it with Math.max can keep a
            // result inside both a lower and an upper bound.
            minimum.set(unit.name, Math.min(minimum.get(unit.name), unit.hp / unit.maxHp));
            if (!scene.waveTransitioning) {

              // ??= fills a missing value once. It leaves an existing value, including
              // zero or false, alone.
              const waveData = waveMinimums[scene.currentWaveIndex + 1] ??= {};
              waveData[unit.name] = Math.min(waveData[unit.name] ?? 1, unit.hp / unit.maxHp);
            }
          }
        }

        // filter keeps entries whose callback returns true. It builds a new list and
        // leaves the original list in place.
        results.push({ candidate: candidate.name, seed, wave, seconds: Math.round(duration / 100) / 10,
          outcome: scene.testOutcome ?? 'timeout', summary: scene.combatLog.record.summary,
          party: scene.partyUnits.map(unit => ({ name: unit.name, maxHp: unit.maxHp, attackPower: unit.attackPower,
            hp: Math.round(unit.hp), lowestHp: Math.round(minimum.get(unit.name) * 100), alive: unit.alive })),
          enemyRemaining: scene.enemies.filter(unit => unit.alive).map(unit => ({ name: unit.name, hp: Math.round(unit.hp) })) });

        if (fullRun) results.at(-1).waves = Object.entries(waveMinimums).map(([number, values]) => {

          // filter keeps entries whose callback returns true. It builds a new list and
          // leaves the original list in place.
          const entries = scene.combatLog.entries.filter(entry => entry.wave === Number(number));

          // ?. only follows this link when the value exists; a missing optional value
          // gives undefined. find returns the first matching entry, or undefined when none
          // matches. Check for that missing result before using its fields. reduce carries
          // an accumulated result from one entry to the next. The callback returns the
          // accumulator for the next step; the final argument supplies its starting value.
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
