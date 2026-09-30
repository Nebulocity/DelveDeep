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
  setTexture(key,frame){this.key=key;this.frame=frame;return this;},
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
visual.applyFrame({key:'sheet',frame:0,originX:0.5,originY:0.9});
visual.applyFrame({key:'sheet',frame:1,originX:0.5,originY:0.9});
assert.equal(image.key,'sheet');assert.equal(image.frame,1,'atlas frame advances without changing texture');

// One-shot actions override locomotion, freeze on pause and return cleanly to idle.
for (const state of ['attack','block','hit','death']) {
 definition.clips[state] = Object.fromEntries(directions.map(direction => [direction, {
  frameMs:100, frames:[0,1,2].map(i=>({key:`${state}-${direction}-${i}`,originX:.5,originY:.9}))
 }]));
}
unit.alive=true;visual.reset();
visual.play('attack',{arenaX:unit.arenaX-10,arenaY:unit.arenaY});
assert.equal(image.key,'attack-west-0');
visual.update(110);assert.equal(image.key,'attack-west-1');
unit.scene.combatPaused=true;visual.update(500);assert.equal(image.key,'attack-west-1');
unit.scene.combatPaused=false;visual.update(200);assert.equal(image.key,'idle-west-0');
visual.play('hit');visual.update(110);visual.play('hit');
assert.equal(image.key,'hit-west-1','repeated hits do not restart reaction');
visual.play('death');unit.alive=false;unit.scene.battleOver=true;
visual.update(500);assert.equal(image.key,'death-west-2');
visual.play('attack');visual.update(500);assert.equal(image.key,'death-west-2');
unit.alive=true;unit.scene.battleOver=false;visual.reset();assert.equal(image.key,'idle-west-0');
console.log('Action playback: facing, interruption, pause, persistent corpse, battle-end fall and revival passed.');
