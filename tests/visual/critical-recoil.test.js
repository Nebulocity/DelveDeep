// Run directly with Node. This checks the real pose, sprite clock and damage resolver
// without needing a WebView. Display stand-ins record changes but never move arena feet.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import UnitSprite from '../../combat/UnitSprite.js';
import { criticalHitPose, criticalHitDirection, CRITICAL_RECOIL_MS } from '../../combat/SpritePresentation.js';
import { hitAccuracy } from '../../game/CharacterStats.js';

const peaks = [70, 210, 350].map(time => criticalHitPose(time));
assert.ok(peaks[0].x > peaks[1].x && peaks[1].x > peaks[2].x && peaks[2].x > 0);
assert.ok(peaks.every(pose => pose.y < 0));
for (const time of [0, 140, 280, CRITICAL_RECOIL_MS]) {
  const pose = criticalHitPose(time);
  assert.ok(Math.abs(pose.x) < 1e-10 && Math.abs(pose.y) < 1e-10);
}
assert.deepEqual(criticalHitPose(1000), { x: 0, y: 0 });

const directions = ['south','south-east','east','north-east','north','north-west','west','south-west'];
const definition = { scale: 1, footY: 30, clips: {} };
for (const state of ['idle','walk','hit','attack','death']) {
  definition.clips[state] = Object.fromEntries(directions.map(direction => [direction,
    { frameMs: 100, frames: [{ key: `${state}-${direction}`, originX: 0.5, originY: 0.9 }] }]));
}
const image = { width: 100, height: 100,
  setPosition(x,y) { this.x=x; this.y=y; return this; },
  setScale(x,y=x) { this.scaleX=x; this.scaleY=y; return this; },
  setTexture(key) { this.key=key; return this; },
  setOrigin(x,y) { this.originX=x; this.originY=y; return this; },
  setFlipX() { return this; }, setAlpha() { return this; }, clearTint() { return this; } };
const unit = { arenaX: 100, arenaY: 100, alive: true, moveSpeed: 140,
  battlefield: { arenaToScreen: (x,y) => ({ x, y: 1000-y }) }, scene: { add: { image: () => image } } };
const attacker = { arenaX: 0, arenaY: 100 };
const visual = new UnitSprite(unit, definition);
visual.playCriticalHit(attacker);
visual.update(70);
assert.equal(image.x, 18);
assert.equal(image.y, 22);
assert.deepEqual([unit.arenaX, unit.arenaY], [100,100]);

// Pause must hold the exact in-progress hop. Later hops shrink, then return to the
// original foot anchor. Ordinary hits cannot independently start a critical recoil.
unit.scene.combatPaused = true;
visual.update(1000);
assert.equal(visual.criticalRecoil.elapsed, 70);
assert.equal(image.x, 18);
unit.scene.combatPaused = false;
visual.update(140);
assert.ok(Math.abs(image.x - 12.96) < 1e-10);
visual.update(140);
assert.ok(Math.abs(image.x - 7.92) < 1e-10);
visual.update(70);
assert.equal(visual.criticalRecoil, null);
assert.deepEqual([image.x,image.y], [0,30]);
visual.play('hit',attacker);
assert.equal(visual.criticalRecoil, null);
assert.deepEqual(criticalHitDirection(unit,{arenaX:100,arenaY:0}), { awayX:0,awayY:-1 });
assert.deepEqual(criticalHitDirection(unit,unit), { awayX:1,awayY:0 });

// The shock also works on the last lethal hit. Death animation remains in charge of
// its frames and fading; resetting for a revive removes all old shock state.
unit.alive = false;
unit.scene.battleOver = true;
visual.play('death');
visual.playCriticalHit(attacker);
visual.update(70);
assert.equal(image.x, 18);
assert.equal(visual.action.state, 'death');
visual.reset();
assert.equal(visual.criticalRecoil, null);
assert.deepEqual([image.x,image.y], [0,30]);

// Use BattleScene's actual damage method with small combatants. Test both sides and
// ensure misses, immunity, full absorption and historical replay do not start shock.
const context = vm.createContext({ Phaser: { Scene: class {} }, hitAccuracy });
vm.runInContext(fs.readFileSync(new URL('../../scenes/BattleScene.js',import.meta.url),'utf8')
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
assert.equal(reactions,2);
battle.idleSimulating = false;
actor.hitChance = 0;
battle.resolveDamage(actor,victim,10,'enemy');
assert.equal(reactions,2);
actor.hitChance = 1;
victim.hp = 1;
battle.resolveDamage(actor,victim,10,'enemy');
assert.equal(reactions,3);
assert.equal(victim.alive,false);

// A critical heal restores more HP but is not an incoming hit, so it must not recoil.
victim.alive = true;
victim.hp = 20;
victim.heal = amount => { victim.hp = Math.min(victim.maxHp,victim.hp+amount); };
battle.resolveHeal(actor,victim,10,'Heal');
assert.equal(reactions,3);
assert.equal(victim.hp,40);

// Units without a supplied sprite sheet use the same three hops on their circle body.
// This pose state lives on the excluded display object, keeping snapshots visual-free.
const bodyContext = vm.createContext({ Phaser:{},criticalHitPose,criticalHitDirection,CRITICAL_RECOIL_MS });
vm.runInContext(fs.readFileSync(new URL('../../combat/BattleUnit.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace('export default class BattleUnit','globalThis.Unit = class BattleUnit'),bodyContext);
const fallback = Object.assign(Object.create(bodyContext.Unit.prototype), {
  arenaX:100,arenaY:100,scene:{},body:{setPosition(x,y){this.x=x;this.y=y;}}
});
fallback.playCriticalHit(attacker);
fallback.updateCriticalRecoil(70);
assert.deepEqual([fallback.body.x,fallback.body.y],[18,-8]);
fallback.scene.combatPaused = true;
fallback.updateCriticalRecoil(1000);
assert.equal(fallback.body.criticalRecoil.elapsed,70);
fallback.scene.combatPaused = false;
fallback.updateCriticalRecoil(420);
assert.deepEqual([fallback.body.x,fallback.body.y],[0,0]);
assert.deepEqual([fallback.arenaX,fallback.arenaY],[100,100]);
console.log('Critical recoil: three fading hops, both sides, projection, pause, death/reset and damage gates passed.');
