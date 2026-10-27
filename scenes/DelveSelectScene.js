import { dialogFrame } from '../ui/DialogFrame.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { UI_FONT_SIZES, UI_FONT_FAMILIES } from '../config/uiTypography.js';
import { preloadCombatHud, combatPanel, combatText } from '../ui/CombatHudTheme.js';
import { preloadCarvedStone, stoneIcon, STONE } from '../ui/CarvedStone.js';
import { preparationFrame, preparationButton, preparationNotice } from '../ui/DelvePreparation.js';
import { preloadDelveBestiary, addDelveBestiary } from '../ui/DelveBestiary.js';
import { preloadEnvironment } from '../combat/LayeredEnvironment.js';
import { preloadSelectionPortraits, selectionCharacterPortrait } from '../ui/SelectedCharacterIdle.js';
import { bindSelectionDetails, showSelectionDetails, delveDetails } from '../ui/SelectionDetails.js';
import { adventurerPreparationDetails } from '../ui/AdventurerPreparationDetails.js';
import { addBgmToggle } from '../ui/BgmToggle.js';
import { bindButtonPress } from '../ui/ButtonPress.js';
import { chooseWorldMapCharacter } from '../ui/WorldMapCharacterSelection.js';
import { resolveWorldMapCharacter } from '../game/WorldMapCharacter.js';
import { selectedParty, partyCounts, partyDepartureProblem, partyCompositionWarning } from '../game/PartySelection.js';
import { saveProfile } from '../game/GameStorage.js';
import { getDelveCheckpoint } from '../game/DelveCheckpoints.js';
import { beginExpedition } from '../game/ExpeditionProgression.js';
import { leaderAbilities } from '../game/LeaderProgression.js';
import { getEquippedAdventurer } from '../game/Equipment.js';
import { leaderAbilityDescription } from '../game/AbilityDescriptions.js';
import { createEncounterWaves } from '../data/encounters.js';
import { available } from '../game/DelveAvailability.js';
import { pois } from '../data/worldMap.js';
import { showLoadingScreen } from '../ui/LoadingScreen.js';
import HapticsService from '../services/HapticsService.js';

export default class DelveSelectScene extends Phaser.Scene {
  constructor() { super('DelveSelectScene'); }

  init() {
    this.enteringBattle = false;
    this.readinessClose = null;
  }

  preload() {
    preloadCarvedStone(this);
    preloadCombatHud(this);
    const delve = GameState.currentDelve;
    preloadDelveBestiary(this, delve ?? {});
    if (delve?.visuals?.environment) preloadEnvironment(this, delve.visuals.environment);
    preloadSelectionPortraits(this);
  }

  create() {
    const delve = GameState.currentDelve;
    if (!delve) return this.scene.start('TitleScene');
    const { width, height } = this.scale;
    preparationFrame(this, delve, 'DELVE OVERVIEW', 'WORLD MAP', () => this.scene.start('TitleScene'));
    this.bgmToggle = addBgmToggle(this, width - 165, 64);
    const party = selectedParty();
    const previousMarker = GameState.world.mapCharacterId;
    resolveWorldMapCharacter(party);
    if (previousMarker !== GameState.world.mapCharacterId) saveProfile();

    const panelWidth = (width - 156) / 2;
    const left = 52 + panelWidth / 2;
    const right = width - left;
    const top = 178;
    const panelHeight = height - 380;
    combatPanel(this, left, top + panelHeight / 2, panelWidth, panelHeight, 0);
    combatPanel(this, right, top + panelHeight / 2, panelWidth, panelHeight, 0);
    combatText(this, left, top + 38, 'PARTY', UI_FONT_SIZES.heading38, 3);
    preparationNotice(this, left, top + 94, 'Hold for character details. Pin your map adventurer.',
      { width: panelWidth - 70, depth: 3, fontSize: UI_FONT_SIZES.support28 });
    this.drawParty(party, left, top, panelWidth, panelHeight);

    combatText(this, right, top + 38, 'DENIZENS', UI_FONT_SIZES.heading38, 3);
    const waves = createEncounterWaves(delve, 1400, () => 0);
    combatText(this, right, top + 92, `${delve.difficulty} · ${waves.length} waves expected`,
      UI_FONT_SIZES.body34, 3, { color: '#ffdb86' });
    combatText(this, right, top + 140,
      `Starting Level ${delve.recommendedLevel}${delve.bossPreparation ? ` · Boss Level ${delve.bossPreparation.level}` : ''}`,
      UI_FONT_SIZES.body30, 3, { fontFamily: UI_FONT_FAMILIES.sans, color: STONE.muted });
    const artTop = top + 170;
    const artHeight = panelHeight - 240;
    addDelveBestiary(this, delve, right, artTop + artHeight / 2, panelWidth - 36, artHeight,
      { heading: false });

    const checkpoint = getDelveCheckpoint(delve);
    if (checkpoint) combatText(this, right, top + panelHeight - 42,
      checkpoint.campUnlocked ? 'Saved camp available' : `Next: Wave ${checkpoint.nextWave + 1}`,
      UI_FONT_SIZES.support28, 4, { color: '#ffdb86' });
    const tactics = GameState.leader?.battleLoadout ?? [];
    preparationButton(this, left, height - 154, panelWidth - 100, 70,
      `Party Leader Tactics · ${tactics.length}/5 Equipped`, () => this.showTactics(),
      { size: UI_FONT_SIZES.body30 }).button.setName('delve-tactics-details');
    preparationButton(this, right, height - 154, panelWidth - 100, 70,
      'REWARDS & PREPARATION', () => showSelectionDetails(this, delveDetails(delve)),
      { size: UI_FONT_SIZES.body30 }).button.setName('delve-encounter-details');
    preparationButton(this, left, height - 66, panelWidth - 100, 100, 'CHANGE PARTY',
      () => this.changeParty(), { size: UI_FONT_SIZES.heading40 }).button.setName('delve-change-party');
    preparationButton(this, right, height - 66, panelWidth - 100, 100, 'DELVE DEEP!',
      () => this.depart(), { primary: true, size: UI_FONT_SIZES.heading40 }).button.setName('delve-depart');
    this.events.once('shutdown', () => this.readinessClose?.());
  }

