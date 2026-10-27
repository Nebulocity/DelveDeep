import { storyAction, storyActionTargets, storyWaveMatches } from '../../game/StoryPresentation.js';
import { STORY_WAVE_READY, storyWaveHasLanded } from '../../game/StoryWaveStart.js';
import { storyLocation } from '../../data/storyLocations.js';
import Phaser from 'phaser';
import TutorialDialogue, { tutorialPortraitCatalog } from '../../ui/TutorialDialogue.js';
import { dialogFrame, drawDialogOutline } from '../../ui/DialogFrame.js';
import { preferredInstructionPosition, safeExitPosition } from '../../ui/TutorialSpotlightLayout.js';
import { TutorialCuePlayer, tutorialAudioCatalog, preloadTutorialAudio } from '../../game/TutorialAudio.js';
import { tutorialGuidance } from '../../game/TutorialGuidance.js';
import { emptyTutorialProgress } from '../../game/TutorialProgress.js';
import GameState from '../../game/GameState.js';
import { STARTER_IDS } from '../../data/recruitment.js';
import { recruitmentPreview } from '../../game/Recruitment.js';
import { grantStartingEquipment } from '../../game/StartingEquipment.js';
import { selectedParty, partyDepartureProblem } from '../../game/PartySelection.js';
import { getDelveById } from '../../data/delves.js';
import { preloadCharacterSprites } from '../../data/characterSprites.js';
import { preloadTutorialNpcPortraits } from '../../data/tutorialNpcPortraits.js';
import { observeGameplay } from '../../game/GameplayEvents.js';

const send = (type, data = {}) => parent.postMessage({ studio: true, type, ...data }, location.origin);
let previewModalBlocked = false, previewInteractionAllowed = false, selectedPoint;
window.addEventListener('error', event => send('preview-error', { message: event.message }));
window.addEventListener('unhandledrejection', event => send('preview-error', { message: event.reason?.message ?? String(event.reason) }));
const game = (await import('../../main.js')).default;

// Authoring owns input before StudioStage exists, including while assets load.
const guardPreviewInput = () => {
  if (game.input) game.input.enabled = !previewModalBlocked;
  const scenes = game.scene.getScenes(true), studio = scenes.find(scene => scene.scene.key === 'StudioStage');
  const allowGameplay = (previewInteractionAllowed || !!studio?.actionInteraction || selectedPoint?.trigger === 'wave-start' && (studio?.waiting || studio?.finished)) && !!studio && !studio.confirming && !studio.transitioning;
  for (const scene of scenes) if (scene.input) {
    scene.input.enabled = !previewModalBlocked && (scene === studio || allowGameplay);
  }
};
game.events.on('prestep', guardPreviewInput);
game.events.once('destroy', () => game.events.off('prestep', guardPreviewInput));
const initialScene = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { game.events.off('poststep', check); reject(new Error('Game startup did not reach a scene. Reload the preview after checking its asset errors.')); }, 30000);
  const check = () => {
    const scene = game.scene.getScenes(true).find(scene => !['BootScene', 'TutorialOverlayScene'].includes(scene.scene.key));
    if (!scene) return;
    clearTimeout(timeout); game.events.off('poststep', check); resolve(scene);
  };
  game.events.on('poststep', check); check();
});
const guidance = tutorialGuidance(game);
// Authoring focus changes must not accrue offline progress or invoke settlement.
// The normal game retains its service; only this disposable iframe detaches it.
game.backgroundProgress?.destroy();
game.backgroundProgress = null;
guidance.releaseScope(); GameState.tutorialProgress = emptyTutorialProgress();
// Scene entry may offer onboarding again. Suppress that offer in this authoring
// instance without skipping recruitment, granting ownership or completing evidence.
const suppressCurriculumStart = () => ({ ok: true, previewOnly: true });
guidance.opening.start = suppressCurriculumStart;
guidance.help.start = suppressCurriculumStart;
game.scene.stop('TutorialOverlayScene');
let activeLocationId = null, showRequest = 0, previewPartyPrepared = false;
let sceneKey = initialScene.scene.key, selectedStep, picking = false, interactive = false, dragging = null, previewEpoch = 0;
document.addEventListener('visibilitychange', () => {
  game.music.setBackground(document.hidden); game.uiAudio.setBackground(document.hidden);
});

