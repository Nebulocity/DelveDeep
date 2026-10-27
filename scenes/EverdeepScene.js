import { UI_FONT_SIZES, UI_FONT_FAMILIES } from '../config/uiTypography.js';
import { dialogFrame } from '../ui/DialogFrame.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { CRAFTING_MATERIALS, EQUIPMENT_BY_ID } from '../data/items.js';
import { preloadTownAssets } from '../ui/TownAssets.js';
import { serviceCard, serviceFrame, SERVICE_STYLE } from '../ui/TownServiceTheme.js';
import { addRegionButton } from '../ui/RegionMapTheme.js';
import { refreshRegionMapGold } from '../ui/RegionMapUI.js';
import { UI_SAFE_LEFT, UI_SAFE_RIGHT } from '../ui/Layout.js';
import { showFeatureToast, clearFeatureToast } from '../ui/FeatureToast.js';
import {
  EVERDEEP_MAX_WAVES, EVERDEEP_MAX_CHESTS, EVERDEEP_DURATION_MS, EVERDEEP_INTERVAL_MS,
  EVERDEEP_REGIONS, EVERDEEP_REGION_ID, everdeepWritCost, everdeepUnavailableIds,
  claimEverdeepChest, everdeepChestPreview, everdeepRuns, everdeepTimers,
  everdeepUnlocked, finishEverdeepRun, recallEverdeep, settleEverdeep, startEverdeepRun
} from '../game/Everdeep.js';

const groupRole = role => role === 'Tank' ? 'Tank' : role === 'Healer' ? 'Healer' : 'DPS';
const status = run => !run.stoppedAtMs ? 'Descending'
  : ({ defeated: 'Defeated', recalled: 'Recalled', expired: 'Completed' }[run.stopReason] ?? 'Ended');
const clearedWaves = run => Math.max(0, run.resolvedWave - (run.failedWave ? 1 : 0));

export default class EverdeepScene extends Phaser.Scene {
  constructor() {
    super('EverdeepScene');
  }

  preload() {
    preloadTownAssets(this);
  }

  create() {
    this.selectedIds = new Set();
    this.runPage = 0;
    this.rosterPage = 0;
    this.selectedRunId = everdeepRuns()[0]?.id ?? null;
    this.lastNow = Date.now();
    this.cameras.main.setBackgroundColor('#11161b');
    const { width, height } = this.scale;
    if (this.textures.exists('everdeep-concept')) {
      this.add.image(width / 2, height / 2, 'everdeep-concept').setDisplaySize(width, height).setAlpha(0.42);
    }
    this.add.rectangle(width / 2, height / 2, width, height, 0x11101c, 0.58);
    this.content = this.add.container(0, 0);
    this.render();
  }

  update() {
    if (Date.now() - this.lastNow >= 1000) this.refreshRun();
  }

  text(x, y, value, size = UI_FONT_SIZES.body34, color = SERVICE_STYLE.text, wrap = 0) {
    const label = this.add.text(x, y, value, {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: size, color, align: 'center',
      wordWrap: wrap ? { width: wrap, useAdvancedWrap: true } : undefined
    }).setOrigin(0.5);
    this.content.add(label);
    return label;
  }

  panel(x, y, width, height, kind = 'panel') {
    const panel = serviceFrame(this, x, y, width, height, kind);
    this.content.add(panel);
    return panel;
  }

  card(x, y, width, height, selected = false) {
    const card = serviceCard(this, x, y, width, height, { selected });
    this.content.add(card);
    return card;
  }

  button(x, y, width, label, action, options = {}) {
    const button = addRegionButton(this, x, y, width, options.height ?? 86, label, action, {
      depth: 0, enabled: !options.disabled, disabledReason: options.disabledReason,
      state: options.danger ? 'danger' : options.selected ? 'selected' : 'normal',
      restrained: options.restrained ?? false
    });
    button.text.setFontSize(options.size ?? UI_FONT_SIZES.body32);
    this.content.add(button.objects);
    return button.text;
  }

