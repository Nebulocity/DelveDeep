import GameState from '../game/GameState.js';
import { abilityMeetsLevel } from '../data/abilityUnlocks.js';
import { combatHudLayout, combatText } from './CombatHudTheme.js';
import { stoneIcon } from './CarvedStone.js';
import { categoryIcon } from './IdentityIcons.js';
import { bindButtonPress } from './ButtonPress.js';
import { bindSelectionDetails, showSelectionDetails } from './SelectionDetails.js';
import { abilityCardDetails } from '../game/AbilityDescriptions.js';
import { playUiSound, runUiAction } from '../services/UiAudioService.js';
import HapticsService from '../services/HapticsService.js';
import { tutorialGuidance } from '../game/TutorialGuidance.js';

export const RADIAL_BEHAVIORS = ['clear', 'slowly-fade', 'sticky', 'memory'];
export const RADIAL_BEHAVIOR_LABELS = ['Clear', 'Slowly Fade', 'Sticky', 'Memory'];
const GROUPS = [['All', 'All', 'ALL'], ['Tank', 'Tank', 'TANKS'], ['Healers', 'Healer', 'HEALERS'],
  ['Melee', 'Melee', 'MELEE'], ['Ranged', 'Ranged', 'RANGED']];
const ACTIONS = ['MOVE', 'HOLD', 'SPREAD', 'STACK', 'INTERRUPT'];

// This controller owns presentation only. BattleScene owns friendly selection, pending
// targeting and orders. Clearing feedback never touches those three gameplay states.
export default class CombatRadials {
  constructor(scene) {
    this.scene = scene;
    this.openMenu = null;
    this.options = [];
    this.centers = {};
    this.feedbackAt = null;
    this.neutral = false;
    this.lastGroup = null;
    this.lastAction = null;
    this.selectionLabel = '';
    this.selectionKey = '';
    this.abilityOwner = null;
    this.promptUntil = 0;
    this.layout = combatHudLayout(scene);
    ['SELECT', 'ABILITIES', 'ACTION'].forEach((kind, index) => {
      const control = this.circle(this.layout.radialX[index], this.layout.radialY, 72,
        kind, kind === 'SELECT' ? 'ALL' : kind === 'ACTION' ? 'ATTACK' : 'REGEN');
      this.centers[kind] = control;
      control.hit.setName('battle-radial-' + kind);
      control.hit.on('pointerdown', (pointer, x, y, event) => {
        event.stopPropagation();
        if (scene.selectionDetailsClose || this.drag) return;
        const wasOpen = this.openMenu === kind;
        if (!wasOpen && !this.open(kind)) return;
        this.drag = { id: pointer.id, x: pointer.x, y: pointer.y, kind, wasOpen };
      });
    });
    this.release = pointer => {
      const drag = this.drag;
      if (!drag || drag.id !== pointer.id) return;
      this.drag = null;
      if (scene.selectionDetailsClose) return;
      const moved = Math.hypot(pointer.x - drag.x, pointer.y - drag.y) > 24;
      if (moved) {
        const choice = this.options.find(option => Math.hypot(pointer.x - option.hit.x, pointer.y - option.hit.y) <= 64);
        if (choice) this.choose(choice);
        else this.close();
      } else if (drag.wasOpen) this.close();
    };
    this.cancelDrag = () => { this.drag = null; };
    this.tick = () => this.update();
    scene.input.on('pointerup', this.release);
    const unregisterGesture = tutorialGuidance(scene.game).register(scene, 'battle-radial-gesture', {
      bounds: () => ({ x: Math.min(...Object.values(this.centers).map(c => c.hit.x)) - 260,
        y: this.layout.radialY - 260,
        width: Math.max(...Object.values(this.centers).map(c => c.hit.x))
          - Math.min(...Object.values(this.centers).map(c => c.hit.x)) + 520, height: 350 }),
      kinds: ['gesture'], receiver: this, handlers: { pointerup: this.release }
    });
    scene.input.on('pointerupoutside', this.cancelDrag);
    scene.input.on('gameout', this.cancelDrag);
    scene.game.events.on('blur', this.cancelDrag);
    scene.events.on('update', this.tick);
    scene.events.once('shutdown', () => {
      unregisterGesture();
      this.close(true);
      scene.input.off('pointerup', this.release);
      scene.input.off('pointerupoutside', this.cancelDrag);
      scene.input.off('gameout', this.cancelDrag);
      scene.game.events.off('blur', this.cancelDrag);
      scene.events.off('update', this.tick);
    });
  }

