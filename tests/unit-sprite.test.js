import assert from 'node:assert/strict';
import UnitSprite from '../combat/UnitSprite.js';
import { SLIME_SPRITES } from '../data/slimeSprites.js';
const directions = ['south','south-east','east','north-east','north','north-west','west','south-west'];
const definition = { scale: 1.5, footY: 30, clips: {} };
for (const state of ['idle','walk']) {
  definition.clips[state] = Object.fromEntries(directions.map(direction=>[direction, {
    frameMs: 100,
    frames: [0,1].map(index=>({key:`${state}-${direction}-${index}`,originX:0.5,originY:0.9}))
  }]));
}
const image = {
  width: 192, height: 192,
  setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this;},
  setPosition(x,y){this.x=x;this.y=y;return this;},
  setAlpha(value){this.alpha=value;return this;},
  setTexture(key,frame){this.key=key;this.frame=frame;return this;},
  setOrigin(x,y){this.origin=[x,y];this.originX=x;this.originY=y;return this;},
  setFlipX(value){this.flipX=value;return this;},
  clearTint(){this.cleared=true;return this;}
};
const unit = {arenaX:10,arenaY:10,moveSpeed:140,alive:true,scene:{add:{image:()=>image}}};
const visual = new UnitSprite(unit,definition);
const hitZone = {
  setSize(width,height){this.width=width;this.height=height;return this;},
  setPosition(x,y){this.x=x;this.y=y;return this;}
};
unit.hitZone = hitZone;
visual.syncHitZone();
assert.equal(hitZone.width,288);
assert.equal(hitZone.height,288);
assert.equal(hitZone.y,30 + (0.5 - 0.9) * 288);
image.setPosition(7,25).setScale(2,1);
visual.syncHitZone();
assert.equal(hitZone.width,384);
assert.equal(hitZone.height,192);
assert.equal(hitZone.x,7);
assert.equal(hitZone.y,25 + (0.5 - 0.9) * 192);
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
visual.reset();unit.scene.waveTransitioning=true;unit.scene.waveRetreating=false;
visual.update(110);assert.equal(image.key,'idle-west-1','idle continues during the wave countdown');
unit.scene.scale = { width: 1000 };
unit.battlefield = { columns: 10, arenaToScreen: (x) => ({ x, widthAtDepth: 1000 }) };
for (const [x, direction] of [[250, 'north-east'], [500, 'north'], [750, 'north-west']]) {
  unit.arenaX = x;
  visual.reset();
  visual.update(16);
  assert.equal(image.key, `idle-${direction}-0`, `wave preparation faces ${direction} at x=${x}`);
}
unit.arenaX -= 4;
visual.update(32);
assert.equal(image.key, 'walk-west-0', 'walking home retains movement facing');
unit.scene.waveTransitioning=false;
visual.play('death');unit.alive=false;unit.scene.battleOver=true;
visual.update(500);assert.equal(image.key,'death-west-2');
visual.play('attack');visual.update(500);assert.equal(image.key,'death-west-2');
unit.alive=true;unit.scene.battleOver=false;visual.reset();assert.equal(image.key,'idle-west-0');
console.log('Action playback: facing, interruption, pause, persistent corpse, battle-end fall and revival passed.');

// Spawn IDs vary each encounter, while the enemy type selects its sprite.
const originalCaveSprite = SLIME_SPRITES.caveSlime;
SLIME_SPRITES.caveSlime = { ...definition, textures: [{ key: 'cave-slime-test' }] };
const enemyTexture = { setFilter(value) { this.filter = value; } };
const enemyUnit = {
  ...unit,
  id: 'cave-slime-2-1-7', spriteId: 'caveSlime', isEnemy: true, alive: true,
  scene: {
    add: { image: () => image },
    textures: { exists: key => key === 'cave-slime-test', get: () => enemyTexture }
  }
};
assert.equal(UnitSprite.create(enemyUnit)?.definition, SLIME_SPRITES.caveSlime);
assert.equal(enemyTexture.filter, 1);
assert.equal(UnitSprite.create({ ...enemyUnit, spriteId: 'unknown' }), null);
SLIME_SPRITES.caveSlime = originalCaveSprite;
