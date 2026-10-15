// Exercise the replacement catalog and combat state directly. Real damage and mitigation
// methods are loaded without Phaser drawing so a failed rule has a small, readable fixture.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import { REPLACEMENT_ABILITY_ROWS } from '../data/replacementAbilityCatalog.js';
import { CLASS_CATALOG_NAMES, CLASS_ABILITY_RULES, abilityAllowed } from '../data/replacementAbilities.js';
import { battleAbilities, rankedAbility, restoreAdventurerAbilities } from '../game/AdventurerAbilities.js';
import { hitAccuracy, abilityPower, characterStats } from '../game/CharacterStats.js';
import adventurers from '../data/adventurers.js';
import { armorReduction, cappedChance } from '../config/characterProgression.js';
import { packBattleValue, unpackBattleValue } from '../game/BattleSnapshot.js';
import GameState from '../game/GameState.js';
import { grantPotionPack, consumePotionCharge } from '../game/Equipment.js';
import System from '../combat/ClassAbilitySystem.js';
import { replacementMultiplier, replacementChance } from '../combat/ReplacementEffects.js';
import { equipmentPerkBonus } from '../game/EquipmentPerks.js';
import { replacementDescription } from '../game/ReplacementAbilityDescriptions.js';
import { progressionResources } from '../config/characterProgression.js';

function headlessClass(path, name, globals) {
  const context = vm.createContext(globals);
  vm.runInContext(fs.readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '')
    .replace(`export default class ${name}`, `globalThis.Subject = class ${name}`), context);
  return context.Subject;
}
const Unit = headlessClass('../combat/BattleUnit.js', 'BattleUnit', { replacementMultiplier, armorReduction, characterStats });
const Battle = headlessClass('../scenes/BattleScene.js', 'BattleScene', {
  Phaser: { Scene: class {}, Math: { Clamp: (value, lower, upper) => Math.max(lower, Math.min(upper, value)) } },
  hitAccuracy, abilityPower, cappedChance, replacementMultiplier, replacementChance, equipmentPerkBonus, GameState
});
let serial = 0;