  drawParty(party, center, top, width, height) {
    const markers = [];
    const rowHeight = (height - 218) / 5;
    for (let index = 0; index < 5; index++) {
      const hero = party[index];
      const y = top + 145 + rowHeight * (index + 0.5);

      // A restrained row avoids the ornate bar's top/bottom centerpieces crossing text.
      const card = this.add.rectangle(center, y, width - 88, rowHeight - 12, 0x0a1520, 0.8)
        .setStrokeStyle(1, 0x80683e, 0.65).setDepth(3).setInteractive({ useHandCursor: true })
        .setName(`delve-party-slot-${index + 1}`);
      if (!hero) {
        combatText(this, center, y, `Open slot ${index + 1} · Change Party`, UI_FONT_SIZES.body32, 4,
          { color: STONE.muted });
        bindButtonPress(this, card, [], () => this.changeParty());
        continue;
      }
      bindSelectionDetails(this, card, () => adventurerPreparationDetails(hero));
      const x = center - width / 2 + 105;
      const portrait = selectionCharacterPortrait(this, hero, x, y, rowHeight - 10, 'delveParty',
        hero.id === GameState.world.mapCharacterId).setDepth(4);
      const markerX = center + width / 2 - 100;
      this.drawPartyLine(hero, x + 70, markerX - 66, y, rowHeight - 40);
      const marker = this.add.rectangle(markerX, y, 96, rowHeight - 12, 0, 0).setDepth(5)
        .setInteractive({ useHandCursor: true }).setName(`delve-map-character-${hero.id}`);
      marker.hidePressShadow = true;
      marker.pressVisuals = [marker];
      const icon = stoneIcon(this, markerX, y, 'MAP', 42, 6, 0xbdc9d4).setAlpha(0.65);
      const selectedIcon = stoneIcon(this, markerX, y, 'MAP', 42, 6, STONE.gold);
      markers.push({ id: hero.id, icon, selectedIcon, portrait });
      bindButtonPress(this, marker, [icon, selectedIcon], () => chooseWorldMapCharacter(this, hero.id));
    }
    const refresh = () => markers.forEach(({ id, icon, selectedIcon, portrait }) => {
      const selected = id === GameState.world.mapCharacterId;
      portrait.selectionIdle?.setSelected(selected);
      icon.setVisible(!selected);
      selectedIcon.setVisible(selected);
    });
    refresh();
    this.events.on('world-map-character-changed', refresh);
    this.events.once('shutdown', () => this.events.off('world-map-character-changed', refresh));
    const counts = partyCounts(party);
    combatText(this, center, top + height - 46,
      `${party.length}/5 · Tank ${counts.Tank} · Healer ${counts.Healer} · DPS ${counts.DPS}`,
      UI_FONT_SIZES.body30, 4, { color: STONE.muted });
  }

