import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHARACTER_SPRITES, preloadCharacterSprites } from '../data/characterSprites.js';
const sprite=CHARACTER_SPRITES.laurana;
assert.equal(sprite.textures.length,24);
const keys=new Set();
for(const texture of sprite.textures){
 assert.ok(!keys.has(texture.key));keys.add(texture.key);
 const png=fs.readFileSync(new URL(texture.url));
 assert.equal(png.subarray(1,4).toString(),'PNG');
 assert.equal(png.readUInt32BE(16),136);assert.equal(png.readUInt32BE(20),136);
 assert.equal(png[25],6,'original PNG must retain RGBA transparency');
 assert.equal(png.subarray(-8,-4).toString(),'IEND','PNG is complete');
}
for(const [state,clips] of Object.entries(sprite.clips)){
 assert.equal(Object.keys(clips).length,8);
 for(const clip of Object.values(clips)){
  assert.equal(clip.frames.length,state==='idle'?4:8);
  assert.ok(clip.frameMs>0);
  for(const frame of clip.frames){assert.ok(keys.has(frame.key));assert.ok(frame.originY>0&&frame.originY<=1);}
 }
}
const loaded=[];
preloadCharacterSprites({textures:{exists:()=>false},load:{image:(key,url)=>loaded.push([key,url])}});
assert.equal(loaded.length,24);
preloadCharacterSprites({textures:{exists:()=>true},load:{image:()=>assert.fail('should reuse existing textures')}});
console.log('Sprite assets: 24 complete RGBA PNGs, valid clip references and cached preloading passed.');
