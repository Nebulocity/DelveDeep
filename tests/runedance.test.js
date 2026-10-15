// These checks exercise fixed rune positions, real movement thresholds, one-shot
// triggers and snapshot round trips without depending on cosmetic Phaser objects.
import assert from 'node:assert/strict';
import { CLASS_DEFINITIONS } from '../data/classes.js';
import { RUNEDANCE_ABILITIES } from '../data/runedanceAbilities.js';
import { AUTHORED_EQUIPMENT } from '../data/equipmentCatalog.js';
import { progressionResources } from '../config/characterProgression.js';
import { resolveRune, tickRune, runeTarget, runesAfterDamage } from '../combat/RunedanceSystem.js';
import { packBattleValue, unpackBattleValue } from '../game/BattleSnapshot.js';

const dancer = { id: 'alhanna', alive: true, hp: 300, maxHp: 300, mana: 350, maxMana: 350,
  attackPower: 300, spellPower: 300, arenaX: 100, arenaY: 100, status: {}, abilities: {} };
const ally = { ...dancer, id: 'ally', hp: 100, maxHp: 1000, status: {}, arenaX: 140 };
const enemy = { ...dancer, id: 'enemy', isEnemy: true, hp: 10000, arenaX: 170, status: {} };
let now = 1000;
const hits = [], heals = [], modifiers = [];
const system = {
  scene: { currentWaveIndex: 0, isPositionLocked: () => true, getPrimaryTarget: () => enemy },
  now: () => now, enemies: () => [enemy], allies: () => [dancer, ally],
  damage: (owner, target, amount, ability, triggered, extras) => { hits.push({ amount, triggered, extras }); return { amount }; },
  heal: (owner, target, amount) => { heals.push(amount); target.hp += amount; },
  mana: (target, amount) => { target.mana = Math.min(target.maxMana, target.mana + amount); },
  modifier: (...args) => modifiers.push(args), control: () => {}, parent: {}
};
const skill = handler => Object.values(CLASS_DEFINITIONS.Runedance.abilities).find(a => a.handler === handler);
assert.equal(RUNEDANCE_ABILITIES.length, 12);
assert.equal(Object.values(CLASS_DEFINITIONS.Runedance.abilities).filter(a => a.starter).length, 3);
assert.deepEqual(Object.values(CLASS_DEFINITIONS.Runedance.abilities).filter(a => a.starter).map(a => a.category), ['Assault', 'Protect', 'Prepare']);
assert.equal(progressionResources('Runedance').attackPower, progressionResources('Runedance').spellPower);
assert.ok(progressionResources('Runedance', 10).spellPower > progressionResources('Runedance').spellPower);
assert.equal(AUTHORED_EQUIPMENT.filter(item => item.weaponType === 'Runeblade').length, 5);
assert.equal(AUTHORED_EQUIPMENT.find(item => item.id === 'R1RB01').perk.amount, 0.3);

resolveRune(system, dancer, dancer, skill('runeMercy'), now);
let zone = dancer.status.replacementZones[0];
assert.deepEqual(unpackBattleValue(packBattleValue(zone)), zone);
dancer.arenaX = 800;
assert.equal(zone.point.arenaX, 100, 'Walking must not drag a rune');
tickRune(system, dancer, zone, now);
assert.deepEqual(heals, [150]);
assert.equal(zone.until, 0);
tickRune(system, dancer, zone, now + 1);
assert.equal(heals.length, 1, 'Mercy is consumed before healing');

dancer.arenaX = 100;
resolveRune(system, dancer, dancer, skill('runeMovement'), now);
zone = dancer.status.replacementZones.find(z => z.ability.handler === 'runeMovement');
tickRune(system, dancer, zone, now);
assert.equal(modifiers.at(-1)[3].movement, 0.2);
assert.equal(modifiers.at(-1)[4], 100);
assert.equal(runeTarget(system, dancer, skill('runeMovement')), null, 'Do not replace unspent runes');
enemy.arenaX = 350;
assert.equal(runeTarget(system, dancer, skill('runeTraverse')), null, 'Hold prevents a distant sword strike');
enemy.arenaX = 170;

resolveRune(system, dancer, enemy, skill('runeFlourish'), now);
zone = dancer.status.replacementZones.find(z => z.ability.handler === 'runeFlourish');
const firstTick = hits.length;
for (now = 2000; now <= 5000; now += 1000) tickRune(system, dancer, zone, now);
assert.equal(hits.slice(firstTick).reduce((sum, hit) => sum + hit.amount, 0), 150, 'All four ticks include expiry');

now = 6000;
resolveRune(system, dancer, dancer, skill('runeMirror'), now);
zone = dancer.status.replacementZones.find(z => z.ability.handler === 'runeMirror');
const beforeMirror = hits.length;
runesAfterDamage(system, enemy, ally, 200, true, { abilityName: 'Attack' });
assert.equal(hits.length, beforeMirror + 1);
assert.equal(hits.at(-1).amount, 200);
assert.equal(zone.until, 0);
runesAfterDamage(system, enemy, ally, 200, true, { abilityName: 'Attack' });
assert.equal(hits.length, beforeMirror + 1);

dancer.equipmentPerks = [{ id: 'runic_refrain', amount: 0.3 }];
dancer.status.runicRefrainReady = true;
runesAfterDamage(system, dancer, enemy, 100, false, { abilityName: 'Attack', replacementTriggered: true });
assert.equal(dancer.status.runicRefrainReady, true);
runesAfterDamage(system, dancer, enemy, 100, false, { abilityName: 'Attack' });
assert.equal(hits.at(-1).amount, 30);
assert.equal(hits.at(-1).extras.runicEcho, true);
assert.equal(dancer.status.runicRefrainReady, false);
const afterEcho = hits.length;
runesAfterDamage(system, dancer, enemy, 100, false, { abilityName: 'Attack' });
assert.equal(hits.length, afterEcho, 'A basic hit cannot re-arm its own echo');
console.log('Runedance rune positioning, thresholds, ranks, expiry, saved records and nonrecursive echoes passed.');
