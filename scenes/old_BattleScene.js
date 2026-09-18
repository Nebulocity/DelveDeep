import { bindSelectionDetails, characterDetails, TONIC_DESCRIPTION } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { getEquippedAdventurer } from '../game/Equipment.js';
import enemies from '../data/enemies.js';
import { createEncounterWaves } from '../data/encounters.js';
import { leaderAbilities } from '../game/LeaderProgression.js';
import BattleUnit from '../combat/BattleUnit.js';
import BattlefieldGeometry from '../combat/BattlefieldGeometry.js';
import TacticsController from '../combat/TacticsController.js';
import CombatMovement from '../combat/CombatMovement.js';
import combatSpacing from '../config/combatSpacing.js';
import CombatLog from '../combat/CombatLog.js';
import HapticsService from '../services/HapticsService.js';
import { completeExpedition, failExpedition, fleeExpedition, formatDuration } from '../game/ExpeditionProgression.js';
import { saveProfile } from '../game/GameStorage.js';
import { getBattleLayout } from '../ui/Layout.js';

export default class BattleScene extends Phaser.Scene {

  // This function registers BattleScene so the game can navigate to this
  // screen.
  constructor() {

    super('BattleScene');
  }

  // Encounter visual data supplies only the assets needed by the selected
  // delve. Other delves retain the existing battlefield presentation.
  preload() {

    const background = GameState.currentDelve?.visuals?.battlefieldBackground;
    if (background?.key && background?.url && !this.textures.exists(background.key)) {
      this.load.image(background.key, background.url);
    }
  }