function fixture(className = 'Mage of the Umbral Veil') {
  const make = (id, enemy, x) => Object.assign(Object.create(Unit.prototype), {
    id, name: id, className, isEnemy: enemy, isBoss: false, alive: true, hp: 3000, maxHp: 5000, mana: 400, maxMana: 1000,
    attackPower: 500, spellDamage: 500, spellHealing: 500, armor: 0, dodge: 0, block: 0, hitChance: .1,
    critChance: 0, critMultiplier: 1.3, statProgressionVersion: 2, damageTakenMultiplier: 1, speed: 100,
    arenaX: x, arenaY: 250, container: { x, y: 250, active: true }, status: {}, lastAbilityAt: {}, delvesUsed: {}, role: enemy ? '' : CLASS_DEFINITIONS[className].role,
    abilities: Object.fromEntries(Object.entries(CLASS_DEFINITIONS[className].abilities).map(([key, a]) => [key, { ...rankedAbility(a, 1), manaCost: Math.round(1000 * a.manaFraction) }])),
    moveSpeed: 100, attackRange: 100, attackCooldown: 1000, attackWindup: 300, healCooldown: 1000, healWindup: 300,
    basicAttackDamageType: 'physical', lastAttackAt: -Infinity, lastHealAt: -Infinity, pendingAction: null,
    updateHealthBar() {}, flash() {}, playCriticalHit() {}, setTargetName() {},
    finishAction() { this.pendingAction = null; },
    startAction(name, time, duration) { this.pendingAction = { id: ++serial, name, startAt: time, duration }; return true; },
    setArenaPosition(x, y) { this.arenaX = x; this.arenaY = y; },
    setStealthed(value) { this.stealthed = value; },
    defeat() { this.hp = 0; this.alive = false; this.finishAction(); },
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    revive(health, mana) { this.alive = true; this.hp = this.maxHp * health; this.mana = this.maxMana * mana; this.status = {}; },
    moveToward(x, y) { this.setArenaPosition(x, y); }
  });
  const caster = make('caster', false, 250), ally = make('ally', false, 450);
  const enemy = make('enemy', true, 350), other = make('other', true, 380);
  ally.hp = 1000;
  enemy.currentTargetId = ally.id;
  other.currentTargetId = ally.id;
  GameState.roster = [caster, ally];
  GameState.inventory = { equipment: [], nextEquipmentId: 1 };
  const scene = Object.assign(Object.create(Battle.prototype), {
    partyUnits: [caster, ally], enemies: [enemy, other], currentWaveIndex: 0, time: { now: 0 }, battlefield: { logicalWidth: 1000, logicalHeight: 600 },
    attackTargets: new Map(), activeTelegraphs: [], abilityDecoys: [], enemyThreat: new Map(), heldUnitIds: new Set(),
    events: [], damageLog: [], healLog: [],
    combatRandom: () => .99, getLivingEnemies() { return this.enemies.filter(enemy => enemy.alive); },
    isPositionLocked: () => false, getPrimaryTarget: () => enemy, isActionCurrent: (unit, action) => unit.alive && unit.pendingAction === action,
    announceAbility() {}, logActionStart() {}, generateAbilityThreat() {}, createFloatingText() {}, createProjectile() {}, createMeleePulse() {},
    createAbilityEffect() {}, createAbilityTelegraph() {}, clearAbilityTelegraph() {}, flashPartyHudName() {}, addThreat() {}, getThreatSnapshot: () => [], handleEnemyDeath() {},
    combatLog: { add(kind, message, entry) { if (kind === 'damage') scene.damageLog.push(entry); if (kind === 'healing') scene.healLog.push(entry); } },
    scheduleBattleEvent(delay, data, fn) { this.events.push({ delay, data, fn }); },
    applyTankTaunt(unit, targets) { for (const target of targets) target.status.forcedTargetId = unit.id; },
    createAbilityDecoy(owner, template, point, health, until) {
      const decoy = make('decoy', false, point.x); Object.assign(decoy, { hp: health, maxHp: health, isDecoy: true, decoyUntil: until, decoyWave: 0, container: { destroy() {} }, syncPresentation() {} });
      decoy.setArenaPosition(point.x, point.y); this.abilityDecoys.push(decoy); return decoy;
    }
  });
  for (const unit of [caster, ally, enemy, other]) unit.scene = scene;
  const system = scene.classAbilitySystem = new System(scene);
  const ability = name => Object.values(caster.abilities).find(a => a.name === name);
  return { caster, ally, enemy, other, scene, system, runtime: system.replacement, ability };
}

assert.equal(REPLACEMENT_ABILITY_ROWS.length, 180);
assert.equal(new Set(REPLACEMENT_ABILITY_ROWS.map(row => row.id)).size, 180);
for (const [name, definition] of Object.entries(CLASS_DEFINITIONS)) {
  const rules = CLASS_ABILITY_RULES[CLASS_CATALOG_NAMES[name] ?? name];
  const starters = Object.values(definition.abilities).filter(a => a.starter);
  assert.equal(starters.length, 3);
  assert.equal(starters.filter(a => a.origin === 'Generic').length, 1);
  assert.equal(starters.filter(a => a.origin === 'Class' && a.category === rules[1]).length, 1);
  assert.equal(starters.filter(a => a.origin === 'Class' && a.category === rules[2]).length, 1);
  assert.ok(Object.values(definition.abilities).every(a => a.replacement && abilityAllowed(name, a)));

  // All caster loadouts, including shared generics, must show a positive Mana cost.
  // Training improves the effects without raising the fraction spent per cast.
  if (rules[0] === 'Magical') for (const ability of Object.values(definition.abilities)) {
    assert.ok(Number.isFinite(ability.manaFraction) && ability.manaFraction > 0, `${name}: ${ability.name}`);
    assert.equal(rankedAbility(ability, 10).manaFraction, ability.manaFraction);
    const description = replacementDescription({ maxMana: 1000, attackPower: 500, spellDamage: 500, spellHealing: 500 }, ability);
    assert.ok(description.includes(`Cost: ${Math.round(1000 * ability.manaFraction)} Mana`), ability.name);
  }
}
assert.equal(Object.values(CLASS_DEFINITIONS.Gladiator.abilities).some(a => a.category === 'Restore'), false);

