import { bindSelectionDetails, addDetailsHint, delveDetails } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import delves from '../data/delves.js';
import HapticsService from '../services/HapticsService.js';
import { formatDuration } from '../game/ExpeditionProgression.js';
import { saveProfile, clearSavedProfile } from '../game/GameStorage.js';
import { clearLeaderProgression, grantLeaderLevels } from '../game/LeaderProgression.js';

const TOWNS = {
  pineshire: { id: 'pineshire', name: 'Pineshire', x: 0.091, y: 0.485, statusY: 0.57 },
  duskfall: { id: 'duskfall', name: 'Duskfall', x: 0.704, y: 0.548, statusY: 0.64 }
};

const LOCATION_STATUS_Y = {
  'slime-cave': 0.56,
  'thornbriar-hollow': 0.59,
  'dolmark-den': 0.34,
  'murmuring-abyss': 0.86
};

export default class TitleScene extends Phaser.Scene {

  // This function registers TitleScene so the game can navigate to this
  // screen.
  constructor() {

    super('TitleScene');
  }

  // This function builds the world map screen from the current world
  // progress. It displays currencies, adds town and delve touch targets,
  // marks the party location, and provides access to development tools.
  create() {

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#080b10');

    // Scale the map to cover the game area before placing the interface over
    // it.
    const map = this.add.image(width / 2, height / 2, 'world-map');
    const scale = Math.max(width / map.width, height / map.height);
    map.setScale(scale);

    // Draw the top banner with the game title, map label, and current
    // currencies.
    this.add.rectangle(width / 2, 58, width, 116, 0x070b10, 0.86).setDepth(1000);
    this.add.text(58, 18, 'DELVE DEEP', {
      fontFamily: 'Arial', fontSize: '54px', fontStyle: 'bold', color: '#f8fafc'
    }).setDepth(1001);
    this.add.text(58, 69, 'WORLD MAP', {
      fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: '#94a3b8'
    }).setDepth(1001);

    this.add.text(width - 58, 26, `Gold: ${GameState.gold}   Void Keys: ${GameState.inventory.voidKeys ?? 0}`, {
      fontFamily: 'Arial', fontSize: '31px', fontStyle: 'bold', color: '#fbbf24'
    }).setOrigin(1, 0).setDepth(1001);

    // Add the starting town and unlock Duskfall according to discovery, clear
    // progress, or testing mode.
    this.createTownHotspot(TOWNS.pineshire, true);
    const duskfallUnlocked = GameState.development.unlockAll || this.isDiscovered('duskfall') || this.isCleared('thornbriar-hollow');
    this.createTownHotspot(TOWNS.duskfall, duskfallUnlocked);

    delves.forEach((delve) => this.createDelveHotspot(delve));
    this.createPartyIndicator();
    addDetailsHint(this, 86, 'Long-press or hold-click a location for details.');
    this.createDevelopmentButton(width, height);
  }

  // This function places map interactions using positions relative to the
  // game area.
  mapPosition(relativeX, relativeY) {

    const { width, height } = this.scale;
    return { x: width * relativeX, y: height * relativeY };
  }

  // This function checks whether the party has reached a map location.
  isDiscovered(id) {

    return GameState.world.discoveredLocations.includes(id);
  }

  // This function recognizes cleared delves from world progress or recorded
  // victories.
  isCleared(id) {

    return GameState.world.clearedDelves.includes(id) || (GameState.records[id]?.clears ?? 0) > 0;
  }

