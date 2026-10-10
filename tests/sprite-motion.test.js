// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import { SpriteMotion, movementDirection } from '../combat/SpriteMotion.js';
import UnitSprite from '../combat/UnitSprite.js';
const directions = [[1,0,'east'],[1,1,'north-east'],[0,1,'north'],[-1,1,'north-west'],[-1,0,'west'],[-1,-1,'south-west'],[0,-1,'south'],[1,-1,'south-east']];
for (const [x,y,name] of directions) assert.equal(movementDirection(x,y),name);
const motion = new SpriteMotion(0,0);
motion.update(0,0,80,140); assert.equal(motion.state,'idle'); assert.equal(motion.elapsed,80);

motion.update(2,2,16,140); assert.equal(motion.state,'walk'); assert.equal(motion.direction,'north-east');
motion.update(4,4,16,140); assert.equal(motion.elapsed,16);
motion.update(4,4,50,140); assert.equal(motion.state,'walk');
motion.update(4,4,50,140); assert.equal(motion.state,'idle'); assert.equal(motion.direction,'north-east');
motion.update(800,500,16,140); assert.equal(motion.state,'idle','teleport is not walking');
motion.update(798,500,16,140); assert.equal(motion.direction,'west');
const before = motion.elapsed;

motion.update(798,500,16,140,true,true); assert.equal(motion.elapsed,before,'pause freezes presentation');
motion.update(798,500,16,140,false); assert.equal(motion.elapsed,before,'death freezes presentation');
motion.reset(200,200); assert.equal(motion.state,'idle'); assert.equal(motion.elapsed,0);
motion.update(200.02,200.02,16,140); assert.equal(motion.state,'idle','small separation does not animate walking');

// Rapid alternating steps keep one facing, while an intentional turn still takes effect.
motion.reset(0, 0, 'east');
motion.update(2, 0, 16, 140);
for (let frame = 0; frame < 20; frame++) motion.update(frame % 2 ? 2 : 0, 0, 16, 140);
assert.equal(motion.direction, 'east');
for (let frame = 0; frame < 12; frame++) motion.update(motion.x - 2, 0, 16, 140);
assert.equal(motion.direction, 'west');
const time = { now: 0 };
const minor = { arenaX: -100, arenaY: 0, maxHp: 100, isBoss: false };
const boss = { arenaX: 100, arenaY: 0, maxHp: 500, isBoss: true };

// A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
// object; get/set read and write that same key.
const scene = { time, getLivingEnemies: () => [minor, boss], manualTargets: new Map() };
const ranger = { id: 'ranger', arenaX: 0, arenaY: 0, moveSpeed: 140, alive: true,
  isEnemy: false, role: 'Ranged DPS', scene,

  // We handle distance to point here, keeping this operation in one place for its callers.
  distanceToPoint(x, y) { return Math.hypot(x - this.arenaX, y - this.arenaY); },

  // We handle distance to here, keeping this operation in one place for its callers.
  // target is the object this operation is aimed at; it is supplied by the caller.
  distanceTo(target) { return Math.hypot(target.arenaX - this.arenaX, target.arenaY - this.arenaY); } };

// Object.assign writes these fields into its first argument. Later sources replace earlier
// fields; nested values are not deep-copied.
const sprite = Object.assign(Object.create(UnitSprite.prototype), {
  unit: ranger, motion: new SpriteMotion(0, 0), currentFrame() { return {}; }, applyFrame() {}, applyPose() {}
});
sprite.update(100);
assert.equal(sprite.motion.state, 'idle');
assert.equal(sprite.motion.direction, 'east', 'idle ranger faces the strongest monster');
ranger.arenaX = -2;

time.now = 100;
sprite.update(16);
assert.equal(sprite.motion.state, 'walk');
assert.equal(sprite.motion.direction, 'east', 'retreat keeps facing the monster');
boss.arenaX = -100;
time.now = 500;
sprite.update(16);

assert.equal(sprite.motion.direction, 'east', 'facing does not flip on every frame');
time.now = 1600;
sprite.update(16);
assert.equal(sprite.motion.direction, 'west', 'facing refreshes after the interval');
scene.manualTargets.set(ranger.id, { x: ranger.arenaX, y: ranger.arenaY });
boss.arenaX = 100;
time.now = 3200;

sprite.update(16);
assert.equal(sprite.motion.direction, 'east', 'a settled Hold still faces the strongest monster');
sprite.image = { active: false };
sprite.applyFrame = () => { throw new Error('Destroyed image was updated'); };
sprite.update(16);
console.log('Sprite motion: eight directions, idle/walk, Hold settling, teleport, pause, death, and reset passed.');
