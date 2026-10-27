import { dialogFrame } from './DialogFrame.js';
import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { TUTORIAL_NPC_PORTRAITS } from '../data/tutorialNpcPortraits.js';
import { DIALOGUE_PORTRAITS, acquireDialoguePortrait } from '../data/dialoguePortraits.js';
import { applyCharacterPose, characterArtworkBounds } from './CharacterSpriteDisplay.js';
import { UI_FONT_FAMILIES, UI_FONT_SIZES } from '../config/uiTypography.js';
import HapticsService from '../services/HapticsService.js';
export { dialoguePortraitCatalog as tutorialPortraitCatalog } from '../data/dialoguePortraitCatalog.js';

// One presenter keeps its frame, labels and portrait receiver alive across lines.
// Only geometry changes rebuild the frame; animation advances existing sprite poses.
export default class TutorialDialogue {
  constructor(scene) {
    this.scene = scene;
    this.frameHost = scene.add.container();
    this.frameHost.clear = () => { this.frameHost.removeAll(true); this.frameSize = null; return this.frameHost; };
    this.body = scene.add.text(0, 0, '', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: UI_FONT_SIZES.body34, color: '#fff1d2', lineSpacing: 8 });
    this.speaker = scene.add.text(0, 0, '', { fontFamily: UI_FONT_FAMILIES.serif, fontSize: UI_FONT_SIZES.body34, color: '#ffdb86', fontStyle: 'bold' });
    this.missing = scene.add.text(0, 0, '', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: 25, color: '#e6cba2', align: 'center' });
    this.sprite = scene.add.image(0, 0, '__WHITE').setVisible(false);
    this.maskArt = scene.make.graphics({ add: false });
    this.portraitMask = this.maskArt.createGeometryMask();
    this.sprite.setMask(this.portraitMask);
    this.bodyMaskArt = scene.make.graphics({ add: false });
    this.bodyMask = this.bodyMaskArt.createGeometryMask(); this.body.setMask(this.bodyMask);
    this.scrollHint = scene.add.text(0, 0, 'Scroll to read', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: 22, color: '#c6bdac' }).setVisible(false);
    this.scroll = 0;
    this.footer = scene.add.text(0, 0, '', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: 25, color: '#c6bdac' });
    this.tap = scene.add.zone(0, 0, 1, 1).setOrigin(0).setName('tutorial-continue').setInteractive({ useHandCursor: true });
    this.tap.on('pointerdown', (pointer, x, y, event) => {
      event?.stopPropagation();
      this.press = { id: pointer.id, time: pointer.downTime, key: this.contentKey, scroll: this.scroll, callback: this.advance };
    });
    this.tap.on('pointermove', pointer => {
      if (this.press?.id !== pointer.id || !pointer.isDown || !this.textBounds) return;
      const delta = pointer.y - pointer.prevPosition.y;
      this.scroll = Math.max(0, Math.min(Math.max(0, this.body.height - this.textBounds.height), this.scroll - delta));
      this.body.y = this.textBounds.y - this.scroll;
    });
    this.tap.on('pointerup', (pointer, x, y, event) => {
      event?.stopPropagation();
      const press = this.press; this.press = null;
      if (!press || press.id !== pointer.id || press.time !== pointer.downTime || press.key !== this.contentKey
        || press.callback !== this.advance || Math.hypot(pointer.x - pointer.downX, pointer.y - pointer.downY) > 24
        || press.scroll !== this.scroll || !this.advance) return;
      HapticsService.tap(); this.advance();
    });
    this.tap.on('pointerout', () => { this.press = null; });
    this.tap.on('wheel', (pointer, dx, dy, dz, event) => {
      event?.stopPropagation(); this.wheel(pointer, [], dx, dy);
    });
    this.cancelPress = () => { this.press = null; };
    scene.game.events.on('blur', this.cancelPress);
    scene.input.on('pointerupoutside', this.cancelPress);
    this.wheel = (pointer, objects, dx, dy) => {
      const b = this.textBounds;
      if (!this.body.visible || !b || pointer.x < b.x || pointer.x > b.x + b.width || pointer.y < b.y || pointer.y > b.y + b.height) return;
      this.scroll = Math.max(0, Math.min(Math.max(0, this.body.height - b.height), this.scroll + dy)); this.body.y = b.y - this.scroll;
    };
    scene.input.on('wheel', this.wheel);
    this.tick = this.tick.bind(this);
    scene.events.on('update', this.tick);
    scene.events.once('shutdown', () => this.destroy());
    this.hide();
  }
  setAdvance(callback, note = 'Tap to advance') {
    this.advance = callback;
    this.footer.setText(note);
    return this;
  }
  measure(step, text, width) {
    this.step = step;
    this.portraitWidth = step.portraitSide !== 'none' && step.portraitId
      ? Math.min(Math.min(240, width * .26) * (step.portraitFrameScale ?? 1.1), width * .34) : 0;
    this.body.setText(text).setWordWrapWidth(width - 56 - this.portraitWidth);
    this.speaker.setText(step.speaker ?? '');
    return Math.max(this.body.height + (step.speaker ? 46 : 0), this.portraitWidth ? 190 : 0);
  }
  show(bounds, step, text = step.text) {
    if (this.destroyed) return;
    this.lastLayout = { bounds, step, text };
    this.measure(step, text, bounds.width);
    const { x, y, width, height } = bounds;
    const contentKey = [step.id, step.portraitId, step.portraitSide, step.portraitMode, step.speaker, text].join(':');
    if (contentKey !== this.contentKey) {
      this.contentKey = contentKey;
      this.scroll = 0;
      const objects = [this.body, this.speaker, this.sprite];
      this.scene.tweens.killTweensOf(objects);
      objects.forEach(o => o.setAlpha(step.fadeMs ? 0 : 1));
      if (step.fadeMs) this.scene.tweens.add({ targets: objects, alpha: 1, duration: step.fadeMs,
        ease: step.easing === 'linear' ? 'Linear' : 'Sine.easeOut' });
    }
    const size = `${width}:${height}`;
    if (this.frameSize !== size) {
      this.frameHost.clear();
      this.frameHost.add(dialogFrame(this.scene, x + width / 2, y + height / 2, width, height, 0, { compact: true }));
      this.frameSize = size;
    } else this.frameHost.list[0].setPosition(x + width / 2, y + height / 2);
    const left = x + 28 + (step.portraitSide === 'left' ? this.portraitWidth : 0);
    this.frameHost.setVisible(true);
    this.footer.setPosition(x + 28, y + height - 62).setWordWrapWidth(width - 56).setVisible(true);
    this.tap.setPosition(x, y).setSize(width, height).setVisible(true);
    if (this.tap.input) this.tap.input.enabled = true;
    this.speaker.setPosition(left, y + 24).setVisible(!!step.speaker);
    this.body.setPosition(left, y + 24 + (step.speaker ? 46 : 0)).setVisible(true)
      .setColor(step.emphasis === 'gold' ? '#ffdb86' : '#fff1d2');
    // Fill the former button area, reserving a scroll hint only when text overflows.
    const availableTextHeight = Math.max(40, this.footer.y - 12 - this.body.y);
    const needsScroll = this.body.height > availableTextHeight;
    this.textBounds = { x: left, y: this.body.y, width: width - 56 - this.portraitWidth,
      height: Math.max(40, availableTextHeight - (needsScroll ? 36 : 0)) };
    this.scroll = Math.min(this.scroll, Math.max(0, this.body.height - this.textBounds.height));
    this.bodyMaskArt.clear().fillStyle(0xffffff).fillRect(this.textBounds.x, this.textBounds.y, this.textBounds.width, this.textBounds.height);
    this.body.y -= this.scroll;
    this.scrollHint.setPosition(left, this.footer.y - 32).setVisible(needsScroll);
    this.sprite.setVisible(false); this.missing.setVisible(false); this.clip = null;
    const generated = this.portraitWidth ? DIALOGUE_PORTRAITS[step.portraitId] : null;
    const requested = generated ? step.portraitId : null;
    if (requested !== this.requestedPortrait) {
      this.releasePortrait?.(); this.releasePortrait = null;
      this.requestedPortrait = requested;
      this.portraitLoadFailed = false;
      if (requested) this.releasePortrait = acquireDialoguePortrait(this.scene, requested, (ok, reason) => {
        if (this.requestedPortrait !== requested || !this.lastLayout) return;
        if (reason === 'interrupted') {
          this.releasePortrait?.(); this.releasePortrait = null; this.requestedPortrait = null;
          if (!this.scene.sys.isActive()) return;
        }
        this.portraitLoadFailed = !ok;
        const layout = this.lastLayout;
        this.show(layout.bounds, layout.step, layout.text);
      });
    }
    if (!this.portraitWidth) return;
    const cx = step.portraitSide === 'left' ? x + 28 + this.portraitWidth / 2 : x + width - 28 - this.portraitWidth / 2;
    const npc = generated ?? TUTORIAL_NPC_PORTRAITS[step.portraitId];
    const definition = npc ?? CHARACTER_SPRITES[step.portraitId];
    const clip = npc?.idle ?? definition?.clips?.idle?.south;
    const source = step.portraitMode === 'special' && npc?.special ? npc.special
      : step.portraitMode === 'talk' && npc?.talk ? npc.talk
      : step.portraitMode === 'portrait' && definition?.portraitFrame ? definition.portraitFrame : clip;
    const frames = source?.frames ?? (source ? [source] : []);
    if (!frames.length || frames.some(f => !this.scene.textures.exists(f.key))) {
      const message = generated && !this.portraitLoadFailed ? 'Loading portrait' : 'Portrait unavailable';
      this.missing.setText(`${message}:\n${step.portraitId}`).setWordWrapWidth(this.portraitWidth - 18)
        .setPosition(cx, y + 48).setOrigin(.5, 0).setVisible(true); return;
    }
    const art = characterArtworkBounds(this.scene, source);
    if (!art) return;
    const slotWidth = this.portraitWidth - 24;

    // Enlarge the portrait window while keeping its bottom above the footer.
    const slotHeight = Math.max(1, Math.min(height - 104, Math.min(height - 145, 250) * (step.portraitFrameScale ?? 1.1)));
    const scales = [slotWidth / (art.right - art.left), slotHeight / (art.bottom - art.top)];
    const fit = step.crop === 'cover' ? Math.max(...scales) : Math.min(...scales);

    // The mask contains crop/scale preferences above the footer.
    const scale = fit * (step.portraitScale ?? 1);
    this.scene.textures.get(frames[0].key).setFilter(1);
    this.maskArt.clear().fillStyle(0xffffff).fillRect(cx - slotWidth / 2, y + 30, slotWidth, slotHeight);

    this.portraitPosition = { x: cx - (art.left + art.right) * scale / 2,
      y: y + 30 + slotHeight / 2 - (art.top + art.bottom) * scale / 2, width: slotWidth, height: slotHeight };
    this.sprite.setScale(scale).setVisible(true);
    this.setPortraitOffsets(step);
    this.clip = { frames, frameMs: source.frameMs ?? 110, durationMs: source.durationMs, next: source.next };

    // Layout updates must not restart a line's three-second speech or breathing.
    const animationKey = `${contentKey}:${step.portraitMode}:${frames[0].key}`;
    if (this.animationKey !== animationKey) { this.animationKey = animationKey; this.elapsed = 0; }
    this.applyPortraitFrame();
  }
  setPortraitOffsets(step) {
    if (!this.portraitPosition) return;

    // Move only the artwork; the mask and dialogue panel retain their geometry.
    const { x, y, width, height } = this.portraitPosition;
    this.sprite.setPosition(x + width * (step.portraitOffsetX ?? 0) / 100,
      y + height * (step.portraitOffsetY ?? 0) / 100);
  }
  tick(time, delta) {
    if (!this.clip || !this.sprite.visible || this.scene.game.loop?.sleeping) return;
    this.elapsed += delta;
    this.applyPortraitFrame();
  }
  applyPortraitFrame() {
    const afterSpeech = this.clip.next && this.elapsed >= this.clip.durationMs;
    const clip = afterSpeech ? this.clip.next : this.clip;
    const elapsed = afterSpeech ? this.elapsed - this.clip.durationMs : this.elapsed;
    const pose = clip.frames[Math.floor(elapsed / clip.frameMs) % clip.frames.length];
    if (this.sprite.texture.key !== pose.key) this.scene.textures.get(pose.key).setFilter(1);
    applyCharacterPose(this.sprite, pose);
  }
  hide() { this.frameHost.setVisible(false); this.body.setVisible(false); this.speaker.setVisible(false); this.sprite.setVisible(false); this.missing.setVisible(false); this.scrollHint.setVisible(false); this.footer.setVisible(false); this.tap.setVisible(false);
    // Phaser can remove input before our scene-shutdown callback disposes the presenter.
    if (this.tap.input) this.tap.input.enabled = false;
    this.press = null; this.clip = null; this.contentKey = null; this.animationKey = null;
    this.lastLayout = null; this.requestedPortrait = null; this.releasePortrait?.(); this.releasePortrait = null; }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.hide();
    this.scene.events.off('update', this.tick);
    this.scene.input.off('wheel', this.wheel);
    this.scene.game.events.off('blur', this.cancelPress);
    this.scene.input.off('pointerupoutside', this.cancelPress);
    this.footer.destroy(); this.tap.destroy();
    for (const o of [this.frameHost, this.body, this.speaker, this.sprite, this.missing]) o.destroy();
    this.portraitMask.destroy(); this.maskArt.destroy();
    this.bodyMask.destroy(); this.bodyMaskArt.destroy(); this.scrollHint.destroy();
  }
}