  // The game uses a fixed landscape canvas; CSS owns device cutouts and FIT scaling.
  render() {
    this.content.removeAll(true);
    this.timerLabels = [];
    this.recallPending = null;
    this.lastNow = Math.max(this.lastNow, Date.now());
    const { width, height } = this.scale;
    const runs = settleEverdeep(this.lastNow);
    if (this.selectedRunId && !runs.some(run => run.id === this.selectedRunId)) {
      this.selectedRunId = runs[0]?.id ?? null;
    }
    const region = EVERDEEP_REGIONS[runs.find(run => run.id === this.selectedRunId)?.regionId ?? EVERDEEP_REGION_ID];
    this.panel(width / 2, 58, width, 116, 'bar');
    this.button(UI_SAFE_LEFT + 235, 58, 470, 'Back to World Map', () => this.scene.start('TitleScene'));
    this.text(width / 2, 40, 'The Everdeep', UI_FONT_SIZES.heading48);
    this.text(width / 2, 87, `${region.name} · Expedition Camp`, UI_FONT_SIZES.support28, '#c6bdac');
    const goldX = width - UI_SAFE_RIGHT - 190;
    this.panel(goldX, 58, 380, 88, 'capsule');
    this.content.add(this.add.image(goldX - 135, 58, 'town-hub-gold').setDisplaySize(62, 62));
    this.currencyText = this.text(goldX + 20, 58, '', UI_FONT_SIZES.mapGold, '#ffe0a0');
    refreshRegionMapGold(this);

    const availableWidth = width - UI_SAFE_LEFT - UI_SAFE_RIGHT;
    const leftW = (availableWidth - 28) * 0.29;
    const leftX = UI_SAFE_LEFT + leftW / 2;
    this.detailW = availableWidth - leftW - 28;
    this.detailX = UI_SAFE_LEFT + leftW + 28 + this.detailW / 2;
    this.panel(leftX, 574, leftW, 868);
    this.panel(this.detailX, 574, this.detailW, 868);
    this.text(leftX, 198, 'Your Expeditions', UI_FONT_SIZES.heading38);
    this.text(leftX, 246, `${runs.filter(run => !run.stoppedAtMs).length} active · ${runs.length} total`, UI_FONT_SIZES.body30, '#c6bdac');

    // Paging keeps every whole card touchable without introducing a decorative scrollbar.
    const pageCount = Math.max(1, Math.ceil(runs.length / 4));
    this.runPage = Math.max(0, Math.min(this.runPage, pageCount - 1));
    const visibleRuns = runs.slice(this.runPage * 4, this.runPage * 4 + 4);
    visibleRuns.forEach((run, index) => {
      const label = this.button(leftX, 338 + index * 138, leftW - 64, '', () => {
        this.selectedRunId = run.id;
        this.render();
      }, { height: 128, size: UI_FONT_SIZES.body30, selected: run.id === this.selectedRunId });
      this.timerLabels.push({ run, label, compact: true, number: runs.indexOf(run) + 1 });
    });
    if (visibleRuns.length < 3) {
      const top = 286 + visibleRuns.length * 138;
      const bottom = 810;
      this.card(leftX, (top + bottom) / 2, leftW - 80, bottom - top);
      this.text(leftX, top + 48, runs.length ? 'Beyond the lantern light' : 'The depths await', UI_FONT_SIZES.body34, '#ddc7ef', leftW - 132);
      this.text(leftX, (top + bottom) / 2 + 12,
        'Expeditions continue while you are away.\nCollect earned treasure here.',
        UI_FONT_SIZES.body30, '#c6bdac', leftW - 132);
    }
    if (pageCount > 1) {
      this.button(leftX - leftW * 0.29, 837, leftW * 0.32, 'Previous', () => {
        this.runPage--;
        this.render();
      }, { height: 70, size: UI_FONT_SIZES.support28, disabled: this.runPage === 0, disabledReason: 'This is the first expedition page.' });
      this.text(leftX, 837, `${this.runPage + 1} / ${pageCount}`, UI_FONT_SIZES.support28);
      this.button(leftX + leftW * 0.29, 837, leftW * 0.32, 'Next', () => {
        this.runPage++;
        this.render();
      }, { height: 70, size: UI_FONT_SIZES.support28, disabled: this.runPage + 1 >= pageCount, disabledReason: 'This is the last expedition page.' });
    }
    const departure = this.departureAvailability();
    this.text(leftX, 888, departure.reason || `${departure.available.length} adventurers available · ${everdeepWritCost().toLocaleString('en-US')} Gold / writ`,
      UI_FONT_SIZES.support28, '#c6bdac', leftW - 92);
    this.button(leftX, 960, leftW - 64, '+ New Expedition', () => {
      this.selectedRunId = null;
      this.selectedIds.clear();
      this.render();
    }, { height: 78, selected: !this.selectedRunId, disabled: Boolean(departure.reason), disabledReason: departure.reason });

    if (!everdeepUnlocked()) {
      this.text(this.detailX, 550, 'Defeat the boss of The Sunken Watch\nto open The Everdeep.', UI_FONT_SIZES.heading42, '#c6bdac', this.detailW - 120);
    } else {
      const run = runs.find(entry => entry.id === this.selectedRunId);
      if (run) this.renderRun(run); else this.renderPartySelection();
    }
    this.text(width / 2, height - 34,
      'Adventurers on active expeditions cannot enter Delves. They return when the expedition ends or you recall them.',
      UI_FONT_SIZES.support29, '#c6bdac', availableWidth);
    this.updateTimers();
  }

