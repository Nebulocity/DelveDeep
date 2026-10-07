import { fontPx, UI_FONT_SIZES, UI_FONT_FAMILIES } from '../config/uiTypography.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { CRAFTING_MATERIALS, EQUIPMENT_BY_ID } from '../data/items.js';
import { addStoneButton, addStonePanel, addStoneOrnaments, preloadCarvedStone } from '../ui/CarvedStone.js';
import { bindButtonPress } from '../ui/ButtonPress.js';
import {
  EVERDEEP_WRIT_COST, claimEverdeepChest, everdeepChestPreview, everdeepRuns, everdeepTimers,
  everdeepUnlocked, finishEverdeepRun, recallEverdeep, settleEverdeep, startEverdeepRun
} from '../game/Everdeep.js';

const groupRole = role => role === 'Tank' ? 'Tank' : role === 'Healer' ? 'Healer' : 'DPS';
const theme = { accent: 0xc9ab73, crystal: 0xb077ee, motif: 'runes' };

export default class EverdeepScene extends Phaser.Scene {
  constructor() {
    super('EverdeepScene');
  }

  preload() {
    preloadCarvedStone(this);
  }

  create() {
    this.selectedIds = new Set();
    this.runPage = 0;
    this.rosterPage = 0;
    this.selectedRunId = everdeepRuns()[0]?.id ?? null;
    this.lastNow = Date.now();
    this.cameras.main.setBackgroundColor('#100e19');
    const { width, height } = this.scale;
    if (this.textures.exists('everdeep-concept')) {
      this.add.image(width / 2, height / 2, 'everdeep-concept').setDisplaySize(width, height).setAlpha(0.48);
    }
    this.add.rectangle(width / 2, height / 2, width, height, 0x090a14, 0.58);
    this.content = this.add.container(0, 0);
    this.render();
  }

  update() {
    if (Date.now() - this.lastNow >= 1000) this.refreshRun();
  }

  text(x, y, value, size = UI_FONT_SIZES.body34, color = '#f2eadd', wrap = 0) {
    const label = this.add.text(x, y, value, {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: `${size}px`, color, align: 'center',
      wordWrap: wrap ? { width: wrap, useAdvancedWrap: true } : undefined
    }).setOrigin(0.5);
    this.content.add(label);
    return label;
  }

  panel(x, y, width, height) {
    const panel = addStonePanel(this, x, y, width, height, 0).setTint(0xc9b9e8);
    this.content.add(panel);
    return panel;
  }

  button(x, y, width, label, callback, options = {}) {
    const face = addStoneButton(this, x, y, width, options.height ?? 86, 0)
      .setStrokeStyle(3, options.selected ? 0xf0c77f : 0x9777bc);
    const tint = options.selected ? 0xe5c8ff : options.color === 0x4a3827 ? 0xffd58e
      : [0x442735, 0x552d39].includes(options.color) ? 0xffaaa0 : 0xc9b9e8;
    face.pressVisuals[0].setTint(tint);
    this.content.add([...face.pressVisuals, face]);
    const text = this.text(x, y, label, options.size ?? UI_FONT_SIZES.body34, '#f5ecdf', width - 32);
    if (options.disabled) {
      face.disableInteractive().setAlpha(0.5);
      face.pressVisuals.forEach(visual => visual.setAlpha(0.5));
      text.setAlpha(0.55);
    } else {
      bindButtonPress(this, face, [text], () => { HapticsService.tap(); callback(); });
    }
    return face;
  }

