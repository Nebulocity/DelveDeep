import { observeGameplay } from './GameplayEvents.js';
import { exitTutorial } from './TutorialOwner.js';
import published from '../data/tutorialPresentation.json' with { type: 'json' };
import GameState from './GameState.js';
import { saveProfile } from './GameStorage.js';
import { storyPoints, storyLines, storyAction, storyActionTargets, storyWaveMatches } from './StoryPresentation.js';
import { STORY_WAVE_READY, storyWaveHasLanded } from './StoryWaveStart.js';
import { storyLocation, storyLocationMatches } from '../data/storyLocations.js';
import { getDelveById } from '../data/delves.js';
import { preferredInstructionPosition, safeExitPosition } from '../ui/TutorialSpotlightLayout.js';
import { UI_SAFE_LEFT, UI_SAFE_RIGHT, UI_SAFE_BOTTOM } from '../ui/Layout.js';

// Story progress records dialogue only. It cannot recruit, grant rewards or
// satisfy tutorial evidence. Scene routing comes exclusively from the catalog.
export default class StoryDirector {
  constructor(overlay) {
    this.overlay = overlay;
    this.advance = () => this.next();
    this.generation = 0;
    this.waveReady = source => {
      if (globalThis.__tutorialStudioPreview || !GameState.storyProgress || this.point || this.transitioning
        || overlay.guidance.background || overlay.guidance.scene !== source) return;
      const point = this.available().find(point => !GameState.storyProgress?.completed.includes(point.id)
        && storyWaveMatches(point, source, GameState));
      if (point) this.begin(point, GameState.storyProgress.activeId === point.id);
    };
    overlay.game.events.on(STORY_WAVE_READY, this.waveReady);
    this.unobserve = observeGameplay(event => {
      if (this.pausedScene?.gameplayObserverSessionId === event.sceneSessionId
        && event.type === 'combat.pause.changed' && event.pauseOwner !== 'tutorial') {
        this.pausedScene = null; GameState.storyProgress.pausedEncounterId = null; saveProfile();
      }
      const gate = this.interaction;
      if (!this.point || !gate || this.line()?.id !== gate.lineId || this.transitioning) return;
      if (event.sceneSessionId === gate.session && event.sequence > gate.afterSequence && storyAction(this.line())?.matches(event)) this.next('action');
    });
    overlay.events.once('shutdown', () => { this.releasePause(); overlay.game.events.off(STORY_WAVE_READY, this.waveReady); this.unobserve(); overlay.guidance.storyActive = false; overlay.guidance.storyInteraction = null; });
  }
  available() {
    return storyPoints(published).filter(point => point.enabled && storyLines(published, point).length);
  }
  update() {
    if (globalThis.__tutorialStudioPreview) return false;
    const view = this.overlay, guide = view.guidance, progress = GameState.storyProgress;
    if (!progress || !guide.scene?.sys.isActive()) return false;
    if (!this.point) {
      const points = this.available(), next = points.find(point => !progress.completed.includes(point.id));
      const resumed = points.find(point => point.id === progress.activeId);
      if (resumed?.trigger === 'wave-start') {
        if (storyWaveMatches(resumed, guide.scene, GameState) && storyWaveHasLanded(guide.scene)) this.begin(resumed, true);
      }
      else if (GameState.activeBattle) return false;
      else if (resumed) this.begin(resumed, true);
      else if (next && (next.trigger === 'intro' && GameState.tutorial.status === 'pending'
        || next.trigger === 'scene-enter' && storyLocationMatches(storyLocation(next.locationId), guide.scene, GameState))) this.begin(next);
    }
    if (!this.point && !this.transitioning) return false;
    guide.storyActive = true;
    view.scene.bringToTop();
    view.restart.root.setVisible(false); view.recap.root.setVisible(false); view.compare.root.setVisible(false);
    view.menuButtons.forEach(button => button.root.setVisible(false));
    view.shade.clear(); view.targetMarker.clear(); view.help.setVisible(false);
    if (guide.background) {
      this.fadeTween?.pause();
      view.exitPrompt?.setVisible(false); view.releaseExitConfirmation?.(); view.exitConfirmationOpen = false;
      view.dialogue.hide(); view.showButton(view.exit, false); view.audioCues.stop(); return true;
    }
    this.fadeTween?.resume();
    const { width, height } = view.scale;
    const insets = { left: UI_SAFE_LEFT + 24, right: UI_SAFE_RIGHT + 24, top: 160, bottom: UI_SAFE_BOTTOM + 24 };
    const currentLine = this.line();
    const exitAvoid = [...(currentLine?.targetIds ?? []), ...storyActionTargets(currentLine)]
      .map(id => guide.targets.resolve(id, guide.scene)?.bounds).filter(Boolean);
    const exit = safeExitPosition(width, height, published.exitAnchor, exitAvoid, insets);
    view.exit.root.setPosition(exit.x, exit.y).setDepth(2000);
    view.showButton(view.exit, true);
    view.exit.text.setText(storyAction(this.line()) ? 'Exit Tutorial' : 'Exit Story');
    view.updateExitConfirmation(exit, []);
    const atLocation = this.point.trigger === 'wave-start' ? storyWaveMatches(this.point, guide.scene, GameState)
      : storyLocationMatches(storyLocation(this.point.locationId), guide.scene, GameState);
    if (!atLocation && this.point.trigger === 'wave-start') { this.finish(); return false; }
    if (this.transitioning || !atLocation || view.exitConfirmationOpen) { view.dialogue.hide(); return true; }
    const line = this.line();
    if (!line) return true;
    const action = storyAction(line);
    if (this.interaction?.lineId !== line.id || this.interaction?.session !== guide.scene.gameplayObserverSessionId) {
      action?.prepare?.(guide.scene);
      this.interaction = { lineId: line.id, scene: guide.scene, session: guide.scene.gameplayObserverSessionId,
        afterSequence: GameState.gameplay.serial, allowed: storyActionTargets(line) };
      const interaction = this.interaction;
      if (action?.spotlight) interaction.onTargetClick = id => {
        if (this.point && this.interaction === interaction && this.line()?.id === line.id
          && interaction.allowed.includes(id) && !view.exitConfirmationOpen) this.next('action');
      };
      guide.storyInteraction = this.interaction; guide.revision++; guide.gate.reset();
    }
    if (action?.satisfied(GameState)) { this.next('action'); return true; }
    if (guide.confirmations.size || guide.scene.selectionDetailsClose) { view.dialogue.hide(); return true; }
    const targets = [...new Set([...line.targetIds, ...storyActionTargets(line)])].map(id => guide.targets.resolve(id, guide.scene)?.bounds).filter(Boolean);
    const panelWidth = Math.min(line.preset === 'wide' ? 1100 : 790, width - insets.left - insets.right);
    const panelHeight = Math.min(height - insets.top - insets.bottom, Math.max(280, view.dialogue.measure(line, line.text, panelWidth) + 145));
    const bounds = preferredInstructionPosition(width, height, panelWidth, panelHeight, [exit, ...targets], insets, line.placement);
    if (!bounds) { view.dialogue.hide(); return true; }
    view.dimAround(targets, width, height, line.dimming);
    view.dialogue.setAdvance(action ? null : this.advance, action?.instruction ?? 'Tap to advance').show(bounds, line);
    if (this.audioLine !== line.id) {
      this.audioLine = line.id;
      view.audioCues.enter(line, { key: 'story:' + line.id + ':' + this.generation,
        sceneSessionId: guide.scene.gameplayObserverSessionId, valid: () => !!this.point && !guide.background });
    }
    return true;
  }
  line() { return storyLines(published, this.point)[this.lineIndex]; }
  begin(point, resume = false) {
    this.point = point;
    const lines = storyLines(published, point);
    this.lineIndex = resume ? Math.max(0, lines.findIndex(line => line.id === GameState.storyProgress.lineId)) : 0;
    if (point.trigger === 'wave-start') {
      this.intro = false;
      const source = this.overlay.guidance.scene;
      if (!source.combatPaused) {
        this.pausedScene = source; source.togglePause('tutorial');
        GameState.storyProgress.pausedEncounterId = source.gameplayContext.encounterId;
      } else if (GameState.storyProgress.pausedEncounterId === source.gameplayContext.encounterId) this.pausedScene = source;
      this.pausedSession = source.gameplayObserverSessionId;
    } else if (point.trigger === 'intro' || resume && GameState.tutorial.status === 'pending') this.intro = true;
    GameState.storyProgress.activeId = point.id;
    GameState.storyProgress.lineId = this.line()?.id ?? null;
    saveProfile();
    this.overlay.guidance.storyActive = true;
    this.overlay.guidance.releaseScope();
    if (point.trigger !== 'wave-start') this.route(storyLocation(point.locationId));
  }
  releasePause() {
    const source = this.pausedScene;
    this.pausedScene = null;
    if (source) GameState.storyProgress.pausedEncounterId = null;
    if (source?.sys.isActive() && source.gameplayObserverSessionId === this.pausedSession && source.combatPaused && !source.battleOver) source.togglePause('tutorial');
  }
  route(location) {
    const guide = this.overlay.guidance;
    if (storyLocationMatches(location, guide.scene, GameState)) return;
    if (location.delveId) GameState.currentDelve = getDelveById(location.id) ?? getDelveById(location.delveId);
    guide.scene.scene.start(location.scene, location.data);
  }
  next(reason = 'tap') {
    if (this.point && storyAction(this.line()) && reason !== 'action') return;
    if (!this.point || this.transitioning || this.overlay.guidance.background) return;
    const view = this.overlay;
    view.audioCues.trigger('onAdvance');
    if (storyLines(published, this.point)[this.lineIndex + 1]) {
      this.lineIndex++; GameState.storyProgress.lineId = this.line().id; saveProfile(); return;
    }
    const point = this.point, duration = point.exitFadeMs, generation = ++this.generation;
    this.transitioning = true;
    view.dialogue.hide();
    const finish = () => {
      if (generation !== this.generation) return;
      this.completePoint(point);
      const points = this.available(), next = points.slice(points.indexOf(point) + 1).find(p => !GameState.storyProgress.completed.includes(p.id));
      this.transitioning = false;
      this.releasePause();
      if (next?.trigger === 'after-previous') this.begin(next);
      else { if (next?.trigger === 'wave-start') this.intro = false; this.finish(); }
      this.fade?.destroy(); this.fade = null;
    };
    if (!duration) { finish(); return; }
    this.fade = view.add.rectangle(0, 0, view.scale.width, view.scale.height, 0).setOrigin(0).setDepth(1000).setAlpha(0);
    this.fadeTween = view.tweens.add({ targets: this.fade, alpha: 1, duration, onComplete: () => { this.fadeTween = null; finish(); } });
  }
  completePoint(point) {
    this.releasePause();
    const progress = GameState.storyProgress;
    if (!progress.completed.includes(point.id)) progress.completed.push(point.id);
    progress.activeId = null; progress.lineId = null; saveProfile();
  }
  skip() {
    if (!this.point) return;
    if (this.line()?.completion === 'hire-garrick') {
      const guide = this.overlay.guidance;
      const result = exitTutorial(guide.controller, true, 'recruitment');
      if (!result.ok) { guide.message = result.message ?? 'Tutorial could not be saved. Please try Exit again.'; return; }
      guide.scene.selectionDetailsClose?.(); guide.scene.render?.(); this.intro = false;
    }
    ++this.generation;
    this.fadeTween?.stop(); this.fadeTween = null;
    if (this.fade) { this.overlay.tweens.killTweensOf(this.fade); this.fade.destroy(); this.fade = null; }
    const points = this.available(), start = points.indexOf(this.point);
    this.completePoint(this.point);
    for (const point of points.slice(start + 1)) {
      if (point.trigger !== 'after-previous') break;
      this.completePoint(point);
    }
    this.finish();
  }
  finish() {
    const view = this.overlay, guide = view.guidance;
    this.releasePause();
    this.point = null; this.transitioning = false; this.audioLine = null;
    view.audioCues.stop(); view.dialogue.hide(); view.shade.clear(); view.signature = null;
    view.exit.text.setText('Exit Tutorial'); view.exit.root.setDepth(0);
    guide.storyActive = false; guide.storyInteraction = null; this.interaction = null;
    if (this.intro) {
      this.intro = false;
      GameState.world.currentLocation = 'pineshire'; GameState.world.travel = null; saveProfile();
      if (guide.scene.scene.key !== 'TownScene') guide.scene.scene.start('TownScene', { townId: 'pineshire', townName: 'Pineshire' });
      else if (GameState.tutorial.status === 'pending') guide.opening.start(guide.scene);
    } else guide.refresh();
  }
}
