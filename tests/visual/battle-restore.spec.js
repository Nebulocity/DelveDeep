import { test, expect } from '@playwright/test';

async function startBattle(page) {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const game = window.__DELVE_DEEP_VISUAL_QA__.game;
    return game.scene.getScene('BattleScene').sys.isActive() && window.__DELVE_DEEP_VISUAL_QA__.state.activeBattle;
  });
}

async function reloadBattle(page) {
  await page.reload();
  await page.waitForFunction(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && !scene.restoringBattle && qa.state.activeBattle;
  });
}

test('reload preserves paused resources, orders, statuses, threat and pending attacks', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await startBattle(page);
  const saved = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    const progress = qa.game.backgroundProgress;
    progress.setHidden(true);
    progress.now = () => Date.now() + 8000;
    while (progress.pendingMs >= 50 || !scene.enemies.length) {
      progress.pump();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const unit = scene.partyUnits[0];
    const enemy = scene.enemies.find(entry => entry.alive);
    scene.battleEvents.forEach(event => event.timer.remove(false));
    scene.battleEvents.clear();
    unit.finishAction();
    unit.lastAttackAt = -Infinity;
    unit.hp = Math.max(1, unit.maxHp - 13);
    unit.status.damageBoostUntil = scene.time.now + 9000;
    unit.status.damageBoost = 0.2;
    scene.heldUnitIds.add(unit.id);
    scene.attackTargets.set(unit.id, enemy.id);
    scene.enemyThreat.get(enemy.id).set(unit.id, 123);
    scene.beginBasicAttack(unit, enemy, scene.time.now, 'party');
    scene.togglePause();
    const { saveProfile } = await import('/game/GameStorage.js');
    saveProfile();
    await Promise.resolve();
    return JSON.parse(localStorage.getItem('delveDeep.profile.v2'));
  });
  expect(saved.activeBattle.events.some(event => event.data.kind === 'attack')).toBe(true);
  await reloadBattle(page);
  const restored = await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    return { paused: scene.combatPaused, time: scene.time.now, gold: qa.state.gold,
      party: scene.partyUnits.map(unit => ({ id: unit.id, hp: unit.hp, mana: unit.mana,
        status: unit.status, pendingAction: unit.pendingAction, lastAttackAt: unit.lastAttackAt })),
      held: [...scene.heldUnitIds], attacks: [...scene.attackTargets],
      threat: [...scene.enemyThreat].map(([id, values]) => [id, [...values]]),
      events: [...scene.battleEvents].map(event => ({ kind: event.data.kind, remaining: event.timer.getRemaining() })) };
  });
  expect(restored.paused).toBe(true);
  expect(restored.gold).toBe(saved.gold);
  expect(restored.held).toEqual(saved.activeBattle.scene.heldUnitIds.values);
  expect(restored.attacks).toEqual(saved.activeBattle.scene.attackTargets.entries);
  const hero = restored.party[0];
  expect(hero.hp).toBe(saved.activeBattle.party[0].hp);
  expect(hero.mana).toBe(saved.activeBattle.party[0].mana);
  expect(hero.status).toEqual(saved.activeBattle.party[0].status);
  expect(hero.pendingAction).toEqual(saved.activeBattle.party[0].pendingAction);
  expect(hero.lastAttackAt).toBe(saved.activeBattle.party[0].lastAttackAt);
  expect(restored.threat).toEqual(saved.activeBattle.scene.enemyThreat.entries.map(([id, values]) => [id, values.entries]));
  const attack = restored.events.find(event => event.kind === 'attack');
  expect(attack.remaining).toBeCloseTo(saved.activeBattle.events.find(event => event.data.kind === 'attack').remainingMs, 3);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits[0].hp)).toBe(hero.hp);
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').togglePause());
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits[0].pendingAction?.startAt
    !== window.__DELVE_DEEP_VISUAL_QA__.state.activeBattle.party[0].pendingAction?.startAt);
  expect(errors).toEqual([]);
});