  render() {
    this.content.removeAll(true);
    this.timerLabels = [];
    this.recallPending = null;
    const { width, height } = this.scale;
    const runs = settleEverdeep(this.lastNow);
    if (this.selectedRunId && !runs.some(run => run.id === this.selectedRunId)) this.selectedRunId = runs[0]?.id ?? null;
    this.panel(width / 2, 56, width, 112);
    this.text(width / 2, 49, 'THE EVERDEEP', UI_FONT_SIZES.display54, '#ead9ff');
    this.text(width / 2, 96, 'PINESHIRE REACH  /  EXPEDITION SANCTUM', UI_FONT_SIZES.compact26, '#ccb9dc');
    this.button(290, 56, 460, 'Return to World Map', () => this.scene.start('TitleScene'));
    this.text(width - 245, 55, `${GameState.gold} GOLD`, UI_FONT_SIZES.heading38, '#f2cb80');
    const leftX = width * 0.18, leftW = width * 0.30;
    this.detailX = width * 0.65;
    this.detailW = width * 0.62;
    this.panel(leftX, 574, leftW, 858);
    this.panel(this.detailX, 574, this.detailW, 858);
    this.content.add(addStoneOrnaments(this, this.detailX, 189, this.detailW - 30, theme, 0));
    this.text(leftX, 197, 'YOUR EXPEDITIONS', UI_FONT_SIZES.heading38, '#e7d3fa');
    this.text(leftX, 249, `${runs.filter(run => !run.stoppedAtMs).length} descending  /  ${runs.length} total`, UI_FONT_SIZES.body30, '#c8bacf');
    const pageCount = Math.max(1, Math.ceil(runs.length / 4));
    this.runPage = Math.min(this.runPage, pageCount - 1);
    runs.slice(this.runPage * 4, this.runPage * 4 + 4).forEach((run, index) => {
      const y = 356 + index * 142;
      const number = runs.indexOf(run) + 1;
      this.button(leftX, y, leftW - 64, '', () => { this.selectedRunId = run.id; this.render(); },
        { height: 122, selected: run.id === this.selectedRunId, color: run.id === this.selectedRunId ? 0x443052 : 0x1d1d2d });
      this.text(leftX, y - 33, `DESCENT ${number}  /  ${run.stoppedAtMs ? run.stopReason.toUpperCase() : 'ACTIVE'}`, UI_FONT_SIZES.body30, '#ecd9ff');
      this.text(leftX, y + 4, `Wave ${run.resolvedWave}/60  /  ${run.earnedChestCount - run.claimedChestCount} chests ready`, UI_FONT_SIZES.support29, '#ddc391');
      const timer = this.text(leftX, y + 40, '', UI_FONT_SIZES.support28, '#c5bdce');
      this.timerLabels.push({ run, label: timer, compact: true });
    });
    if (!runs.length) this.text(leftX, 494, 'The depths await.\nChoose five adventurers\nand begin a descent.', UI_FONT_SIZES.body36, '#bdb0c8', leftW - 90);
    if (pageCount > 1) {
      this.button(leftX - 190, 876, 160, 'Previous', () => { this.runPage--; this.render(); }, { size: UI_FONT_SIZES.support28, height: 70, disabled: this.runPage === 0 });
      this.text(leftX, 876, `${this.runPage + 1}/${pageCount}`, UI_FONT_SIZES.support28);
      this.button(leftX + 190, 876, 160, 'Next', () => { this.runPage++; this.render(); }, { size: UI_FONT_SIZES.support28, height: 70, disabled: this.runPage + 1 >= pageCount });
    }
    this.button(leftX, 955, leftW - 64, '+ New Expedition', () => { this.selectedRunId = null; this.render(); }, { disabled: !everdeepUnlocked() });
    if (!everdeepUnlocked()) {
      this.text(this.detailX, 530, 'Defeat the boss of The Sunken Watch\nto open The Everdeep.', UI_FONT_SIZES.heading42, '#d4c5e1', this.detailW - 100);
    } else {
      const run = runs.find(entry => entry.id === this.selectedRunId);
      if (run) this.renderRun(run); else this.renderPartySelection();
    }
    this.text(width / 2, height - 34, 'Party strength is frozen at departure. Adventurers remain available for all your adventures.', UI_FONT_SIZES.support29, '#d4c5dc', width - 100);
    this.updateTimers();
  }

