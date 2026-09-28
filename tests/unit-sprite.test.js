import assert from 'node:assert/strict';
import UnitSprite from '../combat/UnitSprite.js';
const directions = ['south','south-east','east','north-east','north','north-west','west','south-west'];
const definition = { scale: 1.5, footY: 30, clips: {} };
for (const state of ['idle','walk']) {
  definition.clips[state] = Object.fromEntries(directions.map(direction=>[direction, {
    frameMs: 100,
    frames: [0,1].map(index=>({key:`${state}-${direction}-${index}`,originX:0.5,originY:0.9}))
  }]));
}
const image = {
  setScale(value){this.scale=value;return this;},
  setTexture(key){this.key=key;return this;},
  setOrigin(x,y){this.origin=[x,y];return this;},
  setFlipX(value){this.flipX=value;return this;},
  clearTint(){this.cleared=true;return this;}
};
const unit = {arenaX:10,arenaY:10,moveSpeed:140,alive:true,scene:{add:{image:()=>image}}};
const visual = new UnitSprite(unit,definition);
assert.equal(image.key,'idle-south-east-0');
unit.arenaX+=4;visual.update(32);assert.equal(image.key,'walk-east-0');
for(let i=0;i<4;i++){unit.arenaX+=4;visual.update(32);}
assert.equal(image.key,'walk-east-1');
unit.scene.combatPaused=true;const key=image.key;visual.update(100);assert.equal(image.key,key);
unit.scene.combatPaused=false;visual.update(100);assert.equal(image.key,'idle-east-0');
unit.arenaY-=4;visual.update(32);assert.equal(image.key,'walk-south-0');
unit.alive=false;visual.update(100);assert.equal(image.key,'walk-south-0');
unit.alive=true;visual.reset();assert.equal(image.key,'idle-south-0');assert.equal(image.cleared,true);
assert.deepEqual(image.origin,[0.5,0.9]);
assert.equal(UnitSprite.create({id:'not-a-sprite',scene:{}}),null);
console.log('Unit sprite: frame selection, eight-direction clips, origins, pause, death, revival and circle fallback passed.');

visual.applyFrame({key:'mirror',originX:0.4,originY:0.9,flipX:true});assert.equal(image.flipX,true);assert.deepEqual(image.origin,[0.6,0.9]);
