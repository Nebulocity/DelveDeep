// This is the region map entry screen. It connects the illustrated world, destination
// controls, travel and player settings to the saved world state.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import { showAbilityUnlockNotice } from '../ui/AbilityUnlockNotice.js';
import { diagnosticSettings, setDiagnosticSettings, DIAGNOSTIC_LEVELS } from '../combat/CombatDiagnostics.js';
import { isCombatLogging, startCombatLogging, stopCombatLogging, exportCombatRecording,
  showCombatArchives, combatRecordingReady } from '../combat/CombatRecording.js';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { saveProfile, clearSavedProfile } from '../game/GameStorage.js';
import { clearLeaderProgression, grantLeaderLevels } from '../game/LeaderProgression.js';
import { grantAdventurerLevels } from '../game/AdventurerProgression.js';
import { applyDevelopmentBoost, setDevelopmentExpeditionWave } from '../game/DevelopmentProgression.js';
import { everdeepRuns } from '../game/Everdeep.js';

import { hideLoadingScreenAfterRender } from '../ui/LoadingScreen.js';
import { createScrollingWorldMap, updateScrollingWorldMap } from './ScrollingWorldMap.js';
import { addRegionPanel, addRegionButton, addRegionNotice, setRegionPanelState, regionMessageBounds } from '../ui/RegionMapTheme.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import { resolveWorldMapCharacter, worldMapParty } from '../game/WorldMapCharacter.js';
import { addMapCharacterPreview, showWorldMapCharacterGallery } from '../ui/WorldMapCharacterGallery.js';
import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { townLayout, setTownLayout } from '../game/TownPreferences.js';
import { preloadTownAssets } from '../ui/TownAssets.js';
import delves from '../data/delves.js';
import { preloadDelveBestiary } from '../ui/DelveBestiary.js';
import { REGIONAL_MAPS } from '../data/regionalMaps.js';
import { preloadRegionalMap } from '../ui/RegionalMapRenderer.js';
import { refreshRegionMapGold } from '../ui/RegionMapUI.js';
import { hallScroll } from '../ui/HallUI.js';
import { serviceScrollSurface } from '../ui/TownServiceTheme.js';
import { playUiSound, runUiAction } from '../services/UiAudioService.js';

export default class TitleScene extends Phaser.Scene {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor() {
    super('TitleScene');
  }

  // Settings can switch representatives without leaving the map. Preload the
  // eligible party's idle and walk clips; other combat sheets stay unloaded.
  preload() {
    preloadTownAssets(this);
    preloadRegionalMap(this, REGIONAL_MAPS['pineshire-reach']);

    // Details can inspect any destination before the party travels there. Load only
    // its idle sheets, sharing a queue because several destinations reuse monsters.
    const bestiaryTextures = new Set();
    for (const delve of delves) preloadDelveBestiary(this, delve, bestiaryTextures);
    const previousId = GameState.world.mapCharacterId;
    resolveWorldMapCharacter();
    if (previousId !== GameState.world.mapCharacterId) saveProfile();
    const queued = new Set();
    for (const hero of worldMapParty()) {
      const definition = CHARACTER_SPRITES[hero.id];
      if (!definition) continue;
      const keys = new Set(['idle', 'walk'].flatMap(state =>
        Object.values(definition.clips[state]).flatMap(clip => clip.frames.map(frame => frame.key))));
      for (const texture of definition.textures) {
        if (keys.has(texture.key) && !queued.has(texture.key) && !this.textures.exists(texture.key)) {
          queued.add(texture.key);
          this.load.spritesheet(texture.key, texture.url, { frameWidth: 256, frameHeight: 256 });
        }
      }
    }
  }

  // We build this screen and connect its input after the queued assets are ready. Display
  // objects belong to this scene and are removed when the scene shuts down.
  create() {
    createScrollingWorldMap(this);
    hideLoadingScreenAfterRender(this);
    showAbilityUnlockNotice(this);
  }

  // Phaser calls this while the screen is running. time is its clock timestamp and delta
  // is the elapsed frame time, both in milliseconds. Per-second movement needs delta /
  // 1000 so a faster display does not make the game run faster. time is a timestamp on the
  // gameplay clock in milliseconds, not a duration. delta is elapsed frame time in
  // milliseconds; divide by 1000 for movement in seconds.
  update(time, delta) {
    updateScrollingWorldMap(this, delta);
    for (const object of this.children.list) {
      if (object.depth >= 1000 && object.scrollFactorX !== 0) object.setScrollFactor(0);
    }
  }

