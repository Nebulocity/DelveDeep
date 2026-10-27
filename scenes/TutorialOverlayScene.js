import { preloadTutorialNpcPortraits } from '../data/tutorialNpcPortraits.js';
import StoryDirector from '../game/StoryDirector.js';
import { dialogFrame, drawDialogOutline } from '../ui/DialogFrame.js';
import Phaser from 'phaser';
import { tutorialGuidance } from '../game/TutorialGuidance.js';
import TutorialDialogue from '../ui/TutorialDialogue.js';
import { TutorialCuePlayer, preloadTutorialAudio } from '../game/TutorialAudio.js';
import { preferredInstructionPosition, safeExitPosition, overlaps } from '../ui/TutorialSpotlightLayout.js';
import { bindButtonPress } from '../ui/ButtonPress.js';
import { UI_FONT_FAMILIES, UI_FONT_SIZES } from '../config/uiTypography.js';
import { UI_SAFE_LEFT, UI_SAFE_RIGHT, UI_SAFE_BOTTOM, UI_SAFE_TOP } from '../ui/Layout.js';

// Story dialogue and curriculum share the presenter. Tapping dialogue never
// substitutes for a real hire, party save, movement or successful interrupt.
export default class TutorialOverlayScene extends Phaser.Scene {
  constructor() { super({ key: 'TutorialOverlayScene', active: true }); }
  preload() {
    if (!this.textures.exists('town-hub-panel')) this.load.image('town-hub-panel', new URL('../assets/ui/town-hub/panel.png', import.meta.url).href);
    preloadTutorialAudio(this, true); preloadTutorialNpcPortraits(this);
  }
  create() {
    this.guidance = tutorialGuidance(this.game);
    this.shade = this.add.graphics();
    this.targetMarker = this.add.graphics();
    this.dialogue = new TutorialDialogue(this);
    this.panel = this.dialogue.frameHost;
    this.instruction = this.dialogue.body;
    this.audioCues = new TutorialCuePlayer(this);
    this.guidance.requestExit = () => this.askExit();
    this.events.once('shutdown', () => { this.closeExitConfirmation(); this.guidance.requestExit = null; });
    this.help = this.add.text(0, 0, '', { fontFamily: UI_FONT_FAMILIES.sans,
      fontSize: UI_FONT_SIZES.compact26, color: '#c6bdac' });
    this.exit = this.button('tutorial-exit', 'Exit Tutorial', () => {
      if (this.restartMessage && !this.guidance.guiding()) this.restartMessage = null;
      else this.askExit();
      this.signature = null;
    }, 290, true);
    this.advanceDialogue = () => {
      this.audioCues.trigger('onAdvance');
      if (this.restartMessage && !this.guidance.guiding()) { this.restartMessage = null; this.signature = null; }
      else if (this.guidance.help.active()) this.guidance.help.continue();
      else this.guidance.opening.continue();
    };
    this.restart = this.button('tutorial-restart', '?', () => {
      const g = this.guidance;
      this.menuOpen = !this.menuOpen;
      this.menuScene = g.scene;
      this.signature = null;
    }, 96);
    this.restart.root.add(this.add.text(48, 96, 'Tutorial', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: 22, color: '#fff1d2' }).setOrigin(0.5));
    this.menuButtons = [
      ['Opening / Resume', () => this.guidance.opening.start(this.guidance.scene, !['active', 'paused', 'retry'].includes(this.guidance.controller.progress.status) || this.guidance.controller.progress.lessonId !== 'pineshire-first-adventure')],
      ['Leader Tap', () => this.guidance.help.start('leader')],
      ['Role groups', () => this.guidance.help.start('groups')],
      ['Formations', () => this.guidance.help.start('formations')],
      ['Tactics / Renown', () => this.guidance.help.start('tactics')],
      ['Back', () => ({ ok: true })]
    ].map(([label, action], i) => this.button('tutorial-menu-' + i, label, () => {
      this.menuOpen = false; const result = action(); this.restartMessage = result.ok ? null : result.message; this.signature = null;
    }, 500));
    this.recap = this.button('tutorial-recap', 'Finds / Equipment', () => {
      this.guidance.closureMessage = this.guidance.opening.equipmentMessage();
      this.restartMessage = this.guidance.closureMessage; this.signature = null;
    }, 360);
    this.compare = this.button('tutorial-compare', 'Compare find', () => {
      const g = this.guidance, offer = g.opening.townFind();
      this.restartMessage = null;
      const owner = g.scene, session = owner?.gameplayObserverSessionId;
      if (offer && owner?.scene.key === 'TownScene') {
        // Only select and navigate; the Equipment screen owns the actual transaction.
        import('../ui/CharacterSelection.js').then(({ selectCharacter }) => {
          if (g.guiding() || g.scene !== owner || owner.gameplayObserverSessionId !== session || !owner.sys.isActive()) return;
          selectCharacter(offer.hero.id); g.scene.scene.start('EquipmentScene', { slot: offer.item.slot, itemId: offer.item.id });
        });
      }
    }, 290);
    this.signature = null;
    this.story = new StoryDirector(this);
  }
  askExit() {
    if ((!this.guidance.guiding() && !this.story?.point) || this.exitConfirmationOpen) return;
    this.releaseExitConfirmation = this.guidance.confirm(this.guidance.scene, []);
    this.exitConfirmationOpen = true;
    this.signature = null;
  }
  closeExitConfirmation() {
    if (!this.exitConfirmationOpen && !this.exitPrompt && !this.releaseExitConfirmation) return;
    this.releaseExitConfirmation?.(); this.releaseExitConfirmation = null;
    this.exitConfirmationOpen = false;

    // Remove the prompt and its hit areas immediately, including between scenes.
    this.exitPrompt?.destroy(); this.exitPrompt = null; this.exitPromptButtons = [];
    this.signature = null;
  }
  updateExitConfirmation() {
    if (!this.exitConfirmationOpen) { this.closeExitConfirmation(); return; }
    if (!this.exitPrompt) {
      const root = this.add.container().setDepth(20000);
      root.add(dialogFrame(this, 340, 145, 680, 290, 0, { compact: true }));
      root.add(this.add.text(340, 54, 'Exit Tutorial?', { fontFamily: UI_FONT_FAMILIES.serif, fontSize: 36, color: '#fff1d2' }).setOrigin(.5));
      root.add(this.add.text(340, 105, 'Your progress is kept.', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: 28, color: '#c6bdac' }).setOrigin(.5));
      const stay = this.button('tutorial-exit-stay', 'Stay', () => this.closeExitConfirmation(), 260);
      const leave = this.button('tutorial-exit-confirm', 'Exit Tutorial', () => {
        this.closeExitConfirmation(); this.audioCues.stop(); if (this.story?.point) this.story.skip(); else this.guidance.exit(this.guidance.opening.active()); this.signature = null;
      }, 290);
      stay.root.setPosition(40, 165); leave.root.setPosition(340, 165);
      root.add([stay.root, leave.root]); this.exitPrompt = root; this.exitPromptButtons = [stay, leave];
    }
    const { width, height } = this.scale;
    const x = Math.max(UI_SAFE_LEFT + 24, Math.min((width - 680) / 2, width - UI_SAFE_RIGHT - 704));
    const y = Math.max(UI_SAFE_TOP + 24, Math.min((height - 290) / 2, height - UI_SAFE_BOTTOM - 314));
    this.shade.clear(); this.dimAround([], width, height);
    this.exitPrompt.setPosition(x, y).setVisible(true);
    this.exitPromptButtons.forEach(b => this.showButton(b, true));
  }
  button(name, label, action, width = 290, framed = false) {
    const face = framed ? dialogFrame(this, width / 2, 42, width, 84, 0, { compact: true })
      : this.add.rectangle(width / 2, 42, width, 84, 0x171d24).setStrokeStyle(2, 0xd3a750);
    const text = this.add.text(width / 2, 42, label, { fontFamily: UI_FONT_FAMILIES.serif,
      fontSize: UI_FONT_SIZES.body32, color: '#fff1d2' }).setOrigin(0.5);
    const hit = this.add.zone(width / 2, 42, width, 84).setName(name).setInteractive();
    hit.tutorialButtonEnabled = true;
    const root = this.add.container(0, 0, [face, text, hit]);
    hit.pressVisuals = [face];
    const { shadow } = bindButtonPress(this, hit, [text], () => { if (hit.tutorialButtonEnabled) action(); this.guidance.gate.reset(); });
    root.addAt(shadow, 0);
    return { root, hit, text, face, width };
  }
  showButton(button, visible, enabled = true) {
    button.root.setVisible(visible); button.hit.input.enabled = visible;
    button.hit.tutorialButtonEnabled = enabled;
    button.root.setAlpha(enabled ? 1 : 0.45);
  }
  exclusions(step) {
    const g = this.guidance, scene = g.scene;
    const bounds = [...(step.exclusionBounds ?? [])];
    if (scene?.scene.key === 'PartySelectScene') {
      bounds.push({ x: UI_SAFE_LEFT, y: scene.lineupY - scene.lineupHeight / 2,
        width: scene.scale.width - UI_SAFE_LEFT - UI_SAFE_RIGHT, height: scene.lineupHeight });
    }
    if (scene?.scene.key !== 'BattleScene') return bounds;
    const seen = new Set();

    // Protect actual HUD receivers, including cards, radial petals, potions and the
    // live encounter panel. Placement does not grant any of them input permission.
    for (const entry of g.targets.entries) {
      if (entry.scene !== scene || !entry.object || entry.object.depth < 4500 || seen.has(entry.object)) continue;
      seen.add(entry.object);
      const live = g.targets.live(entry);
      if (live) bounds.push(live.bounds);
    }
    for (const region of scene.partyLeaderTap?.targeting.regions() ?? []) if (region.enemy.pendingAction) {
      const b = region.core;
      bounds.push({ x: b.left, y: b.top - 90, width: b.right - b.left, height: b.bottom - b.top + 90 });
    }
    for (const telegraph of scene.activeTelegraphs ?? []) {
      if (!telegraph.warning?.visible) continue;
      const b = telegraph.warning.getBounds(), camera = scene.cameras.main;
      const corners = [[b.x, b.y], [b.right, b.y], [b.x, b.bottom], [b.right, b.bottom]]
        .map(([x, y]) => camera.matrix.transformPoint(x - camera.scrollX, y - camera.scrollY));
      const x = Math.min(...corners.map(p => p.x)), y = Math.min(...corners.map(p => p.y));
      bounds.push({ x, y, width: Math.max(...corners.map(p => p.x)) - x, height: Math.max(...corners.map(p => p.y)) - y });
    }
    return bounds;
  }
  update() {
    const g = this.guidance;
    if (this.story.update()) return;
    if (g.background) {
      this.dialogue.hide(); this.shade.clear(); this.targetMarker.clear(); this.help.setVisible(false);
      this.showButton(this.exit, false); 
      this.closeExitConfirmation(); this.signature = null; this.audioCues.stop(); return;
    }
    if (g.guiding()) g.refresh();
    if (g.controller.progress.retryReason === 'unsupported-curriculum' && !this.versionNoticeShown) {
      this.versionNoticeShown = true;
      this.restartMessage = 'Tutorial guidance has changed. Your adventure save is intact. Close this message, then use ? → Opening / Resume to restart guidance only.';
    }
    if (this.menuScene !== g.scene || g.guiding()) this.menuOpen = false;
    const progress = g.controller.progress;
    if (!g.guiding() && g.scene?.scene.key === 'TownScene' && !g.closureMessage
      && (progress.lessonId === 'pineshire-first-adventure' && progress.status === 'complete' || progress.openingRecord?.status === 'complete'))
      g.closureMessage = g.opening.equipmentMessage();
    const notice = !g.guiding() && !!this.restartMessage;
    const active = g.guiding() || notice;
    const { width, height } = this.scale;
    this.menuButtons.forEach((button, i) => {
      this.showButton(button, !!this.menuOpen && !active);
      button.root.setPosition((width - 500) / 2, 170 + i * 102);
    });
    this.showButton(this.recap, !g.guiding() && !notice && !this.menuOpen && !!g.closureMessage && g.scene?.scene.key === 'TownScene');
    this.recap.root.setPosition(width - UI_SAFE_RIGHT - 520, height - UI_SAFE_BOTTOM - 220);
    this.showButton(this.compare, notice && this.restartMessage === g.closureMessage && !!g.opening.townFind() && g.scene?.scene.key === 'TownScene');
    this.compare.root.setPosition(width / 2 - 145, height - UI_SAFE_BOTTOM - 120);
    const usableScene = g.scene?.sys.isActive() && !['BootScene', 'TutorialOverlayScene'].includes(g.scene.scene.key);
    this.showButton(this.restart, !active && !!usableScene);
    this.restart.root.setPosition(width - UI_SAFE_RIGHT - 120, height - UI_SAFE_BOTTOM - 220);
    this.showButton(this.exit, active);
    if (!active) { this.audioCues.stop(); this.closeExitConfirmation(); }

    if (!active) {
      
      if (this.signature !== 'inactive') { this.shade.clear(); this.targetMarker.clear(); this.panel.clear(); this.dialogue.hide(); this.help.setVisible(false); }
      this.signature = 'inactive'; return;
    }
    this.scene.bringToTop();
    const step = notice ? { presentation: 'card', instruction: this.restartMessage } : g.step() ?? {};
    const ambient = step.presentation === 'ambient';
    const canContinue = notice || g.saveBlocked || step.evidence?.type === 'tutorial.continued';
    const suspended = !notice && (g.background || (g.warnings.size && !step.keepDuringWarning) || g.confirmations.size
      || (!g.liveTarget && !['card', 'ambient'].includes(step.presentation)) || !g.scope?.valid() || g.transitioning);
    const targets = (step.targetIds ?? [step.targetId]).map(id => g.targets.resolve(id, g.scene)?.bounds).filter(Boolean);
    const supports = g.allowed().filter(id => id !== 'battle-arena' && !/^battle-(enemy|party)-/.test(id)).map(id => g.targets.resolve(id, g.scene))
      .filter(entry => entry && !entry.kinds?.some(kind => ['gesture', 'wheel', 'drag'].includes(kind))).map(entry => entry.bounds);
    const exclusions = this.exclusions(step);
    const insets = { left: UI_SAFE_LEFT + 24, right: UI_SAFE_RIGHT + 24, top: 160, bottom: UI_SAFE_BOTTOM + 24 };
    if (g.scene?.radialHud) {
      insets.aboveY = Math.min(...Object.values(g.scene.radialHud.centers)
        .map(control => g.targets.resolve(control.hit.name, g.scene)?.bounds.y).filter(Number.isFinite));
    }
    const avoid = [...targets, ...supports, ...exclusions];
    const exit = step.rewardPresentation ? { x: width - UI_SAFE_RIGHT - 290, y: (UI_SAFE_TOP - 84) / 2, width: 290, height: 84 }
      : safeExitPosition(width, height, step.exitAnchor ?? 'top-right', avoid,
        { left: UI_SAFE_LEFT + 24, right: UI_SAFE_RIGHT + 24, top: 136, bottom: UI_SAFE_BOTTOM + 24 });
    this.updateExitConfirmation();
    if (this.exitConfirmationOpen) {
      this.dialogue.hide(); this.help.setVisible(false);  return;
    }
    const text = (notice ? this.restartMessage : g.message) || step.instruction || 'Follow the highlighted control.';
    const signature = JSON.stringify([width, height, targets, supports, exclusions, exit, suspended, text, ambient, canContinue, step.suppressInstruction, step.rewardPresentation, step.tapPoint]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.exit.root.setPosition(exit.x, exit.y);
    
    this.shade.clear(); this.targetMarker.clear(); this.panel.clear(); this.dialogue.hide(); this.help.setVisible(false);
    // Inspection owns its full readable area and modal dimming. Keep Exit outside
    // the dialog without layering another instruction, dimmer or button over it.
    if (step.suppressInstruction) {
      this.audioCues.stop();
      // The victory panel owns its readable area. Only outline its actual Return control.
      if (step.rewardPresentation) {
        const visible = targets.filter(b => b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height);
        this.targetMarker.lineStyle(2, 0xd3a750, 0.7);
        visible.forEach(b => this.targetMarker.strokeRect(b.x - 6, b.y - 6, b.width + 12, b.height + 12));
        if (!visible.length) this.help.setText('Use Return to World Map when visible, or Exit Tutorial to continue freely.')
          .setPosition(UI_SAFE_LEFT, 38).setWordWrapWidth(exit.x - UI_SAFE_LEFT - 24).setVisible(true);
      }
      return;
    }
    if (suspended && !g.message) { this.audioCues.stop(); return; }
    if (!ambient) this.dimAround(targets, width, height, step.authoredPresentation?.dimming);
    if (step.tapPoint && !suspended) {
      const { x, y } = step.tapPoint;
      const radius = 22, arm = 10;
      this.targetMarker.lineStyle(4, 0xffdc86, 1);
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
        this.targetMarker.lineBetween(x + dx * (radius - arm), y + dy * radius, x + dx * radius, y + dy * radius);
        this.targetMarker.lineBetween(x + dx * radius, y + dy * radius, x + dx * radius, y + dy * (radius - arm));
      }
    }
    const compactBoss = g.controller.progress.checkpointId === 'boss-interrupt' && !ambient;
    if (compactBoss) {
      const rosterRight = Math.max(0, ...(g.scene?.partyUnits ?? []).map(unit => {
        const b = g.targets.resolve('battle-card-' + unit.id, g.scene)?.bounds;
        return b ? b.x + b.width : 0;
      }));
      insets.left = Math.max(insets.left, rosterRight + 24);
    }
    const panelWidth = Math.min(compactBoss ? 450 : step.authoredPresentation?.preset === 'wide' ? 1100 : 790, width - UI_SAFE_LEFT - UI_SAFE_RIGHT - 64);
    if (this.lastMeasuredText !== text || this.lastPanelWidth !== panelWidth) {
      this.measuredContent = this.dialogue.measure(step.authoredPresentation ?? { portraitSide: 'none' }, text, panelWidth);
      this.lastMeasuredText = text; this.lastPanelWidth = panelWidth;
    }
    const compactParty = compactBoss || g.scene?.scene.key === 'PartySelectScene' && !canContinue;
    const panelHeight = (this.measuredContent ?? this.instruction.height) + (compactParty ? 154 : 188);
    const previous = this.placement && { ...this.placement, width: panelWidth, height: panelHeight };
    const fits = previous && previous.x >= insets.left && previous.y >= insets.top
      && previous.x + panelWidth <= width - insets.right && previous.y + panelHeight <= height - insets.bottom
      && [...avoid, exit].every(bounds => !overlaps(previous, bounds));
    const placement = fits ? previous : preferredInstructionPosition(width, height, panelWidth, panelHeight, [...avoid, exit], insets, step.authoredPresentation?.placement);
    if (!placement) return;
    this.placement = placement;
    this.dialogue.setAdvance(canContinue ? this.advanceDialogue : null, canContinue ? 'Tap to advance' : ambient ? 'Continue by adventuring.' : 'Use the highlighted control to continue.');
    this.dialogue.show({ ...placement, width: panelWidth, height: panelHeight },
      step.authoredPresentation ?? { portraitSide: 'none' }, text);
    const audioKey = [g.controller.progress.attemptId, g.controller.progress.checkpointId, g.scene?.gameplayObserverSessionId].join(':');
    if (this.audioKey !== audioKey) {
      this.audioKey = audioKey;
      this.audioCues.enter(step.authoredPresentation ?? { id: audioKey, audio: [] }, { key: audioKey,
        attemptId: g.controller.progress.attemptId, sceneSessionId: g.scene?.gameplayObserverSessionId, valid: () => g.guiding() && !g.background });
    }
    this.lastInstruction = text;

    // Exit keeps its separate safe anchor while the dialogue itself handles taps.
    this.exit.root.setPosition(exit.x, exit.y);

    

  }
  dimAround(targets, width, height, opacity = 0.52) {
    const holes = targets.map(b => ({ x: Math.max(0, b.x - 10), y: Math.max(0, b.y - 10),
      right: Math.min(width, b.x + b.width + 10), bottom: Math.min(height, b.y + b.height + 10) }));
    // Split into horizontal strips so equivalent controls each retain a genuine clear
    // opening, including overlapping holes. No opaque image is drawn over a target.
    const edges = [...new Set([0, height, ...holes.flatMap(b => [b.y, b.bottom])])].sort((a, b) => a - b);
    this.shade.fillStyle(0x080c12, opacity);
    for (let i = 0; i < edges.length - 1; i++) {
      const top = edges[i], bottom = edges[i + 1]; let x = 0;
      for (const hole of holes.filter(b => b.y <= top && b.bottom >= bottom).sort((a, b) => a.x - b.x)) {
        if (hole.x > x) this.shade.fillRect(x, top, hole.x - x, bottom - top);
        x = Math.max(x, hole.right);
      }
      if (x < width) this.shade.fillRect(x, top, width - x, bottom - top);
    }
    this.shade.lineStyle(3, 0xd3a750, 0.95);
    holes.forEach(b => {
      if (this.guidance.scene?.scene.key === 'TitleScene') {
        drawDialogOutline(this.shade, b.x, b.y, b.right - b.x, b.bottom - b.y);
      } else this.shade.strokeRect(b.x, b.y, b.right - b.x, b.bottom - b.y);
    });
  }
}