// Test real starting Health and Spell Healing: an ordinary heal must leave a badly
// injured healer needing more recovery. Higher ranks still reward training normally.
for (const className of ['Cleric of the Verdant Covenant', 'Cleric of the Everbright', 'Cleric of the Sanguine Song']) {
  const recovery = fixture(className);
  const stats = progressionResources(className, 1);
  Object.assign(recovery.caster, { maxHp: stats.maxHp, hp: 25, spellHealing: stats.spellHealing });
  const heal = Object.values(recovery.caster.abilities).find(a => a.starter && a.category === 'Restore');
  recovery.runtime.resolve(recovery.caster, recovery.caster, heal, 0);
  assert.ok(recovery.caster.hp > 25 && recovery.caster.hp < stats.maxHp, heal.name);
  assert.ok(Math.abs(rankedAbility(heal, 2).primary.potency - (heal.primary.potency + 0.05)) < 1e-9);
  assert.equal(CLASS_DEFINITIONS[className].manaRegen, 2);
}

// The catalog remains intact for reference. Saved ability records carry their old
// potency through packing, whereas newly built abilities and tooltips use tuned values.
const oldBloodMend = REPLACEMENT_ABILITY_ROWS.find(a => a.name === 'Blood Mend');
const newBloodMend = fixture('Cleric of the Sanguine Song').ability('Blood Mend');
assert.equal(oldBloodMend.primary.potency, 1.2);
assert.equal(unpackBattleValue(packBattleValue(oldBloodMend)).primary.potency, 1.2);
assert.equal(newBloodMend.primary.potency, .3);
assert.ok(replacementDescription({ spellHealing: 500, maxMana: 500 }, newBloodMend).includes('Restores 150 health'));

// A one-time respec excludes free starter ranks and refunds the minimum historical fee.
const prior = { skillPoints: 2, abilityRanks: { roar: 3, net: 1 }, abilityLoadout: ['roar', 'net'] };
const migrated = restoreAdventurerAbilities({ className: 'Gladiator', level: 10 }, prior);
assert.equal(migrated.skillPoints, 8);
assert.equal(migrated.abilityMigrationGoldCredit, 325);
assert.equal(migrated.abilityLoadout.length, 3);
const reloaded = restoreAdventurerAbilities({ className: 'Gladiator', level: 10 }, migrated);
assert.equal(reloaded.skillPoints, 8);
assert.equal(reloaded.abilityMigrationGoldCredit, 0);
assert.equal(Object.keys(battleAbilities(reloaded)).length, 3);

// Mana recovery still spends Mana at commitment. Too little Mana cannot start a cast
// or set its cooldown; successful resolution returns more Mana than the cost at rank 1.
const recoveryCosts = [
  ['Dawnwarden', 'Devotion', .02, 530],
  ['Mage of the Umbral Veil', 'Dark Meditation', .03, 520],
  ['Mage of the Umbral Veil', 'Essence Drain', .02, 480],
  ['Mage of the Crimson Spire', 'Infusion', .02, 500]
];
for (const [className, name, fraction, finalMana] of recoveryCosts) {
  const recovery = fixture(className);
  const ability = recovery.ability(name);
  const target = ability.handler === 'manaDrain' ? recovery.enemy : recovery.caster;
  assert.equal(ability.manaFraction, fraction);
  recovery.caster.mana = ability.manaCost - 1;
  assert.equal(recovery.caster.abilityReady(ability.id, 0), false, name);
  assert.equal(recovery.runtime.cast(recovery.caster, target, ability.id, 0), false, name);
  assert.equal(recovery.caster.lastAbilityAt[ability.id], undefined, name);
  assert.equal(recovery.scene.events.length, 0, name);

  recovery.caster.mana = 400;
  assert.equal(recovery.runtime.cast(recovery.caster, target, ability.id, 0), true, name);
  assert.equal(recovery.caster.mana, 400 - ability.manaCost, name);
  assert.equal(recovery.caster.lastAbilityAt[ability.id], 0, name);
  recovery.scene.time.now = ability.windup;
  recovery.scene.events[0].fn();
  recovery.scene.time.now += ability.duration;
  recovery.runtime.tick(recovery.scene.time.now);
  assert.equal(recovery.caster.mana, finalMana, name);
  if (ability.healthFraction) assert.equal(recovery.caster.hp, 2820, 'Infusion still pays its Health cost.');
}

let f = fixture('Gladiator');

