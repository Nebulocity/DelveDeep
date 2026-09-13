import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import OrientationService from '../services/OrientationService.js';
import { loadLeaderProgression } from '../game/LeaderProgression.js';
import { loadProfile } from '../game/GameStorage.js';
import worldMapUrl from '../assets/map.png?url';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.image('world-map', worldMapUrl);
  }

  create() {
    this.initializeGameState();
    OrientationService.lockLandscape();
    this.scene.start('TitleScene');
  }

  initializeGameState() {
    loadProfile(adventurers);
    GameState.leader = loadLeaderProgression();
    GameState.activeParty = GameState.roster
      .filter((adventurer) => GameState.lastPartyIds.includes(adventurer.id))
      .sort((a, b) => GameState.lastPartyIds.indexOf(a.id) - GameState.lastPartyIds.indexOf(b.id))
      .map((adventurer) => ({ ...adventurer }));
    GameState.currentDelve = null;
    GameState.currentRoom = 0;
    GameState.rewards = [];
    GameState.run = {
      startedAt: 0,
      elapsedMs: 0,
      summary: null,
      startingGold: GameState.gold,
      startingInventory: { ...GameState.inventory }
    };
  }
}