class StudioStage extends Phaser.Scene {
  constructor() { super({ key: 'StudioStage' }); }
  preload() { preloadTutorialAudio(this); preloadCharacterSprites(this); preloadTutorialNpcPortraits(this); }
  create() {
    this.dimmer = this.add.graphics();
    this.dialogue = new TutorialDialogue(this);
    this.dragShadow = this.add.graphics().setDepth(90);
    this.audio = new TutorialCuePlayer(this, message => send('status', { message }));
    this.exit = this.control('studio-exit', 'Exit Tutorial', () => { this.confirming = true; this.signature = null; });
    this.advanceDialogue = (reason = 'tap') => { if (storyAction(selectedStep) && reason !== 'action') return; if (this.transitioning || this.waiting || this.confirming || this.advancing || this.finished) return; this.advancing = true; this.audio.trigger('onAdvance'); send('advance'); };
    this.dialogue.setAdvance(this.advanceDialogue);
    this.prompt = this.add.container().setDepth(100);
    this.prompt.add(dialogFrame(this, 400, 150, 800, 300, 0, { compact: true }));
    this.prompt.add(this.add.text(400, 70, 'Exit this preview? Draft changes are kept.', { fontFamily: 'Georgia', fontSize: 32, color: '#fff1d2' }).setOrigin(.5));
    this.stay = this.control('studio-stay', 'Stay', () => { this.confirming = false; this.signature = null; });
    this.leave = this.control('studio-leave', 'Exit Tutorial', () => { this.stopPreview(); send('stopped'); });
    this.stay.root.setPosition(50, 170); this.leave.root.setPosition(450, 170);
    this.prompt.add([this.stay.root, this.leave.root]); this.prompt.setVisible(false);
    this.hidden = () => { cancelPanelDrag(); this.audioRequest = (this.audioRequest ?? 0) + 1; this.stopAudio(); this.dialogue.hide(); this.exit.root.setVisible(false); this.prompt.setVisible(false); this.dimmer.clear(); this.signature = null; };
    this.visible = () => { this.signature = null; };
    for (const event of ['blur', 'hidden']) game.events.on(event, this.hidden);
    for (const event of ['focus', 'visible']) game.events.on(event, this.visible);
    this.events.once('shutdown', () => {
      cancelPanelDrag();
      for (const e of ['blur', 'hidden']) game.events.off(e, this.hidden);
      for (const e of ['focus', 'visible']) game.events.off(e, this.visible);
    });
    this.lastCatalog = 0;
    this.unobserve = observeGameplay(event => {
      this.lastEntryEvent = event;
      const gate = this.actionInteraction;
      if (gate && event.sceneSessionId === gate.session && event.sequence > gate.afterSequence && storyAction(selectedStep)?.matches(event)) this.advanceDialogue('action');
      if (event.type === 'combat.pause.changed' && event.pauseOwner !== 'tutorial') this.pauseOwned = false;
      if (this.pendingEntry && this.pendingEntry.type === event.type && event.sceneSessionId === game.scene.getScene(sceneKey)?.gameplayObserverSessionId) {
        this.pendingEntry = null; this.waiting = false; this.signature = null;
        this.playSelectedAudio?.();
      }
    });
    this.events.once('shutdown', () => this.unobserve());
    this.sendCatalog = () => send('ready', { portraits: tutorialPortraitCatalog(this), audio: tutorialAudioCatalog().map(({ url, ...a }) => a) });
    this.sendCatalog();
    this.waveReady = source => {
      if (!this.waiting || this.pendingEntry?.type !== 'wave-start' || !storyWaveMatches(selectedPoint, source, GameState)) return;
      this.pendingEntry = null; this.waiting = false; this.signature = null;
      guidance.storyActive = true;
      if (!source.combatPaused) { source.togglePause('tutorial'); this.pauseOwned = true; }
      this.playSelectedAudio?.();
    };
    game.events.on(STORY_WAVE_READY, this.waveReady);
    this.events.once('shutdown', () => { this.releasePause(); game.events.off(STORY_WAVE_READY, this.waveReady); });
  }
  control(name, label, callback) {
    const frame = dialogFrame(this, 145, 42, 290, 84, 0, { compact: true });
    const text = this.add.text(145, 42, label, { fontSize: 31, fontFamily: 'Georgia', color: '#fff1d2' }).setOrigin(.5);
    const hit = this.add.zone(145, 42, 290, 84).setName(name).setInteractive({ useHandCursor: true });
    let pressed = null;
    const cancel = () => { pressed = null; };
    hit.on('pointerdown', (p, x, y, e) => { e?.stopPropagation(); pressed = { id: p.id, time: p.downTime }; });
    hit.on('pointerout', cancel);
    hit.on('pointerup', (p, x, y, e) => {
      e?.stopPropagation();
      const valid = pressed?.id === p.id && pressed.time === p.downTime && Math.hypot(p.x - p.downX, p.y - p.downY) <= 24;
      cancel(); if (valid) callback();
    });
    game.events.on('blur', cancel); this.input.on('pointerupoutside', cancel);
    this.events.once('shutdown', () => { game.events.off('blur', cancel); this.input.off('pointerupoutside', cancel); });
    return { root: this.add.container(0, 0, [frame, text, hit]), hit };
  }
  targets() {
    const scene = game.scene.getScene(sceneKey), ids = new Set();
    const entries = [...guidance.targets.entries].filter(e => e.scene === scene).reverse();
    return entries.flatMap(entry => {
      const id = typeof entry.id === 'function' ? entry.id() : entry.id;
      if (!id || ids.has(id)) return [];
      ids.add(id);
      const live = guidance.targets.live(entry);
      return [{ id, available: !!live, bounds: live?.bounds ?? null,
        reason: live ? 'Live registered receiver' : 'Hidden, masked, disabled or outside the current camera', depth: entry.object?.depth ?? 0 }];
    });
  }
  stopAudio() { this.audio.stop(); }
  releasePause() {
    const source = game.scene.getScene(sceneKey);
    if (this.pauseOwned && source?.sys.isActive() && source.combatPaused) source.togglePause('tutorial');
    this.pauseOwned = false;
  }
  stopPreview() {
    cancelPanelDrag();
    game.scene.getScene(sceneKey)?.cameras.cameras.forEach(camera => camera.resetFX());
    this.audioRequest = (this.audioRequest ?? 0) + 1;
    this.stopAudio(); this.releasePause(); this.actionInteraction = null; guidance.storyActive = false; guidance.storyInteraction = null; this.transitioning = false; this.advancing = false; ++showRequest; this.pendingEntry = null; selectedStep = null; this.confirming = false; this.dialogue.hide(); this.dimmer.clear();
    selectedPoint = null;
    this.exit.root.setVisible(false); this.prompt.setVisible(false);
  }
  update(time) {
    const source = game.scene.getScene(sceneKey);
    if (source?.sys.isActive()) {
      if (source.input) source.input.enabled = (interactive || !!this.actionInteraction || selectedPoint?.trigger === 'wave-start' && (this.waiting || this.finished)) && !dragging && !previewModalBlocked && !this.confirming && !this.transitioning;
      if (source.scene.key === 'BattleScene' && !source.combatPaused && !interactive && selectedPoint?.trigger !== 'wave-start') source.togglePause('tutorial');
    }
    const targets = this.targets();
    if (time - this.lastCatalog > 500) { this.lastCatalog = time; send('targets', { targets, scene: sceneKey }); }
    if (document.hidden || !selectedStep || this.finished) return;
    this.scene.bringToTop();
    const step = selectedStep;
    const action = storyAction(step);
    const focuses = [...new Set([...(step.targetIds ?? []), ...storyActionTargets(step)])].map(id => targets.find(t => t.id === id)?.bounds).filter(Boolean);
    const { width, height } = this.scale;
    const widthPanel = step.preset === 'wide' ? 1100 : 790;
    const measured = this.dialogue.measure(step, step.text, widthPanel);
    const heightPanel = Math.min(height - 210, Math.max(280, measured + 145));
    const protectedBounds = game.scene.getScene('TutorialOverlayScene')?.exclusions?.call({ guidance, scale: this.scale }, {}) ?? [];
    const modalBounds = source?.children.list.filter(o => o.visible && o.depth >= 10000 && o.dialogContentBounds)
      .map(o => o.getBounds()) ?? [];
    const avoid = [...focuses, ...protectedBounds, ...modalBounds];
    const insets = { left: 40, right: 40, top: 136, bottom: 30 };
    const exit = safeExitPosition(width, height, step.exitAnchor ?? 'top-right', avoid, insets);
    const bounds = preferredInstructionPosition(width, height, widthPanel, heightPanel, [...avoid, exit], insets, step.placement);
    this.resolveDragPlacement = preference => preferredInstructionPosition(width, height, widthPanel, heightPanel, [...avoid, exit], insets, preference);
    if (dragging) drawPanelDragShadow();
    // Artwork offsets update directly without invalidating panel placement.
    const { portraitOffsetX, portraitOffsetY, ...layoutStep } = step;
    const signature = JSON.stringify([layoutStep, focuses, bounds, exit, picking, this.confirming, !!source?.selectionDetailsClose,
      selectedPoint?.wave, source?.currentWaveIndex, source?.battleOver]);
    if (signature + this.waiting === this.signature) return;
    this.signature = signature + this.waiting;
    this.dimmer.clear();
    // Draw the complement of target rectangles, retaining every genuine opening.
    const holes = focuses.map(b => ({ x: Math.max(0, b.x - 10), y: Math.max(0, b.y - 10),
      right: Math.min(width, b.x + b.width + 10), bottom: Math.min(height, b.y + b.height + 10) }));
    const edges = [...new Set([0, height, ...holes.flatMap(b => [b.y, b.bottom])])].sort((a, b) => a - b);
    this.dimmer.fillStyle(0x080c12, step.dimming);
    if (!picking && !this.waiting) for (let i = 0; i < edges.length - 1; i++) {
      const top = edges[i], bottom = edges[i + 1]; let x = 0;
      for (const h of holes.filter(b => b.y <= top && b.bottom >= bottom).sort((a, b) => a.x - b.x)) {
        if (h.x > x) this.dimmer.fillRect(x, top, h.x - x, bottom - top);
        x = Math.max(x, h.right);
      }
      if (x < width) this.dimmer.fillRect(x, top, width - x, bottom - top);
    }
    if (!this.waiting) for (const b of focuses) drawDialogOutline(this.dimmer, b.x - 8, b.y - 8, b.width + 16, b.height + 16);
    if (source?.selectionDetailsClose) this.dimmer.clear();
    this.exit.root.setPosition(exit.x, exit.y).setVisible(true);
    this.prompt.setPosition((width - 800) / 2, 150).setVisible(!!this.confirming);

    if (!bounds || picking || this.confirming || this.waiting || this.transitioning || source?.selectionDetailsClose) { this.dialogue.hide(); }
    else {
      this.bounds = bounds; this.dialogue.setAdvance(action ? null : this.advanceDialogue, action ? action.satisfied(GameState) ? 'Garrick is already hired in this preview.' : action.instruction : 'Tap to advance').show(bounds, step);

    }
    let message = bounds ? 'Live scene. Safe placement resolved; drag the panel to suggest a preference.'
      : 'No safe panel position. Exit stays available; reduce text/size or choose another target.';
    if (this.waiting) {
      message = 'Waiting for a genuine ' + this.pendingEntry?.type + '. Use Interact with scene; no event is simulated.';
      if (selectedPoint?.trigger === 'wave-start') {
        const passed = source?.battleOver || source?.currentWaveIndex + 1 > selectedPoint.wave;
        message = passed ? 'This wave has already passed or the battle has ended. Refresh Studio for a fresh disposable run.'
          : 'Waiting for wave ' + selectedPoint.wave + ' and all enemy landings. Combat runs normally until then; no waves are skipped.';
      }
    }
    send('layout', { stepId: step.id, bounds, exit, preference: step.placement,
      resolvedPreference: bounds && !picking && !this.confirming && !this.waiting
        ? { anchor: 'preferred', space: 'canvas', x: bounds.x / width, y: bounds.y / height } : null,
      missing: (step.targetIds ?? []).filter(id => !targets.some(t => t.id === id && t.available)),
      message });
  }
}
game.scene.add('StudioStage', StudioStage, true);
const stage = () => game.scene.getScene('StudioStage');
function prepareDelvePreviewParty() {
  if (previewPartyPrepared) return;

  // Only the disposable iframe gets this authoring fixture. Direct Delve previews
  // must work without replaying recruitment, and must not emit a player hire fact.
  for (const id of STARTER_IDS) {
    if (!GameState.roster.some(hero => hero.id === id)) {
      const hero = recruitmentPreview(id);
      if (!hero) throw new Error('Starter adventurer unavailable for Studio preview: ' + id);
      GameState.roster.push(hero);
    }
    if (!GameState.recruitedIds.includes(id)) GameState.recruitedIds.push(id);
  }
  grantStartingEquipment(new Map(), GameState);
  if (partyDepartureProblem()) GameState.lastPartyIds = [...STARTER_IDS];
  previewPartyPrepared = true;
  send('status', { message: 'Delve preview party ready, including Garrick. Changes stay in this disposable Studio session.' });
}

