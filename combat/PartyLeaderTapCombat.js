import GameState from '../game/GameState.js';
import { PARTY_LEADER_TAP as tuning } from '../config/partyLeaderTap.js';
import { partyLeaderTapPower } from './PartyLeaderTapPower.js';
import PartyLeaderTapTargeting, { tapScreenScale, validTapEnemy } from './PartyLeaderTapTargeting.js';
import PartyLeaderTapFeedback from './PartyLeaderTapFeedback.js';

export default class PartyLeaderTapCombat {
  constructor(scene) {
    this.scene = scene;
    this.targeting = new PartyLeaderTapTargeting(scene);
    this.feedback = new PartyLeaderTapFeedback(scene);
    this.surfaces = new Set();
    this.lastAttackAt = -Infinity;

    // This source has no party membership, equipment, threat entry or autonomous AI.
    this.actor = { id: 'party_leader', name: 'Party Leader', isPartyLeader: true,
      isEnemy: false, alive: true, status: {}, hitChance: 1, attackRange: 0 };
    this.move = pointer => {
      const press = this.press;
      if (press?.id !== pointer.id) return;
      const scale = tapScreenScale(scene);
      if (Math.hypot((pointer.x - press.x) / scale.x, (pointer.y - press.y) / scale.y)
        > tuning.gestureDistancePx) this.cancel();
    };
    this.cancel = () => { this.press = null; };
    this.update = () => {
      if (!this.ready() || scene.input.manager.pointers.filter(pointer => pointer.isDown).length > 1) this.cancel();
    };
    scene.input.on('pointermove', this.move);
    scene.input.on('pointerupoutside', this.cancel);
    scene.input.on('gameout', this.cancel);
    scene.events.on('update', this.update);
    scene.game.events.on('blur', this.cancel);
    scene.game.events.on('hidden', this.cancel);
    scene.events.once('shutdown', () => {
      scene.input.off('pointermove', this.move);
      scene.input.off('pointerupoutside', this.cancel);
      scene.input.off('gameout', this.cancel);
      scene.events.off('update', this.update);
      scene.game.events.off('blur', this.cancel);
      scene.game.events.off('hidden', this.cancel);
      this.reset();
      this.surfaces.clear();
    });
  }

  ready() {
    const scene = this.scene, background = scene.game.backgroundProgress;
    return !scene.battleOver && !scene.waveTransitioning && !scene.waveRetreating
      && !scene.combatPaused && !scene.time.paused && !scene.restoringBattle
      && !scene.idleSimulating && !scene.idleSummaryOpen && !scene.selectionDetailsClose
      && !scene.terrainEditor?.active && !scene.commandMode && !scene.getSelectedUnits().length
      && !scene.radialHud?.openMenu && !scene.radialHud?.drag
      && !background?.hidden && !background?.isReplaying && !(background?.pendingMs >= 50)
      && !scene.game.uiAudio?.background;
  }

  bindSurface(surface, floor = false) {
    this.surfaces.add(surface);
    const down = pointer => {
      if (!this.ready() || pointer.button > 0) return;
      if (this.press || this.scene.input.manager.pointers.filter(entry => entry.isDown).length > 1) {
        this.cancel();
        return;
      }
      this.press = { id: pointer.id, x: pointer.x, y: pointer.y, at: pointer.downTime };
    };
    surface.on('pointerdown', down);
    if (floor) surface.on('pointerup', pointer => this.tap(pointer));
    surface.on('pointerup', this.cancel);
    surface.on('pointerout', this.cancel);
    surface.once('destroy', () => this.surfaces.delete(surface));
  }

  tap(pointer) {
    const press = this.press;
    this.cancel();
    if (!press || press.id !== pointer.id || press.at !== pointer.downTime || !this.ready()
      || pointer.event?.type?.includes('cancel')) return false;
    const scale = tapScreenScale(this.scene);
    const moved = Math.hypot((pointer.x - press.x) / scale.x, (pointer.y - press.y) / scale.y);
    if (moved > tuning.gestureDistancePx || pointer.upTime - press.at > tuning.maximumPressMs) return false;

    // A modal or control appearing while the finger is held owns the release too.
    if (this.scene.input.hitTestPointer(pointer).some(object => !this.surfaces.has(object))) return false;
    const result = this.targeting.resolve({ x: pointer.x, y: pointer.y });
    if (!result) return false;
    const now = this.scene.time.now;

    // A valid enemy tap remains consumed during the throttle, including through allies.
    if (now - this.lastAttackAt < tuning.minimumIntervalMs) return true;
    if (!validTapEnemy(this.scene, result.enemy)) return false;
    this.lastAttackAt = now;
    const power = partyLeaderTapPower(GameState.leader, this.scene.partyUnits, GameState.roster);
    const contact = { partyLeaderTap: true, hasArtwork: true, suppressKnockback: true,
      suppressHitReaction: true, replacementTriggered: true };
    const damage = this.scene.resolveDamage(this.actor, result.enemy, power, 'melee', 0, 'Leader Tap', false, contact);
    if (damage > 0) this.feedback.play(result.enemy);
    return true;
  }

  reset() {
    this.cancel();
    this.lastAttackAt = -Infinity;
    this.feedback.clear();
  }
}
