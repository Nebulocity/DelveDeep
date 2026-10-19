import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import { combatPanel, combatButton, combatText } from './CombatHudTheme.js';
import { RADIAL_BEHAVIORS, RADIAL_BEHAVIOR_LABELS } from './CombatRadials.js';
import { bindButtonPress } from './ButtonPress.js';
import HapticsService from '../services/HapticsService.js';
import { addCloseEmblem } from './OrnateCloseButton.js';
import { COMBAT_PACE_OPTIONS, combatPacingFor } from '../config/combatSpeed.js';

export function createCombatPauseMenu(scene) {
  const { width, height } = scene.scale;
  const objects = [];
  const buttons = [];
  const x = width - 340;
  const y = height / 2;
  let menuOpen = false;
  let lastPaused = scene.combatPaused;
  const options = combatButton(scene, width - 340, 48, 84, 84, 9000);
  const optionsText = combatText(scene, width - 340, 48, '⚙', 43, 9002);
  const closeEmblem = addCloseEmblem(scene, width - 340, 48, 84, 9002);
  bindButtonPress(scene, options, [optionsText, closeEmblem], () => {
    menuOpen = !menuOpen;
    if (menuOpen) scene.radialHud.close();
    sync();
  });
  const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x020813, 0.12).setDepth(8900).setInteractive();
  shade.on('pointerdown', (pointer, lx, ly, event) => event.stopPropagation());
  objects.push(shade, combatPanel(scene, x, y, 620, 820, 8901));
  const label = (px, py, value, size = 29) => {
    const text = combatText(scene, px, py, value, size, 8904);
    objects.push(text);
    return text;
  };
  const button = (px, py, value, callback, w = 270) => {
    const hit = combatButton(scene, px, py, w, 76, 8902);
    const text = label(px, py, value, 27);
    objects.push(hit);
    buttons.push(hit);
    bindButtonPress(scene, hit, [text], callback);
    return { hit, text };
  };
  label(x, y - 340, 'PAUSE OPTIONS', 34);
  const music = button(x, y - 258, '', () => {
    scene.game.music.setEnabled(GameState.development.musicEnabled !== true);
    saveProfile();
    refresh();
  }, 550);
  label(x, y - 175, 'Delve Radial Behavior');
  const choices = RADIAL_BEHAVIORS.map((value, index) => {
    const choice = button(x + (index % 2 ? 144 : -144), y - 95 + Math.floor(index / 2) * 86,
      RADIAL_BEHAVIOR_LABELS[index], () => {
        GameState.preferences.delveRadialBehavior = value;
        saveProfile();
        scene.radialHud.settingChanged();
        HapticsService.tap();
        refresh();
      });
    return { ...choice, value };
  });
  label(x, y + 76, 'Combat Pace');
  const pace = button(x, y + 150, '', () => {
    const index = COMBAT_PACE_OPTIONS.findIndex(option => option.id === GameState.preferences.combatPace);
    const option = COMBAT_PACE_OPTIONS[(index + 1) % COMBAT_PACE_OPTIONS.length];
    GameState.preferences.combatPace = option.id;
    const pacing = combatPacingFor(option.id);
    for (const unit of [...scene.partyUnits, ...scene.enemies, ...(scene.abilityDecoys ?? [])]) {
      unit.setCombatPacing(pacing);
    }
    saveProfile();
    HapticsService.tap();
    refresh();
  }, 550);
  const paceDetail = label(x, y + 208, '', 25);
  button(x, y + 272, 'PREPARE COMMANDS', () => { menuOpen = false; sync(); }, 550);
  button(x - 144, y + 358, 'RESUME', () => scene.togglePause());
  button(x + 144, y + 358, 'RETREAT', () => scene.confirmRetreat());
  const refresh = () => {
    music.text.setText(`BGM ${GameState.development.musicEnabled ? 'ON' : 'OFF'}`);
    choices.forEach(choice => choice.hit.setStrokeStyle(3,
      choice.value === scene.radialHud.behavior ? 0xffd57b : 0x526981));
    const option = COMBAT_PACE_OPTIONS.find(entry => entry.id === GameState.preferences.combatPace) ?? COMBAT_PACE_OPTIONS[0];
    const pacing = combatPacingFor(option.id);
    pace.text.setText(`${option.label.toUpperCase()}  ›`);
    paceDetail.setText(pacing.cooldown === pacing.windup
      ? `Cooldowns + windups: ${pacing.cooldown}×`
      : `Cooldowns: ${pacing.cooldown}× / Windups: ${pacing.windup}×`);
  };
  const sync = () => {
    lastPaused = scene.combatPaused;
    if (!scene.combatPaused) menuOpen = false;
    const visible = scene.combatPaused && menuOpen;
    objects.forEach(object => object.setVisible(visible));
    buttons.forEach(hit => { hit.input.enabled = visible; });
    shade.input.enabled = visible;
    options.setVisible(scene.combatPaused);
    options.input.enabled = scene.combatPaused;
    optionsText.setVisible(scene.combatPaused && !menuOpen);
    options.pressVisuals[0].setVisible(scene.combatPaused && !menuOpen);
    closeEmblem.setVisible(visible);
    options.uiSound = menuOpen ? 'dialogClose' : 'click';
    refresh();
  };
  const update = () => { if (lastPaused !== scene.combatPaused) sync(); };
  scene.events.on('update', update);
  scene.events.once('shutdown', () => scene.events.off('update', update));
  sync();
  return { sync };
}