  // Normal Settings keeps its existing controls. Seven taps on its heading open the
  // separate testing window in every build during the friends playtest.
  async showDevelopmentTools(devSettings = false) {
    playUiSound(this, 'dialogOpen');
    await combatRecordingReady;
    if (!this.sys.isActive()) return;
    this.mapLocationClose?.();

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.selectionDetailsClose?.();

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    const depth = 4000;

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. This gives the display object an input hit area. Visible
    // artwork alone does not make an object respond to a tap.
    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
      .setInteractive()
      .setDepth(depth);

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const panelWidth = Math.min(devSettings ? 1840 : 1360, width - 104);
    const panelHeight = Math.min(devSettings ? 1000 : 900, height - (devSettings ? 80 : 96));
    const panelTop = (height - panelHeight) / 2;
    const panelLeft = (width - panelWidth) / 2;
    const rowY = (index) => panelTop + (devSettings ? 166 : 300) + index * (devSettings ? 90 : 114);
    const labelX = panelLeft + 100;
    const firstX = panelLeft + (devSettings ? 650 : 720);

    const buttonWidth = 220;
    const objects = [shade];
    const contentObjects = [];
    const closeY = panelTop + panelHeight - 88;
    const panel = addRegionPanel(this, width / 2, height / 2, panelWidth, panelHeight, depth + 1);
    const stop = (pointer, x, y, event) => event?.stopPropagation?.();
    shade.on('pointerdown', stop).on('pointerup', stop);
    panel.setInteractive().on('pointerdown', stop).on('pointerup', stop);
    objects.push(panel);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    const heading = this.add.text(width / 2, panelTop + 72, devSettings ? 'DEV SETTINGS' : 'SETTINGS', {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('heading48'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f2d79f'
    }).setOrigin(0.5).setDepth(depth + 2);
    objects.push(heading);

    // The counter belongs only to this open window, so closing it locks access again.
    // Seven releases avoid opening this through an ordinary tap. There is no speed
    // requirement, so slower devices and deliberate touch input work the same way.
    if (!devSettings) {
      let taps = 0;
      heading.setInteractive().on('pointerup', () => {
        taps += 1;
        if (taps === 7) {
          HapticsService.confirm();
          this.showDevelopmentTools(true);
        }
      });
    }

    const addLabel = (index, label) => {

      // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
      // lower-depth objects. Origin is the anchor within the object: 0 is the left/top
      // edge, 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
      // necessarily the object's corner.
      contentObjects.push(this.add.text(labelX, rowY(index), label, {
        fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2'
      }).setOrigin(0, 0.5).setDepth(depth + 2));
    };

    const addButton = (x, y, label, color, stroke, action, textColor = '#ffffff', controlWidth = buttonWidth) => {
      const control = addRegionButton(this, x, y, controlWidth, 84, label, action, {
        depth: depth + 3, restrained: devSettings, haptic: false,
        state: label === 'RESET' ? 'danger' : label === 'ON' ? 'selected' : 'normal'
      });
      if (y === closeY) control.panel.uiSound = 'dialogClose';
      (y === closeY ? objects : contentObjects).push(...control.objects);
      return { button: control.panel, caption: control.text };
    };

    // This helper removes all objects belonging to this development dialog.
    const destroy = () => {
      objects.forEach((object) => object?.destroy());
      if (this.selectionDetailsClose === destroy) this.selectionDetailsClose = null;

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      this.events?.off('shutdown', destroy);
    };

    this.selectionDetailsClose = destroy;

    // once registers a callback that removes itself after the first matching event.
    this.events?.once('shutdown', destroy);

    // The header and Close stay fixed. The established scroll helper masks both
    // drawing and hit areas if a smaller logical canvas needs more vertical room.
    const finishLayout = () => {
      const bounds = { x: panelLeft + 72, y: panelTop + 132, width: panelWidth - 144, height: panelHeight - 278 };
      const contentHeight = Math.max(...contentObjects.map(object => object.getBounds().bottom)) - bounds.y + 16;
      const scroll = hallScroll(this, bounds, contentObjects, contentHeight, 0, () => {},
        (owner, x, y, w, h, variant) => serviceScrollSurface(owner, x, y, w, h, variant).setDepth(depth + 3),
        () => this.selectionDetailsClose !== destroy);
      scroll.container.setDepth(depth + 2).setScrollFactor(0);
      objects.push(scroll.container);
    };

    if (devSettings) {

      // These grants use the same caps and rewards as normal progression. No unlock
      // is saved for the window itself; only changes deliberately made here persist.
      contentObjects.push(this.add.text(firstX + 180, rowY(0), 'Combat logs', {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), color: '#fff1d2'
      }).setOrigin(0, 0.5).setDepth(depth + 3));
      const diagnosticsToggle = addButton(firstX + 700, rowY(0), diagnosticSettings().level, 0, 0, () => {
        HapticsService.tap();
        const settings = diagnosticSettings();
        const level = DIAGNOSTIC_LEVELS[(DIAGNOSTIC_LEVELS.indexOf(settings.level) + 1) % DIAGNOSTIC_LEVELS.length];
        setDiagnosticSettings({ level });
        diagnosticsToggle.caption.setText(level);
        this.showToast('Diagnostic level applies to the next encounter.');
      }, '#ffffff', 380);
      contentObjects.push(this.add.text(firstX + 180, rowY(1), 'Inactivity', {
        fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'), color: '#fff1d2'
      }).setOrigin(0, 0.5).setDepth(depth + 3));
      const inactivityToggle = addButton(firstX + 700, rowY(1), `${diagnosticSettings().inactivityMs / 1000}s`, 0, 0, () => {
        HapticsService.tap();
        const choices = [2000, 5000, 10000];
        const inactivityMs = choices[(choices.indexOf(diagnosticSettings().inactivityMs) + 1) % choices.length];
        setDiagnosticSettings({ inactivityMs });
        inactivityToggle.caption.setText(`${inactivityMs / 1000}s`);
      }, '#ffffff', 380);

      addLabel(0, 'Map testing');
      const mapToggle = addButton(firstX, rowY(0), GameState.development.mapTestingEnabled ? 'ON' : 'OFF', 0x08192e, 0x00f2fa, () => {
        HapticsService.confirm();
        const enabled = GameState.development.mapTestingEnabled !== true;
        GameState.development.mapTestingEnabled = enabled;
        GameState.development.unlockAll = enabled;
        GameState.development.replayCleared = enabled;
        saveProfile();
        mapToggle.caption.setText(enabled ? 'ON' : 'OFF');
        setRegionPanelState(this, mapToggle.button, enabled ? 'selected' : 'normal');

        // Redraw destination access after Settings closes, keeping this dialog open.
        this.mapAccessDirty = true;
      });

      addLabel(2, 'Renown Level');
      addLabel(3, 'Character Levels (all)');
      addLabel(4, 'Gold');

      // Two compact columns leave room for readable labels on the existing panel.
      const secondX = firstX + 250;
      for (const [amount, x] of [[1, firstX], [5, secondX]]) {
        addButton(x, rowY(2), `+${amount}`, 0x0e9c4b, 0x86efac, () => {
          HapticsService.confirm();
          const result = grantLeaderLevels(GameState.leader, amount);
          this.showToast(`Renown Level ${GameState.leader.level} (+${result.renownPointsEarned} RP)`);
        });
        addButton(x, rowY(3), `+${amount}`, 0x0e9c4b, 0x86efac, () => {
          HapticsService.confirm();
          GameState.roster.forEach(hero => grantAdventurerLevels(hero, amount));
          saveProfile();
          this.showToast(`Granted up to ${amount} levels per character, within the level cap.`);
        });
      }
      for (const [amount, x] of [[1000, firstX], [5000, secondX]]) {
        addButton(x, rowY(4), `+${amount.toLocaleString('en-US')}`, 0xb38c0c, 0xfde047, () => {
          HapticsService.confirm();
          GameState.gold += amount;
          saveProfile();
          refreshRegionMapGold(this);
          this.showToast(`Added ${amount} Gold.`);
        });
      }

      addLabel(1, 'Arena Border');
      const borderVisible = GameState.development.showArenaBorder !== false;
      const borderToggle = addButton(firstX, rowY(1), borderVisible ? 'ON' : 'OFF',
        borderVisible ? 0xebed53 : 0x4e4f19, 0xebed53, () => {
          HapticsService.confirm();
          GameState.development.showArenaBorder = !GameState.development.showArenaBorder;
          saveProfile();

          // The condition before ? chooses the first value when true and the value after :
          // when false.
          borderToggle.caption.setText(GameState.development.showArenaBorder ? 'ON' : 'OFF');
          setRegionPanelState(this, borderToggle.button, GameState.development.showArenaBorder ? 'selected' : 'normal');
          borderToggle.caption.setColor('#fff1d2');
        }, borderVisible ? '#1f2937' : '#ffffff');


      addLabel(5, 'Boost');
      for (const [index, level] of [5, 10, 15, 20, 25, 30].entries()) {
        addButton(firstX + index * 150, rowY(5), String(level), 0, 0, () => {
          HapticsService.confirm();
          const result = applyDevelopmentBoost(level);
          refreshRegionMapGold(this);
          this.mapAccessDirty = true;
          this.showToast(result.message);
        }, '#ffffff', 130);
      }

      addLabel(6, 'Expeditions');
      const runs = everdeepRuns();
      const choices = [null, ...runs.map(run => run.id)];
      let choice = 0;
      const selector = addButton(firstX + 300, rowY(6), 'ALL EXPEDITIONS', 0, 0, () => {
        HapticsService.tap();
        choice = (choice + 1) % choices.length;
        const run = runs.find(entry => entry.id === choices[choice]);
        const hero = GameState.roster.find(entry => entry.id === run?.party[0]?.id);
        selector.caption.setText(choice ? `#${choice} - ${hero?.name ?? 'Party'} - Wave ${run.resolvedWave}` : 'ALL EXPEDITIONS');
      }, '#ffffff', 820);
      for (const [index, wave] of [10, 20, 30, 40, 50, 60, 'Complete'].entries()) {
        addButton(panelLeft + 196 + index * 235, rowY(7), String(wave), 0, 0, () => {
          HapticsService.confirm();
          const count = setDevelopmentExpeditionWave(wave, choices[choice]);
          this.showToast(count ? `${count} expedition(s): ${wave === 'Complete' ? 'complete; claim earned chests in Everdeep.' : `wave ${wave}.`}` : 'No expeditions to update.');
        }, '#ffffff', 210);
      }

      addButton(width / 2, closeY, 'CLOSE', 0x334155, 0x94a3b8, () => {
        HapticsService.tap();
        this.showDevelopmentTools();
      });
      finishLayout();
      return;
    }
    
    addLabel(-1, 'World Map Character');
    const mapHero = resolveWorldMapCharacter();
    const characterName = this.add.text(firstX - 70, rowY(-1), mapHero?.name ?? 'No party', {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('body36'), color: '#ffdb86'
    }).setOrigin(0.5).setDepth(depth + 2);
    if (characterName.width > 240) characterName.setScale(240 / characterName.width);
    contentObjects.push(characterName);
    const characterPreview = addMapCharacterPreview(this, mapHero, firstX + 130, rowY(-1), 96, depth + 2);
    if (characterPreview) contentObjects.push(characterPreview);
    addButton(firstX + 350, rowY(-1), 'CHANGE', 0, 0, () => {
      showWorldMapCharacterGallery(this, () => this.showDevelopmentTools());
    });

    addLabel(0, 'BGM');
    const musicEnabled = GameState.development.musicEnabled === true;
    const musicToggle = addButton(firstX, rowY(0), musicEnabled ? 'ON' : 'OFF',
      0x08192e, 0x00f2fa, () => {
        HapticsService.confirm();
        this.game.music.setEnabled(GameState.development.musicEnabled !== true);
        saveProfile();
        const enabled = GameState.development.musicEnabled;

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        musicToggle.caption.setText(enabled ? 'ON' : 'OFF');
        setRegionPanelState(this, musicToggle.button, enabled ? 'selected' : 'normal');
      });

    addLabel(2, 'Combat logging');

    addLabel(5, 'Sound effects');
    const sfxToggle = addButton(firstX, rowY(5), GameState.preferences.sfxMuted ? 'OFF' : 'ON', 0, 0, () => {
      this.game.uiAudio.setMuted(!GameState.preferences.sfxMuted);
      sfxToggle.caption.setText(GameState.preferences.sfxMuted ? 'OFF' : 'ON');
      setRegionPanelState(this, sfxToggle.button, GameState.preferences.sfxMuted ? 'normal' : 'selected');
    });
    setRegionPanelState(this, sfxToggle.button, GameState.preferences.sfxMuted ? 'normal' : 'selected');
    addLabel(6, 'SFX volume');
    const volumeLabel = this.add.text(firstX, rowY(6), `${Math.round(GameState.preferences.sfxVolume * 100)}%`, {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('body36'), color: '#fff1d2'
    }).setOrigin(0.5).setDepth(depth + 2);
    contentObjects.push(volumeLabel);
    const changeVolume = amount => {
      this.game.uiAudio.setVolume(Math.round((GameState.preferences.sfxVolume + amount) * 100) / 100);
      volumeLabel.setText(`${Math.round(GameState.preferences.sfxVolume * 100)}%`);
    };
    addButton(firstX - 160, rowY(6), '−', 0, 0, () => changeVolume(-0.1), '#ffffff', 100);
    addButton(firstX + 160, rowY(6), '+', 0, 0, () => changeVolume(0.1), '#ffffff', 100);

    const loggingToggle = addButton(firstX, rowY(2), isCombatLogging() ? 'STOP LOGGING' : 'START LOGGING', 0, 0, async () => {
      HapticsService.confirm();
      loggingToggle.button.disableInteractive();
      try {
        if (isCombatLogging()) {
          await stopCombatLogging();
          await exportCombatRecording();
        } else {
          await startCombatLogging();
          if (isCombatLogging()) this.showToast('Logging started. Fights are recorded until you stop logging.');
        }
      } catch {
        this.showToast('Recording export failed. Keep the page open and use Export log to try again.');
      } finally {
        if (loggingToggle.button.active) {
          loggingToggle.caption.setText(isCombatLogging() ? 'STOP LOGGING' : 'START LOGGING');
          setRegionPanelState(this, loggingToggle.button, isCombatLogging() ? 'selected' : 'normal');
          loggingToggle.button.setInteractive({ useHandCursor: true });
        }
      }
    }, '#ffffff', 420);

    setRegionPanelState(this, loggingToggle.button, isCombatLogging() ? 'selected' : 'normal');

    addLabel(3, 'Recorded fights');
    addButton(firstX, rowY(3), 'EXPORT LOG', 0, 0, () => {
      HapticsService.tap();
      return runUiAction(this, report => showCombatArchives(() => {
        if (!loggingToggle.button.active) return;
        loggingToggle.caption.setText('START LOGGING');
        setRegionPanelState(this, loggingToggle.button, 'normal');
      }, this, report));
    }, '#ffffff', 360);

    addLabel(4, 'Town navigation');
    const townToggle = addButton(firstX, rowY(4), townLayout() === 'side-rails' ? 'SIDE RAILS' : 'COMPACT BAR', 0, 0, () => {
      HapticsService.tap();
      setTownLayout(townLayout() === 'side-rails' ? 'compact-bar' : 'side-rails');
      townToggle.caption.setText(townLayout() === 'side-rails' ? 'SIDE RAILS' : 'COMPACT BAR');
    }, '#ffffff', 360);

    addLabel(1, 'Reset progress');
    addButton(firstX, rowY(1), 'RESET', 0x7f1d1d, 0xf87171, () => {
      HapticsService.tap();
      destroy();
      this.showResetConfirmation();
    });

    addButton(width / 2, closeY, 'CLOSE', 0x334155, 0x94a3b8, () => {
      HapticsService.tap();
      destroy();
      if (this.mapAccessDirty) {
        this.mapAccessDirty = false;
        this.scene.restart();
      }
    });
    finishLayout();
  }