  get behavior() { return GameState.preferences.delveRadialBehavior ?? 'slowly-fade'; }

  circle(x, y, radius, caption, symbol) {
    const scene = this.scene;
    const face = scene.add.circle(x, y, radius, 0x0c2744, 0.96).setStrokeStyle(3, 0xc69c52).setDepth(4801);
    const rim = scene.add.circle(x, y, radius - 7, 0x102c4e, 0.4).setStrokeStyle(1, 0x6394b2, 0.65).setDepth(4802);
    const gems = scene.add.graphics({ x, y }).setDepth(4803);
    gems.lineStyle(1, 0xe2b86a).fillStyle(0x719ecb, 0.8);
    for (const side of [-1, 1]) {
      const gx = side * (radius - 3);
      const points = [{ x: gx, y: -7 }, { x: gx + 4, y: 0 }, { x: gx, y: 7 }, { x: gx - 4, y: 0 }];
      gems.fillPoints(points, true).strokePoints(points, true);
    }
    const icon = stoneIcon(scene, x, y - 21, symbol, 39, 4803, 0xffd37d);
    const text = combatText(scene, x, y + 29, caption, 27, 4803);
    const status = combatText(scene, x, y + 52, '', 21, 4803, { color: '#b9d4ea' });
    const hit = scene.add.circle(x, y, radius, 0, 0.001).setDepth(4804).setInteractive({ useHandCursor: true });
    face.hidePressShadow = true;
    hit.pressVisuals = [face, rim];
    const control = { hit, face, rim, icon, text, status, objects: [face, rim, gems, icon, text, status, hit] };
    control.caption = value => {
      text.setText(value).setScale(1);
      if (text.width > radius * 1.8) text.setScale(radius * 1.8 / text.width);
    };
    control.caption(caption);
    return control;
  }

  promptSelection() {
    this.promptUntil = this.scene.time.now + 400;
    this.scene.showBattleMessage('Select adventurers first. Interrupt is available without selection.', '#ffd57b');
  }

  open(kind) {
    const scene = this.scene;
    if (scene.battleOver) return false;
    const selected = scene.getSelectedUnits();
    if (kind === 'ABILITIES' && selected.length !== 1) return false;
    this.close();
    this.feedbackAt = null;
    this.neutral = false;
    this.openMenu = kind;
    this.abilityOwner = kind === 'ABILITIES' ? selected[0].id : null;
    if (kind === 'ACTION' && !selected.length) this.promptSelection();
    const entries = kind === 'SELECT' ? GROUPS.map(([name, value, symbol]) => ({ name, value, symbol }))
      : kind === 'ACTION' ? ACTIONS.map(value => ({ name: value.charAt(0) + value.slice(1).toLowerCase(), value, symbol: value }))
        : Array.from({ length: 4 }, (_, index) => {
          const skill = Object.entries(selected[0].abilities ?? {})
            .filter(([key, ability]) => abilityMeetsLevel(selected[0], ability)
              && (!selected[0].abilityRanks || selected[0].abilityRanks[key] > 0))[index];
          return { name: skill?.[1].shortName ?? skill?.[1].name ?? 'Empty', value: skill?.[0], ability: skill?.[1], unit: selected[0] };
        });
    const center = this.centers[kind];
    entries.forEach((entry, index) => {
      const angle = Math.PI + index * Math.PI / (entries.length - 1);
      const option = this.circle(center.hit.x + Math.cos(angle) * 184,
        center.hit.y + Math.sin(angle) * 184, 64, entry.name, entry.symbol ?? 'REGEN');
      Object.assign(option, entry);
      option.hit.setName(kind === 'SELECT' ? 'battle-role-' + entry.value
        : kind === 'ACTION' ? 'battle-command-' + entry.value : 'battle-ability-' + entry.value);
      if (entry.ability) {
        option.icon.destroy();
        option.objects = option.objects.filter(object => object !== option.icon);
        option.icon = categoryIcon(scene, entry.ability.category, option.hit.x, option.hit.y - 22, 43, 4803);
        option.objects.push(option.icon);
        bindSelectionDetails(scene, option.hit, () => this.abilityDetails(option), () => this.choose(option));
        bindButtonPress(scene, option.hit, [option.icon, option.text]);
      } else bindButtonPress(scene, option.hit, [option.icon, option.text], () => this.choose(option));
      // Held-details handlers stop scene input propagation. Finish a center-origin drag
      // on the option itself as well, so ability petals retain drag-release selection.
      option.hit.on('pointerup', pointer => { if (this.drag) this.release(pointer); });
      if (this.behavior === 'memory' && entry.value === (kind === 'SELECT' ? this.lastGroup : this.lastAction)) {
        option.rim.setStrokeStyle(3, 0xffdc86);
      }
      option.objects.filter(object => object !== option.hit).forEach(object => {
        object.setAlpha(0);
        scene.tweens.add({ targets: object, alpha: 1, duration: 150 });
      });
      this.options.push(option);
    });
    playUiSound(scene, 'click');
    HapticsService.tap();
    this.update();
    return true;
  }