  renderPartySelection() {
    const x = this.detailX, w = this.detailW;
    this.text(x, 201, 'PREPARE A NEW DESCENT', UI_FONT_SIZES.heading42, '#edd9ff');
    this.text(x, 267, '120 Gold per writ  /  2 hours  /  One wave every 2 minutes', UI_FONT_SIZES.body32, '#dfc692');
    this.text(x, 328, `${this.selectedIds.size}/5 selected  /  Max 1 Tank, 2 Healers, 4 DPS`, UI_FONT_SIZES.body32, '#d8c9e5');
    const roster = GameState.roster;
    const pages = Math.max(1, Math.ceil(roster.length / 6));
    this.rosterPage = Math.min(this.rosterPage, pages - 1);
    roster.slice(this.rosterPage * 6, this.rosterPage * 6 + 6).forEach((hero, index) => {
      const cx = x + (index % 2 ? 1 : -1) * w * 0.235;
      const y = 433 + Math.floor(index / 2) * 143;
      this.button(cx, y, w * 0.435, `${this.selectedIds.has(hero.id) ? '✓  ' : ''}${hero.name}\n${hero.shortName ?? hero.className}  /  Lv ${hero.level}  /  ${groupRole(hero.role)}`, () => {
        if (this.selectedIds.has(hero.id)) this.selectedIds.delete(hero.id);
        else if (this.selectedIds.size < 5 && this.roleAllowed(hero)) this.selectedIds.add(hero.id);
        else this.toast('Choose up to five adventurers within the role limits.');
        this.render();
      }, { height: 122, size: UI_FONT_SIZES.body32, selected: this.selectedIds.has(hero.id) });
    });
    if (pages > 1) {
      this.button(x - 270, 832, 290, 'Previous Adventurers', () => { this.rosterPage--; this.render(); }, { size: UI_FONT_SIZES.support28, height: 72, disabled: this.rosterPage === 0 });
      this.text(x, 832, `${this.rosterPage + 1}/${pages}`, UI_FONT_SIZES.body30);
      this.button(x + 270, 832, 290, 'More Adventurers', () => { this.rosterPage++; this.render(); }, { size: UI_FONT_SIZES.support28, height: 72, disabled: this.rosterPage + 1 >= pages });
    }
    this.button(x, 944, w - 130, `Purchase Writ & Begin  /  ${EVERDEEP_WRIT_COST} Gold`, () => {
      const result = startEverdeepRun([...this.selectedIds]);
      if (!result.ok) return this.toast(result.message);
      HapticsService.confirm();
      this.selectedRunId = result.run.id;
      this.runPage = Math.floor((everdeepRuns().length - 1) / 4);
      this.render();
    }, { color: 0x513267, disabled: this.selectedIds.size !== 5 || GameState.gold < EVERDEEP_WRIT_COST });
  }

  roleAllowed(hero) {
    const role = groupRole(hero.role);
    const count = GameState.roster.filter(entry => this.selectedIds.has(entry.id) && groupRole(entry.role) === role).length;
    return count < { Tank: 1, Healer: 2, DPS: 4 }[role];
  }

  renderRun(run) {
    const x = this.detailX, w = this.detailW;
    const stopped = Boolean(run.stoppedAtMs);
    this.text(x, 201, `DESCENT ${everdeepRuns().indexOf(run) + 1}  /  ${stopped ? run.stopReason.toUpperCase() : 'IN PROGRESS'}`, UI_FONT_SIZES.heading42, '#edd9ff');
    this.text(x - w * 0.32, 279, 'WAVES CLEARED', UI_FONT_SIZES.support28, '#baabc9');
    this.text(x - w * 0.32, 323, `${run.failedWave ? run.resolvedWave - 1 : run.resolvedWave} / 60`, UI_FONT_SIZES.heading43, '#f3e6d2');
    this.text(x, 279, 'NEXT WAVE', UI_FONT_SIZES.support28, '#baabc9');
    this.text(x + w * 0.32, 279, 'TIME LEFT', UI_FONT_SIZES.support28, '#baabc9');
    this.timerLabels.push({ run, label: this.text(x, 323, '', UI_FONT_SIZES.heading43, '#ead9ff'), field: 'nextWaveMs' });
    this.timerLabels.push({ run, label: this.text(x + w * 0.32, 323, '', UI_FONT_SIZES.heading43, '#ead9ff'), field: 'remainingMs' });
    this.text(x, 398, 'DEPARTURE PARTY', UI_FONT_SIZES.support28, '#baabc9');
    run.party.forEach((member, index) => {
      const hero = GameState.roster.find(entry => entry.id === member.id);
      const cx = x + (index - 2) * w * 0.181;
      this.panel(cx, 467, w * 0.174, 100);
      this.text(cx, 449, hero?.name ?? 'Adventurer', UI_FONT_SIZES.body30, '#eee0f7', w * 0.16);
      this.text(cx, 487, `Level ${member.level}`, UI_FONT_SIZES.support28, '#c5b5d2');
    });
    this.text(x, 552, 'TREASURE MILESTONES  /  EVERY 10 CLEARED WAVES', UI_FONT_SIZES.support29, '#d6bd89');
    for (let index = 0; index < 6; index++) {
      const cx = x + (index - 2.5) * w * 0.148;
      this.addRect(cx, 618, w * 0.135, 72, index < run.earnedChestCount ? 0x514024 : 0x212031);
      this.text(cx, 618, index < run.claimedChestCount ? 'Claimed' : index < run.earnedChestCount ? 'Ready' : `Wave ${(index + 1) * 10}`, UI_FONT_SIZES.support28, index < run.earnedChestCount ? '#f2cc7e' : '#b6a6c5');
    }
    const ready = run.earnedChestCount - run.claimedChestCount;
    if (ready) {
      const reward = everdeepChestPreview(run.claimedChestCount, GameState, run.id);
      this.text(x, 713, `${ready} CHEST${ready === 1 ? '' : 'S'} READY  /  NEXT CHEST`, UI_FONT_SIZES.body30, '#f2cd87');
      this.text(x, 767, `${reward.gold} Gold  +  ${reward.materialCount} ${CRAFTING_MATERIALS[reward.materialId]?.name ?? 'Materials'}\n${EQUIPMENT_BY_ID[reward.equipmentId]?.name ?? 'Equipment'}`, UI_FONT_SIZES.body34, '#eee4d4', w - 130);
      this.button(x, 846, 610, 'Claim Next Chest', () => {
        const result = claimEverdeepChest(GameState, run.id);
        if (result.ok) { HapticsService.confirm(); this.render(); } else this.toast(result.message);
      }, { color: 0x4a3827 });
    } else {
      const message = run.stopReason === 'defeated' ? `Fell at wave ${run.failedWave}. Earned treasure is safe.`
        : run.stopReason === 'recalled' ? 'Party recalled. Writ and unused time are spent.'
          : stopped ? 'The descent is complete. All earned treasure has been claimed.' : 'The party explores while you are away. Earned chests can be claimed here.';
      this.text(x, 758, message, UI_FONT_SIZES.body35, '#cbbdd5', w - 170);
    }
    this.button(x, 944, 800, stopped ? 'Dismiss Expedition' : 'Recall Expedition', () => {
      if (stopped) {
        const result = finishEverdeepRun(GameState, run.id);
        if (result.ok) this.render(); else this.toast(result.message);
      } else {
        this.recallPending = run.id;
        this.renderRecall(run);
      }
    }, { disabled: stopped && ready > 0, color: stopped ? 0x30213f : 0x442735 });
  }

