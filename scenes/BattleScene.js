import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import enemies, { forgottenCavernWaves, voidPortalWaves } from '../data/enemies.js';
import BattleUnit from '../combat/BattleUnit.js';
import BattlefieldGeometry from '../combat/BattlefieldGeometry.js';
import TacticsController from '../combat/TacticsController.js';
import HapticsService from '../services/HapticsService.js';
import { completeExpedition, failExpedition, fleeExpedition, formatDuration } from '../game/ExpeditionProgression.js';
import { saveProfile } from '../game/GameStorage.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  create() {
    const { width, height } = this.scale;

    this.battleOver = false;
    this.waveTransitioning = false;
    this.activeTelegraphs = [];
    this.currentWaveIndex = -1;
    this.enemySerial = 0;
    this.earnedGold = 0;
    this.enemyThreat = new Map();
    this.enemies = [];
    this.lastTonicUseAt = 0;
    this.selectedUnitIds = new Set();
    this.manualTargets = new Map();
    this.heldUnitIds = new Set();
    this.commandMode = null;
    this.stackMode = 'spread';
    this.focusTargetId = null;
    this.gridCells = [];
    this.leaderAbilityCooldowns = new Map();
    this.assaultUntil = 0;
    this.braceUntil = 0;
    this.preparedSuppliesUsed = false;
    this.combatPaused = false;

    this.battlefield = new BattlefieldGeometry(this, {
      bottomLeftX: 345,
      bottomRightX: width - 345,
      topLeftX: width * 0.29,
      topRightX: width * 0.71,
      bottomY: height * 0.72,
      topY: height * 0.30,
      logicalWidth: 1400,
      logicalHeight: 900,
      columns: 8,
      rows: 6,
      nearScale: 1.05,
      farScale: 0.74
    });

    this.tactics = new TacticsController(this.battlefield, GameState.tactics);
    this.waves = this.buildEncounterWaves();

    this.cameras.main.setBackgroundColor('#09080a');
    this.createHeader(width);
    this.createArena(width, height);
    this.createParty();
    this.createGridInteraction();
    this.createTacticsMenus(width, height);
    this.createLeaderLoadoutBar(width);
    this.createHud(width, height);
    this.startWave(0);
  }


  buildEncounterWaves() {
    const sourceWaves = GameState.currentDelve?.type === 'void' ? voidPortalWaves : forgottenCavernWaves;
    const waves = sourceWaves.map((wave) => ({
      ...wave,
      enemies: wave.enemies.map((enemy) => ({ ...enemy }))
    }));

    const depth = GameState.currentDelve?.depth ?? 1;
    if (depth % 5 === 0) {
      waves.push({
        name: 'Void-Key Guardian',
        boss: true,
        milestoneBoss: true,
        enemies: [
          { type: 'elderSlime', arenaX: 520, arenaY: 790 },
          { type: 'stoneCrawler', arenaX: 330, arenaY: 760 },
          { type: 'stoneCrawler', arenaX: 720, arenaY: 760 }
        ]
      });
    }

    if (GameState.currentDelve) GameState.currentDelve.rooms = waves.length;
    return waves;
  }

  createHeader(width) {
    this.add.text(width / 2, UI_SAFE_TOP + 14, GameState.currentDelve?.name ?? 'THE DELVE', {
      fontFamily: 'Arial',
      fontSize: '57px',
      fontStyle: 'bold',
      color: '#f5f5f4'
    }).setOrigin(0.5);

    this.battleMessageText = this.add.text(width / 2, UI_SAFE_TOP - 42, '', {
      fontFamily: 'Arial',
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#d6a85f',
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(5000);

    this.encounterStatusText = this.add.text(width / 2, UI_SAFE_TOP + 66, '', {
      fontFamily: 'Arial',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#fb923c'
    }).setOrigin(0.5);
  }

  createArena() {
    this.battlefield.drawPerspectiveFloor();
  }


  createParty() {
    const party = GameState.activeParty.length > 0
      ? GameState.activeParty
      : GameState.roster.slice(0, 5);

    this.partyUnits = party.map((adventurer) => new BattleUnit(this, {
      ...adventurer,
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
    });

    this.tank = this.partyUnits.find((unit) => unit.role === 'Tank') ?? this.partyUnits[0];
    this.healer = this.partyUnits.find((unit) => unit.role === 'Healer');
  }

  createHud(width, height) {
    const hudTop = height * 0.78;
    this.add.rectangle(width / 2, (hudTop + height) / 2, width, height - hudTop, 0x0c0a09).setDepth(4500);
    this.partyHud = [];
    const usableWidth = width * 0.76;
    const sectionWidth = usableWidth / 5;
    const startX = width * 0.055;

    this.partyUnits.forEach((unit, index) => {
      const x = startX + index * sectionWidth;
      this.add.circle(x, hudTop + 72, 25, unit.color).setDepth(4501);
      const nameText = this.add.text(x + 42, hudTop + 38, unit.name, {
        fontFamily:'Arial', fontSize:'39px', fontStyle:'bold', color:'#f5f5f4'
      }).setOrigin(0,0.5).setDepth(4501);
      this.add.text(x + 42, hudTop + 73, unit.className, {
        fontFamily:'Arial', fontSize:'30px', color:'#cbd5e1'
      }).setOrigin(0,0.5).setDepth(4501);

      const hudBarWidth = Math.max(120, sectionWidth - 60);
      const hudBarX = x + 42;
      const hudBarY = hudTop + 108;
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
      this.partyHud.push({unit,nameText,hpText,manaText,threatText,hpFill,hpGlow,manaBack,manaFill,hudBarWidth});
    });
  }

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

  createTacticsMenus(width, height) {
    const left = [
      ['RANGED', 'Ranged DPS'], ['MELEE', 'Melee DPS'], ['HEALERS', 'Healer'], ['TANKS', 'Tank']
    ];
    const right = ['MOVE', 'HOLD', 'SPREAD', 'STACK', 'FOCUS', 'INTERRUPT'];
    const firstY = height * 0.31;
    const gap = 76;
    this.roleButtons = [];
    this.commandButtons = [];

    this.add.text(155, firstY - 70, 'SELECT', {fontFamily:'Arial',fontSize:'33px',fontStyle:'bold',color:'#94a3b8'}).setOrigin(0.5);
    left.forEach(([label, role], index) => {
      const y = firstY + index * gap;
      const box = this.add.rectangle(155, y, 250, 68, 0x1f2937).setStrokeStyle(3,0x475569).setInteractive({useHandCursor:true}).setDepth(4600);
      const text = this.add.text(155,y,label,{fontFamily:'Arial',fontSize:'33px',fontStyle:'bold',color:'#e5e7eb'}).setOrigin(0.5).setDepth(4601);
      box.on('pointerdown',()=>this.selectRole(role));
      this.roleButtons.push({box,text,role});
    });

    const pauseY = firstY + 4 * gap;
    this.pauseButton = this.add.rectangle(155, pauseY, 250, 62, 0x1f2937).setStrokeStyle(3,0x475569).setInteractive({useHandCursor:true}).setDepth(4600);
    this.pauseButtonText = this.add.text(155,pauseY,'PAUSE',{fontFamily:'Arial',fontSize:'31px',fontStyle:'bold',color:'#e5e7eb'}).setOrigin(0.5).setDepth(4601);
    this.pauseButton.on('pointerdown',()=>this.togglePause());

    const fleeY = firstY + 5 * gap;
    const fleeButton = this.add.rectangle(155, fleeY, 250, 62, 0x3f1d1d).setStrokeStyle(3,0x991b1b).setInteractive({useHandCursor:true}).setDepth(4600);
    this.add.text(155,fleeY,'FLEE',{fontFamily:'Arial',fontSize:'31px',fontStyle:'bold',color:'#fecaca'}).setOrigin(0.5).setDepth(4601);
    fleeButton.on('pointerdown',()=>this.fleeBattle());

    this.add.text(width-155, firstY - 70, 'ORDERS', {fontFamily:'Arial',fontSize:'33px',fontStyle:'bold',color:'#94a3b8'}).setOrigin(0.5);
    right.forEach((label,index)=>{
      const y=firstY+index*gap;
      const box=this.add.rectangle(width-155,y,270,68,0x1f2937).setStrokeStyle(3,0x475569).setInteractive({useHandCursor:true}).setDepth(4600);
      const text=this.add.text(width-155,y,label,{fontFamily:'Arial',fontSize:label.length>10?'27px':'33px',fontStyle:'bold',color:'#e5e7eb'}).setOrigin(0.5).setDepth(4601);
      box.on('pointerdown',()=>this.armCommand(label));
      this.commandButtons.push({box,text,label});
    });
    this.refreshTacticsMenus();
  }

  createLeaderLoadoutBar(width) {
    const equipped=(GameState.leader?.battleLoadout ?? ['focusFire']).slice(0,5);
    const abilityNames={focusFire:'FOCUS FIRE',rally:'RALLY',coordinatedAssault:'ASSAULT',encouragement:'ENCOURAGE',brace:'BRACE',preparedSupplies:'SUPPLIES'};
    const gridTop = this.battlefield.topY;
    const labelY = gridTop - 86;
    const buttonY = gridTop - 42;
    this.add.text(width/2, labelY, 'TACTICS LOADOUT', {fontFamily:'Arial',fontSize:'27px',fontStyle:'bold',color:'#94a3b8'}).setOrigin(0.5).setDepth(4700);

    const availableWidth = this.battlefield.bottomRightX - this.battlefield.bottomLeftX;
    const gap = Math.min(280, availableWidth / Math.max(1, equipped.length));
    const start=width/2-((equipped.length-1)*gap)/2;
    equipped.forEach((id,index)=>{
      const x=start+index*gap;
      const box=this.add.rectangle(x,buttonY,Math.min(240, gap - 18),52,0x292524).setStrokeStyle(2,0x84cc16).setInteractive({useHandCursor:true}).setDepth(4700);
      this.add.text(x,buttonY,abilityNames[id]??id.toUpperCase(),{fontFamily:'Arial',fontSize:'24px',fontStyle:'bold',color:'#bef264'}).setOrigin(0.5).setDepth(4701);
      box.on('pointerdown',()=>this.useLeaderAbility(id));
    });
  }

  toggleUnitSelection(unit) {
    if (!unit?.alive) return;

    if (this.selectedUnitIds.has(unit.id)) {
      this.selectedUnitIds.delete(unit.id);
      this.commandMode = null;
      this.refreshTacticsMenus();
      this.setTargetingInputState(false);

      const remaining = this.getSelectedUnits();
      if (remaining.length === 0) {
        this.clearBattleMessage();
      } else {
        this.showBattleMessage(`${remaining.length} adventurers selected - choose an action`, '#93c5fd', true);
      }
    } else {
      this.selectedUnitIds = new Set([unit.id]);
      this.commandMode = null;
      this.refreshTacticsMenus();
      this.setTargetingInputState(false);
      this.showBattleMessage(`${unit.name} selected - choose an action`, '#93c5fd', true);
    }

    HapticsService.tap();
  }

  selectRole(role) {
    const matching = this.partyUnits.filter((unit) => unit.alive && unit.role === role);
    this.selectedUnitIds = new Set(matching.map((unit) => unit.id));

    this.showBattleMessage(
      matching.length > 0 ? `${role} selected - choose an action` : `No living ${role}`,
      matching.length > 0 ? '#93c5fd' : '#fca5a5',
      matching.length > 0
    );

    this.refreshTacticsMenus();
    HapticsService.tap();
  }

  getSelectedUnits() {
    return this.partyUnits.filter((unit) => unit.alive && this.selectedUnitIds.has(unit.id));
  }

  isPositionLocked(unit) {
    return this.heldUnitIds.has(unit.id);
  }

  armCommand(label) {
    const selected = this.getSelectedUnits();
    const needsSelection = ['MOVE', 'HOLD', 'SPREAD', 'STACK'].includes(label);

    if (needsSelection && selected.length === 0) {
      this.showBattleMessage('SELECT AN ADVENTURER OR ROLE FIRST', '#fca5a5', true);
      HapticsService.tap();
      return;
    }

    if (label === 'HOLD') {
      selected.forEach((unit) => {
        this.manualTargets.set(unit.id, { x: unit.arenaX, y: unit.arenaY });
        this.heldUnitIds.add(unit.id);
      });
      this.commandMode = null;
      this.refreshTacticsMenus();
      this.showBattleMessage('HOLD ORDER SET', '#93c5fd');
      HapticsService.tap();
      return;
    }

    this.commandMode = label;
    this.setTargetingInputState(label === 'FOCUS' || label === 'INTERRUPT');
    this.refreshTacticsMenus();

    const prompt = label === 'FOCUS' ? 'FOCUS - tap the enemy you want the party to prioritize'
      : label === 'INTERRUPT' ? 'INTERRUPT - tap the enemy you want to interrupt'
        : `${label} - tap a destination`;
    this.showBattleMessage(prompt, '#fbbf24', true);
    HapticsService.tap();
  }

  setTargetingInputState(targetingEnemies) {
    this.partyUnits?.forEach((unit) => {
      if (targetingEnemies) unit.hitZone.disableInteractive();
      else if (unit.alive) unit.hitZone.setInteractive({ useHandCursor: true });
    });

    this.enemies?.forEach((enemy) => {
      if (!enemy.alive) return;
      if (targetingEnemies) enemy.hitZone.setInteractive({ useHandCursor: true });
      else enemy.hitZone.disableInteractive();
    });
  }

  refreshTacticsMenus() {
    this.roleButtons?.forEach(({box,role})=>{
      const selected=this.partyUnits?.some((u)=>u.role===role && this.selectedUnitIds.has(u.id));
      box.setFillStyle(selected?0x243b53:0x1f2937).setStrokeStyle(3,selected?0x60a5fa:0x475569);
    });
    this.commandButtons?.forEach(({box,label})=>{
      const active=this.commandMode===label;
      box.setFillStyle(active?0x3b321d:0x1f2937).setStrokeStyle(3,active?0xfbbf24:0x475569);
    });
    this.partyUnits?.forEach((u)=>u.body.setStrokeStyle(this.selectedUnitIds.has(u.id)?7:4,this.selectedUnitIds.has(u.id)?0x60a5fa:(u.isEnemy?0x365314:0x1c1917)));
  }

  handleGridCellTap(column, row) {
    const center = this.battlefield.getCellCenter(column, row);
    this.highlightGridCell(column, row);

    if (!this.commandMode) {
      if (this.getSelectedUnits().length > 0) {
        this.commandMode = 'MOVE';
      } else {
        this.showBattleMessage('SELECT A UNIT OR ROLE FIRST', '#d6a85f');
        HapticsService.tap();
        return;
      }
    }

    if (this.commandMode === 'FOCUS' || this.commandMode === 'INTERRUPT') {
      const enemy = this.getLivingEnemies().find((candidate) => {
        const cell = this.battlefield.arenaPointToCell(candidate.arenaX, candidate.arenaY);
        return cell.column === column && cell.row === row;
      });

      if (!enemy) {
        this.showBattleMessage('No enemy there - tap the enemy you want', '#fca5a5', true);
        return;
      }

      if (this.commandMode === 'FOCUS') {
        this.focusTargetId = enemy.id;
        this.showBattleMessage(`FOCUS: ${enemy.name}`, '#fb923c');
      } else if (enemy.pendingAction) {
        enemy.finishAction();
        this.showBattleMessage(`INTERRUPTED: ${enemy.name}`, '#fde68a');
        HapticsService.heavy();
      } else {
        this.showBattleMessage(`${enemy.name} is not casting`, '#a8a29e');
      }

      this.commandMode = null;
      this.setTargetingInputState(false);
      this.refreshTacticsMenus();
      return;
    }

    const units = this.getSelectedUnits();
    if (units.length === 0) {
      this.commandMode = null;
      this.refreshTacticsMenus();
      this.showBattleMessage('SELECT AN ADVENTURER OR ROLE FIRST', '#fca5a5');
      return;
    }

    if (this.commandMode === 'SPREAD' || this.commandMode === 'STACK') {
      const formationMode = this.commandMode;
      const radius = formationMode === 'STACK' ? 34 : 135;

      units.forEach((unit, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(1, units.length);
        const point = this.battlefield.clampPoint(
          center.x + Math.cos(angle) * radius,
          center.y + Math.sin(angle) * radius,
          45,
          35
        );

        this.manualTargets.set(unit.id, point);
        this.heldUnitIds.add(unit.id);
      });

      this.showBattleMessage(`${formationMode} FORMATION SET`, '#93c5fd');
      this.commandMode = null;
      this.setTargetingInputState(false);
      this.refreshTacticsMenus();
      return;
    }

    units.forEach((unit, index) => {
      const offset = (index - (units.length - 1) / 2) * 38;
      const point = this.battlefield.clampPoint(center.x + offset, center.y, 45, 35);
      this.manualTargets.set(unit.id, point);

      // Any direct tile movement becomes a persistent hold order as soon as it is issued.
      // This prevents AI movement, mechanic dodging, or formation logic from overriding
      // the player's destination while the unit is travelling or after it arrives.
      this.heldUnitIds.add(unit.id);
    });

    this.showBattleMessage('MOVE + HOLD ORDER', '#93c5fd');
    this.commandMode = null;
    this.setTargetingInputState(false);
    this.refreshTacticsMenus();
  }

  handleEnemyTap(enemy) {
    if (!enemy?.alive) return;

    if (this.commandMode === 'FOCUS') {
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

  applyManualMovement(unit, deltaSeconds) {
    const target = this.manualTargets.get(unit.id);
    if (!target || unit.isBusy(this.time.now)) {
      return false;
    }

    if (unit.distanceToPoint(target.x, target.y) > 24) {
      unit.moveToward(target.x, target.y, deltaSeconds, 18);
      return true;
    }

    if (!this.isPositionLocked(unit)) {
      this.manualTargets.delete(unit.id);
    }

    return false;
  }

  useLeaderAbility(id) {
    const now=this.time.now;
    const last=this.leaderAbilityCooldowns.get(id) ?? -Infinity;
    if (now-last<10000) { this.showBattleMessage('Ability recharging', '#a8a29e'); return; }
    this.leaderAbilityCooldowns.set(id,now);
    if (id==='focusFire') { this.commandMode='FOCUS'; this.setTargetingInputState(true); this.refreshTacticsMenus(); this.showBattleMessage('FOCUS FIRE - tap an enemy','#bef264', true); return; }
    if (id==='rally') { this.commandMode='STACK'; this.selectedUnitIds=new Set(this.partyUnits.filter((u)=>u.alive).map((u)=>u.id)); this.refreshTacticsMenus(); this.showBattleMessage('RALLY - tap a destination','#bef264', true); return; }
    if (id==='coordinatedAssault') { this.assaultUntil=now+8000; this.showBattleMessage('COORDINATED ASSAULT • +20% damage','#bef264'); return; }
    if (id==='encouragement') { this.partyUnits.filter((u)=>u.alive).forEach((u)=>{const amount=Math.round(u.maxHp*0.12);u.heal(amount);this.createFloatingText(u.x,u.y-80,`+${amount}`,'#86efac');}); this.showBattleMessage('ENCOURAGEMENT','#bef264'); return; }
    if (id==='brace') { this.braceUntil=now+8000; this.showBattleMessage('BRACE • 30% damage reduction','#bef264'); return; }
    if (id==='preparedSupplies') { if (!this.preparedSuppliesUsed){GameState.inventory.healingTonic+=1;this.preparedSuppliesUsed=true;this.showBattleMessage('+1 HEALING TONIC','#bef264');} }
  }

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

    this.enemies = wave.enemies.map((spawn, spawnIndex) => this.createEnemy(spawn.type, spawn, spawnIndex));
    this.waveTransitioning = false;

    if (wave.boss) {
      this.showBattleMessage('BOSS INCOMING', '#f97316');
      HapticsService.heavy();
    }
  }

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
      if (this.commandMode !== 'FOCUS' && this.commandMode !== 'INTERRUPT') return;
      event?.stopPropagation?.();
      this.handleEnemyTap(enemy);
    });
    this.enemyThreat.set(enemy.id, new Map(this.partyUnits.map((unit) => [unit.id, 0])));
    return enemy;
  }

  update(time, delta) {
    if (this.battleOver || this.waveTransitioning || this.combatPaused) {
      return;
    }

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

    this.partyUnits.forEach((unit) => this.updatePartyUnit(unit, time, deltaSeconds));
    this.applySeparation(this.partyUnits, deltaSeconds, 62);
    this.applySeparation(livingEnemies, deltaSeconds, 78);
    this.updateEnemies(time, deltaSeconds);

    this.partyUnits.forEach((unit) => unit.clampToBattlefield(38, 20));
    livingEnemies.forEach((enemy) => enemy.clampToBattlefield(60, 20));

    this.tryUseHealingTonic(time);
    this.updateHud();

    if (this.partyUnits.every((unit) => !unit.alive)) {
      this.finishDefeat();
    }
  }


  tryUseHealingTonic(time) {
    if (GameState.inventory.healingTonic <= 0 || time - this.lastTonicUseAt < 1500) {
      return;
    }

    const target = this.partyUnits
      .filter((unit) => unit.alive && unit.hp / unit.maxHp <= 0.35)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];

    if (!target) {
      return;
    }

    this.lastTonicUseAt = time;
    GameState.inventory.healingTonic -= 1;
    const amount = Math.max(1, Math.round(target.maxHp * 0.35));
    target.heal(amount);
    target.flash(0x86efac);
    this.createFloatingText(target.x, target.y - 100, `TONIC +${amount}`, '#86efac', true);
    this.showBattleMessage(`${target.name} drinks a Healing Tonic`, '#86efac');
    HapticsService.confirm();
    saveProfile();
  }

  getLivingEnemies() {
    return this.enemies.filter((enemy) => enemy.alive);
  }

  getPrimaryTarget(unit) {
    const living = this.getLivingEnemies();
    if (living.length === 0) {
      return null;
    }

    const focused = living.find((enemy) => enemy.id === this.focusTargetId);
    if (focused) return focused;

    return living.sort((a, b) => {
      const bossPriority = Number(['elderSlime', 'abyssalMaw'].includes(b.enemyType)) - Number(['elderSlime', 'abyssalMaw'].includes(a.enemyType));
      if (bossPriority !== 0) {
        return bossPriority;
      }
      return unit.distanceTo(a) - unit.distanceTo(b);
    })[0];
  }

  updatePartyUnit(unit, time, deltaSeconds) {
    if (!unit?.alive) return;

    this.runClassPassive(unit, time);

    if (this.applyManualMovement(unit, deltaSeconds)) return;
    if (!this.isPositionLocked(unit) && this.tryEvadeTelegraph(unit, deltaSeconds)) return;

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

  tryClassUtility(unit, target, time) {
    const utility = unit.abilities?.utility;
    if (!utility || !unit.abilityReady('utility', time)) return;

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

    if (unit.className === 'Gladiator') {
      this.announceAbility(unit, utility.name, '#fde68a');
      unit.markAbilityUsed('utility', time);
      target.status.blindUntil = time + utility.duration;
      target.status.blindChance = utility.missChance;
      this.createFloatingText(target.x, target.y - 96, 'BLINDED', '#fde68a');
      return;
    }

    if (unit.className === 'Guardian') {
      this.announceAbility(unit, utility.name, '#86efac');
      unit.markAbilityUsed('utility', time);
      target.status.outgoingDamageReductionUntil = time + utility.duration;
      target.status.outgoingDamageReduction = utility.damageReduction;
      this.createFloatingText(target.x, target.y - 96, 'WITHERED', '#86efac');
      return;
    }

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

    if (unit.className === 'Wizard') {
      if (unit.hp / unit.maxHp > 0.35) return;
      this.announceAbility(unit, utility.name, '#93c5fd');
      unit.markAbilityUsed('utility', time);
      unit.status.arcaneShieldUntil = time + utility.duration;
      unit.status.spellLockUntil = time + utility.silenceDuration;
      this.createFloatingText(unit.x, unit.y - 105, 'ARCANE SHIELD', '#93c5fd', true);
      return;
    }

    if (unit.className === 'Ranger') {
      this.announceAbility(unit, utility.name, '#fbbf24');
      unit.markAbilityUsed('utility', time);
      target.status.damageTakenBoostUntil = time + utility.duration;
      target.status.damageTakenBoost = utility.damageTakenBoost;
      this.createFloatingText(target.x, target.y - 96, "HUNTER'S MARK", '#fbbf24');
      return;
    }

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

  updateTankUnit(unit, target, time, deltaSeconds) {
    const desired = this.tactics.getTankPosition(unit, target);
    if (!this.isPositionLocked(unit) && !unit.isBusy(time) && unit.distanceToPoint(desired.x, desired.y) > 26) {
      unit.moveToward(desired.x, desired.y, deltaSeconds, 18);
    }

    if (unit.distanceTo(target) > unit.attackRange + 24) return;

    const primary = unit.abilities?.primary;
    if (primary && unit.abilityReady('primary', time)) {
      if (primary.aoe) this.beginAoeDamageAbility(unit, target, 'primary', time, 'melee');
      else this.beginDamageAbility(unit, target, 'primary', time, 'melee');
    } else if (unit.canAttack(time)) {
      this.beginBasicAttack(unit, target, time, 'melee');
    }
  }

  updateMeleeUnit(unit, target, time, deltaSeconds) {
    if (unit.className === 'Rogue' && !unit.stealthed && unit.seekingRestealth) {
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

    const desired = this.tactics.getMeleePosition(unit, target);
    if (!this.isPositionLocked(unit) && !unit.isBusy(time) && unit.distanceToPoint(desired.x, desired.y) > 25) {
      unit.moveToward(desired.x, desired.y, deltaSeconds, 16);
    }

    if (unit.distanceTo(target) > unit.attackRange + 28) return;

    const primary = unit.abilities?.primary;
    if (primary && unit.abilityReady('primary', time)) {
      if (primary.aoe) this.beginAoeDamageAbility(unit, target, 'primary', time, 'melee');
      else this.beginDamageAbility(unit, target, 'primary', time, 'melee');
    } else if (unit.canAttack(time)) {
      this.beginBasicAttack(unit, target, time, 'melee');
    }
  }

  updateRangedUnit(unit, target, time, deltaSeconds) {
    const desired = this.tactics.getRangedPosition(unit, target);
    if (!this.isPositionLocked(unit) && !unit.isBusy(time) && unit.distanceToPoint(desired.x, desired.y) > 42) {
      unit.moveToward(desired.x, desired.y, deltaSeconds, 34);
    }

    if (unit.className === 'Ranger') this.tryRangerTrap(unit, target, time);
    if (unit.distanceTo(target) > unit.attackRange) return;
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

  updateHealerUnit(unit, time, deltaSeconds) {
    const injured = this.getMostInjuredPartyMember();

    if (injured && injured.hp / injured.maxHp < 0.84) {
      if (!this.isPositionLocked(unit) && !unit.isBusy(time) && unit.distanceTo(injured) > unit.healRange * 0.9) {
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

    const anchor = this.tank?.alive ? this.tank : this.partyUnits.find((candidate) => candidate.alive && candidate !== unit);
    if (anchor && !this.isPositionLocked(unit) && !unit.isBusy(time)) {
      const desired = this.tactics.getHealerPosition(unit, anchor);
      if (unit.distanceToPoint(desired.x, desired.y) > 45) unit.moveToward(desired.x, desired.y, deltaSeconds, 30);
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

    if (unit.distanceTo(target) <= unit.attackRange && unit.canAttack(time)) {
      this.beginBasicAttack(unit, target, time, unit.className === 'Bloodwarder' ? 'spell' : 'holy');
    }
  }

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

  beginAoeDamageAbility(attacker, target, key, time, attackType) {
    const ability = attacker.abilities[key];
    if (!ability || !attacker.startAction(ability.name, time, ability.windup)) return;

    this.announceAbility(attacker, ability.name, attackType === 'spell' ? '#93c5fd' : '#fbbf24');
    attacker.markAbilityUsed(key, time);
    if (ability.healthCost) {
      const cost = Math.max(1, Math.round(attacker.maxHp * ability.healthCost));
      attacker.hp = Math.max(1, attacker.hp - cost);
      attacker.updateHealthBar();
      this.createFloatingText(attacker.x, attacker.y - 80, `-${cost}`, '#f87171');
    }

    this.time.delayedCall(ability.windup, () => {
      if (!attacker.alive || this.battleOver || attacker.pendingAction?.name !== ability.name) return;
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

  beginMultiHeal(healer, time, ability) {
    if (!healer.startAction(ability.name, time, ability.windup)) return;
    this.announceAbility(healer, ability.name, '#86efac');
    healer.markAbilityUsed('primary', time);
    this.time.delayedCall(ability.windup, () => {
      if (!healer.alive || this.battleOver || healer.pendingAction?.name !== ability.name) return;
      const targets = this.partyUnits
        .filter((unit) => unit.alive && unit.hp < unit.maxHp)
        .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))
        .slice(0, ability.targets ?? 3);
      targets.forEach((target) => this.resolveHeal(healer, target, ability.power, ability.name));
      healer.finishAction();
    });
  }

  beginInstantDamage(attacker, target, power, attackType, abilityName) {
    this.announceAbility(attacker, abilityName, attackType === 'holy' ? '#fde68a' : '#93c5fd');
    this.resolveDamage(attacker, target, power, attackType, attacker.threatMultiplier, abilityName);
  }

  updateEnemies(time, deltaSeconds) {
    this.getLivingEnemies().forEach((enemy) => {
      if (time < (enemy.status.stunnedUntil ?? 0)) return;
      const target = this.getHighestThreatTarget(enemy);
      if (!target) {
        return;
      }

      const primary = enemy.abilities?.primary;
      if (primary?.telegraph && enemy.abilityReady('primary', time) && enemy.distanceTo(target) <= 220) {
        this.beginGroundSlam(enemy, target, time, primary);
        return;
      }

      const secondary = enemy.abilities?.secondary;
      if (secondary && enemy.abilityReady('secondary', time)) {
        const rangedTarget = this.partyUnits.find((unit) => unit.alive && unit.role === 'Ranged DPS')
          ?? this.partyUnits.find((unit) => unit.alive && unit.role === 'Healer')
          ?? target;
        this.beginEnemyAbility(enemy, rangedTarget, 'secondary', time);
        return;
      }

      if (!enemy.isBusy(time) && enemy.distanceTo(target) > enemy.attackRange) {
        enemy.moveToward(target.arenaX, target.arenaY, deltaSeconds, enemy.attackRange * 0.82);
      }

      if (enemy.distanceTo(target) <= enemy.attackRange + 8 && enemy.canAttack(time)) {
        this.beginBasicAttack(enemy, target, time, 'enemy');
      }
    });
  }

  beginBasicAttack(attacker, target, time, attackType) {
    if (!attacker.startAction('Attack', time, attacker.attackWindup)) {
      return;
    }

    attacker.lastAttackAt = time;
    this.time.delayedCall(attacker.attackWindup, () => {
      if (!attacker.alive || !target.alive || this.battleOver || attacker.pendingAction?.name !== 'Attack') {
        return;
      }
      if (attacker.distanceTo(target) <= attacker.attackRange + 28) {
        this.resolveDamage(attacker, target, attacker.attackPower, attackType, attacker.threatMultiplier, 'Attack');
      }
      attacker.finishAction();
    });
  }

  beginDamageAbility(attacker, target, key, time, attackType) {
    const ability = attacker.abilities[key];
    if (!ability || !attacker.startAction(ability.name, time, ability.windup)) {
      return;
    }

    this.announceAbility(attacker, ability.name, attackType === 'spell' ? '#93c5fd' : attackType === 'ranged' ? '#86efac' : '#fbbf24');
    attacker.markAbilityUsed(key, time);
    if (ability.healthCost) {
      const cost = Math.max(1, Math.round(attacker.maxHp * ability.healthCost));
      attacker.hp = Math.max(1, attacker.hp - cost);
      attacker.updateHealthBar();
      this.createFloatingText(attacker.x, attacker.y - 80, `-${cost}`, '#f87171');
    }

    this.time.delayedCall(ability.windup, () => {
      if (!attacker.alive || !target.alive || this.battleOver || attacker.pendingAction?.name !== ability.name) {
        return;
      }
      const rangePadding = attackType === 'spell' ? 50 : 30;
      if (attacker.distanceTo(target) <= attacker.attackRange + rangePadding) {
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

  applyBleed(attacker, target, ability) {
    for (let tick = 1; tick <= ability.bleedTicks; tick += 1) {
      this.time.delayedCall(ability.bleedInterval * tick, () => {
        if (!attacker.alive || !target.alive || this.battleOver) return;
        this.resolveDamage(attacker, target, ability.bleedPower, 'melee', 0.35, 'Bleed', false);
      });
    }
  }

  beginEnemyAbility(attacker, target, key, time) {
    const ability = attacker.abilities[key];
    if (!ability || !attacker.startAction(ability.name, time, ability.windup)) {
      return;
    }
    this.announceAbility(attacker, ability.name, '#c084fc');
    attacker.markAbilityUsed(key, time);

    this.time.delayedCall(ability.windup, () => {
      if (!attacker.alive || !target.alive || this.battleOver || attacker.pendingAction?.name !== ability.name) {
        return;
      }
      this.createProjectile(attacker, target, 0xa855f7);
      this.resolveDamage(attacker, target, ability.power, 'enemy', 1, ability.name);
      attacker.finishAction();
    });
  }

  beginBasicHeal(healer, target, time) {
    if (healer.maxMana > 0 && healer.mana < healer.basicHealManaCost) return;
    if (!healer.startAction('Mend', time, healer.healWindup)) {
      return;
    }
    if (!healer.spendMana(healer.basicHealManaCost)) { healer.finishAction(); return; }
    this.announceAbility(healer, 'Mend', '#86efac');
    healer.lastHealAt = time;
    this.time.delayedCall(healer.healWindup, () => {
      if (!healer.alive || !target.alive || this.battleOver || healer.pendingAction?.name !== 'Mend') {
        return;
      }
      if (healer.distanceTo(target) <= healer.healRange + 30) {
        this.resolveHeal(healer, target, healer.healPower, 'Mend');
      }
      healer.finishAction();
    });
  }

  beginHealAbility(healer, target, key, time) {
    const ability = healer.abilities[key];
    if (!ability || !healer.startAction(ability.name, time, ability.windup)) {
      return;
    }
    this.announceAbility(healer, ability.name, '#86efac');
    healer.markAbilityUsed(key, time);
    if (ability.healthCost) {
      const cost = Math.max(1, Math.round(healer.maxHp * ability.healthCost));
      healer.hp = Math.max(1, healer.hp - cost);
      healer.updateHealthBar();
      this.createFloatingText(healer.x, healer.y - 80, `-${cost}`, '#f87171');
    }
    this.time.delayedCall(ability.windup, () => {
      if (!healer.alive || !target.alive || this.battleOver || healer.pendingAction?.name !== ability.name) {
        return;
      }
      if (healer.distanceTo(target) <= healer.healRange + 40) {
        this.resolveHeal(healer, target, ability.power, ability.name);
      }
      healer.finishAction();
    });
  }

  beginGroundSlam(attacker, target, time, ability) {
    if (!attacker.startAction(ability.name, time, ability.telegraph)) {
      return;
    }
    this.announceAbility(attacker, ability.name, '#f87171');
    attacker.markAbilityUsed('primary', time);

    const center = { arenaX: target.arenaX, arenaY: target.arenaY };
    const screenCenter = this.battlefield.arenaToScreen(center.arenaX, center.arenaY);
    const radii = this.battlefield.getGroundEllipseRadii(ability.radius, center.arenaY);

    const warning = this.add.ellipse(screenCenter.x, screenCenter.y, radii.width * 2, radii.height * 2, 0xef4444, 0.14)
      .setStrokeStyle(8, 0xf87171, 0.88)
      .setDepth(40 + screenCenter.y);
    const inner = this.add.ellipse(screenCenter.x, screenCenter.y, 32, 16, 0xf87171, 0.35)
      .setDepth(41 + screenCenter.y);

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

    this.time.delayedCall(ability.telegraph, () => {
      if (!attacker.alive || this.battleOver) {
        this.removeTelegraph(telegraph);
        attacker.finishAction();
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

  removeTelegraph(telegraph) {
    this.activeTelegraphs = this.activeTelegraphs.filter((item) => item !== telegraph);
    telegraph.warning?.destroy();
    telegraph.inner?.destroy();
  }

  rollCritical(attacker, allowCrit = true) {
    return allowCrit && Math.random() < (attacker.critChance ?? 0);
  }

  resolveDamage(attacker, target, baseAmount, attackType, threatMultiplier = 1, abilityName = 'Attack', allowCrit = true) {
    const now = this.time.now;
    if (now < (attacker.status.blindUntil ?? 0) && Math.random() < (attacker.status.blindChance ?? 0)) {
      this.createFloatingText(target.x, target.y - 82, 'MISS', '#cbd5e1', false, 'miss');
      return;
    }

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

    if (!attacker.isEnemy && now < this.assaultUntil) amount = Math.round(amount * 1.2);
    if (attacker.isEnemy && !target.isEnemy && now < this.braceUntil) amount = Math.max(1, Math.round(amount * 0.7));

    const ranged = attackType === 'spell' || attackType === 'ranged' || attacker.attackRange > 180;
    target.takeDamage(amount, { time: now, ranged });
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

    if (attackType === 'spell' || attackType === 'holy') {
      this.createProjectile(attacker, target, attackType === 'holy' ? 0xfde68a : 0x60a5fa);
    } else {
      this.createMeleePulse(target, critical ? 0xfbbf24 : 0xffffff);
    }

    const prefix = critical ? 'CRIT ' : '';
    this.createFloatingText(target.x, target.y - 82, `${prefix}-${amount}`, '#ef4444', critical, 'damage');

    if (!target.alive && target.isEnemy) {
      this.handleEnemyDeath(target);
    }
  }

  resolveHeal(healer, target, baseAmount, abilityName) {
    const critical = this.rollCritical(healer, true);
    const amount = Math.round(baseAmount * (critical ? healer.critMultiplier : 1));
    const before = target.hp;
    target.heal(amount);
    const effectiveHealing = target.hp - before;

    target.flash(0x86efac);
    this.createProjectile(healer, target, 0x86efac);
    this.createFloatingText(target.x, target.y - 82, `+${effectiveHealing}${critical ? '!' : ''}`, '#22c55e', critical, 'healing');

    this.getLivingEnemies().forEach((enemy) => this.addThreat(enemy, healer, effectiveHealing * 0.45));
  }

  handleEnemyDeath(enemy) {
    if (enemy.rewarded) {
      return;
    }
    enemy.rewarded = true;
    const definition = enemy.definition;
    this.earnedGold += Phaser.Math.Between(definition.goldMin ?? 0, definition.goldMax ?? 0);
  }

  addThreat(enemy, unit, amount) {
    if (!enemy?.isEnemy || !unit || unit.isEnemy) {
      return;
    }
    const table = this.enemyThreat.get(enemy.id);
    if (!table) {
      return;
    }
    table.set(unit.id, (table.get(unit.id) ?? 0) + Math.max(0, amount));
  }

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
      return enemy.distanceTo(a) - enemy.distanceTo(b);
    })[0];
  }

  getCombinedThreat(unit) {
    let total = 0;
    this.getLivingEnemies().forEach((enemy) => {
      total += this.enemyThreat.get(enemy.id)?.get(unit.id) ?? 0;
    });
    return total;
  }

  applySeparation(units, deltaSeconds, minimumDistance) {
    const living = units.filter((unit) => unit.alive);

    for (let i = 0; i < living.length; i += 1) {
      for (let j = i + 1; j < living.length; j += 1) {
        const first = living[i];
        const second = living[j];
        const distance = first.distanceTo(second);

        if (distance === 0 || distance >= minimumDistance) {
          continue;
        }

        const firstLocked = !first.isEnemy && this.isPositionLocked(first);
        const secondLocked = !second.isEnemy && this.isPositionLocked(second);

        if (firstLocked && secondLocked) {
          continue;
        }

        const direction = new Phaser.Math.Vector2(
          first.arenaX - second.arenaX,
          first.arenaY - second.arenaY
        ).normalize();

        const push = (minimumDistance - distance) * 2.3 * deltaSeconds;

        if (firstLocked) {
          second.setArenaPosition(
            second.arenaX - direction.x * push * 2,
            second.arenaY - direction.y * push * 2
          );
        } else if (secondLocked) {
          first.setArenaPosition(
            first.arenaX + direction.x * push * 2,
            first.arenaY + direction.y * push * 2
          );
        } else {
          first.setArenaPosition(
            first.arenaX + direction.x * push,
            first.arenaY + direction.y * push
          );
          second.setArenaPosition(
            second.arenaX - direction.x * push,
            second.arenaY - direction.y * push
          );
        }
      }
    }
  }

  getMostInjuredPartyMember() {
    return this.partyUnits
      .filter((unit) => unit.alive && unit.hp < unit.maxHp)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0] ?? null;
  }

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

  announceAbility(unit, name, color = '#f8fafc') {
    if (!unit?.alive || !name) return;
    this.createFloatingText(unit.x, unit.y - 122, name.toUpperCase(), color, false);
  }

  createFloatingText(x, y, text, color, critical = false) {
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
      duration: critical ? 1050 : 760,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy()
    });
  }

  showBattleMessage(text, color = '#d6a85f', persistent = false) {
    if (!this.battleMessageText) return;

    this.tweens.killTweensOf(this.battleMessageText);
    this.battleMessageText.setText(text).setColor(color).setAlpha(1);

    if (!persistent) {
      this.tweens.add({
        targets: this.battleMessageText,
        alpha: 0,
        delay: 900,
        duration: 260,
        onComplete: () => {
          if (this.battleMessageText?.active) this.battleMessageText.setText('').setAlpha(1);
        }
      });
    }
  }

  clearBattleMessage() {
    if (!this.battleMessageText) return;
    this.tweens.killTweensOf(this.battleMessageText);
    this.battleMessageText.setText('').setAlpha(1);
  }

  completeWave() {
    if (this.waveTransitioning || this.battleOver) {
      return;
    }
    this.waveTransitioning = true;
    this.activeTelegraphs.forEach((telegraph) => this.removeTelegraph(telegraph));
    this.showBattleMessage('WAVE CLEARED', '#bef264');

    this.enemies.forEach((enemy) => {
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

  updateHud() {
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

  getHealthBarColor(ratio) {
    if (ratio <= 0.25) return 0xef4444;
    if (ratio <= 0.5) return 0xf97316;
    if (ratio <= 0.75) return 0xeab308;
    return 0x22c55e;
  }

  updateEncounterStatus() {
    if (!this.encounterStatusText || this.currentWaveIndex < 0) return;
    const elapsed = formatDuration(Date.now() - (GameState.run.startedAt || Date.now()));
    const wave = this.waves?.[this.currentWaveIndex];
    const waveName = wave?.name ?? '';
    this.encounterStatusText.setText(`(${elapsed}) Wave ${this.currentWaveIndex + 1}/${this.waves.length} - ${waveName}`);
  }

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

  finishVictory() {
    if (this.battleOver) {
      return;
    }
    this.battleOver = true;
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

  finishDefeat() {
    if (this.battleOver) return;
    this.battleOver = true;
    failExpedition();
    this.showResultOverlay('DEFEAT', 'The party was driven back.', 'ENCOUNTER SUMMARY', () => {
      HapticsService.confirm();
      this.scene.start('EncounterSummaryScene');
    });
  }

  togglePause() {
    if (this.battleOver) return;
    this.combatPaused = !this.combatPaused;
    this.time.paused = this.combatPaused;
    this.pauseButtonText?.setText(this.combatPaused ? 'RESUME' : 'PAUSE');
    this.pauseButton?.setFillStyle(this.combatPaused ? 0x3b321d : 0x1f2937);
    this.showBattleMessage(this.combatPaused ? 'PAUSED' : 'RESUMED', this.combatPaused ? '#fbbf24' : '#bef264');
    HapticsService.tap();
  }

  fleeBattle() {
    if (this.battleOver) return;
    if (this.combatPaused) {
      this.combatPaused = false;
      this.time.paused = false;
    }
    this.battleOver = true;
    fleeExpedition();
    HapticsService.heavy();
    this.scene.start('EncounterSummaryScene');
  }

  showResultOverlay(title, subtitle, buttonLabel, callback) {
    const { width, height } = this.scale;
    const centerY = height * 0.5;

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