  // This function makes reachable towns enterable and shows locked towns on
  // the map.
  createTownHotspot(town, unlocked) {

    const { x, y } = this.mapPosition(town.x, town.y);
    const statusY = this.mapPosition(town.x, town.statusY ?? town.y + 0.08).y;
    const hit = this.add.circle(x, y, 105, 0xffffff, 0.001).setDepth(900);
    if (!unlocked) {
      this.add.circle(x, statusY, 48, 0x0f172a, 0.84).setStrokeStyle(4, 0x64748b).setDepth(901);
      this.add.text(x, statusY, 'LOCKED', { fontFamily: 'Arial', fontSize: '24px', fontStyle: 'bold', color: '#cbd5e1' })
        .setOrigin(0.5).setDepth(902);
      bindSelectionDetails(this, hit, { title: town.name, description: 'This town has not been reached yet. Advance through the preceding delves to unlock it.' });
      return;
    }

    hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => {

      HapticsService.tap();
      GameState.world.currentLocation = town.id;
      if (!GameState.world.discoveredLocations.includes(town.id)) GameState.world.discoveredLocations.push(town.id);
      if (town.id === 'duskfall') {
        ['dolmark-den', 'murmuring-abyss'].forEach((id) => {

          if (!GameState.world.discoveredLocations.includes(id)) GameState.world.discoveredLocations.push(id);
        });
      }
      saveProfile();
      this.scene.start('TownScene', { townId: town.id, townName: town.name });
    });
    bindSelectionDetails(this, hit, { title: town.name, description: "Visit town to prepare your party and choose leadership tactics at the Adventurer's Hall." });
  }

  // This function adds a touch target and status marker for one delve. It
  // checks discovery, prerequisites, location access, and Void Keys before
  // opening the overview, or shows the previous results for a cleared delve.
  createDelveHotspot(delve) {

    const { x, y } = this.mapPosition(delve.map.x, delve.map.y);
    const statusY = this.mapPosition(delve.map.x, LOCATION_STATUS_Y[delve.id] ?? delve.map.y + 0.08).y;

    // Collect the access rules separately so taps can explain a missing
    // discovery or key.
    const devUnlock = GameState.development.unlockAll;
    const replayCleared = GameState.development.replayCleared;
    const discovered = devUnlock || this.isDiscovered(delve.id);
    const cleared = this.isCleared(delve.id);
    const prerequisitesMet = devUnlock || (delve.prerequisites ?? []).every((id) => this.isCleared(id));
    const locationMet = devUnlock || !delve.requiresLocation || this.isDiscovered(delve.requiresLocation);
    const keyMet = devUnlock || !delve.requiresVoidKey || (GameState.inventory.voidKeys ?? 0) > 0;
    const available = devUnlock || (discovered && prerequisitesMet && locationMet);

    const hit = this.add.circle(x, y, Math.max(75, this.scale.width * delve.map.radius), 0xffffff, 0.001).setDepth(900);
    hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => {

      HapticsService.tap();
      if (!available) {
        this.showToast('This location has not been reached yet.');
        return;
      }

      // Cleared locations show their recorded results unless development
      // replay mode is enabled.
      if (cleared && !replayCleared) {
        this.showClearedReview(delve);
        return;
      }
      if (!keyMet) {
        this.showToast('A Void Key is required to enter this portal.');
        return;
      }

      // Store the chosen location and copy its definition into the new
      // encounter state before opening the overview.
      GameState.world.currentLocation = delve.id;
      GameState.currentDelve = { ...delve };
      GameState.currentRoom = 0;
      saveProfile();
      this.scene.start('DelveSelectScene');
    });

    bindSelectionDetails(this, hit, () => delveDetails(delve));

    // Show the appropriate map marker for a cleared, key-gated, or
    // unavailable location.
    if (cleared) {
      this.add.circle(x, statusY, 36, 0x14532d, 0.94).setStrokeStyle(5, 0x86efac).setDepth(905);
      this.add.text(x, statusY, '✓', { fontFamily: 'Arial', fontSize: '46px', fontStyle: 'bold', color: '#dcfce7' }).setOrigin(0.5).setDepth(906);
    } else if (available && delve.requiresVoidKey && !keyMet) {
      this.add.circle(x, statusY, 34, 0x3b0764, 0.94).setStrokeStyle(4, 0xc084fc).setDepth(905);
      this.add.text(x, statusY, 'KEY', { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#f3e8ff' }).setOrigin(0.5).setDepth(906);
    } else if (!available) {
      this.add.circle(x, statusY, 28, 0x111827, 0.9).setStrokeStyle(3, 0x64748b).setDepth(905);
      this.add.text(x, statusY, '×', { fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#94a3b8' }).setOrigin(0.5).setDepth(906);
    }
  }

  // This function marks the party current location on the world map.
  createPartyIndicator() {

    const lookup = {
      pineshire: TOWNS.pineshire,
      duskfall: TOWNS.duskfall,
      ...Object.fromEntries(delves.map((delve) => [delve.id, { x: delve.map.x, y: delve.map.y }]))
    };
    const location = lookup[GameState.world.currentLocation] ?? TOWNS.pineshire;
    const { x, y } = this.mapPosition(location.x, location.y);
    const markerY = y - 88;
    this.add.circle(x, markerY, 25, 0xf8fafc, 0.96).setStrokeStyle(5, 0x0f172a).setDepth(920);
    this.add.triangle(x, markerY + 31, 0, 0, 18, 28, -18, 28, 0xf8fafc).setAngle(180).setDepth(919);
    this.add.text(x, markerY - 41, 'PARTY', { fontFamily: 'Arial', fontSize: '22px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5).setDepth(921);
  }

  // This function exposes testing controls and shows whether testing mode is
  // active.
  createDevelopmentButton(width, height) {

    const enabled = GameState.development.unlockAll && GameState.development.replayCleared;
    const x = 190;
    const y = height - 52;
    const button = this.add.rectangle(x, y, 300, 64, enabled ? 0x7c2d12 : 0x1e293b, 0.94)
      .setStrokeStyle(3, enabled ? 0xfb923c : 0x64748b)
      .setInteractive({ useHandCursor: true })
      .setDepth(1000);
    this.add.text(x, y, enabled ? 'DEV MODE: ON' : 'DEV TOOLS', {
      fontFamily: 'Arial', fontSize: '26px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(1001);
    button.on('pointerdown', () => {

      HapticsService.tap();
      this.showDevelopmentTools();
    });
  }

  // This function opens the development tools dialog with testing-mode
  // controls, a Void Key grant, and a progress-reset entry point. Changes are
  // saved immediately, while resetting progress opens a separate confirmation
  // dialog.
  showDevelopmentTools() {

    const { width, height } = this.scale;
    const depth = 4000;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setInteractive()
      .setDepth(depth);
    const panelWidth = Math.min(1180, width * 0.68);
    const panelHeight = Math.min(720, height * 0.76);
    const panel = this.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x0b0f16, 0.99)
      .setStrokeStyle(5, 0x475569)
      .setDepth(depth + 1);

    const title = this.add.text(width / 2, height * 0.29, 'DEVELOPMENT TOOLS', {
      fontFamily: 'Arial', fontSize: '48px', fontStyle: 'bold', color: '#f8fafc'
    }).setOrigin(0.5).setDepth(depth + 2);

    const enabled = GameState.development.unlockAll && GameState.development.replayCleared;
    const description = this.add.text(width / 2, height * 0.38,
      enabled
        ? 'All map locations are unlocked. Cleared Delves and Void Portals can be replayed, and Void Keys are ignored.'
        : 'Enable testing mode to unlock the whole map, replay cleared encounters, and bypass Void Key requirements.', {
        fontFamily: 'Arial', fontSize: '29px', color: '#cbd5e1', align: 'center', wordWrap: { width: Math.min(900, panelWidth - 140), useAdvancedWrap: true }
      }).setOrigin(0.5).setDepth(depth + 2);

    // Create the testing-mode toggle that controls map unlocks and
    // cleared-encounter replays together.
    const toggle = this.add.rectangle(width / 2, height * 0.48, 650, 78, enabled ? 0x9a3412 : 0x334155)
      .setInteractive({ useHandCursor: true })
      .setDepth(depth + 2);
    const toggleText = this.add.text(width / 2, height * 0.48, enabled ? 'DISABLE TESTING MODE' : 'UNLOCK ALL + ENABLE REPLAYS', {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 3);

    // Provide a separate key grant so portal entry can be tested with normal
    // access rules.
    const addVoidKey = this.add.rectangle(width / 2 - 175, height * 0.58, 320, 88, 0x312e81)
      .setStrokeStyle(3, 0x818cf8)
      .setInteractive({ useHandCursor: true })
      .setDepth(depth + 2);
    const addVoidKeyText = this.add.text(width / 2 - 175, height * 0.58, `+ VOID KEY\n${GameState.inventory.voidKeys ?? 0} owned`, {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 3);

    // Grant one leader level using the normal five-level TP milestones.
    // Show the resulting rank and balance directly on the button.
    const addLevel = this.add.rectangle(width / 2 + 175, height * 0.58, 320, 88, 0x14532d)
      .setStrokeStyle(3, 0x86efac).setInteractive({ useHandCursor: true }).setDepth(depth + 2);
    const levelText = this.add.text(width / 2 + 175, height * 0.58,
      '+ LEVEL\nLv ' + GameState.leader.level + ' / ' + GameState.leader.tacticsPoints + ' TP', {
        fontFamily: 'Arial', fontSize: '27px', fontStyle: 'bold', color: '#ffffff', align: 'center'
      }).setOrigin(0.5).setDepth(depth + 3);
    addLevel.on('pointerdown', () => {

      HapticsService.confirm();
      const result = grantLeaderLevels(GameState.leader);
      levelText.setText('+ LEVEL\nLv ' + GameState.leader.level + ' / ' + GameState.leader.tacticsPoints + ' TP');
      this.showToast(result.tacticsPointsEarned > 0 ? '+1 Level / +1 Tactics Point' : '+1 Level / TP awarded every 5 levels');
    });

    // Keep the destructive reset behind its own confirmation screen.
    const reset = this.add.rectangle(width / 2, height * 0.68, 650, 78, 0x7f1d1d)
      .setStrokeStyle(3, 0xf87171)
      .setInteractive({ useHandCursor: true })
      .setDepth(depth + 2);
    const resetText = this.add.text(width / 2, height * 0.68, 'RESET ALL PROGRESS', {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 3);

    const close = this.add.rectangle(width / 2, height * 0.77, 360, 68, 0x334155)
      .setInteractive({ useHandCursor: true })
      .setDepth(depth + 2);
    const closeText = this.add.text(width / 2, height * 0.77, 'CLOSE', {
      fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 3);

    const objects = [shade, panel, title, description, toggle, toggleText, addVoidKey, addVoidKeyText, addLevel, levelText, reset, resetText, close, closeText];

    // This function removes all objects belonging to this development dialog.
    const destroy = () => objects.forEach((object) => object?.destroy());

    toggle.on('pointerdown', () => {

      HapticsService.confirm();
      const next = !enabled;
      GameState.development.unlockAll = next;
      GameState.development.replayCleared = next;
      saveProfile();
      destroy();
      this.scene.restart();
    });


    addVoidKey.on('pointerdown', () => {

      HapticsService.confirm();
      GameState.inventory.voidKeys = (GameState.inventory.voidKeys ?? 0) + 1;
      saveProfile();
      addVoidKeyText.setText(`ADD VOID KEY  (${GameState.inventory.voidKeys} owned)`);
      this.showToast('Added 1 Void Key.');
    });

    reset.on('pointerdown', () => {

      HapticsService.tap();
      destroy();
      this.showResetConfirmation();
    });

    close.on('pointerdown', () => {

      HapticsService.tap();
      destroy();
    });
  }

  // This function asks the player to confirm before clearing saved
  // progression.
  showResetConfirmation() {

    const { width, height } = this.scale;
    const depth = 4100;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78).setInteractive().setDepth(depth);
    const panelWidth = Math.min(980, width * 0.58);
    const panel = this.add.rectangle(width / 2, height / 2, panelWidth, 430, 0x111827, 0.99)
      .setStrokeStyle(5, 0xef4444).setDepth(depth + 1);
    const title = this.add.text(width / 2, height * 0.41, 'RESET ALL PROGRESS?', {
      fontFamily: 'Arial', fontSize: '44px', fontStyle: 'bold', color: '#fecaca'
    }).setOrigin(0.5).setDepth(depth + 2);
    const body = this.add.text(width / 2, height * 0.48, 'This clears map progress, loot, gold, adventurer progression, and Battle Tactics progression.', {
      fontFamily: 'Arial', fontSize: '27px', color: '#e5e7eb', align: 'center', wordWrap: { width: Math.min(760, panelWidth - 120), useAdvancedWrap: true }
    }).setOrigin(0.5).setDepth(depth + 2);

    const yes = this.add.rectangle(width / 2 - 190, height * 0.60, 320, 76, 0x991b1b)
      .setInteractive({ useHandCursor: true }).setDepth(depth + 2);
    const yesText = this.add.text(width / 2 - 190, height * 0.60, 'RESET', {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 3);
    const no = this.add.rectangle(width / 2 + 190, height * 0.60, 320, 76, 0x334155)
      .setInteractive({ useHandCursor: true }).setDepth(depth + 2);
    const noText = this.add.text(width / 2 + 190, height * 0.60, 'CANCEL', {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(depth + 3);

    const objects = [shade, panel, title, body, yes, yesText, no, noText];

    // This function removes all objects belonging to this development dialog.
    const destroy = () => objects.forEach((object) => object?.destroy());

    yes.on('pointerdown', () => {

      HapticsService.confirm();
      clearSavedProfile();
      clearLeaderProgression();
      destroy();
      this.scene.start('BootScene');
    });
    no.on('pointerdown', () => {

      HapticsService.tap();
      destroy();
      this.showDevelopmentTools();
    });
  }

  // This function gives brief feedback about an unavailable choice or
  // completed action.
  showToast(message) {

    const { width, height } = this.scale;
    const panel = this.add.rectangle(width / 2, height * 0.17, Math.min(1200, width * 0.65), 82, 0x0f172a, 0.96)
      .setStrokeStyle(3, 0x64748b).setDepth(2000);
    const text = this.add.text(width / 2, height * 0.17, message, { fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#f8fafc' })
      .setOrigin(0.5).setDepth(2001);
    this.tweens.add({ targets: [panel, text], alpha: 0, delay: 1200, duration: 450, onComplete: () => {

      panel.destroy(); text.destroy();
    } });
  }

  // This function lets the player review a cleared delve best time and latest
  // loot.
  showClearedReview(delve) {

    const { width, height } = this.scale;
    const record = GameState.records[delve.id] ?? {};
    const loot = (record.lastRewards ?? []).map((reward) => reward.type === 'gold' ? `${reward.amount} Gold` : reward.label ?? reward.type).join(', ') || 'No recorded loot';
    const overlay = this.add.rectangle(width / 2, height / 2, width * 0.64, height * 0.48, 0x0b0f16, 0.97)
      .setStrokeStyle(5, 0x86efac).setDepth(3000);
    this.add.text(width / 2, height * 0.34, `${delve.name} - CLEARED`, { fontFamily: 'Arial', fontSize: '52px', fontStyle: 'bold', color: '#bef264' })
      .setOrigin(0.5).setDepth(3001);
    this.add.text(width / 2, height * 0.43, `Waves: ${record.waves ?? delve.rooms}   Best: ${formatDuration(record.bestTimeMs)}`, { fontFamily: 'Arial', fontSize: '32px', color: '#e2e8f0' })
      .setOrigin(0.5).setDepth(3001);
    this.add.text(width / 2, height * 0.51, `Last haul: ${loot}`, { fontFamily: 'Arial', fontSize: '30px', color: '#fbbf24', wordWrap: { width: width * 0.52 }, align: 'center' })
      .setOrigin(0.5).setDepth(3001);
    const close = this.add.rectangle(width / 2, height * 0.64, 360, 78, 0x334155).setInteractive({ useHandCursor: true }).setDepth(3001);
    this.add.text(width / 2, height * 0.64, 'CLOSE', { fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(3002);
    close.on('pointerdown', () => this.scene.restart());
  }
}