  close(immediate = false) {
    this.drag = null;
    this.openMenu = null;
    this.abilityOwner = null;
    this.options.forEach(option => {
      option.hit.disableInteractive();
      option.hit.destroy();
      option.objects.filter(object => object !== option.hit && object.active).forEach(object => {
        this.scene.tweens.killTweensOf(object);
        if (immediate) object.destroy();
        else this.scene.tweens.add({ targets: object, alpha: 0, duration: 120, onComplete: () => object.destroy() });
      });
    });
    this.options = [];
  }

  choose(option) {
    if (!tutorialGuidance(this.scene.game).allowsAction(this.scene, option.hit.name)) return;
    if (!tutorialGuidance(this.scene.game).allowsAction(this.scene, option.hit.name)) return;
    if (!this.openMenu || this.scene.selectionDetailsClose) return;
    const kind = this.openMenu;
    const scene = this.scene;
    runUiAction(scene, () => {
      if (kind === 'SELECT') {
        this.lastGroup = option.value;
        scene.selectRole(option.value);
        this.selectionChanged(option.name);
        if (scene.getSelectedUnits().length) this.actionPromptUntil = scene.time.now + 400;
      } else if (kind === 'ACTION') {
        if (option.value !== 'INTERRUPT' && !scene.getSelectedUnits().length) {
          this.promptSelection();
          return;
        }
        scene.armCommand(option.value);
      } else {
        if (!option.ability || !option.unit?.alive) return;
        showSelectionDetails(scene, this.abilityDetails(option));
      }
      this.close();
    });
  }

  abilityDetails(option) {
    const details = abilityCardDetails(option.unit, option.ability);
    return { title: option.ability.name, category: option.ability.category,
      description: `${details.description}\n\n${details.facts}\n\nAutonomous ability. Direct Party Leader activation is not available.` };
  }

  selectionChanged(label) {
    const selected = this.scene.getSelectedUnits();
    this.selectionKey = selected.map(unit => unit.id).join('|');
    this.selectionLabel = selected.length ? label ?? (selected.length === 1 ? selected[0].name : `${selected.length} selected`) : '';
    this.feedbackAt = null;
    this.promptUntil = 0;
    this.neutral = false;
    if (selected.length === 1) this.abilityPromptUntil = this.scene.time.now + 400;
  }

  completed(action) {
    this.lastAction = action;
    this.feedbackAt = this.scene.time.now;
    this.neutral = this.behavior === 'clear' || this.behavior === 'memory';
    this.close();
  }

  settingChanged() {
    this.feedbackAt = null;
    this.neutral = true;
    this.close();
  }

