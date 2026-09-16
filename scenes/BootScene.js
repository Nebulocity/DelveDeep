import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import OrientationService from '../services/OrientationService.js';
import { loadLeaderProgression } from '../game/LeaderProgression.js';
import { loadProfile } from '../game/GameStorage.js';
import worldMapUrl from '../assets/map.png?url';

export default class BootScene extends Phaser.Scene {

  // This function registers BootScene so the game can navigate to this
  // screen.
  constructor() {

    super('BootScene');
  }

  // This function loads the world map before the player enters the game.
  preload() {

    this.load.image('world-map', worldMapUrl);
  }

  // This function restores the session and enters the world map in landscape.
  create() {

    this.initializeGameState();
    OrientationService.lockLandscape();
    this.scene.start('TitleScene');
  }

  // This function restores persistent progress and prepares clean encounter
  // state.
  initializeGameState() {

    // Rebuild base stats from current definitions, then merge saved growth.
    loadProfile(adventurers);

    // Restore the leader from its separate save record.
    GameState.leader = loadLeaderProgression();

    // Preserve saved party order and copy roster entries so temporary changes
    // to top-level party stats do not alter the permanent roster.
    GameState.activeParty = GameState.roster
      .filter((adventurer) => GameState.lastPartyIds.includes(adventurer.id))
      .sort((a, b) => GameState.lastPartyIds.indexOf(a.id) - GameState.lastPartyIds.indexOf(b.id))
      .map((adventurer) => ({ ...adventurer }));

    // Clear expedition details so a new session cannot resume a stale run.
    GameState.currentDelve = null;
    GameState.currentRoom = 0;
    GameState.rewards = [];

    // Seed the snapshots used to compare and roll back run resources.
    GameState.run = {
      startedAt: 0,
      elapsedMs: 0,
      summary: null,
      startingGold: GameState.gold,
      startingInventory: { ...GameState.inventory }
    };
  }
}