// Construct real healer models without their drawing layer. Mend uses the final Mana
// pool, spends once at cast start, and preserves an explicitly saved zero cost.
class ManaUnit extends Unit {
  createPresentation() {}
}
for (const hero of adventurers.filter(hero => hero.role === 'Healer')) {
  const model = new ManaUnit({}, { ...hero, battlefield: { logicalWidth: 1000, logicalHeight: 600 } });
  assert.equal(model.basicHealManaCost, 10, `${hero.name}: level-1 Mend costs 2% of 500 Mana.`);
  const geared = new ManaUnit({}, { ...hero, maxMana: 950, battlefield: { logicalWidth: 1000, logicalHeight: 600 } });
  assert.equal(geared.basicHealManaCost, 19, hero.name);
  const saved = new ManaUnit({}, { ...hero, basicHealManaCost: 0, battlefield: { logicalWidth: 1000, logicalHeight: 600 } });
  assert.equal(saved.basicHealManaCost, 0, 'An explicit legacy cost remains compatible.');

  f = fixture(hero.className);
  f.caster.maxMana = model.maxMana;
  for (const ability of Object.values(f.caster.abilities)) ability.manaCost = Math.round(model.maxMana * ability.manaFraction);
  f.caster.basicHealManaCost = model.basicHealManaCost;
  f.caster.basicHealPower = model.basicHealPower;
  f.caster.basicHealRange = model.basicHealRange;

  // Use the real HUD refresh with small drawing stand-ins. Both the numeric label
  // and blue bar must read the battle unit's Mana, including fractions and depletion.
  const view = () => ({
    setText(text) { this.text = text; return this; },
    setVisible(visible) { this.visible = visible; return this; },
    setDisplaySize(width) { this.width = width; return this; },
    setFillStyle() {}, setStrokeStyle() {}
  });
  const card = { unit: f.caster, hpText: view(), manaText: view(), threatText: view(),
    hpFill: view(), hpGlow: view(), manaBack: view(), manaFill: view(), hudBarWidth: 200 };
  f.scene.partyHud = [card];
  f.scene.refreshPartySelection = () => {};
  f.scene.updateLeaderLoadoutBar = () => {};
  f.scene.updatePotionHud = () => {};
  f.scene.updateEncounterStatus = () => {};
  const checkCard = () => {
    f.scene.updateHud();
    assert.equal(card.manaText.text, `${Math.floor(f.caster.mana)} / ${f.caster.maxMana}`, hero.name);
    assert.ok(Math.abs(card.manaFill.width - 200 * f.caster.mana / f.caster.maxMana) < 1e-9, hero.name);
    assert.equal(card.manaFill.visible, f.caster.mana > 0, hero.name);
  };
  f.caster.mana = 9;
  f.scene.beginBasicHeal(f.caster, f.ally, 0);
  assert.equal(f.caster.pendingAction, null, hero.name);
  assert.equal(f.caster.lastHealAt, -Infinity, hero.name);
  f.caster.mana = 10;
  f.scene.beginBasicHeal(f.caster, f.ally, 0);
  assert.equal(f.caster.mana, 0, hero.name);
  checkCard();
  assert.equal(f.caster.lastHealAt, 0, hero.name);
  f.scene.events[0].fn();
  assert.equal(f.caster.mana, 0, 'Resolving Mend never pays again.');
  assert.equal(f.ally.hp, 1040, hero.name);

  // Canceling a paid action releases its healing reservation without returning Mana.
  f.scene.time.now = 1000;
  f.caster.mana = 10;
  f.scene.beginBasicHeal(f.caster, f.ally, 1000);
  f.caster.finishAction();
  f.scene.events[1].fn();
  assert.equal(f.caster.mana, 0, hero.name);
  assert.equal(f.ally.hp, 1040, 'An interrupted Mend cannot restore Health.');
  f.caster.manaRegen = hero.manaRegen;
  f.caster.regenMana(10 / hero.manaRegen);
  checkCard();
  f.caster.regenMana(.03125);
  checkCard();
  assert.equal(f.caster.canHeal(2000), true, 'Natural regeneration permits Mend after depletion.');

  // The card also follows a paid starter healing spell for every healer class.
  f.caster.mana = 400;
  f.scene.time.now = 2000;
  const starterHeal = Object.values(f.caster.abilities).find(ability => ability.starter && ability.category === 'Restore' && ability.origin === 'Class');
  assert.equal(f.runtime.cast(f.caster, f.ally, starterHeal.id, 2000), true, hero.name);
  assert.equal(f.caster.mana, 400 - starterHeal.manaCost, hero.name);
  checkCard();
  assert.equal(unpackBattleValue(packBattleValue({ basicHealManaCost: model.basicHealManaCost })).basicHealManaCost, 10);
}

