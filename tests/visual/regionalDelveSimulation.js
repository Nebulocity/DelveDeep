// Run real Phaser combat without drawing historical frames. The offline farm estimator
// is deliberately excluded: it awards rewards without resolving damage or new deaths.
export async function simulateRegionalDelve(page, options) {
  return page.evaluate(async options => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const { game, state } = qa;
    const { default: adventurers } = await import('/data/adventurers.js');
    const { leaderAbilities, purchaseLeaderAbility } = await import('/game/LeaderProgression.js');
    const { itemMinimumLevel, CATALOG_ITEMS } = await import('/data/items.js');
    const { ENCHANTMENTS } = await import('/data/enchantments.js');
    const { applyEnchantment } = await import('/game/ShopServices.js');
    const { rebuildCharacterStats } = await import('/game/CharacterStats.js');
    const { grantEquipment, grantEnchantmentScroll, equipItem, getEquippedAdventurer } = await import('/game/Equipment.js');
    const { abilityEntries, restoreAdventurerAbilities, purchaseAdventurerAbility } = await import('/game/AdventurerAbilities.js');
    const { advanceIdleBattle, resumeIdleBattle, beginIdleBattle } = await import('/combat/IdleBattle.js');
    const { ACTIVE_MONSTER_BALANCE, ACTIVE_MONSTER_POWER, syncActiveCombat, syncActiveMonster } = await import('/config/activeCombatBalance.js');
    const originalActiveBalance = { ...ACTIVE_MONSTER_BALANCE };
    const originalActivePower = ACTIVE_MONSTER_POWER[options.delve];
    const { DELVE_BALANCE } = await import('/config/delveBalance.js');
    const originalTuning = { ...DELVE_BALANCE[options.delve] };
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
      const selected = [tanks[Math.floor(index / 2) % tanks.length], healers[Math.floor(index / 4) % healers.length]];
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
    function prepareParty(ids, level, trained, build, prepared) {
      state.inventory = { equipment: [], materials: {}, nextEquipmentId: 1 };
      state.gold = 1000000;
      state.roster = ids.map(id => restoreAdventurerAbilities(rebuildCharacterStats({
        ...structuredClone(adventurers.find(hero => hero.id === id)), level, xp: 0, equipment: {}
      }), null));
      for (const hero of state.roster) {

        // Compare actual derived stats, including attribute bonuses, for this hero's role.
        // Armor favors effective physical Health. Weapons favor healing or expected damage.
        // This is a sensible high-end build, not a claim of one universally optimal loadout.
        const score = (item, slot) => {
          const probe = { ...hero, equipment: { [slot]: 'probe' } };
          const stats = getEquippedAdventurer(probe, { inventory: { equipment: [{ ...item, id: 'probe' }] } });

          // Two percent of Mana is a small healer tie-break score, not bonus healing.
          const offense = hero.role === 'Healer' ? stats.spellHealing + stats.maxMana * 0.02
            : hero.className.startsWith('Mage') ? stats.spellDamage : stats.attackPower;

          // Expected critical output is base power times one plus the chance of its extra
          // multiplier. Armor blocks armor / (armor + 400), so effective physical Health
          // is HP times (1 + armor / 400). These scores compare gear, not actual combat hits.
          const damage = offense * (1 + stats.critChance * (stats.critMultiplier - 1));
          const endurance = stats.maxHp * (1 + stats.armor / 400);

          // Armor also gives role power twice its numeric weight to favor useful hybrid
          // pieces when survival is similar. Tank accessories favor endurance alone.
          return slot === 'armor' ? endurance + damage * 2
            : slot === 'accessory' && hero.role === 'Tank' ? endurance : damage;
        };
        for (const slot of ['weapon', 'armor', 'accessory']) {
          let item = CATALOG_ITEMS.filter(item => item.slot === slot
            && itemMinimumLevel(item) <= level
            && (prepared || item.rarity === (trained ? 'uncommon' : 'common'))
            && (prepared || slot === 'accessory' || Number.isFinite(item.price))
            && (item.usableBy.includes(hero.className) || item.usableBy.includes('All')))
            .sort((a, b) => (prepared ? score(b, slot) - score(a, slot) : a.price - b.price) || a.id.localeCompare(b.id))[0];

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

          // Fully prepared Abyss gear includes one legal catalog enchantment per item.
          // Use owned scrolls and the real application checks; no invented bonuses are added.
          if (prepared) {
            const enchantment = [...ENCHANTMENTS].filter(entry => entry.slots.includes(slot))
              .sort((a, b) => score({ stats: a.stats }, slot) - score({ stats: b.stats }, slot)).at(-1);
            const scroll = grantEnchantmentScroll(enchantment.id, state);
            const applied = applyEnchantment(scroll.id, owned.id, state);
            if (!applied.ok) throw new Error(applied.message);
          }
          const equipped = equipItem(hero.id, owned.id, state);
          if (!equipped.ok) throw new Error(equipped.message);
        }
        if (!trained) continue;
        const entries = abilityEntries(hero);

        // A fourth class skill in the role's main category adds a useful action without
        // replacing the three starter skills. Learning it costs one earned skill point;
        // the rank allocation below spends the remaining points under real level gates.
        const primary = entries.find(([, ability]) => ability.starter && ability.origin !== 'Generic')?.[1].category;
        const fourth = entries.find(([key, ability]) => !hero.abilityRanks[key]
          && ability.origin !== 'Generic' && ability.category === primary) ?? entries.find(([key]) => !hero.abilityRanks[key]);
        if (!purchaseAdventurerAbility(hero.id, fourth[0], state).ok) throw new Error('Fourth skill purchase failed');

        // Enumerate four legal rank totals, then spend the complete earned SP budget.
        // Buying rank r costs r points; rank one of the fourth skill already cost one.
        // Balanced builds minimize the spread; specialization favors the first slot.
        const maximum = Math.min(10, Math.floor(level / 5) + 1);
        const choices = [];
        for (let a = 1; a <= maximum; a++) for (let b = 1; b <= maximum; b++)
          for (let c = 1; c <= maximum; c++) for (let d = 1; d <= maximum; d++) {
            const ranks = [a, b, c, d];
            const cost = ranks.reduce((sum, rank) => sum + rank * (rank + 1) / 2 - 1, 1);
            if (cost === level) choices.push(ranks);
          }
        choices.sort((a, b) => build === 'specialized'
          ? b[0] - a[0] || b[1] - a[1] || b[2] - a[2]
          : (Math.max(...a) - Math.min(...a)) - (Math.max(...b) - Math.min(...b))
            || b[0] - a[0] || b[1] - a[1]);
        if (!choices.length) throw new Error('No fully spent rank allocation');
        for (const [index, rank] of choices[0].entries()) {
          const key = hero.abilityLoadout[index];
          while (hero.abilityRanks[key] < rank) {
            const purchase = purchaseAdventurerAbility(hero.id, key, state);
            if (!purchase.ok) throw new Error(purchase.message);
          }
        }
      }

      // Five ordinary bosses and five shared character milestones yield eleven Renown
      // points at Abyss entry. Purchase affordable tactics through the normal rules.
      // An assumed history is explicit here rather than granting unlimited rare tactics.
      const leaderBudget = options.activeLeadership ? options.leaderBudget : prepared ? 11 : 1;
      state.leader = { level: leaderBudget, renownPoints: leaderBudget,
        spentRenownPoints: 0, claimedCharacterMilestones: [], claimedDelveBosses: [],
        closedVoidPortals: [], unlockedAbilities: [], battleLoadout: [] };
      if (prepared || options.activeLeadership) {
        const priority = ['focusFire', 'encouragement', 'brace', 'regen', 'fightOn', 'ready'];
        for (const ability of [...leaderAbilities].sort((a, b) => options.activeLeadership
          ? (priority.includes(a.id) ? priority.indexOf(a.id) : 99) - (priority.includes(b.id) ? priority.indexOf(b.id) : 99)
          : a.cost - b.cost)) {
          purchaseLeaderAbility(state.leader, ability.id);
        }
      }

      state.activeParty = structuredClone(state.roster);
      return { tactics: structuredClone(state.leader), trainingGold: 1000000 - state.gold, heroes: state.roster.map(hero => ({
        name: hero.name, level: hero.level, equipment: { ...hero.equipment },
        ranks: { ...hero.abilityRanks }, loadout: [...hero.abilityLoadout], unspentSP: hero.skillPoints
      })), gear: structuredClone(state.inventory.equipment) };
    }

    try {
      for (const candidate of options.candidates) {
        Object.assign(DELVE_BALANCE[options.delve], originalTuning, candidate.tuning);
        Object.assign(ACTIVE_MONSTER_BALANCE, originalActiveBalance, candidate.activeTuning);
        if (candidate.activeTuning?.power !== undefined) ACTIVE_MONSTER_POWER[options.delve] = candidate.activeTuning.power;
        else if (originalActivePower === undefined) delete ACTIVE_MONSTER_POWER[options.delve];
        else ACTIVE_MONSTER_POWER[options.delve] = originalActivePower;
        for (const [partyIndex, party] of parties.entries()) {

          // A focused rerun can select original party indexes without changing the seeded
          // roster generation. This reproduces a failed composition from a broader report.
          if (options.partyIndices && !options.partyIndices.includes(partyIndex)) continue;
          for (const seed of options.seeds) {
            for (const scenario of options.scenarios) {
              const previous = game.scene.getScene('BattleScene');
              resumeIdleBattle(previous);
              for (const name of ['spawnWave', 'update', 'completeWave', 'finishVictory', 'finishDefeat', 'isLeaderAbilityReady', 'testOutcome', 'createEnemy', 'syncActiveCombatBalance']) delete previous[name];
              game.scene.stop('BattleScene');

              // Reused Phaser scenes retain their clock. Start each fixture at zero so
              // floating-point deadlines and run order cannot influence paired trials.
              previous.time.now = 0;
              randomState = seed;
              const fixture = prepareParty(party.ids, scenario.level, scenario.mode === 'boss' || scenario.prepared, scenario.build ?? 'balanced', scenario.prepared);
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

                // Replay suppresses historical drawing, but this option tests the real
                // visible-play stat profile on every new progression or farm monster.
                if (options.activeStats) syncActiveMonster(enemy, true);
                if (type === options.bossType && candidate.bossAbilities) {
                  enemy.abilities = structuredClone(enemy.abilities);
                  for (const [key, fields] of Object.entries(candidate.bossAbilities)) Object.assign(enemy.abilities[key], fields);
                }
                return enemy;
              };
              if (!scenario.prepared && !options.activeLeadership) scene.isLeaderAbilityReady = () => false;
              scene.finishVictory = () => { scene.battleOver = true; scene.testOutcome = 'victory'; };
              scene.finishDefeat = () => { scene.battleOver = true; scene.testOutcome = 'defeat'; };
              const waves = [];
              let waveStats;
              let commands = 0;
              let lastCommand = -Infinity;
              let lastInterrupt = -Infinity;
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
                // to the selected ground warning after 1.5 seconds. Abyss answers both
                // ground warnings; its targeted Soul Rend still resolves as normal pressure.
                // Farm commands periodically attack, move an injured ally or briefly Hold.
                if (scenario.control && !scene.waveTransitioning && !scene.battleOver) {

                  // Slow ordinary casts also offer the existing free Interrupt order.
                  // Allow a 1.5-second response and at most one cancel every three seconds.
                  if (options.activeLeadership && scenario.mode !== 'boss' && time - lastInterrupt >= 3000) {
                    const caster = scene.getLivingEnemies().filter(enemy => enemy.pendingAction
                      && enemy.pendingAction.name !== 'Attack' && enemy.pendingAction.duration > 1500
                      && time - enemy.pendingAction.startAt >= 1500)
                      .sort((a, b) => Math.max(b.attackPower, b.spellDamage) - Math.max(a.attackPower, a.spellDamage))[0];
                    if (caster) {
                      scene.selectedUnitIds.clear();
                      scene.commandMode = 'INTERRUPT';
                      scene.handleEnemyTap(caster);
                      lastInterrupt = time;
                      commands++;
                    }
                  }

                  // Prepared Abyss leadership uses equipped recovery and defensive tactics
                  // only when useful. Unattended fixtures own tactics but do not press them.
                  if (scenario.prepared || options.activeLeadership) {
                    const living = scene.partyUnits.filter(unit => unit.alive);
                    if (living.some(unit => unit.hp / unit.maxHp < 0.65) && scene.isLeaderAbilityReady('encouragement')) scene.useLeaderAbility('encouragement');
                    if (living.some(unit => unit.hp / unit.maxHp < 0.8) && scene.isLeaderAbilityReady('regen')) scene.useLeaderAbility('regen');
                    if ((scene.activeTelegraphs.length || (options.activeLeadership && living.some(unit => unit.hp / unit.maxHp < 0.65)))
                      && scene.isLeaderAbilityReady('brace')) scene.useLeaderAbility('brace');
                    if (scene.isLeaderAbilityReady('fightOn')) scene.useLeaderAbility('fightOn');
                    if (scene.isLeaderAbilityReady('ready')) scene.useLeaderAbility('ready');
                    if (scene.isLeaderAbilityReady('focusFire')) {
                      const target = scene.getLivingEnemies().sort((a, b) => a.hp - b.hp)[0];
                      if (target) {
                        scene.useLeaderAbility('focusFire');
                        scene.handleEnemyTap(target);
                      }
                    }
                  }
                  if (scenario.mode === 'boss') {
                    const responseMs = 1500;
                    const warning = scene.activeTelegraphs.find(warning => warning.attacker.pendingAction
                      && (!scenario.controlPolicy || warning.ability.name === scenario.controlPolicy)
                      && time - warning.attacker.pendingAction.startAt >= responseMs);
                    if (warning && time - lastCommand >= 1000) {
                      scene.commandMode = 'INTERRUPT';
                      scene.handleEnemyTap(warning.attacker);
                      lastCommand = time;
                      commands++;
                    }
                  } else if (options.activeLeadership && time - lastCommand >= 3000) {

                    // A deliberate leadership policy focuses damage without issuing
                    // offensive orders to healers or periodically holding the whole party.
                    const living = scene.partyUnits.filter(unit => unit.alive);
                    const target = scene.getLivingEnemies().sort((a, b) => a.hp - b.hp)[0];
                    for (const unit of living.filter(unit => unit.role.includes('DPS'))) {
                      if (!target || unit.pendingAction || scene.attackTargets.get(unit.id) === target.id) continue;
                      scene.selectedUnitIds.clear();
                      scene.selectedUnitIds.add(unit.id);
                      scene.commandMode = 'ATTACK';
                      scene.handleEnemyTap(target);
                    }
                    for (const tank of living.filter(unit => unit.role === 'Tank')) {
                      const pursuer = scene.getLivingEnemies().find(enemy => living.some(ally =>
                        ally.role !== 'Tank' && ally.hp / ally.maxHp < 0.5 && enemy.currentTargetId === ally.id));
                      if (pursuer && !tank.pendingAction && scene.attackTargets.get(tank.id) !== pursuer.id) {
                        scene.selectedUnitIds.clear();
                        scene.selectedUnitIds.add(tank.id);
                        scene.commandMode = 'ATTACK';
                        scene.handleEnemyTap(pursuer);
                      }
                    }
                    const injured = [...living].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
                    const healer = living.find(unit => unit.role === 'Healer' && unit !== injured && !unit.pendingAction);
                    if (injured?.hp / injured?.maxHp < 0.5 && healer
                      && scene.healerPriorityTargets.get(healer.id) !== injured.id) {
                      scene.selectedUnitIds.clear();
                      scene.selectedUnitIds.add(healer.id);
                      scene.assignAllyTarget(injured);
                    }
                    commands++;
                    lastCommand = time;
                  } else if (!options.activeLeadership && time - lastCommand >= 12000) {
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


              // Walk every authored wave up to the requested camp. Abyss opens an early
              // camp at wave 15; continuing from it keeps resources and banked rewards.
              const campWave = scenario.campWave ?? scene.bossWaveIndex;

              // Start replay first, then hold active stats through timer callbacks and
              // updates. The normal idle harness continues using its unchanged profile.
              if (options.activeStats) {
                beginIdleBattle(scene);
                scene.syncActiveCombatBalance = () => syncActiveCombat(scene, true);
                scene.syncActiveCombatBalance();

                // Fail immediately if an ordinary monster is missing its saved baseline
                // or is accidentally using idle stats during an active-profile run.
                const sync = scene.syncActiveCombatBalance;
                scene.syncActiveCombatBalance = () => {
                  sync();
                  for (const enemy of scene.enemies.filter(unit => !unit.isBoss)) {
                    const balance = enemy.activeCombatBalance;
                    if (!balance?.active || enemy.maxHp !== Math.round(balance.maxHp * balance.healthScale)
                      || enemy.attackPower !== balance.attackPower * balance.powerScale
                      || enemy.spellDamage !== balance.spellDamage * balance.powerScale) {
                      throw new Error(`Active stats missing for ${enemy.name}`);
                    }
                  }
                };
              }
              advanceIdleBattle(scene, scenario.mode === 'boss' ? 600000 : 3600000, () => 0);
              while (scenario.mode !== 'boss' && state.run.entry === 'camp'
                && scene.currentWaveIndex + 1 < campWave && !scene.battleOver) {
                state.run.entry = 'progress';
                scene.startWave(scene.currentWaveIndex + 1);
                advanceIdleBattle(scene, 3600000, () => 0);
              }
              const reachedCamp = state.run.entry === 'camp' && scene.currentWaveIndex + 1 === campWave;
              if (scenario.mode === 'farm' && reachedCamp) {
                state.run.entry = 'farm';
                scene.startWave(campWave - 1);
                advanceIdleBattle(scene, options.farmMs, () => 0);
              }
              results.push({ candidate: candidate.name, partyIndex, category: party.category, seed, scenario,
                activeProfile: options.activeStats ? { health: ACTIVE_MONSTER_BALANCE.health,
                  power: ACTIVE_MONSTER_POWER[options.delve] ?? ACTIVE_MONSTER_BALANCE.power,
                  bossEscortPower: ACTIVE_MONSTER_BALANCE.power } : undefined,
                fixture, reachedCamp, outcome: scene.testOutcome ?? (state.run.entry === 'farm' ? 'farming' : reachedCamp ? 'camp' : 'timeout'),
                commands, tacticsUsed: [...scene.leaderAbilityCooldowns.keys()], deaths: scene.combatLog.record.summary.partyDeaths, waves,
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
      Object.assign(DELVE_BALANCE[options.delve], originalTuning);
      Object.assign(ACTIVE_MONSTER_BALANCE, originalActiveBalance);
      if (originalActivePower === undefined) delete ACTIVE_MONSTER_POWER[options.delve];
      else ACTIVE_MONSTER_POWER[options.delve] = originalActivePower;
      Math.random = originalRandom;
      console.info = originalInfo;
      game.backgroundProgress.isReplaying = false;
      resumeIdleBattle(game.scene.getScene('BattleScene'));
    }
    return results;
  }, options);
}