// Real map navigation can open the overview without an editor scene switch.
const delvePreviewEvents = game.scene.getScene('DelveSelectScene').events;
delvePreviewEvents.on('start', prepareDelvePreviewParty);
game.events.once('destroy', () => delvePreviewEvents.off('start', prepareDelvePreviewParty));

async function activateScene(key, locationId) {
  const location = storyLocation(locationId);
  if (location && selectedPoint?.trigger !== 'wave-start') key = location.scene;
  if (locationId === activeLocationId && key === sceneKey && game.scene.getScene(key)?.sys.isActive()) return;
  if (!['TitleScene', 'TownScene', 'TavernScene', 'HeroesScene', 'PartySelectScene', 'DelveSelectScene', 'BattleScene', 'RewardScene', 'TacticsScene', 'EquipmentScene', 'AbilitiesScene', 'FacilityScene', 'BlacksmithScene', 'InventoryScene', 'QuestJournalScene', 'MarketScene', 'ExchangeScene', 'EverdeepScene'].includes(key)) throw new Error('Scene is not registered for Studio preview.');
  stage().stopAudio();
  for (const s of game.scene.getScenes(true)) if (!['StudioStage', 'TutorialOverlayScene'].includes(s.scene.key)) game.scene.stop(s.scene.key);
  sceneKey = key; activeLocationId = locationId;
  GameState.currentDelve = getDelveById(location?.delveId ?? 'slime-cave');
  if (key === 'DelveSelectScene' || key === 'BattleScene') prepareDelvePreviewParty();
  if (key === 'BattleScene') {
    GameState.activeParty = selectedParty().map(hero => ({ ...hero }));
    GameState.run.entry = 'progress';
  }
  game.scene.start(key, location?.data ?? (key === 'TownScene' ? { townId: 'pineshire', townName: 'Pineshire' } : undefined));
  await new Promise(resolve => game.events.once('poststep', resolve));
  stage().scene.bringToTop();
}
window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.source !== parent || !event.data?.studio) return;
  const { type, step } = event.data;
  try {
    if (type === 'modal') { previewModalBlocked = event.data.value === true; if (previewModalBlocked) cancelPanelDrag(); guardPreviewInput(); return; }
    if (type === 'catalog-request') { stage()?.sendCatalog?.(); return; }
    if (type === 'portrait-adjust') {
      if (selectedStep?.id !== event.data.stepId) return;
      const { key, value } = event.data;
      const ranges = { portraitScale: [.5, 1.5], portraitFrameScale: [.8, 1.25], portraitOffsetX: [-100, 100], portraitOffsetY: [-100, 100] };
      const range = Object.hasOwn(ranges, key) ? ranges[key] : null;
      if (!range || !Number.isFinite(value) || value < range[0] || value > range[1]) return;
      selectedStep[key] = value;
      if (key === 'portraitOffsetX' || key === 'portraitOffsetY') stage().dialogue.setPortraitOffsets(selectedStep);
      else {
        // Refresh geometry in place without replaying entry actions or audio.
        const layout = stage().dialogue.lastLayout;
        if (layout) stage().dialogue.show(layout.bounds, selectedStep, layout.text);
      }
      return;
    }
    if (type === 'show' || type === 'transition') {
      cancelPanelDrag();
      const request = ++showRequest;
      const incoming = type === 'transition' ? event.data.next : step;
      if (type === 'transition' && event.data.fadeMs) {
        stage().transitioning = true; stage().signature = null; stage().dialogue.hide();
        game.scene.getScene(sceneKey)?.cameras.cameras.forEach(camera => camera.fadeOut(event.data.fadeMs));
        await new Promise(resolve => stage().time.delayedCall(event.data.fadeMs, resolve));
      }
      if (request !== showRequest) return;
      stage().transitioning = false;
      await showStep(incoming, event.data.locationId, type === 'transition' || event.data.playAudio, event.data.point);
    } else if (type === 'finish') {
      cancelPanelDrag();
      if (event.data.fadeMs) game.scene.getScene(sceneKey)?.cameras.cameras.forEach(camera => camera.fadeOut(event.data.fadeMs));
      stage().releasePause(); stage().dialogue.hide(); stage().stopAudio(); stage().finished = true; stage().actionInteraction = null; guidance.storyActive = false; guidance.storyInteraction = null;
    } else if (type === 'pick') { cancelPanelDrag(); picking = event.data.value; stage().signature = null; }
    else if (type === 'interact') { interactive = event.data.value; previewInteractionAllowed = interactive; guardPreviewInput(); }
    else if (type === 'stop') { ++showRequest; stage().transitioning = false; game.scene.getScene(sceneKey)?.cameras.cameras.forEach(camera => camera.resetFX()); stage().stopPreview(); }
    else if (type === 'stop-audio') { stage().audioRequest = (stage().audioRequest ?? 0) + 1; stage().stopAudio(); }
    else if (type === 'play-audio') { await stage().audio.unlock(); stage().audio.play(event.data.cue); }
    else if (type === 'mute') { GameState.preferences.sfxMuted = event.data.value; GameState.development.musicEnabled = !event.data.value; stage().stopAudio(); }
  } catch (error) { stage().transitioning = false; send('status', { message: error.message }); }
});
async function showStep(step, locationId, playAudio, point) {
      stage().finished = false; stage().advancing = false;
      cancelPanelDrag();
      const requestId = stage().audioRequest = (stage().audioRequest ?? 0) + 1;
      // Retire the previous speaker immediately, including while a new entry cue is waiting.
      stage().stopAudio();
      stage().releasePause();
      selectedPoint = point;
      stage().actionInteraction = null; guidance.storyActive = false; guidance.storyInteraction = null;
      const afterSequence = GameState.gameplay?.serial ?? 0;
      const request = showRequest;
      await activateScene(step.scene, locationId);
      if (request !== showRequest) return;
      game.scene.getScene(sceneKey)?.cameras.cameras.forEach(camera => camera.resetFX());
      selectedStep = structuredClone(step); stage().signature = null; stage().confirming = false;
      stage().pendingEntry = step.entry.startsWith('event:') ? { type: step.entry.slice(6) } : null;
      const last = stage().lastEntryEvent;
      if (last && last.sequence > afterSequence && last.type === stage().pendingEntry?.type) stage().pendingEntry = null;
      stage().waiting = !!stage().pendingEntry;
      const source = game.scene.getScene(sceneKey), action = storyAction(step);
      if (point?.trigger === 'wave-start') {
        stage().waiting = !storyWaveMatches(point, source, GameState) || !storyWaveHasLanded(source);
        stage().pendingEntry = stage().waiting ? { type: 'wave-start' } : null;
      }
      if (action || point?.trigger === 'wave-start') {
        action?.prepare?.(source);
        guidance.scene = source; guidance.releaseScope(); guidance.storyActive = !stage().waiting;
        stage().actionInteraction = { scene: source, session: source.gameplayObserverSessionId,
          afterSequence: GameState.gameplay.serial, allowed: action?.satisfied(GameState) ? [] : storyActionTargets(step) };
        const interaction = stage().actionInteraction;
        if (action?.spotlight) interaction.onTargetClick = id => {
          if (stage().actionInteraction === interaction && selectedStep?.id === step.id
            && interaction.allowed.includes(id) && !previewModalBlocked && !document.hidden) stage().advanceDialogue('action');
        };
        guidance.storyInteraction = stage().actionInteraction;
      }
      if ((step.pause === 'narrative' || point?.trigger === 'wave-start') && sceneKey === 'BattleScene' && !source.combatPaused && !stage().waiting) {
        source.togglePause('tutorial'); stage().pauseOwned = true;
      }
      stage().playSelectedAudio = async () => { if (playAudio) {
        await stage().audio.unlock();
        if (stage().audioRequest !== requestId || selectedStep?.id !== step.id || document.hidden) return;
        stage().audio.enter(selectedStep, { key: `${++previewEpoch}:${step.id}`,
          sceneSessionId: game.scene.getScene(sceneKey).gameplayObserverSessionId, valid: () => !!selectedStep && !document.hidden });
      } };
      if (!stage().waiting) await stage().playSelectedAudio();
      if (action?.satisfied(GameState) && playAudio && request === showRequest) stage().advanceDialogue('action');
}
let suppressGestureEnd = false;
function consumePanelGesture(event) {
  event.preventDefault(); event.stopImmediatePropagation();
}
function cancelPanelDrag() {
  const previous = dragging;
  dragging = null;
  stage()?.dragShadow?.clear();
  if (previous && game.canvas.hasPointerCapture(previous.pointerId)) game.canvas.releasePointerCapture(previous.pointerId);
}
function panelDragPosition(event) {
  const rect = game.canvas.getBoundingClientRect();
  const { width, height } = stage().scale;
  const dx = (event.clientX - rect.x) * width / rect.width - dragging.x;
  const dy = (event.clientY - rect.y) * height / rect.height - dragging.y;
  return { distance: Math.hypot(dx, dy), placement: { anchor: 'preferred', space: 'canvas',
    x: Math.max(0, Math.min(1, (dragging.bounds.x + dx) / width)),
    y: Math.max(0, Math.min(1, (dragging.bounds.y + dy) / height)) } };
}
function drawPanelDragShadow() {
  const studio = stage();
  studio.dragShadow.clear();
  if (!dragging?.placement) return;

  // Use the drop resolver so protected controls and canvas edges match the final position.
  const bounds = studio.resolveDragPlacement(dragging.placement);
  if (!bounds) return;
  studio.dragShadow.fillStyle(0x080c12, 0.6).fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  drawDialogOutline(studio.dragShadow, bounds.x, bounds.y, bounds.width, bounds.height);
}
window.addEventListener('blur', cancelPanelDrag);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelPanelDrag(); });

