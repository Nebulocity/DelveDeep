import Phaser from 'phaser';
import gameConfig from './config/gameConfig.js';

const game = new Phaser.Game(gameConfig);

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('visualQa')) {
  import('./tests/visual/devBridge.js').then(({ installVisualQaBridge }) => installVisualQaBridge(game));
}

export default game;