test('countdown restoration catches offline time without restarting the wave', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await startBattle(page);
  const before = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    qa.game.backgroundProgress.setHidden(true);
    const { saveProfile } = await import('/game/GameStorage.js');
    saveProfile();
    await Promise.resolve();
    const profile = JSON.parse(localStorage.getItem('delveDeep.profile.v2'));
    const event = profile.activeBattle.events.find(entry => entry.data.kind === 'countdown');
    profile.activeBattle.savedAtMs -= 10000;
    const { setBattleSaveProvider } = await import('/game/GameStorage.js');
    setBattleSaveProvider(null);
    qa.state.activeBattle = profile.activeBattle;
    localStorage.setItem('delveDeep.profile.v2', JSON.stringify(profile));
    const phase = profile.activeBattle.scene;
    return { countdown: Boolean(event) || (phase.waveTransitioning && !phase.waveRetreating
      && Number.isFinite(phase.idlePhaseRemainingMs)), time: profile.activeBattle.time };
  });
  expect(before.countdown).toBe(true);
  await reloadBattle(page);
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.backgroundProgress.pendingMs < 50);
  const result = await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    return { time: scene.time.now, wave: scene.currentWaveIndex, enemies: scene.enemies.length,
      cleared: scene.idleSummary?.waves ?? 0,
      started: scene.combatLog.entries.filter(entry => entry.type === 'wave' && entry.wave === 1
        && entry.message.includes('started')).length };
  });
  expect(result.time - before.time).toBeGreaterThanOrEqual(10000);
  expect(result.enemies > 0 || result.cleared > 0).toBe(true);
  expect(result.started).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('renderer termination restores farming and earns elapsed-time rewards', async ({ page, context }) => {
  test.setTimeout(180000);
  await startBattle(page);
  const before = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    qa.game.backgroundProgress.setHidden(true);
    scene.time.removeAllEvents();
    scene.battleEvents.clear();
    scene.partyUnits.forEach(unit => {
      unit.maxHp = 1000000;
      unit.hp = unit.maxHp;
      unit.attackPower = 100000;
      unit.spellDamage = 100000;
    });
    qa.state.delveCheckpoints[qa.state.currentDelve.id] = { nextWave: scene.bossWaveIndex, campUnlocked: true };
    qa.state.run.entry = 'farm';
    scene.startWave(scene.bossWaveIndex - 1);
    const { saveProfile, setBattleSaveProvider } = await import('/game/GameStorage.js');
    saveProfile();
    await Promise.resolve();
    const profile = JSON.parse(localStorage.getItem('delveDeep.profile.v2'));
    profile.activeBattle.savedAtMs -= 60000;
    setBattleSaveProvider(null);
    qa.state.activeBattle = profile.activeBattle;
    localStorage.setItem('delveDeep.profile.v2', JSON.stringify(profile));
    return profile.gold;
  });
  const session = await context.newCDPSession(page);
  const crashed = page.waitForEvent('crash');
  session.send('Page.crash').catch(() => {});
  await crashed;
  await page.close();
  const reopened = await context.newPage();
  const errors = [];
  reopened.on('pageerror', error => errors.push(error.message));
  await reopened.goto('/?visualQa=1');
  await reopened.waitForFunction(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa?.game.scene.getScene('BattleScene');
    return scene?.sys.isActive() && !scene.restoringBattle && qa.game.backgroundProgress.pendingMs < 50;
  });
  const result = await reopened.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    return { gold: qa.state.gold, farming: qa.state.run.entry === 'farm',
      defeated: scene.battleOver, checkpoint: qa.state.delveCheckpoints[qa.state.currentDelve.id] };
  });
  expect(result.farming).toBe(true);
  expect(result.defeated).toBe(false);
  expect(result.gold).toBeGreaterThan(before);
  expect((result.gold - before) % 24).toBe(0);
  expect(result.checkpoint.campUnlocked).toBe(true);
  expect(errors).toEqual([]);
  await reopened.close();
});

test('completed victory restores its result without awarding gold or progression again', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await startBattle(page);
  const before = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    scene.earnedGold = 123;
    scene.finishVictory();
    await Promise.resolve();
    return { gold: qa.state.gold, clears: qa.state.records[qa.state.currentDelve.id].clears,
      xp: qa.state.roster.map(hero => hero.xp), leader: qa.state.leader };
  });
  await reloadBattle(page);
  const after = await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    scene.finishVictory();
    return { gold: qa.state.gold, clears: qa.state.records[qa.state.currentDelve.id].clears,
      xp: qa.state.roster.map(hero => hero.xp), leader: qa.state.leader };
  });
  expect(after).toEqual(before);
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').scene.start('RewardScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RewardScene').sys.isActive());
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('delveDeep.profile.v2')).activeBattle)).toBeNull();
  await page.reload();
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.gold)).toBe(before.gold);
  expect(errors).toEqual([]);
});