f = fixture('Gladiator');
const blow = f.ability('Punishing Blow');
const rank10 = rankedAbility(blow, 10);
assert.equal(rank10.primary.potency, 2.2);
assert.equal(rank10.secondary.potency, 0.55);
assert.equal(rank10.cooldown, 10500);
f.runtime.resolve(f.caster, f.enemy, blow, 0);
assert.equal(f.enemy.hp, 2575);
assert.equal(replacementMultiplier(f.enemy, 'attack', 0), .9);
assert.equal(replacementMultiplier(f.enemy, 'attack', 7000), 1);

// A periodic effect delivers its total exactly, including its last partial interval.
f = fixture('Ranger');
const bleed = rankedAbility(f.ability('Lacerate'), 10);
f.runtime.resolve(f.caster, f.enemy, bleed, 0);
const saved = unpackBattleValue(packBattleValue(f.enemy.status));
f.enemy.status = saved;
for (const time of [2000, 4000, 6000, bleed.duration]) { f.scene.time.now = time; f.runtime.tick(time); }
assert.ok(Math.abs(f.enemy.hp - (3000 - 500 * bleed.primary.potency)) <= 2, 'Final rounding is bounded by one HP per tick.');
const after = f.enemy.hp; f.runtime.tick(bleed.duration + 1000); assert.equal(f.enemy.hp, after);

// A one-use preparation is consumed on a basic attack, with a separate crit bonus.
f = fixture('Barbarian');
f.runtime.resolve(f.caster, f.caster, f.ability('Ready Weapon'), 0);
f.runtime.resolve(f.caster, f.caster, f.ability('Battle Instinct'), 0);
assert.deepEqual(f.runtime.basicPreparation(f.caster), { multiplier: 1.15, criticalBonus: .08 });
assert.deepEqual(f.runtime.basicPreparation(f.caster), { multiplier: 1, criticalBonus: 0 });

// Restocking works after the permanent pack is exhausted, without creating inventory.
f = fixture('Barmaid');
const pack = grantPotionPack('mending-potion');
f.caster.equipment = { potion: pack.id };
f.runtime.initializePotion(f.caster);
for (let i = 0; i < 3; i++) consumePotionCharge(f.caster.id);
assert.equal(GameState.inventory.equipment.length, 0);
f.runtime.resolve(f.caster, f.caster, f.ability('Restock the Bar'), 0);
assert.equal(f.runtime.potion(f.caster).item.charges, 3);
f.runtime.consumePotion(f.caster);
assert.equal(f.runtime.potion(f.caster).item.charges, 2);
assert.equal(GameState.inventory.equipment.length, 0);
f.caster.delvesUsed[f.ability('Restock the Bar').id] = 0;
f.caster.revive(.5, .5);
assert.equal(f.runtime.usable(f.caster, f.ability('Restock the Bar'), 0), false);
assert.equal(f.runtime.potion(f.caster).item.charges, 2);
f.scene.currentWaveIndex = 1;
assert.equal(f.runtime.usable(f.caster, f.ability('Restock the Bar'), 0), true);

// Reflection uses actual damage and suppresses recursive reactions. Lethal exchange
// consumes once after mitigation and does not add a death or a second critical roll.
f = fixture('Cleric of the Verdant Covenant');
f.runtime.resolve(f.caster, f.ally, f.ability('Briarweave'), 0);
f.caster.status.replacementEffects = [{ key: 'power', until: 10000, changes: { attack: .5, spell: .5 } }];
f.scene.resolveDamage(f.enemy, f.ally, 100, 'enemy', 1, 'Attack', false);
assert.equal(f.enemy.hp, 2992);
assert.equal(f.ally.hp, 912);
f = fixture('Mage of the Crimson Spire');
f.ally.hp = 50;
f.runtime.resolve(f.caster, f.ally, f.ability('Equivalent Exchange'), 0);
f.scene.resolveDamage(f.enemy, f.ally, 100, 'enemy', 1, 'Attack', false);
assert.equal(f.ally.alive, true);
assert.equal(f.ally.hp, 189);
assert.equal(f.scene.damageLog.some(entry => entry.ability === 'Equivalent Exchange'), true);
assert.equal(f.ally.status.replacementReactions[0].until, 0);
assert.equal(f.scene.damageLog.find(entry => entry.ability === 'Equivalent Exchange').amount, 26);