  // This helper asks the player to confirm before clearing saved progression.
  showResetConfirmation(onCancel = () => this.showDevelopmentTools()) {

    return showConfirmation(this, {
      title: 'RESET ALL PROGRESS?',
      description: 'This clears map progress, gold, adventurer progression, and Battle Tactics progression.',
      confirmLabel: 'RESET', onCancel,

      // Run the committed action after the player confirms this decision.
      onConfirm: () => {
        HapticsService.confirm();
        clearSavedProfile();
        clearLeaderProgression();
        this.scene.start('BootScene');
      }
    });
  }

  // This helper gives brief feedback about an unavailable choice or completed action.
  showToast(message, scope = 'ui') {

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    const bounds = regionMessageBounds(this, scope);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.activeToast?.tween?.stop();
    this.activeToast?.panel?.destroy();
    this.activeToast?.text?.destroy();

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const { panel, text } = addRegionNotice(this, bounds.centerX, height * 0.17, message,
      { width: Math.min(1400, bounds.width - 80), depth: 5200, fixed: true });
    const toast = { panel, text, tween: null };
    this.activeToast = toast;
    toast.tween = this.tweens.add({ targets: [panel.regionMapArt, text], alpha: 0, delay: 1200, duration: 450, onComplete: () => {
      panel.destroy();
      text.destroy();
      if (this.activeToast === toast) this.activeToast = null;
    } });
  }
}