// Phaser listens to mouse/touch events as well as browser pointer events. Own
// the entire panel gesture so neither those receivers nor map dragging see it.
for (const type of ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'click']) {
  window.addEventListener(type, event => {
    if (dragging || suppressGestureEnd && ['mouseup', 'touchend', 'touchcancel', 'click'].includes(type)) {
      consumePanelGesture(event);
      if (type === 'click') suppressGestureEnd = false;
    }
  }, { capture: true, passive: false });
}
window.addEventListener('pointerdown', event => {
  if (previewModalBlocked) return;
  if (dragging) { consumePanelGesture(event); return; }
  suppressGestureEnd = false;
  if (event.target !== game.canvas || event.button !== 0) return;
  const rect = game.canvas.getBoundingClientRect();
  const point = { x: (event.clientX - rect.x) * stage().scale.width / rect.width, y: (event.clientY - rect.y) * stage().scale.height / rect.height };
  if (picking) {
    event.preventDefault(); event.stopImmediatePropagation();
    const targets = stage().targets().filter(t => t.available && point.x >= t.bounds.x && point.x <= t.bounds.x + t.bounds.width
      && point.y >= t.bounds.y && point.y <= t.bounds.y + t.bounds.height).sort((a, b) => b.depth - a.depth || a.bounds.width * a.bounds.height - b.bounds.width * b.bounds.height);
    if (targets[0]) send('picked', { target: targets[0] });
    else send('status', { message: 'No available semantic target here. Unregistered/decorative artwork cannot be stored as a spotlight.' });
  } else if (selectedStep && stage().dialogue.frameHost.visible && stage().bounds && point.y < stage().bounds.y + 70 && point.y >= stage().bounds.y
    && point.x >= stage().bounds.x && point.x <= stage().bounds.x + stage().bounds.width) {
    consumePanelGesture(event);
    suppressGestureEnd = true;
    dragging = { pointerId: event.pointerId, stepId: selectedStep.id, x: point.x, y: point.y, bounds: stage().bounds };
    dragging.placement = panelDragPosition(event).placement;
    drawPanelDragShadow();
    game.canvas.setPointerCapture(event.pointerId);
  }
}, { capture: true, passive: false });
window.addEventListener('pointermove', event => {
  if (!dragging) return;
  consumePanelGesture(event);
  if (event.pointerId !== dragging.pointerId) return;
  dragging.placement = panelDragPosition(event).placement;
  drawPanelDragShadow();
}, { capture: true, passive: false });
window.addEventListener('pointerup', event => {
  if (!dragging) return;
  consumePanelGesture(event);
  if (event.pointerId !== dragging.pointerId) return;
  const { distance, placement } = panelDragPosition(event);
  if (distance > 15) {
    const bounds = stage().resolveDragPlacement(placement);
    if (bounds) send('placement', { stepId: dragging.stepId, placement: { anchor: 'preferred', space: 'canvas',
      x: bounds.x / stage().scale.width, y: bounds.y / stage().scale.height } });
    else send('status', { message: 'No safe space for this dialog. Reduce its size or change its spotlight targets before moving it.' });
  }
  if (distance <= 15) stage().advanceDialogue();
  cancelPanelDrag();
}, { capture: true, passive: false });
window.addEventListener('pointercancel', event => {
  if (!dragging) return;
  consumePanelGesture(event);
  if (event.pointerId === dragging.pointerId) cancelPanelDrag();
}, { capture: true, passive: false });
game.canvas.addEventListener('lostpointercapture', cancelPanelDrag);
