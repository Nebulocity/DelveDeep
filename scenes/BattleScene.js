import { preloadSlimeSprites } from '../data/slimeSprites.js';
import { chooseWaveLandings } from '../combat/WaveLanding.js';
import { bindSelectionDetails, characterDetails } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import ClassAbilitySystem from '../combat/ClassAbilitySystem.js';
import { preloadCharacterSprites } from '../data/characterSprites.js';
import { preloadEnemySprites } from '../data/enemySprites.js';
import GameState from '../game/GameState.js';
import { getEquippedAdventurer, equippedItem, consumePotionCharge } from '../game/Equipment.js';
import { getPotionDefinition } from '../data/items.js';
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
import combatSpacing from '../config/combatSpacing.js';
import CombatLog from '../combat/CombatLog.js';
import HapticsService from '../services/HapticsService.js';
import { completeExpedition, failExpedition, fleeExpedition, formatDuration } from '../game/ExpeditionProgression.js';
import { saveProfile } from '../game/GameStorage.js';
import { awardOrdinaryWave, getDelveCheckpoint, isOrdinaryDelve, WAVE_REWARDS } from '../game/DelveCheckpoints.js';
import { getBattleLayout } from '../ui/Layout.js';
import { preloadEnvironment, createEnvironment, getDelveGridFloor } from '../combat/LayeredEnvironment.js';
import { trackLoading, hideLoadingScreenAfterRender } from '../ui/LoadingScreen.js';

export default class BattleScene extends Phaser.Scene {

  // This function registers BattleScene so the game can navigate to this
  // screen.
  constructor() {

    super('BattleScene');
  }

  // Encounter visual data supplies only the assets needed by the selected
  // delve. Other delves retain the existing battlefield presentation.
  preload() {
    trackLoading(this);
    preloadCharacterSprites(this);
    preloadEnemySprites(this);
    preloadSlimeSprites(this);

    const environment = GameState.currentDelve?.visuals?.environment;
    if (environment) preloadEnvironment(this, environment);
    const background = GameState.currentDelve?.visuals?.battlefieldBackground;
    if (background?.key && background?.url && !this.textures.exists(background.key)) {
      this.load.image(background.key, background.url);
    }
  }

  // This function starts a new battle by resetting encounter state, creating
  // the perspective arena and combatants, and building the tactical controls.
  // It also starts the combat log and announces the first enemy wave.
  create() {
    this.classAbilitySystem = new ClassAbilitySystem(this);

    const { width, height } = this.scale;

    // Reset encounter flags, selections, movement orders, threat tables, and
    // leader cooldowns for a fresh battle.
    this.battleOver = false;
    this.waveTransitioning = false;
    this.waveRetreating = false;
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
    this.gridCells = [];
    this.leaderAbilityCooldowns = new Map();
    this.assaultUntil = 0;
    this.braceUntil = 0;
    this.usedLeaderAbilities = new Set();
    this.pendingPausedTactics = [];
    this.awaitingRevive = false;
    this.battleLayout = getBattleLayout(width, height);
    this.combatPaused = false;

    // Define the logical combat area and the screen-space perspective used to
    // display its grid and units.
    this.battlefield = new BattlefieldGeometry(this, {
      bottomLeftX: 310,
      bottomRightX: width - 310,
      topLeftX: width * 0.27,
      topRightX: width * 0.73,
      bottomY: height * 0.775,
      topY: this.battleLayout.arenaTop,
      logicalWidth: 1750,
      logicalHeight: 900,
      columns: 10,
      rows: 6,
      nearScale: 1.05,
      farScale: 0.74,
      ...getDelveGridFloor(width, height)
    });

    // Create the formation controller and copy the appropriate encounter wave
    // definitions.
    this.terrain = new BattlefieldTerrain(this, this.battlefield, GameState.currentDelve?.terrain ?? []);

    // Uncomment this while authoring terrain to see blocked polygons over the art.
    this.terrainDebug = null;

    this.tactics = new TacticsController(this.battlefield, GameState.tactics);
    this.movement = new CombatMovement(this);
    this.waves = this.buildEncounterWaves();

    // Build the battlefield interface, register the combat log, and start the
    // first wave.
    this.cameras.main.setBackgroundColor('#09080a');
    this.createHeader(width);
    this.createArena(width, height);
    this.createParty();
    this.combatLog = new CombatLog(GameState.currentDelve?.name ?? 'The Delve', this.partyUnits);
    this.createGridInteraction();
    this.createTacticsMenus(width, height);
    this.createLeaderLoadoutBar(width);
    this.createHud(width, height);
    this.createTerrainEditorButton(width);
    this.bossWaveIndex = Math.max(0, this.waves.findIndex((wave) => wave.boss));
    const checkpoint = getDelveCheckpoint(GameState.currentDelve, this.bossWaveIndex);
    const entry = GameState.run.entry;
    if (entry === 'camp' && checkpoint?.campUnlocked) this.showDelveCamp();
    else this.startWave(entry === 'boss' ? this.bossWaveIndex
      : entry === 'farm' ? this.bossWaveIndex - 1 : checkpoint?.nextWave ?? 0);
    hideLoadingScreenAfterRender(this);
  }


  // This function adds a developer button for authoring blocked battlefield terrain.
  createTerrainEditorButton(width) {

    this.terrainEditor = new BattlefieldTerrainEditor(this, this.battlefield, this.terrain);
    this.terrainEditorButton = this.add.rectangle(width - 125, 34, 220, 48, 0x292524)
      .setStrokeStyle(2, 0xfacc15).setInteractive({ useHandCursor: true }).setDepth(11000);
    this.terrainEditorButtonLabel = this.add.text(width - 125, 34, 'EDIT TERRAIN', {
      fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#facc15'
    }).setOrigin(0.5).setDepth(11001);
    this.terrainEditorButton.on('pointerdown', (pointer, localX, localY, event) => {
      event?.stopPropagation?.();
      this.terrainEditor.open();
    });
  }

  // This function chooses the encounter waves and adds the depth milestone
  // guardian.
  buildEncounterWaves() {

    const waves = createEncounterWaves(GameState.currentDelve ?? {}, this.battlefield.logicalWidth);

    if (GameState.currentDelve) GameState.currentDelve.rooms = waves.length;
    return waves;
  }

