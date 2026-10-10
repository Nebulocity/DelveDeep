// Shared stone controls use the same saved BGM preference as the world map Dev Tools.

import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import HapticsService from '../services/HapticsService.js';
import { UI_FONT_SIZES } from '../config/uiTypography.js';
import { addStoneButton, stoneText, STONE } from './CarvedStone.js';
import { bindButtonPress } from './ButtonPress.js';

// Coordinates and sizes are logical canvas pixels, before phone display scaling.
export function addBgmToggle(scene, x, y, { width = 280, height = 94, depth = 10 } = {}) {
  const button = addStoneButton(scene, x, y, width, height, depth);
  const text = stoneText(scene, x, y, '', UI_FONT_SIZES.body32, depth + 1);

  // Read the existing preference so entering another scene preserves ON/OFF state.
  const refresh = () => {
    const enabled = GameState.development.musicEnabled === true;
    text.setText(enabled ? 'BGM ON' : 'BGM OFF');
    button.setStrokeStyle(2, enabled ? STONE.gold : scene.stoneTheme.accent, 0.7);
  };
  refresh();
  bindButtonPress(scene, button, [text], () => {
    HapticsService.confirm();

    // The music service updates playback immediately; the profile keeps it after reload.
    scene.game.music.setEnabled(GameState.development.musicEnabled !== true);
    saveProfile();
    refresh();
  });
  return { button, text };
}