  update() {
    const scene = this.scene;
    const now = scene.time.now;
    // Never replay cosmetic feedback during historical simulation.
    if (scene.idleSimulating || scene.game.backgroundProgress?.isReplaying) return;
    const selected = scene.getSelectedUnits();
    for (const id of scene.selectedUnitIds) {
      if (!selected.some(unit => unit.id === id)) scene.selectedUnitIds.delete(id);
    }
    const key = selected.map(unit => unit.id).join('|');
    if (key !== this.selectionKey) {
      this.selectionChanged();
      if (!selected.length && ['MOVE', 'HOLD', 'SPREAD', 'STACK', 'ATTACK'].includes(scene.commandMode)) {
        scene.commandMode = null;
        scene.setTargetingInputState(false);
        scene.clearBattleMessage();
      }
    }
    if (this.openMenu === 'ABILITIES' && (selected.length !== 1 || selected[0].id !== this.abilityOwner)) this.close();
    if (scene.battleOver || scene.selectionDetailsClose) this.close();
    let alpha = 1;
    if (this.behavior === 'slowly-fade' && this.feedbackAt !== null) {
      alpha = Math.max(0, 1 - Math.max(0, now - this.feedbackAt - 2500) / 300);
      if (!alpha) { this.neutral = true; this.feedbackAt = null; alpha = 1; }
    }
    this.centers.SELECT.caption(!this.neutral && this.selectionLabel ? this.selectionLabel : 'SELECT');
    const showLastAction = !this.neutral && this.lastAction && (this.feedbackAt !== null || this.behavior === 'sticky');
    this.centers.ACTION.caption(scene.commandMode ?? (showLastAction ? this.lastAction : 'ACTION'));
    this.centers.SELECT.text.setAlpha(alpha);
    this.centers.ACTION.text.setAlpha(scene.commandMode ? 1 : alpha);
    this.centers.ABILITIES.objects.forEach(object => object.setAlpha(selected.length === 1 ? 1 : 0.4));
    this.centers.SELECT.face.setStrokeStyle(now < this.promptUntil ? 6 : 3, 0xffd57b);
    this.centers.ACTION.face.setStrokeStyle(now < (this.actionPromptUntil ?? 0) ? 6 : 3, 0xffd57b);
    this.centers.ABILITIES.face.setStrokeStyle(now < (this.abilityPromptUntil ?? 0) ? 6 : 3, 0xffd57b);
    scene.partyHud?.forEach(({ unit, cardHighlight }) => {
      cardHighlight.setVisible(unit.alive && (scene.selectedUnitIds.has(unit.id) || now < this.promptUntil));
      cardHighlight.setAlpha(scene.selectedUnitIds.has(unit.id) ? 1 : 0.6);
    });
    for (const option of this.options) {
      if (this.openMenu === 'ACTION') {
        const remaining = option.value === 'INTERRUPT' ? scene.interruptCooldownRemainingMs : 0;
        const available = option.value === 'INTERRUPT' ? remaining <= 0 : selected.length > 0;
        option.face.setFillStyle(option.value === 'INTERRUPT' ? 0x36204d : 0x0c2744);
        option.icon.setAlpha(available ? 1 : 0.35);
        option.text.setAlpha(available ? 1 : 0.5);
        option.status.setText(remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : '');
      } else if (option.ability) {
        const { ability, unit, value } = option;
        const duration = (ability.cooldown ?? 0) * (unit.status.replacementCooldownFactors?.[value] ?? 1)
          / (now < (unit.status.attackSlowUntil ?? 0) ? 1 - unit.status.attackSlow : 1);
        const remaining = Math.max(0, duration - (now - (unit.lastAbilityAt[value] ?? -Infinity)));
        const cost = ability.replacement ? scene.classAbilitySystem.replacement.manaCost(unit, ability, now) : ability.manaCost ?? 0;
        const usable = !ability.replacement || scene.classAbilitySystem.replacement.usable(unit, ability, now);
        const available = remaining <= 0 && unit.mana >= cost && unit.canStartAction(now) && unit.canCast(now) && usable;
        option.icon.setAlpha(available ? 1 : 0.35);
        option.text.setAlpha(available ? 1 : 0.5);
        option.status.setText(remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : unit.mana < cost ? 'Low mana' : !usable ? 'Unavailable' : 'AUTO');
      } else if (this.openMenu === 'ABILITIES') {
        option.icon.setAlpha(0.25);
        option.text.setAlpha(0.45);
      }
    }
  }
}