test('charges, traps and fixed ground-attack warnings reconnect after reload', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await startBattle(page);
  const before = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    const progress = qa.game.backgroundProgress;
    progress.setHidden(true);
    progress.now = () => Date.now() + 8000;
    while (progress.pendingMs >= 50 || !scene.enemies.length) {
      progress.pump();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    scene.time.removeAllEvents();
    scene.battleEvents.clear();
    [...scene.partyUnits, ...scene.enemies].forEach(unit => unit.finishAction());
    const unit = scene.partyUnits[0];
    const enemy = scene.enemies.find(entry => entry.alive);
    enemy.abilities.primary = { name: 'Saved ground attack', effect: 'damage', windup: 3500,
      telegraph: 3500, cooldown: 5000, radius: 120, power: 100, damageType: 'physical', manaCost: 0 };
    scene.beginGroundSlam(enemy, unit, scene.time.now, enemy.abilities.primary);
    const ability = { name: 'Saved charge', effect: 'damage', charge: true, range: 3,
      power: 100, damageType: 'physical', manaCost: 0 };
    unit.startAction(ability.name, scene.time.now, 100);
    const started = scene.classAbilitySystem.startCharge(unit, enemy, ability, unit.pendingAction);
    scene.classAbilitySystem.traps.push({ owner: unit, point: { arenaX: 500, arenaY: 500, alive: true },
      ability: { name: 'Saved trap', effect: 'trap', power: 100, damageType: 'physical' }, wave: scene.currentWaveIndex });
    scene.togglePause();
    const { saveProfile } = await import('/game/GameStorage.js');
    saveProfile();
    await Promise.resolve();
    return { started, ownerId: unit.id, enemyId: enemy.id,
      center: { x: scene.activeTelegraphs[0].arenaX, y: scene.activeTelegraphs[0].arenaY },
      charge: unit.charge, mana: unit.mana, enemyMana: enemy.mana };
  });
  expect(before.started).toBe(true);
  await reloadBattle(page);
  const after = await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const unit = scene.partyUnits[0];
    const warning = scene.activeTelegraphs[0];
    return { ownerId: unit.id, enemyId: warning.attacker.id,
      center: { x: warning.arenaX, y: warning.arenaY }, charge: unit.charge,
      mana: unit.mana, enemyMana: warning.attacker.mana,
      trapOwnerMatches: scene.classAbilitySystem.traps[0].owner === unit,
      chargeTweens: scene.classAbilitySystem.chargeTweens.size };
  });
  expect(after.ownerId).toBe(before.ownerId);
  expect(after.enemyId).toBe(before.enemyId);
  expect(after.center).toEqual(before.center);
  expect(after.charge.point).toEqual(before.charge.point);
  expect(after.charge.duration).toBe(before.charge.duration - before.charge.elapsed);
  expect(after.mana).toBe(before.mana);
  expect(after.enemyMana).toBe(before.enemyMana);
  expect(after.trapOwnerMatches).toBe(true);
  expect(after.chargeTweens).toBe(1);
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').togglePause());
  await page.waitForFunction(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return scene.classAbilitySystem.chargeTweens.size === 0 && scene.activeTelegraphs.length === 0;
  });
  expect(errors).toEqual([]);
});

test('farm reward and cleared-wave return restore atomically without a second payment', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await startBattle(page);
  const before = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    qa.game.backgroundProgress.setHidden(true);
    scene.time.removeAllEvents();
    scene.battleEvents.clear();
    scene.currentWaveIndex = scene.bossWaveIndex - 1;
    qa.state.delveCheckpoints[qa.state.currentDelve.id] = { nextWave: scene.bossWaveIndex, campUnlocked: true };
    qa.state.run.entry = 'farm';
    scene.waveTransitioning = false;
    scene.enemies = [];
    scene.completeWave();
    scene.combatPaused = true;
    scene.time.paused = true;
    const { saveProfile } = await import('/game/GameStorage.js');
    saveProfile();
    await Promise.resolve();
    return { gold: qa.state.gold, materials: qa.state.inventory.materials,
      xp: qa.state.roster.map(hero => hero.xp), wave: scene.currentWaveIndex };
  });
  await reloadBattle(page);
  const after = await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    scene.completeWave();
    return { gold: qa.state.gold, materials: qa.state.inventory.materials,
      xp: qa.state.roster.map(hero => hero.xp), wave: scene.currentWaveIndex,
      returning: scene.waveRetreating, farming: qa.state.run.entry === 'farm' };
  });
  expect(after).toEqual({ ...before, returning: true, farming: true });
  await reloadBattle(page);
  expect(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.gold)).toBe(before.gold);
  expect(errors).toEqual([]);
});