  // Mirror the existing departure guards for feedback only; the model still owns validation.
  departureAvailability() {
    const away = everdeepUnavailableIds(this.lastNow);
    const inDelve = new Set(GameState.activeBattle?.party?.map(member => member.id) ?? []);
    const available = GameState.roster.filter(hero => !away.has(hero.id) && !inDelve.has(hero.id));
    const capacity = ['Tank', 'Healer', 'DPS'].reduce((sum, role) => sum
      + Math.min({ Tank: 1, Healer: 2, DPS: 4 }[role], available.filter(hero => groupRole(hero.role) === role).length), 0);
    const reason = !everdeepUnlocked() ? 'Defeat the boss of The Sunken Watch first.'
      : capacity < 5 ? 'Need five available adventurers within role limits.'
        : GameState.gold < everdeepWritCost() ? `Need ${everdeepWritCost().toLocaleString('en-US')} Gold for a writ.` : '';
    return { away, inDelve, available, reason };
  }

  renderPartySelection() {
    const x = this.detailX, w = this.detailW;
    const { away, inDelve } = this.departureAvailability();
    const writCost = everdeepWritCost();
    for (const id of this.selectedIds) if (away.has(id) || inDelve.has(id)) this.selectedIds.delete(id);
    this.text(x, 200, 'Prepare a New Descent', UI_FONT_SIZES.heading42);
    this.text(x, 263, `${writCost.toLocaleString('en-US')} Gold per writ · ${EVERDEEP_DURATION_MS / 3600000} hours · Waves every ${EVERDEEP_INTERVAL_MS / 60000} minutes`, UI_FONT_SIZES.body32, '#ffe0a0', w - 120);
    this.text(x, 325, `${this.selectedIds.size} / 5 selected · Max 1 Tank, 2 Healers, 4 DPS`, UI_FONT_SIZES.body32, '#c6bdac');
    const roster = GameState.roster;
    const pages = Math.max(1, Math.ceil(roster.length / 6));
    this.rosterPage = Math.max(0, Math.min(this.rosterPage, pages - 1));
    roster.slice(this.rosterPage * 6, this.rosterPage * 6 + 6).forEach((hero, index) => {
      const cx = x + (index % 2 ? 1 : -1) * w * 0.235;
      const busy = away.has(hero.id) || inDelve.has(hero.id);
      const description = away.has(hero.id) ? 'On expedition' : inDelve.has(hero.id) ? 'In an unfinished Delve'
        : `${hero.shortName ?? hero.className} · Lv ${hero.level} · ${groupRole(hero.role)}`;
      this.button(cx, 435 + Math.floor(index / 2) * 143, w * 0.435,
        `${this.selectedIds.has(hero.id) ? '✓ ' : ''}${hero.name}\n${description}`, () => {
          if (this.selectedIds.has(hero.id)) this.selectedIds.delete(hero.id);
          else if (this.selectedIds.size < 5 && this.roleAllowed(hero)) this.selectedIds.add(hero.id);
          else this.toast('Choose up to five adventurers within the role limits.');
          this.render();
        }, { height: 128, selected: this.selectedIds.has(hero.id), disabled: busy,
          disabledReason: `${hero.name} is ${away.has(hero.id) ? 'on an expedition. Recall that party to bring them home.' : 'in an unfinished Delve. Finish or retreat from it first.'}` });
    });
    if (!roster.length) this.text(x, 550, 'Recruit adventurers at the Tavern before preparing an expedition.', UI_FONT_SIZES.body36, '#c6bdac', w - 160);
    if (pages > 1) {
      this.button(x - w * 0.25, 835, w * 0.34, 'Previous Adventurers', () => {
        this.rosterPage--;
        this.render();
      }, { size: UI_FONT_SIZES.support28, height: 74, disabled: this.rosterPage === 0, disabledReason: 'This is the first adventurer page.' });
      this.text(x, 835, `${this.rosterPage + 1} / ${pages}`, UI_FONT_SIZES.body30);
      this.button(x + w * 0.25, 835, w * 0.34, 'More Adventurers', () => {
        this.rosterPage++;
        this.render();
      }, { size: UI_FONT_SIZES.support28, height: 74, disabled: this.rosterPage + 1 >= pages, disabledReason: 'This is the last adventurer page.' });
    }
    this.button(x, 947, w - 130, `Purchase Writ & Begin · ${writCost.toLocaleString('en-US')} Gold`, () => {
      const result = startEverdeepRun([...this.selectedIds]);
      if (!result.ok) return this.toast(result.message);
      HapticsService.confirm();
      this.selectedRunId = result.run.id;
      this.selectedIds.clear();
      this.runPage = Math.floor((everdeepRuns().length - 1) / 4);
      this.render();
    }, { selected: true, disabled: this.selectedIds.size !== 5 || GameState.gold < writCost,
      disabledReason: this.selectedIds.size !== 5 ? 'Choose five adventurers before beginning an expedition.' : `You need ${writCost} Gold to purchase a writ.` });
  }

