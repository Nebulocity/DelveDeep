// Exercise actual order handlers without Phaser rendering, including paused targeting.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import CombatMovement from '../combat/CombatMovement.js';
import combatSpacing from '../config/combatSpacing.js';
import { leaderAbilities } from '../game/LeaderProgression.js';

const context = vm.createContext({ Phaser: { Scene: class {} }, combatSpacing, leaderAbilities,
  GameState: { leader: { unlockedAbilities: leaderAbilities.map(a => a.id), battleLoadout: leaderAbilities.map(a => a.id) } },
  HapticsService: { tap() {}, confirm() {} } });
vm.runInContext(fs.readFileSync(new URL('../scenes/BattleScene.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default class BattleScene', 'globalThis.Battle = class BattleScene'), context);
const units = Array.from({ length: 5 }, (_, index) => ({ id: `ally-${index}`, name: `Ally ${index}`,
  arenaX: 200 + index * 80, arenaY: 200, alive: true, hp: 90, maxHp: 100, role: 'Melee DPS',
  finishAction() {}, hitZone: { setInteractive() {}, disableInteractive() {} },
  distanceTo(enemy) { return Math.hypot(this.arenaX - enemy.arenaX, this.arenaY - enemy.arenaY); } }));
const enemies = [{ id: 'boss', name: 'Boss', arenaX: 800, arenaY: 400, alive: true,
  isBoss: true, hitZone: { setInteractive() {} } }];
const battle = Object.assign(Object.create(context.Battle.prototype), { partyUnits: units, enemies,
  manualTargets: new Map(), heldUnitIds: new Set(), selectedUnitIds: new Set(units.map(u => u.id)),
  attackTargets: new Map(), leaderAbilityCooldowns: new Map(), usedLeaderAbilities: new Set(),
  pendingPausedTactics: [], time: { now: 1000 }, combatPaused: true,
  terrain: { nearestSafeUnitPoint: (_unit, x, y) => ({ x, y }) },
  battlefield: { logicalWidth: 2400, logicalHeight: 1080,
    clampPoint: (x, y, px = 0, py = 0) => ({ x: Math.max(px, Math.min(2400 - px, x)), y: Math.max(py, Math.min(1080 - py, y)) }) },
  highlightArenaPoint() {}, refreshTacticsMenus() {}, updateLeaderLoadoutBar() {},
  showBattleMessage(text) { this.message = text; }, isEnemyEngaged: () => true });
battle.movement = new CombatMovement(battle);
battle.commandMode = 'MOVE';
battle.handleArenaTap({ x: 700, y: 300 });
const destinations = units.map(unit => battle.manualTargets.get(unit.id));
battle.armCommand('HOLD');
battle.armCommand('HOLD');
assert.equal(battle.heldUnitIds.size, 5, 'Hold never releases an existing Move + Hold');
assert.deepEqual(units.map(unit => battle.manualTargets.get(unit.id)), destinations);
assert.equal(units[0].arenaX, 200, 'paused orders do not advance units');

// Spread keeps the tapped ally in place and chooses distant, safe destinations for everyone else.
battle.commandMode = 'SPREAD';
battle.toggleUnitSelection(units[0]);
assert.deepEqual(battle.manualTargets.get(units[0].id), { x: 200, y: 200 });
const positions = units.map(unit => battle.manualTargets.get(unit.id));
assert.ok(positions.every(point => point.x >= 38 && point.x <= 2362 && point.y >= 38 && point.y <= 1042));
const distances = positions.flatMap((point, index) => positions.slice(index + 1)
  .map(other => Math.hypot(point.x - other.x, point.y - other.y)));
assert.ok(Math.min(...distances) > 450, 'small arenas still achieve substantial spread');

// The tactics queue retains both effects and chosen targets until Resume.
battle.useLeaderAbility('brace');
battle.useLeaderAbility('focusFire');
assert.equal(battle.commandMode, 'FOCUS');
battle.handleEnemyTap(enemies[0]);
assert.equal(battle.braceUntil, undefined);
assert.equal(battle.focusTargetId, undefined);
assert.equal(battle.pendingPausedTactics.length, 2);
battle.combatPaused = false;
battle.flushPausedTactics();
assert.ok(battle.braceUntil > battle.time.now);
assert.equal(battle.focusTargetId, 'boss');
assert.equal(battle.pendingPausedTactics.length, 0);

// Boss banners use the inclusive two-second boundary; shorter ordinary casts stay quiet.
battle.message = '';
battle.announceBossCast(enemies[0], { name: 'Long cast' }, 2000);
assert.ok(battle.message.includes('Long cast'));
battle.message = '';
battle.announceBossCast(enemies[0], { name: 'Short cast' }, 1999);
assert.equal(battle.message, '');

// Automatic targets survive tiny distance changes, but explicit orders still win.
const second = { ...enemies[0], id: 'second', arenaX: 810 };
battle.enemies.push(second);
battle.focusTargetId = null;
assert.equal(battle.getPrimaryTarget(units[0]).id, 'boss');
second.arenaX = 790;
assert.equal(battle.getPrimaryTarget(units[0]).id, 'boss');
battle.attackTargets.set(units[0].id, 'second');
assert.equal(battle.getPrimaryTarget(units[0]).id, 'second');

// Legacy saves keep their target prompt, while new queues preserve target IDs.
battle.pendingPausedTactics = ['focusFire'];
battle.leaderAbilityCooldowns.clear();
battle.commandMode = null;
battle.flushPausedTactics();
assert.equal(battle.commandMode, 'FOCUS');

// Only ability text receives the doubled lifetime; damage timings remain familiar.
context.UI_FONT_FAMILIES = { sans: 'sans-serif' };
context.UI_FONT_WEIGHTS = { bold: 'bold' };
context.fontPx = () => 51;
let duration;
battle.game = {};
battle.add = { text: () => ({ setOrigin() { return this; }, setDepth() { return this; }, setScale() {} }) };
battle.tweens = { add(config) { duration = config.duration; } };
for (const [kind, critical, expected] of [['ability', false, 2280], ['damage', false, 760], ['damage', true, 1050]]) {
  battle.createFloatingText(0, 0, 'Test', '#fff', critical, kind);
  assert.equal(duration, expected);
}
console.log('Battle orders: pause, Hold, anchored Spread, queued tactics, boss banner and stable targets passed.');