// Meditation stops on periodic damage too. Vigilance's internal timer belongs to each
// attacker, so blocking two different attackers can stun both in the same combat frame.
f = fixture();
f.runtime.resolve(f.caster, f.caster, f.ability('Dark Meditation'), 0);
assert.ok(f.caster.status.replacementChannel);
f.runtime.afterDamage(f.enemy, f.caster, 1, false, false, { replacementTriggered: true });
assert.equal(f.caster.status.replacementChannel, null);
f = fixture('Oathwarden');
f.runtime.resolve(f.caster, f.caster, f.ability('Vigilance'), 0);
f.runtime.afterDamage(f.enemy, f.caster, 0, false, true, { physical: true });
f.runtime.afterDamage(f.other, f.caster, 0, false, true, { physical: true });
assert.ok(f.enemy.status.stunnedUntil > 0);
assert.ok(f.other.status.stunnedUntil > 0);

// A Mana preparation affects readiness and the single committed payment. It cannot
// refund the original cost or make a second spell free after the preparation is consumed.
f = fixture('Mage of the Luminous Archive');
f.runtime.resolve(f.caster, f.caster, f.ability('Lunar Alignment'), 0);
const restore = f.ability('Life Anchor');
const discounted = Math.round(restore.manaCost * .85);
f.caster.mana = discounted;
assert.equal(f.caster.abilityReady(restore.id, 0), true);
assert.equal(f.runtime.cast(f.caster, f.ally, restore.id, 0), true);
assert.equal(f.caster.mana, 0);
assert.equal(f.caster.status.replacementPreparations.length, 0);

// Area damage keeps its recipient, while a single-target hit consumes interception.
f = fixture('Gladiator');
const intercept = f.ability('Interpose');
f.runtime.resolve(f.caster, f.ally, intercept, 0);
f.scene.resolveDamage(f.enemy, f.ally, 100, 'enemy', 1, 'Area', false, { area: true });
assert.equal(f.caster.hp, 3000);
assert.equal(f.ally.hp, 900);
f.scene.resolveDamage(f.enemy, f.ally, 100, 'enemy', 1, 'Attack', false);
assert.equal(f.ally.hp, 900);
assert.equal(f.caster.hp, 2915);

// Cleanse removes one condition when specified, and cooldown AI waits for an eligible
// running timer. A confirmed miss cannot apply a damage skill's secondary debuff.
f = fixture('Gladiator');
f.ally.status.replacementPeriodic = [1, 2].map(id => ({ key: String(id), kind: 'damage', remaining: 2 }));
f.runtime.cleanse(f.ally, 1);
assert.equal(f.ally.status.replacementPeriodic.length, 1);
assert.equal(f.runtime.target(f.caster, f.ability('Tactical Reset')), null);
f.caster.lastAbilityAt[blow.id] = 0;
assert.equal(f.runtime.target(f.caster, f.ability('Tactical Reset')), f.caster);
f.enemy.minimumAccuracy = 2;
let missedArtwork = 0;
f.scene.createAbilityEffect = () => missedArtwork++;
f.runtime.resolve(f.caster, f.enemy, f.ability('Punishing Blow'), 0);
assert.equal(f.enemy.hp, 3000);
assert.equal(replacementMultiplier(f.enemy, 'attack', 0), 1);
assert.equal(missedArtwork, 0);
f = fixture('Dawnwarden');
f.runtime.resolve(f.caster, f.enemy, f.ability("Dawn's Shelter"), 0);
assert.equal(replacementMultiplier(f.caster, 'reduction', 0), .85);