  roleAllowed(hero) {
    const role = groupRole(hero.role);
    const count = GameState.roster.filter(entry => this.selectedIds.has(entry.id) && groupRole(entry.role) === role).length;
    return count < { Tank: 1, Healer: 2, DPS: 4 }[role];
  }

  renderRun(run) {
    const x = this.detailX, w = this.detailW;
    const stopped = Boolean(run.stoppedAtMs);
    const cleared = clearedWaves(run);
    this.text(x, 198, `Descent ${everdeepRuns().indexOf(run) + 1} · ${status(run)}`, UI_FONT_SIZES.heading42,
      stopped ? '#ffe0a0' : '#ddc7ef');
    this.text(x, 264, `${cleared} / ${EVERDEEP_MAX_WAVES} waves cleared`, UI_FONT_SIZES.heading43);
    const trackW = w - 150;
    this.card(x, 311, trackW, 18);
    const progress = this.add.graphics();
    progress.fillStyle(0xb99acb, 0.9).fillRect(x - trackW / 2 + 3, 305, (trackW - 6) * Math.min(1, cleared / EVERDEEP_MAX_WAVES), 12);
    this.content.add(progress);
    for (const [offset, heading, field] of [[-0.235, 'Time until next wave', 'nextWaveMs'], [0.235, 'Time remaining', 'remainingMs']]) {
      const cx = x + w * offset;
      this.card(cx, 386, w * 0.435, 108);
      this.text(cx, 359, heading, UI_FONT_SIZES.body30, '#c6bdac');
      this.timerLabels.push({ run, label: this.text(cx, 408, '', UI_FONT_SIZES.heading43), field });
    }
    this.text(x, 470, 'Departure Party', UI_FONT_SIZES.body32, '#ffe0a0');
    const partyStep = (w - 110) / Math.max(1, run.party.length);
    run.party.forEach((member, index) => {
      const hero = GameState.roster.find(entry => entry.id === member.id);
      const cx = x + (index - (run.party.length - 1) / 2) * partyStep;
      this.card(cx, 553, partyStep - 12, 122);
      const name = this.text(cx, 502, hero?.name ?? 'Adventurer', UI_FONT_SIZES.body30, SERVICE_STYLE.text, partyStep - 36).setOrigin(0.5, 0);

      // Reserve a separate level line even when a departure name wraps.
      if (name.height > 70) name.setScale(70 / name.height);
      this.text(cx, 590, `Level ${member.level}`, UI_FONT_SIZES.support28, '#c6bdac');
    });

    // Settlement awards one chest per ten successful waves, capped by the model's chest limit.
    this.text(x, 648, 'Treasure Milestones · Every 10 Cleared Waves', UI_FONT_SIZES.body30, '#ffe0a0', w - 120);
    const step = (w - 130) / EVERDEEP_MAX_CHESTS;
    const line = this.add.graphics().lineStyle(2, SERVICE_STYLE.gold, 0.45);
    line.lineBetween(x - (EVERDEEP_MAX_CHESTS - 1) * step / 2, 711, x + (EVERDEEP_MAX_CHESTS - 1) * step / 2, 711);
    this.content.add(line);
    for (let index = 0; index < EVERDEEP_MAX_CHESTS; index++) {
      const cx = x + (index - (EVERDEEP_MAX_CHESTS - 1) / 2) * step;
      const claimed = index < run.claimedChestCount;
      const earned = index < run.earnedChestCount;
      this.panel(cx, 715, step - 14, 100, 'selected');
      if (earned && !claimed) this.card(cx, 715, step - 24, 88, true);
      this.text(cx, 692, `Wave ${(index + 1) * 10}`, UI_FONT_SIZES.support28, earned ? '#ffe0a0' : '#c6bdac');
      this.text(cx, 735, claimed ? '✓ Claimed' : earned ? 'Ready' : 'Locked', UI_FONT_SIZES.body30,
        claimed ? '#b9d7bb' : earned ? '#ffdb86' : '#c6bdac');
    }
    const ready = run.earnedChestCount - run.claimedChestCount;
    if (ready > 0) {
      const reward = everdeepChestPreview(run.claimedChestCount, GameState, run.id);
      this.text(x, 797, `${ready} chest${ready === 1 ? '' : 's'} ready · Next: ${reward.gold} Gold + ${reward.materialCount} ${CRAFTING_MATERIALS[reward.materialId]?.name ?? 'Materials'}\n${EQUIPMENT_BY_ID[reward.equipmentId]?.name ?? 'Equipment'}`,
        UI_FONT_SIZES.body30, SERVICE_STYLE.text, w - 150);
      this.button(x, 877, Math.min(660, w - 150), 'Claim Next Chest', () => {
        const result = claimEverdeepChest(GameState, run.id);
        if (!result.ok) return this.toast(result.message);
        HapticsService.confirm();
        this.render();
      }, { selected: true, height: 78 });
    } else {
      const message = run.stopReason === 'defeated' ? `Fell at wave ${run.failedWave}. Earned treasure is safe. The party is home.`
        : run.stopReason === 'recalled' ? 'Party recalled. The writ and unused time are spent.'
          : stopped ? 'The party is home. All earned treasure has been claimed.'
            : 'The party explores while you are away. Earned chests can be claimed here.';
      this.text(x, 835, message, UI_FONT_SIZES.body34, '#c6bdac', w - 170);
    }
    this.button(x, 955, Math.min(560, w - 150), stopped ? 'Dismiss Expedition' : 'Cancel Expedition', () => {
      if (stopped) {
        const result = finishEverdeepRun(GameState, run.id);
        if (result.ok) this.render(); else this.toast(result.message);
      } else this.renderRecall(run);
    }, { height: 68, restrained: true, danger: !stopped, disabled: stopped && ready > 0,
      disabledReason: 'Claim all earned chests before dismissing this expedition.' });
  }

