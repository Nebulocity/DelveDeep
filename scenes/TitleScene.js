import { bindSelectionDetails, addDetailsHint, delveDetails } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import delves from '../data/delves.js';
import HapticsService from '../services/HapticsService.js';
import { formatDuration } from '../game/ExpeditionProgression.js';
import { saveProfile, clearSavedProfile } from '../game/GameStorage.js';
import { clearLeaderProgression, grantLeaderLevels } from '../game/LeaderProgression.js';
import { hideLoadingScreenAfterRender } from '../ui/LoadingScreen.js';

const TOWNS = {
  pineshire: { id: 'pineshire', name: 'Pineshire', x: 0.091, y: 0.485, statusY: 0.57 },
  duskfall: { id: 'duskfall', name: 'Duskfall', x: 0.704, y: 0.548, statusY: 0.64 }
};

const LOCATION_STATUS_Y = {
  'slime-cave': 0.56,
  'thornbriar-hollow': 0.59,
  'dolmark-den': 0.34,
  'murmuring-abyss': 0.86,
  'vibrant-tear': 0.88
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

    this.currencyText = this.add.text(width - 58, 26, `Gold: ${GameState.gold}`, {
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
    hideLoadingScreenAfterRender(this);
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
        ['dolmark-den', 'murmuring-abyss', 'vibrant-tear'].forEach((id) => {

          if (!GameState.world.discoveredLocations.includes(id)) GameState.world.discoveredLocations.push(id);
        });
      }
      saveProfile();
      this.scene.start('TownScene', { townId: town.id, townName: town.name });
    });
    bindSelectionDetails(this, hit, { title: town.name, description: "Visit town to prepare your party and choose leadership tactics at the Adventurer's Hall." });
  }

  // This function adds a touch target and status marker for one delve. It
  // checks discovery, prerequisites, and location access before
  // opening the overview, or shows the previous results for a cleared delve.
  createDelveHotspot(delve) {

    const { x, y } = this.mapPosition(delve.map.x, delve.map.y);
    const statusY = this.mapPosition(delve.map.x, LOCATION_STATUS_Y[delve.id] ?? delve.map.y + 0.08).y;

    if (delve.id === 'vibrant-tear') this.createVibrantTearMarker(x, y);

    // Collect the access rules separately so taps can explain a missing
    // discovery or progression.
    const devUnlock = GameState.development.unlockAll;
    const replayCleared = GameState.development.replayCleared;
    const discovered = devUnlock || this.isDiscovered(delve.id)
      || (delve.id === 'vibrant-tear' && this.isDiscovered('duskfall'));
    const cleared = this.isCleared(delve.id);
    const prerequisitesMet = devUnlock || (delve.prerequisites ?? []).every((id) => this.isCleared(id));
    const locationMet = devUnlock || !delve.requiresLocation || this.isDiscovered(delve.requiresLocation);
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
      // Store the chosen location and copy its definition into the new
      // encounter state before opening the overview.
      GameState.world.currentLocation = delve.id;
      GameState.currentDelve = { ...delve };
      GameState.currentRoom = 0;
      saveProfile();
      this.scene.start('DelveSelectScene');
    });

    bindSelectionDetails(this, hit, () => delveDetails(delve));

    // Show the appropriate map marker for a cleared or unavailable location.
    if (cleared) {
      this.add.circle(x, statusY, 36, 0x14532d, 0.94).setStrokeStyle(5, 0x86efac).setDepth(905);
      this.add.text(x, statusY, '✓', { fontFamily: 'Arial', fontSize: '46px', fontStyle: 'bold', color: '#dcfce7' }).setOrigin(0.5).setDepth(906);
    } else if (!available) {
      this.add.circle(x, statusY, 28, 0x111827, 0.9).setStrokeStyle(3, 0x64748b).setDepth(905);
      this.add.text(x, statusY, '×', { fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#94a3b8' }).setOrigin(0.5).setDepth(906);
    }
  }

  // This function adds a visible map landmark for the new rift without
  // changing the existing illustrated map asset.
  createVibrantTearMarker(x, y) {

    this.add.ellipse(x, y + 25, 158, 46, 0x4f6f30, 0.92)
      .setStrokeStyle(3, 0x1b321d).setDepth(870);
    this.add.ellipse(x, y - 9, 65, 90, 0x120b20, 0.98)
      .setStrokeStyle(8, 0xb347ee).setDepth(871);
    this.add.ellipse(x, y - 11, 34, 67, 0x05050e, 1).setDepth(872);
    this.add.rectangle(x, y + 68, 332, 56, 0xd9b77d, 0.98)
      .setStrokeStyle(4, 0x49301e).setDepth(873);
    this.add.text(x, y + 68, 'The Vibrant Tear', {
      fontFamily: 'Georgia', fontSize: '31px', fontStyle: 'bold', color: '#21150f'
    }).setOrigin(0.5).setDepth(874);
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
    const button = this.add.rectangle(x, y, 300, 64, enabled ? 0x00f2fa : 0x08192e, 0.94)
      .setStrokeStyle(3, 0x00f2fa)
      .setInteractive({ useHandCursor: true })
      .setDepth(1000);
    this.add.text(x, y, enabled ? 'DEV MODE: ON' : 'DEV TOOLS', {
      fontFamily: 'Arial', fontSize: '26px', fontStyle: 'bold', color: enabled ? '#08192e' : '#ffffff'
    }).setOrigin(0.5).setDepth(1001);
    button.on('pointerdown', () => {

      HapticsService.tap();
      this.showDevelopmentTools();
    });
  }

  // This function opens the development controls in labeled rows. Grants and
  // display preferences save immediately; progress reset asks for confirmation.
  showDevelopmentTools() {

    const { width, height } = this.scale;
    const depth = 4000;
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setInteractive()
      .setDepth(depth);
    const panelWidth = Math.min(1280, width * 0.82);
    const panelHeight = Math.min(850, height * 0.84);
    const panelTop = (height - panelHeight) / 2;
    const panelLeft = (width - panelWidth) / 2;
    const rowY = (index) => panelTop + 180 + index * 105;
    const labelX = panelLeft + 100;
    const firstX = panelLeft + 720;
    const secondX = panelLeft + 995;
    const buttonWidth = 220;
    const objects = [shade];
    const panel = this.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x0b0f16, 0.99)
      .setStrokeStyle(5, 0x475569)
      .setDepth(depth + 1);
    objects.push(panel);
    objects.push(this.add.text(width / 2, panelTop + 72, 'DEV TOOLS', {
      fontFamily: 'Arial', fontSize: '48px', fontStyle: 'bold', color: '#f8fafc'
    }).setOrigin(0.5).setDepth(depth + 2));

    const addLabel = (index, label) => {
      objects.push(this.add.text(labelX, rowY(index), label, {
        fontFamily: 'Arial', fontSize: '36px', fontStyle: 'bold', color: '#e2e8f0'
      }).setOrigin(0, 0.5).setDepth(depth + 2));
    };
    const addButton = (x, y, label, color, stroke, action, textColor = '#ffffff') => {
      const button = this.add.rectangle(x, y, buttonWidth, 74, color)
        .setStrokeStyle(3, stroke).setInteractive({ useHandCursor: true }).setDepth(depth + 2);
      const caption = this.add.text(x, y, label, {
        fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: textColor
      }).setOrigin(0.5).setDepth(depth + 3);
      button.on('pointerdown', action);
      objects.push(button, caption);
      return { button, caption };
    };

    // This function removes all objects belonging to this development dialog.
    const destroy = () => objects.forEach((object) => object?.destroy());

    addLabel(0, 'Dev mode');
    const enabled = GameState.development.unlockAll && GameState.development.replayCleared;
    addButton(firstX, rowY(0), enabled ? 'ON' : 'OFF', enabled ? 0x00f2fa : 0x08192e, 0x00f2fa, () => {
      HapticsService.confirm();
      const next = !enabled;
      GameState.development.unlockAll = next;
      GameState.development.replayCleared = next;
      saveProfile();
      destroy();
      this.scene.restart();
    }, enabled ? '#08192e' : '#ffffff');

    addLabel(1, 'Level up');
    for (const [amount, x] of [[1, firstX], [5, secondX]]) {
      addButton(x, rowY(1), `+${amount}`, 0x0e9c4b, 0x86efac, () => {
        HapticsService.confirm();
        const result = grantLeaderLevels(GameState.leader, amount);
        this.showToast(`Leader level ${GameState.leader.level}  (+${result.tacticsPointsEarned} TP)`);
      });
    }

    addLabel(2, 'Gold');
    for (const [amount, x] of [[100, firstX], [500, secondX]]) {
      addButton(x, rowY(2), `+${amount}`, 0xb38c0c, 0xfde047, () => {
        HapticsService.confirm();
        GameState.gold += amount;
        saveProfile();
        this.currencyText.setText(`Gold: ${GameState.gold}`);
        this.showToast(`Added ${amount} Gold.`);
      });
    }

    addLabel(3, 'Grid lines');
    const gridVisible = GameState.development.showGridLines !== false;
    const gridToggle = addButton(firstX, rowY(3), gridVisible ? 'ON' : 'OFF',
      gridVisible ? 0xebed53 : 0x4e4f19, 0xebed53, () => {
        HapticsService.confirm();
        GameState.development.showGridLines = !GameState.development.showGridLines;
        saveProfile();
        gridToggle.caption.setText(GameState.development.showGridLines ? 'ON' : 'OFF');
        gridToggle.button.setFillStyle(GameState.development.showGridLines ? 0xebed53 : 0x4e4f19);
        gridToggle.caption.setColor(GameState.development.showGridLines ? '#1f2937' : '#ffffff');
      }, gridVisible ? '#1f2937' : '#ffffff');

    addLabel(4, 'Reset progress');
    addButton(firstX, rowY(4), 'RESET', 0x7f1d1d, 0xf87171, () => {
      HapticsService.tap();
      destroy();
      this.showResetConfirmation();
    });

    addButton(width / 2, panelTop + panelHeight - 52, 'CLOSE', 0x334155, 0x94a3b8, () => {
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
    const body = this.add.text(width / 2, height * 0.48, 'This clears map progress, gold, adventurer progression, and Battle Tactics progression.', {
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
    this.activeToast?.tween?.stop();
    this.activeToast?.panel?.destroy();
    this.activeToast?.text?.destroy();
    const panel = this.add.rectangle(width / 2, height * 0.17, Math.min(1200, width * 0.65), 82, 0x0f172a, 0.96)
      .setStrokeStyle(3, 0x64748b).setDepth(4200);
    const text = this.add.text(width / 2, height * 0.17, message, { fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#f8fafc' })
      .setOrigin(0.5).setDepth(4201);
    const toast = { panel, text, tween: null };
    this.activeToast = toast;
    toast.tween = this.tweens.add({ targets: [panel, text], alpha: 0, delay: 1200, duration: 450, onComplete: () => {
      panel.destroy();
      text.destroy();
      if (this.activeToast === toast) this.activeToast = null;
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
