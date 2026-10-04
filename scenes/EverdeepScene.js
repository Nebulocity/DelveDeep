import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { addReturnButton } from '../ui/ReturnButton.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';
import HapticsService from '../services/HapticsService.js';
import { CRAFTING_MATERIALS, EQUIPMENT_BY_ID } from '../data/items.js';
import {
  EVERDEEP_INTERVAL_MS, EVERDEEP_WRIT_COST, claimEverdeepChest, everdeepChestPreview,
  everdeepUnlocked, finishEverdeepRun, recallEverdeep, settleEverdeep, startEverdeepRun
} from '../game/Everdeep.js';

const MAX_PARTY_SIZE = 5;
const groupRole = (role) => role === 'Tank' ? 'Tank' : role === 'Healer' ? 'Healer' : 'DPS';

export default class EverdeepScene extends Phaser.Scene {
  constructor() {
    super('EverdeepScene');
    this.selectedIds = new Set();
  }

  create() {
    this.cameras.main.setBackgroundColor('#10100f');
    const { width, height } = this.scale;
    this.drawBackdrop(width, height);
    addReturnButton(this, 'World Map', () => this.scene.start('TitleScene'), { y: UI_SAFE_TOP + 32 });
    this.add.text(width / 2, UI_SAFE_TOP + 24, 'THE EVERDEEP', {
      fontFamily: 'Georgia', fontSize: '70px', fontStyle: 'bold', color: '#e9d5ff', stroke: '#24142f', strokeThickness: 6
    }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 91, 'PINESHIRE REACH  •  THE FIRST DESCENT', {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#c4b5fd'
    }).setOrigin(0.5);
    this.add.rectangle(width / 2, UI_SAFE_TOP + 125, width * 0.45, 3, 0xa855f7, 0.65);
    this.content = this.add.container(0, 0);
    this.refreshTimer = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshRun() });
    this.render();
  }

  drawBackdrop(width, height) {
    if (this.textures.exists('everdeep-concept')) {
      this.add.image(width * 0.5, height * 0.55, 'everdeep-concept').setDisplaySize(width, height).setAlpha(0.28).setDepth(-20);
    }
    this.add.rectangle(width / 2, height / 2, width, height, 0x08070d, 0.58).setDepth(-19);
    const glow = this.add.ellipse(width * 0.5, height * 0.68, width * 0.48, height * 0.62, 0x6d28d9, 0.12).setDepth(-18);
    this.tweens.add({ targets: glow, alpha: 0.2, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.add.rectangle(width / 2, height * 0.5, width * 0.88, height * 0.72, 0x120e19, 0.72)
      .setStrokeStyle(3, 0x6b4a83, 0.8).setDepth(-17);
  }

  render() {
    this.content.removeAll(true);
    const { width, height } = this.scale;
    settleEverdeep();
    const run = GameState.everdeep.activeRun;
    if (run) return this.renderRun(run, width, height);
    if (!everdeepUnlocked()) {
      this.addText(width / 2, height * 0.53, 'Clear The Slime Cave, Thornbriar Hollow, and Dolmark Den to unlock this expedition.', 38, '#cbd5e1', width * 0.7);
      return;
    }
    this.renderPartySelection(width, height);
  }

  addText(x, y, value, size, color = '#f8fafc', wrapWidth = 0) {
    const text = this.add.text(x, y, value, {
      fontFamily: 'Arial', fontSize: `${size}px`, color, align: 'center',
      wordWrap: wrapWidth ? { width: wrapWidth, useAdvancedWrap: true } : undefined
    }).setOrigin(0.5);
    this.content.add(text);
    return text;
  }

  addButton(x, y, label, callback, options = {}) {
    const button = this.add.rectangle(x, y, options.width ?? 480, options.height ?? 84,
      options.color ?? 0x176c62).setStrokeStyle(3, options.stroke ?? 0x5eead4).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, { fontFamily: 'Arial', fontSize: `${options.fontSize ?? 31}px`,
      fontStyle: 'bold', color: '#f0fdfa', align: 'center', wordWrap: { width: (options.width ?? 480) - 24 } }).setOrigin(0.5);
    this.content.add([button, text]);
    button.on('pointerdown', callback);
    if (options.disabled) {
      button.disableInteractive().setAlpha(0.62);
      text.setAlpha(0.72);
    }
    return button;
  }

  renderPartySelection(width, height) {
    this.addText(width / 2, height * 0.205, `A writ costs ${EVERDEEP_WRIT_COST} Gold  •  1 wave / 2 minutes  •  2-hour maximum`, 28, '#ddd6fe', width * 0.8);
    const purse = this.add.rectangle(width - 210, UI_SAFE_TOP + 35, 270, 62, 0x2c2114).setStrokeStyle(3, 0xd4a15e);
    const purseText = this.add.text(width - 210, UI_SAFE_TOP + 35, `${GameState.gold} GOLD`, { fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: '#fbbf24' }).setOrigin(0.5);
    this.content.add([purse, purseText]);
    this.addText(width / 2, height * 0.29, 'CHOOSE YOUR DESCENT PARTY', 29, '#f5d0fe');
    const colWidth = Math.min(420, width * 0.19);
    const gap = Math.min(28, width * 0.012);
    const cols = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(GameState.roster.length))));
    const rows = Math.ceil(GameState.roster.length / cols);
    const start = width / 2 - ((cols * colWidth + (cols - 1) * gap) / 2) + colWidth / 2;
    const cardHeight = Math.min(104, height * 0.10);
    const rowGap = 12;
    const totalCardsHeight = rows * cardHeight + (rows - 1) * rowGap;
    const firstY = height * 0.5 - totalCardsHeight / 2 + cardHeight / 2;
    const roster = GameState.roster;
    roster.forEach((hero, index) => {
      const column = index % cols;
      const row = Math.floor(index / cols);
      const x = start + column * (colWidth + gap);
      const y = firstY + row * (cardHeight + rowGap);
      const selected = this.selectedIds.has(hero.id);
      const card = this.add.rectangle(x, y, colWidth, cardHeight, selected ? 0x40245a : 0x201b29)
        .setStrokeStyle(selected ? 5 : 3, selected ? 0xe879f9 : 0x715b82).setInteractive({ useHandCursor: true });
      const accent = this.add.rectangle(x - colWidth / 2 + 9, y, 8, cardHeight - 18, selected ? 0xf0abfc : 0x8b5cf6);
      const text = this.add.text(x, y, `${hero.name}\n${hero.shortName ?? hero.className}\nLv ${hero.level}  •  ${groupRole(hero.role)}`, {
        fontFamily: 'Arial', fontSize: '23px', fontStyle: selected ? 'bold' : 'normal', color: '#f5f3ff', align: 'center', wordWrap: { width: colWidth - 28 }
      }).setOrigin(0.5);
      this.content.add([card, accent, text]);
      card.on('pointerdown', () => {
        HapticsService.tap();
        if (this.selectedIds.has(hero.id)) this.selectedIds.delete(hero.id);
        else if (this.selectedIds.size < MAX_PARTY_SIZE && this.roleAllowed(hero)) this.selectedIds.add(hero.id);
        this.render();
      });
    });
    const selectionY = firstY + totalCardsHeight / 2 + 48;
    this.addText(width / 2, selectionY, `${this.selectedIds.size} / 5 SELECTED  •  1 TANK  •  2 HEALERS  •  4 DPS MAX`, 25, '#d8b4fe');
    const canStart = this.selectedIds.size === MAX_PARTY_SIZE && GameState.gold >= EVERDEEP_WRIT_COST;
    this.addButton(width / 2, height * 0.88, `PURCHASE WRIT & BEGIN DESCENT  •  ${EVERDEEP_WRIT_COST} GOLD`, () => this.startRun(), {
      width: 860, height: 90, color: canStart ? 0x632d78 : 0x3d3546, stroke: canStart ? 0xe879f9 : 0x74677e, disabled: !canStart
    });
    this.addText(width / 2, height * 0.955, 'Their expedition strength is saved at departure. They remain ready for your other adventures.', 21, '#b6a9c2');
  }

  roleAllowed(hero) {
    const group = groupRole(hero.role);
    const count = [...this.selectedIds].map((id) => GameState.roster.find((entry) => entry.id === id))
      .filter((entry) => entry && groupRole(entry.role) === group).length;
    return count < ({ Tank: 1, Healer: 2, DPS: 4 })[group];
  }

  startRun() {
    HapticsService.confirm();
    const result = startEverdeepRun([...this.selectedIds]);
    if (!result.ok) return this.toast(result.message);
    this.render();
  }

  renderRun(run, width, height) {
    const stopped = Boolean(run.stoppedAtMs);
    const elapsed = Math.max(0, (run.stoppedAtMs ?? Date.now()) - run.startedAtMs);
    const nextWaveMs = stopped ? 0 : Math.max(0, run.startedAtMs + (run.resolvedWave + 1) * EVERDEEP_INTERVAL_MS - Date.now());
    const remaining = stopped ? 0 : Math.max(0, run.endsAtMs - Date.now());
    this.addText(width / 2, height * 0.20, stopped ? `DESCENT ${run.stopReason.toUpperCase()}` : 'DESCENT IN PROGRESS', 35, stopped ? '#fcd34d' : '#d8b4fe');
    this.addText(width / 2, height * 0.29, `WAVE ${run.resolvedWave} / 60     •     NEXT WAVE ${this.duration(nextWaveMs)}     •     TIME LEFT ${this.duration(remaining)}`, 29, '#f5f3ff');
    this.addText(width / 2, height * 0.36, `TREASURE  ${run.claimedChestCount} CLAIMED  /  ${run.earnedChestCount} EARNED`, 28, '#fbbf24');
    this.addPartyRoster(run, width, height);
    if (!stopped) {
      this.addButton(width / 2, height * 0.55, 'RECALL EXPEDITION', () => {
        HapticsService.tap();
        recallEverdeep();
        this.render();
      }, { color: 0x672a45, stroke: 0xfb7185 });
    } else {
      const chestY = height * 0.54;
      const chestCount = Math.max(0, run.earnedChestCount - run.claimedChestCount);
      const rowGap = Math.min(68, 260 / Math.max(chestCount, 1));
      for (let index = run.claimedChestCount; index < run.earnedChestCount; index += 1) {
        const reward = everdeepChestPreview(index);
        const material = reward && (CRAFTING_MATERIALS[reward.materialId]?.name ?? 'Materials');
        const gear = reward && (EQUIPMENT_BY_ID[reward.equipmentId]?.name ?? 'Equipment');
        const rowY = chestY + (index - run.claimedChestCount) * rowGap;
        const row = this.add.rectangle(width / 2, rowY, width * 0.75, 58, 0x28202f).setStrokeStyle(2, 0xa78bfa);
        this.content.add(row);
        this.addText(width * 0.39, rowY,
          `CHEST ${index + 1}  •  ${reward.gold} GOLD  •  ${reward.materialCount} ${material}  •  ${gear}`, 22, '#fde68a');
        this.addButton(width * 0.78, rowY, 'CLAIM', () => {
          HapticsService.confirm();
          const result = claimEverdeepChest();
          if (!result.ok) this.toast(result.message);
          this.render();
        }, { width: 170, height: 52, fontSize: 22 });
      }
      const dismissY = height * 0.89;
      const canDismiss = run.claimedChestCount === run.earnedChestCount;
      this.addButton(width / 2, dismissY, canDismiss ? 'DISMISS EXPEDITION' : 'CLAIM THE READY CHEST FIRST', () => {
        if (!canDismiss) return;
        const result = finishEverdeepRun();
        if (result.ok) this.render(); else this.toast(result.message);
      }, { width: 560, color: canDismiss ? 0x4c2670 : 0x372f3d, stroke: canDismiss ? 0xd8b4fe : 0x74677e });
    }
    if (run.stopReason === 'defeated') this.addText(width / 2, height * 0.70, `The expedition fell at wave ${run.failedWave}. Previously earned chests are safe.`, 26, '#fecaca');
    if (run.stopReason === 'recalled') this.addText(width / 2, height * 0.70, `Recalled after ${this.duration(elapsed)}. Unused time and the Writ are forfeited.`, 26, '#cbd5e1');
  }

  addPartyRoster(run, width, height) {
    const cardWidth = Math.min(310, width * 0.16);
    const gap = 16;
    const startX = width / 2 - (5 * cardWidth + 4 * gap) / 2 + cardWidth / 2;
    run.party.forEach((member, index) => {
      const hero = GameState.roster.find((entry) => entry.id === member.id);
      const x = startX + index * (cardWidth + gap);
      const y = height * 0.45;
      const card = this.add.rectangle(x, y, cardWidth, 82, 0x201b29).setStrokeStyle(2, 0x715b82);
      const label = this.add.text(x, y, `${hero?.name ?? 'Former Adventurer'}  •  Lv ${member.level}`, {
        fontFamily: 'Arial', fontSize: '22px', color: '#e9d5ff', align: 'center', wordWrap: { width: cardWidth - 16 }
      }).setOrigin(0.5);
      this.content.add([card, label]);
    });
  }

  duration(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  refreshRun() {
    const previous = GameState.everdeep.activeRun;
    const previousWave = previous?.resolvedWave;
    const wasStopped = previous?.stoppedAtMs;
    const run = settleEverdeep();
    if (run && (run.resolvedWave !== previousWave || (!wasStopped && run.stoppedAtMs))) this.render();
  }

  toast(message) {
    this.addText(this.scale.width / 2, this.scale.height * 0.15, message, 27, '#fecaca', this.scale.width * 0.7);
  }
}
