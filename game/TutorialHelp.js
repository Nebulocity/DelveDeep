import { emitGameplay, PLAYER_SOURCE } from './GameplayEvents.js';

// Optional modules own only their current scene and controller scope. They never
// navigate to or restart the opening, and never claim practice from an explanation.
export default class TutorialHelp {
  constructor(service) {
    this.service = service;
    const define = (id, checkpoints) => service.define('help-' + id, { firstCheckpoint: Object.keys(checkpoints)[0], checkpoints });
    define('leader', { 'leader-tap': { scene: 'BattleScene', instruction: 'Tap the highlighted ordinary enemy to deal Leader damage.',
      evidence: { type: 'combat.leaderTap.resolved', source: 'player', validate: e => e.damage > 0 } } });
    define('groups', { groups: { scene: 'BattleScene', targetId: 'battle-radial-SELECT',
      instruction: 'SELECT → Melee commands your close-range heroes together. Use groups when several heroes need the same order.',
      evidence: { type: 'selection.changed', source: 'player', role: 'Melee' } } });
    define('formations', { formations: { scene: 'BattleScene', presentation: 'card',
      instruction: 'Spread separates a group against area attacks. Stack gathers it at a point; Hold keeps its position. Try them when useful. This explanation does not record mastery.',
      evidence: { type: 'tutorial.continued', source: 'player' } } });
    define('tactics', { tactics: { scene: 'TacticsScene', targetId: 'tactics-category-Restore',
      instruction: 'Renown grows through milestones. Each tactic shows its cost and requirement. Choose Restore to browse healing; no purchase is needed.',
      allowedInteractions: ['feature-back'], evidence: { type: 'tutorial.action.accepted', source: 'player', action: 'tactics-category-Restore' } } });
  }
  active() { return this.service.guiding() && this.service.controller.progress.lessonId?.startsWith('help-'); }
  start(id) {
    const g = this.service, scene = g.scene;
    if (g.guiding()) return { ok: false, message: 'Exit the current guidance before choosing optional help.' };
    if (id === 'tactics' ? scene?.scene.key !== 'TacticsScene'
      : scene?.scene.key !== 'BattleScene' || scene.battleOver || scene.currentWaveIndex === scene.bossWaveIndex)
      return { ok: false, message: id === 'tactics' ? 'Open Town → Tactics, then choose this help.' : 'Choose this help during an ordinary fight. Boss practice is not available.' };
    if (id === 'leader') {
      scene.selectedUnitIds.clear(); scene.commandMode = null; scene.refreshPartySelection();
      scene.radialHud?.cancelDrag(); scene.radialHud?.close(); scene.partyLeaderTap?.reset();
    }
    this.sceneSession = scene.gameplayObserverSessionId;
    return g.begin('help-' + id, scene);
  }
  presentation(step) {
    if (!this.active()) return step;
    const g = this.service, s = g.scene, id = g.controller.progress.checkpointId;
    if (s?.scene.key !== step?.scene) return { ...step, presentation: 'ambient', targetId: null, suppressInstruction: true, allowedInteractions: [] };
    if (id === 'leader-tap') {
      const target = g.opening.leaderTarget(s);
      return { ...step, targetId: target ? 'battle-enemy-' + target.enemy.id : null,
        tapPoint: target?.point, presentation: target ? undefined : 'ambient',
        instruction: target ? step.instruction : 'Waiting for a clear ordinary enemy. Exit whenever you like.', allowedInteractions: ['battle-arena'] };
    }
    if (id === 'groups') return { ...step, targetId: s.radialHud?.openMenu === 'SELECT' ? 'battle-role-Melee' : 'battle-radial-SELECT', allowedInteractions: ['battle-radial-gesture'] };
    return step;
  }
  update(scene) {
    if (!this.active()) return;
    const g = this.service, p = g.controller.progress, step = g.controller.definitions[p.lessonId]?.checkpoints[p.checkpointId];
    if (!step) { g.exit(true); return; }
    if (!this.sceneSession && scene.scene.key === step.scene) this.sceneSession = scene.gameplayObserverSessionId;
    if (scene.scene.key !== step.scene || scene.gameplayObserverSessionId !== this.sceneSession
      || scene.battleOver || scene.scene.key === 'BattleScene' && scene.currentWaveIndex === scene.bossWaveIndex) {
      g.exit(true); return;
    }
    if (scene.scene.key === 'BattleScene') {
      g.opening.registerEnemies(scene);
      if (p.encounterId !== scene.gameplayContext?.encounterId && scene.gameplayContext)
        g.controller.bindEncounter(scene.gameplayContext.encounterId, 'campaign', g.controller.capture());
    }
  }
  continue() {
    if (this.active() && this.service.step()?.evidence?.type === 'tutorial.continued')
      emitGameplay(this.service.scene, 'tutorial.continued', {}, PLAYER_SOURCE);
  }
}