// Every active catalog row can resolve without a missing mechanic or runtime error.
// Use injured allies, an entry potion, and a correctly faced enemy to satisfy prerequisites.
let exercised = 0;
for (const row of REPLACEMENT_ABILITY_ROWS) {
  const className = Object.keys(CLASS_DEFINITIONS).find(name => abilityAllowed(name, row));
  if (!className) continue;
  f = fixture(className);
  const a = Object.values(f.caster.abilities).find(a => a.id === row.id);
  const pack = grantPotionPack('mending-potion'); f.caster.equipment = { potion: pack.id }; pack.charges = 1;
  f.caster.stealthed = true;
  f.caster.arenaX = 250; f.enemy.arenaX = 350; f.ally.arenaX = 450;
  f.caster.knownAbilityRanks = Object.fromEntries(Object.keys(f.caster.abilities).map(key => [key, 1]));
  const target = a.handler === 'revive' ? f.ally : a.targetLabel === 'Self' || a.anchor === 'Caster' ? f.caster : a.target === 'ally' ? f.ally : f.enemy;
  if (a.handler === 'revive') f.ally.alive = false;
  if (a.handler === 'cleanse' || a.handler === 'cleanseSlowResistance' || a.handler === 'healCleanse') {
    target.status.replacementEffects = [{ key: 'test-slow', until: 10000, changes: { movement: -.1 }, harmful: true, removable: true }];
    f.caster.status.replacementEffects = [{ key: 'test-slow', until: 10000, changes: { movement: -.1 }, harmful: true, removable: true }];
  }
  if (a.handler === 'dispel') target.status.replacementEffects = [{ key: 'test-buff', until: 10000, changes: { armor: .1 }, harmful: false, removable: true }];
  f.runtime.initializePotion(f.caster);
  for (const unit of f.runtime.units()) for (const ability of Object.values(unit.abilities)) unit.lastAbilityAt[ability.id] = -ability.cooldown + 1000;
  const fingerprint = () => JSON.stringify(f.runtime.units().map(unit => ({ hp: unit.hp, mana: unit.mana, x: unit.arenaX, y: unit.arenaY, status: unit.status, potion: unit.replacementPotion, stealth: unit.stealthed, cooldowns: unit.lastAbilityAt })));
  const before = fingerprint();
  f.runtime.resolve(f.caster, target, a, 0);
  assert.notEqual(fingerprint(), before, `${row.name} must apply an effect, not silently resolve as a no-op.`);
  for (const time of [1000, 3000, 8000]) { f.scene.time.now = time; f.runtime.tick(time); }
  assert.ok(f.runtime.units().every(unit => Number.isFinite(unit.hp) && Number.isFinite(unit.mana)), row.name);
  exercised++;
}
assert.equal(exercised, 178);

// Early-return protection handlers must still call presentation on the recipient.
// Gameplay records are already applied when the visual callback runs.
for (const name of ['Hex', 'Spellbind', 'Nullify', 'Spellward']) {
  const row = REPLACEMENT_ABILITY_ROWS.find(row => row.name === name);
  const className = Object.keys(CLASS_DEFINITIONS).find(name => abilityAllowed(name, row));
  const f = fixture(className);
  const ability = f.ability(name);
  const target = name === 'Spellward' ? f.ally : f.enemy;
  target.status.replacementEffects = [{ key: 'test', until: 10000, changes: { armor: .1 },
    harmful: name === 'Spellward', removable: true }];
  const calls = [];
  f.scene.createAbilityEffect = (caster, recipient, skill) => calls.push({ recipient, skill });
  f.runtime.resolve(f.caster, target, ability, 0);
  assert.equal(calls.length, 1, `${name} starts exactly one visual`);
  assert.equal(calls[0].recipient, target);
  assert.equal(calls[0].skill.id, row.id);
}

// Hold the Line keeps its armor duration, but releases its self-root after the
// monsters leave Near reach so the Oathwarden can chase them.
const hold = fixture('Oathwarden');
hold.caster.status.replacementCostRootUntil = 6000;
hold.runtime.update(hold.caster, 1000);
assert.equal(hold.caster.status.replacementCostRootUntil, 6000, 'Nearby monsters keep the Hold the Line root');
hold.enemy.setArenaPosition(700, 250);
hold.other.setArenaPosition(760, 250);
hold.runtime.update(hold.caster, 1100);
assert.equal(hold.caster.status.replacementCostRootUntil, 1100, 'Distant monsters release movement without ending armor');
console.log('Replacement catalog: eligibility, starters, respec, rank scaling, saved ticks, potion limits, reactions, and all 178 active rows passed.');
