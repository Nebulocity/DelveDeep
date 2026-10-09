// This screen ties the battle together: units, waves, party orders, rewards and the HUD.
// Gameplay positions use the logical arena; HUD positions use our 2400 by 1080 canvas.
// Phaser's time.now and timer delays are milliseconds. Frame delta is also milliseconds,
// so movement converts it to seconds before applying a speed. The background battle uses
// the same combat methods, which is why drawing-only shortcuts must not skip gameplay
// changes.

import { fontPx, UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { abilityPower, hitAccuracy } from '../game/CharacterStats.js';
import { leaderAbilityDescription } from '../game/AbilityDescriptions.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import { bindButtonPress } from '../ui/ButtonPress.js';
import { hallScroll } from '../ui/HallUI.js';
import { preloadCarvedStone, addStonePanel, addStoneButton, addStoneOrnaments, stoneText, stoneIcon, campStoneIcon, delveStoneTheme, STONE } from '../ui/CarvedStone.js';
import { preloadSlimeSprites } from '../data/slimeSprites.js';

import { chooseWaveLandings } from '../combat/WaveLanding.js';
import { bindSelectionDetails, characterDetails, showSelectionDetails } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import ClassAbilitySystem from '../combat/ClassAbilitySystem.js';
import { preloadCharacterSprites } from '../data/characterSprites.js';
import { preloadEnemySprites } from '../data/enemySprites.js';
import { preloadVoidSprites } from '../data/voidSprites.js';
import { preloadSunkenWatchSprites } from '../data/sunkenWatchSprites.js';
import { preloadQuarrySprites } from '../data/quarrySprites.js';
import GameState from '../game/GameState.js';

import { getEquippedAdventurer, equippedItem, consumePotionCharge } from '../game/Equipment.js';
import { getPotionDefinition, getMaterialDefinition } from '../data/items.js';
import { battleAbilities } from '../game/AdventurerAbilities.js';
import enemies from '../data/enemies.js';
import { createEncounterWaves } from '../data/encounters.js';
import { leaderAbilities } from '../game/LeaderProgression.js';
import BattleUnit from '../combat/BattleUnit.js';

import BattlefieldGeometry from '../combat/BattlefieldGeometry.js';
import BattlefieldTerrain from '../combat/BattlefieldTerrain.js';
import BattlefieldTerrainEditor from '../combat/BattlefieldTerrainEditor.js';
import TacticsController from '../combat/TacticsController.js';
import CombatMovement from '../combat/CombatMovement.js';
import { createVoidProjectile, updateVoidProjectiles } from '../combat/VoidProjectile.js';
import combatSpacing from '../config/combatSpacing.js';
import CombatLog from '../combat/CombatLog.js';

import HapticsService from '../services/HapticsService.js';
import { completeExpedition, failExpedition, fleeExpedition, formatDuration } from '../game/ExpeditionProgression.js';
import { saveProfile } from '../game/GameStorage.js';
import { awardOrdinaryWave, getDelveCheckpoint, isOrdinaryDelve, FARM_REWARDS } from '../game/DelveCheckpoints.js';
import { getBattleLayout } from '../ui/Layout.js';
import { preloadEnvironment, createEnvironment, getDelveArena } from '../combat/LayeredEnvironment.js';
import { trackLoading, hideLoadingScreenAfterRender } from '../ui/LoadingScreen.js';

import { installBattlePersistence, restoreBattle } from '../combat/BattlePersistence.js';
import { cappedChance } from '../config/characterProgression.js';
import { advanceIdleBattle, resumeIdleBattle, recordIdleEvent } from '../combat/IdleBattle.js';
import { prepareDeathNotifications } from '../services/DeathNotifications.js';
import { idleRewardLines } from '../game/IdleSummary.js';

export default class BattleScene extends Phaser.Scene {

  // This helper registers BattleScene so the game can navigate to this screen.
  constructor() {

    super('BattleScene');
  }

  // Encounter visual data supplies only the assets needed by the selected delve. Other
  // delves retain the existing battlefield presentation.
  preload() {
    trackLoading(this);
    preloadCarvedStone(this);
    preloadCharacterSprites(this);
    preloadEnemySprites(this);

    // These larger void atlases are only needed by portal encounters. Ordinary delves
    // avoid allocating their texture memory until the party enters a void battlefield.
    if (GameState.currentDelve?.type === 'void') preloadVoidSprites(this);

    // The persistent map ID also covers older saves that still name Thornbriar's template.
    const delve = GameState.currentDelve;
    if (delve?.id === 'verge-delves' || (delve?.encounterId ?? delve?.id) === 'sunken-watch') {
      preloadSunkenWatchSprites(this);
    }

    // Load Quarry sheets for both its current template and its persistent saved map ID.
    if (delve?.id === 'march-west-delves' || (delve?.encounterId ?? delve?.id) === 'old-quarry') {
      preloadQuarrySprites(this);
    }
    preloadSlimeSprites(this);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const environment = GameState.currentDelve?.visuals?.environment;
    if (environment) preloadEnvironment(this, environment);
    const background = GameState.currentDelve?.visuals?.battlefieldBackground;

    if (background?.key && background?.url && !this.textures.exists(background.key)) {
      this.load.image(background.key, background.url);
    }
  }

  // This helper starts a new battle by resetting encounter state, creating the perspective
  // arena and combatants, and building the tactical controls. It also starts the combat
  // log and announces the first enemy wave.
  create() {
    this.classAbilitySystem = new ClassAbilitySystem(this);

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;

    // Reset encounter flags, selections, movement orders, threat tables, and leader
    // cooldowns for a fresh battle.
    this.battleOver = false;

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries.
    this.battleEvents = new Set();
    this.waveTransitioning = false;
    this.waveRetreating = false;
    this.farmStopRequested = false;

    // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
    // object; get/set read and write that same key.
    this.waveReturnPositions = new Map();
    this.waveReturnTargets = new Map();
    this.activeTelegraphs = [];
    this.currentWaveIndex = -1;
    this.enemySerial = 0;
    this.earnedGold = 0;
    this.enemyThreat = new Map();

    this.enemies = [];
    this.lastPotionUseAt = new Map();
    this.selectedUnitIds = new Set();
    this.manualTargets = new Map();
    this.attackTargets = new Map();
    this.healerPriorityTargets = new Map();
    this.heldUnitIds = new Set();

    this.commandMode = null;
    this.focusTargetId = null;
    this.leaderAbilityCooldowns = new Map();
    this.assaultUntil = 0;
    this.braceUntil = 0;
    this.usedLeaderAbilities = new Set();
    this.pendingPausedTactics = [];

    this.awaitingRevive = false;
    this.idleSummary = null;
    this.idleSummaryOpen = false;
    this.idleSummaryResumePaused = undefined;
    this.idlePhaseRemainingMs = undefined;
    this.idleSimulation = null;
    this.idleSimulating = false;

    // These bit operators work with 32-bit integers. >>> shifts in zero bits, while ^
    // mixes bits with XOR. They are different from ordinary multiplication or
    // exponentiation.
    this.combatRngState = (Date.now() >>> 0) || 1;
    this.battleLayout = getBattleLayout(width, height);
    this.combatPaused = false;
    this.time.paused = false;
    this.stoneTheme = delveStoneTheme(GameState.currentDelve);

    // Define the logical combat area and the screen-space perspective used to display its
    // arena and units.
    this.battlefield = new BattlefieldGeometry(this, {
      bottomLeftX: 310,
      bottomRightX: width - 310,
      topLeftX: width * 0.27,
      topRightX: width * 0.73,
      bottomY: height * 0.775,
      topY: this.battleLayout.arenaTop,
      logicalWidth: 1750,
      logicalHeight: 900,
      nearScale: 1.05,
      farScale: 0.74,
      ...(GameState.currentDelve?.visuals?.environment
        ? getDelveArena(GameState.currentDelve.visuals.environment, width, height) : {})
    });

    // Create the formation controller and copy the appropriate encounter wave definitions.
    this.terrain = new BattlefieldTerrain(this, this.battlefield, GameState.currentDelve?.terrain ?? []);

    // Uncomment this while authoring terrain to see blocked polygons over the art.
    this.terrainDebug = null;

    this.tactics = new TacticsController(this.battlefield, GameState.tactics);
    this.movement = new CombatMovement(this);
    this.waves = this.buildEncounterWaves();

    // Build the battlefield interface, register the combat log, and start the first wave.
    this.cameras.main.setBackgroundColor('#09080a');
    this.createHeader(width);
    this.createArena(width, height);
    this.createParty();

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.combatLog = new CombatLog(GameState.currentDelve?.name ?? 'The Delve', this.partyUnits);
    this.combatLog.backgroundProgress = this.game.backgroundProgress;
    this.combatLog.setSimulationClock(() => this.time.now);
    this.combatLog.onEntry = entry => recordIdleEvent(this, entry);
    this.createArenaInteraction();
    this.createTacticsMenus(width, height);
    this.createLeaderLoadoutBar(width);

    this.createHud(width, height);

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    this.bossWaveIndex = Math.max(0, this.waves.findIndex((wave) => wave.boss));
    this.createFarmControls();
    void prepareDeathNotifications();

    if (GameState.activeBattle?.scene.currentWaveIndex >= this.waves.length) GameState.activeBattle = null;
    if (GameState.activeBattle) {
      this.restoringBattle = true;

      // This queues a callback after the current synchronous code finishes and before the
      // next normal event task. It lets related changes finish before we save their
      // combined result.
      queueMicrotask(() => {
        restoreBattle(this, GameState.activeBattle);
        this.restoringBattle = false;
        installBattlePersistence(this);
        this.onForeground();
      });
      hideLoadingScreenAfterRender(this);

      return;
    }

    const checkpoint = getDelveCheckpoint(GameState.currentDelve, this.bossWaveIndex);
    const entry = GameState.run.entry;
    if (entry === 'camp' && checkpoint?.campUnlocked) this.showDelveCamp();
    else this.startWave(entry === 'boss' ? this.bossWaveIndex
      : entry === 'farm' ? this.bossWaveIndex - 1 : checkpoint?.nextWave ?? 0);
    installBattlePersistence(this);
    hideLoadingScreenAfterRender(this);
  }


  // This helper adds a developer button for authoring blocked battlefield terrain.
  createTerrainEditorButton(width) {
    if (!GameState.development.toolsVisible) return;

    this.terrainEditor = new BattlefieldTerrainEditor(this, this.battlefield, this.terrain);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. This gives the display object an input hit area. Visible
    // artwork alone does not make an object respond to a tap.
    this.terrainEditorButton = this.add.rectangle(155, 790, 220, 48, 0x292524)
      .setStrokeStyle(2, 0xfacc15).setInteractive({ useHandCursor: true }).setDepth(11000);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    this.terrainEditorButtonLabel = this.add.text(155, 790, 'EDIT TERRAIN', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('compact22'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#facc15'
    }).setOrigin(0.5).setDepth(11001);

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    this.terrainEditorButton.on('pointerdown', (pointer, localX, localY, event) => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      event?.stopPropagation?.();
      this.terrainEditor.open();
    });
  }

  // This helper chooses the encounter waves and adds the depth milestone guardian.
  buildEncounterWaves() {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const waves = createEncounterWaves(GameState.currentDelve ?? {}, this.battlefield.logicalWidth);

    if (GameState.currentDelve) GameState.currentDelve.rooms = waves.length;
    return waves;
  }

  // This helper shows the delve title, tactical guidance, and encounter status.
  createHeader(width) {
    addStonePanel(this, width / 2, 48, width, 96, 4500);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const title = stoneText(this, width * 0.40, 46, (GameState.currentDelve?.name ?? 'The Delve').toUpperCase(), UI_FONT_SIZES.heading48, 4501);
    if (title.width > width * 0.50) title.setScale(width * 0.50 / title.width);
    addStoneOrnaments(this, width * 0.40, 44, width * 0.56, this.stoneTheme, 4502);
    this.encounterStatusText = stoneText(this, width * 0.76, 42, '', UI_FONT_SIZES.battleWave, 4501);
    this.encounterTimerText = stoneText(this, width * 0.76, 75, '', UI_FONT_SIZES.battleTimer, 4501, { color: STONE.muted });
    this.battleMessageText = stoneText(this, width / 2, this.battleLayout.messageY, '', UI_FONT_SIZES.body34, 5000,
      { wordWrap: { width: 1430 }, align: 'center' });

    this.battleMessagePlaque = addStonePanel(this, width / 2, this.battleLayout.messageY, 1500, 74, 4999).setVisible(false);
  }

  // This helper draws the battlefield beneath its units and tactical controls.
  createArena(width, height) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const environment = GameState.currentDelve?.visuals?.environment;
    if (environment) {
      this.battlefieldVisualLayers = createEnvironment(this, environment);
      this.battlefield.drawArenaBorder(GameState.development.showArenaBorder !== false);
      return;
    }
    const background = GameState.currentDelve?.visuals?.battlefieldBackground;

    let staticBackground = null;
    if (background?.key && this.textures.exists(background.key)) {

      // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
      // lower-depth objects.
      staticBackground = this.add.image(width / 2, height / 2, background.key).setDepth(-1000);

      // Cover the complete game viewport without stretching the artwork.
      const scale = Math.max(width / staticBackground.width, height / staticBackground.height);
      staticBackground.setScale(scale);
    }

    // Future cave water, fog, scenery, and ambient effects can be inserted here: above the
    // static backdrop but below combat units and HUD layers.
    this.battlefieldVisualLayers = {
      staticBackground,
      scenery: this.add.container(0, 0).setDepth(90)
    };
    this.battlefield.drawArenaBorder(GameState.development.showArenaBorder !== false);
  }


  // This helper brings the chosen adventurers into combat and binds unit selection.
  createParty() {

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const party = GameState.activeParty.length > 0
      ? GameState.activeParty
      : GameState.roster.slice(0, 5);

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    this.partyUnits = party.map((adventurer) => {

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. find returns the first matching entry, or undefined when none matches.
      // Check for that missing result before using its fields.
      const hero = getEquippedAdventurer(GameState.roster.find((entry) => entry.id === adventurer.id) ?? adventurer);

      // ... copies the source's own fields into this object; fields listed later replace
      // earlier ones. This is a shallow copy, so nested objects are still shared.
      return new BattleUnit(this, {
        ...hero,
        abilities: battleAbilities(hero),
        battlefield: this.battlefield,
        arenaX: this.battlefield.logicalWidth / 2 - 200,
        arenaY: 110,
        isEnemy: false
      });
    });

    this.tactics.registerParty(this.partyUnits);
    this.partyUnits.forEach((unit, index) => {

      const spawn = this.tactics.getSpawnPosition(unit, index);
      unit.setArenaPosition(spawn.x, spawn.y);
      this.movement.validateUnitPosition(unit);
      this.waveReturnPositions.set(unit.id, { x: unit.arenaX, y: unit.arenaY });
    });

    this.partyUnits.forEach((unit) => {

      // This gives the display object an input hit area. Visible artwork alone does not
      // make an object respond to a tap.
      unit.hitZone.setInteractive({ useHandCursor: true });

      // on registers a callback for later events; it does not call that callback now.
      // Long-lived emitters need matching listener cleanup.
      unit.hitZone.on('pointerdown', (pointer, localX, localY, event) => {

        // ?. only follows this link when the value exists; a missing optional value gives
        // undefined.
        event?.stopPropagation?.();
        this.toggleUnitSelection(unit);
      });

      bindSelectionDetails(this, unit.hitZone, () => characterDetails(unit));
    });

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    this.tank = this.partyUnits.find((unit) => unit.role === 'Tank') ?? this.partyUnits[0];
    this.healer = this.partyUnits.find((unit) => unit.role === 'Healer');
  }

  // This helper builds the bottom party panels with names, classes, health, and mana for
  // mana users. It stores references to the changing labels and bars so updateHud can
  // refresh them during combat.
  createHud(width, height) {
    const hudTop = height * 0.78;
    const cardHeight = height - hudTop - 14;
    const sectionWidth = (width - 44) / 5;
    this.partyHud = [];
    addStonePanel(this, width / 2, hudTop + cardHeight / 2, width, cardHeight + 24, 4500);

    // Keep portrait slots aligned with the starting formation throughout combat.
    const lineup = [...this.partyUnits].sort((a, b) => {
      const left = this.waveReturnPositions.get(a.id);
      const right = this.waveReturnPositions.get(b.id);
      return this.battlefield.arenaToScreen(left.x, left.y).x - this.battlefield.arenaToScreen(right.x, right.y).x;
    });
    lineup.forEach((unit, index) => {
      const left = 22 + index * sectionWidth;
      const center = left + sectionWidth / 2;
      const panel = addStonePanel(this, center, hudTop + cardHeight / 2, sectionWidth - 8, cardHeight, 4501);

      // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
      // lower-depth objects.
      const statusHitZone = this.add.rectangle(center, hudTop + cardHeight / 2, sectionWidth - 14, cardHeight - 10, 0, 0.001).setDepth(4504);
      bindSelectionDetails(this, statusHitZone, () => characterDetails(unit), () => this.toggleUnitSelection(unit));
      addStonePanel(this, left + 78, hudTop + 89, 132, 150, 4502);
      const cardHighlight = this.add.rectangle(center, hudTop + cardHeight / 2, sectionWidth - 14, cardHeight - 10, 0, 0)
        .setStrokeStyle(4, STONE.gold).setDepth(4503.5).setVisible(false);

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      const frame = unit.spriteVisual?.definition?.clips.idle?.south?.frames[0];
      if (frame) {
        this.add.image(left + 78, hudTop + 83, frame.key, frame.frame).setDisplaySize(143, 143).setDepth(4503);
      } else {
        stoneText(this, left + 78, hudTop + 83, unit.name.slice(0, 1), UI_FONT_SIZES.display62, 4503);
      }
      const textX = left + 159;

      const textWidth = sectionWidth - 185;

      // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
      // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the
      // object's corner.
      const nameText = stoneText(this, textX, hudTop + 38, unit.name, UI_FONT_SIZES.heading39, 4503).setOrigin(0, 0.5);
      if (nameText.width > textWidth) nameText.setScale(textWidth / nameText.width);

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      const classText = stoneText(this, textX, hudTop + 73, unit.shortName ?? unit.className, UI_FONT_SIZES.support29, 4503,
        { color: STONE.muted }).setOrigin(0, 0.5);
      if (classText.width > textWidth) classText.setScale(textWidth / classText.width);
      const hudBarWidth = textWidth;
      const hudBarX = textX;
      const hpY = hudTop + 122;
      const hpGlow = this.add.rectangle(hudBarX - 3, hpY, hudBarWidth + 6, 38, 0, 0).setOrigin(0, 0.5).setDepth(4502);

      this.add.rectangle(hudBarX, hpY, hudBarWidth, 36, 0x080f1b).setOrigin(0, 0.5).setStrokeStyle(2, STONE.edge).setDepth(4502);
      const hpFill = this.add.rectangle(hudBarX, hpY, hudBarWidth, 32, 0xc93837).setOrigin(0, 0.5).setDepth(4503);
      const hpText = stoneText(this, hudBarX + hudBarWidth / 2, hpY, '', UI_FONT_SIZES.battleResource, 4504)
        .setStroke('#10151f', 4);
      const manaY = hudTop + 174;
      const manaBack = this.add.rectangle(hudBarX, manaY, hudBarWidth, 36, 0x080f1b).setOrigin(0, 0.5).setStrokeStyle(2, STONE.edge).setDepth(4502);
      const manaFill = this.add.rectangle(hudBarX, manaY, hudBarWidth, 32, 0x367ed6).setOrigin(0, 0.5).setDepth(4503);

      const manaText = stoneText(this, hudBarX + hudBarWidth / 2, manaY, '', UI_FONT_SIZES.battleResource, 4504)
        .setStroke('#10151f', 4);
      const threatText = stoneText(this, hudBarX, hudTop + 204, '', UI_FONT_SIZES.compact24, 4503).setVisible(false);
      const potionButton = addStoneButton(this, left + 78, hudTop + 187, 132, 72, 4505);
      const potionLabel = stoneText(this, left + 78, hudTop + 187, 'POTION', UI_FONT_SIZES.compact25, 4506, { align: 'center' });
      bindSelectionDetails(this, potionButton, () => this.potionDetails(unit), () => this.usePotion(unit));
      bindButtonPress(this, potionButton, [potionLabel]);

      this.partyHud.push({ panel, cardHighlight, statusHitZone, potionButton, potionLabel, unit, nameText,
        hpText, manaText, threatText, hpFill, hpGlow, manaBack, manaFill, hudBarWidth });
    });

    this.updateHud();
  }

  // Battlefield taps retain their exact position rather than snapping to cells.
  createArenaInteraction() {

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap. Depth is drawing order, not distance or size.
    // Higher-depth objects draw on top of lower-depth objects.
    const hit = this.add.zone(this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height).setDepth(30).setInteractive();

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    hit.on('pointerdown', pointer => {
      if (this.battleOver || this.combatPaused || this.waveTransitioning) return;
      const point = this.battlefield.screenToArena(pointer.worldX, pointer.worldY);
      if (point && !this.terrain.isBlocked(point.x, point.y)) this.handleArenaTap(point);
    });
  }

  // This helper places role selection and tactical orders beside the battlefield.
  createTacticsMenus(width, height) {
    const left = [['ALL', 'All'], ['MELEE', 'Melee'], ['RANGED', 'Ranged'], ['HEALERS', 'Healer'], ['TANKS', 'Tank']];
    const right = ['MOVE', 'HOLD', 'SPREAD', 'STACK', 'ATTACK', 'INTERRUPT'];
    this.roleButtons = [];
    this.commandButtons = [];
    const gap = 104;
    const firstY = 236;
    addStonePanel(this, 155, 460, 304, 594, 4599);

    addStonePanel(this, width - 155, 492, 304, 714, 4599);
    left.forEach(([label, role], index) => {
      const y = firstY + index * gap;
      const box = addStoneButton(this, 155, y, 280, 94);
      const icon = stoneIcon(this, 54, y, label, 40);
      const text = stoneText(this, 177, y, label, UI_FONT_SIZES.body33);

      // on registers a callback for later events; it does not call that callback now.
      // Long-lived emitters need matching listener cleanup.
      box.on('pointerdown', () => this.selectRole(role));

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      bindSelectionDetails(this, box, { title: label, description: role === 'All'
        ? 'Select every living party member, then issue an order.'
        : `Select all living ${role} adventurers, then issue an order.` });
      bindButtonPress(this, box, [text, icon]);
      this.roleButtons.push({ box, text, role });
    });

    this.pauseButton = addStoneButton(this, width - 178, 48, 324, 84, 4600);
    const pauseIcon = stoneIcon(this, width - 293, 48, 'PAUSE', 36);
    this.pauseButtonText = stoneText(this, width - 150, 48, 'PAUSE', UI_FONT_SIZES.body34);
    bindButtonPress(this, this.pauseButton, [this.pauseButtonText, pauseIcon], () => this.togglePause());
    const fleeButton = addStoneButton(this, width - 155, 796, 280, 78, 4600, 0x3f1d1d);
    const fleeText = stoneText(this, width - 135, 796, 'RETREAT', UI_FONT_SIZES.body30, 4602, { color: '#ffd5be' });
    const fleeIcon = stoneIcon(this, width - 254, 796, 'RETREAT', 36);

    bindButtonPress(this, fleeButton, [fleeText, fleeIcon], () => this.confirmRetreat());
    const descriptions = {
      MOVE: 'Choose a destination for selected allies. They move there and hold.',
      HOLD: 'Selected allies stay at their positions while acting within range.',
      SPREAD: 'Selected allies spread out around the chosen point to avoid area attacks.',
      STACK: 'Selected allies gather tightly around the chosen point.',
      ATTACK: 'Choose an enemy for selected allies to pursue and attack. Explicitly ordered healers attack until the target dies or the order changes.',
      INTERRUPT: 'Choose a casting enemy. Selected allies with a ready interrupt try to stop its cast.'
    };

    right.forEach((label, index) => {
      const y = 174 + index * gap;
      const box = addStoneButton(this, width - 155, y, 280, 94);
      const icon = stoneIcon(this, width - 256, y, label, 38);

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const text = stoneText(this, width - 131, y, label, label === 'INTERRUPT' ? 28 : 32);

      // on registers a callback for later events; it does not call that callback now.
      // Long-lived emitters need matching listener cleanup.
      box.on('pointerdown', () => this.armCommand(label));
      bindSelectionDetails(this, box, { title: label, description: descriptions[label] });
      bindButtonPress(this, box, [text, icon]);
      this.commandButtons.push({ box, text, label });
    });

    this.refreshTacticsMenus();
  }

  // Cancellation queues a return to camp without ending or resetting the current fight.
  createFarmControls() {
    this.farmCancelButton = addStoneButton(this, 155, 750, 280, 96, 4600, 0x50432e);
    this.farmCancelText = stoneText(this, 155, 750, '', UI_FONT_SIZES.support28, 4602, { align: 'center' });
    bindButtonPress(this, this.farmCancelButton, [this.farmCancelText], () => this.confirmFarmStop());
    this.refreshFarmControls();
  }

  // Ask to stop farming without skipping the current wave or losing its banked reward.
  requestFarmStop() {
    if (!isOrdinaryDelve() || GameState.run.entry !== 'farm' || this.battleOver || this.farmStopRequested) return false;
    this.farmStopRequested = true;
    this.refreshFarmControls();
    HapticsService.tap();

    return true;
  }

  // Queue the confirmed farm cancellation and restore the proper pause state.
  confirmFarmStop() {
    if (!isOrdinaryDelve() || GameState.run.entry !== 'farm' || this.battleOver || this.farmStopRequested) return;
    showConfirmation(this, {
      title: 'Cancel Farm?',
      description: 'Finish the current combat, collect its rewards, and return to camp?',
      confirmLabel: 'STOP FARMING',

      // Run the committed action after the player confirms this decision.
      onConfirm: () => this.requestFarmStop()
    });
  }

  // Confirm retreat while preserving the previous pause state on dismissal.
  confirmRetreat() {
    if (this.battleOver) return;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    showConfirmation(this, {
      title: 'Retreat?',
      description: isOrdinaryDelve()
        ? 'Leave this combat? Cleared wave rewards stay banked. Retreat costs 1 Tactics Point.'
        : 'Leave this combat? This encounter resets and its rewards are lost. Retreat costs 1 Tactics Point.',
      confirmLabel: 'RETREAT',

      // Run the committed action after the player confirms this decision.
      onConfirm: () => this.fleeBattle()
    });
  }

  // Match the visible cancel label to farm mode and the pending stop request.
  refreshFarmControls() {
    const farming = isOrdinaryDelve() && GameState.run.entry === 'farm' && !this.battleOver;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.farmCancelButton?.setVisible(farming);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.farmCancelText?.setVisible(farming).setText(this.farmStopRequested
      ? 'STOPPING\nAFTER COMBAT' : 'CANCEL FARM\nAfter this combat');
    if (this.farmCancelButton?.input) this.farmCancelButton.input.enabled = farming && !this.farmStopRequested;
    this.terrainEditorButton?.setVisible(!farming);
    this.terrainEditorButtonLabel?.setVisible(!farming);
  }

  // This helper exposes the equipped leadership abilities above the arena.
  createLeaderLoadoutBar(width) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const equipped = (GameState.leader?.battleLoadout ?? ['focusFire']).slice(0, 5);
    const layout = getBattleLayout(width, this.scale.height, equipped.length);
    this.leaderButtons = [];

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. Origin is the anchor within the object: 0 is the left/top edge,
    // 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
    // necessarily the object's corner.
    this.add.text(width / 2, layout.labelY, 'BATTLE TACTICS', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('support28'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#94a3b8'
    }).setOrigin(0.5).setDepth(4700);

    // Each button has a name row and a separate cooldown or usage row. Center the entire
    // group, including loadouts with fewer than five slots.
    equipped.forEach((id, index) => {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const ability = leaderAbilities.find((entry) => entry.id === id);
      if (!ability) return;
      const x = layout.positions[index];
      const box = addStoneButton(this, x, layout.buttonY, layout.buttonWidth, layout.buttonHeight, 4700);

      // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
      // lower-depth objects. Origin is the anchor within the object: 0 is the left/top
      // edge, 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
      // necessarily the object's corner.
      const name = this.add.text(x, layout.buttonY - 17, ability.shortName, {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#bef264'
      }).setOrigin(0.5).setDepth(4701);
      const status = this.add.text(x, layout.buttonY + 20, '', {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('compact25'), color: '#d6d3d1'
      }).setOrigin(0.5).setDepth(4701);
      bindSelectionDetails(this, box, () => ({ title: ability.name,
        description: leaderAbilityDescription(ability, this.partyUnits) }), () => this.useLeaderAbility(id));

      bindButtonPress(this, box, [name, status]);
      this.leaderButtons.push({ ability, box, status });
    });

    this.updateLeaderLoadoutBar();
  }

  // This helper shows readiness, remaining cooldown, and spent one-use tactics without
  // placing extra labels outside their button boundaries.
  updateLeaderLoadoutBar() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.leaderButtons?.forEach(({ ability, box, status }) => {

      const used = ability.oncePerEncounter && this.usedLeaderAbilities.has(ability.id);

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      const queued = this.pendingPausedTactics?.includes(ability.id);

      // Math.max chooses the largest value; pairing it with Math.min can keep a result
      // inside both a lower and an upper bound. ?? uses the fallback only for null or
      // undefined. A real zero or false stays intact.
      const remaining = Math.max(0, (ability.cooldown ?? 0) - (this.time.now - (this.leaderAbilityCooldowns.get(ability.id) ?? -Infinity)));

      // The condition before ? chooses the first value when true and the value after :
      // when false. Math.ceil rounds upward to the next integer, including when the value
      // has a fractional part.
      status.setText(queued ? 'QUEUED' : used ? 'USED' : remaining > 0 ? Math.ceil(remaining / 1000) + 's' : ability.oncePerEncounter ? 'ONCE / ENCOUNTER' : 'READY');
      box.setFillStyle(queued || used || remaining > 0 ? 0x1c1917 : 0x292524);
    });
  }

  // This helper selects a tapped adventurer or deselects it on a second tap.
  toggleUnitSelection(unit) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!unit?.alive && this.commandMode !== 'REVIVE') return;

    if (this.commandMode === 'REVIVE' && !unit.alive) {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const ability = leaderAbilities.find(entry => entry.id === 'revive');
      unit.revive(ability.healthFraction, ability.manaFraction);
      this.leaderAbilityCooldowns.set('revive', this.time.now);
      this.commandMode = null;
      this.updateHud();
      this.showBattleMessage(`REVIVE! - ${unit.name} restored`, '#fde68a');
      this.combatLog?.add('tactic', `${ability.name} used`, { wave: this.currentWaveIndex + 1, ability: ability.name });

      this.refreshTacticsMenus();
      this.updateLeaderLoadoutBar();
      return;
    }

    if (this.assignAllyTarget(unit)) return;

    if (this.selectedUnitIds.has(unit.id)) {
      this.selectedUnitIds.delete(unit.id);
      this.commandMode = null;
      this.refreshTacticsMenus();
      this.setTargetingInputState(false);

      const remaining = this.getSelectedUnits();
      if (remaining.length === 0) {
        this.clearBattleMessage();
      } else {
        this.showBattleMessage(`${remaining.length} selected - tap ground to move, an ally to assist, or an enemy to attack`, '#93c5fd', true);
      }
    } else {

      // A Set keeps each value once. has checks membership without searching a list for
      // duplicate entries.
      this.selectedUnitIds = new Set([unit.id]);
      this.commandMode = null;
      this.refreshTacticsMenus();
      this.setTargetingInputState(false);
      this.showBattleMessage(`${unit.name} - tap ground to move, an ally to assist, or an enemy to attack`, '#93c5fd', true);
    }

    HapticsService.tap();
  }

  // Ally taps command the existing selection, including mixed role groups.
  assignAllyTarget(target) {
    const selected = this.getSelectedUnits();

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!target?.alive || selected.length === 0 || (selected.length === 1 && selected[0] === target)) return false;

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const movers = selected.filter((unit) => unit !== target);
    const positions = this.movement.getFormationPositions(movers, { x: target.arenaX, y: target.arenaY });

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone. A Map pairs a key with a value. Unlike an array index, the key can be
    // an ID or an object; get/set read and write that same key.
    this.healerPriorityTargets ??= new Map();
    selected.forEach((unit) => {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const raw = unit === target ? { x: target.arenaX, y: target.arenaY } : positions[movers.indexOf(unit)];
      const point = this.terrain.nearestSafeUnitPoint(unit, raw.x, raw.y, combatSpacing.terrainFootRadius);
      unit.spacingMode = 'normal';
      unit.finishAction();
      this.attackTargets.delete(unit.id);
      this.healerPriorityTargets.delete(unit.id);

      if (unit.role === 'Healer') {
        this.heldUnitIds.delete(unit.id);
        if (target.hp < target.maxHp) {
          this.healerPriorityTargets.set(unit.id, target.id);
          this.manualTargets.delete(unit.id);
        } else this.manualTargets.set(unit.id, point);
      } else {
        this.manualTargets.set(unit.id, point);
        this.heldUnitIds.add(unit.id);
      }
    });

    this.selectedUnitIds.clear();
    this.commandMode = null;
    this.setTargetingInputState(false);
    this.refreshTacticsMenus();

    // The condition before ? chooses the first value when true and the value after : when
    // false. some stops with true as soon as one entry passes the check; an empty list
    // gives false.
    this.showBattleMessage(`Move to ${target.name}${movers.some(unit => unit.role === 'Healer') ? ' / heal if injured' : ''}`, '#86efac', true);
    HapticsService.confirm();
    return true;
  }

  // Healing priorities are encounter-only and end automatically when their target is full
  // health, defeated, or no longer in the party.
  getHealerPriorityTarget(healer) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const targetId = this.healerPriorityTargets?.get(healer.id);

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const target = this.partyUnits.find((unit) => unit.id === targetId && unit.alive);
    if (!target || target.hp >= target.maxHp || this.heldUnitIds.has(healer.id)
      || this.attackTargets.has(healer.id) || this.manualTargets.has(healer.id)) {
      this.healerPriorityTargets?.delete(healer.id);
      return null;
    }

    return target;
  }

  // This helper selects a role or the whole living party for a shared command.
  selectRole(role) {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const matching = this.partyUnits.filter((unit) => unit.alive
      && (role === 'All' || unit.role === role || unit.role === `${role} DPS`));

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const groupName = role === 'All' ? 'All adventurers' : role;

    // every requires all entries to pass the check; an empty list gives true.
    const alreadySelected = matching.length > 0
      && matching.length === this.getSelectedUnits().length
      && matching.every((unit) => this.selectedUnitIds.has(unit.id));

    if (alreadySelected) {
      matching.forEach((unit) => this.attackTargets.delete(unit.id));
      this.selectedUnitIds.clear();
      this.commandMode = null;
      this.setTargetingInputState(false);
      this.refreshTacticsMenus();
      this.showBattleMessage(`${groupName} deselected`, '#a8a29e');
      HapticsService.tap();

      return;
    }

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries. map builds one output entry for each input entry, in the same
    // order. The callback's return value becomes that output entry.
    this.selectedUnitIds = new Set(matching.map((unit) => unit.id));
    this.commandMode = null;
    this.setTargetingInputState(false);

    this.showBattleMessage(
      matching.length > 0 ? `${groupName} - tap ground to move, an ally to assist, or an enemy to attack` : role === 'All' ? 'No living adventurers' : `No living ${role}`,
      matching.length > 0 ? '#93c5fd' : '#fca5a5',
      matching.length > 0
    );

    this.refreshTacticsMenus();
    HapticsService.tap();
  }

  // This helper restricts commands to selected adventurers who are still alive.
  getSelectedUnits() {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    return this.partyUnits.filter((unit) => unit.alive && this.selectedUnitIds.has(unit.id));
  }

  // This helper checks whether a player order should prevent automatic repositioning.
  isPositionLocked(unit) {

    return this.heldUnitIds.has(unit.id);
  }

  // This helper prepares an order for targeting or applies Hold to the current selection.
  armCommand(label) {

    const selected = this.getSelectedUnits();
    const needsSelection = ['MOVE', 'HOLD', 'SPREAD', 'STACK', 'ATTACK'].includes(label);

    // A second press cancels a target-selection mode before it can affect the party. This
    // is particularly useful for an accidentally armed Attack.
    if (this.commandMode === label) {
      this.commandMode = null;
      this.setTargetingInputState(false);
      this.refreshTacticsMenus();
      this.showBattleMessage(`${label} canceled`, '#a8a29e');
      HapticsService.tap();

      return;
    }

    // Reject movement and formation commands until the player chooses units or a role.
    if (needsSelection && selected.length === 0) {
      this.showBattleMessage('SELECT AN ADVENTURER OR ROLE FIRST', '#fca5a5', true);
      HapticsService.tap();
      return;
    }

    // Hold takes effect immediately at each selected unit's current position. Other
    // commands wait for a target tap.
    if (label === 'HOLD') {

      // every requires all entries to pass the check; an empty list gives true.
      const alreadyHeld = selected.length > 0 && selected.every((unit) => this.isPositionLocked(unit));
      if (alreadyHeld) {
        selected.forEach((unit) => {
          this.manualTargets.delete(unit.id);
          this.heldUnitIds.delete(unit.id);
        });
        this.refreshTacticsMenus();
        this.showBattleMessage('HOLD ORDER CANCELED', '#a8a29e');
        HapticsService.tap();

        return;
      }

      selected.forEach((unit) => {

        this.manualTargets.set(unit.id, { x: unit.arenaX, y: unit.arenaY });
        this.attackTargets.delete(unit.id);
        this.heldUnitIds.add(unit.id);
      });
      this.commandMode = null;

      this.refreshTacticsMenus();
      this.showBattleMessage('HOLD ORDER SET', '#93c5fd');
      this.setTargetingInputState(false);
      HapticsService.tap();

      return;
    }

    // Attack is a persistent order after an enemy is chosen. Pressing it again with that
    // same group selected releases a mistaken attack target.
    if (label === 'ATTACK' && selected.some((unit) => this.attackTargets.has(unit.id))) {
      selected.forEach((unit) => this.attackTargets.delete(unit.id));
      this.commandMode = null;
      this.setTargetingInputState(false);
      this.refreshTacticsMenus();
      this.showBattleMessage('ATTACK ORDER CANCELED', '#a8a29e');
      HapticsService.tap();

      return;
    }

    this.commandMode = label;
    this.setTargetingInputState(['ATTACK', 'FOCUS', 'INTERRUPT'].includes(label));
    this.refreshTacticsMenus();

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const prompt = label === 'ATTACK' ? 'ATTACK - tap an enemy for the selected adventurers'
      : label === 'INTERRUPT' ? 'INTERRUPT - tap the enemy you want to interrupt'
        : `${label} - tap a destination`;
    this.showBattleMessage(prompt, '#fbbf24', true);
    HapticsService.tap();
  }

  // This helper routes taps to enemies when an order needs an enemy target.
  setTargetingInputState(targetingEnemies) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.partyUnits?.forEach((unit) => {

      if (targetingEnemies) unit.hitZone.disableInteractive();
      else if (unit.alive) unit.hitZone.setInteractive({ useHandCursor: true });
    });

    this.enemies?.forEach((enemy) => {

      if (!enemy.alive || enemy.landing) return;

      // Keep enemy inspection available even before allies are selected.
      enemy.hitZone.setInteractive({ useHandCursor: true });
    });
  }

  // This helper shows the selected units and the currently armed order.
  refreshTacticsMenus() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.roleButtons?.forEach(({box,role})=>{

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. ?. only follows this link when the value exists; a missing optional value
      // gives undefined. filter keeps entries whose callback returns true. It builds a new
      // list and leaves the original list in place.
      const living = this.partyUnits?.filter((unit) => unit.alive) ?? [];

      // The condition before ? chooses the first value when true and the value after :
      // when false. every requires all entries to pass the check; an empty list gives
      // true. some stops with true as soon as one entry passes the check; an empty list
      // gives false.
      const selected = role === 'All'
        ? living.length > 0 && living.every((unit) => this.selectedUnitIds.has(unit.id))
        : living.some((unit) => (unit.role === role || unit.role === `${role} DPS`) && this.selectedUnitIds.has(unit.id));
      box.setFillStyle(selected?0x243b53:0x1f2937).setStrokeStyle(3,selected?STONE.gold:STONE.edge);
    });

    this.commandButtons?.forEach(({box,label})=>{

      const active=this.commandMode===label;

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      box.setFillStyle(active?0x3b321d:0x1f2937).setStrokeStyle(3,active?STONE.gold:STONE.edge);
    });

    this.refreshPartySelection();
  }

  // Refresh card selection, including fallen allies.
  refreshPartySelection() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.partyUnits?.forEach((u) => u.body.setStrokeStyle(
      this.selectedUnitIds.has(u.id) ? 7 : 4,
      this.selectedUnitIds.has(u.id) ? 0x60a5fa : 0x1c1917,
      this.selectedUnitIds.has(u.id) || !u.spriteVisual ? 1 : 0
    ));
    this.partyHud?.forEach(({ unit, cardHighlight }) => {
      const selected = unit.alive && this.selectedUnitIds.has(unit.id);
      cardHighlight.setVisible(selected);
    });
  }

  // This helper interprets a battlefield tap using the current command. It locates targets
  // for Attack, Focus Fire, and Interrupt, or assigns movement destinations and keeps the
  // selected units under Hold.
  handleArenaTap(center) {

    this.highlightArenaPoint(center);

    // A floor tap with selected units defaults to Move. With no selection, show guidance
    // instead of moving the whole party.
    if (!this.commandMode) {
      if (this.getSelectedUnits().length > 0) {
        this.commandMode = 'MOVE';
      } else {
        this.showBattleMessage('SELECT A UNIT OR ROLE FIRST', '#d6a85f');
        HapticsService.tap();
        return;
      }
    }

    // Find a living enemy near the tapped point for commands that need an enemy target.
    if (['ATTACK', 'FOCUS', 'INTERRUPT'].includes(this.commandMode)) {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const enemy = this.getLivingEnemies().find(candidate =>
        Math.hypot(candidate.arenaX - center.x, candidate.arenaY - center.y) <= 100);

      if (!enemy) {
        this.showBattleMessage('No enemy there - tap the enemy you want', '#fca5a5', true);
        return;
      }

      this.handleEnemyTap(enemy);
      return;
    }

    const units = this.getSelectedUnits();
    if (units.length === 0) {
      this.commandMode = null;
      this.refreshTacticsMenus();
      this.showBattleMessage('SELECT AN ADVENTURER OR ROLE FIRST', '#fca5a5');

      return;
    }

    // Place selected units around the tapped point using a wide spread or a tight stack,
    // then hold those positions.
    if (this.commandMode === 'SPREAD' || this.commandMode === 'STACK') {
      const formationMode = this.commandMode;
      const mode = formationMode.toLowerCase();
      const positions = this.movement.getFormationPositions(units, center, mode);

      units.forEach((unit, index) => {

        const rawPoint = positions[index];
        const point = this.terrain.nearestSafeUnitPoint(unit, rawPoint.x, rawPoint.y, combatSpacing.terrainFootRadius);
        unit.spacingMode = mode;
        this.manualTargets.set(unit.id, point);
        this.attackTargets.delete(unit.id);
        this.heldUnitIds.add(unit.id);
      });

      this.showBattleMessage(`${formationMode} FORMATION SET`, '#93c5fd');
      this.commandMode = null;
      this.setTargetingInputState(false);
      this.refreshTacticsMenus();

      return;
    }

    const positions = this.movement.getFormationPositions(units, center);
    units.forEach((unit, index) => {

      const rawPoint = positions[index];
      const point = this.terrain.nearestSafeUnitPoint(unit, rawPoint.x, rawPoint.y, combatSpacing.terrainFootRadius);
      unit.spacingMode = 'normal';

      if (unit.classAbilities) {

        // ??= fills a missing value once. It leaves an existing value, including zero or
        // false, alone.
        this.classAbilitySystem ??= new ClassAbilitySystem(this);
        this.classAbilitySystem.move(unit, point, this.time.now);
      }

      this.manualTargets.set(unit.id, point);

      this.attackTargets.delete(unit.id);

      // Make direct movement a persistent Hold immediately so AI, dodging, cannot override
      // the player's destination. Personal space still applies.
      this.heldUnitIds.add(unit.id);
    });

    this.showBattleMessage('MOVE + HOLD ORDER', '#93c5fd');
    this.commandMode = null;
    this.setTargetingInputState(false);
    this.refreshTacticsMenus();
  }

  // This helper sends selected adventurers to attack a tapped enemy by default. Explicit
  // movement still uses the enemy's position as a destination; Focus Fire and Interrupt
  // retain their separate targeting behavior.
  handleEnemyTap(enemy) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!enemy?.alive) return;

    if (['MOVE', 'SPREAD', 'STACK'].includes(this.commandMode)) {
      this.handleArenaTap({ x: enemy.arenaX, y: enemy.arenaY });
      this.selectedUnitIds.clear();
      this.refreshTacticsMenus();

      return;
    }

    if (!this.commandMode || this.commandMode === 'ATTACK') {
      const units = this.getSelectedUnits();
      if (units.length === 0) return;

      // Attack replaces previous movement and Hold orders only for the selected units.
      // Cancel old windups so they can pursue this target.
      units.forEach((unit) => {

        this.manualTargets.delete(unit.id);
        this.heldUnitIds.delete(unit.id);
        unit.spacingMode = 'normal';
        this.attackTargets.set(unit.id, enemy.id);
        unit.finishAction();
      });

      this.showBattleMessage(`ATTACK: ${enemy.name}`, '#fb923c');
      HapticsService.tap();
    } else if (this.commandMode === 'FOCUS') {
      this.focusTargetId = enemy.id;
      this.focusDamageTargetId = enemy.id;

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. find returns the first matching entry, or undefined when none matches.
      // Check for that missing result before using its fields.
      this.focusDamageUntil = this.time.now + (leaderAbilities.find(entry => entry.id === 'focusFire')?.duration ?? 10000);
      this.showBattleMessage(`FOCUS SET: ${enemy.name}`, '#fb923c');
    } else if (this.commandMode === 'COORDINATED_ATTACK') {

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      const melee = this.partyUnits.filter(unit => unit.alive && unit.role === 'Melee DPS');
      if (melee.length) {
        melee.forEach(unit => {
          this.manualTargets.delete(unit.id);
          this.heldUnitIds.delete(unit.id);
          unit.spacingMode = 'normal';
          unit.finishAction();
          this.attackTargets.set(unit.id, enemy.id);
        });

        // reduce carries an accumulated result from one entry to the next. The callback
        // returns the accumulator for the next step; the final argument supplies its
        // starting value.
        const damage = melee.reduce((sum, unit) => sum + unit.attackPower, 0) * 3;
        this.resolveDamage(melee[0], enemy, damage, 'melee', 1, 'Coordinated Attack!', false);
        if (enemy.alive) enemy.status.rootedUntil = Math.max(enemy.status.rootedUntil ?? 0, this.time.now + 6000);
      }

      this.showBattleMessage(`COORDINATED ATTACK - ${enemy.name} rooted`, '#bef264');
    } else if (this.commandMode === 'LUNAR_ASSAULT') {
      const mages = this.partyUnits.filter(unit => unit.alive && unit.className?.startsWith('Mage of the'));
      const targets = this.getLivingEnemies().filter(target => Math.hypot(target.arenaX - enemy.arenaX, target.arenaY - enemy.arenaY) <= 400);
      if (mages.length && targets.length) {
        mages.forEach(unit => {
          this.manualTargets.delete(unit.id);
          this.heldUnitIds.delete(unit.id);
          unit.finishAction();
          this.attackTargets.set(unit.id, enemy.id);
        });
        const damage = mages.reduce((sum, unit) => sum + unit.spellDamage, 0) * 3;

        targets.forEach(target => {
          if (!this.isEnemyEngaged(target)) return;
          this.resolveDamage(mages[0], target, damage, 'spell', 1, 'Lunar Assault!', false);
          if (target.alive) target.status.rootedUntil = Math.max(target.status.rootedUntil ?? 0, this.time.now + 8000);
        });
      }

      this.showBattleMessage('LUNAR ASSAULT - enemies rooted', '#c4b5fd');
    } else if (this.commandMode === 'INTERRUPT') {
      if (enemy.pendingAction) {
        enemy.finishAction();
        this.showBattleMessage(`INTERRUPTED: ${enemy.name}`, '#fde68a');
      } else {
        this.showBattleMessage(`${enemy.name} is not casting`, '#a8a29e');
      }
    }

    this.selectedUnitIds.clear();
    this.commandMode = null;
    this.setTargetingInputState(false);
    this.refreshTacticsMenus();
  }

  // A brief ring marks the exact movement destination.
  highlightArenaPoint(point) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.destinationHighlight?.destroy();
    const screen = this.battlefield.arenaToScreen(point.x, point.y);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const marker = this.add.ellipse(screen.x, screen.y, 40, 18, 0x60a5fa, 0.16)
      .setStrokeStyle(3, 0x60a5fa, 0.95).setDepth(35);
    this.destinationHighlight = marker;

    // The delay is in milliseconds. Phaser calls the supplied function later on this
    // scene's clock, so pause and cleanup affect when it can run.
    this.time.delayedCall(650, () => marker.destroy());
  }

  // This helper advances toward player destinations while retaining held positions.
  applyManualMovement(unit, deltaSeconds) {

    const target = this.manualTargets.get(unit.id);
    if (!target || unit.isBusy(this.time.now)) {
      return false;
    }

    if (unit.classAbilities) {

      // ??= fills a missing value once. It leaves an existing value, including zero or
      // false, alone.
      this.classAbilitySystem ??= new ClassAbilitySystem(this);
      this.classAbilitySystem.move(unit, target, this.time.now);
    }

    if (unit.distanceToPoint(target.x, target.y) > combatSpacing.arrivalTolerance) {
      unit.moveToward(target.x, target.y, deltaSeconds, combatSpacing.arrival);
      return true;
    }

    if (!this.isPositionLocked(unit)) {
      this.manualTargets.delete(unit.id);
    }

    return false;
  }

  // This helper triggers the chosen leadership effect under its battle cooldown.
  useLeaderAbility(id) {

    if (this.battleOver || this.waveTransitioning) return;
    if (this.combatPaused) {
      this.queuePausedTactic(id);
      return;
    }

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const ability = leaderAbilities.find((entry) => entry.id === id);
    if (!ability || !this.isLeaderAbilityReady(id)) {
      this.showBattleMessage('Tactic unavailable or recharging', '#a8a29e');
      return;
    }

    // Work with the currently living party members for this step. Fallen adventurers
    // remain in the party records for deaths, inspection and revival, but they do not move
    // or act as living units.
    const living = this.partyUnits.filter((unit) => unit.alive);
    const fallen = this.partyUnits.filter((unit) => !unit.alive && !unit.delvesUsed?.honorSacrifice);
    if (['arise', 'revive'].includes(id) && fallen.length === 0) {
      this.showBattleMessage('No fallen adventurers to revive', '#a8a29e');
      return;
    }

    if (!['arise', 'revive'].includes(id) && living.length === 0) return;

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    if (id === 'encouragement' && !living.some((unit) => unit.hp < unit.maxHp)) {
      this.showBattleMessage('The party is already at full health', '#a8a29e');
      return;
    }

    if (id === 'manaVortex' && !living.some(unit => unit.maxMana > unit.mana)) return;
    if (id === 'shieldWall' && !living.some(unit => unit.role === 'Tank')) return;
    if (id === 'coordinatedAttack' && !living.some(unit => unit.role === 'Melee DPS')) return;

    if (id === 'lunarAssault' && !living.some(unit => unit.className?.startsWith('Mage of the'))) return;
    if (id === 'supplies' && !living.some(unit => {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const hero = GameState.roster.find(entry => entry.id === unit.id);
      return Boolean(equippedItem(hero, 'potion'));
    })) return;

    if (id === 'revive') {
      this.commandMode = 'REVIVE';
      this.showBattleMessage('REVIVE! - tap a fallen character', '#fde68a', true);
      return;
    }

    // Commit usage only after the tactic has a valid effect or target mode.
    const now = this.time.now;
    this.leaderAbilityCooldowns.set(id, now);
    if (ability.oncePerEncounter) this.usedLeaderAbilities.add(id);
    HapticsService.confirm();

    if (id === 'focusFire') {
      this.commandMode = 'FOCUS';
      this.setTargetingInputState(true);
      this.showBattleMessage('FOCUS! - tap an enemy', '#bef264', true);
    } else if (id === 'coordinatedAttack' || id === 'lunarAssault') {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      this.commandMode = id === 'coordinatedAttack' ? 'COORDINATED_ATTACK' : 'LUNAR_ASSAULT';
      this.setTargetingInputState(true);
      this.showBattleMessage(`${ability.name} - tap an enemy`, '#bef264', true);
    } else if (id === 'fightOn') {
      this.assaultUntil = now + ability.duration;
      this.assaultBonus = ability.damageBonus;
      this.showBattleMessage('FIGHT ON! - +10% damage for 6 seconds', '#bef264', false, 1.5);
    } else if (id === 'brace') {
      this.braceUntil = now + ability.duration;
      this.braceReduction = ability.damageReduction;
      this.showBattleMessage('BRACE! - 30% less damage for 8 seconds', '#bef264', false, 1.5);
    } else if (id === 'shieldWall') {
      living.filter(unit => unit.role === 'Tank').forEach(unit => {
        unit.status.leaderBlockBonus = ability.blockBonus;
        unit.status.leaderBlockUntil = now + ability.duration;
      });
      this.showBattleMessage('SHIELD WALL! - tanks gain Block', '#bef264', false, 1.5);
    } else if (id === 'encouragement') {
      living.forEach((unit) => {

        const before = unit.hp;
        unit.heal(Math.round(unit.maxHp * ability.healFraction));
        this.createFloatingText(unit.x, unit.y - 80, '+' + (unit.hp - before), '#86efac');
      });
      this.showBattleMessage('ENCOURAGE! - party healed', '#bef264', false, 1.5);
    } else if (id === 'arise') {
      fallen.forEach((unit) => {

        unit.revive(ability.healthFraction, ability.manaFraction);
        this.manualTargets.delete(unit.id);
        this.attackTargets.delete(unit.id);
        this.heldUnitIds.delete(unit.id);
        this.announceAbility(unit, 'ARISE!', '#fde68a');
      });

      this.awaitingRevive = false;
      this.commandMode = null;
      this.setTargetingInputState(false);
      this.updateHud();
      this.showBattleMessage('ARISE! - fallen allies restored', '#fde68a', false, 1.5);
    } else if (id === 'manaVortex') {
      living.forEach(unit => { unit.mana = unit.maxMana; });
      this.showBattleMessage('MANA VORTEX! - mana restored', '#c4b5fd', false, 1.5);
    } else if (id === 'regen') {
      living.forEach(unit => {
        unit.status.leaderRegenUntil = now + ability.duration;
        unit.status.leaderRegenNext = now + ability.healInterval;
        unit.status.leaderRegenAmount = ability.healAmount;
      });
      this.showBattleMessage('REGEN! - healing over time', '#86efac', false, 1.5);
    } else if (id === 'supplies') {
      living.forEach(unit => {

        // find returns the first matching entry, or undefined when none matches. Check for
        // that missing result before using its fields.
        const hero = GameState.roster.find(entry => entry.id === unit.id);
        const item = equippedItem(hero, 'potion');
        const definition = item && getPotionDefinition(item.itemId);

        if (definition) item.charges = definition.uses;
      });

      this.showBattleMessage('SUPPLIES! - potion uses restored', '#bef264', false, 1.5);
    } else if (id === 'ready') {
      living.forEach(unit => { unit.status.nextAbilityCrit = true; });
      this.showBattleMessage('READY! - next abilities critically hit', '#fde68a', false, 1.5);
    }

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.combatLog?.add('tactic', ability.name + ' used', { wave: this.currentWaveIndex + 1, ability: ability.name });
    this.refreshTacticsMenus();
    this.updateLeaderLoadoutBar();
  }

  // This helper records a legal tactic press while paused. Commands already update player
  // order state while paused; tactics need an explicit queue because their effects would
  // otherwise be committed immediately.
  queuePausedTactic(id) {

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const ability = leaderAbilities.find((entry) => entry.id === id);
    if (!ability || !this.isLeaderAbilityReady(id)) {
      this.showBattleMessage('Tactic unavailable or recharging', '#a8a29e');
      return;
    }

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const living = this.partyUnits.filter((unit) => unit.alive);
    const fallen = this.partyUnits.filter((unit) => !unit.alive);

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    if ((!['arise', 'revive'].includes(id) && living.length === 0)
      || (['arise', 'revive'].includes(id) && fallen.length === 0)
      || (id === 'encouragement' && !living.some((unit) => unit.hp < unit.maxHp))) {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      this.showBattleMessage(id === 'arise' ? 'No fallen adventurers to revive' : 'Tactic has no effect yet', '#a8a29e');
      return;
    }

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone.
    this.pendingPausedTactics ??= [];
    if (this.pendingPausedTactics.includes(id)) {
      this.showBattleMessage(`${ability.name} is already queued`, '#a8a29e');
      return;
    }
    this.pendingPausedTactics.push(id);
    this.showBattleMessage(`${ability.name} queued`, '#bef264', true);

    HapticsService.tap();
    this.updateLeaderLoadoutBar();
  }

  // This helper runs queued tactic presses synchronously before the first resumed combat
  // update, preserving the player's paused decision order.
  flushPausedTactics() {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const queued = this.pendingPausedTactics ?? [];
    this.pendingPausedTactics = [];
    queued.forEach((id) => this.useLeaderAbility(id));
  }

  // This helper validates the equipped tactic, its unlock, and encounter usage before
  // either the UI or last-chance resurrection can use it.
  isLeaderAbilityReady(id) {

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const ability = leaderAbilities.find((entry) => entry.id === id);
    const leader = GameState.leader;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. ?? uses the fallback only for null or undefined. A real zero or false
    // stays intact.
    return Boolean(ability && leader?.unlockedAbilities.includes(id)
      && leader.battleLoadout.includes(id)
      && !(ability.oncePerEncounter && this.usedLeaderAbilities.has(id))
      && this.time.now - (this.leaderAbilityCooldowns.get(id) ?? -Infinity) >= (ability.cooldown ?? 0));
  }

  // This helper announces the next enemy group before it enters the arena.
  startWave(index) {

    if (index >= this.waves.length) {
      this.finishVictory();
      return;
    }

    this.currentWaveIndex = index;
    GameState.currentRoom = index;
    this.refreshFarmControls();
    const wave = this.waves[index];
    this.waveTransitioning = true;
    this.updateEncounterStatus();
    this.showWaveAnnouncement(`WAVE ${index + 1}`, Boolean(wave.boss));

    this.updateWaveCountdown(3);
    this.scheduleBattleEvent(1000, { kind: 'countdown', index, secondsRemaining: 3 });
  }

  // Gameplay timers carry data so their remaining delay survives a restart.
  scheduleBattleEvent(delay, data, callback = null) {

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone. A Set keeps each value once. has checks membership without searching a
    // list for duplicate entries.
    this.battleEvents ??= new Set();
    const event = { data, timer: null };

    // The delay is in milliseconds. Phaser calls the supplied function later on this
    // scene's clock, so pause and cleanup affect when it can run.
    event.timer = this.time.delayedCall(delay, () => {
      this.battleEvents.delete(event);
      if (callback) callback();
      else this.resolveBattleEvent(data);
    });
    this.battleEvents.add(event);

    return event.timer;
  }

  // Build the stable unit IDs and action identity needed to resolve a scheduled action
  // later. unit is the live combatant, with current resources and arena position.
  actionEvent(kind, unit, target, details = {}) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. The condition before ? chooses the first value when true and the value
    // after : when false. ... copies the source's own fields into this object; fields
    // listed later replace earlier ones. This is a shallow copy, so nested objects are
    // still shared.
    return { kind, unitId: unit.id, targetId: target?.id, point: target?.id ? null : target,
      actionId: unit.pendingAction.id, actionStartAt: unit.pendingAction.startAt,
      actionName: unit.pendingAction.name, ...details };
  }

  // Dispatch a typed saved event to the appropriate gameplay handler.
  resolveBattleEvent(data) {
    if (data.kind === 'countdown') {
      if (this.battleOver) return;
      const secondsRemaining = data.secondsRemaining - 1;
      if (secondsRemaining > 0) {
        this.updateWaveCountdown(secondsRemaining);

        // ... copies the source's own fields into this object; fields listed later replace
        // earlier ones. This is a shallow copy, so nested objects are still shared.
        this.scheduleBattleEvent(1000, { ...data, secondsRemaining });
      } else {
        this.clearWaveAnnouncement();
        this.spawnWave(data.index);
      }

      return;
    }

    if (data.kind === 'pendingLandings') return this.retryPendingLandings();
    const units = [...this.partyUnits, ...this.enemies];

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const unit = units.find(entry => entry.id === data.unitId);
    if (!unit) return;
    if (data.kind === 'landing') return this.finishEnemyLanding(unit);
    const action = unit.pendingAction;

    if (!action || action.id !== data.actionId || action.startAt !== data.actionStartAt || action.name !== data.actionName) return;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const target = data.targetId ? units.find(entry => entry.id === data.targetId) : data.point;
    if (data.targetId && !target) {
      unit.finishAction();
      return;
    }
    if (data.kind === 'attack') this.resolveBasicAttack(unit, action, target, data.attackType);
    else if (data.kind === 'heal') this.resolveBasicHeal(unit, action, target);
    else if (data.kind === 'enemyAbility') this.resolveEnemyAbility(unit, action, target, unit.abilities[data.key]);
    else if (data.kind === 'classAbility') this.classAbilitySystem.resolveCast(unit, action, target, data.ability);
    else if (data.kind === 'groundSlam') {
      const telegraph = this.activeTelegraphs.find(entry => entry.attacker === unit);
      this.resolveGroundSlam(unit, action, data.center, data.ability, telegraph);
    }
  }

  // Keep the wave number and countdown readable over bright or detailed arenas.
  showWaveAnnouncement(title, isBoss = false) {

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const panelWidth = Math.min(1160, width - 660);
    const backdrop = addStonePanel(this, 0, 0, panelWidth, 248);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner. The condition before ? chooses the first value when true and the value after
    // : when false.
    const labelText = this.add.text(0, -76, isBoss ? 'BOSS WAVE' : '', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body31'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#d8b761'
    }).setOrigin(0.5);
    const titleText = this.add.text(0, isBoss ? -12 : -29, title, {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('display70'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1cc',
      stroke: '#211606', strokeThickness: 2, align: 'center'
    }).setOrigin(0.5);

    titleText.setScale(Math.min(1, (panelWidth - 96) / titleText.width));
    const divider = this.add.rectangle(0, 48, panelWidth - 140, 2, 0x9c7c39, 0.65);
    this.waveCountdownText = this.add.text(0, 85, '', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#e6d9b8'
    }).setOrigin(0.5);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    this.waveAnnouncement = this.add.container(centerX, centerY,
      [backdrop, labelText, titleText, divider, this.waveCountdownText]).setDepth(9000);
  }

  // Refresh the displayed countdown as each scheduled second elapses.
  updateWaveCountdown(secondsRemaining) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. The condition before ? chooses the first value when true and the value
    // after : when false.
    this.waveCountdownText?.setText(`IN ${secondsRemaining} ${secondsRemaining === 1 ? 'SECOND' : 'SECONDS'}`);
  }

  // Remove the wave heading and countdown display after its announcement finishes.
  clearWaveAnnouncement() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.waveAnnouncement?.destroy();
    this.waveAnnouncement = null;
    this.waveCountdownText = null;
  }

  // This helper creates the announced enemies once the countdown ends.
  spawnWave(index) {

    // Finished enemy records cannot affect the next wave and must not accumulate in saves.
    this.enemyThreat.clear();
    for (const unit of this.enemies) {
      this.movement.slots.delete(unit);
      this.movement.rangeStates.delete(unit);
    }
    const wave = this.waves[index];

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.combatLog?.add('wave', `Wave ${index + 1} started`, { wave: index + 1 });

    const landings = chooseWaveLandings(wave, this.battlefield, this.terrain, this.partyUnits, () => this.combatRandom());
    this.pendingWaveSpawns = [];

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place. map builds one output entry for each input entry, in the
    // same order. The callback's return value becomes that output entry.
    this.enemies = wave.enemies.map((spawn, spawnIndex) => {
      const landing = landings[spawnIndex];
      if (!landing) {
        this.pendingWaveSpawns.push({ spawn, spawnIndex });
        return null;
      }

      return this.createEnemy(spawn.type, landing, spawnIndex);
    }).filter(Boolean);

    this.enemies.forEach(enemy => this.animateEnemyLanding(enemy));
    if (this.pendingWaveSpawns.length > 0) this.schedulePendingLandings();
    this.attackTargets.clear();
    this.setTargetingInputState(['ATTACK', 'FOCUS', 'INTERRUPT'].includes(this.commandMode));
    this.waveTransitioning = false;
  }

  // This helper builds an enemy from its definition and registers its combat targeting.
  createEnemy(type, spawn, spawnIndex) {

    const definition = enemies[type];
    const serial = this.enemySerial++;

    // ... copies the source's own fields into this object; fields listed later replace
    // earlier ones. This is a shallow copy, so nested objects are still shared.
    const enemy = new BattleUnit(this, {
      ...definition,
      id: `${definition.id}-${this.currentWaveIndex}-${spawnIndex}-${serial}`,
      spriteId: type,
      battlefield: this.battlefield,
      arenaX: spawn.x,
      arenaY: spawn.y,
      isEnemy: true
    });

    enemy.enemyType = type;
    enemy.definition = definition;
    enemy.rewarded = false;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    this.combatMembershipRevision = (this.combatMembershipRevision ?? 0) + 1;
    if (!this.idleSimulating) this.bindEnemyInput(enemy);
    this.movement.validateUnitPosition(enemy);

    // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
    // object; get/set read and write that same key.
    this.enemyThreat.set(enemy.id, new Map(this.partyUnits.map((unit) => [unit.id, 0])));
    return enemy;
  }

  // Connect enemy taps and held inspection to the current battle commands.
  bindEnemyInput(enemy) {
    enemy.hitZone.disableInteractive();

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    enemy.hitZone.on('pointerdown', (pointer, localX, localY, event) => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      event?.stopPropagation?.();
      this.handleEnemyTap(enemy);
    });
    bindSelectionDetails(this, enemy.hitZone, () => characterDetails(enemy));
  }

  // Combat rolls use saved state, independently of presentation or other scenes.
  combatRandom() {

    // These bit operators work with 32-bit integers. >>> shifts in zero bits, while ^
    // mixes bits with XOR. They are different from ordinary multiplication or
    // exponentiation.
    let value = this.combatRngState >>> 0 || 1;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.combatRngState = value >>> 0;

    return this.combatRngState / 4294967296;
  }

  // Retry crowded waves as characters move, without losing any monsters.
  schedulePendingLandings() {
    this.scheduleBattleEvent(300, { kind: 'pendingLandings' });
  }

  // Retry enemies waiting for a legal spawn point as battlefield space becomes available.
  retryPendingLandings() {
    if (this.battleOver || this.pendingWaveSpawns.length === 0) return;

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    const wave = { enemies: this.pendingWaveSpawns.map(({ spawn }) => spawn) };

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const reserved = this.enemies.filter(enemy => enemy.alive).map(enemy => ({ x: enemy.arenaX, y: enemy.arenaY }));
    const landings = chooseWaveLandings(wave, this.battlefield, this.terrain,
      this.partyUnits, () => this.combatRandom(), reserved);
    this.pendingWaveSpawns = this.pendingWaveSpawns.filter(({ spawn, spawnIndex }, index) => {
      if (!landings[index]) return true;
      const enemy = this.createEnemy(spawn.type, landings[index], spawnIndex);
      this.enemies.push(enemy);
      this.animateEnemyLanding(enemy);

      return false;
    });

    if (this.pendingWaveSpawns.length > 0) this.schedulePendingLandings();
  }

  // Keep combat and targeting paused for each monster until its feet bounce onto the
  // floor.
  animateEnemyLanding(enemy) {

    enemy.landing = true;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    this.combatMembershipRevision = (this.combatMembershipRevision ?? 0) + 1;
    if (this.idleSimulating) {
      enemy.landingFloorY = 0;
      this.scheduleBattleEvent(720, { kind: 'landing', unitId: enemy.id });
      return;
    }

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const visual = enemy.spriteVisual?.image ?? enemy.body;
    const floorY = visual.y;
    enemy.landingFloorY = floorY;
    const scale = this.battlefield.getUnitScale(enemy.arenaY);
    visual.y = floorY - (enemy.container.y - this.battlefield.topY + 220) / scale;

    for (const label of [enemy.label, enemy.targetLabel, enemy.actionLabel,
      enemy.hpBack, enemy.hpFill, enemy.castBack, enemy.castFill]) label.setAlpha(0);
    this.tweens.add({
      targets: visual, y: floorY, duration: 720, ease: 'Bounce.Out'
    });
    this.scheduleBattleEvent(720, { kind: 'landing', unitId: enemy.id });
  }

  // End the landing state and hand the newly arrived enemy to normal combat updates.
  finishEnemyLanding(enemy) {
    if (!enemy.container.active) return;
    enemy.landing = false;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    this.combatMembershipRevision = (this.combatMembershipRevision ?? 0) + 1;

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap.
    enemy.hitZone.setInteractive({ useHandCursor: true });
    for (const label of [enemy.label, enemy.targetLabel, enemy.actionLabel,
      enemy.hpBack, enemy.hpFill, enemy.castBack, enemy.castFill]) label.setAlpha(1);
  }

  // This helper advances one frame of combat while the encounter is active. It updates
  // resources and actions, runs party and enemy decisions, separates crowded units, and
  // checks for a cleared wave or defeated party.
  update(time, delta) {
    if (this.restoringBattle || this.idleSummaryOpen) return;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const replaying = this.game.backgroundProgress?.isReplaying === true;

    // Sheet bolts use combat time, including Pause and background cleanup.
    updateVoidProjectiles(this, delta, replaying);

    this.classAbilitySystem?.syncChargeTweens?.(this.combatPaused);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    if (this.focusTargetId && time >= (this.focusDamageUntil ?? 0)) {
      this.focusTargetId = null;
      this.focusDamageTargetId = null;
    }

    if (!replaying) this.updatePotionHud();
    if (!this.combatPaused) this.enemies?.filter(enemy => enemy.container?.active !== false).forEach((enemy) => {
      if (!replaying) {
        enemy.spriteVisual?.update(delta);
        enemy.updateCriticalRecoil?.(delta);
      }
      if (replaying && enemy.deathElapsed !== undefined) enemy.deathElapsed += Math.max(0, delta);
      else enemy.updateDeathPresentation?.(delta);
    });

    if (this.waveRetreating && !this.combatPaused && !this.battleOver) {

      // Math.min chooses the smallest value; pairing it with Math.max can keep a result
      // inside both a lower and an upper bound.
      this.updateWaveRetreat(time, Math.min(delta / 1000, 0.05), delta);
      return;
    }

    if (this.battleOver || this.waveTransitioning || this.combatPaused) {

      // Finish a fall even when its lethal hit ended the battle or wave.
      if (!this.combatPaused && !replaying) this.partyUnits?.forEach(unit => {

        // ?. only follows this link when the value exists; a missing optional value gives
        // undefined.
        unit.spriteVisual?.update(delta);
        unit.updateCriticalRecoil?.(delta);
      });

      return;
    }

    if (this.awaitingRevive) {
      this.updateLeaderLoadoutBar();
      return;
    }

    // Cap the movement timestep so a slow frame does not cause a large position jump.
    const deltaSeconds = Math.min(delta / 1000, 0.05);

    this.partyUnits.forEach((unit) => {

      unit.updateActionBar(time);
      unit.regenMana(deltaSeconds);
      while (unit.alive && unit.status.leaderRegenNext <= time
        && unit.status.leaderRegenNext <= unit.status.leaderRegenUntil) {
        const before = unit.hp;
        unit.heal(unit.status.leaderRegenAmount);
        if (unit.hp > before) this.createFloatingText(unit.x, unit.y - 80, `+${unit.hp - before}`, '#86efac');
        unit.status.leaderRegenNext += 3000;
      }
    });

    this.enemies.forEach((enemy) => enemy.updateActionBar(time));

    const livingEnemies = this.getLivingEnemies();
    if (livingEnemies.length === 0) {
      if (this.pendingWaveSpawns?.length > 0) {
        this.partyUnits.forEach(unit => this.updatePartyUnit(unit, time, deltaSeconds));
      } else if (!this.enemies.some(enemy => enemy.alive && enemy.landing)) this.completeWave();

      return;
    }

    // Run party decisions, resolve crowding, and then let enemies choose their actions.
    this.classAbilitySystem ??= new ClassAbilitySystem(this);
    this.classAbilitySystem.tickWorld(time);
    this.partyUnits.forEach((unit) => this.updatePartyUnit(unit, time, deltaSeconds));
    this.updateEnemies(time, deltaSeconds);
    this.movement.separateUnits(deltaSeconds);

    this.partyUnits.forEach((unit) => this.movement.validateUnitPosition(unit));
    livingEnemies.forEach((enemy) => this.movement.validateUnitPosition(enemy));

    if (!replaying) this.partyUnits.forEach((unit) => {
      unit.spriteVisual?.update(delta);
      unit.updateCriticalRecoil?.(delta);
    });

    if (!replaying) this.updateHud();

    // every requires all entries to pass the check; an empty list gives true.
    if (this.partyUnits.every((unit) => !unit.alive)) {
      if (this.isLeaderAbilityReady('arise')) {
        this.awaitingRevive = true;
        this.showBattleMessage('PARTY DOWN - use ARISE! or FLEE', '#fde68a', true);
      } else {
        this.finishDefeat();
      }
    }
  }


  // This helper excludes defeated enemies from active combat decisions.
  getLivingEnemies() {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    return this.enemies.filter((enemy) => enemy.alive && !enemy.landing);
  }

  // This helper honors Focus first, then favors bosses and nearby enemies.
  getPrimaryTarget(unit) {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const living = this.getLivingEnemies().filter((enemy) =>
      unit.role === 'Tank' || this.isEnemyEngaged(enemy));
    if (living.length === 0) {
      return null;
    }

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const focused = living.find((enemy) => enemy.id === this.focusTargetId);
    const ordered = this.getLivingEnemies().find((enemy) => enemy.id === this.attackTargets.get(unit.id));
    if (ordered) return ordered;
    this.attackTargets.delete(unit.id);

    if (focused) return focused;

    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied.
    return living.sort((a, b) => {

      const guardians = ['elderSlime', 'abyssalMaw', 'voidKeeperGuardian'];
      const bossPriority = Number(b.isBoss || guardians.includes(b.enemyType))
        - Number(a.isBoss || guardians.includes(a.enemyType));
      if (bossPriority !== 0) {
        return bossPriority;
      }

      return unit.distanceTo(a) - unit.distanceTo(b);
    })[0];
  }

  // This helper chooses what one living adventurer does next. Passive effects run first,
  // followed by player-directed movement and eligible hazard avoidance; the remaining
  // decisions come from the unit's combat role.
  updatePartyUnit(unit, time, deltaSeconds) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!unit?.alive) return;

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone.
    this.classAbilitySystem ??= new ClassAbilitySystem(this);
    this.classAbilitySystem.tick(unit, time);
    if (this.applyManualMovement(unit, deltaSeconds)) return;

    if (!this.isPositionLocked(unit) && this.tryEvadeTelegraph(unit, deltaSeconds)) return;
    this.classAbilitySystem.update(unit, time, deltaSeconds);
  }

  // Melee reach is measured from centers in the combat data. Extend it only by the shared
  // visual-clearance allowance so a readable melee slot can still resolve its attack
  // without changing ranged combat ranges.
  isWithinAttackReach(attacker, target, padding = 0) {

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const meleePadding = this.movement.isMeleeUnit(attacker) ? combatSpacing.meleeReachPadding : 0;
    return attacker.distanceTo(target) <= attacker.attackRange + meleePadding + padding;
  }

  // This helper raises the tank above each target's existing threat and redirects it
  // immediately. Canceling its old action prevents a queued attack from still hitting the
  // ally the taunt just protected.
  applyTankTaunt(tank, enemies, key, time, commit = true) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    tank.spriteVisual?.play('block', enemies[0]);

    if (commit) {
      tank.markAbilityUsed(key, time);
      this.announceAbility(tank, tank.abilities[key].name, '#fde68a');
    }
    enemies.forEach((enemy) => {

      const table = this.enemyThreat.get(enemy.id);

      // Math.max chooses the largest value; pairing it with Math.min can keep a result
      // inside both a lower and an upper bound. ... expands these entries into the new
      // list or call. It does not deep-copy the objects inside.
      const highest = Math.max(0, ...table.values());

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      table.set(tank.id, highest * (1 + (tank.abilities[key].threatBonus ?? 0)) + 1);
      enemy.engagedByTank = true;
      if (tank.abilities[key].duration) {
        enemy.status.forcedApproach = tank.abilities[key].farthest === true;
        enemy.status.forcedTargetId = tank.id;
        enemy.status.forcedTargetUntil = time + tank.abilities[key].duration;
      }

      enemy.finishAction();

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      this.activeTelegraphs.filter((telegraph) => telegraph.attacker === enemy)
        .forEach((telegraph) => this.removeTelegraph(telegraph));
      this.setEnemyTarget(enemy, tank, tank.abilities[key].name);
    });
  }

  // This helper drives enemy targeting, abilities, movement, and basic attacks.
  updateEnemies(time, deltaSeconds) {

    this.getLivingEnemies().forEach((enemy) => {

      enemy.regenMana(deltaSeconds);

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      if (time < (enemy.status.stunnedUntil ?? 0)) return;
      const target = this.getHighestThreatTarget(enemy);
      if (!target) {
        this.setEnemyTarget(enemy, null);
        return;
      }

      if (!enemy.isBusy(time)) this.setEnemyTarget(enemy, target, 'highest threat');

      if (enemy.status.forcedApproach && time < enemy.status.forcedTargetUntil && enemy.distanceTo(target) > 90) {
        if (!enemy.isBusy(time)) enemy.moveToward(target.arenaX, target.arenaY, deltaSeconds, 85);
        return;
      }


      // Check skills in priority order. Only a monster with the authored boss flag gets
      // the third slot. A skipped or cooling-down skill lets the next slot be considered.
      const abilityKeys = enemy.isBoss ? ['primary', 'secondary', 'tertiary'] : ['primary', 'secondary'];
      for (const key of abilityKeys) {
        if (this.tryEnemyAbility(enemy, target, key, time)) return;
      }

      this.movement.moveToCombatPosition(enemy, target, time, deltaSeconds);

      if (this.isWithinAttackReach(enemy, target, 8) && enemy.canAttack(time)) {

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        this.beginBasicAttack(enemy, target, time, enemy.basicAttackDamageType === 'spell' ? 'spell' : 'enemy');
      }
    });
  }

  // Start one ready monster skill using its effect and targeting data. Returning true
  // prevents the enemy from starting another skill or a basic attack in the same update.
  tryEnemyAbility(enemy, target, key, time) {
    const ability = enemy.abilities?.[key];
    if (!ability || !enemy.abilityReady(key, time)) return false;

    if (ability.effect === 'heal') {

      // Compare injured health fractions, so a large boss is not favored just because
      // its missing health is a bigger number. Full-health and dead enemies are skipped.
      // filter builds the injured list; sort puts the smallest hp / maxHp fraction first.
      const injured = this.getLivingEnemies().filter(unit => unit.hp < unit.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!injured) return false;
      this.beginEnemyAbility(enemy, injured, key, time);
    } else if (ability.telegraph) {

      // castRange is measured in logical arena units. Existing ground attacks keep their
      // 220-unit reach when no override is authored. Each slot pays its own cooldown.
      if (enemy.distanceTo(target) > (ability.castRange ?? 220)) return false;
      this.beginGroundSlam(enemy, target, time, ability, key);
    } else {
      this.beginEnemyAbility(enemy, target, key, time);
    }

    return true;
  }

  // This helper checks the exact action instance before a delayed effect resolves. Dead
  // targets release the actor, while callbacks from canceled actions cannot finish or
  // resolve a newer action with the same name.
  isActionCurrent(unit, action, target = null) {

    if (unit.pendingAction !== action) return false;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!unit.alive || this.battleOver || this.time.now < (unit.status?.stunnedUntil ?? 0) || (target && (!target.alive || (unit.isEnemy && target.stealthed)))) {
      unit.finishAction();
      return false;
    }

    return true;
  }

  // This helper winds up a basic attack and rechecks its target before the hit.
  beginBasicAttack(attacker, target, time, attackType) {

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    if (attacker.role === 'Healer' && this.partyUnits.some(unit => unit.alive && unit.hp / unit.maxHp < 0.8)) return;
    if (!attacker.startAction('Attack', time, attacker.attackWindup)) {
      return;
    }

    attacker.lastAttackAt = time;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    attacker.spriteVisual?.play('attack', target);
    if (attacker.isEnemy) this.setEnemyTarget(attacker, target, 'highest threat');
    this.logActionStart(attacker, target, 'Attack');
    const action = attacker.pendingAction;
    this.scheduleBattleEvent(attacker.attackWindup, this.actionEvent('attack', attacker, target, { attackType }),
      () => this.resolveBasicAttack(attacker, action, target, attackType));
  }

  // Detect paused or decision states that should not accumulate autonomous combat work.
  isWaitingForPlayer() {
    return this.battleOver || this.combatPaused || this.awaitingRevive || GameState.run.entry === 'camp';
  }

  // Resolve the scheduled basic hit only if its action and target remain valid.
  resolveBasicAttack(attacker, action, target, attackType) {

    if (!this.isActionCurrent(attacker, action, target)) return;

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    if (attacker.role === 'Healer' && this.partyUnits.some(unit => unit.alive && unit.hp / unit.maxHp < 0.8)) {
      attacker.finishAction();
      return;
    }

    if (this.isWithinAttackReach(attacker, target, 28)) {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const power = attacker.isEnemy && attacker.basicAttackDamageType === 'spell' ? attacker.spellDamage : attacker.attackPower;
      this.resolveDamage(attacker, target, power, attackType, attacker.threatMultiplier, 'Attack');
    }
    attacker.finishAction();
  }

  // A healer's basic action restores a small amount to one injured ally.
  beginBasicHeal(healer, target, time) {
    if (!target.alive || target.hp >= target.maxHp || !healer.canHeal(time)
      || this.classAbilitySystem.distance(healer, target) > healer.basicHealRange
      || !healer.startAction('Mend', time, healer.healWindup)) return;

    healer.lastHealAt = time;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    healer.spriteVisual?.play('block', target);
    this.logActionStart(healer, target, 'Mend');
    const action = healer.pendingAction;
    this.scheduleBattleEvent(healer.healWindup, this.actionEvent('heal', healer, target),
      () => this.resolveBasicHeal(healer, action, target));
  }

  // Resolve the scheduled heal against the eligible ally and record actual restored HP.
  resolveBasicHeal(healer, action, target) {
    if (!this.isActionCurrent(healer, action, target)) return;
    if (target.hp < target.maxHp && this.classAbilitySystem.distance(healer, target) <= healer.basicHealRange) {
      this.resolveHeal(healer, target, abilityPower(healer, {}, healer.basicHealPower, true), 'Mend');
    }
    healer.finishAction();
  }

  // This helper announces an enemy cast and resolves it if the action remains valid.
  beginEnemyAbility(attacker, target, key, time) {

    const ability = attacker.abilities[key];
    if (!ability || !attacker.startAction(ability.name, time, ability.windup)) {
      return;
    }

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.

    // The supplied void boards distinguish ranged casting and leaping from melee.
    // This chooses only the visible clip; the existing windup and damage still apply.
    attacker.spriteVisual?.play(ability.animation ?? 'attack', target);
    this.announceAbility(attacker, ability.name, '#c084fc');
    this.setEnemyTarget(attacker, target, 'highest threat');
    this.logActionStart(attacker, target, ability.name);
    attacker.markAbilityUsed(key, time);

    const action = attacker.pendingAction;
    this.scheduleBattleEvent(ability.windup, this.actionEvent('enemyAbility', attacker, target, { key }),
      () => this.resolveEnemyAbility(attacker, action, target, ability));
  }

  // Apply the scheduled enemy skill through the shared targeting and combat effect rules.
  resolveEnemyAbility(attacker, action, target, ability) {

    if (!this.isActionCurrent(attacker, action, target)) return;

    // A leaping strike uses close impact feedback; casts keep their traveling bolt.
    if (ability.animation === 'leap') this.createMeleePulse(target, 0xa855f7);
    else this.createProjectile(attacker, target, 0xa855f7, ability.projectile);
    if (ability.effect === 'heal') {
      this.resolveHeal(attacker, target, abilityPower(attacker, ability, ability.power, true), ability.name);
    } else {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      this.resolveDamage(attacker, target, abilityPower(attacker, ability),
        ability.damageType === 'physical' ? 'enemy' : 'spell', 1, ability.name);
    }

    attacker.finishAction();
  }

  // Start an enemy area attack and draw a warning at its authored center. After the
  // warning delay, damage living party members still inside that fixed area.
  beginGroundSlam(attacker, target, time, ability, key = 'primary') {

    if (!attacker.startAction(ability.name, time, ability.telegraph)) {
      return;
    }

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.

    // Area clips show the creature gathering energy while the warning is active.
    // Monsters without a separate area sheet keep their established attack clip.
    attacker.spriteVisual?.play(ability.animation ?? 'attack', target);
    this.announceAbility(attacker, ability.name, '#f87171');
    this.setEnemyTarget(attacker, target, 'highest threat');
    this.logActionStart(attacker, target, ability.name);

    // Existing callers default to primary. Other slots must record their own cooldown
    // and mana cost so they remain independent during visible and saved idle combat.
    attacker.markAbilityUsed(key, time);

    // areaCenter: 'caster' surrounds the monster, as Consume does. The default still
    // surrounds the threat target. Capture the cast-start position so players can leave
    // the warning. Windup and telegraph describe this same cast, not two added waits.
    const origin = ability.areaCenter === 'caster' ? attacker : target;
    const center = { arenaX: origin.arenaX, arenaY: origin.arenaY };
    const telegraph = this.createSlamTelegraph(attacker, ability, center, ability.telegraph);
    const action = attacker.pendingAction;
    this.scheduleBattleEvent(ability.telegraph, this.actionEvent('groundSlam', attacker, null, { center, ability }),
      () => this.resolveGroundSlam(attacker, action, center, ability, telegraph));
  }

  // Draw the warning area for the pending slam so the player can move before it resolves.
  createSlamTelegraph(attacker, ability, center, duration) {
    const screenCenter = this.battlefield.arenaToScreen(center.arenaX, center.arenaY);
    const radii = this.battlefield.getGroundEllipseRadii(ability.radius, center.arenaY);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const warning = this.add.ellipse(screenCenter.x, screenCenter.y, radii.width * 2, radii.height * 2, 0xef4444, 0.14)
      .setStrokeStyle(8, 0xf87171, 0.88)
      .setDepth(40 + screenCenter.y);
    const inner = this.add.ellipse(screenCenter.x, screenCenter.y, 32, 16, 0xf87171, 0.35)
      .setDepth(41 + screenCenter.y);

    // Register the warning in arena coordinates for automatic hazard avoidance.
    const telegraph = {
      arenaX: center.arenaX,
      arenaY: center.arenaY,
      radius: ability.radius,

      // Most warnings allow normal mechanic avoidance. Consume asks for a player
      // response; its ability data disables automatic dodging but keeps manual movement.
      autoAvoid: ability.autoAvoid ?? true,
      warning,
      inner,
      attacker
    };

    this.activeTelegraphs.push(telegraph);

    this.tweens.add({
      targets: inner,
      displayWidth: radii.width * 2,
      displayHeight: radii.height * 2,
      alpha: 0.08,
      duration,
      ease: 'Linear'
    });

    return telegraph;
  }

  // Resolve a saved strike against current positions and remove its warning.
  resolveGroundSlam(attacker, action, center, ability, telegraph) {

    if (!this.isActionCurrent(attacker, action)) {
      this.removeTelegraph(telegraph);
      return;
    }

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    this.partyUnits.filter((unit) => unit.alive).forEach((unit) => {

      if (unit.distanceToPoint(center.arenaX, center.arenaY) <= ability.radius) {

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        this.resolveDamage(attacker, unit, abilityPower(attacker, ability),
          ability.damageType === 'physical' ? 'enemy' : 'spell', 1, ability.name, false);
      }
    });

    const screenCenter = this.battlefield.arenaToScreen(center.arenaX, center.arenaY);
    const radii = this.battlefield.getGroundEllipseRadii(ability.radius, center.arenaY);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const burst = this.add.ellipse(screenCenter.x, screenCenter.y, radii.width * 0.8, radii.height * 0.8, 0xef4444, 0.42)
      .setDepth(45 + screenCenter.y);
    this.tweens.add({
      targets: burst,
      displayWidth: radii.width * 2.6,
      displayHeight: radii.height * 2.6,
      alpha: 0,
      duration: 260,

      // Finish this animation's remaining work when the tween reaches its end.
      onComplete: () => burst.destroy()
    });

    this.removeTelegraph(telegraph);
    attacker.finishAction();
  }

  // This helper lets eligible units abandon their action to escape a ground warning.
  tryEvadeTelegraph(unit, deltaSeconds) {

    if (!this.tactics.shouldAvoidMechanics(unit) || !unit.alive || this.activeTelegraphs.length === 0) {
      return false;
    }

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    // Missing autoAvoid fields in older saved warnings retain the usual avoidance rule.
    const danger = this.activeTelegraphs.find((telegraph) => telegraph.autoAvoid !== false
      && unit.distanceToPoint(telegraph.arenaX, telegraph.arenaY) < telegraph.radius + 40);
    if (!danger) {
      return false;
    }

    unit.finishAction();
    unit.moveAwayFrom(danger.arenaX, danger.arenaY, deltaSeconds, danger.radius + 90);
    return true;
  }

  // This helper retires a ground warning from both the display and hazard tracking.
  removeTelegraph(telegraph) {
    if (!telegraph) return;

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    this.activeTelegraphs = this.activeTelegraphs.filter((item) => item !== telegraph);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    telegraph.warning?.destroy();
    telegraph.inner?.destroy();
  }

  // This helper rolls the attacker critical chance when the action allows it.
  rollCritical(attacker, allowCrit = true) {

    // The condition before ? chooses the first value when true and the value after : when
    // false. ?? uses the fallback only for null or undefined. A real zero or false stays
    // intact.
    const bonus = this.time.now < (attacker.status.abilityCritUntil ?? 0) ? attacker.status.abilityCritBonus ?? 0 : 0;

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    return allowCrit && this.combatRandom() < Math.min(attacker.statProgressionVersion === 2 ? 0.4 : 0.95, (attacker.critChance ?? 0) + bonus);
  }

  // This helper resolves an attack from its base damage through critical hits, status
  // effects, and the target defenses. It updates combat timestamps, threat, visual
  // feedback, and the log, then handles any resulting defeat.
  resolveDamage(attacker, target, baseAmount, attackType, threatMultiplier = 1, abilityName = 'Attack', allowCrit = true) {

    // Area hits and delayed attacks also obey the engagement rule, so a spell cannot pull
    // an untouched enemy while the tank is approaching.
    if (!attacker.isEnemy && attacker.role !== 'Tank' && target.isEnemy && !this.isEnemyEngaged(target)) return;
    const now = this.time.now;

    // Resolve blindness before damage modifiers; a miss stops the rest of the hit
    // processing.
    const accuracy = hitAccuracy(attacker);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    if (attackType !== 'reflection' && (accuracy < (target.minimumAccuracy ?? 0) || accuracy < 1 && this.combatRandom() >= accuracy
      || now < (attacker.status.blindUntil ?? 0) && this.combatRandom() < (attacker.status.blindChance ?? 0))) {
      this.createFloatingText(target.x, target.y - 82, 'MISS', '#cbd5e1', false, 'miss');

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      this.combatLog?.add('miss', `${attacker.name}'s ${abilityName} missed ${target.name}`, {
        wave: this.currentWaveIndex + 1,
        actor: attacker.name,
        target: target.name,
        ability: abilityName
      });

      return;
    }

    const interceptor = target.status.interceptSource;
    if (attacker.isEnemy && interceptor?.alive && interceptor !== target
      && now < (target.status.interceptUntil ?? 0)) {
      target.status.interceptUntil = 0;
      target.status.interceptSource = null;
      this.resolveDamage(attacker, interceptor, baseAmount, attackType, threatMultiplier, abilityName, allowCrit);

      return 0;
    }

    // Roll the critical result and apply outgoing damage bonuses or penalties.
    const guaranteedAbilityCritical = allowCrit && attacker.status.nextAbilityCrit === true && abilityName !== 'Attack';
    const critical = guaranteedAbilityCritical || this.rollCritical(attacker, allowCrit);
    if (guaranteedAbilityCritical) attacker.status.nextAbilityCrit = false;

    if (attacker.status.abilityCritOnce) {
      attacker.status.abilityCritUntil = 0;
      attacker.status.abilityCritOnce = false;
    }

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    let amount = Math.round(baseAmount * (critical ? attacker.critMultiplier : 1));
    if (attackType !== 'reflection' && attacker.status.nextAttackBoost) {
      amount = Math.round(amount * (1 + attacker.status.nextAttackBoost));
      attacker.status.nextAttackBoost = 0;
    }

    if (attackType !== 'reflection' && !attacker.isEnemy && now < (attacker.status.damageBoostUntil ?? 0)) {
      amount = Math.round(amount * (1 + (attacker.status.damageBoost ?? 0)));
    }

    if (attacker.isEnemy && now < (attacker.status.outgoingDamageReductionUntil ?? 0)) {

      // Math.max chooses the largest value; pairing it with Math.min can keep a result
      // inside both a lower and an upper bound.
      amount = Math.round(amount * Math.max(0, 1 - (attacker.status.outgoingDamageReduction ?? 0)));
    }

    if (now < (attacker.status.enrageUntil ?? 0)) amount = Math.round(amount * attacker.status.enrageDamage);
    else if (now < (attacker.status.exhaustedUntil ?? 0)) amount = Math.round(amount * attacker.status.exhaustedDamage);
    if (attackType !== 'reflection' && now < (attacker.status.honorDamageUntil ?? 0)) amount = Math.round(amount * (1 + attacker.status.honorDamageBoost));

    if (attackType !== 'reflection' && !attacker.isEnemy && now < this.assaultUntil) amount = Math.round(amount * (1 + this.assaultBonus));
    if (!attacker.isEnemy && attacker.role !== 'Healer' && target.id === this.focusDamageTargetId
      && now < (this.focusDamageUntil ?? 0)) {
      amount = Math.round(amount * 1.05);
    }

    if (attacker.isEnemy && !target.isEnemy && now < this.braceUntil) amount = Math.max(1, Math.round(amount * (1 - this.braceReduction)));

    // Let the target apply its defenses, then measure actual health loss for the combat
    // log.
    const ranged = attackType === 'spell' || attackType === 'ranged' || attacker.attackRange > 180;
    if (now < (target.status.immuneUntil ?? 0)) {
      this.createFloatingText(target.x, target.y - 82, 'IMMUNE', '#fde68a');
      return 0;
    }
    const temporaryDodge = attacker.isEnemy && now < (target.status.abilityDodgeUntil ?? 0)
      && (!target.status.abilityDodgeRangedOnly || attackType === 'ranged' || attackType === 'spell' || attacker.attackRange > 180)
      ? target.status.abilityDodgeChance ?? 0 : 0;

    if (attackType !== 'reflection' && attacker !== target && target.statProgressionVersion === 2
      && this.combatRandom() < Math.min(0.3, (target.dodge ?? 0) + temporaryDodge)) {
      this.createFloatingText(target.x, target.y - 82, 'DODGE', '#cbd5e1', false, 'miss');
      return 0;
    }

    if (target.statProgressionVersion !== 2 && attacker.isEnemy && now < (target.status.abilityDodgeUntil ?? 0)
      && (!target.status.abilityDodgeRangedOnly || attackType === 'ranged' || attackType === 'spell' || attacker.attackRange > 180)
      && this.combatRandom() < (target.status.abilityDodgeChance ?? 0)) return 0;

    if (attacker.isEnemy && this.classAbilitySystem?.tryParry(target, attacker, amount, now)) return 0;
    const physical = ['melee', 'ranged', 'enemy', 'reflection'].includes(attackType);
    const leaderBlock = now < (target.status.leaderBlockUntil ?? 0) ? target.status.leaderBlockBonus ?? 0 : 0;
    const armorBlocked = physical && attackType !== 'reflection' && attacker !== target
      && target.statProgressionVersion === 2 && this.combatRandom() < cappedChance('block', (target.block ?? 0) + leaderBlock);
    const hpBefore = target.hp;
    target.takeDamage(amount, { time: now, ranged, attacker, physical, armorBlocked,
      blocked: armorBlocked || (!target.isEnemy && now < this.braceUntil)
        || now < (target.status.shieldUntil ?? 0)
        || now < (target.status.damageReductionUntil ?? 0) });

    const actualDamage = hpBefore - target.hp;

    // Only a critical that actually takes HP starts the shock animation. Misses,
    // immunity and fully absorbed hits do not bounce. Replayed background hits keep
    // their real damage but skip historical visual reactions when catching up.
    if (critical && actualDamage > 0 && !this.idleSimulating) target.playCriticalHit?.(attacker);
    if (actualDamage > 0 && target.isEnemy && attacker.status.nextPoisonPower) {
      target.status.poison = {
        caster: attacker,
        power: attacker.status.nextPoisonPower,
        interval: 2000,
        next: now + 2000,
        until: now + 6000
      };

      attacker.status.nextPoisonPower = 0;
    }

    // Record recent combat interaction timestamps.
    if (amount > 0) {
      attacker.lastCombatActionAt = now;
      target.lastCombatActionAt = now;
      attacker.lastDealtDamageAt = now;
      target.lastTakenDamageAt = now;
    }

    if (target.isEnemy && now < (target.status.stunnedUntil ?? 0) && now >= (target.status.hardStunUntil ?? 0) && amount > 0) {
      target.status.stunnedUntil = 0;
      this.createFloatingText(target.x, target.y - 96, 'UNFROZEN', '#cbd5e1');
    }

    if (attacker.isEnemy && !target.isEnemy) {
      this.flashPartyHudName(target);
    }

    const flashColor = attackType === 'spell'
      ? 0x60a5fa
      : attackType === 'holy'
        ? 0xfde68a
        : attackType === 'enemy'
          ? 0xf87171
          : 0xffffff;

    target.flash(flashColor);

    if (!attacker.isEnemy) {
      this.getLivingEnemies().forEach((enemy) => {

        if (enemy === target) {

          // The condition before ? chooses the first value when true and the value after :
          // when false. ?? uses the fallback only for null or undefined. A real zero or
          // false stays intact.
          const threatReduction = now < (attacker.status.threatReductionUntil ?? 0) ? 1 - (attacker.status.threatReduction ?? 0) : 1;
          const preparedThreat = attacker.status.nextThreatBonus ?? 1;
          this.addThreat(enemy, attacker, amount * threatMultiplier * threatReduction * preparedThreat);
          attacker.status.nextThreatBonus = 1;
        }
      });
    }

    // Record the actual health change alongside the ability, critical result, and current
    // threat snapshot.
    this.combatLog?.add('damage', `${attacker.name} used ${abilityName} on ${target.name} for ${actualDamage}${critical ? ' critical' : ''} damage`, {
      wave: this.currentWaveIndex + 1,
      actor: attacker.name,
      target: target.name,
      ability: abilityName,
      amount: actualDamage,
      targetSide: target.isEnemy ? 'enemy' : 'party',
      critical,
      targetHp: target.hp,
      targetMaxHp: target.maxHp,
      threat: target.isEnemy ? this.getThreatSnapshot(target) : undefined
    });

    if (attacker.isEnemy && target.status.bramble && amount > 0) {
      const bramble = target.status.bramble;
      target.status.bramble = null;
      if (attacker.alive) this.resolveDamage(bramble.caster, attacker, bramble.power, 'spell', 1, 'Bramble Mend', false);
    }

    if (attackType === 'spell' || attackType === 'holy') {
      this.createProjectile(attacker, target, attackType === 'holy' ? 0xfde68a : 0x60a5fa);
    } else {
      this.createMeleePulse(target, critical ? 0xfbbf24 : 0xffffff);
    }

    const prefix = critical ? 'CRIT ' : '';
    this.createFloatingText(target.x, target.y - 82, `${prefix}-${amount}`, '#ef4444', critical, 'damage');

    // Award a defeated enemy once and record the death after the damage event.
    if (!target.alive && target.isEnemy) {
      this.handleEnemyDeath(target);
    }

    if (hpBefore > 0 && !target.alive) {
      this.combatLog?.add('death', `${target.name} was defeated by ${attacker.name}'s ${abilityName}`, {
        wave: this.currentWaveIndex + 1,
        actor: attacker.name,
        target: target.name,
      ability: abilityName,
      targetSide: target.isEnemy ? 'enemy' : 'party', amount: actualDamage,
      hpBefore, targetHp: target.hp, targetMaxHp: target.maxHp
      });
    }

    return actualDamage;
  }

  // This helper applies a heal, including its critical roll, and measures how much health
  // was actually restored for feedback and the combat log. Healing generates threat only
  // on enemies already engaged by a tank.
  resolveHeal(healer, target, baseAmount, abilityName, allowCrit = true) {

    const critical = this.rollCritical(healer, allowCrit);

    // The condition before ? chooses the first value when true and the value after : when
    // false. ?? uses the fallback only for null or undefined. A real zero or false stays
    // intact.
    const healingBoost = this.time.now < (healer.status.healingBoostUntil ?? 0) ? 1 + healer.status.healingBoost : 1;
    const honorBoost = this.time.now < (healer.status.honorHealingUntil ?? 0) ? 1 + healer.status.honorHealingBoost : 1;
    const targetReduction = this.time.now < (target.status.healingReductionUntil ?? 0) ? 1 - target.status.healingReduction : 1;
    const preparedBoost = healer.status.nextHealBoost ?? 0;
    healer.status.nextHealBoost = 0;
    const amount = Math.round(baseAmount * healingBoost * honorBoost * targetReduction * (1 + preparedBoost) * (critical ? healer.critMultiplier : 1));
    const before = target.hp;

    target.heal(amount);

    // Display restored health rather than counting overhealing as recovery.
    const effectiveHealing = target.hp - before;

    target.flash(0x86efac);
    this.createProjectile(healer, target, 0x86efac);
    this.createFloatingText(target.x, target.y - 82, `+${effectiveHealing}${critical ? '!' : ''}`, '#22c55e', critical, 'healing');

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const engaged = this.getLivingEnemies().filter((enemy) => this.isEnemyEngaged(enemy));
    engaged.forEach((enemy) => this.addThreat(enemy, healer, effectiveHealing * 0.45));

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.combatLog?.add('healing', `${healer.name} used ${abilityName} on ${target.name} for ${effectiveHealing}${critical ? ' critical' : ''} healing`, {
      wave: this.currentWaveIndex + 1,
      actor: healer.name,
      target: target.name,
      ability: abilityName,
      amount: effectiveHealing,
      targetSide: target.isEnemy ? 'enemy' : 'party',
      critical,
      targetHp: target.hp,
      targetMaxHp: target.maxHp,
      generatedThreat: engaged.length > 0 ? Math.round(effectiveHealing * 0.45) : 0
    });
  }

  // This helper awards each defeated enemy gold only once.
  handleEnemyDeath(enemy) {

    if (enemy.rewarded) {
      return;
    }
    enemy.rewarded = true;
    const definition = enemy.definition;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const minimum = definition.goldMin ?? 0;

    // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
    this.earnedGold += minimum + Math.floor(this.combatRandom() * ((definition.goldMax ?? 0) - minimum + 1));

    // Keep the container until the death clip and shared fade/pop finish. Wave cleanup
    // removes it after the animation.
    enemy.hitZone?.disableInteractive?.();
  }

  // This helper checks whether allies may engage an enemy. A tank hit or taunt opens
  // normal combat for that enemy; parties without a living tank can fight immediately
  // instead of waiting for an impossible engagement.
  isEnemyEngaged(enemy) {

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    return enemy.engagedByTank === true || !this.partyUnits.some((unit) => unit.alive && unit.role === 'Tank');
  }

  // This helper records normal threat after the tank has engaged an enemy. Tank damage
  // establishes engagement, while ally damage and healing wait for that opening before
  // contributing their usual threat amounts.
  addThreat(enemy, unit, amount) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!enemy?.isEnemy || !unit || unit.isEnemy) {
      return;
    }
    const table = this.enemyThreat.get(enemy.id);

    if (!table) {
      return;
    }

    if (unit.role === 'Tank' && amount > 0) enemy.engagedByTank = true;
    if (unit.role !== 'Tank' && !this.isEnemyEngaged(enemy)) return;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    table.set(unit.id, (table.get(unit.id) ?? 0) + Math.max(0, amount));
  }

  // This helper chooses the living threat leader. With equal threat, tanks take priority
  // before distance, including at the start of a wave.
  getHighestThreatTarget(enemy) {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const living = this.partyUnits.filter((unit) => unit.alive && !unit.stealthed);
    if (living.length === 0) {
      return null;
    }

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const forced = living.find(unit => unit.id === enemy.status?.forcedTargetId);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    if (forced && this.time.now < (enemy.status.forcedTargetUntil ?? 0)) return forced;

    // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
    // object; get/set read and write that same key.
    const table = this.enemyThreat.get(enemy.id) ?? new Map();

    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied.
    return living.sort((a, b) => {

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      const diff = (table.get(b.id) ?? 0) - (table.get(a.id) ?? 0);
      if (Math.abs(diff) > 0.01) {
        return diff;
      }
      const tankPriority = Number(b.role === 'Tank') - Number(a.role === 'Tank');

      if (tankPriority !== 0) return tankPriority;
      return enemy.distanceTo(a) - enemy.distanceTo(b);
    })[0];
  }

  // This helper captures a ranked threat table for reviewing enemy decisions.
  getThreatSnapshot(enemy) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
    // object; get/set read and write that same key.
    const table = this.enemyThreat.get(enemy.id) ?? new Map();

    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied.
    return this.partyUnits
      .map((unit) => ({ name: unit.name, role: unit.role, threat: Math.round(table.get(unit.id) ?? 0), alive: unit.alive }))
      .sort((a, b) => b.threat - a.threat);
  }

  // This helper stores the enemy target for inspection and logs meaningful targeting
  // changes.
  setEnemyTarget(enemy, target, reason = '') {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const targetId = target?.id ?? null;
    enemy.setTargetName(target?.name ?? '');
    if (enemy.currentTargetId === targetId && enemy.currentTargetReason === reason) return;

    enemy.currentTargetId = targetId;
    enemy.currentTargetReason = reason;
    if (!target) return;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.combatLog?.add('target', `${enemy.name} targets ${target.name}${reason ? ` (${reason})` : ''}`, {
      wave: this.currentWaveIndex + 1,
      actor: enemy.name,
      target: target.name,
      reason,
      threat: this.getThreatSnapshot(enemy)
    });
  }

  // This helper records the actor intent before an attack or heal resolves.
  logActionStart(actor, target, ability) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. The condition before ? chooses the first value when true and the value
    // after : when false.
    this.combatLog?.add('action', `${actor.name} begins ${ability}${target ? ` on ${target.name}` : ''}`, {
      wave: this.currentWaveIndex + 1,
      actor: actor.name,
      target: target?.name,
      ability
    });
  }

  // This helper totals an adventurer threat across the remaining enemies.
  getCombinedThreat(unit) {

    let total = 0;
    this.getLivingEnemies().forEach((enemy) => {

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. ?. only follows this link when the value exists; a missing optional value
      // gives undefined.
      total += this.enemyThreat.get(enemy.id)?.get(unit.id) ?? 0;
    });

    return total;
  }

  // This helper prioritizes living allies by the fraction of health missing.
  getMostInjuredPartyMember() {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied. filter keeps entries whose callback
    // returns true. It builds a new list and leaves the original list in place.
    return this.partyUnits
      .filter((unit) => unit.alive && unit.hp < unit.maxHp)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0] ?? null;
  }

  // This helper connects attacker and target with a brief traveling effect.
  createProjectile(attacker, target, color, kind = 'bolt') {

    // Accepted void sprites supply an animated bolt instead of the shared circle.
    if (createVoidProjectile(this, attacker, target, kind)) return;

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const projectile = this.add.circle(attacker.x, attacker.y, 9, color).setDepth(4000);
    this.tweens.add({
      targets: projectile,
      x: target.x,
      y: target.y,
      duration: 180,
      ease: 'Linear',

      // Finish this animation's remaining work when the tween reaches its end.
      onComplete: () => projectile.destroy()
    });
  }

  // This helper marks a close combat impact with a short visual pulse.
  createMeleePulse(target, color = 0xffffff) {

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    const pulse = this.add.ellipse(target.x, target.y + 8, 48, 24, color, 0.25).setDepth(4000);
    this.tweens.add({
      targets: pulse,
      displayWidth: 120,
      displayHeight: 60,
      alpha: 0,
      duration: 120,

      // Finish this animation's remaining work when the tween reaches its end.
      onComplete: () => pulse.destroy()
    });
  }

  // This helper shows a living unit ability name above the action.
  announceAbility(unit, name, color = '#f8fafc') {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!unit?.alive || !name) return;

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    this.createFloatingText(unit.x, Math.max(unit.y - 122, this.battlefield.topY + 12), name.toUpperCase(), color, false, 'ability');
  }

  // This helper animates combat feedback with extra emphasis for critical results.
  createFloatingText(x, y, text, color, critical = false, kind = 'damage') {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (this.game.backgroundProgress?.isReplaying) return;

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. Origin is the anchor within the object: 0 is the left/top edge,
    // 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
    // necessarily the object's corner. The condition before ? chooses the first value when
    // true and the value after : when false.
    const label = this.add.text(x, y, text, {
      fontFamily: UI_FONT_FAMILIES.sans,
      fontSize: critical ? fontPx('display78') : fontPx('display51'),
      fontStyle: UI_FONT_WEIGHTS.bold,
      color,
      stroke: '#000000',
      strokeThickness: critical ? 8 : 5
    }).setOrigin(0.5).setDepth(4200);

    if (critical) {
      label.setScale(1.18);
    }

    this.tweens.add({
      targets: label,
      y: y - (critical ? 86 : 60),
      scale: critical ? 1 : 0.96,
      alpha: 0,
      duration: (critical ? 1050 : 760) * (kind === 'ability' ? 1.5 : 1),
      ease: 'Cubic.Out',

      // Finish this animation's remaining work when the tween reaches its end.
      onComplete: () => label.destroy()
    });
  }

  // This helper displays battle guidance until it fades or is explicitly replaced.
  showBattleMessage(text, color = '#d6a85f', persistent = false, durationMultiplier = 1) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (this.game.backgroundProgress?.isReplaying && !persistent) return;

    if (!this.battleMessageText) return;

    this.tweens.killTweensOf(this.battleMessageText);
    this.battleMessageText.setText(text).setColor(color).setAlpha(1);
    if (this.battleMessagePlaque) {

      // Math.min chooses the smallest value; pairing it with Math.max can keep a result
      // inside both a lower and an upper bound.
      const panelWidth = Math.min(this.scale.width - 80, Math.max(500, this.battleMessageText.width + 70));
      const panelHeight = Math.max(74, this.battleMessageText.height + 30);
      this.battleMessagePlaque.destroy();
      this.battleMessagePlaque = addStonePanel(this, this.scale.width / 2, this.battleLayout.messageY, panelWidth, panelHeight, 4999);
      const messageY = Math.max(this.battleLayout.messageY, 100 + panelHeight / 2);
      this.battleMessageText.setY(messageY);
      this.battleMessagePlaque.setY(messageY);
    }

    this.battleMessagePlaque?.setVisible(Boolean(text));

    if (!persistent) {
      this.tweens.add({
        targets: this.battleMessageText,
        alpha: 0,
        delay: 900 * durationMultiplier,
        duration: 260 * durationMultiplier,

        // Finish this animation's remaining work when the tween reaches its end.
        onComplete: () => {

          // ?. only follows this link when the value exists; a missing optional value
          // gives undefined.
          if (this.battleMessageText?.active) this.battleMessageText.setText('').setAlpha(1);
          this.battleMessagePlaque?.setVisible(false);
        }
      });
    }
  }

  // This helper dismisses guidance when the current interaction no longer needs it.
  clearBattleMessage() {

    if (!this.battleMessageText) return;
    this.tweens.killTweensOf(this.battleMessageText);
    this.battleMessageText.setText('').setAlpha(1);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.battleMessagePlaque?.setVisible(false);
  }

  // This helper clears wave visuals and paces the transition to the next result.
  completeWave() {

    if (this.waveTransitioning || this.battleOver) {
      return;
    }

    // Stop active combat updates during the wave transition and clear remaining ground
    // warnings.
    this.waveTransitioning = true;
    let waveReward = null;
    if (isOrdinaryDelve() && this.currentWaveIndex < this.bossWaveIndex) {
      waveReward = awardOrdinaryWave(GameState.currentDelve, this.currentWaveIndex,
        this.bossWaveIndex, GameState.run.entry === 'farm', this.partyUnits, () => this.combatRandom());
      if (waveReward) {
        this.earnedGold = 0;
      }
    }

    if (this.idleSimulating) {
      const summary = this.idleSummary;
      summary.waves += 1;
      if (waveReward) {
        summary.gold += waveReward.gold;
        summary.xp += waveReward.xp;

        // ??= fills a missing value once. It leaves an existing value, including zero or
        // false, alone. Object.fromEntries turns [key, value] pairs back into an object. A
        // later pair with the same key replaces the earlier value. map builds one output
        // entry for each input entry, in the same order. The callback's return value
        // becomes that output entry.
        summary.xpByHero ??= Object.fromEntries(this.partyUnits.map(hero => [hero.id, summary.xp - waveReward.xp]));

        // Object.entries turns own fields into [key, value] pairs so we can visit or
        // transform them.
        for (const [id, xp] of Object.entries(waveReward.xpByHero)) {

          // ?? uses the fallback only for null or undefined. A real zero or false stays
          // intact.
          summary.xpByHero[id] = (summary.xpByHero[id] ?? 0) + xp;
        }

        for (const [id, count] of Object.entries(waveReward.materials)) {
          summary.materials[id] = (summary.materials[id] ?? 0) + count;
        }
      }
    }

    this.waveRetreating = true;
    this.waveReturnReadyAt = null;
    this.waveReturnStartedAt = this.time.now;
    this.waveReturnTimedOut = false;
    this.waveReturnProgress = new Map();

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries.
    this.waveReturnSettled = new Set();

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    this.waveReturnTargets = new Map(this.partyUnits.filter(unit => unit.alive).map(unit => {
      const home = this.waveReturnPositions.get(unit.id);
      if (!home) return [unit.id, { x: unit.arenaX, y: unit.arenaY }];
      const clearDestination = this.movement.getWaveReturnPointClearOfFallenAllies(unit, home);

      return [unit.id, this.movement.getSafeArenaPoint(clearDestination.x, clearDestination.y, unit)];
    }));

    if (this.currentWaveIndex + 1 < this.waves.length) {
      this.partyUnits.filter(unit => unit.alive).forEach(unit => {

        // Math.ceil rounds upward to the next integer, including when the value has a
        // fractional part.
        const halfway = Math.ceil(unit.maxHp * 0.5);
        if (unit.hp < halfway) unit.heal(halfway - unit.hp);
      });

      this.updateHud();
    }

    this.manualTargets.clear();
    this.heldUnitIds.clear();
    this.attackTargets.clear();
    this.activeTelegraphs.forEach((telegraph) => this.removeTelegraph(telegraph));
    this.clearBattleMessage();

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.waveRewardText?.destroy();
    this.waveRewardText = null;
    if (!this.game.backgroundProgress?.isReplaying) this.waveRewardText = this.add.text(this.scale.width / 2, this.scale.height * 0.39,
      waveReward ? this.formatWaveReward(waveReward) : 'WAVE CLEARED', {
        fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('heading40'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#bef264',
        stroke: '#080e19', strokeThickness: 6, align: 'center', wordWrap: { width: this.scale.width - 760 }
      }).setOrigin(0.5).setDepth(5000).setName('wave-reward-text');

    if (this.waveRewardText) this.tweens.add({ targets: this.waveRewardText, y: this.waveRewardText.y - 36, duration: 900, ease: 'Cubic.Out' });
    this.combatLog?.add('wave', `Wave ${this.currentWaveIndex + 1} cleared`, { wave: this.currentWaveIndex + 1 });
    this.combatLog?.persist();

    this.enemies.filter((enemy) => enemy.container?.active !== false).forEach((enemy) => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      if (this.game.backgroundProgress?.isReplaying) {
        enemy.container.destroy();
        return;
      }

      // The condition before ? chooses the first value when true and the value after :
      // when false. Math.max chooses the largest value; pairing it with Math.min can keep
      // a result inside both a lower and an upper bound. ?? uses the fallback only for
      // null or undefined. A real zero or false stays intact.
      this.tweens.add({
        targets: enemy.container,
        alpha: 0,
        delay: enemy.alive ? 0 : Math.max(0, 1100 - (enemy.deathElapsed ?? 0)),
        duration: 250,

        // Finish this animation's remaining work when the tween reaches its end.
        onComplete: () => enemy.container.destroy()
      });
    });

  }

  // Keep each actual drop readable as reward pools grow.
  formatWaveReward(reward) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const materials = reward.materials ?? { [reward.materialId]: reward.materialCount };

    // ... expands these entries into the new list or call. It does not deep-copy the
    // objects inside. The condition before ? chooses the first value when true and the
    // value after : when false. map builds one output entry for each input entry, in the
    // same order. The callback's return value becomes that output entry.
    return [`+${reward.gold} GOLD  +${reward.xp} XP`,
      ...(reward.happiness ? [`+${reward.happiness} HAPPINESS per living adventurer`] : []),
      ...Object.entries(materials).filter(([, count]) => count > 0)
        .map(([id, count]) => `+${count} ${getMaterialDefinition(id)?.name ?? id}`),
      ...(reward.items ?? []).map(item => `+${item.count ?? 1} ${item.name ?? item.itemId ?? item.id}`)].join('\n');
  }

  // Return living adventurers to their original positions before the next wave.
  updateWaveRetreat(time, deltaSeconds, delta) {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    const living = this.partyUnits.filter((unit) => unit.alive);
    for (const unit of living) {
      const destination = this.waveReturnTargets.get(unit.id);
      if (!destination) continue;

      // Measure the remaining logical distance to this unit's saved home slot. Within six
      // units we snap to the exact slot to avoid endless tiny steps. Progress records
      // detect a blocked return rather than waiting forever.
      const distance = Math.hypot(unit.arenaX - destination.x, unit.arenaY - destination.y);
      if (distance > 6 && !this.waveReturnTimedOut && !this.waveReturnSettled.has(unit.id)) {
        unit.moveToward(destination.x, destination.y, deltaSeconds * 2, 0, false);
      } else if (distance > 0 && distance <= 6) {
        unit.setArenaPosition(destination.x, destination.y);
      }
      const remaining = Math.hypot(unit.arenaX - destination.x, unit.arenaY - destination.y);

      const progress = this.waveReturnProgress.get(unit.id);
      if (!progress || remaining < progress.bestDistance - 6) {
        this.waveReturnProgress.set(unit.id, { bestDistance: remaining, lastProgressAt: time });
      } else if (remaining > 6 && time - progress.lastProgressAt >= 2000) {
        this.waveReturnSettled.add(unit.id);
      }

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      if (!this.game.backgroundProgress?.isReplaying) {
        unit.spriteVisual?.update(delta);
        unit.updateCriticalRecoil?.(delta);
      }
    }

    // every requires all entries to pass the check; an empty list gives true.
    const allHome = living.every((unit) => {
      const destination = this.waveReturnTargets.get(unit.id);

      // Math.hypot calculates straight-line length from the x/y differences: square each,
      // add them, then take the square root.
      return destination && (this.waveReturnSettled.has(unit.id)
        || Math.hypot(unit.arenaX - destination.x, unit.arenaY - destination.y) <= 6);
    });

    if (!allHome && time - this.waveReturnStartedAt < 10000) {
      this.waveReturnReadyAt = null;
      return;
    }

    if (!allHome) this.waveReturnTimedOut = true;

    // Start a three-second rest only once after the party settles or times out. This is an
    // absolute combat timestamp. The reward text stays visible through that rest before
    // the next wave or camp transition.
    this.waveReturnReadyAt ??= time + 3000;
    if (time < this.waveReturnReadyAt) return;
    this.waveRewardText?.destroy();
    this.waveRewardText = null;
    this.waveRetreating = false;

    if (isOrdinaryDelve() && GameState.run.entry === 'farm' && !this.farmStopRequested && living.length > 0) {

      // Math.max chooses the largest value; pairing it with Math.min can keep a result
      // inside both a lower and an upper bound.
      this.startWave(Math.max(0, this.bossWaveIndex - 1));
    } else if (isOrdinaryDelve() && (GameState.run.entry === 'farm'
      || this.currentWaveIndex + 1 === this.bossWaveIndex)) {
      this.showDelveCamp();
    } else if (this.currentWaveIndex + 1 >= this.waves.length) this.finishVictory();
    else this.startWave(this.currentWaveIndex + 1);
  }

  // Keep the camp choices on the battlefield at the saved pre-boss checkpoint.
  showDelveCamp() {
    this.waveTransitioning = true;
    this.waveRetreating = false;
    GameState.run.entry = 'camp';
    this.farmStopRequested = false;
    this.refreshFarmControls();
    GameState.currentRoom = this.bossWaveIndex;
    this.clearBattleMessage();

    const delve = GameState.currentDelve;
    if (this.idleSimulating) return;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const values = FARM_REWARDS[delve.difficulty] ?? FARM_REWARDS.Easy;

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    const farmIndex = Math.max(0, this.bossWaveIndex - 1);

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    this.encounterStatusText.setText('CAMP CHECKPOINT');
    this.encounterTimerText.setText('Rewards saved');
    const overlay = [];

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. This gives the display object an input hit area. Visible
    // artwork alone does not make an object respond to a tap.
    const blocker = this.add.rectangle(width / 2, height / 2, width, height, 0, 0.001).setInteractive().setDepth(11999);

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    blocker.on('pointerdown', (pointer, x, y, event) => event?.stopPropagation?.());
    overlay.push(blocker);

    // Keep the top at y=222 and extend the lower frame to y=822. The extra 32 pixels leave
    // room below the four reward lines while staying above the party HUD.
    overlay.push(addStonePanel(this, width / 2, 522, 1700, 600, 12000));
    const headingWindow = addStonePanel(this, width / 2, 312, 1558, 156, 12001);
    headingWindow.name = 'delve-camp-heading-window';
    overlay.push(headingWindow);
    overlay.push(addStoneOrnaments(this, width / 2, 274, 1630, this.stoneTheme, 12002));

    overlay.push(stoneText(this, width / 2, 282, 'DELVE CAMP', UI_FONT_SIZES.display62, 12002));
    overlay.push(stoneText(this, width / 2, 346, 'Rewards and checkpoint saved.', UI_FONT_SIZES.body32, 12002,
      { color: STONE.muted }));

    // Build one of the three camp choices. index selects its column and icon. The action
    // is a callback saved for a valid release, so merely drawing the card cannot start
    // farming or enter the boss wave.
    const choice = (index, title, detail, action, color) => {

      // width comes from this.scale, our logical canvas. Subtracting 1 from index places
      // columns at -528, 0 and +528 around the canvas center. Each card is 502 pixels
      // wide, leaving 26 pixels between neighboring cards.
      const x = width / 2 + (index - 1) * 528;

      // The card is centered at y=599 with height 386, so its top is 406 and bottom is
      // 792. This preserves its top while making room below the four reward lines. Depth
      // 12001 puts it above the outer panel; color chooses the action tint.
      const button = addStoneButton(this, x, 599, 502, 386, 12001, color);

      // The icon sits in the upper part of the card at y=482. index crops the matching
      // town/farm/boss icon from the shared sheet. Depth 12003 draws it over the card
      // without changing the fixed card touch target.
      const symbol = campStoneIcon(this, x, 482, index, 12003);

      // The title shares the card's center x and sits at y=601 below the icon. body36 is
      // the central 36-pixel logical text size. The description uses the title's measured
      // bottom, so extra reward lines cannot grow into it.
      const titleText = stoneText(this, x, 601, title, UI_FONT_SIZES.body36, 12003);

      // The button runs from y=406 to y=792 in our 2400 x 1080 game canvas. stoneText
      // normally centers a whole paragraph around y, so extra lines grow upward. Start the
      // description below the title's measured bottom instead. The 12-pixel gap separates
      // the two, and origin (0.5, 0) centers x while pinning y to the first line. The
      // 422-pixel wrap width leaves 40 pixels of breathing room on each card edge.
      const detailTop = titleText.getBounds().bottom + 12;

      // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
      // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the
      // object's corner. The condition before ? chooses the first value when true and the
      // value after : when false.
      const detailText = stoneText(this, x, detailTop, detail, UI_FONT_SIZES.support29, 12003,
        { align: 'center', color: index === 1 ? '#f5d788' : STONE.muted, wordWrap: { width: 422 } })
        .setOrigin(0.5, 0);
      overlay.push(button, symbol, titleText, detailText);
      bindButtonPress(this, button, [symbol, titleText, detailText], () => {
        HapticsService.confirm();
        overlay.forEach(object => object.destroy());
        action();
      });
    };

    choice(0, 'RETURN TO TOWN', 'Keep all banked rewards', () => {
      GameState.activeParty = [];

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. The condition before ? chooses the first value when true and the value
      // after : when false.
      const townId = delve.returnTownId ?? (delve.requiresLocation === 'duskfall' ? 'duskfall' : 'pineshire');
      GameState.world.currentLocation = townId;
      saveProfile();
      this.scene.start('TownScene', { townId });
    }, 0x1f2937);

    // bossWaveIndex is zero-based. Its numeric value is also the one-based number of the
    // preceding farm wave. FARM_REWARDS supplies the shown Gold and each
    // living adventurer's XP/Happiness.
    choice(1, `FARM WAVE ${this.bossWaveIndex}`,
      `${values.gold} Gold + Material chances\n${values.xp} XP + ${values.happiness} Happiness\nper living adventurer\nRepeats until cancelled`, () => {
        GameState.run.entry = 'farm';
        this.startWave(farmIndex);
      }, 0x50432e);

    choice(2, 'FACE THE BOSS', 'Boss rewards and Delve completion', () => {
      GameState.run.entry = 'boss';
      this.startWave(this.bossWaveIndex);
    }, 0x633328);
  }

  // Build held potion details from the equipped pack definition and its remaining charges.
  // unit is the live combatant, with current resources and arena position.
  potionDetails(unit) {

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const hero = GameState.roster.find((entry) => entry.id === unit.id);
    const item = hero && equippedItem(hero, 'potion', GameState);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const definition = getPotionDefinition(item?.itemId);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    return definition ? { title: definition.name, description: `${definition.description} ${item.charges}/${definition.uses} uses remain. Tap POTION to use it on ${unit.name}.` }
      : { title: 'Potion', description: 'Equip a potion pack on this adventurer at the Adventurer\'s Hall.' };
  }

  // Check battle state, living owner, charge availability, use delay and missing resource.
  // unit is the live combatant, with current resources and arena position. time is a
  // timestamp on the gameplay clock in milliseconds, not a duration.
  canUsePotion(unit, time = this.time.now) {
    if (this.battleOver || this.combatPaused || this.waveTransitioning || !this.partyUnits.includes(unit) || !unit.alive) return false;

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const hero = GameState.roster.find((entry) => entry.id === unit.id);
    const item = hero && equippedItem(hero, 'potion', GameState);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const definition = getPotionDefinition(item?.itemId);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    if (!definition || time - (this.lastPotionUseAt?.get(unit.id) ?? -Infinity) < 1500) return false;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    return definition.effect.resource === 'hp' ? unit.hp < unit.maxHp
      : definition.effect.resource === 'mana' && unit.maxMana > 0 && unit.mana < unit.maxMana;
  }

  // Restore the actual missing resource, consume one charge and bank the action. unit is
  // the live combatant, with current resources and arena position. time is a timestamp on
  // the gameplay clock in milliseconds, not a duration.
  usePotion(unit, time = this.time.now) {
    if (!this.canUsePotion(unit, time)) return false;

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const hero = GameState.roster.find((entry) => entry.id === unit.id);
    const item = equippedItem(hero, 'potion', GameState);
    const definition = getPotionDefinition(item.itemId);
    const resource = definition.effect.resource;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const maximum = resource === 'hp' ? unit.maxHp : unit.maxMana;
    const before = resource === 'hp' ? unit.hp : unit.mana;

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    const restored = Math.max(1, Math.round(maximum * definition.effect.fraction));
    if (resource === 'hp') unit.heal(restored);
    else unit.mana = Math.min(unit.maxMana, unit.mana + restored);
    const amount = Math.round((resource === 'hp' ? unit.hp : unit.mana) - before);
    consumePotionCharge(hero.id, GameState);

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone. A Map pairs a key with a value. Unlike an array index, the key can be
    // an ID or an object; get/set read and write that same key.
    this.lastPotionUseAt ??= new Map();
    this.lastPotionUseAt.set(unit.id, time);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    unit.flash?.(0x86efac);
    this.createFloatingText(unit.x, unit.y - 100, `+${amount} ${resource === 'hp' ? 'HP' : 'MANA'}`, '#86efac', true);
    this.showBattleMessage(`${unit.name} uses ${definition.name}`, '#86efac');
    this.combatLog?.add('item', `${unit.name} restored ${amount} ${resource === 'hp' ? 'HP' : 'mana'} with ${definition.name}`, { target: unit.name, amount, resource });
    HapticsService.confirm();
    saveProfile();
    this.updateHud();

    return true;
  }

  // Refresh each party card's potion state from its equipped owned pack.
  updatePotionHud() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.partyHud?.forEach(({ unit, potionButton, potionLabel }) => {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const hero = GameState.roster.find((entry) => entry.id === unit.id);
      const item = hero && equippedItem(hero, 'potion', GameState);

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      const definition = getPotionDefinition(item?.itemId);
      const available = Boolean(definition);
      const ready = available && this.canUsePotion(unit);

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      potionButton?.setVisible(available).setFillStyle(ready ? 0x14532d : 0x292524);
      if (potionButton?.input) potionButton.input.enabled = available;
      potionLabel?.setVisible(available).setAlpha(ready ? 1 : 0.55).setText(available ? `POTION\n${item.charges}/${definition.uses}` : '');
    });
  }

  // Restore final battle presentation and summarize the actual gains and casualties from
  // catch-up.
  onCatchUpSettled() {
    if (!this.sys.isActive()) return;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (this.game.backgroundProgress?.hidden) {

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      if (Date.now() - (this.lastIdleSaveAt ?? 0) >= 2000) {
        this.lastIdleSaveAt = Date.now();
        saveProfile();
      }

      return;
    }

    resumeIdleBattle(this);
    this.partyUnits?.forEach(unit => unit.syncPresentation());
    this.enemies?.forEach(enemy => enemy.updateDeathPresentation?.(0));
    this.partyUnits?.forEach(unit => unit.spriteVisual?.update(0));
    this.enemies?.forEach(enemy => enemy.spriteVisual?.update(0));
    this.updateHud();
    this.combatLog?.persist();

    saveProfile();
    this.onForeground();
  }

  // Let the background service advance real battle gameplay by the requested missed time.
  // durationMs is a duration in milliseconds, rather than an absolute clock time.
  advanceIdleProgress(durationMs, budgetNow) {
    return advanceIdleBattle(this, durationMs, budgetNow);
  }

  // Refresh the visible battle when the host returns to the foreground.
  onForeground() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (this.game.backgroundProgress?.hidden || this.restoringBattle
      || this.game.backgroundProgress?.pendingMs >= 50) return;
    resumeIdleBattle(this);
    this.showIdleSummary();
  }

  // Keep idle rewards and casualties visible until the player has read the return summary.
  showIdleSummary() {
    const summary = this.idleSummary;
    if (this.idleSummaryOpen || !summary || (!summary.waves && !summary.deaths.length)) return;
    this.idleSummaryOpen = true;

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone.
    this.idleSummaryResumePaused ??= this.combatPaused;
    this.combatPaused = true;
    this.time.paused = true;

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;

    // The condition before ? chooses the first value when true and the value after : when
    // false. ?. only follows this link when the value exists; a missing optional value
    // gives undefined. flatMap builds callback results and flattens one array level.
    // Returning [] removes an entry; returning [value] keeps one result.
    const casualtyLines = summary.casualties?.length ? summary.casualties.slice(-5).flatMap(death => [
      `${death.name} - Wave ${death.wave}, ${formatDuration(death.time * 1000)}`,
      `${death.actor ?? 'Unknown attacker'}: ${death.ability ?? 'Unknown ability'}`
    ]) : summary.deaths.length ? [`Died: ${summary.deaths.join(', ')}`, 'Details unavailable for these earlier idle deaths.']
      : [];
    const lines = idleRewardLines(summary, GameState.activeParty,
      id => getMaterialDefinition(id)?.name ?? id);

    // Measure the readable text first so short reports do not need a screen-wide panel.
    // These dimensions are logical canvas pixels, before scaling to the phone display.

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner. Both text objects use their left edges so the bullets line up with the W.
    const title = stoneText(this, 0, 0, 'While you were away:', UI_FONT_SIZES.heading46, 13002)
      .setOrigin(0, 0).setName('idle-summary-title');
    const text = this.add.text(0, 0, lines.join('\n'), {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body30'), color: '#f5f5dc',
      align: 'left', lineSpacing: 8, wordWrap: { width: Math.min(1040, width - 200) }
    }).setOrigin(0, 0).setDepth(13002).setName('idle-summary-text');
    const buttonHeight = 80;
    const continueWidth = 300;
    const deathWidth = 360;
    const buttonGap = 24;
    const buttonsWidth = casualtyLines.length ? continueWidth + buttonGap + deathWidth : continueWidth;
    const contentWidth = Math.max(title.width, text.width, buttonsWidth);
    const panelWidth = contentWidth + 84;

    // Reserve top/bottom padding, the heading, and the button row. Only unusually long
    // reward lists scroll; their reading size stays the same.
    // The 64 is 32 pixels of padding at each edge; 20 and 24 are the gaps between rows.
    const reservedHeight = 64 + title.height + 20 + 24 + buttonHeight;

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const panelHeight = Math.min(height - 100, reservedHeight + text.height);
    const centerY = height / 2;
    const top = centerY - panelHeight / 2;
    const contentLeft = (width - contentWidth) / 2;
    title.setPosition(contentLeft, top + 32);
    text.setPosition(contentLeft, title.y + title.height + 20);

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap. Depth is drawing order, not distance or size.
    // Higher-depth objects draw on top of lower-depth objects.
    const blocker = this.add.rectangle(width / 2, centerY, width, height, 0x000000, 0.65)
      .setDepth(13000).setInteractive();

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    blocker.on('pointerdown', (pointer, x, y, event) => event?.stopPropagation?.());
    const panel = addStonePanel(this, width / 2, centerY, panelWidth, panelHeight, 13001)
      .setName('idle-summary-panel');
    const bodyHeight = panelHeight - reservedHeight;
    let bodyScroll = null;
    if (text.height > bodyHeight) {
      bodyScroll = hallScroll(this, { x: contentLeft, y: text.y, width: contentWidth, height: bodyHeight },
        [text], text.height, 0, () => {},
        (scene, x, y, w, h) => addStonePanel(scene, x, y, w, h, 13002),
        () => Boolean(this.selectionDetailsClose));
      bodyScroll.container.setDepth(13002);
    }

    // Center the compact button row inside the panel, including space for death details.
    const buttonY = top + panelHeight - 32 - buttonHeight / 2;
    const continueX = casualtyLines.length ? (width - buttonsWidth + continueWidth) / 2 : width / 2;
    const button = addStoneButton(this, continueX, buttonY, continueWidth, buttonHeight, 13002)
      .setName('idle-summary-continue');

    const label = stoneText(this, continueX, buttonY, 'CONTINUE', UI_FONT_SIZES.heading38, 13003);
    const deathViews = [];
    if (casualtyLines.length) {
      const deathX = continueX + continueWidth / 2 + buttonGap + deathWidth / 2;
      const deathButton = addStoneButton(this, deathX, buttonY, deathWidth, buttonHeight, 13002)
        .setName('idle-summary-death-details');
      const deathLabel = stoneText(this, deathX, buttonY, 'DEATH DETAILS', UI_FONT_SIZES.heading38, 13003);
      deathViews.push(deathButton, deathLabel);
      bindButtonPress(this, deathButton, [deathLabel], () => showSelectionDetails(this, {
        title: 'Death details', description: casualtyLines.join('\n'), align: 'left',
        panelWidth: width * 0.72, depth: 14000
      }));
    }

    bindButtonPress(this, button, [label], () => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      this.selectionDetailsClose?.();

      // Destroying the scroll container also removes its mask and input listeners.
      bodyScroll?.destroy();

      // ... expands these entries into the new list or call. It does not deep-copy the
      // objects inside.
      for (const object of [blocker, panel, title, text, button, label, ...deathViews]) object.destroy();
      this.idleSummaryOpen = false;
      this.idleSummary = null;
      this.combatPaused = this.idleSummaryResumePaused;
      this.time.paused = this.combatPaused;
      this.idleSummaryResumePaused = undefined;
      resumeIdleBattle(this);

      saveProfile();
    });

    saveProfile();
  }

  // This helper refreshes party resources and encounter progress as combat changes.
  updateHud() {

    this.refreshPartySelection();
    this.updateLeaderLoadoutBar();
    this.updatePotionHud();

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.partyHud?.forEach(({ unit, hpText, manaText, threatText, hpFill, hpGlow, manaBack, manaFill, hudBarWidth }) => {

      // The condition before ? chooses the first value when true and the value after :
      // when false. Clamp keeps the first argument between the lower bound (second
      // argument) and upper bound (third argument).
      const ratio = unit.maxHp > 0 ? Phaser.Math.Clamp(unit.hp / unit.maxHp, 0, 1) : 0;
      const manaRatio = unit.maxMana > 0 ? Phaser.Math.Clamp(unit.mana / unit.maxMana, 0, 1) : 0;
      const healthColor = this.getHealthBarColor(ratio);

      // Math.ceil rounds upward to the next integer, including when the value has a
      // fractional part.
      hpText.setText(unit.alive ? `${Math.ceil(unit.hp)} / ${unit.maxHp}` : 'DOWN');
      threatText.setText(unit.alive ? `Threat ${Math.round(this.getCombinedThreat(unit))}` : '');
      hpFill.setDisplaySize(hudBarWidth * ratio, 32);
      hpFill.setFillStyle(healthColor);
      hpFill.setVisible(unit.alive && ratio > 0);
      hpGlow.setStrokeStyle(5, healthColor, 0);

      if (unit.maxMana > 0) {
        manaBack.setVisible(true);
        manaFill.setVisible(unit.alive && manaRatio > 0);
        manaFill.setDisplaySize(hudBarWidth * manaRatio, 32);

        // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
        manaText.setVisible(true).setText(unit.alive ? `${Math.floor(unit.mana)} / ${unit.maxMana}` : '');
      } else {
        manaBack.setVisible(false);
        manaFill.setVisible(false);
        manaText.setVisible(false);
      }
    });

    this.updateEncounterStatus();
  }

  // This helper uses warmer health colors to make injured allies easier to spot.
  getHealthBarColor(ratio) {

    if (ratio <= 0.25) return 0xef4444;
    if (ratio <= 0.5) return 0xf97316;
    if (ratio <= 0.75) return 0xeab308;

    return 0x22c55e;
  }

  // Show the run timer with the wave number or the boss name.
  updateEncounterStatus() {

    if (!this.encounterStatusText || this.currentWaveIndex < 0) return;
    const elapsed = formatDuration(Date.now() - (GameState.run.startedAt || Date.now()));

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const wave = this.waves?.[this.currentWaveIndex];
    const camp = GameState.run.entry === 'camp';

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.encounterStatusText.setText(camp ? 'CAMP CHECKPOINT' : `WAVE ${this.currentWaveIndex + 1} / ${this.waves.length}`);
    this.encounterTimerText.setText(camp ? 'Rewards saved' : `${elapsed}${wave?.boss ? ' • BOSS' : ''}`);
  }

  // This helper draws attention to the party member taking enemy damage.
  flashPartyHudName(unit) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. find returns the first matching entry, or undefined when none matches.
    // Check for that missing result before using its fields.
    const entry = this.partyHud?.find((item) => item.unit === unit);
    if (!entry?.nameText) return;

    this.tweens.killTweensOf(entry.nameText);
    entry.nameText.setAlpha(1).setColor('#fca5a5');
    this.tweens.add({
      targets: entry.nameText,
      alpha: 0.3,
      duration: 90,
      yoyo: true,
      repeat: 2,

      // Finish this animation's remaining work when the tween reaches its end.
      onComplete: () => {

        // ?. only follows this link when the value exists; a missing optional value gives
        // undefined.
        if (entry.nameText?.active) entry.nameText.setAlpha(1).setColor('#f5f5f4');
      }
    });
  }

  // This helper commits the victory rewards and leads the player to the reward screen.
  finishVictory() {

    if (this.battleOver) {
      return;
    }
    this.battleOver = true;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.combatLog?.finish('victory');

    // Commit encounter gold and progression before showing the button that opens the
    // reward screen.
    const gold = Math.max(1, this.earnedGold);
    GameState.gold += gold;
    GameState.currentRoom = this.waves.length;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    GameState.rewards = [{ type: 'gold', amount: gold, source: GameState.currentDelve?.name ?? 'Delve' }];
    if (this.idleSimulating) {
      this.idleSummary.gold += gold;
      this.idleSummary.xp += 35;
    }
    const summary = completeExpedition();
    saveProfile();

    this.showResultOverlay('DELVE CLEARED!', `${GameState.currentDelve?.name ?? 'The Delve'} has been cleared.`, 'CONFIRM', () => {

      HapticsService.confirm();
      this.scene.start('RewardScene');
    });
  }

  // This helper records the loss and offers the encounter summary.
  finishDefeat() {

    if (this.battleOver) return;
    this.battleOver = true;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.combatLog?.finish('defeat');
    failExpedition();
    this.showResultOverlay('DEFEATED', 'The party was driven back.', 'CONFIRM', () => {

      HapticsService.confirm();
      this.scene.start('EncounterSummaryScene');
    });
  }

  // This helper pauses or resumes combat updates and the scene clock.
  togglePause() {

    if (this.battleOver) return;
    this.combatPaused = !this.combatPaused;
    this.time.paused = this.combatPaused;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. The condition before ? chooses the first value when true and the value
    // after : when false.
    this.pauseButtonText?.setText(this.combatPaused ? 'RESUME' : 'PAUSE');
    this.pauseButton?.setFillStyle(this.combatPaused ? 0x3b321d : 0x1f2937);
    this.showBattleMessage(this.combatPaused ? 'PAUSED' : 'RESUMED', this.combatPaused ? '#fbbf24' : '#bef264');

    if (!this.combatPaused) this.flushPausedTactics();
    HapticsService.tap();
  }

  // This helper ends combat as a retreat and sends the player to its summary.
  fleeBattle() {

    if (this.battleOver) return;
    if (this.combatPaused) {
      this.combatPaused = false;
      this.time.paused = false;
    }
    this.battleOver = true;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.combatLog?.finish('fled');
    fleeExpedition();
    this.scene.start('EncounterSummaryScene');
  }

  // This helper presents the encounter outcome and blocks further battlefield taps.
  showResultOverlay(title, subtitle, buttonLabel, callback) {
    this.refreshFarmControls();

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    const centerY = height * 0.5;
    const victory = title === 'DELVE CLEARED!';

    // Place an invisible input blocker behind the result panel so taps cannot reach the
    // battlefield.
    const inputBlocker = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.001)
      .setInteractive()
      .setDepth(11999);

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    inputBlocker.on('pointerdown', (pointer, localX, localY, event) => event?.stopPropagation?.());

    addStonePanel(this, width / 2, centerY, width * 0.78, 390, 12000);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. Origin is the anchor within the object: 0 is the left/top edge,
    // 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
    // necessarily the object's corner. The condition before ? chooses the first value when
    // true and the value after : when false.
    this.add.text(width / 2, centerY - 95, title, {
      fontFamily: UI_FONT_FAMILIES.sans,
      fontSize: fontPx('display78'),
      fontStyle: UI_FONT_WEIGHTS.bold,
      color: victory ? '#bef264' : '#ef4444'
    }).setOrigin(0.5).setDepth(12001);

    this.add.text(width / 2, centerY - 22, subtitle, {
      fontFamily: UI_FONT_FAMILIES.sans,
      fontSize: fontPx('body36'),
      color: '#d6d3d1'
    }).setOrigin(0.5).setDepth(12001);

    const button = addStoneButton(this, width / 2, centerY + 90, width * 0.58, 96, 12001);

    const buttonText = this.add.text(width / 2, centerY + 90, buttonLabel, {
      fontFamily: UI_FONT_FAMILIES.sans,
      fontSize: fontPx('heading38'),
      fontStyle: UI_FONT_WEIGHTS.bold,
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(12002);

    bindButtonPress(this, button, [buttonText], callback);
    button.on('pointerover', () => button.setFillStyle(0x57534e));
    button.on('pointerout', () => button.setFillStyle(0x44403c));
  }
}