  // This function starts a new battle by resetting encounter state, creating
  // the perspective arena and combatants, and building the tactical controls.
  // It also starts the combat log and spawns the first enemy wave.
  create() {

    const { width, height } = this.scale;

    // Reset encounter flags, selections, movement orders, threat tables, and
    // leader cooldowns for a fresh battle.
    this.battleOver = false;
    this.waveTransitioning = false;
    this.activeTelegraphs = [];
    this.currentWaveIndex = -1;
    this.enemySerial = 0;
    this.earnedGold = 0;
    this.enemyThreat = new Map();
    this.enemies = [];
    this.lastTonicUseAt = -Infinity;
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
      bottomLeftX: 345,
      bottomRightX: width - 345,
      topLeftX: width * 0.29,
      topRightX: width * 0.71,
      bottomY: height * 0.775,
      topY: this.battleLayout.arenaTop,
      logicalWidth: 1400,
      logicalHeight: 900,
      columns: 8,
      rows: 6,
      nearScale: 1.05,
      farScale: 0.74
    });

    // Create the formation controller and copy the appropriate encounter wave
    // definitions.
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
    this.startWave(0);
  }


  // This function chooses the encounter waves and adds the depth milestone
  // guardian.
  buildEncounterWaves() {

    const waves = createEncounterWaves(GameState.currentDelve ?? {});

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
    }).setOrigin(0.5);

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
    }).setOrigin(0.5);
  }

  // This function draws the battlefield beneath its units and tactical
  // controls.
  createArena(width, height) {

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
    this.battlefield.drawPerspectiveFloor();
  }


  // This function brings the chosen adventurers into combat and binds unit
  // selection.
  createParty() {

    const party = GameState.activeParty.length > 0
      ? GameState.activeParty
      : GameState.roster.slice(0, 5);

    this.partyUnits = party.map((adventurer) => new BattleUnit(this, {
      ...getEquippedAdventurer(GameState.roster.find((hero) => hero.id === adventurer.id) ?? adventurer),
      battlefield: this.battlefield,
      arenaX: 500,
      arenaY: 110,
      isEnemy: false
    }));

    this.tactics.registerParty(this.partyUnits);
    this.partyUnits.forEach((unit, index) => {

      const spawn = this.tactics.getSpawnPosition(unit, index);
      unit.setArenaPosition(spawn.x, spawn.y);
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
    this.tonicCountText = this.add.text(70, height * 0.75, '', {
      fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: '#86efac'
    }).setOrigin(0, 0.5).setDepth(4501);
    this.tonicHintText = this.add.text(width / 2, height * 0.738, 'Tap TONIC to heal.', {
      fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: '#86efac'
    }).setOrigin(0.5).setDepth(4501);
    // this.add.text(width / 2, height * 0.765, 'Long-press / hold-click characters, tactics or orders for details.', {
    //   fontFamily: 'Arial', fontSize: '26px', color: '#cbd5e1'
    // }).setOrigin(0.5).setDepth(4501);
    this.hadHealingTonics = GameState.inventory.healingTonic > 0;
    this.tonicFlashUntil = 0;

    this.partyUnits.forEach((unit, index) => {

      const x = startX + index * sectionWidth;
      // Give the whole portrait/name/class area one generous touch target.
      // It sits behind the visible labels and stops above the separate TONIC
      // button, so selecting a character never accidentally uses a tonic.
      const statusHitZone = this.add.rectangle(x + sectionWidth / 2 - 6, hudTop + 70, sectionWidth - 20, 116, 0xffffff, 0.001)
        .setDepth(4500);
      bindSelectionDetails(this, statusHitZone, () => characterDetails(unit), () => this.toggleUnitSelection(unit));
      const portrait = this.add.circle(x, hudTop + 72, 36, unit.color).setDepth(4501);
      bindSelectionDetails(this, portrait, () => characterDetails(unit), () => this.toggleUnitSelection(unit));
      const tonicButton = this.add.rectangle(x, hudTop + 155, 120, 72, 0x14532d)
        .setStrokeStyle(2, 0x86efac).setDepth(4502);
      const tonicLabel = this.add.text(x, hudTop + 155, 'TONIC', {
        fontFamily: 'Arial', fontSize: '25px', fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0.5).setDepth(4503);
      bindSelectionDetails(this, tonicButton, { title: 'Healing Tonic', description: TONIC_DESCRIPTION }, () => this.useHealingTonic(unit));
      const nameText = this.add.text(x + 85, hudTop + 38, unit.name, {
        fontFamily:'Arial', fontSize:'39px', fontStyle:'bold', color:'#f5f5f4'
      }).setOrigin(0,0.5).setDepth(4501);
      this.add.text(x + 85, hudTop + 73, unit.className, {
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
      this.partyHud.push({statusHitZone,tonicButton,tonicLabel,unit,nameText,hpText,manaText,threatText,hpFill,hpGlow,manaBack,manaFill,hudBarWidth});
    });
    this.updateTonicHud();
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
    // Add All above the existing role rows so Pause, Flee, and the tonic
    // inventory line keep their current spacing above the party HUD.
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

      if (!enemy.alive) return;
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
    this.partyUnits?.forEach((u)=>u.body.setStrokeStyle(this.selectedUnitIds.has(u.id)?7:4,this.selectedUnitIds.has(u.id)?0x60a5fa:(u.isEnemy?0x365314:0x1c1917)));
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

        const point = positions[index];
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

      const point = positions[index];
      unit.spacingMode = 'normal';
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
    const fallen = this.partyUnits.filter((unit) => !unit.alive);
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
    } else if (id === 'preparedSupplies') {
      GameState.inventory.healingTonic = Math.max(0, GameState.inventory.healingTonic ?? 0) + ability.tonicAmount;
      saveProfile();
      this.updateTonicHud();
      this.showBattleMessage(`+${ability.tonicAmount} HEALING TONIC (${GameState.inventory.healingTonic} TOTAL)`, '#bef264', false, 1.5);
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

  // This function introduces the next enemy group or finishes a fully cleared
  // encounter.
  startWave(index) {

    if (index >= this.waves.length) {
      this.finishVictory();
      return;
    }

    this.currentWaveIndex = index;
    GameState.currentRoom = index;
    const wave = this.waves[index];
    this.updateEncounterStatus();
    this.showBattleMessage(`WAVE ${index + 1}: ${wave.name}`, '#fb923c');
    this.combatLog?.add('wave', `Wave ${index + 1} started: ${wave.name}`, { wave: index + 1 });

    this.enemies = wave.enemies.map((spawn, spawnIndex) => this.createEnemy(spawn.type, spawn, spawnIndex));
    this.attackTargets.clear();
    this.setTargetingInputState(['ATTACK', 'FOCUS', 'INTERRUPT'].includes(this.commandMode));
    this.waveTransitioning = false;

    if (wave.boss) {
      this.showBattleMessage('BOSS INCOMING', '#f97316');
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
      battlefield: this.battlefield,
      arenaX: spawn.arenaX + Phaser.Math.Between(-30, 30),
      arenaY: spawn.arenaY + Phaser.Math.Between(-22, 22),
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
    this.enemyThreat.set(enemy.id, new Map(this.partyUnits.map((unit) => [unit.id, 0])));
    return enemy;
  }

  // This function advances one frame of combat while the encounter is active.
  // It updates resources and actions, runs party and enemy decisions,
  // separates crowded units, and checks for a cleared wave or defeated party.
  update(time, delta) {

    this.updateTonicHud();
    if (this.battleOver || this.waveTransitioning || this.combatPaused) {
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
      this.completeWave();
      return;
    }

    // Run party decisions, resolve crowding, and then let enemies choose
    // their actions.
    this.partyUnits.forEach((unit) => this.updatePartyUnit(unit, time, deltaSeconds));
    this.updateEnemies(time, deltaSeconds);
    this.movement.separate(deltaSeconds);

    this.partyUnits.forEach((unit) => unit.clampToBattlefield(38, 20));
    livingEnemies.forEach((enemy) => enemy.clampToBattlefield(60, 20));

    this.tryUseHealingTonic(time);
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


  // This function automatically spends a tonic on a critically injured party
  // member.
  tryUseHealingTonic(time) {

    if (GameState.inventory.healingTonic <= 0 || time - this.lastTonicUseAt < 1500) {
      return;
    }

    // Choose the living ally with the lowest health fraction among those at
    // or below the tonic threshold.
    const target = this.partyUnits
      .filter((unit) => unit.alive && unit.hp / unit.maxHp <= 0.35)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];

    if (!target) {
      return;
    }

    this.useHealingTonic(target, time);
  }

  // Manual and automatic use share validation, inventory and cooldown.
  canUseHealingTonic(target, time = this.time.now) {
    return !this.battleOver && !this.combatPaused && !this.waveTransitioning
      && this.partyUnits.includes(target) && target.alive && target.hp < target.maxHp
      && GameState.inventory.healingTonic > 0 && time - this.lastTonicUseAt >= 1500;
  }

  useHealingTonic(target, time = this.time.now) {
    if (!this.canUseHealingTonic(target, time)) return false;
    this.lastTonicUseAt = time;
    GameState.inventory.healingTonic -= 1;
    const before = target.hp;
    target.heal(Math.max(1, Math.round(target.maxHp * 0.35)));
    const amount = target.hp - before;
    target.flash(0x86efac);
    this.createFloatingText(target.x, target.y - 100, `TONIC +${amount}`, '#86efac', true);
    this.showBattleMessage(`${target.name} drinks a Healing Tonic`, '#86efac');
    this.combatLog?.add('item', `${target.name} restored ${amount} HP with a Healing Tonic`, { target: target.name, healing: amount });
    HapticsService.confirm();
    saveProfile();
    this.updateHud();
    return true;
  }

  // This function excludes defeated enemies from active combat decisions.
  getLivingEnemies() {

    return this.enemies.filter((enemy) => enemy.alive);
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

    this.runClassPassive(unit, time);
    if (unit.role === 'Tank') this.tryTankTaunts(unit, time);

    if (this.applyManualMovement(unit, deltaSeconds)) return;
    if (!this.isPositionLocked(unit) && this.tryEvadeTelegraph(unit, deltaSeconds)) return;

    const ordered = this.getLivingEnemies().find((enemy) => enemy.id === this.attackTargets.get(unit.id));
    if (!ordered) this.attackTargets.delete(unit.id);
    if (ordered && unit.role !== 'Tank' && !this.isEnemyEngaged(ordered)) return;

    // Explicit Attack orders chase the chosen enemy into usable range.
    // Healers use basic attacks for this order, never healing spells as
    // damage.
    if (ordered && unit.canStartAction(time)) {
      this.movement.moveToCombatPosition(unit, ordered, time, deltaSeconds);
    }
    if (ordered && unit.role === 'Healer') {
      if (unit.distanceTo(ordered) <= unit.attackRange && unit.canAttack(time)) {
        this.beginBasicAttack(unit, ordered, time, 'ranged');
      }
      return;
    }

    if (unit.role === 'Healer') {
      this.updateHealerUnit(unit, time, deltaSeconds);
      return;
    }

    const target = this.getPrimaryTarget(unit);
    if (!target) return;

    this.tryClassUtility(unit, target, time);

    if (unit.role === 'Tank') {
      this.updateTankUnit(unit, target, time, deltaSeconds);
    } else if (unit.role === 'Melee DPS') {
      this.updateMeleeUnit(unit, target, time, deltaSeconds);
    } else {
      this.updateRangedUnit(unit, target, time, deltaSeconds);
    }
  }

  // Melee reach is measured from centers in the combat data. Extend it only
  // by the shared visual-clearance allowance so a readable melee slot can
  // still resolve its attack without changing ranged combat ranges.
  isWithinAttackReach(attacker, target, padding = 0) {
    const meleePadding = this.movement.isMelee(attacker) ? combatSpacing.meleeReachPadding : 0;
    return attacker.distanceTo(target) <= attacker.attackRange + meleePadding + padding;
  }

  // This function applies the Naturalist aura when its healing interval comes
  // around.
  runClassPassive(unit, time) {

    if (unit.className !== 'Naturalist') return;
    const passive = unit.abilities?.passive;
    if (!passive || time - (unit.lastAbilityAt.natureAura ?? -Infinity) < passive.interval) return;

    unit.lastAbilityAt.natureAura = time;
    this.announceAbility(unit, passive.name, '#86efac');
    this.partyUnits.filter((ally) => ally.alive).forEach((ally) => {

      ally.heal(passive.power);
      this.createFloatingText(ally.x, ally.y - 74, `+${passive.power}`, '#86efac');
    });
  }

  // This function selects the support effect associated with the adventurer's
  // class. Each branch checks its own conditions before spending mana,
  // starting the utility cooldown, and applying the configured buff or
  // debuff.
  tryClassUtility(unit, target, time) {

    const utility = unit.abilities?.utility;
    if (!utility || !unit.abilityReady('utility', time)) return;

    // Protect an injured eligible ally, while limiting this Paladin shield
    // use to once per delve.
    if (unit.className === 'Paladin') {
      const ally = this.partyUnits
        .filter((candidate) => candidate.alive && !candidate.delvesUsed?.protectiveShield)
        .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      if (!ally || ally.hp / ally.maxHp > 0.42 || unit.delvesUsed.protectiveShield) return;
      unit.delvesUsed.protectiveShield = true;
      this.announceAbility(unit, utility.name, '#fde68a');
      unit.markAbilityUsed('utility', time);
      ally.status.shieldUntil = time + utility.duration;
      this.createFloatingText(ally.x, ally.y - 100, 'PROTECTED', '#fde68a', true);
      return;
    }

    // Apply a temporary blind that gives the target a chance to miss attacks.
    if (unit.className === 'Gladiator') {
      this.announceAbility(unit, utility.name, '#fde68a');
      unit.markAbilityUsed('utility', time);
      target.status.blindUntil = time + utility.duration;
      target.status.blindChance = utility.missChance;
      this.createFloatingText(target.x, target.y - 96, 'BLINDED', '#fde68a');
      return;
    }

    // Reduce the target's outgoing damage for the configured duration.
    if (unit.className === 'Guardian') {
      this.announceAbility(unit, utility.name, '#86efac');
      unit.markAbilityUsed('utility', time);
      target.status.outgoingDamageReductionUntil = time + utility.duration;
      target.status.outgoingDamageReduction = utility.damageReduction;
      this.createFloatingText(target.x, target.y - 96, 'WITHERED', '#86efac');
      return;
    }

    // Use the damage-boosting roar only when at least two living allies are
    // in its radius.
    if (unit.className === 'Barbarian') {
      const nearbyAllies = this.partyUnits.filter((ally) => ally.alive && unit.distanceTo(ally) <= utility.radius);
      if (nearbyAllies.length < 2) return;
      this.announceAbility(unit, utility.name, '#fb923c');
      unit.markAbilityUsed('utility', time);
      nearbyAllies.forEach((ally) => {

        ally.status.damageBoostUntil = time + utility.duration;
        ally.status.damageBoost = utility.damageBoost;
      });
      this.createFloatingText(unit.x, unit.y - 105, 'WAR ROAR!', '#fb923c', true);
      return;
    }

    // Use the emergency shield at low health and apply its accompanying spell
    // lock.
    if (unit.className === 'Wizard') {
      if (unit.hp / unit.maxHp > 0.35) return;
      this.announceAbility(unit, utility.name, '#93c5fd');
      unit.markAbilityUsed('utility', time);
      unit.status.arcaneShieldUntil = time + utility.duration;
      unit.status.spellLockUntil = time + utility.silenceDuration;
      this.createFloatingText(unit.x, unit.y - 105, 'ARCANE SHIELD', '#93c5fd', true);
      return;
    }

    // Mark the enemy to increase the damage it takes during the effect.
    if (unit.className === 'Ranger') {
      this.announceAbility(unit, utility.name, '#fbbf24');
      unit.markAbilityUsed('utility', time);
      target.status.damageTakenBoostUntil = time + utility.duration;
      target.status.damageTakenBoost = utility.damageTakenBoost;
      this.createFloatingText(target.x, target.y - 96, "HUNTER'S MARK", '#fbbf24');
      return;
    }

    // Apply both increased incoming damage and reduced outgoing damage to the
    // cursed target.
    if (unit.className === 'Bloodwarder') {
      this.announceAbility(unit, utility.name, '#f87171');
      unit.markAbilityUsed('utility', time);
      target.status.damageTakenBoostUntil = time + utility.duration;
      target.status.damageTakenBoost = utility.damageTakenBoost;
      target.status.outgoingDamageReductionUntil = time + utility.duration;
      target.status.outgoingDamageReduction = utility.damageReduction;
      this.createFloatingText(target.x, target.y - 96, 'BLOOD CURSE', '#f87171');
    }
  }

  // This function uses ready tank taunts to recover nearby enemies that are
  // not already targeting the tank. A group pull takes priority when several
  // enemies qualify; cooldowns start only after a successful pull.
  tryTankTaunts(tank, time) {

    if (!tank.canStartAction(time)) return;
    const candidates = this.getLivingEnemies()
      .filter((enemy) => enemy.currentTargetId !== tank.id)
      .sort((a, b) => tank.distanceTo(a) - tank.distanceTo(b));

    // Prefer the area taunt for groups, saving it for later when a single
    // enemy can be handled by the shorter cooldown instead.
    const area = tank.abilities.areaTaunt;
    const nearby = candidates.filter((enemy) => tank.distanceTo(enemy) <= (area?.range ?? 0));
    const single = tank.abilities.taunt;
    if (nearby.length >= 2 && tank.abilityReady('areaTaunt', time)) {
      this.applyTankTaunt(tank, nearby.slice(0, area.targets), 'areaTaunt', time);
    } else if (single && tank.abilityReady('taunt', time)) {
      const enemy = candidates.find((candidate) => tank.distanceTo(candidate) <= single.range);
      if (enemy) this.applyTankTaunt(tank, [enemy], 'taunt', time);
    } else if (nearby.length > 0 && tank.abilityReady('areaTaunt', time)) {
      this.applyTankTaunt(tank, nearby.slice(0, area.targets), 'areaTaunt', time);
    }
  }

  // This function raises the tank above each target's existing threat and
  // redirects it immediately. Canceling its old action prevents a queued
  // attack from still hitting the ally the taunt just protected.
  applyTankTaunt(tank, enemies, key, time) {

    tank.markAbilityUsed(key, time);
    this.announceAbility(tank, tank.abilities[key].name, '#fde68a');
    enemies.forEach((enemy) => {

      const table = this.enemyThreat.get(enemy.id);
      const highest = Math.max(0, ...table.values());
      table.set(tank.id, highest + 1);
      enemy.engagedByTank = true;
      enemy.finishAction();
      this.activeTelegraphs.filter((telegraph) => telegraph.attacker === enemy)
        .forEach((telegraph) => this.removeTelegraph(telegraph));
      this.setEnemyTarget(enemy, tank, tank.abilities[key].name);
    });
  }

  // This function lets tanks approach and attack while respecting held
  // positions.
  updateTankUnit(unit, target, time, deltaSeconds) {

    // Approach a reserved position within attack range, never the target center.
    if (!this.attackTargets.has(unit.id) && !this.isPositionLocked(unit) && unit.canStartAction(time)) {
      this.movement.moveToCombatPosition(unit, target, time, deltaSeconds);
    }

    if (!this.isWithinAttackReach(unit, target, 24)) return;

    const primary = unit.abilities?.primary;
    if (primary && unit.abilityReady('primary', time)) {
      if (primary.aoe) this.beginAoeDamageAbility(unit, target, 'primary', time, 'melee');
      else this.beginDamageAbility(unit, target, 'primary', time, 'melee');
    } else if (unit.canAttack(time)) {
      this.beginBasicAttack(unit, target, time, 'melee');
    }
  }

  // This function manages melee attacks and Rogue retreat windows for
  // re-stealth.
  updateMeleeUnit(unit, target, time, deltaSeconds) {

    // Re-stealth depends on time since dealing or receiving damage. A
    // retreating Rogue moves away to try to create that quiet window.
    if (!this.attackTargets.has(unit.id) && unit.className === 'Rogue' && !unit.stealthed && unit.seekingRestealth) {
      const quietFor = time - Math.max(unit.lastDealtDamageAt ?? -Infinity, unit.lastTakenDamageAt ?? -Infinity);
      if (quietFor >= 5000) {
        unit.setStealthed(true);
        unit.seekingRestealth = false;
        this.announceAbility(unit, 'STEALTH', '#c4b5fd');
      } else if (!this.isPositionLocked(unit) && !unit.isBusy(time)) {
        const nearest = this.getLivingEnemies().sort((a, b) => unit.distanceTo(a) - unit.distanceTo(b))[0];
        if (nearest) unit.moveAwayFrom(nearest.arenaX, nearest.arenaY, deltaSeconds, 320);
        return;
      }
    }

    if (!this.attackTargets.has(unit.id)) {
      this.movement.moveToCombatPosition(unit, target, time, deltaSeconds);
    }

    if (!this.isWithinAttackReach(unit, target, 28)) return;

    const primary = unit.abilities?.primary;
    if (primary && unit.abilityReady('primary', time)) {
      if (primary.aoe) this.beginAoeDamageAbility(unit, target, 'primary', time, 'melee');
      else this.beginDamageAbility(unit, target, 'primary', time, 'melee');
    } else if (unit.canAttack(time)) {
      this.beginBasicAttack(unit, target, time, 'melee');
    }
  }

  // This function manages ranged positioning and chooses available attacks or
  // spells.
  updateRangedUnit(unit, target, time, deltaSeconds) {

    if (!this.attackTargets.has(unit.id)) {
      this.movement.moveToCombatPosition(unit, target, time, deltaSeconds);
    }

    if (unit.className === 'Ranger') this.tryRangerTrap(unit, target, time);
    if (!this.isWithinAttackReach(unit, target)) return;
    if (!unit.canCast(time) && unit.className === 'Wizard') return;

    if (unit.className === 'Wizard') {
      const close = unit.distanceTo(target) <= 145;
      if (close && unit.abilityReady('close', time)) {
        this.beginAoeDamageAbility(unit, target, 'close', time, 'spell');
        return;
      }
      if (unit.abilityReady('primary', time)) {
        this.beginAoeDamageAbility(unit, target, 'primary', time, 'spell');
        return;
      }
      if (unit.abilityReady('secondary', time)) {
        this.beginDamageAbility(unit, target, 'secondary', time, 'spell');
        return;
      }
    } else {
      const primary = unit.abilities?.primary;
      if (primary && unit.abilityReady('primary', time)) {
        if (primary.aoe) this.beginAoeDamageAbility(unit, target, 'primary', time, 'ranged');
        else this.beginDamageAbility(unit, target, 'primary', time, 'ranged');
        return;
      }
    }

    if (unit.canAttack(time)) this.beginBasicAttack(unit, target, time, 'ranged');
  }

  // This function prioritizes wounded allies while keeping healers in
  // supporting range.
  updateHealerUnit(unit, time, deltaSeconds) {

    const priorityTarget = this.getHealerPriorityTarget(unit);
    const injured = priorityTarget ?? this.getMostInjuredPartyMember();
    const nearestEnemy = this.getLivingEnemies().sort((a, b) => unit.distanceTo(a) - unit.distanceTo(b))[0];
    const canReposition = !this.isPositionLocked(unit) && unit.canStartAction(time);
    // Retreat from immediate danger even while supporting an injured ally.
    const retreating = canReposition && nearestEnemy
      && this.movement.maintainRange(unit, nearestEnemy, deltaSeconds, true);

    if (injured && (priorityTarget || injured.hp / injured.maxHp < 0.84)) {
      if (canReposition && !retreating && unit.distanceTo(injured) > unit.healRange * 0.9) {
        unit.moveToward(injured.arenaX, injured.arenaY, deltaSeconds, unit.healRange * 0.72);
      }

      if (unit.distanceTo(injured) <= unit.healRange) {
        const primary = unit.abilities?.primary;
        if (primary && injured.hp / injured.maxHp < 0.62 && unit.abilityReady('primary', time)) {
          if (unit.className === 'Naturalist') this.beginMultiHeal(unit, time, primary);
          else this.beginHealAbility(unit, injured, 'primary', time);
        } else if (unit.canHeal(time)) {
          this.beginBasicHeal(unit, injured, time);
        }
      }
      return;
    }

    if (nearestEnemy && canReposition && !retreating) {
      this.movement.maintainRange(unit, nearestEnemy, deltaSeconds);
    }

    const target = this.getPrimaryTarget(unit);
    if (!target) return;

    this.tryClassUtility(unit, target, time);
    if (unit.className === 'Priest' && unit.abilityReady('utility', time) && unit.canCast(time)) {
      unit.markAbilityUsed('utility', time);
      const burst = unit.abilities.utility;
      this.beginInstantDamage(unit, target, burst.power, 'holy', burst.name);
      return;
    }

    if (this.isWithinAttackReach(unit, target) && unit.canAttack(time)) {
      this.beginBasicAttack(unit, target, time, unit.className === 'Bloodwarder' ? 'spell' : 'holy');
    }
  }

  // This function lets Rangers control nearby enemies with their configured
  // trap.
  tryRangerTrap(unit, target, time) {

    const trap = unit.abilities?.trap;
    if (!trap || time - (unit.lastAbilityAt.trap ?? -Infinity) < trap.cooldown || unit.isBusy(time)) return;
    if (!unit.spendMana(trap.manaCost ?? 0)) return;
    unit.lastAbilityAt.trap = time;
    unit.trapCycle = ((unit.trapCycle ?? -1) + 1) % 3;

    if (unit.trapCycle === 0) {
      this.announceAbility(unit, 'Freezing Trap', '#93c5fd');
      target.status.stunnedUntil = time + 15000;
      this.createFloatingText(target.x, target.y - 96, 'FROZEN', '#93c5fd');
    } else if (unit.trapCycle === 1) {
      this.announceAbility(unit, 'Explosive Trap', '#fb923c');
      this.getLivingEnemies().filter((enemy) => enemy.distanceTo(target) <= 145).forEach((enemy) => {

        this.resolveDamage(unit, enemy, 18, 'ranged', 0.6, 'Explosive Trap', false);
      });
    } else {
      this.announceAbility(unit, 'Smoke Trap', '#cbd5e1');
      this.getLivingEnemies().filter((enemy) => enemy.distanceTo(target) <= 145).forEach((enemy) => {

        enemy.status.blindUntil = time + 15000;
        enemy.status.blindChance = 0.5;
      });
      this.createFloatingText(target.x, target.y - 96, 'SMOKE TRAP', '#cbd5e1');
    }
  }

  // This function winds up an area attack before resolving nearby victims.
  beginAoeDamageAbility(attacker, target, key, time, attackType) {

    const ability = attacker.abilities[key];
    if (!ability || !attacker.startAction(ability.name, time, ability.windup)) return;

    this.announceAbility(attacker, ability.name, attackType === 'spell' ? '#93c5fd' : '#fbbf24');
    this.logActionStart(attacker, target, ability.name);
    attacker.markAbilityUsed(key, time);
    if (ability.healthCost) {
      const cost = Math.max(1, Math.round(attacker.maxHp * ability.healthCost));
      attacker.hp = Math.max(1, attacker.hp - cost);
      attacker.updateHealthBar();
      this.createFloatingText(attacker.x, attacker.y - 80, `-${cost}`, '#f87171');
    }

    const action = attacker.pendingAction;
    this.time.delayedCall(ability.windup, () => {

      if (!this.isActionCurrent(attacker, action)) return;
      const victims = this.getLivingEnemies().filter((enemy) => enemy.distanceToPoint(target.arenaX, target.arenaY) <= ability.radius);
      let total = 0;
      victims.forEach((enemy) => {

        this.resolveDamage(attacker, enemy, ability.power, attackType, ability.threatMultiplier ?? attacker.threatMultiplier, ability.name);
        total += ability.power;
      });
      if (ability.lifeSteal && total > 0) attacker.heal(Math.max(1, Math.round(total * ability.lifeSteal)));
      attacker.finishAction();
    });
  }

  // This function winds up a group heal and chooses injured allies when it
  // resolves.
  beginMultiHeal(healer, time, ability) {

    if (!healer.startAction(ability.name, time, ability.windup)) return;
    this.announceAbility(healer, ability.name, '#86efac');
    this.logActionStart(healer, null, ability.name);
    healer.markAbilityUsed('primary', time);
    const action = healer.pendingAction;
    this.time.delayedCall(ability.windup, () => {

      if (!this.isActionCurrent(healer, action)) return;
      const targets = this.partyUnits
        .filter((unit) => unit.alive && unit.hp < unit.maxHp)
        .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))
        .slice(0, ability.targets ?? 3);
      targets.forEach((target) => this.resolveHeal(healer, target, ability.power, ability.name));
      healer.finishAction();
    });
  }

  // This function announces and resolves an attack that does not need a
  // windup.
  beginInstantDamage(attacker, target, power, attackType, abilityName) {

    this.announceAbility(attacker, abilityName, attackType === 'holy' ? '#fde68a' : '#93c5fd');
    this.logActionStart(attacker, target, abilityName);
    this.resolveDamage(attacker, target, power, attackType, attacker.threatMultiplier, abilityName);
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
    if (!unit.alive || this.battleOver || (target && !target.alive)) {
      unit.finishAction();
      return false;
    }
    return true;
  }

  // This function winds up a basic attack and rechecks its target before the
  // hit.
  beginBasicAttack(attacker, target, time, attackType) {

    if (!attacker.startAction('Attack', time, attacker.attackWindup)) {
      return;
    }

    attacker.lastAttackAt = time;
    if (attacker.isEnemy) this.setEnemyTarget(attacker, target, 'highest threat');
    this.logActionStart(attacker, target, 'Attack');
    const action = attacker.pendingAction;
    this.time.delayedCall(attacker.attackWindup, () => {

      if (!this.isActionCurrent(attacker, action, target)) return;
      if (this.isWithinAttackReach(attacker, target, 28)) {
        this.resolveDamage(attacker, target, attacker.attackPower, attackType, attacker.threatMultiplier, 'Attack');
      }
      attacker.finishAction();
    });
  }

  // This function commits a damage ability and resolves its hit after the
  // windup.
  beginDamageAbility(attacker, target, key, time, attackType) {

    const ability = attacker.abilities[key];
    if (!ability || !attacker.startAction(ability.name, time, ability.windup)) {
      return;
    }

    this.announceAbility(attacker, ability.name, attackType === 'spell' ? '#93c5fd' : attackType === 'ranged' ? '#86efac' : '#fbbf24');
    this.logActionStart(attacker, target, ability.name);
    attacker.markAbilityUsed(key, time);
    if (ability.healthCost) {
      const cost = Math.max(1, Math.round(attacker.maxHp * ability.healthCost));
      attacker.hp = Math.max(1, attacker.hp - cost);
      attacker.updateHealthBar();
      this.createFloatingText(attacker.x, attacker.y - 80, `-${cost}`, '#f87171');
    }

    const action = attacker.pendingAction;
    this.time.delayedCall(ability.windup, () => {

      if (!this.isActionCurrent(attacker, action, target)) return;
      const rangePadding = attackType === 'spell' ? 50 : 30;
      if (this.isWithinAttackReach(attacker, target, rangePadding)) {
        this.resolveDamage(
          attacker,
          target,
          ability.power,
          attackType,
          ability.threatMultiplier ?? attacker.threatMultiplier,
          ability.name
        );
        if (ability.lifeSteal) attacker.heal(Math.max(1, Math.round(ability.power * ability.lifeSteal)));
        if (ability.bleedPower && target.alive) this.applyBleed(attacker, target, ability);
      }
      attacker.finishAction();
    });
  }

  // This function spreads bleed damage across timed ticks that cannot
  // critically hit.
  applyBleed(attacker, target, ability) {

    for (let tick = 1; tick <= ability.bleedTicks; tick += 1) {
      this.time.delayedCall(ability.bleedInterval * tick, () => {

        if (!attacker.alive || !target.alive || this.battleOver) return;
        this.resolveDamage(attacker, target, ability.bleedPower, 'melee', 0.35, 'Bleed', false);
      });
    }
  }

  // This function announces an enemy cast and resolves it if the action
  // remains valid.
  beginEnemyAbility(attacker, target, key, time) {

    const ability = attacker.abilities[key];
    if (!ability || !attacker.startAction(ability.name, time, ability.windup)) {
      return;
    }
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

  // This function pays for a basic heal and resolves it after its casting
  // time.
  beginBasicHeal(healer, target, time) {

    if (healer.maxMana > 0 && healer.mana < healer.basicHealManaCost) return;
    if (!healer.startAction('Mend', time, healer.healWindup)) {
      return;
    }
    if (!healer.spendMana(healer.basicHealManaCost)) { healer.finishAction(); return; }
    this.announceAbility(healer, 'Mend', '#86efac');
    this.logActionStart(healer, target, 'Mend');
    healer.lastHealAt = time;
    const action = healer.pendingAction;
    this.time.delayedCall(healer.healWindup, () => {

      if (!this.isActionCurrent(healer, action, target)) return;
      if (healer.distanceTo(target) <= healer.healRange + 30) {
        this.resolveHeal(healer, target, healer.healPower, 'Mend');
      }
      healer.finishAction();
    });
  }

  // This function commits a healing ability and checks its target after the
  // windup.
  beginHealAbility(healer, target, key, time) {

    const ability = healer.abilities[key];
    if (!ability || !healer.startAction(ability.name, time, ability.windup)) {
      return;
    }
    this.announceAbility(healer, ability.name, '#86efac');
    this.logActionStart(healer, target, ability.name);
    healer.markAbilityUsed(key, time);
    if (ability.healthCost) {
      const cost = Math.max(1, Math.round(healer.maxHp * ability.healthCost));
      healer.hp = Math.max(1, healer.hp - cost);
      healer.updateHealthBar();
      this.createFloatingText(healer.x, healer.y - 80, `-${cost}`, '#f87171');
    }
    const action = healer.pendingAction;
    this.time.delayedCall(ability.windup, () => {

      if (!this.isActionCurrent(healer, action, target)) return;
      if (healer.distanceTo(target) <= healer.healRange + 40) {
        this.resolveHeal(healer, target, ability.power, ability.name);
      }
      healer.finishAction();
    });
  }

  // This function starts an enemy area attack and draws a warning at the
  // target's current position. After the warning delay, it damages living
  // party members still inside that fixed area and removes the warning.
  beginGroundSlam(attacker, target, time, ability) {

    if (!attacker.startAction(ability.name, time, ability.telegraph)) {
      return;
    }
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

    return allowCrit && Math.random() < (attacker.critChance ?? 0);
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
    if (now < (attacker.status.blindUntil ?? 0) && Math.random() < (attacker.status.blindChance ?? 0)) {
      this.createFloatingText(target.x, target.y - 82, 'MISS', '#cbd5e1', false, 'miss');
      this.combatLog?.add('miss', `${attacker.name}'s ${abilityName} missed ${target.name}`, {
        wave: this.currentWaveIndex + 1,
        actor: attacker.name,
        target: target.name,
        ability: abilityName
      });
      return;
    }

    // Roll the critical result and apply outgoing damage bonuses or
    // penalties.
    const critical = this.rollCritical(attacker, allowCrit);
    let amount = Math.round(baseAmount * (critical ? attacker.critMultiplier : 1));

    if (!attacker.isEnemy && now < (attacker.status.damageBoostUntil ?? 0)) {
      amount = Math.round(amount * (1 + (attacker.status.damageBoost ?? 0)));
    }
    if (attacker.isEnemy && now < (attacker.status.outgoingDamageReductionUntil ?? 0)) {
      amount = Math.round(amount * Math.max(0, 1 - (attacker.status.outgoingDamageReduction ?? 0)));
    }
    if (!attacker.isEnemy && attackType === 'melee' && now < (target.status.armorExposeUntil ?? 0)) {
      amount = Math.round(amount * (1 + (target.status.armorReduction ?? 0)));
    }

    // Consume a stealthed Rogue opener, expose the target, and begin seeking
    // the next re-stealth opportunity.
    if (!attacker.isEnemy && attacker.className === 'Rogue' && attacker.stealthed) {
      const opener = attacker.abilities?.opener;
      if (opener) {
        amount = Math.round(amount * opener.multiplier);
        target.status.armorExposeUntil = now + opener.duration;
        target.status.armorReduction = opener.armorReduction;
        attacker.setStealthed(false);
        attacker.seekingRestealth = true;
        this.createFloatingText(attacker.x, attacker.y - 110, 'AMBUSH!', '#c4b5fd', true);
      }
    }

    if (!attacker.isEnemy && now < this.assaultUntil) amount = Math.round(amount * (1 + this.assaultBonus));
    if (attacker.isEnemy && !target.isEnemy && now < this.braceUntil) amount = Math.max(1, Math.round(amount * (1 - this.braceReduction)));

    // Let the target apply its defenses, then measure actual health loss for
    // the combat log.
    const ranged = attackType === 'spell' || attackType === 'ranged' || attacker.attackRange > 180;
    const hpBefore = target.hp;
    target.takeDamage(amount, { time: now, ranged });
    const actualDamage = hpBefore - target.hp;

    // Update the combat interaction timestamps used by the Rogue quiet-time
    // rule.
    if (amount > 0) {
      attacker.lastCombatActionAt = now;
      target.lastCombatActionAt = now;
      attacker.lastDealtDamageAt = now;
      target.lastTakenDamageAt = now;
    }

    if (target.isEnemy && now < (target.status.stunnedUntil ?? 0) && amount > 0) {
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
          this.addThreat(enemy, attacker, amount * threatMultiplier);
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
  }

  // This function applies a heal, including its critical roll, and measures
  // how much health was actually restored for feedback and the combat log.
  // Healing generates threat only on enemies already engaged by a tank.
  resolveHeal(healer, target, baseAmount, abilityName) {

    const critical = this.rollCritical(healer, true);
    const amount = Math.round(baseAmount * (critical ? healer.critMultiplier : 1));
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

    // Enemies remain in the wave array for reward accounting and delayed
    // action checks, but their battlefield body should not occupy the scene
    // after defeat. Floating damage text is separate and can finish normally.
    enemy.hitZone?.disableInteractive?.();
    enemy.container?.destroy?.();
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

    const living = this.partyUnits.filter((unit) => unit.alive);
    if (living.length === 0) {
      return null;
    }
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
    this.activeTelegraphs.forEach((telegraph) => this.removeTelegraph(telegraph));
    this.showBattleMessage('WAVE CLEARED', '#bef264');
    this.combatLog?.add('wave', `Wave ${this.currentWaveIndex + 1} cleared`, { wave: this.currentWaveIndex + 1 });
    this.combatLog?.persist();

    this.enemies.filter((enemy) => enemy.container?.active !== false).forEach((enemy) => {

      this.tweens.add({
        targets: enemy.container,
        alpha: 0,
        duration: 500,
        onComplete: () => enemy.container.destroy()
      });
    });

    if (this.currentWaveIndex + 1 >= this.waves.length) {
      this.time.delayedCall(900, () => this.finishVictory());
    } else {
      this.time.delayedCall(1200, () => this.startWave(this.currentWaveIndex + 1));
    }
  }

  // Watch the shared inventory so any source of Tonics restores the controls.
  // Three gentle pulses announce newly available stock without moving targets.
  updateTonicHud() {
    const hasTonics = GameState.inventory.healingTonic > 0;
    const now = this.time.now;
    if (hasTonics && this.hadHealingTonics === false) this.tonicFlashUntil = now + 1500;
    if (!hasTonics) this.tonicFlashUntil = 0;
    this.hadHealingTonics = hasTonics;
    const remaining = Math.max(0, (this.tonicFlashUntil ?? 0) - now);
    const alpha = remaining > 0 ? 0.7 + 0.3 * Math.cos(remaining * Math.PI * 2 / 500) : 1;
    this.tonicHintText?.setVisible(hasTonics).setAlpha(alpha);
    this.tonicCountText?.setText(`Healing Tonics: ${GameState.inventory.healingTonic}`).setVisible(hasTonics);
    this.partyHud?.forEach(({ unit, tonicButton, tonicLabel }) => {
      const ready = this.canUseHealingTonic(unit);
      tonicButton?.setVisible(hasTonics).setAlpha(alpha).setFillStyle(ready ? 0x14532d : 0x292524);
      if (tonicButton?.input) tonicButton.input.enabled = hasTonics;
      tonicLabel?.setVisible(hasTonics).setAlpha(alpha * (ready ? 1 : 0.45));
    });
  }

  // This function refreshes party resources and encounter progress as combat
  // changes.
  updateHud() {

    this.updateLeaderLoadoutBar();
    this.updateTonicHud();
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

  // This function shows the run timer beside the current wave and enemy
  // group.
  updateEncounterStatus() {

    if (!this.encounterStatusText || this.currentWaveIndex < 0) return;
    const elapsed = formatDuration(Date.now() - (GameState.run.startedAt || Date.now()));
    const wave = this.waves?.[this.currentWaveIndex];
    const waveName = wave?.name ?? '';
    this.encounterStatusText.setText(`(${elapsed}) Wave ${this.currentWaveIndex + 1}/${this.waves.length} - ${waveName}`);
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
    this.showResultOverlay('VICTORY', `${GameState.currentDelve?.name ?? 'The Delve'} has been cleared.`, 'COLLECT REWARDS', () => {

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
    this.showResultOverlay('DEFEAT', 'The party was driven back.', 'ENCOUNTER SUMMARY', () => {

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

    // Place an invisible input blocker behind the result panel so taps cannot
    // reach the battlefield.
    const inputBlocker = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.001)
      .setInteractive()
      .setDepth(5999);
    inputBlocker.on('pointerdown', (pointer, localX, localY, event) => event?.stopPropagation?.());

    this.add.rectangle(width / 2, centerY, width * 0.78, 390, 0x0c0a09, 0.97)
      .setStrokeStyle(5, title === 'VICTORY' ? 0x84cc16 : 0x991b1b)
      .setDepth(6000);

    this.add.text(width / 2, centerY - 95, title, {
      fontFamily: 'Arial',
      fontSize: '78px',
      fontStyle: 'bold',
      color: title === 'VICTORY' ? '#bef264' : '#fca5a5'
    }).setOrigin(0.5).setDepth(6001);

    this.add.text(width / 2, centerY - 22, subtitle, {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: '#d6d3d1'
    }).setOrigin(0.5).setDepth(6001);

    const button = this.add.rectangle(width / 2, centerY + 90, width * 0.58, 96, 0x44403c)
      .setInteractive({ useHandCursor: true })
      .setDepth(6001);

    this.add.text(width / 2, centerY + 90, buttonLabel, {
      fontFamily: 'Arial',
      fontSize: '38px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(6002);

    button.on('pointerdown', callback);
    button.on('pointerover', () => button.setFillStyle(0x57534e));
    button.on('pointerout', () => button.setFillStyle(0x44403c));
  }
}
