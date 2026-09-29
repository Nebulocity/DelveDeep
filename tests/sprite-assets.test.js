import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHARACTER_SPRITES, preloadCharacterSprites } from '../data/characterSprites.js';
const sprite=CHARACTER_SPRITES.laurana;
assert.ok(sprite.textures.length >= 24);
const keys=new Set();
for(const texture of sprite.textures){
 assert.ok(!keys.has(texture.key));keys.add(texture.key);
 const png=fs.readFileSync(new URL(texture.url));
 assert.equal(png.subarray(1,4).toString(),'PNG');
 assert.ok(png.readUInt32BE(16)>=136);assert.ok(png.readUInt32BE(20)>=136);
 assert.equal(png[25],6,'original PNG must retain RGBA transparency');
 assert.equal(png.subarray(-8,-4).toString(),'IEND','PNG is complete');
}
for(const [state,clips] of Object.entries(sprite.clips)){
 assert.equal(Object.keys(clips).length,8);
 for(const clip of Object.values(clips)){
  assert.ok(clip.frames.length >= (state==='dead'?1:4));
  assert.ok(clip.frameMs>0);
  for(const frame of clip.frames){assert.ok(keys.has(frame.key));assert.ok(frame.originY>0&&frame.originY<=1);}
 }
}
const loaded=[];
preloadCharacterSprites({textures:{exists:()=>false},load:{image:(key,url)=>loaded.push([key,url])}});
assert.equal(loaded.length,sprite.textures.length);
preloadCharacterSprites({textures:{exists:()=>true},load:{image:()=>assert.fail('should reuse existing textures')}});
for (const direction of Object.keys(sprite.clips.death)) {
 assert.deepEqual(sprite.clips.dead[direction].frames[0],sprite.clips.death[direction].frames.at(-1));
}
// Shield-block facings are authored individually: flipping would swap equipment hands.
for (const direction of Object.keys(sprite.clips.block)) {
 assert.ok(sprite.clips.block[direction].frames.every(frame => !frame.flipX));
}
assert.notEqual(sprite.clips.block['south-east'].frames[0].key,sprite.clips.block['south-west'].frames[0].key);
assert.notEqual(sprite.clips.block['north-east'].frames[0].key,sprite.clips.block['north-west'].frames[0].key);
console.log('Sprite assets: complete RGBA PNGs, valid clips, persistent corpse and cached preloading passed.');