  // This function shows the delve title, tactical guidance, and encounter
  // status.
  createHeader(width) {

    this.add.text(width / 2, this.battleLayout.titleY, GameState.currentDelve?.name ?? 'THE DELVE', {
      fontFamily: 'Arial',
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#f5f5f4'
    }).setOrigin(0.5).setDepth(4501);

    this.battleMessageText = this.add.text(width / 2, this.battleLayout.messageY, '', {
      fontFamily: 'Arial',
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#d6a85f',
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(5000);

    this.encounterStatusText = this.add.text(width / 2, this.battleLayout.statusY, '', {
      fontFamily: 'Arial',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#fb923c'
    }).setOrigin(0.5).setDepth(4501);
  }

  // This function draws the battlefield beneath its units and tactical
  // controls.
  createArena(width, height) {

    const environment = GameState.currentDelve?.visuals?.environment;
    if (environment) {
      this.battlefieldVisualLayers = createEnvironment(this, environment);
      this.battlefield.drawPerspectiveFloor(GameState.development.showGridLines !== false);
      return;
    }
    const background = GameState.currentDelve?.visuals?.battlefieldBackground;
    let staticBackground = null;
    if (background?.key && this.textures.exists(background.key)) {
      staticBackground = this.add.image(width / 2, height / 2, background.key).setDepth(-1000);
      // Cover the complete game viewport without stretching the artwork.
      const scale = Math.max(width / staticBackground.width, height / staticBackground.height);
      staticBackground.setScale(scale);
    }

    // Future cave water, fog, scenery, and ambient effects can be inserted
    // here: above the static backdrop but below combat units and HUD layers.
    this.battlefieldVisualLayers = {
      staticBackground,
      scenery: this.add.container(0, 0).setDepth(90)
    };
    this.battlefield.drawPerspectiveFloor(GameState.development.showGridLines !== false);
  }


  // This function brings the chosen adventurers into combat and binds unit
  // selection.
  createParty() {

    const party = GameState.activeParty.length > 0
      ? GameState.activeParty
      : GameState.roster.slice(0, 5);

    this.partyUnits = party.map((adventurer) => {
      const hero = getEquippedAdventurer(GameState.roster.find((entry) => entry.id === adventurer.id) ?? adventurer);
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

      unit.hitZone.setInteractive({ useHandCursor: true });
      unit.hitZone.on('pointerdown', (pointer, localX, localY, event) => {

        event?.stopPropagation?.();
        this.toggleUnitSelection(unit);
      });
      bindSelectionDetails(this, unit.hitZone, () => characterDetails(unit));
    });

    this.tank = this.partyUnits.find((unit) => unit.role === 'Tank') ?? this.partyUnits[0];
    this.healer = this.partyUnits.find((unit) => unit.role === 'Healer');
  }

  // This function builds the bottom party panels with names, classes, health,
  // and mana for mana users. It stores references to the changing labels and
  // bars so updateHud can refresh them during combat.
  createHud(width, height) {

    const hudTop = height * 0.78;
    this.add.rectangle(width / 2, (hudTop + height) / 2, width, height - hudTop, 0x0c0a09).setDepth(4500);
    this.partyHud = [];

    // Divide the space below the battlefield into five party panels.
    const usableWidth = width - 104;
    const sectionWidth = usableWidth / 5;
    const hudBarWidth = sectionWidth - 175;
    const startX = 52 + 70;
    this.partyUnits.forEach((unit, index) => {

      const x = startX + index * sectionWidth;
      // Give the whole portrait/name/class area one generous touch target.
      const statusHitZone = this.add.rectangle(x + sectionWidth / 2 - 6, hudTop + 70, sectionWidth - 20, 116, 0xffffff, 0.001)
        .setDepth(4500);
      bindSelectionDetails(this, statusHitZone, () => characterDetails(unit), () => this.toggleUnitSelection(unit));
      const portrait = this.add.circle(x, hudTop + 72, 36, unit.color).setDepth(4501);
      bindSelectionDetails(this, portrait, () => characterDetails(unit), () => this.toggleUnitSelection(unit));
      const potionButton = this.add.rectangle(x, hudTop + 155, 130, 72, 0x14532d)
        .setStrokeStyle(2, 0x86efac).setDepth(4502);
      const potionLabel = this.add.text(x, hudTop + 155, 'POTION', {
        fontFamily: 'Arial', fontSize: '23px', fontStyle: 'bold', color: '#ffffff', align: 'center'
      }).setOrigin(0.5).setDepth(4503);
      bindSelectionDetails(this, potionButton, () => this.potionDetails(unit), () => this.usePotion(unit));
      const nameText = this.add.text(x + 85, hudTop + 38, unit.name, {
        fontFamily:'Arial', fontSize:'39px', fontStyle:'bold', color:'#f5f5f4'
      }).setOrigin(0,0.5).setDepth(4501);
      this.add.text(x + 85, hudTop + 73, unit.shortName ?? unit.className, {
        fontFamily:'Arial', fontSize:'30px', color:'#cbd5e1'
      }).setOrigin(0,0.5).setDepth(4501);

      const hudBarX = x + 85;
      const hudBarY = hudTop + 108;

      // Create the health bar objects that updateHud will resize and recolor.
      const hpGlow = this.add.rectangle(hudBarX - 4, hudBarY, hudBarWidth + 8, 24, 0x000000, 0)
        .setOrigin(0, 0.5)
        .setStrokeStyle(5, 0xf97316, 0)
        .setDepth(4501);
      const hpBack = this.add.rectangle(hudBarX, hudBarY, hudBarWidth, 16, 0x1c1917)
        .setOrigin(0, 0.5)
        .setDepth(4501);
      const hpFill = this.add.rectangle(hudBarX, hudBarY, hudBarWidth, 16, 0x22c55e)
        .setOrigin(0, 0.5)
        .setDepth(4502);

      // Show mana only for units with a mana pool; keep it in the bottom HUD.
      const manaBarY = hudTop + 132;
      const manaBack = this.add.rectangle(hudBarX, manaBarY, hudBarWidth, 12, 0x111827)
        .setOrigin(0, 0.5)
        .setDepth(4501)
        .setVisible(unit.maxMana > 0);
      const manaFill = this.add.rectangle(hudBarX, manaBarY, hudBarWidth, 12, 0x3b82f6)
        .setOrigin(0, 0.5)
        .setDepth(4502)
        .setVisible(unit.maxMana > 0);
      const hpText=this.add.text(hudBarX,hudTop+158,'',{fontFamily:'Arial',fontSize:'24px',color:'#d6d3d1'}).setOrigin(0,0.5).setDepth(4501);
      const manaText=this.add.text(hudBarX,hudTop+184,'',{fontFamily:'Arial',fontSize:'22px',color:'#93c5fd'})
        .setOrigin(0,0.5)
        .setDepth(4501)
        .setVisible(unit.maxMana > 0);
      const threatText=this.add.text(hudBarX,hudTop+208,'',{fontFamily:'Arial',fontSize:'22px',color:'#a8a29e'})
        .setOrigin(0,0.5)
        .setDepth(4501)
        .setVisible(false);
      bindSelectionDetails(this, nameText, () => characterDetails(unit), () => this.toggleUnitSelection(unit));
      this.partyHud.push({statusHitZone,potionButton,potionLabel,unit,nameText,hpText,manaText,threatText,hpFill,hpGlow,manaBack,manaFill,hudBarWidth});
    });
    this.updatePotionHud();
  }

  // This function makes the perspective tiles usable as touch destinations.
  createGridInteraction() {

    for (let row = 0; row < this.battlefield.rows; row += 1) {
      for (let column = 0; column < this.battlefield.columns; column += 1) {
        const points = this.battlefield.getCellPolygon(column, row);
        const polygon = new Phaser.Geom.Polygon(points);
        const hit = this.add.polygon(0, 0, points, 0x60a5fa, 0.001)
          .setOrigin(0, 0)
          .setDepth(30)
          .setInteractive(polygon, Phaser.Geom.Polygon.Contains);
        hit.on('pointerdown', () => this.handleGridCellTap(column, row));
        this.gridCells.push({ column, row, hit });
      }
    }
  }

  // This function places role selection and tactical orders beside the
  // battlefield.
  createTacticsMenus(width, height) {

    const left = [
      ['ALL', 'All'],
      ['RANGED', 'Ranged DPS'], ['MELEE', 'Melee DPS'], ['HEALERS', 'Healer'], ['TANKS', 'Tank']
    ];
    const right = ['MOVE', 'HOLD', 'SPREAD', 'STACK', 'ATTACK', 'INTERRUPT'];
    const firstY = height * 0.31;
    const gap = 76;
    // Add All above the existing role rows and keep space above the party HUD.
    const leftFirstY = firstY - gap;
    this.roleButtons = [];
    this.commandButtons = [];

    this.add.text(155, leftFirstY - 70, 'SELECT', {fontFamily:'Arial',fontSize:'33px',fontStyle:'bold',color:'#94a3b8'}).setOrigin(0.5);
    left.forEach(([label, role], index) => {

      const y = leftFirstY + index * gap;
      const box = this.add.rectangle(155, y, 250, 68, 0x1f2937).setStrokeStyle(3,0x475569).setInteractive({useHandCursor:true}).setDepth(4600);
      const text = this.add.text(155,y,label,{fontFamily:'Arial',fontSize:'33px',fontStyle:'bold',color:'#e5e7eb'}).setOrigin(0.5).setDepth(4601);
      box.on('pointerdown',()=>this.selectRole(role));
      bindSelectionDetails(this, box, { title: label, description: role === 'All' ? 'Select every living party member, then issue an order.' : `Select all living ${role} adventurers, then issue an order.` });
      this.roleButtons.push({box,text,role});
    });

    const pauseY = leftFirstY + left.length * gap;
    this.pauseButton = this.add.rectangle(155, pauseY, 250, 62, 0x1f2937).setStrokeStyle(3,0x475569).setInteractive({useHandCursor:true}).setDepth(4600);
    this.pauseButtonText = this.add.text(155,pauseY,'PAUSE',{fontFamily:'Arial',fontSize:'31px',fontStyle:'bold',color:'#e5e7eb'}).setOrigin(0.5).setDepth(4601);
    this.pauseButton.on('pointerdown',()=>this.togglePause());

    const fleeY = leftFirstY + (left.length + 1) * gap;
    const fleeButton = this.add.rectangle(155, fleeY, 250, 62, 0x3f1d1d).setStrokeStyle(3,0x991b1b).setInteractive({useHandCursor:true}).setDepth(4600);
    this.add.text(155,fleeY,'FLEE',{fontFamily:'Arial',fontSize:'31px',fontStyle:'bold',color:'#fecaca'}).setOrigin(0.5).setDepth(4601);
    fleeButton.on('pointerdown',()=>this.fleeBattle());

    this.add.text(width-155, firstY - 70, 'ORDERS', {fontFamily:'Arial',fontSize:'33px',fontStyle:'bold',color:'#94a3b8'}).setOrigin(0.5);
    right.forEach((label,index)=>{

      const y=firstY+index*gap;
      const box=this.add.rectangle(width-155,y,270,68,0x1f2937).setStrokeStyle(3,0x475569).setInteractive({useHandCursor:true}).setDepth(4600);
      const text=this.add.text(width-155,y,label,{fontFamily:'Arial',fontSize:label.length>10?'27px':'33px',fontStyle:'bold',color:'#e5e7eb'}).setOrigin(0.5).setDepth(4601);
      box.on('pointerdown',()=>this.armCommand(label));
      const descriptions = {
        MOVE: 'Choose a destination for selected allies. They move there and hold.',
        HOLD: 'Selected allies stay at their positions while acting within range.',
        SPREAD: 'Selected allies spread out around the chosen point to avoid area attacks.',
        STACK: 'Selected allies gather tightly around the chosen point.',
        ATTACK: 'Choose an enemy for selected allies to pursue and attack. Explicitly ordered healers attack until the target dies or the order changes.',
        INTERRUPT: 'Choose a casting enemy. Selected allies with a ready interrupt try to stop its cast.'
      };
      bindSelectionDetails(this, box, { title: label, description: descriptions[label] });
      this.commandButtons.push({box,text,label});
    });
    this.refreshTacticsMenus();
  }

  // This function exposes the equipped leadership abilities above the arena.
  createLeaderLoadoutBar(width) {

    const equipped = (GameState.leader?.battleLoadout ?? ['focusFire']).slice(0, 5);
    const layout = getBattleLayout(width, this.scale.height, equipped.length);
    this.leaderButtons = [];
    this.add.text(width / 2, layout.labelY, 'BATTLE TACTICS', {
      fontFamily: 'Arial', fontSize: '26px', fontStyle: 'bold', color: '#94a3b8'
    }).setOrigin(0.5).setDepth(4700);

    // Each button has a name row and a separate cooldown or usage row.
    // Center the entire group, including loadouts with fewer than five slots.
    equipped.forEach((id, index) => {

      const ability = leaderAbilities.find((entry) => entry.id === id);
      if (!ability) return;
      const x = layout.positions[index];
      const box = this.add.rectangle(x, layout.buttonY, layout.buttonWidth, layout.buttonHeight, 0x292524)
        .setStrokeStyle(3, 0x84cc16).setInteractive({ useHandCursor: true }).setDepth(4700);
      this.add.text(x, layout.buttonY - 17, ability.shortName, {
        fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#bef264'
      }).setOrigin(0.5).setDepth(4701);
      const status = this.add.text(x, layout.buttonY + 20, '', {
        fontFamily: 'Arial', fontSize: '23px', color: '#d6d3d1'
      }).setOrigin(0.5).setDepth(4701);
      box.on('pointerdown', () => this.useLeaderAbility(id));
      bindSelectionDetails(this, box, { title: ability.name, description: ability.description });
      this.leaderButtons.push({ ability, box, status });
    });
    this.updateLeaderLoadoutBar();
  }

  // This function shows readiness, remaining cooldown, and spent one-use
  // tactics without placing extra labels outside their button boundaries.
  updateLeaderLoadoutBar() {

    this.leaderButtons?.forEach(({ ability, box, status }) => {

      const used = ability.oncePerEncounter && this.usedLeaderAbilities.has(ability.id);
      const queued = this.pendingPausedTactics?.includes(ability.id);
      const remaining = Math.max(0, (ability.cooldown ?? 0) - (this.time.now - (this.leaderAbilityCooldowns.get(ability.id) ?? -Infinity)));
      status.setText(queued ? 'QUEUED' : used ? 'USED' : remaining > 0 ? Math.ceil(remaining / 1000) + 's' : ability.oncePerEncounter ? 'ONCE / ENCOUNTER' : 'READY');
      box.setFillStyle(queued || used || remaining > 0 ? 0x1c1917 : 0x292524);
    });
  }

  // This function selects a tapped adventurer or deselects it on a second
  // tap.
  toggleUnitSelection(unit) {

    if (!unit?.alive) return;

    if (this.assignHealerPriority(unit)) return;

    if (this.selectedUnitIds.has(unit.id)) {
      this.selectedUnitIds.delete(unit.id);
      this.commandMode = null;
      this.refreshTacticsMenus();
      this.setTargetingInputState(false);

      const remaining = this.getSelectedUnits();
      if (remaining.length === 0) {
        this.clearBattleMessage();
      } else {
        this.showBattleMessage(`${remaining.length} selected - tap a tile to move or an enemy to attack`, '#93c5fd', true);
      }
    } else {
      this.selectedUnitIds = new Set([unit.id]);
      this.commandMode = null;
      this.refreshTacticsMenus();
      this.setTargetingInputState(false);
      this.showBattleMessage(`${unit.name} - tap a tile to move or an enemy to attack`, '#93c5fd', true);
    }

    HapticsService.tap();
  }

  // A healer-only selection turns a tap on an ally into a healing priority
  // instead of changing selection. The direct order replaces Hold/Attack so
  // the healer can safely move into healing range when necessary.
  assignHealerPriority(target) {
    const selected = this.getSelectedUnits();
    const healers = selected.filter((unit) => unit.role === 'Healer');
    if (healers.length === 0 || healers.length !== selected.length || healers.includes(target)) return false;
    if (target.hp >= target.maxHp) {
      this.showBattleMessage(`${target.name} is already at full health`, '#a8a29e');
      HapticsService.tap();
      return true;
    }
    this.healerPriorityTargets ??= new Map();
    healers.forEach((healer) => {
      this.healerPriorityTargets.set(healer.id, target.id);
      this.manualTargets.delete(healer.id);
      this.attackTargets.delete(healer.id);
      this.heldUnitIds.delete(healer.id);
    });
    this.commandMode = null;
    this.setTargetingInputState(false);
    this.refreshTacticsMenus();
    this.showBattleMessage(`${healers.length === 1 ? healers[0].name : 'Healers'} prioritizing ${target.name}`, '#86efac', true);
    HapticsService.confirm();
    return true;
  }

  // Healing priorities are encounter-only and end automatically when their
  // target is full health, defeated, or no longer in the party.
  getHealerPriorityTarget(healer) {
    const targetId = this.healerPriorityTargets?.get(healer.id);
    const target = this.partyUnits.find((unit) => unit.id === targetId && unit.alive);
    if (!target || target.hp >= target.maxHp) {
      this.healerPriorityTargets?.delete(healer.id);
      return null;
    }
    return target;
  }

  // This function selects a role or the whole living party for a shared command.
  selectRole(role) {

    const matching = this.partyUnits.filter((unit) => unit.alive && (role === 'All' || unit.role === role));
    const groupName = role === 'All' ? 'All adventurers' : role;
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

    this.selectedUnitIds = new Set(matching.map((unit) => unit.id));
    this.commandMode = null;
    this.setTargetingInputState(false);

    this.showBattleMessage(
      matching.length > 0 ? `${groupName} - tap a tile to move or an enemy to attack` : role === 'All' ? 'No living adventurers' : `No living ${role}`,
      matching.length > 0 ? '#93c5fd' : '#fca5a5',
      matching.length > 0
    );

    this.refreshTacticsMenus();
    HapticsService.tap();
  }

  // This function restricts commands to selected adventurers who are still
  // alive.
  getSelectedUnits() {

    return this.partyUnits.filter((unit) => unit.alive && this.selectedUnitIds.has(unit.id));
  }

  // This function checks whether a player order should prevent automatic
  // repositioning.
  isPositionLocked(unit) {

    return this.heldUnitIds.has(unit.id);
  }

  // This function prepares an order for targeting or applies Hold to the
  // current selection.
  armCommand(label) {

    const selected = this.getSelectedUnits();
    const needsSelection = ['MOVE', 'HOLD', 'SPREAD', 'STACK', 'ATTACK'].includes(label);

    // A second press cancels a target-selection mode before it can affect the
    // party. This is particularly useful for an accidentally armed Attack.
    if (this.commandMode === label) {
      this.commandMode = null;
      this.setTargetingInputState(false);
      this.refreshTacticsMenus();
      this.showBattleMessage(`${label} canceled`, '#a8a29e');
      HapticsService.tap();
      return;
    }

    // Reject movement and formation commands until the player chooses units
    // or a role.
    if (needsSelection && selected.length === 0) {
      this.showBattleMessage('SELECT AN ADVENTURER OR ROLE FIRST', '#fca5a5', true);
      HapticsService.tap();
      return;
    }

    // Hold takes effect immediately at each selected unit's current position.
    // Other commands wait for a target tap.
    if (label === 'HOLD') {
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

    // Attack is a persistent order after an enemy is chosen. Pressing it
    // again with that same group selected releases a mistaken attack target.
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

    const prompt = label === 'ATTACK' ? 'ATTACK - tap an enemy for the selected adventurers'
      : label === 'INTERRUPT' ? 'INTERRUPT - tap the enemy you want to interrupt'
        : `${label} - tap a destination`;
    this.showBattleMessage(prompt, '#fbbf24', true);
    HapticsService.tap();
  }

  // This function routes taps to enemies when an order needs an enemy target.
  setTargetingInputState(targetingEnemies) {

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

  // This function shows the selected units and the currently armed order.
  refreshTacticsMenus() {

    this.roleButtons?.forEach(({box,role})=>{

      const living = this.partyUnits?.filter((unit) => unit.alive) ?? [];
      const selected = role === 'All'
        ? living.length > 0 && living.every((unit) => this.selectedUnitIds.has(unit.id))
        : living.some((unit) => unit.role === role && this.selectedUnitIds.has(unit.id));
      box.setFillStyle(selected?0x243b53:0x1f2937).setStrokeStyle(3,selected?0x60a5fa:0x475569);
    });
    this.commandButtons?.forEach(({box,label})=>{

      const active=this.commandMode===label;
      box.setFillStyle(active?0x3b321d:0x1f2937).setStrokeStyle(3,active?0xfbbf24:0x475569);
    });
    this.partyUnits?.forEach((u) => u.body.setStrokeStyle(
      this.selectedUnitIds.has(u.id) ? 7 : 4,
      this.selectedUnitIds.has(u.id) ? 0x60a5fa : 0x1c1917,
      this.selectedUnitIds.has(u.id) || !u.spriteVisual ? 1 : 0
    ));
  }

  // This function interprets a battlefield tile tap using the current
  // command. It locates targets for Attack, Focus Fire, and Interrupt, or
  // assigns movement destinations and keeps the selected units under Hold.
  handleGridCellTap(column, row) {

    const center = this.battlefield.getCellCenter(column, row);
    this.highlightGridCell(column, row);

    // A tile tap with selected units defaults to Move. With no selection,
    // show guidance instead of moving the whole party.
    if (!this.commandMode) {
      if (this.getSelectedUnits().length > 0) {
        this.commandMode = 'MOVE';
      } else {
        this.showBattleMessage('SELECT A UNIT OR ROLE FIRST', '#d6a85f');
        HapticsService.tap();
        return;
      }
    }

    // Find a living enemy in the tapped tile for commands that need an enemy
    // target.
    if (['ATTACK', 'FOCUS', 'INTERRUPT'].includes(this.commandMode)) {
      const enemy = this.getLivingEnemies().find((candidate) => {

        const cell = this.battlefield.arenaPointToCell(candidate.arenaX, candidate.arenaY);
        return cell.column === column && cell.row === row;
      });

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

    // Place selected units around the tile center using a wide spread or a
    // tight stack, then hold those positions.
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
      if (unit.gridAbilities) {
        this.classAbilitySystem ??= new ClassAbilitySystem(this);
        this.classAbilitySystem.move(unit, point, this.time.now);
      }
      this.manualTargets.set(unit.id, point);
      this.attackTargets.delete(unit.id);

      // Make direct movement a persistent Hold immediately so AI, dodging,
      // cannot override the player's destination. Personal space still applies.
      this.heldUnitIds.add(unit.id);
    });

    this.showBattleMessage('MOVE + HOLD ORDER', '#93c5fd');
    this.commandMode = null;
    this.setTargetingInputState(false);
    this.refreshTacticsMenus();
  }

  // This function sends selected adventurers to attack a tapped enemy by
  // default. Explicit movement still uses the enemy's tile as a destination;
  // Focus Fire and Interrupt retain their separate targeting behavior.
  handleEnemyTap(enemy) {

    if (!enemy?.alive) return;

    if (['MOVE', 'SPREAD', 'STACK'].includes(this.commandMode)) {
      const cell = this.battlefield.arenaPointToCell(enemy.arenaX, enemy.arenaY);
      this.handleGridCellTap(cell.column, cell.row);
      return;
    }

    if (!this.commandMode || this.commandMode === 'ATTACK') {
      const units = this.getSelectedUnits();
      if (units.length === 0) return;

      // Attack replaces previous movement and Hold orders only for the
      // selected units. Cancel old windups so they can pursue this target.
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
      this.showBattleMessage(`FOCUS SET: ${enemy.name}`, '#fb923c');
    } else if (this.commandMode === 'INTERRUPT') {
      if (enemy.pendingAction) {
        enemy.finishAction();
        this.showBattleMessage(`INTERRUPTED: ${enemy.name}`, '#fde68a');
        HapticsService.heavy();
      } else {
        this.showBattleMessage(`${enemy.name} is not casting`, '#a8a29e');
      }
    }

    this.commandMode = null;
    this.setTargetingInputState(false);
    this.refreshTacticsMenus();
  }

  // This function briefly marks the tile the player tapped.
  highlightGridCell(column, row) {

    this.gridHighlight?.destroy();

    const points = this.battlefield.getCellPolygon(column, row);
    this.gridHighlight = this.add.polygon(0, 0, points, 0x60a5fa, 0.16)
      .setOrigin(0, 0)
      .setStrokeStyle(4, 0x60a5fa, 0.95)
      .setDepth(35);

    this.time.delayedCall(650, () => {

      if (this.gridHighlight?.active) {
        this.gridHighlight.destroy();
        this.gridHighlight = null;
      }
    });
  }

  // This function advances toward player destinations while retaining held
  // positions.
  applyManualMovement(unit, deltaSeconds) {

    const target = this.manualTargets.get(unit.id);
    if (!target || unit.isBusy(this.time.now)) {
      return false;
    }

    if (unit.gridAbilities) {
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

  // This function triggers the chosen leadership effect under its battle
  // cooldown.
  useLeaderAbility(id) {

    if (this.battleOver || this.waveTransitioning) return;
    if (this.combatPaused) {
      this.queuePausedTactic(id);
      return;
    }
    const ability = leaderAbilities.find((entry) => entry.id === id);
    if (!ability || !this.isLeaderAbilityReady(id)) {
      this.showBattleMessage('Tactic unavailable or recharging', '#a8a29e');
      return;
    }
    const living = this.partyUnits.filter((unit) => unit.alive);
    const fallen = this.partyUnits.filter((unit) => !unit.alive && !unit.delvesUsed?.honorSacrifice);
    if (id === 'arise' && fallen.length === 0) {
      this.showBattleMessage('No fallen adventurers to revive', '#a8a29e');
      return;
    }
    if (id !== 'arise' && living.length === 0) return;
    if (id === 'encouragement' && !living.some((unit) => unit.hp < unit.maxHp)) {
      this.showBattleMessage('The party is already at full health', '#a8a29e');
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
      this.showBattleMessage('FOCUS FIRE - tap an enemy', '#bef264', true);
    } else if (id === 'rally') {
      this.commandMode = 'STACK';
      this.selectedUnitIds = new Set(living.map((unit) => unit.id));
      this.setTargetingInputState(false);
      this.showBattleMessage('RALLY - tap a destination', '#bef264', true);
    } else if (id === 'coordinatedAssault') {
      this.assaultUntil = now + ability.duration;
      this.assaultBonus = ability.damageBonus;
      this.showBattleMessage('ASSAULT - +20% damage for 8 seconds', '#bef264', false, 1.5);
    } else if (id === 'brace') {
      this.braceUntil = now + ability.duration;
      this.braceReduction = ability.damageReduction;
      this.showBattleMessage('BRACE! - 30% less damage for 8 seconds', '#bef264', false, 1.5);
    } else if (id === 'encouragement') {
      living.forEach((unit) => {

        const before = unit.hp;
        unit.heal(Math.round(unit.maxHp * ability.healFraction));
        this.createFloatingText(unit.x, unit.y - 80, '+' + (unit.hp - before), '#86efac');
      });
      this.showBattleMessage('ENCOURAGEMENT - party healed', '#bef264', false, 1.5);
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
    }
    this.combatLog?.add('tactic', ability.name + ' used', { wave: this.currentWaveIndex + 1, ability: ability.name });
    this.refreshTacticsMenus();
    this.updateLeaderLoadoutBar();
  }

  // This function records a legal tactic press while paused. Commands already
  // update player order state while paused; tactics need an explicit queue
  // because their effects would otherwise be committed immediately.
  queuePausedTactic(id) {
    const ability = leaderAbilities.find((entry) => entry.id === id);
    if (!ability || !this.isLeaderAbilityReady(id)) {
      this.showBattleMessage('Tactic unavailable or recharging', '#a8a29e');
      return;
    }
    const living = this.partyUnits.filter((unit) => unit.alive);
    const fallen = this.partyUnits.filter((unit) => !unit.alive);
    if ((id !== 'arise' && living.length === 0)
      || (id === 'arise' && fallen.length === 0)
      || (id === 'encouragement' && !living.some((unit) => unit.hp < unit.maxHp))) {
      this.showBattleMessage(id === 'arise' ? 'No fallen adventurers to revive' : 'Tactic has no effect yet', '#a8a29e');
      return;
    }
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

  // This function runs queued tactic presses synchronously before the first
  // resumed combat update, preserving the player's paused decision order.
  flushPausedTactics() {
    const queued = this.pendingPausedTactics ?? [];
    this.pendingPausedTactics = [];
    queued.forEach((id) => this.useLeaderAbility(id));
  }

  // This function validates the equipped tactic, its unlock, and encounter
  // usage before either the UI or last-chance resurrection can use it.
  isLeaderAbilityReady(id) {

    const ability = leaderAbilities.find((entry) => entry.id === id);
    const leader = GameState.leader;
    return Boolean(ability && leader?.unlockedAbilities.includes(id)
      && leader.battleLoadout.includes(id)
      && !(ability.oncePerEncounter && this.usedLeaderAbilities.has(id))
      && this.time.now - (this.leaderAbilityCooldowns.get(id) ?? -Infinity) >= (ability.cooldown ?? 0));
  }

  // This function announces the next enemy group before it enters the arena.
  startWave(index) {

    if (index >= this.waves.length) {
      this.finishVictory();
      return;
    }

    this.currentWaveIndex = index;
    GameState.currentRoom = index;
    const wave = this.waves[index];
    this.waveTransitioning = true;
    this.updateEncounterStatus();
    this.showWaveAnnouncement(wave.boss ? wave.name : `WAVE ${index + 1}`, Boolean(wave.boss));
    let secondsRemaining = 3;
    this.updateWaveCountdown(secondsRemaining);

    const countDown = () => {

      if (this.battleOver) return;
      secondsRemaining -= 1;
      if (secondsRemaining > 0) {
        this.updateWaveCountdown(secondsRemaining);
        this.time.delayedCall(1000, countDown);
      } else {
        this.clearWaveAnnouncement();
        this.spawnWave(index);
      }
    };
    this.time.delayedCall(1000, countDown);
  }

  // Keep the wave name and countdown readable over bright or detailed arenas.
  showWaveAnnouncement(title, isBoss = false) {

    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;
    const panelWidth = Math.min(1160, width - 660);
    const backdrop = this.add.rectangle(0, 0, panelWidth, 248, 0x120e08, 0.97)
      .setStrokeStyle(3, 0xc49a43);
    const labelText = this.add.text(0, -76, isBoss ? 'BOSS WAVE' : '', {
      fontFamily: 'Arial', fontSize: '31px', fontStyle: 'bold', color: '#d8b761'
    }).setOrigin(0.5);
    const titleText = this.add.text(0, isBoss ? -12 : -29, title, {
      fontFamily: 'Arial', fontSize: '70px', fontStyle: 'bold', color: '#fff1cc',
      stroke: '#211606', strokeThickness: 2, align: 'center'
    }).setOrigin(0.5);
    titleText.setScale(Math.min(1, (panelWidth - 96) / titleText.width));
    const divider = this.add.rectangle(0, 48, panelWidth - 140, 2, 0x9c7c39, 0.65);
    this.waveCountdownText = this.add.text(0, 85, '', {
      fontFamily: 'Arial', fontSize: '36px', fontStyle: 'bold', color: '#e6d9b8'
    }).setOrigin(0.5);
    this.waveAnnouncement = this.add.container(centerX, centerY,
      [backdrop, labelText, titleText, divider, this.waveCountdownText]).setDepth(9000);
  }

  updateWaveCountdown(secondsRemaining) {

    this.waveCountdownText?.setText(`IN ${secondsRemaining} ${secondsRemaining === 1 ? 'SECOND' : 'SECONDS'}`);
  }

  clearWaveAnnouncement() {

    this.waveAnnouncement?.destroy();
    this.waveAnnouncement = null;
    this.waveCountdownText = null;
  }

  // This function creates the announced enemies once the countdown ends.
  spawnWave(index) {

    const wave = this.waves[index];
    this.combatLog?.add('wave', `Wave ${index + 1} started: ${wave.name}`, { wave: index + 1 });

    const landings = chooseWaveLandings(wave, this.battlefield, this.terrain, this.partyUnits);
    this.pendingWaveSpawns = [];
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

    if (wave.boss) {
      HapticsService.heavy();
    }
  }

  // This function builds an enemy from its definition and registers its
  // combat targeting.
  createEnemy(type, spawn, spawnIndex) {

    const definition = enemies[type];
    const serial = this.enemySerial++;
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
    enemy.hitZone.disableInteractive();
    enemy.hitZone.on('pointerdown', (pointer, localX, localY, event) => {

      event?.stopPropagation?.();
      this.handleEnemyTap(enemy);
    });
    bindSelectionDetails(this, enemy.hitZone, () => characterDetails(enemy));
    this.movement.validateUnitPosition(enemy);
    this.enemyThreat.set(enemy.id, new Map(this.partyUnits.map((unit) => [unit.id, 0])));
    return enemy;
  }

  // Retry crowded waves as characters move, without losing any monsters.
  schedulePendingLandings() {

    this.time.delayedCall(300, () => {
      if (this.battleOver || this.pendingWaveSpawns.length === 0) return;
      const wave = { enemies: this.pendingWaveSpawns.map(({ spawn }) => spawn) };
      const reserved = this.enemies.map(enemy => this.battlefield.arenaPointToCell(enemy.arenaX, enemy.arenaY));
      const landings = chooseWaveLandings(wave, this.battlefield, this.terrain,
        this.partyUnits, Math.random, reserved);
      this.pendingWaveSpawns = this.pendingWaveSpawns.filter(({ spawn, spawnIndex }, index) => {
        if (!landings[index]) return true;
        const enemy = this.createEnemy(spawn.type, landings[index], spawnIndex);
        this.enemies.push(enemy);
        this.animateEnemyLanding(enemy);
        return false;
      });
      if (this.pendingWaveSpawns.length > 0) this.schedulePendingLandings();
    });
  }

  // Keep combat and targeting paused for each monster until its feet bounce onto the floor.
  animateEnemyLanding(enemy) {

    enemy.landing = true;
    const visual = enemy.spriteVisual?.image ?? enemy.body;
    const floorY = visual.y;
    const scale = this.battlefield.getUnitScale(enemy.arenaY);
    visual.y = floorY - (enemy.container.y - this.battlefield.topY + 220) / scale;
    for (const label of [enemy.label, enemy.targetLabel, enemy.actionLabel,
      enemy.hpBack, enemy.hpFill, enemy.castBack, enemy.castFill]) label.setAlpha(0);
    this.tweens.add({
      targets: visual, y: floorY, duration: 720, ease: 'Bounce.Out',
      onComplete: () => {
        if (!enemy.container.active) return;
        enemy.landing = false;
        enemy.hitZone.setInteractive({ useHandCursor: true });
        for (const label of [enemy.label, enemy.targetLabel, enemy.actionLabel,
          enemy.hpBack, enemy.hpFill, enemy.castBack, enemy.castFill]) label.setAlpha(1);
      }
    });
  }

  // This function advances one frame of combat while the encounter is active.
  // It updates resources and actions, runs party and enemy decisions,
  // separates crowded units, and checks for a cleared wave or defeated party.
  update(time, delta) {

    this.classAbilitySystem?.syncChargeTweens?.(this.combatPaused);
    this.updatePotionHud();
    if (!this.combatPaused) this.enemies?.filter(enemy => enemy.container?.active !== false).forEach((enemy) => {
      enemy.spriteVisual?.update(delta);
      enemy.updateDeathPresentation?.(delta);
    });
    if (this.waveRetreating && !this.combatPaused && !this.battleOver) {
      this.updateWaveRetreat(time, Math.min(delta / 1000, 0.05), delta);
      return;
    }
    if (this.battleOver || this.waveTransitioning || this.combatPaused) {
      // Finish a fall even when its lethal hit ended the battle or wave.
      if (!this.combatPaused) this.partyUnits?.forEach(unit => {
        unit.spriteVisual?.update(delta);
      });
      return;
    }

    if (this.awaitingRevive) {
      this.updateLeaderLoadoutBar();
      return;
    }

    // Cap the movement timestep so a slow frame does not cause a large
    // position jump.
    const deltaSeconds = Math.min(delta / 1000, 0.05);

    this.partyUnits.forEach((unit) => {

      unit.updateActionBar(time);
      unit.regenMana(deltaSeconds);
    });
    this.enemies.forEach((enemy) => enemy.updateActionBar(time));

    const livingEnemies = this.getLivingEnemies();
    if (livingEnemies.length === 0) {
      if (this.pendingWaveSpawns?.length > 0) {
        this.partyUnits.forEach(unit => this.updatePartyUnit(unit, time, deltaSeconds));
      } else if (!this.enemies.some(enemy => enemy.alive && enemy.landing)) this.completeWave();
      return;
    }

    // Run party decisions, resolve crowding, and then let enemies choose
    // their actions.
    this.classAbilitySystem ??= new ClassAbilitySystem(this);
    this.classAbilitySystem.tickWorld(time);
    this.partyUnits.forEach((unit) => this.updatePartyUnit(unit, time, deltaSeconds));
    this.updateEnemies(time, deltaSeconds);
    this.movement.separate(deltaSeconds);

    this.partyUnits.forEach((unit) => this.movement.validateUnitPosition(unit));
    livingEnemies.forEach((enemy) => this.movement.validateUnitPosition(enemy));

    this.partyUnits.forEach((unit) => unit.spriteVisual?.update(delta));

    this.updateHud();

    if (this.partyUnits.every((unit) => !unit.alive)) {
      if (this.isLeaderAbilityReady('arise')) {
        this.awaitingRevive = true;
        this.showBattleMessage('PARTY DOWN - use ARISE! or FLEE', '#fde68a', true);
      } else {
        this.finishDefeat();
      }
    }
  }


  // This function excludes defeated enemies from active combat decisions.
  getLivingEnemies() {

    return this.enemies.filter((enemy) => enemy.alive && !enemy.landing);
  }

  // This function honors Focus first, then favors bosses and nearby enemies.
  getPrimaryTarget(unit) {

    const living = this.getLivingEnemies().filter((enemy) =>
      unit.role === 'Tank' || this.isEnemyEngaged(enemy));
    if (living.length === 0) {
      return null;
    }

    const focused = living.find((enemy) => enemy.id === this.focusTargetId);
    const ordered = this.getLivingEnemies().find((enemy) => enemy.id === this.attackTargets.get(unit.id));
    if (ordered) return ordered;
    this.attackTargets.delete(unit.id);
    if (focused) return focused;

    return living.sort((a, b) => {

      const bossPriority = Number(b.isBoss || ['elderSlime', 'abyssalMaw'].includes(b.enemyType)) - Number(a.isBoss || ['elderSlime', 'abyssalMaw'].includes(a.enemyType));
      if (bossPriority !== 0) {
        return bossPriority;
      }
      return unit.distanceTo(a) - unit.distanceTo(b);
    })[0];
  }

  // This function chooses what one living adventurer does next. Passive
  // effects run first, followed by player-directed movement and eligible
  // hazard avoidance; the remaining decisions come from the unit's combat
  // role.
  updatePartyUnit(unit, time, deltaSeconds) {
    if (!unit?.alive) return;
    this.classAbilitySystem ??= new ClassAbilitySystem(this);
    this.classAbilitySystem.tick(unit, time);
    if (this.applyManualMovement(unit, deltaSeconds)) return;
    if (!this.isPositionLocked(unit) && this.tryEvadeTelegraph(unit, deltaSeconds)) return;
    this.classAbilitySystem.update(unit, time, deltaSeconds);
  }

  // Melee reach is measured from centers in the combat data. Extend it only
  // by the shared visual-clearance allowance so a readable melee slot can
  // still resolve its attack without changing ranged combat ranges.
  isWithinAttackReach(attacker, target, padding = 0) {
    const meleePadding = this.movement.isMelee(attacker) ? combatSpacing.meleeReachPadding : 0;
    return attacker.distanceTo(target) <= attacker.attackRange + meleePadding + padding;
  }

  // This function raises the tank above each target's existing threat and
  // redirects it immediately. Canceling its old action prevents a queued
  // attack from still hitting the ally the taunt just protected.
  applyTankTaunt(tank, enemies, key, time, commit = true) {
    tank.spriteVisual?.play('block', enemies[0]);

    if (commit) {
      tank.markAbilityUsed(key, time);
      this.announceAbility(tank, tank.abilities[key].name, '#fde68a');
    }
    enemies.forEach((enemy) => {

      const table = this.enemyThreat.get(enemy.id);
      const highest = Math.max(0, ...table.values());
      table.set(tank.id, highest * (1 + (tank.abilities[key].threatBonus ?? 0)) + 1);
      enemy.engagedByTank = true;
      if (tank.abilities[key].duration) {
        enemy.status.forcedApproach = tank.abilities[key].farthest === true;
        enemy.status.forcedTargetId = tank.id;
        enemy.status.forcedTargetUntil = time + tank.abilities[key].duration;
      }
      enemy.finishAction();
      this.activeTelegraphs.filter((telegraph) => telegraph.attacker === enemy)
        .forEach((telegraph) => this.removeTelegraph(telegraph));
      this.setEnemyTarget(enemy, tank, tank.abilities[key].name);
    });
  }

  // This function drives enemy targeting, abilities, movement, and basic
  // attacks.
  updateEnemies(time, deltaSeconds) {

    this.getLivingEnemies().forEach((enemy) => {

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
      const primary = enemy.abilities?.primary;
      if (primary?.telegraph && enemy.abilityReady('primary', time) && enemy.distanceTo(target) <= 220) {
        this.setEnemyTarget(enemy, target, 'highest threat');
        this.beginGroundSlam(enemy, target, time, primary);
        return;
      }

      const secondary = enemy.abilities?.secondary;
      if (secondary && !enemy.isBusy(time) && enemy.abilityReady('secondary', time)) {
        this.setEnemyTarget(enemy, target, 'highest threat');
        this.beginEnemyAbility(enemy, target, 'secondary', time);
        return;
      }

      this.movement.moveToCombatPosition(enemy, target, time, deltaSeconds);

      if (this.isWithinAttackReach(enemy, target, 8) && enemy.canAttack(time)) {
        this.beginBasicAttack(enemy, target, time, 'enemy');
      }
    });
  }

  // This function checks the exact action instance before a delayed effect
  // resolves. Dead targets release the actor, while callbacks from canceled
  // actions cannot finish or resolve a newer action with the same name.
  isActionCurrent(unit, action, target = null) {

    if (unit.pendingAction !== action) return false;
    if (!unit.alive || this.battleOver || this.time.now < (unit.status?.stunnedUntil ?? 0) || (target && (!target.alive || (unit.isEnemy && target.stealthed)))) {
      unit.finishAction();
      return false;
    }
    return true;
  }

  // This function winds up a basic attack and rechecks its target before the
  // hit.
  beginBasicAttack(attacker, target, time, attackType) {

    if (attacker.role === 'Healer' && this.partyUnits.some(unit => unit.alive && unit.hp / unit.maxHp < 0.8)) return;
    if (!attacker.startAction('Attack', time, attacker.attackWindup)) {
      return;
    }

    attacker.lastAttackAt = time;
    attacker.spriteVisual?.play('attack', target);
    if (attacker.isEnemy) this.setEnemyTarget(attacker, target, 'highest threat');
    this.logActionStart(attacker, target, 'Attack');
    const action = attacker.pendingAction;
    this.time.delayedCall(attacker.attackWindup, () => {

      if (!this.isActionCurrent(attacker, action, target)) return;
      if (attacker.role === 'Healer' && this.partyUnits.some(unit => unit.alive && unit.hp / unit.maxHp < 0.8)) {
        attacker.finishAction();
        return;
      }
      if (this.isWithinAttackReach(attacker, target, 28)) {
        this.resolveDamage(attacker, target, attacker.attackPower, attackType, attacker.threatMultiplier, 'Attack');
      }
      attacker.finishAction();
    });
  }

  // A healer's basic action restores a small amount to one injured ally.
  beginBasicHeal(healer, target, time) {
    if (!target.alive || target.hp >= target.maxHp || !healer.canHeal(time)
      || this.classAbilitySystem.distance(healer, target) > healer.basicHealRange
      || !healer.startAction('Mend', time, healer.healWindup)) return;

    healer.lastHealAt = time;
    healer.spriteVisual?.play('block', target);
    this.logActionStart(healer, target, 'Mend');
    const action = healer.pendingAction;
    this.time.delayedCall(healer.healWindup, () => {
      if (!this.isActionCurrent(healer, action, target)) return;
      if (target.hp < target.maxHp && this.classAbilitySystem.distance(healer, target) <= healer.basicHealRange) {
        this.resolveHeal(healer, target, healer.basicHealPower, 'Mend');
      }
      healer.finishAction();
    });
  }

  // This function announces an enemy cast and resolves it if the action
  // remains valid.
  beginEnemyAbility(attacker, target, key, time) {

    const ability = attacker.abilities[key];
    if (!ability || !attacker.startAction(ability.name, time, ability.windup)) {
      return;
    }
    attacker.spriteVisual?.play('attack', target);
    this.announceAbility(attacker, ability.name, '#c084fc');
    this.setEnemyTarget(attacker, target, 'highest threat');
    this.logActionStart(attacker, target, ability.name);
    attacker.markAbilityUsed(key, time);

    const action = attacker.pendingAction;
    this.time.delayedCall(ability.windup, () => {

      if (!this.isActionCurrent(attacker, action, target)) return;
      this.createProjectile(attacker, target, 0xa855f7);
      this.resolveDamage(attacker, target, ability.power, 'enemy', 1, ability.name);
      attacker.finishAction();
    });
  }

  // This function starts an enemy area attack and draws a warning at the
  // target's current position. After the warning delay, it damages living
  // party members still inside that fixed area and removes the warning.
  beginGroundSlam(attacker, target, time, ability) {

    if (!attacker.startAction(ability.name, time, ability.telegraph)) {
      return;
    }
    attacker.spriteVisual?.play('attack', target);
    this.announceAbility(attacker, ability.name, '#f87171');
    this.setEnemyTarget(attacker, target, 'highest threat');
    this.logActionStart(attacker, target, ability.name);
    attacker.markAbilityUsed('primary', time);

    // Capture the target location at cast start so the warning stays fixed
    // and can be dodged.
    const center = { arenaX: target.arenaX, arenaY: target.arenaY };
    const screenCenter = this.battlefield.arenaToScreen(center.arenaX, center.arenaY);
    const radii = this.battlefield.getGroundEllipseRadii(ability.radius, center.arenaY);

    const warning = this.add.ellipse(screenCenter.x, screenCenter.y, radii.width * 2, radii.height * 2, 0xef4444, 0.14)
      .setStrokeStyle(8, 0xf87171, 0.88)
      .setDepth(40 + screenCenter.y);
    const inner = this.add.ellipse(screenCenter.x, screenCenter.y, 32, 16, 0xf87171, 0.35)
      .setDepth(41 + screenCenter.y);

    // Register the warning in arena coordinates for automatic hazard
    // avoidance.
    const telegraph = {
      arenaX: center.arenaX,
      arenaY: center.arenaY,
      radius: ability.radius,
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
      duration: ability.telegraph,
      ease: 'Linear'
    });

    // Resolve the delayed strike against current party positions, then remove
    // the warning visuals.
    const action = attacker.pendingAction;
    this.time.delayedCall(ability.telegraph, () => {

      if (!this.isActionCurrent(attacker, action)) {
        this.removeTelegraph(telegraph);
        return;
      }

      HapticsService.heavy();
      this.partyUnits.filter((unit) => unit.alive).forEach((unit) => {

        if (unit.distanceToPoint(center.arenaX, center.arenaY) <= ability.radius) {
          this.resolveDamage(attacker, unit, ability.power, 'enemy', 1, ability.name, false);
        }
      });

      const burst = this.add.ellipse(screenCenter.x, screenCenter.y, radii.width * 0.8, radii.height * 0.8, 0xef4444, 0.42)
        .setDepth(45 + screenCenter.y);
      this.tweens.add({
        targets: burst,
        displayWidth: radii.width * 2.6,
        displayHeight: radii.height * 2.6,
        alpha: 0,
        duration: 260,
        onComplete: () => burst.destroy()
      });

      this.removeTelegraph(telegraph);
      attacker.finishAction();
    });
  }

  // This function lets eligible units abandon their action to escape a ground
  // warning.
  tryEvadeTelegraph(unit, deltaSeconds) {

    if (!this.tactics.shouldAvoidMechanics(unit) || !unit.alive || this.activeTelegraphs.length === 0) {
      return false;
    }

    const danger = this.activeTelegraphs.find((telegraph) => unit.distanceToPoint(telegraph.arenaX, telegraph.arenaY) < telegraph.radius + 40);
    if (!danger) {
      return false;
    }

    unit.finishAction();
    unit.moveAwayFrom(danger.arenaX, danger.arenaY, deltaSeconds, danger.radius + 90);
    return true;
  }

  // This function retires a ground warning from both the display and hazard
  // tracking.
  removeTelegraph(telegraph) {

    this.activeTelegraphs = this.activeTelegraphs.filter((item) => item !== telegraph);
    telegraph.warning?.destroy();
    telegraph.inner?.destroy();
  }

  // This function rolls the attacker critical chance when the action allows
  // it.
  rollCritical(attacker, allowCrit = true) {

    const bonus = this.time.now < (attacker.status.abilityCritUntil ?? 0) ? attacker.status.abilityCritBonus ?? 0 : 0;
    return allowCrit && Math.random() < Math.min(0.95, (attacker.critChance ?? 0) + bonus);
  }

  // This function resolves an attack from its base damage through critical
  // hits, status effects, and the target defenses. It updates combat
  // timestamps, threat, visual feedback, and the log, then handles any
  // resulting defeat.
  resolveDamage(attacker, target, baseAmount, attackType, threatMultiplier = 1, abilityName = 'Attack', allowCrit = true) {

    // Area hits and delayed attacks also obey the engagement rule, so a spell
    // cannot pull an untouched enemy while the tank is approaching.
    if (!attacker.isEnemy && attacker.role !== 'Tank' && target.isEnemy && !this.isEnemyEngaged(target)) return;
    const now = this.time.now;

    // Resolve blindness before damage modifiers; a miss stops the rest of the
    // hit processing.
    if (attackType !== 'reflection' && now < (attacker.status.blindUntil ?? 0) && Math.random() < (attacker.status.blindChance ?? 0)) {
      this.createFloatingText(target.x, target.y - 82, 'MISS', '#cbd5e1', false, 'miss');
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

    // Roll the critical result and apply outgoing damage bonuses or
    // penalties.
    const critical = this.rollCritical(attacker, allowCrit);
    if (attacker.status.abilityCritOnce) { attacker.status.abilityCritUntil = 0; attacker.status.abilityCritOnce = false; }
    let amount = Math.round(baseAmount * (critical ? attacker.critMultiplier : 1));
    if (attackType !== 'reflection' && attacker.status.nextAttackBoost) {
      amount = Math.round(amount * (1 + attacker.status.nextAttackBoost));
      attacker.status.nextAttackBoost = 0;
    }

    if (attackType !== 'reflection' && !attacker.isEnemy && now < (attacker.status.damageBoostUntil ?? 0)) {
      amount = Math.round(amount * (1 + (attacker.status.damageBoost ?? 0)));
    }
    if (attacker.isEnemy && now < (attacker.status.outgoingDamageReductionUntil ?? 0)) {
      amount = Math.round(amount * Math.max(0, 1 - (attacker.status.outgoingDamageReduction ?? 0)));
    }
    if (now < (attacker.status.enrageUntil ?? 0)) amount = Math.round(amount * attacker.status.enrageDamage);
    else if (now < (attacker.status.exhaustedUntil ?? 0)) amount = Math.round(amount * attacker.status.exhaustedDamage);
    if (attackType !== 'reflection' && now < (attacker.status.honorDamageUntil ?? 0)) amount = Math.round(amount * (1 + attacker.status.honorDamageBoost));
    if (attackType !== 'reflection' && !attacker.isEnemy && now < this.assaultUntil) amount = Math.round(amount * (1 + this.assaultBonus));
    if (attacker.isEnemy && !target.isEnemy && now < this.braceUntil) amount = Math.max(1, Math.round(amount * (1 - this.braceReduction)));

    // Let the target apply its defenses, then measure actual health loss for
    // the combat log.
    const ranged = attackType === 'spell' || attackType === 'ranged' || attacker.attackRange > 180;
    if (now < (target.status.immuneUntil ?? 0)) {
      this.createFloatingText(target.x, target.y - 82, 'IMMUNE', '#fde68a');
      return 0;
    }
    if (attacker.isEnemy && now < (target.status.abilityDodgeUntil ?? 0)
      && (!target.status.abilityDodgeRangedOnly || attackType === 'ranged' || attackType === 'spell' || attacker.attackRange > 180)
      && Math.random() < (target.status.abilityDodgeChance ?? 0)) return 0;
    if (attacker.isEnemy && this.classAbilitySystem?.tryParry(target, attacker, amount, now)) return 0;
    const hpBefore = target.hp;
    target.takeDamage(amount, { time: now, ranged, attacker,
      blocked: (!target.isEnemy && now < this.braceUntil)
        || now < (target.status.shieldUntil ?? 0)
        || now < (target.status.damageReductionUntil ?? 0) });
    const actualDamage = hpBefore - target.hp;
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
          const threatReduction = now < (attacker.status.threatReductionUntil ?? 0) ? 1 - (attacker.status.threatReduction ?? 0) : 1;
          const preparedThreat = attacker.status.nextThreatBonus ?? 1;
          this.addThreat(enemy, attacker, amount * threatMultiplier * threatReduction * preparedThreat);
          attacker.status.nextThreatBonus = 1;
        }
      });
    }

    // Record the actual health change alongside the ability, critical result,
    // and current threat snapshot.
    this.combatLog?.add('damage', `${attacker.name} used ${abilityName} on ${target.name} for ${actualDamage}${critical ? ' critical' : ''} damage`, {
      wave: this.currentWaveIndex + 1,
      actor: attacker.name,
      target: target.name,
      ability: abilityName,
      amount: actualDamage,
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

    // Award a defeated enemy once and record the death after the damage
    // event.
    if (!target.alive && target.isEnemy) {
      this.handleEnemyDeath(target);
    }
    if (!target.alive) {
      this.combatLog?.add('death', `${target.name} was defeated by ${attacker.name}'s ${abilityName}`, {
        wave: this.currentWaveIndex + 1,
        actor: attacker.name,
        target: target.name,
        ability: abilityName
      });
    }
    return actualDamage;
  }

  // This function applies a heal, including its critical roll, and measures
  // how much health was actually restored for feedback and the combat log.
  // Healing generates threat only on enemies already engaged by a tank.
  resolveHeal(healer, target, baseAmount, abilityName, allowCrit = true) {

    const critical = this.rollCritical(healer, allowCrit);
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

    const engaged = this.getLivingEnemies().filter((enemy) => this.isEnemyEngaged(enemy));
    engaged.forEach((enemy) => this.addThreat(enemy, healer, effectiveHealing * 0.45));
    this.combatLog?.add('healing', `${healer.name} used ${abilityName} on ${target.name} for ${effectiveHealing}${critical ? ' critical' : ''} healing`, {
      wave: this.currentWaveIndex + 1,
      actor: healer.name,
      target: target.name,
      ability: abilityName,
      amount: effectiveHealing,
      critical,
      targetHp: target.hp,
      targetMaxHp: target.maxHp,
      generatedThreat: engaged.length > 0 ? Math.round(effectiveHealing * 0.45) : 0
    });
  }

  // This function awards each defeated enemy gold only once.
  handleEnemyDeath(enemy) {

    if (enemy.rewarded) {
      return;
    }
    enemy.rewarded = true;
    const definition = enemy.definition;
    this.earnedGold += Phaser.Math.Between(definition.goldMin ?? 0, definition.goldMax ?? 0);

    // Keep the container until the death clip and shared fade/pop finish.
    // Wave cleanup removes it after the animation.
    enemy.hitZone?.disableInteractive?.();
  }

  // This function checks whether allies may engage an enemy. A tank hit or
  // taunt opens normal combat for that enemy; parties without a living tank
  // can fight immediately instead of waiting for an impossible engagement.
  isEnemyEngaged(enemy) {

    return enemy.engagedByTank === true || !this.partyUnits.some((unit) => unit.alive && unit.role === 'Tank');
  }

  // This function records normal threat after the tank has engaged an enemy.
  // Tank damage establishes engagement, while ally damage and healing wait
  // for that opening before contributing their usual threat amounts.
  addThreat(enemy, unit, amount) {

    if (!enemy?.isEnemy || !unit || unit.isEnemy) {
      return;
    }
    const table = this.enemyThreat.get(enemy.id);
    if (!table) {
      return;
    }
    if (unit.role === 'Tank' && amount > 0) enemy.engagedByTank = true;
    if (unit.role !== 'Tank' && !this.isEnemyEngaged(enemy)) return;
    table.set(unit.id, (table.get(unit.id) ?? 0) + Math.max(0, amount));
  }

  // This function chooses the living threat leader. With equal threat, tanks
  // take priority before distance, including at the start of a wave.
  getHighestThreatTarget(enemy) {

    const living = this.partyUnits.filter((unit) => unit.alive && !unit.stealthed);
    if (living.length === 0) {
      return null;
    }
    const forced = living.find(unit => unit.id === enemy.status?.forcedTargetId);
    if (forced && this.time.now < (enemy.status.forcedTargetUntil ?? 0)) return forced;
    const table = this.enemyThreat.get(enemy.id) ?? new Map();

    return living.sort((a, b) => {

      const diff = (table.get(b.id) ?? 0) - (table.get(a.id) ?? 0);
      if (Math.abs(diff) > 0.01) {
        return diff;
      }
      const tankPriority = Number(b.role === 'Tank') - Number(a.role === 'Tank');
      if (tankPriority !== 0) return tankPriority;
      return enemy.distanceTo(a) - enemy.distanceTo(b);
    })[0];
  }

  // This function captures a ranked threat table for reviewing enemy
  // decisions.
  getThreatSnapshot(enemy) {

    const table = this.enemyThreat.get(enemy.id) ?? new Map();
    return this.partyUnits
      .map((unit) => ({ name: unit.name, role: unit.role, threat: Math.round(table.get(unit.id) ?? 0), alive: unit.alive }))
      .sort((a, b) => b.threat - a.threat);
  }

  // This function stores the enemy target for inspection and logs meaningful targeting
  // changes.
  setEnemyTarget(enemy, target, reason = '') {

    const targetId = target?.id ?? null;
    enemy.setTargetName(target?.name ?? '');
    if (enemy.currentTargetId === targetId && enemy.currentTargetReason === reason) return;

    enemy.currentTargetId = targetId;
    enemy.currentTargetReason = reason;
    if (!target) return;
    this.combatLog?.add('target', `${enemy.name} targets ${target.name}${reason ? ` (${reason})` : ''}`, {
      wave: this.currentWaveIndex + 1,
      actor: enemy.name,
      target: target.name,
      reason,
      threat: this.getThreatSnapshot(enemy)
    });
  }

  // This function records the actor intent before an attack or heal resolves.
  logActionStart(actor, target, ability) {

    this.combatLog?.add('action', `${actor.name} begins ${ability}${target ? ` on ${target.name}` : ''}`, {
      wave: this.currentWaveIndex + 1,
      actor: actor.name,
      target: target?.name,
      ability
    });
  }

  // This function totals an adventurer threat across the remaining enemies.
  getCombinedThreat(unit) {

    let total = 0;
    this.getLivingEnemies().forEach((enemy) => {

      total += this.enemyThreat.get(enemy.id)?.get(unit.id) ?? 0;
    });
    return total;
  }

  // This function prioritizes living allies by the fraction of health
  // missing.
  getMostInjuredPartyMember() {

    return this.partyUnits
      .filter((unit) => unit.alive && unit.hp < unit.maxHp)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0] ?? null;
  }

  // This function connects attacker and target with a brief traveling effect.
  createProjectile(attacker, target, color) {

    const projectile = this.add.circle(attacker.x, attacker.y, 9, color).setDepth(4000);
    this.tweens.add({
      targets: projectile,
      x: target.x,
      y: target.y,
      duration: 180,
      ease: 'Linear',
      onComplete: () => projectile.destroy()
    });
  }

  // This function marks a close combat impact with a short visual pulse.
  createMeleePulse(target, color = 0xffffff) {

    const pulse = this.add.ellipse(target.x, target.y + 8, 48, 24, color, 0.25).setDepth(4000);
    this.tweens.add({
      targets: pulse,
      displayWidth: 120,
      displayHeight: 60,
      alpha: 0,
      duration: 120,
      onComplete: () => pulse.destroy()
    });
  }

  // This function shows a living unit ability name above the action.
  announceAbility(unit, name, color = '#f8fafc') {

    if (!unit?.alive || !name) return;
    this.createFloatingText(unit.x, Math.max(unit.y - 122, this.battlefield.topY + 12), name.toUpperCase(), color, false, 'ability');
  }

  // This function animates combat feedback with extra emphasis for critical
  // results.
  createFloatingText(x, y, text, color, critical = false, kind = 'damage') {

    const label = this.add.text(x, y, text, {
      fontFamily: 'Arial',
      fontSize: critical ? '78px' : '51px',
      fontStyle: 'bold',
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
      onComplete: () => label.destroy()
    });
  }

  // This function displays battle guidance until it fades or is explicitly
  // replaced.
  showBattleMessage(text, color = '#d6a85f', persistent = false, durationMultiplier = 1) {

    if (!this.battleMessageText) return;

    this.tweens.killTweensOf(this.battleMessageText);
    this.battleMessageText.setText(text).setColor(color).setAlpha(1);

    if (!persistent) {
      this.tweens.add({
        targets: this.battleMessageText,
        alpha: 0,
        delay: 900 * durationMultiplier,
        duration: 260 * durationMultiplier,
        onComplete: () => {

          if (this.battleMessageText?.active) this.battleMessageText.setText('').setAlpha(1);
        }
      });
    }
  }

  // This function dismisses guidance when the current interaction no longer
  // needs it.
  clearBattleMessage() {

    if (!this.battleMessageText) return;
    this.tweens.killTweensOf(this.battleMessageText);
    this.battleMessageText.setText('').setAlpha(1);
  }

  // This function clears wave visuals and paces the transition to the next
  // result.
  completeWave() {

    if (this.waveTransitioning || this.battleOver) {
      return;
    }

    // Stop active combat updates during the wave transition and clear
    // remaining ground warnings.
    this.waveTransitioning = true;
    let waveReward = null;
    if (isOrdinaryDelve() && this.currentWaveIndex < this.bossWaveIndex) {
      waveReward = awardOrdinaryWave(GameState.currentDelve, this.currentWaveIndex,
        this.bossWaveIndex, GameState.run.entry === 'farm');
      if (waveReward) {
        this.earnedGold = 0;
      }
    }
    this.waveRetreating = true;
    this.waveReturnReadyAt = null;
    this.waveReturnStartedAt = this.time.now;
    this.waveReturnTimedOut = false;
    this.waveReturnProgress = new Map();
    this.waveReturnSettled = new Set();
    this.waveReturnTargets = new Map(this.partyUnits.filter(unit => unit.alive).map(unit => {
      const home = this.waveReturnPositions.get(unit.id);
      if (!home) return [unit.id, { x: unit.arenaX, y: unit.arenaY }];
      const clear = this.movement.clearCorpseDestination(unit, home);
      return [unit.id, this.movement.clamp(clear.x, clear.y, unit)];
    }));
    if (this.currentWaveIndex + 1 < this.waves.length) {
      this.partyUnits.filter(unit => unit.alive).forEach(unit => {
        const halfway = Math.ceil(unit.maxHp * 0.5);
        if (unit.hp < halfway) unit.heal(halfway - unit.hp);
      });
      this.updateHud();
    }
    this.manualTargets.clear();
    this.heldUnitIds.clear();
    this.attackTargets.clear();
    this.activeTelegraphs.forEach((telegraph) => this.removeTelegraph(telegraph));
    this.showBattleMessage(waveReward
      ? `+${waveReward.gold} GOLD  +${waveReward.materialCount} MATERIAL  +${waveReward.xp} XP`
      : 'WAVE CLEARED', '#bef264');
    this.combatLog?.add('wave', `Wave ${this.currentWaveIndex + 1} cleared`, { wave: this.currentWaveIndex + 1 });
    this.combatLog?.persist();

    this.enemies.filter((enemy) => enemy.container?.active !== false).forEach((enemy) => {

      this.tweens.add({
        targets: enemy.container,
        alpha: 0,
        delay: enemy.alive ? 0 : Math.max(0, 1100 - (enemy.deathElapsed ?? 0)),
        duration: 250,
        onComplete: () => enemy.container.destroy()
      });
    });

  }

  // Return living adventurers to their original positions before the next wave.
  updateWaveRetreat(time, deltaSeconds, delta) {

    const living = this.partyUnits.filter((unit) => unit.alive);
    for (const unit of living) {
      const destination = this.waveReturnTargets.get(unit.id);
      if (!destination) continue;
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
      unit.spriteVisual?.update(delta);
    }

    const allHome = living.every((unit) => {
      const destination = this.waveReturnTargets.get(unit.id);
      return destination && (this.waveReturnSettled.has(unit.id)
        || Math.hypot(unit.arenaX - destination.x, unit.arenaY - destination.y) <= 6);
    });
    if (!allHome && time - this.waveReturnStartedAt < 10000) {
      this.waveReturnReadyAt = null;
      return;
    }

    if (!allHome) this.waveReturnTimedOut = true;
    this.waveReturnReadyAt ??= time + 2000;
    if (time < this.waveReturnReadyAt) return;
    this.waveRetreating = false;
    if (isOrdinaryDelve() && (GameState.run.entry === 'farm'
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
    GameState.currentRoom = this.bossWaveIndex;
    this.clearBattleMessage();
    const { width, height } = this.scale;
    const delve = GameState.currentDelve;
    const values = WAVE_REWARDS[delve.difficulty] ?? WAVE_REWARDS.Easy;
    const farmIndex = this.bossWaveIndex - 1;
    const farmGold = values.gold + values.goldStep * farmIndex;
    const farmXp = Math.max(1, Math.floor(values.xp / 2));
    const overlay = [];
    overlay.push(this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78)
      .setInteractive().setDepth(11999));
    overlay.push(this.add.rectangle(width / 2, height / 2, 1390, 770, 0x171b14, 0.96)
      .setStrokeStyle(5, 0x84cc16).setDepth(12000));
    overlay.push(this.add.text(width / 2, height * 0.24, 'DELVE CAMP', {
      fontFamily: 'Arial', fontSize: '68px', fontStyle: 'bold', color: '#bef264'
    }).setOrigin(0.5).setDepth(12001));
    overlay.push(this.add.text(width / 2, height * 0.30,
      `Waves 1-${this.bossWaveIndex} cleared • Rewards and camp saved`, {
        fontFamily: 'Arial', fontSize: '29px', color: '#e7e5e4'
      }).setOrigin(0.5).setDepth(12001));

    const choice = (y, title, detail, action, color) => {
      const button = this.add.rectangle(width / 2, y, 1180, 138, color)
        .setStrokeStyle(3, 0x78716c).setInteractive({ useHandCursor: true }).setDepth(12001);
      overlay.push(button);
      overlay.push(this.add.text(width / 2, y - 25, title, {
        fontFamily: 'Arial', fontSize: '38px', fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0.5).setDepth(12002));
      overlay.push(this.add.text(width / 2, y + 26, detail, {
        fontFamily: 'Arial', fontSize: '27px', color: '#e7e5e4'
      }).setOrigin(0.5).setDepth(12002));
      button.on('pointerdown', () => {
        HapticsService.confirm();
        overlay.forEach((object) => object.destroy());
        action();
      });
    };
    choice(height * 0.42, 'RETURN TO TOWN', 'Keep all banked rewards', () => {
      GameState.activeParty = [];
      const townId = delve.requiresLocation === 'duskfall' ? 'duskfall' : 'pineshire';
      GameState.world.currentLocation = townId;
      saveProfile();
      this.scene.start('TownScene', { townId, townName: townId === 'duskfall' ? 'Duskfall' : 'Pineshire' });
    }, 0x365135);
    choice(height * 0.59, `FARM WAVE ${this.bossWaveIndex}`,
      `${farmGold} Gold • ${values.materialCount} material • ${farmXp} XP per adventurer`, () => {
        GameState.run.entry = 'farm';
        this.startWave(farmIndex);
      }, 0x50432e);
    choice(height * 0.76, 'FACE THE BOSS', 'Boss rewards and Delve completion', () => {
      GameState.run.entry = 'boss';
      this.startWave(this.bossWaveIndex);
    }, 0x633328);
  }

  potionDetails(unit) {
    const hero = GameState.roster.find((entry) => entry.id === unit.id);
    const item = hero && equippedItem(hero, 'potion', GameState);
    const definition = getPotionDefinition(item?.itemId);
    return definition ? { title: definition.name, description: `${definition.description} ${item.charges}/${definition.uses} uses remain. Tap POTION to use it on ${unit.name}.` }
      : { title: 'Potion', description: 'Equip a potion pack on this adventurer at the Adventurer\'s Hall.' };
  }

  canUsePotion(unit, time = this.time.now) {
    if (this.battleOver || this.combatPaused || this.waveTransitioning || !this.partyUnits.includes(unit) || !unit.alive) return false;
    const hero = GameState.roster.find((entry) => entry.id === unit.id);
    const item = hero && equippedItem(hero, 'potion', GameState);
    const definition = getPotionDefinition(item?.itemId);
    if (!definition || time - (this.lastPotionUseAt?.get(unit.id) ?? -Infinity) < 1500) return false;
    return definition.effect.resource === 'hp' ? unit.hp < unit.maxHp
      : definition.effect.resource === 'mana' && unit.maxMana > 0 && unit.mana < unit.maxMana;
  }

  usePotion(unit, time = this.time.now) {
    if (!this.canUsePotion(unit, time)) return false;
    const hero = GameState.roster.find((entry) => entry.id === unit.id);
    const item = equippedItem(hero, 'potion', GameState);
    const definition = getPotionDefinition(item.itemId);
    const resource = definition.effect.resource;
    const maximum = resource === 'hp' ? unit.maxHp : unit.maxMana;
    const before = resource === 'hp' ? unit.hp : unit.mana;
    const restored = Math.max(1, Math.round(maximum * definition.effect.fraction));
    if (resource === 'hp') unit.heal(restored);
    else unit.mana = Math.min(unit.maxMana, unit.mana + restored);
    const amount = Math.round((resource === 'hp' ? unit.hp : unit.mana) - before);
    consumePotionCharge(hero.id, GameState);
    this.lastPotionUseAt ??= new Map();
    this.lastPotionUseAt.set(unit.id, time);
    unit.flash?.(0x86efac);
    this.createFloatingText(unit.x, unit.y - 100, `+${amount} ${resource === 'hp' ? 'HP' : 'MANA'}`, '#86efac', true);
    this.showBattleMessage(`${unit.name} uses ${definition.name}`, '#86efac');
    this.combatLog?.add('item', `${unit.name} restored ${amount} ${resource === 'hp' ? 'HP' : 'mana'} with ${definition.name}`, { target: unit.name, amount, resource });
    HapticsService.confirm();
    saveProfile();
    this.updateHud();
    return true;
  }

  updatePotionHud() {
    this.partyHud?.forEach(({ unit, potionButton, potionLabel }) => {
      const hero = GameState.roster.find((entry) => entry.id === unit.id);
      const item = hero && equippedItem(hero, 'potion', GameState);
      const definition = getPotionDefinition(item?.itemId);
      const available = Boolean(definition);
      const ready = available && this.canUsePotion(unit);
      potionButton?.setVisible(available).setFillStyle(ready ? 0x14532d : 0x292524);
      if (potionButton?.input) potionButton.input.enabled = available;
      potionLabel?.setVisible(available).setAlpha(ready ? 1 : 0.55).setText(available ? `POTION\n${item.charges}/${definition.uses}` : '');
    });
  }

  // This function refreshes party resources and encounter progress as combat
  // changes.
  updateHud() {

    this.updateLeaderLoadoutBar();
    this.updatePotionHud();
    this.partyHud?.forEach(({ unit, hpText, manaText, threatText, hpFill, hpGlow, manaBack, manaFill, hudBarWidth }) => {

      const ratio = unit.maxHp > 0 ? Phaser.Math.Clamp(unit.hp / unit.maxHp, 0, 1) : 0;
      const manaRatio = unit.maxMana > 0 ? Phaser.Math.Clamp(unit.mana / unit.maxMana, 0, 1) : 0;
      const healthColor = this.getHealthBarColor(ratio);
      hpText.setText(unit.alive ? `${Math.ceil(unit.hp)} / ${unit.maxHp} HP` : 'DOWN');
      threatText.setText(unit.alive ? `Threat ${Math.round(this.getCombinedThreat(unit))}` : '');
      hpFill.setDisplaySize(hudBarWidth * ratio, 16);
      hpFill.setFillStyle(healthColor);
      hpFill.setVisible(unit.alive && ratio > 0);
      hpGlow.setStrokeStyle(5, healthColor, 0);

      if (unit.maxMana > 0) {
        manaBack.setVisible(true);
        manaFill.setVisible(unit.alive && manaRatio > 0);
        manaFill.setDisplaySize(hudBarWidth * manaRatio, 12);
        manaText.setVisible(true).setText(unit.alive ? `${Math.floor(unit.mana)} / ${unit.maxMana} Mana` : '');
      } else {
        manaBack.setVisible(false);
        manaFill.setVisible(false);
        manaText.setVisible(false);
      }
    });

    this.updateEncounterStatus();
  }

  // This function uses warmer health colors to make injured allies easier to
  // spot.
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
    const wave = this.waves?.[this.currentWaveIndex];
    const waveLabel = wave?.boss ? wave.name : `Wave ${this.currentWaveIndex + 1}/${this.waves.length}`;
    this.encounterStatusText.setText(`(${elapsed}) ${waveLabel}`);
  }

  // This function draws attention to the party member taking enemy damage.
  flashPartyHudName(unit) {

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
      onComplete: () => {

        if (entry.nameText?.active) entry.nameText.setAlpha(1).setColor('#f5f5f4');
      }
    });
  }

  // This function commits the victory rewards and leads the player to the
  // reward screen.
  finishVictory() {

    if (this.battleOver) {
      return;
    }
    this.battleOver = true;
    this.combatLog?.finish('victory');

    // Commit encounter gold and progression before showing the button that
    // opens the reward screen.
    const gold = Math.max(1, this.earnedGold);
    GameState.gold += gold;
    GameState.currentRoom = this.waves.length;
    GameState.rewards = [{ type: 'gold', amount: gold, source: GameState.currentDelve?.name ?? 'Delve' }];
    const summary = completeExpedition();
    saveProfile();
    HapticsService.success();
    this.showResultOverlay('DELVE CLEARED!', `${GameState.currentDelve?.name ?? 'The Delve'} has been cleared.`, 'CONFIRM', () => {

      HapticsService.confirm();
      this.scene.start('RewardScene');
    });
  }

  // This function records the loss and offers the encounter summary.
  finishDefeat() {

    if (this.battleOver) return;
    this.battleOver = true;
    this.combatLog?.finish('defeat');
    failExpedition();
    this.showResultOverlay('DEFEATED', 'The party was driven back.', 'CONFIRM', () => {

      HapticsService.confirm();
      this.scene.start('EncounterSummaryScene');
    });
  }

  // This function pauses or resumes combat updates and the scene clock.
  togglePause() {

    if (this.battleOver) return;
    this.combatPaused = !this.combatPaused;
    this.time.paused = this.combatPaused;
    this.pauseButtonText?.setText(this.combatPaused ? 'RESUME' : 'PAUSE');
    this.pauseButton?.setFillStyle(this.combatPaused ? 0x3b321d : 0x1f2937);
    this.showBattleMessage(this.combatPaused ? 'PAUSED' : 'RESUMED', this.combatPaused ? '#fbbf24' : '#bef264');
    if (!this.combatPaused) this.flushPausedTactics();
    HapticsService.tap();
  }

  // This function ends combat as a retreat and sends the player to its
  // summary.
  fleeBattle() {

    if (this.battleOver) return;
    if (this.combatPaused) {
      this.combatPaused = false;
      this.time.paused = false;
    }
    this.battleOver = true;
    this.combatLog?.finish('fled');
    fleeExpedition();
    HapticsService.heavy();
    this.scene.start('EncounterSummaryScene');
  }

  // This function presents the encounter outcome and blocks further
  // battlefield taps.
  showResultOverlay(title, subtitle, buttonLabel, callback) {

    const { width, height } = this.scale;
    const centerY = height * 0.5;
    const victory = title === 'DELVE CLEARED!';

    // Place an invisible input blocker behind the result panel so taps cannot
    // reach the battlefield.
    const inputBlocker = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.001)
      .setInteractive()
      .setDepth(11999);
    inputBlocker.on('pointerdown', (pointer, localX, localY, event) => event?.stopPropagation?.());

    this.add.rectangle(width / 2, centerY, width * 0.78, 390, 0x0c0a09, 0.97)
      .setStrokeStyle(5, victory ? 0x84cc16 : 0xdc2626)
      .setDepth(12000);

    this.add.text(width / 2, centerY - 95, title, {
      fontFamily: 'Arial',
      fontSize: '78px',
      fontStyle: 'bold',
      color: victory ? '#bef264' : '#ef4444'
    }).setOrigin(0.5).setDepth(12001);

    this.add.text(width / 2, centerY - 22, subtitle, {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: '#d6d3d1'
    }).setOrigin(0.5).setDepth(12001);

    const button = this.add.rectangle(width / 2, centerY + 90, width * 0.58, 96, 0x44403c)
      .setInteractive({ useHandCursor: true })
      .setDepth(12001);

    this.add.text(width / 2, centerY + 90, buttonLabel, {
      fontFamily: 'Arial',
      fontSize: '38px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(12002);

    button.on('pointerdown', callback);
    button.on('pointerover', () => button.setFillStyle(0x57534e));
    button.on('pointerout', () => button.setFillStyle(0x44403c));
  }
}
