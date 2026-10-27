import TutorialHelp from './TutorialHelp.js';
import OpeningTutorial from './OpeningTutorial.js';
import TutorialController from './TutorialController.js';
import TutorialTargets, { contains } from './TutorialTargets.js';
import TutorialInputGate from './TutorialInputGate.js';
import { exitTutorial, tutorialOwner } from './TutorialOwner.js';
import { observeGameplay, emitGameplay, SYSTEM_SOURCE } from './GameplayEvents.js';
import { tutorialEvidenceContext } from './TutorialProgress.js';
import { withTutorialPresentation } from './TutorialPresentation.js';

const services = new WeakMap();
export function tutorialGuidance(game) {
  if (!services.has(game)) services.set(game, new TutorialGuidance(game));
  return services.get(game);
}

export default class TutorialGuidance {
  constructor(game, controller = new TutorialController({})) {
    this.game = game;
    this.controller = controller;
    this.targets = new TutorialTargets();
    this.gate = new TutorialInputGate(this);
    this.revision = 0;
    this.warnings = new Map();
    this.confirmations = new Map();
    this.readySessions = new WeakMap();
    this.background = false;
    this.scene = null;
    this.scope = null;
    this.message = '';
    this.opening = new OpeningTutorial(this);
    this.help = new TutorialHelp(this);
    const keyboard = event => {
      if (!this.ownsInput()) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === 'keydown' && event.key === 'Escape' && !event.repeat) this.requestExit?.();
    };
    globalThis.addEventListener?.('keydown', keyboard, true);
    globalThis.addEventListener?.('keyup', keyboard, true);
    const hidden = () => { this.background = true; this.releaseScope(); };
    const visible = () => { this.background = false; this.saveBlocked = false; this.refresh(); };
    for (const name of ['hidden', 'blur']) game.events.on(name, hidden);
    for (const name of ['visible', 'focus']) game.events.on(name, visible);
    this.unsubscribe = observeGameplay(event => this.warningEvent(event));
    game.events.once('destroy', () => {
      this.releaseScope(); this.unsubscribe();
      globalThis.removeEventListener?.('keydown', keyboard, true);
      globalThis.removeEventListener?.('keyup', keyboard, true);
      for (const name of ['hidden', 'blur']) game.events.off(name, hidden);
      for (const name of ['visible', 'focus']) game.events.off(name, visible);
    });
  }

  define(lessonId, definition) { this.controller.definitions[lessonId] = definition; }

  begin(lessonId, scene) {
    const result = this.controller.begin(lessonId, 'campaign', this.controller.capture());
    if (result.ok) {
      if (scene.selectionDetailsClose === scene.abilityUnlockNoticeClose) scene.abilityUnlockNoticeClose?.();
      this.saveBlocked = false; this.scene = scene; this.refresh();
    }
    return result;
  }

  register(scene, id, options) { return this.targets.register(scene, id, options); }
  ownsInput() { return this.storyActive || this.guiding(); }
  guiding() { return this.controller.progress.status === 'active'; }
  step() {
    const p = this.controller.progress;
    return withTutorialPresentation(this.help.presentation(this.opening.presentation(this.controller.definitions[p.lessonId]?.checkpoints[p.checkpointId])), p.lessonId, p.checkpointId);
  }

  allowed() {
    if (this.storyActive) return this.background ? [] : this.confirmations.size
      ? [...this.confirmations.values()].at(-1).allowed : this.storyInteraction?.allowed ?? [];
    if (!this.guiding() || this.background || !this.scope?.valid()) return [];
    if (this.warnings.size && !this.step()?.keepDuringWarning) return [...new Set([...this.warnings.values()].flatMap(w => w.allowed))];
    if (this.confirmations.size) return [...this.confirmations.values()].at(-1).allowed;
    const step = this.step();
    if (!this.liveTarget && !['card', 'ambient'].includes(step?.presentation)) return step?.missingInteractions ?? [];
    const allowed = [...(step.targetIds ?? [step.targetId]), ...this.controller.progress.allowedInteractions, ...(step.allowedInteractions ?? [])].filter(Boolean);
    return this.warnings.size ? [...new Set([...this.defensiveInteractions(), ...allowed])] : allowed;
  }

  allowsAction(scene, id) {
    if (this.storyActive) return !this.background && scene === this.scene && this.storyInteraction?.scene === scene
      && this.allowed().includes(id) && !!this.targets.resolve(id, scene);
    if (!this.ownsInput()) return true;
    return scene === this.scene && this.allowed().includes(id) && !!this.targets.resolve(id, scene);
  }

  allowsObject(scene, object, pointer) {
    if (globalThis.__tutorialStudioPreview && scene.scene.key === 'StudioStage') return true;
    if (scene.scene.key === 'TutorialOverlayScene') return (scene.exitConfirmationOpen
      ? ['tutorial-exit', 'tutorial-exit-stay', 'tutorial-exit-confirm'] : ['tutorial-exit', 'tutorial-continue']).includes(object.name);
    if (!this.allowsAction(scene, object.name)) return false;
    if (this.warnings.size && object.name === 'battle-arena' && scene.commandMode !== 'MOVE') return false;
    const live = this.targets.resolve(object.name, scene);
    return live.object === object && contains(live.bounds, pointer);
  }

  releaseScope() {
    this.scope?.dispose(); this.scope = null; this.liveTarget = null;
    this.revision++; this.gate.reset();
  }

  sceneReady(scene, origin) {
    if (scene.scene.key === 'TutorialOverlayScene' || scene.scene.key === 'BootScene') return;
    if (!scene.sys.isActive()) return;
    scene.gameplayObserverSessionId ??= crypto.randomUUID();
    if (this.readySessions.get(scene) === scene.gameplayObserverSessionId) return;
    this.readySessions.set(scene, scene.gameplayObserverSessionId);
    this.releaseScope();
    this.scene = scene;
    this.saveBlocked = false;
    this.warnings.clear(); this.confirmations.clear();
    this.enteringScene = true;
    this.refresh();
    this.enteringScene = false;
    emitGameplay(scene, 'scene.entered', { sceneId: scene.scene.key,
      tutorial: origin ? this.controller.authorized(origin.token) ? origin.tutorial : null
        : tutorialEvidenceContext(this.controller.state) }, SYSTEM_SOURCE);
  }

  refresh() {
    if (this.storyActive || !this.scene?.sys.isActive() || this.background || !this.guiding()) {
      this.releaseScope(); return;
    }
    if (this.saveBlocked) return;
    if (!this.enteringScene) { this.opening.update(this.scene); this.help.update(this.scene); }
    if (!this.guiding() || this.navigation || this.transitioning) return;
    // Reconstruct priority from live warning objects after reload; restored casts do
    // not emit a second warning event. Interrupted/destroyed warnings lose grants now.
    if (this.scene.activeTelegraphs) {
      const active = new Set();
      for (const warning of this.scene.activeTelegraphs) if (warning.attacker?.isBoss) {
        active.add(warning.action?.castId);
        if (!this.warnings.has(warning.action?.castId)) {
          this.warnings.set(warning.action?.castId, { allowed: this.defensiveInteractions() });
          this.revision++; this.gate.reset();
        }
      }
      for (const id of this.warnings.keys()) if (!active.has(id)) {
        this.warnings.delete(id); this.revision++; this.gate.reset();
      }
    }
    if (!this.scope?.valid()) {
      this.releaseScope();
      const result = this.controller.reconcile(this.controller.capture());
      if (!result.ok) {
        this.saveBlocked = true;
        this.message = 'Tutorial progress could not be saved. Exit and try again.'; return;
      }
      this.scope = this.controller.scope(this.scene);
      this.scope.observe((event, token) => {
        if ((this.warnings.size && !this.step()?.keepDuringWarning) || this.confirmations.size) return;
        const result = this.controller.complete(token.checkpointId, event, token);
        if (result.ok) { this.message = ''; this.refresh(); }
        else if (result.reason === 'save_failed') {
          this.saveBlocked = true;
          this.message = 'Your action was saved. Tutorial progress will recover when you resume.';
          this.releaseScope();
        }
      });
      this.scope.own(() => { this.liveTarget = null; this.gate.reset(); });
      const facts = this.controller.reconcileFacts(this.scope.token);
      if (!facts.ok && facts.reason === 'save_failed') this.saveBlocked = true;
      if (!this.scope.valid()) { this.scope = null; return; }
    }
    const step = this.step();
    const live = (step?.targetIds ?? [step?.targetId]).map(id => this.targets.resolve(id, this.scene)).find(Boolean) ?? null;
    // A successful queued action can remove its cast target before its fact is delivered.
    // Ambient presentation releases targeting, while the current authority still observes that result.
    if (this.liveTarget && !live && !['ambient', 'card'].includes(step?.presentation)) { this.releaseScope(); return; }
    if (this.liveTarget?.generation !== live?.generation) {
      const gesture = this.gate.gesture;
      const receiver = gesture && this.targets.resolve(gesture.id, this.scene);
      const radialHandoff = (this.opening.active() || this.help.active()) && gesture?.id === 'battle-radial-gesture'
        && gesture.authorityId === this.controller.progress.authorityId
        && receiver?.generation === gesture.generation && this.allowed().includes(gesture.id);
      this.revision++; this.gate.reset();
      // Opening a radial reveals its petals during the same approved drag. Keep only
      // this unchanged receiver/authority lease; rebuilt controls still revoke it.
      if (radialHandoff) this.gate.gesture = { ...gesture, revision: this.revision };
    }
    this.liveTarget = live;
  }

  // Only a confirmation explicitly opened by the permitted tutorial action may borrow
  // these controls. An unrelated modal never gets an automatic blanket permission.
  confirm(scene, allowed) {
    if (this.storyActive && scene === this.scene && this.storyInteraction) {
      const interaction = this.storyInteraction, session = scene.gameplayObserverSessionId, id = crypto.randomUUID();
      let released = false;
      this.confirmations.set(id, { allowed }); this.revision++; this.gate.reset();
      return () => {
        if (released) return false;
        released = true; this.confirmations.delete(id); this.revision++; this.gate.reset();
        return this.storyActive && this.storyInteraction === interaction && scene.gameplayObserverSessionId === session;
      };
    }
    if (!this.guiding() || scene !== this.scene || !this.scope?.valid()) return () => {};
    const id = crypto.randomUUID(), token = this.scope.token;
    let released = false;
    this.confirmations.set(id, { allowed }); this.revision++; this.gate.reset();
    return () => {
      if (released) return false;
      released = true;
      this.confirmations.delete(id); this.revision++; this.gate.reset();
      return this.controller.authorized(token);
    };
  }

  warningEvent(event) {
    if (!this.guiding() || event.sceneSessionId !== this.scene?.gameplayObserverSessionId) return;
    if (event.type === 'combat.pause.changed' && event.pauseOwner !== 'tutorial') {
      this.opening.pausedScene = null; this.controller.progress.pauseOwnedEncounter = null;
      return;
    }
    const previous = this.warnings.size;
    if (event.type === 'combat.mechanic.warning' && event.critical) {
      this.warnings.set(event.castId, { allowed: this.defensiveInteractions() });
    } else if (event.type === 'combat.mechanic.resolved' || ['combat.cast.cancelled',
      'combat.cast.interrupted', 'combat.cast.resolved'].includes(event.type)) this.warnings.delete(event.castId);
    else if (event.type === 'combat.encounter.finished') this.warnings.clear();
    else return;
    if (previous !== this.warnings.size) { this.revision++; this.gate.reset(); }
  }

  defensiveInteractions() {
    return ['battle-pause', 'battle-command-INTERRUPT', ...(this.scene?.enemies ?? []).filter(e => e.alive && e.pendingAction).map(e => 'battle-enemy-' + e.id), 'battle-arena', 'battle-command-MOVE', 'battle-radial-SELECT', 'battle-radial-ACTION', 'battle-radial-gesture',
      ...['All', 'Tank', 'Healer', 'Melee', 'Ranged'].map(role => 'battle-role-' + role)];
  }

  exit(skip = false) {
    const recruitsBefore = this.controller.state.recruitedIds?.length ?? 0;
    this.opening.releasePause();
    this.releaseScope(); this.warnings.clear(); this.confirmations.clear();
    const result = exitTutorial(this.controller, skip);
    if (result.ok) {
      this.scene?.selectionDetailsClose?.();
      if ((this.controller.state.recruitedIds?.length ?? 0) !== recruitsBefore) {
        this.scene?.render?.(); this.scene?.hub?.refresh?.();
      }
    }
    this.message = result.ok ? '' : result.message ?? 'Tutorial could not be saved. Please try Exit again.';
    if (!result.ok) this.refresh();
    return result;
  }
}
