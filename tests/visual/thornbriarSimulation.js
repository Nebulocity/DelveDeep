// Run real Phaser combat without drawing historical frames. The offline farm estimator
// is deliberately excluded: it awards rewards without resolving damage or new deaths.
export async function simulateThornbriar(page, options) {
  return page.evaluate(async options => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const { game, state } = qa;
    const { default: adventurers } = await import('/data/adventurers.js');
    const { CATALOG_ITEMS } = await import('/data/items.js');
    const { rebuildCharacterStats } = await import('/game/CharacterStats.js');
    const { grantEquipment, equipItem } = await import('/game/Equipment.js');
    const { abilityEntries, restoreAdventurerAbilities, purchaseAdventurerAbility } = await import('/game/AdventurerAbilities.js');
    const { advanceIdleBattle, resumeIdleBattle } = await import('/combat/IdleBattle.js');
    const { DELVE_BALANCE } = await import('/config/delveBalance.js');
    const originalTuning = { ...DELVE_BALANCE['thornbriar-hollow'] };
    const originalRandom = Math.random;
    const originalInfo = console.info;
    const results = [];
    clearInterval(game.backgroundProgress.timer);
    game.loop.stop();
    game.backgroundProgress.isReplaying = true;
    console.info = () => {};

    // This seeded generator covers initialization and formation too, before the scene's
    // own saved combat generator takes over. Equal seeds allow fair tuning comparisons.
    // Math.imul multiplies 32-bit integers; >>> 0 keeps an unsigned 32-bit seed. Dividing
    // by 2 to the power of 32 converts it into a random fraction from zero up to one.
    let randomState = 1;
    Math.random = () => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 4294967296;
    };
    const shuffle = list => {
      const copy = [...list];

      // Swap each entry with a random earlier entry. The brackets unpack both values
      // together, so swapping cannot overwrite one before it is moved to its new position.
      for (let index = copy.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [copy[index], copy[other]] = [copy[other], copy[index]];
      }
      return copy;
    };
    const tanks = adventurers.filter(hero => hero.role === 'Tank');
    const healers = adventurers.filter(hero => hero.role === 'Healer');
    const damage = adventurers.filter(hero => hero.role.includes('DPS'));
    const parties = [];

    // Cycle tanks and healers so random damage picks cannot leave a whole class untested.
    // Stress parties remain separately labeled and do not define ordinary-wave targets.
    for (let index = 0; index < options.parties; index++) {
      randomState = 7919 + index * (options.partySeedStride ?? 1);
      const secondHealer = index % 2 === 1;
      const selected = [tanks[index % tanks.length], healers[Math.floor(index / tanks.length) % healers.length]];
      if (secondHealer) selected.push(healers[(healers.indexOf(selected[1]) + 1) % healers.length]);
      selected.push(...shuffle(damage).slice(0, 5 - selected.length));
      parties.push({ category: secondHealer ? 'two-healers' : 'one-healer', ids: selected.map(hero => hero.id) });
    }
    if (options.stress) {
      parties.push({ category: 'no-tank', ids: [healers[0], ...damage.slice(0, 4)].map(hero => hero.id) });
      parties.push({ category: 'no-healer', ids: [tanks[0], ...damage.slice(0, 4)].map(hero => hero.id) });
    }

    // Use real item ownership, compatibility checks and training purchases. Gold is
    // unlimited in this combat experiment; record the cost instead of assuming affordability.
    function prepareParty(ids, level, trained, build) {
      state.inventory = { equipment: [], materials: {}, nextEquipmentId: 1 };
      state.gold = 1000000;
      state.roster = ids.map(id => restoreAdventurerAbilities(rebuildCharacterStats({
        ...structuredClone(adventurers.find(hero => hero.id === id)), level, xp: 0, equipment: {}
      }), null));
      for (const hero of state.roster) {
        for (const slot of ['weapon', 'armor', 'accessory']) {
          let item = CATALOG_ITEMS.filter(item => item.slot === slot
            && item.rarity === (trained ? 'uncommon' : 'common')
            && (slot === 'accessory' || Number.isFinite(item.price))
            && (item.usableBy.includes(hero.className) || item.usableBy.includes('All')))
            .sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))[0];

          // Light physical classes have no Uncommon armor yet. Use their best purchasable
          // Common armor rather than silently relaxing class restrictions or inventing gear.
          if (!item && trained && slot === 'armor') {
            item = CATALOG_ITEMS.filter(item => item.slot === slot && item.rarity === 'common'
              && item.usableBy.includes(hero.className) && Number.isFinite(item.price))
              .sort((a, b) => b.price - a.price || a.id.localeCompare(b.id))[0];
          }
          if (!item && slot === 'accessory') continue;
          if (!item) throw new Error(`Missing ${slot} for ${hero.className}`);
          const owned = grantEquipment(item.id, state);
          const equipped = equipItem(hero.id, owned.id, state);
          if (!equipped.ok) throw new Error(equipped.message);
        }
        if (!trained) continue;
        const entries = abilityEntries(hero);

        // A fourth class skill in the role's main category adds a useful action without
        // replacing the three starter skills. The level-10 budget is ten SP. Raising all
        // four skills to rank two costs nine SP and strands one point, so the balanced
        // plan trains three class skills and gives the primary starter its third rank.
        const primary = entries.find(([, ability]) => ability.starter && ability.origin !== 'Generic')?.[1].category;
        const fourth = entries.find(([key, ability]) => !hero.abilityRanks[key]
          && ability.origin !== 'Generic' && ability.category === primary) ?? entries.find(([key]) => !hero.abilityRanks[key]);
        if (!purchaseAdventurerAbility(hero.id, fourth[0], state).ok) throw new Error('Fourth skill purchase failed');
        if (build === 'balanced') {

          // The empty third position skips the generic starter, which stays at rank one.
          const [first, second, , fourthKey] = hero.abilityLoadout;
          for (const key of [first, second, fourthKey, first]) {
            const purchase = purchaseAdventurerAbility(hero.id, key, state);
            if (!purchase.ok) throw new Error(purchase.message);
          }
        }
        while (true) {
          const order = hero.abilityLoadout;
          const key = order.find(key => {
            const rank = hero.abilityRanks[key] + 1;
            return rank <= 10 && level >= (rank - 1) * 5 && hero.skillPoints >= rank;
          });
          if (!key) break;
          const purchase = purchaseAdventurerAbility(hero.id, key, state);
          if (!purchase.ok) throw new Error(purchase.message);
        }
      }
      state.activeParty = structuredClone(state.roster);
      return { trainingGold: 1000000 - state.gold, heroes: state.roster.map(hero => ({
        name: hero.name, level: hero.level, equipment: { ...hero.equipment },
        ranks: { ...hero.abilityRanks }, loadout: [...hero.abilityLoadout], unspentSP: hero.skillPoints
      })), gear: structuredClone(state.inventory.equipment) };
    }

    try {
      for (const candidate of options.candidates) {
        Object.assign(DELVE_BALANCE['thornbriar-hollow'], originalTuning, candidate.tuning);
        for (const [partyIndex, party] of parties.entries()) {
          for (const seed of options.seeds) {
            for (const scenario of options.scenarios) {
              const previous = game.scene.getScene('BattleScene');
              resumeIdleBattle(previous);
              for (const name of ['spawnWave', 'update', 'completeWave', 'finishVictory', 'finishDefeat', 'isLeaderAbilityReady', 'testOutcome', 'createEnemy']) delete previous[name];
              game.scene.stop('BattleScene');

              // Reused Phaser scenes retain their clock. Start each fixture at zero so
              // floating-point deadlines and run order cannot influence paired trials.
              previous.time.now = 0;
              randomState = seed;
              const fixture = prepareParty(party.ids, scenario.level, scenario.mode === 'boss', scenario.build);
              state.delveCheckpoints = {};
              state.run.entry = scenario.mode === 'boss' ? 'boss' : 'progress';
              game.scene.start('BattleScene');
              const scene = game.scene.getScene('BattleScene');
              scene.combatRngState = seed;
              for (const preference of scene.tactics.preferences.values()) preference.side = Math.random() < 0.5 ? -1 : 1;
              scene.combatLog.persist = () => {};
              const createEnemy = scene.createEnemy.bind(scene);

              // Exploratory candidates change only fresh boss skills. They never write
              // the reusable catalog, saved units or any player's persistent profile.
              scene.createEnemy = (type, ...args) => {
                const enemy = createEnemy(type, ...args);
                if (type === 'rongarTheCrusher' && candidate.bossAbilities) {
                  enemy.abilities = structuredClone(enemy.abilities);
                  for (const [key, fields] of Object.entries(candidate.bossAbilities)) Object.assign(enemy.abilities[key], fields);
                }
                return enemy;
              };
              scene.isLeaderAbilityReady = () => false;
              scene.finishVictory = () => { scene.battleOver = true; scene.testOutcome = 'victory'; };
              scene.finishDefeat = () => { scene.battleOver = true; scene.testOutcome = 'defeat'; };
              const waves = [];
              let waveStats;
              let commands = 0;
              let lastCommand = -Infinity;
              let heldUntil = 0;
              const spawn = scene.spawnWave.bind(scene);
              scene.spawnWave = index => {
                waveStats = { wave: index + 1, start: scene.time.now, lowestHp: 1, lowestMana: 1, damage: 0, healing: 0, deaths: 0 };
                spawn(index);
              };
              const update = scene.update.bind(scene);
              scene.update = (time, delta) => {
                update(time, delta);
                if (waveStats && !scene.waveTransitioning) {
                  waveStats.lowestHp = Math.min(waveStats.lowestHp, ...scene.partyUnits.map(unit => unit.hp / unit.maxHp));
                  waveStats.lowestMana = Math.min(waveStats.lowestMana, ...scene.partyUnits.filter(unit => unit.maxMana).map(unit => unit.mana / unit.maxMana));
                }

                // Commands use the same handlers as taps. The simple boss policy reacts
                // only to Belch after 1.5 seconds; exploratory all-warning runs use 750 ms.
                // Farm commands periodically attack, move an injured ally or briefly Hold.
                if (scenario.control && !scene.waveTransitioning && !scene.battleOver) {
                  if (scenario.mode === 'boss') {
                    const responseMs = scenario.controlPolicy === 'belch' ? 1500 : 750;
                    const warning = scene.activeTelegraphs.find(warning => warning.attacker.pendingAction
                      && (scenario.controlPolicy !== 'belch' || warning.ability.name === 'Belch')
                      && time - warning.attacker.pendingAction.startAt >= responseMs);
                    if (warning && time - lastCommand >= 1000) {
                      scene.commandMode = 'INTERRUPT';
                      scene.handleEnemyTap(warning.attacker);
                      lastCommand = time;
                      commands++;
                    }
                  } else if (time - lastCommand >= 12000) {
                    scene.partyUnits.filter(unit => unit.alive).forEach(unit => scene.selectedUnitIds.add(unit.id));
                    scene.commandMode = 'ATTACK';
                    const target = scene.getLivingEnemies().sort((a, b) => a.hp - b.hp)[0];
                    if (target) scene.handleEnemyTap(target);
                    if (commands % 3 === 1) {
                      const unit = scene.partyUnits.filter(unit => unit.alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
                      if (unit) {
                        const center = scene.partyUnits.filter(unit => unit.alive).reduce((point, ally, index, list) => ({
                          x: point.x + ally.arenaX / list.length, y: point.y + ally.arenaY / list.length
                        }), { x: 0, y: 0 });
                        const destination = scene.terrain.nearestSafeUnitPoint(unit, (unit.arenaX + center.x) / 2, (unit.arenaY + center.y) / 2);
                        scene.selectedUnitIds.add(unit.id);
                        scene.commandMode = 'MOVE';
                        scene.handleArenaTap(destination);
                        scene.selectedUnitIds.clear();
                        heldUntil = time + 2000;
                      }
                    }
                    if (commands % 3 === 2) {
                      scene.partyUnits.filter(unit => unit.alive).forEach(unit => scene.heldUnitIds.add(unit.id));
                      heldUntil = time + 2000;
                    }
                    commands++;
                    lastCommand = time;
                  }
                  if (heldUntil && time >= heldUntil) {
                    scene.heldUnitIds.clear();
                    scene.manualTargets.clear();
                    heldUntil = 0;
                  }
                }
              };
              scene.combatLog.onEntry = entry => {
                if (!waveStats || entry.targetSide !== 'party') return;
                if (entry.type === 'damage') waveStats.damage += entry.amount;
                if (entry.type === 'healing') waveStats.healing += entry.amount;
                if (entry.type === 'death') waveStats.deaths++;
              };
              const complete = scene.completeWave.bind(scene);
              scene.completeWave = () => {
                if (!scene.waveTransitioning && waveStats) waves.push({ ...waveStats, seconds: (scene.time.now - waveStats.start) / 1000 });
                complete();
              };

              // Progression uses all nine waves and their real carried resources. Farming
              // begins from that camp without refilling. Midpoint/cap fixtures still prove
              // the full route at their chosen level before beginning repeated wave nine.
              advanceIdleBattle(scene, scenario.mode === 'boss' ? 240000 : 900000, () => 0);
              const reachedCamp = state.run.entry === 'camp';
              if (scenario.mode === 'farm' && reachedCamp) {
                state.run.entry = 'farm';
                scene.startWave(scene.bossWaveIndex - 1);
                advanceIdleBattle(scene, options.farmMs, () => 0);
              }
              results.push({ candidate: candidate.name, partyIndex, category: party.category, seed, scenario,
                fixture, reachedCamp, outcome: scene.testOutcome ?? (state.run.entry === 'farm' ? 'farming' : reachedCamp ? 'camp' : 'timeout'),
                commands, deaths: scene.combatLog.record.summary.partyDeaths, waves,
                unfinished: scene.battleOver && scene.testOutcome === 'defeat' ? waveStats : null,
                ongoing: !scene.battleOver && state.run.entry === 'farm' ? waveStats : null,
                remainingEnemies: scene.enemies.filter(unit => unit.alive).map(unit => ({ name: unit.name, hp: unit.hp })),
                party: scene.partyUnits.map(unit => ({ name: unit.name, hp: unit.hp, maxHp: unit.maxHp, mana: unit.mana, alive: unit.alive })) });
              console.log(`SIM ${candidate.name} party ${partyIndex + 1} seed ${seed} ${scenario.mode} ${scenario.level} ${scenario.build ?? 'starters'} ${scenario.control ? 'commands' : 'auto'}: ${results.at(-1).outcome}, ${results.at(-1).deaths} deaths, ${waves.length} clears`);

              // Yield between fixtures so browser diagnostics and progress can be delivered.
              // The game loop remains stopped, so this wall-clock pause cannot add combat.
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
        }
      }
    } finally {
      Object.assign(DELVE_BALANCE['thornbriar-hollow'], originalTuning);
      Math.random = originalRandom;
      console.info = originalInfo;
      game.backgroundProgress.isReplaying = false;
      resumeIdleBattle(game.scene.getScene('BattleScene'));
    }
    return results;
  }, options);
}
