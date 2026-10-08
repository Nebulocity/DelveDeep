// This is where we start the game. Phaser gets its screen list and canvas settings from
// gameConfig. The services attached to game are shared by screens, so music and background
// progress survive a screen change.

import Phaser from 'phaser';
import gameConfig from './config/gameConfig.js';
import BackgroundProgress from './services/BackgroundProgress.js';
import HapticsService from './services/HapticsService.js';
import { settleEverdeep } from './game/Everdeep.js';
import MusicService from './services/MusicService.js';

const game = new Phaser.Game(gameConfig);
game.music = new MusicService(game);

game.backgroundProgress = new BackgroundProgress(game, {

  // We handle on background here, keeping this operation in one place for its callers.
  onBackground: (background) => {
    HapticsService.background = background;
    game.music.setBackground(background);
  },

  // We handle on settle here, keeping this operation in one place for its callers.
  onSettle: () => settleEverdeep()
});

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('visualQa')) {
  import('./tests/visual/devBridge.js').then(({ installVisualQaBridge }) => installVisualQaBridge(game));
}

export default game;
