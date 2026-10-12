// Exercise saved entrance events and cosmetic cleanup without a browser renderer.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createBossLandingEffect, updateBossLandingEffects, clearBossLandingEffects } from '../combat/BossLandingEffect.js';
import { captureBattle, validBattleSnapshot } from '../game/BattleSnapshot.js';

const context = { Phaser: { Scene: class {} }, enemies: { escort: {} } };
const source = readFileSync(new URL('../scenes/BattleScene.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?$/gm, '').replace('export default class BattleScene', 'class BattleScene');
vm.runInNewContext(`${source}\nglobalThis.BattleScene = BattleScene;`, context);
const entrance = new context.BattleScene();
const boss = { id: 'boss', definition: { boss: true }, container: {
  visible: true, setVisible(value) { this.visible = value; }
} };
const escort = { definition: {}, landing: true };
const events = [];
entrance.enemies = [boss, escort];
entrance.pendingWaveSpawns = [];
entrance.scheduleBattleEvent = (delay, data) => events.push({ delay, data });
entrance.animateEnemyLanding = unit => { unit.falling = true; };
entrance.queueEnemyLanding(boss);
assert.equal(boss.container.visible, false);
assert.equal(boss.landing, true);
assert.equal(events[0].data.kind, 'bossDrop');
assert.equal(events[0].delay, 900);
entrance.startBossDrop(boss);
assert.equal(boss.falling, undefined, 'A falling escort holds the boss entrance.');
escort.landing = false;
entrance.pendingWaveSpawns = [{ spawn: { type: 'escort' } }];
entrance.startBossDrop(boss);
assert.equal(boss.falling, undefined, 'Queued escorts also arrive first.');
entrance.pendingWaveSpawns = [];
entrance.startBossDrop(boss);
assert.equal(boss.falling, true);
assert.equal(boss.container.visible, true);
assert.equal(boss.landingWaiting, false);

// The optional waiting flag and bossDrop timer use the existing version-1 save format.
const savedUnit = id => ({ id, hp: 100, maxHp: 100, arenaX: 500, arenaY: 700, status: {} });
const snapshotScene = { time: { now: 100 }, currentWaveIndex: 0,
  partyUnits: [savedUnit('hero')], enemies: [{ ...savedUnit('boss'), landingWaiting: true }],
  battleEvents: new Set([{ data: { kind: 'bossDrop', unitId: 'boss' },
    timer: { getRemaining: () => 900 } }]), movement: { slots: new Map(), rangeStates: new Map() },
  classAbilitySystem: { traps: [] }, tactics: { preferences: new Map() },
  combatLog: { record: { summary: {} }, entries: [], startedAt: 0 } };
const snapshot = captureBattle(snapshotScene, { currentDelve: { id: 'slime-cave' },
  activeParty: [{ id: 'hero' }], run: {}, rewards: {}, tactics: {}, leader: {} }, 1000);
assert.ok(validBattleSnapshot(snapshot, [{ id: 'hero' }]));
assert.equal(snapshot.events[0].data.kind, 'bossDrop');
assert.equal(snapshot.enemies[0].landingWaiting, true);

function drawing() {
  return { active: true, puffs: [], setDepth() { return this; }, setName() { return this; },
    clear() { this.puffs = []; }, fillStyle(color, alpha) { this.alpha = alpha; },
    fillEllipse(x, y, width, height) { this.puffs.push({ x, y, width, height }); },
    destroy() { this.active = false; } };
}
const camera = { scrollX: 7, scrollY: 11, setScroll(x, y) { this.scrollX = x; this.scrollY = y; } };
const scene = { time: { now: 0 }, game: {}, cameras: { main: camera },
  battlefield: { getUnitScale: () => 0.8 }, add: { graphics: drawing } };
createBossLandingEffect(scene, { x: 500, y: 400, arenaY: 700, container: { depth: 500 } });
const effect = scene.bossLandingEffects[0];
scene.time.now = 100;
updateBossLandingEffects(scene);
const pausedPose = JSON.stringify(effect.dust.puffs);
const pausedScroll = [camera.scrollX, camera.scrollY];
updateBossLandingEffects(scene);
assert.equal(JSON.stringify(effect.dust.puffs), pausedPose);
assert.deepEqual([camera.scrollX, camera.scrollY], pausedScroll);
scene.time.now = 1000;
updateBossLandingEffects(scene);
assert.deepEqual([camera.scrollX, camera.scrollY], [7, 11]);
assert.ok(effect.dust.alpha < 0.24, 'Dust fades before it is released.');
scene.time.now = 1400;
updateBossLandingEffects(scene);
assert.equal(effect.dust.active, false);
createBossLandingEffect(scene, { x: 500, y: 400, arenaY: 700, container: { depth: 500 } });
scene.game.backgroundProgress = { isReplaying: true };
updateBossLandingEffects(scene);
assert.equal(scene.bossLandingEffects.length, 0);
assert.equal(scene.bossLandingRumble, null);
clearBossLandingEffects(scene);
console.log('Boss entrances: escorts first, saved delay, paused dust/rumble, fade and replay cleanup passed.');
