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
const make = (name,c=0,r=0) => ({...classes[name],className:name,id:name,arenaX:c*100+50,arenaY:r*100+50,hp:50,maxHp:100,alive:true,status:{},lastAbilityAt:{},canStartAction:()=>true,canCast:()=>true,canAttack:()=>false,canHeal:()=>false,abilityReady(k,t){return t-(this.lastAbilityAt[k]??-Infinity)>=this.abilities[k].cooldown;},markAbilityUsed(k,t){this.lastAbilityAt[k]=t;},setArenaPosition(x,y){this.arenaX=x;this.arenaY=y;}});
const enemy=(c,r=0)=>({...make('Scoundrel',c,r),id:`enemy-${c}-${r}`,isEnemy:true});
function scene(party,enemies) {
  const s={partyUnits:party,enemies,battlefield:geometry,time:{now:0},attackTargets:new Map(),getLivingEnemies:()=>enemies.filter(e=>e.alive),isEnemyEngaged:()=>true,isPositionLocked:()=>false,getPrimaryTarget:()=>enemies.find(e=>e.alive),isWithinAttackReach:()=>false,announceAbility(){},movement:{moveToCombatPosition(){},maintainRange(){}},hits:[],heals:[],threat:[],resolveDamage(u,t,p,type,m,n){const actual=Math.min(t.hp,p);t.hp-=actual;this.hits.push({u,t,p,n});return actual;},resolveHeal(u,t,p,n){t.hp=Math.min(t.maxHp,t.hp+p);this.heals.push({u,t,p,n});},addThreat(e,u,n){this.threat.push(n);}};
  return s;
}
assert.equal(Object.keys(classes).length,13);
assert.equal(Object.values(classes).filter(c=>c.gridAbilities).reduce((n,c)=>n+Object.keys(c.abilities).length,0),133);
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
assert.equal(s.heals[0].p,24);
s.heals=[];system.resolve(caster,e,caster.abilities.spear,0);assert.equal(s.heals.length,2);assert.equal(s.heals[0].p,32);
e.hp=10;s.heals=[];system.resolve(caster,e,caster.abilities.libram,0);assert.equal(s.heals.length,2);assert.equal(s.heals[0].p,20,'healing uses actual overkill-clamped damage');
const holy=make('Cleric of the Everbright'), friend=make('Scoundrel',1);
s=scene([holy,friend],[]);system=new System(s);
system.resolve(holy,holy,holy.abilities.aegis,0);system.resolve(holy,friend,holy.abilities.ray,0);
assert.deepEqual(s.heals.map(h=>h.p),[21,21]);assert.equal(holy.status.solarAegis,false);
holy.hp=1;system.resolve(holy,holy,holy.abilities.aegis,0);system.resolve(holy,holy,holy.abilities.blessing,0);assert.equal(holy.hp,37);
const tank=make('Dawnwarden'), mobs=[enemy(1),enemy(2),enemy(5)];
s=scene([tank],mobs);system=new System(s);system.resolve(tank,tank,tank.abilities.nova,0);assert.deepEqual(s.threat,[64,64]);
tank.lastAbilityAt.challenge=0;s.applyTankTaunt=(u,targets)=>{s.pulled=targets;};system.update(tank,1,0.016);assert.deepEqual(s.pulled.map(e=>e.arenaX),[550,250,150]);
const black=make('Mage of the Umbral Veil');s=scene([black],[enemy(7,5)]);system=new System(s);
assert.equal(system.move(black,{x:450,y:50},0),true);assert.equal(black.arenaX,450);
assert.equal(system.move(black,{x:50,y:50},9999),false);assert.equal(system.move(black,{x:750,y:550},10000),false,'occupied cell rejected');
assert.equal(system.move(black,{x:50,y:50},10000),true);
const red=make('Mage of the Crimson Spire');s=scene([red,make('Scoundrel',2)],[enemy(3)]);system=new System(s);
system.resolve(red,red,red.abilities.stabilization,0);system.resolve(red,s.enemies[0],red.abilities.spire,0);assert.deepEqual(s.hits.map(h=>h.p),[20,20]);assert.equal(red.status.nextSpellBoost,0);
const nature=make('Cleric of the Verdant Covenant');s=scene([nature,friend],[enemy(2)]);system=new System(s);
system.resolve(nature,friend,nature.abilities.mend,0);assert.equal(friend.status.bramble.power,16);
system.resolve(nature,s.enemies[0],nature.abilities.thorn,0);assert.equal(s.enemies[0].status.rootedUntil,3000);
const blood=make('Cleric of the Sanguine Song');blood.hp=40;friend.hp=10;s=scene([blood,friend],[enemy(2)]);system=new System(s);
system.resolve(blood,friend,blood.abilities.beam,0);assert.equal(s.heals[0].p,29);
system.resolve(blood,blood,blood.abilities.chorus,0);assert.equal(blood.status.temporaryHp,1);assert.equal(friend.status.temporaryHp,1);
blood.hp=50;system.resolve(blood,s.enemies[0],blood.abilities.rend,0);assert.equal(s.hits.at(-1).p,12);
system.resolve(blood,blood,blood.abilities.ascendance,0);assert.equal(blood.status.healingBoostUntil,8000);assert.equal(blood.status.teleportRange,2);
// Real mitigation applies armor, a one-hit shield, and temporary HP in order.
const context=vm.createContext({Phaser:{}});
vm.runInContext(fs.readFileSync(new URL('../combat/BattleUnit.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export default class BattleUnit','globalThis.Unit = class BattleUnit'),context);
const defender=Object.assign(Object.create(context.Unit.prototype),{alive:true,hp:100,maxHp:100,armor:0.1,damageTakenMultiplier:1,status:{armorUntil:8000,armorMultiplier:4,nextHitReduction:0.5,temporaryHp:2},updateHealthBar(){}});
defender.takeDamage(20,{time:0});assert.equal(defender.hp,96);assert.equal(defender.status.nextHitReduction,0);assert.equal(defender.status.temporaryHp,0);
defender.takeDamage(20,{time:8000});assert.equal(defender.hp,78);
// Old gear is discarded while character progression stays intact.
globalThis.localStorage={getItem:()=>JSON.stringify({roster:[{id:'caramon-gladiator',level:4,xp:9,equipment:{weapon:'gear-1'}}],lastPartyIds:['caramon-gladiator'],inventory:{equipment:[{id:'gear-1',itemId:'gladiator-weapon'}]}})};
loadProfile(roster);const caramon=GameState.roster.find(u=>u.id==='caramon-gladiator');assert.equal(caramon.level,4);assert.equal(caramon.className,'Gladiator');assert.equal(caramon.equipment.weapon,null);assert.equal(caramon.equipment.accessory,null);assert.deepEqual(GameState.inventory.equipment,[]);
console.log('New class geometry, taunts, damage/healing, shields, roots, teleports, buffs, and save migration passed.');
// Scripted Refuge provides exactly five timed ticks and a separately consumed shield.
const white = make('Mage of the Luminous Archive');
s = scene([white], []); system = new System(s);
system.resolve(white, white, white.abilities.refuge, 0);
for (const time of [2999, 3000, 6000, 9000, 12000, 15000, 18000]) system.tick(white, time);
assert.equal(s.heals.length, 3);
assert.ok(s.heals.every(h => h.p === 10));
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
system.resolve(gladiator,far,gladiator.abilities.net,100);assert.equal(far.status.rootedUntil,3100);
system.resolve(gladiator,near,gladiator.abilities.sand,100);assert.equal(near.status.blindChance,0.6);assert.equal(near.status.blindUntil,3100);
near.hp=100;far.arenaX=250;far.hp=100;s.threat=[];
system.resolve(gladiator,near,gladiator.abilities.cleave,200);assert.deepEqual(s.threat,[104,104]);
const scoundrel=make('Scoundrel');scoundrel.setStealthed=value=>{scoundrel.stealthed=value;};
const foe=enemy(1);foe.hp=500;s=scene([scoundrel],[foe]);system=new System(s);
foe.currentTargetId=scoundrel.id;system.resolve(scoundrel,scoundrel,scoundrel.abilities.stealth,0);assert.ok(!scoundrel.stealthed);
foe.currentTargetId=null;system.resolve(scoundrel,scoundrel,scoundrel.abilities.stealth,0);assert.ok(scoundrel.stealthed);
system.resolve(scoundrel,foe,scoundrel.abilities.surprise,0);assert.equal(scoundrel.stealthed,false);assert.equal(foe.status.hardStunUntil,2000);assert.equal(s.hits[0].p,32);
system.resolve(scoundrel,foe,scoundrel.abilities.surprise,1);assert.equal(s.hits.length,1,'Surprise requires stealth');
system.resolve(scoundrel,foe,scoundrel.abilities.poison,1000);
for(const time of [2999,3000,5000,7000,9000]) system.tickWorld(time);
assert.deepEqual(s.hits.slice(1).map(h=>h.p),[6,6,6]);assert.equal(foe.status.attackSlowUntil,7000);
const slowUnit=Object.assign(Object.create(context.Unit.prototype),{alive:true,status:{attackSlowUntil:6000,attackSlow:0.5},pendingAction:null,lastAttackAt:0,attackCooldown:1000});
assert.equal(slowUnit.canAttack(1000),false);assert.equal(slowUnit.canAttack(2000),true);assert.equal(slowUnit.canAttack(6000),true);
const barbarian=make('Barbarian');s=scene([barbarian],[foe]);system=new System(s);
system.resolve(barbarian,barbarian,barbarian.abilities.enrage,100);assert.equal(barbarian.status.enrageUntil,10100);assert.equal(barbarian.status.exhaustedUntil,20100);
system.resolve(barbarian,foe,barbarian.abilities.charge,200);assert.equal(foe.status.hardStunUntil,2200);assert.equal(squareDistance(s,barbarian,foe),1);

// Automatic Veilstep stays near its current side of the field.
const escapingMage=make('Mage of the Umbral Veil');
escapingMage.abilities={veilstep:classes['Mage of the Umbral Veil'].abilities.veilstep};
s=scene([escapingMage],[enemy(1)]);system=new System(s);
let escapeRange=null,escapeMinimum=null;
system.escapePoint=(unit,range,minRange)=>{escapeRange=range;escapeMinimum=minRange;return null;};
system.update(escapingMage,0,0.016);
assert.equal(escapeRange,4);
assert.equal(escapeMinimum,3);

// Charge travels across the field before applying its hit and stun.
const chargingBarbarian=make('Barbarian');
const chargeTarget=enemy(5);
chargingBarbarian.abilities={charge:classes.Barbarian.abilities.charge};
s=scene([chargingBarbarian],[chargeTarget]);system=new System(s);
const chargeCallbacks=[];
let chargeTween=null;
s.time.delayedCall=(delay,callback)=>chargeCallbacks.push(callback);
s.tweens={addCounter(config){chargeTween={...config,timeScale:1};return chargeTween;}};
s.logActionStart=()=>{};
s.isActionCurrent=(unit,action,target)=>unit.pendingAction===action&&unit.alive&&(!target||target.alive);
chargingBarbarian.startAction=()=>{chargingBarbarian.pendingAction={};return true;};
chargingBarbarian.finishAction=()=>{chargingBarbarian.pendingAction=null;};
system.cast(chargingBarbarian,chargeTarget,'charge',0);
s.time.now=300;
chargeCallbacks[0]();
assert.ok(chargeTween);
assert.equal(chargingBarbarian.arenaX,50);
system.syncChargeTweens(true);
assert.equal(chargeTween.timeScale,0);
system.syncChargeTweens(false);
assert.equal(chargeTween.timeScale,1);
chargeTween.onUpdate({getValue:()=>0.5,stop(){}});
assert.equal(chargingBarbarian.arenaX,250);
assert.equal(s.hits.length,0);
chargeTween.onUpdate({getValue:()=>1,stop(){}});
chargeTween.onComplete();
assert.equal(chargingBarbarian.arenaX,450);
assert.equal(s.hits.length,1);
assert.equal(chargeTarget.status.hardStunUntil,2300);
assert.equal(chargingBarbarian.pendingAction,null);
const ranger=make('Ranger');foe.arenaX=650;foe.hp=500;s=scene([ranger],[foe]);system=new System(s);
system.resolve(ranger,foe,ranger.abilities.mark,0);assert.equal(foe.status.damageTakenBoost,0.25);assert.equal(foe.status.damageTakenBoostUntil,10000);
const trapCell=system.trapPoint(ranger,[foe]);assert.equal(squareDistance(s,ranger,trapCell),1);
system.resolve(ranger,trapCell,ranger.abilities.trap,0);system.tickWorld(1);assert.equal(s.hits.length,0);
foe.arenaX=trapCell.arenaX;foe.arenaY=trapCell.arenaY;system.tickWorld(2);assert.equal(s.hits[0].p,26);assert.equal(foe.status.hardStunUntil,2200);assert.equal(system.traps.length,0);
// Previously equipped Caramon/Goldmoon gear is removed.
globalThis.localStorage={getItem:()=>JSON.stringify({roster:[{id:'caramon-gladiator',equipment:{weapon:'c'}},{id:'goldmoon',equipment:{weapon:'g'}}],inventory:{equipment:[{id:'c',itemId:'paladin-weapon'},{id:'g',itemId:'priest-weapon'}]}})};
loadProfile(roster);assert.equal(GameState.roster.find(u=>u.id==='goldmoon').equipment.weapon,null);assert.equal(GameState.roster.find(u=>u.id==='caramon-gladiator').equipment.weapon,null);assert.deepEqual(GameState.inventory.equipment,[]);
console.log('Martial kits, poison cadence, trap entry, control durations and reassigned equipment passed.');
// The active catalog contains only the requested roster and its classes.
assert.deepEqual(Object.fromEntries(roster.map(u=>[u.name,u.className])), {
  Caramon:'Gladiator',Sturm:'Oathwarden',Laurana:'Dawnwarden',Goldmoon:'Cleric of the Verdant Covenant',
  Mishakal:'Cleric of the Everbright',Fistandantilus:'Cleric of the Sanguine Song',Riverwind:'Barbarian',Flint:'Barbarian',
  Tasslehoff:'Scoundrel',Tika:'Barmaid',Dalamar:'Mage of the Umbral Veil',Palin:'Mage of the Luminous Archive',Raistlin:'Mage of the Crimson Spire',Tanis:'Ranger'
});
assert.deepEqual(new Set(roster.map(u=>u.className)),new Set(Object.keys(classes)));
const barmaid=make('Barmaid'), lineEnemies=[enemy(1),enemy(3),enemy(5),enemy(3,1)];
lineEnemies.forEach(e=>{e.hp=500;});s=scene([barmaid],lineEnemies);system=new System(s);
system.resolve(barmaid,lineEnemies[0],barmaid.abilities.pan,0);assert.equal(s.hits[0].p,26);assert.equal(lineEnemies[0].status.hardStunUntil,2000);
s.hits=[];system.resolve(barmaid,barmaid,barmaid.abilities.swing,0);assert.equal(s.hits.length,1);assert.equal(s.hits[0].p,16);
s.hits=[];const endpoint=system.bestLine(barmaid,barmaid.abilities.lastCall,lineEnemies);
system.resolve(barmaid,endpoint,barmaid.abilities.lastCall,100);assert.equal(s.hits.length,3);assert.ok(s.hits.every(h=>h.p===26&&h.t.status.hardStunUntil===2100));
s.hits=[];system.resolve(barmaid,lineEnemies[1],barmaid.abilities.lastCall,200);assert.equal(s.hits.length,2,'line stops at selected endpoint');
const oath=make('Oathwarden'), healer=make('Cleric of the Everbright',1), dps=make('Barmaid',2), attacker=enemy(3);
s=scene([oath,healer,dps],[attacker]);system=new System(s);
attacker.currentTargetId=healer.id;
s.applyTankTaunt=(u,targets,key,time)=>targets.forEach(e=>{e.currentTargetId=u.id;e.status.forcedTargetUntil=time+u.abilities[key].duration;});
system.resolve(oath,healer,oath.abilities.vow,100);assert.equal(attacker.currentTargetId,oath.id);assert.equal(attacker.status.forcedTargetUntil,10100);assert.equal(healer.status.damageReduction,0.35);assert.equal(healer.status.damageReductionUntil,5100);
const random=Math.random;
try {
  Math.random=()=>0.64;
  assert.equal(system.tryParry(oath,attacker,30,0),true);assert.equal(s.hits.at(-1).p,30);
  assert.equal(system.tryParry(oath,attacker,30,1999),false);
  Math.random=()=>0.65;assert.equal(system.tryParry(oath,attacker,30,2000),false);
  Math.random=()=>0;assert.equal(system.tryParry(oath,attacker,30,3999),false,'failed parry also spends cooldown');
  assert.equal(system.tryParry(oath,attacker,30,4000),true);
} finally {Math.random=random;}
// Only the final boss wave with exactly an Oathwarden and one other ally alive qualifies.
s.waves=[{boss:true},{boss:true}];s.currentWaveIndex=0;
dps.alive=false;oath.defeat=()=>{oath.alive=false;oath.hp=0;};
for(const ally of [healer,dps]) {ally.maxMana=100;ally.mana=3;ally.updateHealthBar=()=>{};ally.revive=()=>{ally.alive=true;};}
assert.equal(system.canSacrifice(oath),false);
s.currentWaveIndex=1;s.waves[1].boss=false;assert.equal(system.canSacrifice(oath),false);
s.waves[1].boss=true;healer.alive=false;assert.equal(system.canSacrifice(oath),false);
healer.alive=true;dps.alive=true;assert.equal(system.canSacrifice(oath),false);
dps.alive=false;assert.equal(system.sacrifice(oath,oath.abilities.sacrifice,100),true);
assert.equal(oath.alive,false);assert.ok(healer.alive&&dps.alive);assert.equal(healer.hp,100);assert.equal(dps.hp,100);assert.equal(dps.mana,100);assert.equal(healer.mana,100);
assert.equal(dps.status.honorDamageBoost,0.5);assert.equal(dps.status.honorDamageUntil,10100);assert.equal(healer.status.honorHealingBoost,0.5);
oath.alive=true;dps.alive=false;assert.equal(system.canSacrifice(oath),false,'reviving the Oathwarden cannot repeat the sacrifice');
const secondOath=make('Oathwarden'), secondHealer=make('Cleric of the Everbright',1), secondDps=make('Barmaid',2);
secondOath.defeat=()=>{secondOath.alive=false;};
secondHealer.alive=false;secondHealer.maxMana=100;secondHealer.mana=0;secondHealer.updateHealthBar=()=>{};
secondHealer.revive=()=>{secondHealer.alive=true;};
secondDps.maxMana=100;secondDps.mana=3;secondDps.updateHealthBar=()=>{};
s=scene([secondOath,secondHealer,secondDps],[enemy(3)]);s.waves=[{boss:true}];s.currentWaveIndex=0;system=new System(s);
assert.equal(system.sacrifice(secondOath,secondOath.abilities.sacrifice,100),true,'a DPS survivor can witness the sacrifice');
assert.equal(secondOath.alive,false);assert.equal(secondHealer.alive,true);assert.equal(secondHealer.hp,100);assert.equal(secondHealer.mana,100);
console.log('Exact roster, Barmaid line/AoE, Oathwarden vow, parry and sacrifice conditions passed.');
// Retained characters keep progression; removed characters cannot remain selected.
globalThis.localStorage={getItem:()=>JSON.stringify({lastPartyIds:['justarius','sturm','tika'],roster:[{id:'sturm',level:3,equipment:{weapon:'s'}},{id:'tika',level:2,equipment:{weapon:'t'}}],inventory:{equipment:[{id:'s',itemId:'paladin-weapon'},{id:'t',itemId:'rogue-weapon'}]}})};
loadProfile(roster);assert.deepEqual(GameState.lastPartyIds,['sturm','tika']);assert.equal(GameState.roster.find(u=>u.id==='sturm').equipment.weapon,null);assert.equal(GameState.roster.find(u=>u.id==='tika').equipment.weapon,null);assert.deepEqual(GameState.inventory.equipment,[]);
// Fistandantilus keeps progression and party selection from the old roster ID.
globalThis.localStorage={getItem:()=>JSON.stringify({lastPartyIds:['aoth'],roster:[{id:'aoth',level:5,xp:17,happiness:63,equipment:{weapon:'bloodstaff'}}],inventory:{equipment:[{id:'bloodstaff',itemId:'bloodwarder-weapon'}]}})};
loadProfile(roster);
const fistandantilus=GameState.roster.find(u=>u.id==='fistandantilus');
assert.ok(fistandantilus);assert.equal(fistandantilus.level,5);assert.equal(fistandantilus.xp,17);
assert.equal(fistandantilus.happiness,63);assert.equal(fistandantilus.equipment.weapon,null);
assert.deepEqual(GameState.lastPartyIds,['fistandantilus']);

// The current ability system honors an assigned healer priority ahead of a more injured ally.
const priorityHealer=make('Cleric of the Everbright');
priorityHealer.abilities={ray:classes['Cleric of the Everbright'].abilities.ray};
const priorityAlly=make('Scoundrel',1), lowerAlly=make('Barmaid',2);
priorityAlly.hp=80;lowerAlly.hp=5;
s=scene([priorityHealer,priorityAlly,lowerAlly],[]);
s.getHealerPriorityTarget=()=>priorityAlly;
system=new System(s);
system.cast=(unit,target)=>{s.selectedHealTarget=target;};
system.update(priorityHealer,0,0.016);
assert.equal(s.selectedHealTarget,priorityAlly);

// A ready basic heal uses the selected injured ally before an ordinary attack.
const mendingHealer=make('Cleric of the Everbright');
const mendingAlly=make('Dawnwarden',1);
const otherAlly=make('Scoundrel',2);
mendingHealer.hp=100;
mendingAlly.hp=75;
otherAlly.hp=30;
mendingHealer.abilities={};
mendingHealer.canHeal=()=>true;
mendingHealer.canAttack=()=>true;
s=scene([mendingHealer,mendingAlly,otherAlly],[enemy(1)]);
s.getHealerPriorityTarget=()=>mendingAlly;
s.isWithinAttackReach=()=>true;
s.beginBasicHeal=(unit,target)=>{s.basicHealTarget=target;};
s.beginBasicAttack=()=>{s.basicAttacks=(s.basicAttacks??0)+1;};
system=new System(s);
system.update(mendingHealer,0,0.016);
assert.equal(s.basicHealTarget,mendingAlly);
assert.equal(s.basicAttacks??0,0);

// Healers suspend even an explicit attack order while any living ally is below 80% HP.
const guardingHealer=make('Cleric of the Everbright');
const guardedTank=make('Dawnwarden',1);
const orderedEnemy=enemy(2);
guardingHealer.hp=100;
guardedTank.hp=79;
guardingHealer.abilities={ray:classes['Cleric of the Everbright'].abilities.ray};
guardingHealer.canAttack=()=>true;
s=scene([guardingHealer,guardedTank],[orderedEnemy]);
s.attackTargets.set(guardingHealer.id,orderedEnemy.id);
s.isWithinAttackReach=()=>true;
s.beginBasicAttack=()=>{s.basicAttacks=(s.basicAttacks??0)+1;};
system=new System(s);
system.cast=(unit,target,key)=>{s.selectedHealTarget=target;s.selectedAbility=key;};
system.update(guardingHealer,0,0.016);
assert.equal(s.selectedAbility,'ray');
assert.equal(s.selectedHealTarget,guardedTank);
assert.equal(s.basicAttacks??0,0);
assert.equal(s.attackTargets.get(guardingHealer.id),orderedEnemy.id);
guardingHealer.abilities={judgement:classes['Cleric of the Everbright'].abilities.judgement};
s.selectedAbility=null;
system.update(guardingHealer,0,0.016);
assert.equal(s.selectedAbility,null,'offensive abilities wait while an ally is below 80% HP');
assert.equal(s.basicAttacks??0,0);
guardedTank.hp=80;
system.update(guardingHealer,0,0.016);
assert.equal(s.selectedAbility,'judgement','the attack order resumes at exactly 80% HP');
guardingHealer.abilities={};
system.update(guardingHealer,0,0.016);
assert.equal(s.basicAttacks,1,'basic attacks resume at exactly 80% HP');

// A healer's queued offensive spell is canceled if an ally drops below the threshold during windup.
const castingHealer=make('Cleric of the Everbright');
const castingTank=make('Dawnwarden',1);
const spellTarget=enemy(2);
castingHealer.hp=100;
castingTank.hp=80;
s=scene([castingHealer,castingTank],[spellTarget]);
system=new System(s);
const healerCallbacks=[];
s.time.delayedCall=(delay,callback)=>healerCallbacks.push(callback);
s.logActionStart=()=>{};
s.isActionCurrent=()=>true;
castingHealer.startAction=()=>{castingHealer.pendingAction={};return true;};
castingHealer.finishAction=()=>{castingHealer.pendingAction=null;};
system.cast(castingHealer,spellTarget,'judgement',0);
castingTank.hp=79;
healerCallbacks[0]();
assert.equal(s.hits.length,0);
assert.equal(castingHealer.pendingAction,null);
