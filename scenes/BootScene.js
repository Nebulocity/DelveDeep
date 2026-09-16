import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import OrientationService from '../services/OrientationService.js';
import { loadLeaderProgression } from '../game/LeaderProgression.js';
import { loadProfile } from '../game/GameStorage.js';
import worldMapUrl from '../assets/map.png?url';

export default class BootScene extends Phaser.Scene {
  // I register BootScene so the game can navigate to this screen.
  constructor() {

    super('BootScene');
  }

  // I load the world map before the player enters the game.
  preload() {

    this.load.image('world-map', worldMapUrl);
  }

  // I restore the session and enter the world map in landscape.
  create() {

    this.initializeGameState();
    OrientationService.lockLandscape();
    this.scene.start('TitleScene');
  }

  // I restore persistent progress and prepare clean encounter state.
  initializeGameState() {

    // I rebuild base stats from current definitions, then merge saved growth.
    loadProfile(adventurers);

    // I restore the leader from its separate save record.
    GameState.leader = loadLeaderProgression();

    // I preserve saved party order and copy roster entries so temporary
    // changes to top-level party stats do not alter the permanent roster.
    GameState.activeParty = GameState.roster
      .filter((adventurer) => GameState.lastPartyIds.includes(adventurer.id))
      .sort((a, b) => GameState.lastPartyIds.indexOf(a.id) - GameState.lastPartyIds.indexOf(b.id))
      .map((adventurer) => ({ ...adventurer }));

    // I clear expedition details so a new session cannot resume a stale run.
    GameState.currentDelve = null;
    GameState.currentRoom = 0;
    GameState.rewards = [];

    // I seed the snapshots used to compare and roll back run resources.
    GameState.run = {
      startedAt: 0,
      elapsedMs: 0,
      summary: null,
      startingGold: GameState.gold,
      startingInventory: { ...GameState.inventory }
    };
  }
}