  drawPartyLine(hero, left, right, y, height) {
    const gap = 12;
    const available = right - left;
    const name = combatText(this, left, y, hero.name, UI_FONT_SIZES.body32, 4,
      { color: '#ffdf96' }).setOrigin(0, 0.5);
    const summary = combatText(this, left, y, '', UI_FONT_SIZES.compact26, 4,
      { fontFamily: UI_FONT_FAMILIES.sans, fontStyle: 'normal', color: STONE.muted }).setOrigin(0, 0.5);
    const fullClass = hero.shortName ?? hero.className;
    const textFor = (className, role) => `· ${className} · ${role} · Lv ${hero.level}`;
    const secondaryWidth = () => Math.max(1, available - name.displayWidth - gap);
    name.setScale(Math.min(1, height / name.height));
    summary.setText(textFor(fullClass, hero.role));

    // Keep the full name first; shrink secondary type modestly before abbreviating fields.
    for (const size of [26, 25, 24]) {
      summary.setFontSize(size);
      if (summary.width <= secondaryWidth()) break;
    }
    if (summary.width > secondaryWidth()) {
      const role = hero.role === 'Melee DPS' ? 'M. DPS' : hero.role === 'Ranged DPS' ? 'R. DPS' : hero.role;
      summary.setText(textFor(fullClass, role));
      const words = fullClass.split(' ');
      for (let index = 0; index < words.length - 1 && summary.width > secondaryWidth(); index++) {
        words[index] = words[index][0] + '.';
        summary.setText(textFor(words.join(' '), role));
      }
      let classLabel = words.join(' ');
      while (summary.width > secondaryWidth() && classLabel.length > 4) {
        classLabel = classLabel.slice(0, -1);
        summary.setText(textFor(classLabel + '…', role));
      }
    }

    // Unusually narrow layouts share a final uniform fit, never wrapping into a second row.
    const fit = Math.min(1, available / (name.displayWidth + gap + summary.width));
    name.setScale(name.scaleX * fit);
    summary.setScale(Math.min(fit, height / summary.height));
    summary.setX(left + name.displayWidth + gap * fit);
  }

  changeParty() {
    this.scene.start('PartySelectScene', { origin: 'delve', returnScene: 'DelveSelectScene' });
  }

  showTactics() {
    const equipped = GameState.leader?.battleLoadout ?? [];
    showSelectionDetails(this, {
      title: `Party Leader Tactics · ${equipped.length}/5 Equipped`,
      sections: equipped.length ? equipped.map(id => {
        const ability = leaderAbilities.find(entry => entry.id === id);
        return { title: ability?.name ?? id, body: ability ? leaderAbilityDescription(ability, selectedParty().map(hero => getEquippedAdventurer(hero))) : '' };
      }) : [{ title: 'NO TACTICS EQUIPPED', body: 'Visit Tactics in Town to learn and equip leadership abilities.' }]
    });
  }

  depart(confirmedWarning = false) {
    if (this.enteringBattle) return;
    const delve = GameState.currentDelve;
    const poi = pois.find(entry => entry.id === delve?.id);
    if (!available(poi)) {
      this.showReadiness('This Delve is locked. Return to the World Map to review its requirements.', false);
      return;
    }
    const party = selectedParty();
    const problem = partyDepartureProblem(party);
    if (problem) {
      this.showReadiness(problem, false);
      return;
    }
    const warning = partyCompositionWarning(party);
    if (warning && !confirmedWarning) {
      this.showReadiness(warning, true);
      return;
    }
    this.enteringBattle = true;
    HapticsService.confirm();
    showLoadingScreen('delve', delve.name);

    // Let the loading overlay paint before combat decodes its sprite sheets.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!this.scene.isActive()) return;
      GameState.activeParty = party.map(hero => ({ ...hero }));
      const checkpoint = getDelveCheckpoint(delve);
      GameState.run.entry = checkpoint?.campUnlocked ? 'camp' : 'progress';
      GameState.currentRoom = 0;
      beginExpedition();
      this.scene.start('BattleScene');
    }));
  }

  showReadiness(message, allowContinue) {
    this.readinessClose?.();
    const { width, height } = this.scale;
    const objects = [];
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0, 0.75)
      .setDepth(20000).setInteractive();
    objects.push(shade, dialogFrame(this, width / 2, height / 2, 1400, 410, 20001));
    objects.push(combatText(this, width / 2, height / 2 - 85, message, UI_FONT_SIZES.body36, 20002,
      { align: 'center', wordWrap: { width: 1260 } }));
    const close = () => {
      objects.forEach(object => { if (object.scene) object.destroy(); });
      this.readinessClose = null;
    };
    this.readinessClose = close;
    const actions = [
      ['CANCEL', close],
      ['CHANGE PARTY', () => { close(); this.changeParty(); }],
      ...(allowContinue ? [['CONTINUE', () => { close(); this.depart(true); }]] : [])
    ];
    actions.forEach(([label, action], index) => {
      const x = width / 2 + (index - (actions.length - 1) / 2) * 420;
      const control = preparationButton(this, x, height / 2 + 110, 390, 90, label, action,
        { depth: 20003, size: UI_FONT_SIZES.body32 });
      control.button.setName(`delve-readiness-${label.toLowerCase().replaceAll(' ', '-')}`);
      objects.push(control.button, control.text);
    });
  }
}
