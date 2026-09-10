import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import OrientationService from '../services/OrientationService.js';
import { loadLeaderProgression } from '../game/LeaderProgression.js';
import { loadProfile } from '../game/GameStorage.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Shared game assets will be loaded here later.
  }

  create() {
    this.initializeGameState();
    OrientationService.lockLandscape();
    this.scene.start('TitleScene');
  }

  initializeGameState() {
    loadProfile(adventurers);
    GameState.leader = loadLeaderProgression();
    GameState.activeParty = [];
    GameState.currentDelve = null;
    GameState.currentRoom = 0;
    GameState.rewards = [];
    GameState.run = {
      startedAt: 0,
      elapsedMs: 0,
      summary: null
    };
  }
}
