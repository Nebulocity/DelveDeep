import { test, expect } from '@playwright/test';

// Inspect the actual Phaser drawings with real sprite bounds and resolved abilities.
test('Physical status motifs follow combat and fade on consumption', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return s?.sys.isActive() && s.enemies?.some(unit => !unit.landing) && !s.waveTransitioning;
  });
  const result = await page.evaluate(async () => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    s.combatPaused = true;
    s.time.paused = true;
    effects.clearAbilityEffects(s);

    // Remove naturally cast starter statuses before setting this deterministic view.
    for (const unit of [...s.partyUnits, ...s.enemies]) {
      unit.status.replacementDisarmUntil = 0;
      unit.status.replacementEffects = [];
      delete unit.status.replacementIntercept;
    }
    const [caster, ally, holder] = s.partyUnits;
    const enemy = s.getLivingEnemies()[0];

    // Bring one recipient clear of the spawn crowd so both monster motifs are visible.
    enemy.setArenaPosition(700, 250);
    const prefix = 'ability_v2_generic_physical_';
    enemy.status.replacementDisarmUntil = s.time.now + 2000;
    enemy.status.replacementEffects = [{ key: prefix + 'hamstring:harmful', until: s.time.now + 6000 }];
    holder.status.replacementEffects = [{ key: prefix + 'hold_the_line:beneficial', until: s.time.now + 6000 }];
    ally.status.replacementIntercept = { ownerId: caster.id, until: s.time.now + 6000 };
    effects.createAbilityEffect(s, caster, ally, { id: prefix + 'interpose' });
    effects.updateAbilityEffects(s, 0);
    const count = s.physicalAbilityEffects.length;
    const guard = s.physicalAbilityEffects.find(effect => effect.target === ally);
    if (!guard) throw new Error(JSON.stringify({ count, textures: ['protection', 'disarm', 'hamstring'].map(name => s.textures.exists('physical-' + name)), casterAlive: caster.alive, allyAlive: ally.alive, now: s.time.now, status: ally.status.replacementIntercept, battleOver: s.battleOver }));
    const x = guard.image.x;
    ally.setArenaPosition(ally.arenaX + 80, ally.arenaY);
    effects.updateAbilityEffects(s, 0);
    const follows = guard.image.x !== x;
    delete ally.status.replacementIntercept;
    effects.updateAbilityEffects(s, 200);
    const paused = guard.fadeElapsed === 0;
    s.combatPaused = false;
    effects.updateAbilityEffects(s, 200);
    const fading = guard.image.active && guard.image.alpha > 0 && guard.image.alpha < 0.5;
    s.combatPaused = true;
    return { count, follows, paused, fading };
  });
  expect(result).toEqual({ count: 5, follows: true, paused: true, fading: true });
  await page.screenshot({ path: `output/qa/physical-effects/battle-${page.viewportSize().width}.png` });
  await page.evaluate(async () => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    effects.clearAbilityEffects(s);
    if (s.physicalAbilityEffects.length) throw new Error('Shutdown left physical art behind');
  });
  expect(errors).toEqual([]);
});

// Use real sprite silhouettes to review restrained strikes and a directional trail.
test('Physical Assault sheets remain readable and pause their fades', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return s?.sys.isActive() && s.enemies?.some(unit => !unit.landing) && !s.waveTransitioning;
  });
  const size = page.viewportSize().width;
  for (const type of ['charge-trail', 'charge', 'cleave', 'kick', 'lacerate']) {
    const result = await page.evaluate(async type => {
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      const effects = await import('/combat/AbilityEffect.js');
      s.combatPaused = true;
      s.time.paused = true;
      effects.clearAbilityEffects(s);
      const caster = s.partyUnits.find(unit => unit.className === 'Gladiator') ?? s.partyUnits[0];
      const enemy = s.getLivingEnemies()[0];

      // Separate the reviewed pair from the crowd so their silhouettes and VFX are clear.
      for (const unit of [...s.partyUnits, ...s.enemies]) unit.container.setVisible(unit === caster || unit === enemy);
      enemy.setArenaPosition(caster.arenaX + 320, caster.arenaY);
      caster.charge = null;
      enemy.status.replacementPeriodic = [];
      const prefix = 'ability_v2_generic_physical_';
      if (type === 'charge-trail') {
        caster.charge = { ability: { id: prefix + 'charge' }, startX: caster.arenaX,
          startY: caster.arenaY, point: { x: caster.arenaX + 300, y: caster.arenaY + 80 } };
      } else {
        effects.createAbilityEffect(s, caster, enemy, { id: prefix + type });
        if (type === 'lacerate') enemy.status.replacementPeriodic = [
          { ability: { id: prefix + type }, kind: 'damage', remaining: 3, until: s.time.now + 6000 }
        ];
      }
      s.combatPaused = false;
      effects.updateAbilityEffects(s, 300);
      s.combatPaused = true;
      const drawings = s.physicalAssaultEffects;
      const frames = drawings.map(effect => effect.image.frame.name);
      effects.updateAbilityEffects(s, 1000);
      return { count: drawings.length, paused: drawings.every((effect, i) => effect.image.frame.name === frames[i]),
        visible: drawings.every(effect => effect.image.active && effect.image.alpha > 0),
        loaded: ['charge-trail', 'charge-impact', 'cleave', 'kick', 'lacerate'].every(name => s.textures.exists('physical-' + name)) };
    }, type);
    expect(result).toEqual({ count: type === 'lacerate' ? 2 : 1, paused: true, visible: true, loaded: true });
    await page.screenshot({ path: `output/qa/physical-effects/${type}-${size}.png` });
  }
  const lifecycle = await page.evaluate(async () => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const effects = await import('/combat/AbilityEffect.js');
    s.enemies.forEach(enemy => { enemy.status.replacementPeriodic = []; });
    for (const unit of s.partyUnits) unit.charge = null;
    s.combatPaused = false;
    effects.updateAbilityEffects(s, 200);
    const fading = s.physicalAssaultEffects.every(effect => effect.image.active && effect.fadeElapsed !== null);
    s.combatPaused = true;
    const alphas = s.physicalAssaultEffects.map(effect => effect.image.alpha);
    effects.updateAbilityEffects(s, 2000);
    const paused = s.physicalAssaultEffects.every((effect, i) => effect.image.alpha === alphas[i]);
    effects.updateAbilityEffects(s, 0, true);
    return { fading, paused, cleared: s.physicalAssaultEffects.length === 0 };
  });
  expect(lifecycle).toEqual({ fading: true, paused: true, cleared: true });
  expect(errors).toEqual([]);
});
