import Phaser from 'phaser';
import gameConfig from './config/gameConfig.js';
import BackgroundProgress from './services/BackgroundProgress.js';
import HapticsService from './services/HapticsService.js';
import { settleEverdeep } from './game/Everdeep.js';
import MusicService from './services/MusicService.js';

const game = new Phaser.Game(gameConfig);
game.music = new MusicService(game);

game.backgroundProgress = new BackgroundProgress(game, {
  onBackground: (background) => {
    HapticsService.background = background;
    game.music.setBackground(background);
  },
  onSettle: () => settleEverdeep()
});

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('visualQa')) {
  import('./tests/visual/devBridge.js').then(({ installVisualQaBridge }) => installVisualQaBridge(game));
}

export default game;