  addRect(x, y, w, h, color) {
    const rectangle = this.add.rectangle(x, y, w, h, color).setStrokeStyle(2, 0x76617f);
    this.content.add(rectangle);
  }

  renderRecall(run) {
    const veil = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x090710, 0.9)
      .setInteractive();
    this.content.add(veil);
    this.panel(this.detailX, 650, this.detailW - 70, 420);
    this.text(this.detailX, 551, 'Recall this expedition?', UI_FONT_SIZES.heading44, '#ead9ff');
    this.text(this.detailX, 638, 'Earned chests are safe. The writ and remaining time are spent.', UI_FONT_SIZES.body36, '#e2c4c4', this.detailW - 200);
    this.button(this.detailX - 290, 768, 480, 'Keep Descending', () => this.render());
    this.button(this.detailX + 290, 768, 480, 'Confirm Recall', () => {
      recallEverdeep(this.lastNow, GameState, run.id);
      this.render();
    }, { color: 0x552d39 });
  }

  duration(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
      .map(value => String(value).padStart(2, '0')).join(':');
  }

  updateTimers() {
    this.timerLabels.forEach(({ run, label, field, compact }) => {
      const timers = everdeepTimers(run, this.lastNow);
      label.setText(compact ? run.stoppedAtMs ? 'Descent ended' : `Next wave ${this.duration(timers.nextWaveMs)}` : this.duration(timers[field]));
    });
  }

  refreshRun() {
    this.lastNow = Math.max(this.lastNow, Date.now());
    const before = everdeepRuns().map(run => `${run.id}:${run.resolvedWave}:${run.stoppedAtMs}`).join('|');
    const after = settleEverdeep(this.lastNow).map(run => `${run.id}:${run.resolvedWave}:${run.stoppedAtMs}`).join('|');
    if (before !== after && !this.recallPending) this.render();
    else this.updateTimers();
  }

  toast(message) {
    this.feedback?.destroy();
    this.feedback = this.add.text(this.scale.width / 2, 132, message, {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body30'), color: '#ffd2d2', backgroundColor: '#241728',
      padding: { x: 18, y: 8 }, align: 'center', wordWrap: { width: this.scale.width - 150 }
    }).setOrigin(0.5).setDepth(10);
  }
}