  renderRecall(run) {
    this.recallPending = run.id;
    clearFeatureToast(this);
    const x = this.scale.width / 2, y = this.scale.height / 2;
    const w = Math.min(1280, this.scale.width - 160);

    // The modal owns input, while settlement and timer labels continue behind it.
    const veil = this.add.rectangle(x, y, this.scale.width, this.scale.height, 0x080b10, 0.88).setInteractive();
    this.content.add(veil);
    this.content.add(dialogFrame(this, x, y, w, 430));
    this.text(x, y - 112, 'Cancel and recall this expedition?', UI_FONT_SIZES.heading42);
    this.text(x, y - 16, 'Earned chests are safe. The writ and remaining time are spent.', UI_FONT_SIZES.body36, '#c6bdac', w - 160);
    this.button(x - w * 0.225, y + 120, w * 0.4, 'Keep Descending', () => this.render(), { selected: true });
    this.button(x + w * 0.225, y + 120, w * 0.4, 'Confirm Recall', () => {
      const result = recallEverdeep(Date.now(), GameState, run.id);
      this.render();
      if (!result.ok) this.toast(result.message);
    }, { danger: true });
  }

  duration(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
      .map(value => String(value).padStart(2, '0')).join(':');
  }

  updateTimers() {
    this.timerLabels.forEach(({ run, label, field, compact, number }) => {
      const timers = everdeepTimers(run, this.lastNow);
      const ready = run.earnedChestCount - run.claimedChestCount;
      const value = compact
        ? `Descent ${number} · ${status(run)}\n${clearedWaves(run)} / ${EVERDEEP_MAX_WAVES} waves · ${ready} chests ready\n${run.stoppedAtMs ? 'Party returned' : `Next wave ${this.duration(timers.nextWaveMs)}`}`
        : run.stoppedAtMs ? 'Ended' : this.duration(timers[field]);
      if (label.text !== value) label.setText(value);
    });
    refreshRegionMapGold(this);
  }

  refreshRun() {
    this.lastNow = Math.max(this.lastNow, Date.now());
    const before = everdeepRuns().map(run => `${run.id}:${run.resolvedWave}:${run.stoppedAtMs}`).join('|');
    const after = settleEverdeep(this.lastNow).map(run => `${run.id}:${run.resolvedWave}:${run.stoppedAtMs}`).join('|');
    if (before !== after && !this.recallPending) this.render();
    else this.updateTimers();
  }

  toast(message) {
    showFeatureToast(this, message, { centered: true });
  }
}
