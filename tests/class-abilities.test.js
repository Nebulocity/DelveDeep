import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import System, { squareDistance, zoneContains, beamContains } from '../combat/ClassAbilitySystem.js';
import { CLASS_DEFINITIONS as classes } from '../data/classes.js';
import roster from '../data/adventurers.js';
import { loadProfile } from '../game/GameStorage.js';
import GameState from '../game/GameState.js';
const geometry = {
  columns: 8, rows: 6, logicalWidth: 800, logicalHeight: 600,
  arenaPointToCell(x,y) { return {column:Math.min(7,Math.floor(x/100)),row:Math.min(5,Math.floor(y/100))}; },
  getCellCenter(c,r) { return {x:c*100+50,y:r*100+50}; }
};
const make = (name,c=0,r=0) => ({...classes[name],className:name,id:name,arenaX:c*100+50,arenaY:r*100+50,hp:50,maxHp:100,alive:true,status:{},lastAbilityAt:{},canStartAction:()=>true,canCast:()=>true,canAttack:()=>false,abilityReady(k,t){return t-(this.lastAbilityAt[k]??-Infinity)>=this.abilities[k].cooldown;},markAbilityUsed(k,t){this.lastAbilityAt[k]=t;},setArenaPosition(x,y){this.arenaX=x;this.arenaY=y;}});
const enemy=(c,r=0)=>({...make('Scoundrel',c,r),id:`enemy-${c}-${r}`,isEnemy:true});
function scene(party,enemies) {
  const s={partyUnits:party,enemies,battlefield:geometry,time:{now:0},attackTargets:new Map(),getLivingEnemies:()=>enemies.filter(e=>e.alive),isEnemyEngaged:()=>true,isPositionLocked:()=>false,getPrimaryTarget:()=>enemies.find(e=>e.alive),isWithinAttackReach:()=>false,announceAbility(){},movement:{moveToCombatPosition(){},maintainRange(){}},hits:[],heals:[],threat:[],resolveDamage(u,t,p,type,m,n){const actual=Math.min(t.hp,p);t.hp-=actual;this.hits.push({u,t,p,n});return actual;},resolveHeal(u,t,p,n){t.hp=Math.min(t.maxHp,t.hp+p);this.heals.push({u,t,p,n});},addThreat(e,u,n){this.threat.push(n);}};
  return s;
}
assert.equal(Object.keys(classes).length,11);
assert.equal(Object.values(classes).filter(c=>c.gridAbilities).reduce((n,c)=>n+Object.keys(c.abilities).length,0),47);
assert.ok(roster.every(unit=>classes[unit.className]));
assert.equal(roster.find(unit=>unit.id==='raistlin').className,'Mage of the Crimson Spire');
const caster=make('Mage of the Luminous Archive'), ally=make('Scoundrel',2), e=enemy(1);
let s=scene([caster,ally],[e]), system=new System(s);
assert.equal(squareDistance(s,caster,make('Scoundrel',3,3)),3);
assert.equal(zoneContains(s,make('Scoundrel',3,3),make('Scoundrel',2,2),[2,2]),true);
assert.equal(zoneContains(s,make('Scoundrel',1,2),make('Scoundrel',2,2),[2,2]),false);
assert.equal(beamContains(s,caster,enemy(5),enemy(3),5),true);
assert.equal(beamContains(s,caster,enemy(5),enemy(3,1),5),false);
system.resolve(caster,e,caster.abilities.touch,0);
assert.equal(s.heals[0].p,36);
s.heals=[];system.resolve(caster,e,caster.abilities.spear,0);assert.equal(s.heals.length,2);assert.equal(s.heals[0].p,48);
e.hp=10;s.heals=[];system.resolve(caster,e,caster.abilities.libram,0);assert.equal(s.heals.length,2);assert.equal(s.heals[0].p,20,'healing uses actual overkill-clamped damage');
const holy=make('Cleric of the Holy Light'), friend=make('Scoundrel',1);
s=scene([holy,friend],[]);system=new System(s);
system.resolve(holy,holy,holy.abilities.aegis,0);system.resolve(holy,friend,holy.abilities.ray,0);
assert.deepEqual(s.heals.map(h=>h.p),[72,72]);assert.equal(holy.status.solarAegis,false);
holy.hp=1;system.resolve(holy,holy,holy.abilities.aegis,0);system.resolve(holy,holy,holy.abilities.blessing,0);assert.equal(holy.hp,100);
const tank=make('Dawnwarden'), mobs=[enemy(1),enemy(2),enemy(5)];
s=scene([tank],mobs);system=new System(s);system.resolve(tank,tank,tank.abilities.nova,0);assert.deepEqual(s.threat,[96,96]);
tank.lastAbilityAt.challenge=0;s.applyTankTaunt=(u,targets)=>{s.pulled=targets;};system.update(tank,1,0.016);assert.deepEqual(s.pulled.map(e=>e.arenaX),[550,250,150]);
const black=make('Mage of the Umbral Veil');s=scene([black],[enemy(7,5)]);system=new System(s);
assert.equal(system.move(black,{x:450,y:50},0),true);assert.equal(black.arenaX,450);
assert.equal(system.move(black,{x:50,y:50},9999),false);assert.equal(system.move(black,{x:750,y:550},10000),false,'occupied cell rejected');
assert.equal(system.move(black,{x:50,y:50},10000),true);
const red=make('Mage of the Crimson Spire');s=scene([red,make('Scoundrel',2)],[enemy(3)]);system=new System(s);
system.resolve(red,red,red.abilities.stabilization,0);system.resolve(red,s.enemies[0],red.abilities.spire,0);assert.deepEqual(s.hits.map(h=>h.p),[30,30]);assert.equal(red.status.nextSpellBoost,0);
const nature=make('Cleric of the Verdant Covenant');s=scene([nature,friend],[enemy(2)]);system=new System(s);
system.resolve(nature,friend,nature.abilities.mend,0);assert.equal(friend.status.bramble.power,24);
system.resolve(nature,s.enemies[0],nature.abilities.thorn,0);assert.equal(s.enemies[0].status.rootedUntil,4000);
const blood=make('Cleric of the Sanguine Song');blood.hp=40;friend.hp=10;s=scene([blood,friend],[enemy(2)]);system=new System(s);
system.resolve(blood,friend,blood.abilities.beam,0);assert.equal(s.heals[0].p,42);
system.resolve(blood,blood,blood.abilities.chorus,0);assert.equal(blood.status.temporaryHp,2);
blood.hp=50;system.resolve(blood,s.enemies[0],blood.abilities.rend,0);assert.equal(s.hits.at(-1).p,18);
system.resolve(blood,blood,blood.abilities.ascendance,0);assert.equal(blood.status.healingBoostUntil,8000);assert.equal(blood.status.teleportRange,2);
// Real mitigation applies armor, a one-hit shield, and temporary HP in order.
const context=vm.createContext({Phaser:{}});
vm.runInContext(fs.readFileSync(new URL('../combat/BattleUnit.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export default class BattleUnit','globalThis.Unit = class BattleUnit'),context);
const defender=Object.assign(Object.create(context.Unit.prototype),{alive:true,hp:100,maxHp:100,armor:0.1,damageTakenMultiplier:1,status:{armorUntil:8000,armorMultiplier:4,nextHitReduction:0.5,temporaryHp:2},updateHealthBar(){}});
defender.takeDamage(20,{time:0});assert.equal(defender.hp,96);assert.equal(defender.status.nextHitReduction,0);assert.equal(defender.status.temporaryHp,0);
defender.takeDamage(20,{time:8000});assert.equal(defender.hp,78);
// Old tank gear migrates by catalog ID; instance IDs and progression stay intact.
globalThis.localStorage={getItem:()=>JSON.stringify({roster:[{id:'caramon-gladiator',level:4,xp:9,equipment:{weapon:'gear-1'}}],lastPartyIds:['caramon-gladiator'],inventory:{equipment:[{id:'gear-1',itemId:'gladiator-weapon'}]}})};
loadProfile(roster);const caramon=GameState.roster.find(u=>u.id==='caramon-gladiator');assert.equal(caramon.level,4);assert.equal(caramon.className,'Gladiator');assert.equal(caramon.equipment.weapon,'gear-1');assert.equal(GameState.inventory.equipment[0].itemId,'gladiator-weapon');
console.log('New class geometry, taunts, damage/healing, shields, roots, teleports, buffs, and save migration passed.');
// Scripted Refuge provides exactly five timed ticks and a separately consumed shield.
const white = make('Mage of the Luminous Archive');
s = scene([white], []); system = new System(s);
system.resolve(white, white, white.abilities.refuge, 0);
for (const time of [2999, 3000, 6000, 9000, 12000, 15000, 18000]) system.tick(white, time);
assert.equal(s.heals.length, 5);
assert.ok(s.heals.every(h => h.p === 15));
assert.equal(white.status.nextHitReduction, 0.5);
// An interrupted spell cannot apply its effects or clear a replacement cast.
const castingMage = make('Mage of the Umbral Veil'), victim = enemy(1);
s = scene([castingMage], [victim]); system = new System(s);
const callbacks = [];
s.time.delayedCall = (delay, callback) => callbacks.push(callback);
s.logActionStart = () => {};
s.isActionCurrent = (u, action) => u.pendingAction === action;
castingMage.startAction = () => { castingMage.pendingAction = {}; return true; };
castingMage.finishAction = () => { castingMage.pendingAction = null; };
system.cast(castingMage, victim, 'nightbolt', 0);
const replacement = {};
castingMage.pendingAction = replacement;
callbacks[0]();
assert.equal(s.hits.length, 0);
assert.equal(castingMage.pendingAction, replacement);
// New martial kits: targeting, persistent control, poison timing and trap entry.
const gladiator=make('Gladiator'), near=enemy(1), far=enemy(6);
s=scene([gladiator],[near,far]);system=new System(s);
gladiator.lastAbilityAt.roar=0;
system.cast=(u,t,k)=>{s.chosen={t,k};};
system.update(gladiator,1,0);assert.equal(s.chosen.k,'net');assert.equal(s.chosen.t,far);
system.resolve(gladiator,far,gladiator.abilities.net,100);assert.equal(far.status.rootedUntil,10100);
system.resolve(gladiator,near,gladiator.abilities.sand,100);assert.equal(near.status.blindChance,0.6);assert.equal(near.status.blindUntil,6100);
near.hp=100;far.arenaX=250;far.hp=100;s.threat=[];
system.resolve(gladiator,near,gladiator.abilities.cleave,200);assert.deepEqual(s.threat,[160,160]);
const scoundrel=make('Scoundrel');scoundrel.setStealthed=value=>{scoundrel.stealthed=value;};
const foe=enemy(1);foe.hp=500;s=scene([scoundrel],[foe]);system=new System(s);
foe.currentTargetId=scoundrel.id;system.resolve(scoundrel,scoundrel,scoundrel.abilities.stealth,0);assert.ok(!scoundrel.stealthed);
foe.currentTargetId=null;system.resolve(scoundrel,scoundrel,scoundrel.abilities.stealth,0);assert.ok(scoundrel.stealthed);
system.resolve(scoundrel,foe,scoundrel.abilities.surprise,0);assert.equal(scoundrel.stealthed,false);assert.equal(foe.status.hardStunUntil,4000);assert.equal(s.hits[0].p,60);
system.resolve(scoundrel,foe,scoundrel.abilities.surprise,1);assert.equal(s.hits.length,1,'Surprise requires stealth');
system.resolve(scoundrel,foe,scoundrel.abilities.poison,1000);
for(const time of [2999,3000,5000,7000,9000]) system.tickWorld(time);
assert.deepEqual(s.hits.slice(1).map(h=>h.p),[8,8,8]);assert.equal(foe.status.attackSlowUntil,7000);
const slowUnit=Object.assign(Object.create(context.Unit.prototype),{alive:true,status:{attackSlowUntil:6000,attackSlow:0.5},pendingAction:null,lastAttackAt:0,attackCooldown:1000});
assert.equal(slowUnit.canAttack(1000),false);assert.equal(slowUnit.canAttack(2000),true);assert.equal(slowUnit.canAttack(6000),true);
const barbarian=make('Barbarian');s=scene([barbarian],[foe]);system=new System(s);
system.resolve(barbarian,barbarian,barbarian.abilities.enrage,100);assert.equal(barbarian.status.enrageUntil,10100);assert.equal(barbarian.status.exhaustedUntil,20100);
system.resolve(barbarian,foe,barbarian.abilities.charge,200);assert.equal(foe.status.hardStunUntil,6200);assert.equal(squareDistance(s,barbarian,foe),1);
const ranger=make('Ranger');foe.arenaX=650;foe.hp=500;s=scene([ranger],[foe]);system=new System(s);
system.resolve(ranger,foe,ranger.abilities.mark,0);assert.equal(foe.status.damageTakenBoost,0.25);assert.equal(foe.status.damageTakenBoostUntil,10000);
const trapCell=system.trapPoint(ranger,[foe]);assert.equal(squareDistance(s,ranger,trapCell),1);
system.resolve(ranger,trapCell,ranger.abilities.trap,0);system.tickWorld(1);assert.equal(s.hits.length,0);
foe.arenaX=trapCell.arenaX;foe.arenaY=trapCell.arenaY;system.tickWorld(2);assert.equal(s.hits[0].p,40);assert.equal(foe.status.hardStunUntil,10002);assert.equal(system.traps.length,0);
// Previously equipped Caramon/Goldmoon gear keeps its instance identity and new class compatibility.
globalThis.localStorage={getItem:()=>JSON.stringify({roster:[{id:'caramon-gladiator',equipment:{weapon:'c'}},{id:'goldmoon',equipment:{weapon:'g'}}],inventory:{equipment:[{id:'c',itemId:'paladin-weapon'},{id:'g',itemId:'naturalist-weapon'}]}})};
loadProfile(roster);assert.equal(GameState.roster.find(u=>u.id==='goldmoon').equipment.weapon,'g');assert.equal(GameState.roster.find(u=>u.id==='caramon-gladiator').equipment.weapon,'c');assert.deepEqual(GameState.inventory.equipment.map(e=>e.itemId),['gladiator-weapon','priest-weapon']);
console.log('Martial kits, poison cadence, trap entry, control durations and reassigned equipment passed.');
