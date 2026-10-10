// Exercise real gameplay displacement and sprite rendering without a WebView.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import UnitSprite from '../combat/UnitSprite.js';
import { criticalHitPose, criticalHitDirection, CRITICAL_RECOIL_MS } from '../combat/SpritePresentation.js';
import { hitAccuracy } from '../game/CharacterStats.js';
import { packBattleValue, unpackBattleValue } from '../game/BattleSnapshot.js';

const peaks = [110, 330, 550].map(time => criticalHitPose(time));
assert.ok(peaks[0].travel < peaks[1].travel && peaks[1].travel < peaks[2].travel);
assert.ok(peaks[0].y < peaks[1].y && peaks[1].y < peaks[2].y && peaks[2].y < 0);
for (const time of [0, 220, 440, CRITICAL_RECOIL_MS]) assert.ok(Math.abs(criticalHitPose(time).y) < 1e-10);
assert.deepEqual(criticalHitPose(1000), { travel: 1, y: 0 });

const bodyContext = vm.createContext({ Phaser:{},criticalHitPose,criticalHitDirection,CRITICAL_RECOIL_MS });
vm.runInContext(fs.readFileSync(new URL('../combat/BattleUnit.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace('export default class BattleUnit','globalThis.Unit = class BattleUnit'),bodyContext);
const floor = { arenaToScreen:(x,y)=>({x,y:1000-y}), getUnitScale:()=>1,
  screenToArenaUnchecked:(x,y)=>({x,y:1000-y}), clampPoint:(x,y)=>({x:Math.min(600,Math.max(0,x)),y:Math.min(600,Math.max(0,y))}) };
const attacker = { arenaX:0,arenaY:100 };
const makeUnit = () => Object.assign(Object.create(bodyContext.Unit.prototype), {
  arenaX:100,arenaY:100,bodyRadius:36,alive:true,moveSpeed:140,status:{},scene:{},battlefield:floor,
  body:{setPosition(x,y){this.x=x;this.y=y;}},
  setArenaPosition(x,y){this.arenaX=x;this.arenaY=y;}
});
const unit=makeUnit();
unit.playCriticalHit(attacker);
unit.updateCriticalRecoil(55);
assert.ok(unit.arenaX>100);
unit.scene.combatPaused=true;
const pausedX=unit.arenaX;
unit.updateCriticalRecoil(1000);
assert.equal(unit.arenaX,pausedX);
unit.scene.combatPaused=false;
for(let i=0;i<11;i++) unit.updateCriticalRecoil(55);
assert.equal(unit.criticalKnockback,null);
assert.ok(Math.abs(unit.arenaX-280)<1e-9, 'lands 2.5 body widths away');
assert.equal(unit.arenaY,100);
assert.equal(unit.body.y,0);

// Boundaries shorten the push; lethal hits and background simulation still move feet.
const edge=makeUnit(); edge.arenaX=590; edge.alive=false; edge.scene.idleSimulating=true;
edge.playCriticalHit(attacker);
for(let i=0;i<12;i++) edge.updateCriticalRecoil(55);
assert.equal(edge.arenaX,600);
assert.equal(edge.criticalKnockback,null);
const vertical=makeUnit(); vertical.playCriticalHit({arenaX:100,arenaY:0});
for(let i=0;i<12;i++) vertical.updateCriticalRecoil(55);
assert.equal(vertical.arenaX,100);
assert.ok(Math.abs(vertical.arenaY-280)<1e-9);

// Saved hop progress resumes without adding any distance twice. Old saves omit it.
const saved=makeUnit(); saved.playCriticalHit(attacker); saved.updateCriticalRecoil(55);
const resumed=makeUnit();
Object.assign(resumed,unpackBattleValue(packBattleValue(JSON.parse(JSON.stringify({arenaX:saved.arenaX,
  arenaY:saved.arenaY,criticalKnockback:saved.criticalKnockback})))));
for(let i=0;i<11;i++) resumed.updateCriticalRecoil(55);
assert.ok(Math.abs(resumed.arenaX-280)<1e-9);
makeUnit().updateCriticalRecoil(55);

const directions=['south','south-east','east','north-east','north','north-west','west','south-west'];
const definition={scale:1,footY:30,clips:{}};
for(const state of ['idle','walk','hit','attack','death']) definition.clips[state]=Object.fromEntries(directions.map(direction=>[direction,
  {frameMs:100,frames:[{key:state+'-'+direction,originX:0.5,originY:0.9}]}]));
const image={width:100,height:100,
  setPosition(x,y){this.x=x;this.y=y;return this;},setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this;},
  setTexture(){return this;},setOrigin(){return this;},setFlipX(){return this;},
  setAlpha(alpha){this.alpha=alpha;return this;},clearTint(){return this;}};
unit.scene.add={image:()=>image};
const visual=new UnitSprite(unit,definition); unit.spriteVisual=visual;
unit.playCriticalHit(attacker); unit.updateCriticalRecoil(55); visual.update(55);
assert.equal(image.x,0, 'horizontal displacement belongs to arena feet');
assert.ok(image.y<30);
unit.stealthed=true; visual.reset();
assert.equal(image.alpha,0.55, 'reset preserves stealth transparency');
image.alpha=1; visual.update(55); assert.equal(image.alpha,0.55);
unit.stealthed=false; visual.update(55); assert.equal(image.alpha,1);
visual.play('hit',attacker); assert.equal(visual.motion.direction,'south-east');
unit.alive=false; visual.play('death'); visual.update(55); assert.equal(visual.action.state,'death');

// Use BattleScene's actual damage method with small combatants. Test both sides and
// ensure misses, immunity, full absorption do not push, while historical replay uses the same gameplay.
const context = vm.createContext({ Phaser: { Scene: class {} }, hitAccuracy });
vm.runInContext(fs.readFileSync(new URL('../scenes/BattleScene.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace('export default class BattleScene','globalThis.Battle = class BattleScene'),context);
const battle = Object.assign(Object.create(context.Battle.prototype), {
  time:{now:0}, rollCritical:()=>true, combatRandom:()=>0.5, isEnemyEngaged:()=>true,
  getLivingEnemies:()=>[], flashPartyHudName(){}, createFloatingText(){},
  createMeleePulse(){}, createProjectile(){}, handleEnemyDeath(){}
});
let reactions = 0;
const actor = { name:'Attacker',x:0,y:0,arenaX:0,arenaY:0,role:'Tank',status:{},hitChance:1,critMultiplier:2 };
const victim = { name:'Target',x:100,y:100,arenaX:100,arenaY:100,hp:100,maxHp:100,alive:true,status:{},
  takeDamage(amount) { this.hp=Math.max(0,this.hp-amount); this.alive=this.hp>0; },
  flash(){}, playCriticalHit(source) { assert.equal(source,actor); reactions++; } };
for (const isEnemy of [true,false]) {
  actor.isEnemy = !isEnemy;
  victim.isEnemy = isEnemy;
  victim.hp = 100;
  victim.alive = true;
  assert.equal(battle.resolveDamage(actor,victim,10,'enemy'),20);
}
assert.equal(reactions,2);
battle.rollCritical = () => false;
battle.resolveDamage(actor,victim,10,'enemy');
assert.equal(reactions,2);
battle.rollCritical = () => true;
victim.status.immuneUntil = 100;
battle.resolveDamage(actor,victim,10,'enemy');
assert.equal(reactions,2);
victim.status = {};
const takeDamage = victim.takeDamage;
victim.takeDamage = () => {};
battle.resolveDamage(actor,victim,10,'enemy');
assert.equal(reactions,2);
victim.takeDamage = takeDamage;
battle.idleSimulating = true;
battle.resolveDamage(actor,victim,10,'enemy');
assert.equal(reactions,3);
battle.idleSimulating = false;
actor.hitChance = 0;
battle.resolveDamage(actor,victim,10,'enemy');
assert.equal(reactions,3);
actor.hitChance = 1;
victim.hp = 1;
battle.resolveDamage(actor,victim,10,'enemy');
assert.equal(reactions,4);
assert.equal(victim.alive,false);

// A critical heal restores more HP but is not an incoming hit, so it must not recoil.
victim.alive = true;
victim.hp = 20;
victim.heal = amount => { victim.hp = Math.min(victim.maxHp,victim.hp+amount); };
battle.resolveHeal(actor,victim,10,'Heal');
assert.equal(reactions,4);
assert.equal(victim.hp,40);

console.log('Critical knockback: three forward hops, distance, floor, pause, death, saves, replay and stealth passed.');
