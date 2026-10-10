import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Inspect the finished sheets in a real battlefield at the configured phone/desktop
// viewport. Freeze normal combat so each screenshot shows a deliberate effect frame.
test('Supplied effects load, fly, pause and clean up in combat', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    qa.activate('BattleScene');
    const classes = ['Dawnwarden', 'Scoundrel', 'Ranger', 'Mage of the Umbral Veil', 'Cleric of the Everbright'];
    classes.forEach((className, index) => {
      qa.state.activeParty[index] = { ...qa.state.roster.find(hero => hero.className === className) };
    });
  });
  await page.waitForFunction(() => {
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    return s?.sys.isActive() && s.enemies?.some(e => !e.landing) && !s.waveTransitioning;
  });
  await mkdir('output/qa/supplied-effects', { recursive: true });
  const ids = await page.evaluate(async () => {
    const { ABILITY_EFFECTS } = await import('/data/abilityEffects.js');
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    s.combatPaused = true;
    s.time.paused = true;
    return ABILITY_EFFECTS.filter(effect => effect.id !== 'volley').map(effect => effect.id);
  });
  for (const id of ids) {
    const result = await page.evaluate(async id => {
      const { ABILITY_EFFECTS } = await import('/data/abilityEffects.js');
      const { CLASS_DEFINITIONS } = await import('/data/classes.js');
      const effects = await import('/combat/AbilityEffect.js');
      const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      for (const unit of [...s.partyUnits, ...s.enemies]) {
        unit.status.huntersMarkVisual = false;
        unit.status.sunlitWardVisualUntil = 0;
      }
      effects.clearAbilityEffects(s);
      const definition = ABILITY_EFFECTS.find(effect => effect.id === id);
      const caster = s.partyUnits.find(unit => unit.className === definition.className);
      const target = definition.followShield || definition.healing ? caster : s.getLivingEnemies()[0];
      if (id === 'smoke-bomb') target.setArenaPosition(caster.arenaX + 30, caster.arenaY + 30);
      const ability = Object.values(CLASS_DEFINITIONS[caster.className].abilities)
        .find(ability => ability.name === definition.abilityName);
      if (!ability) throw new Error(`Missing catalog skill: ${id}`);
      target.status.damageTakenBoost = 0.25;
      if (definition.followShield) {
        target.status.temporaryHp = 50;
        target.status.sunlitWardVisualUntil = s.time.now + ability.duration;
      }
      const action = { duration: 1000 };
      caster.pendingAction = action;

      // Use the same resolved circle as gameplay, so frontmost victims are part of
      // the coverage review instead of inspecting only the initially selected enemy.
      const anchor = ability.radius ? caster : target;
      const radius = ability.radius ?? ability.zone ?? ability.splash;
      const recipients = definition.coverUnits && radius
        ? s.getLivingEnemies().filter(enemy => Math.hypot(enemy.arenaX - anchor.arenaX,
          enemy.arenaY - anchor.arenaY) <= radius * 100) : [target];
      if (definition.coverUnits && recipients.length === 0) throw new Error(`No affected unit to review: ${id}`);
      const started = definition.projectile
        ? effects.createAbilityTelegraph(s, caster, target, ability, action)
        : effects.createAbilityEffect(s, caster, target, ability, recipients);
      const effect = s.abilityEffects[0];
      const pausedElapsed = effect.elapsed;
      effects.updateAbilityEffects(s, 400);
      const frozen = effect.elapsed === pausedElapsed;
      s.combatPaused = false;
      effects.updateAbilityEffects(s, definition.projectile ? 500 : Math.min(600, effect.duration * 0.5));
      s.combatPaused = true;
      return { started, frozen, count: s.abilityEffects.length,
        visible: effect.pieces.some(piece => piece.image.visible),
        loaded: definition.clips.every(clip => s.textures.exists(clip.key)),
        coversRecipients: !definition.coverUnits || recipients.every(unit =>
          effect.pieces.every(piece => piece.image.depth > unit.container.depth)),
        scale: effect.scale };
    }, id);
    expect(result.started).toBe(true);
    expect(result.loaded).toBe(true);
    expect(result.frozen).toBe(true);
    expect(result.count).toBe(1);
    expect(result.coversRecipients).toBe(true);
    expect(result.visible).toBe(true);
    expect(Number.isInteger(result.scale)).toBe(true);
    await page.screenshot({ path: `output/qa/supplied-effects/${id}-${page.viewportSize().width}.png` });
  }

  const lifetimes = await page.evaluate(async () => {
    const { CLASS_DEFINITIONS } = await import('/data/classes.js');
    const effects = await import('/combat/AbilityEffect.js');
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    for (const unit of [...s.partyUnits, ...s.enemies]) unit.status.sunlitWardVisualUntil = 0;
    effects.clearAbilityEffects(s);
    const target = s.getLivingEnemies()[0];
    const ranger = s.partyUnits.find(unit => unit.className === 'Ranger');
    const mark = Object.values(CLASS_DEFINITIONS.Ranger.abilities).find(a => a.name === "Hunter's Mark");
    s.classAbilitySystem.resolve(ranger, target, mark, s.time.now);
    target.status.damageTakenBoost = 0;
    s.combatPaused = false;
    effects.updateAbilityEffects(s, 12000);
    s.combatPaused = true;
    const survivedExpiry = s.abilityEffects.length === 1;
    target.arenaX += 40;
    effects.updateAbilityEffects(s, 0);
    const follows = s.abilityEffects[0].origin.x === s.battlefield.arenaToScreen(target.arenaX, target.arenaY).x;
    effects.clearAbilityEffects(s);
    effects.updateAbilityEffects(s, 0);
    const restored = s.abilityEffects.length === 1;
    target.alive = false;
    effects.updateAbilityEffects(s, 0);
    const died = s.abilityEffects.length === 0;
    target.alive = true;
    target.status.huntersMarkVisual = false;

    const caster = s.partyUnits.find(unit => unit.className === 'Dawnwarden');
    const ward = Object.values(CLASS_DEFINITIONS.Dawnwarden.abilities).find(a => a.name === 'Sunlit Ward');
    s.classAbilitySystem.resolve(caster, caster, ward, s.time.now);
    const bubble = s.abilityEffects[0];
    const sprite = caster.spriteVisual.image.getBounds();
    const ring = bubble.pieces[0].image.getBounds();
    const surrounds = ring.left < sprite.left && ring.right > sprite.right
      && ring.top < sprite.top && ring.bottom > sprite.bottom;
    const startX = bubble.origin.x;
    caster.arenaX += 40;
    effects.updateAbilityEffects(s, 0);
    const wardMoves = bubble.origin.x !== startX;
    caster.status.temporaryHp = 0;
    effects.updateAbilityEffects(s, 0);
    const absorbed = s.abilityEffects.length === 0;
    caster.status.sunlitWardVisualUntil = 0;
    return { survivedExpiry, follows, restored, died, surrounds, wardMoves, absorbed };
  });
  expect(lifetimes).toEqual({ survivedExpiry: true, follows: true, restored: true,
    died: true, surrounds: true, wardMoves: true, absorbed: true });

  // Use the real damage method for deterministic miss, dodge and hit outcomes.
  // High HP keeps the QA wave alive; these settings exist only in this browser run.
  const outcomes = await page.evaluate(async () => {
    const { CLASS_DEFINITIONS } = await import('/data/classes.js');
    const effects = await import('/combat/AbilityEffect.js');
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const ranger = s.partyUnits.find(unit => unit.className === 'Ranger');
    const target = s.getLivingEnemies()[0];
    const ability = Object.values(CLASS_DEFINITIONS.Ranger.abilities).find(a => a.name === 'Exploding Arrow');
    s.isEnemyEngaged = () => true;
    s.rollCritical = () => false;
    ranger.status.blindUntil = 0;
    target.hp = target.maxHp = 100000;
    target.status.immuneUntil = 0;
    target.statProgressionVersion = 2;
    const counts = [];
    for (const outcome of ['miss', 'dodge', 'hit']) {
      effects.clearAbilityEffects(s);
      target.minimumAccuracy = outcome === 'miss' ? 100 : 0;
      target.dodge = outcome === 'dodge' ? 0.3 : 0;
      s.combatRandom = () => outcome === 'dodge' ? 0 : 0.5;
      s.classAbilitySystem.resolve(ranger, target, ability, s.time.now);
      counts.push(s.abilityEffects.length);
    }
    return counts;
  });
  expect(outcomes).toEqual([0, 0, 1]);
  const cleaned = await page.evaluate(async () => {
    const effects = await import('/combat/AbilityEffect.js');
    const s = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
    const images = s.abilityEffects.flatMap(effect => effect.pieces.map(piece => piece.image));
    effects.updateAbilityEffects(s, 0, true);
    return images.every(image => !image.active) && s.abilityEffects.length === 0;
  });
  expect(cleaned).toBe(true);
  expect(errors).toEqual([]);
});
