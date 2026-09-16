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

  // I use this setup to restore the player's persistent progress while making sure
  // every new play session begins with clean encounter data and a ready party.
  initializeGameState() {

    // The current adventurer definitions stay authoritative for base stats and classes.
    // Saved levels, experience, and other player progress are merged into that roster.
    loadProfile(adventurers);

    // Raid Leader progression has its own save record, separate from the main profile.
    GameState.leader = loadLeaderProgression();

    // Saved IDs preserve the player's previous party order. Copies keep temporary
    // combat changes from modifying the permanent roster entries by reference.
    GameState.activeParty = GameState.roster
      .filter((adventurer) => GameState.lastPartyIds.includes(adventurer.id))
      .sort((a, b) => GameState.lastPartyIds.indexOf(a.id) - GameState.lastPartyIds.indexOf(b.id))
      .map((adventurer) => ({ ...adventurer }));

    // Delve details belong to one expedition and must never carry into a new session.
    GameState.currentDelve = null;
    GameState.currentRoom = 0;
    GameState.rewards = [];

    // These snapshots let the expedition summary measure what changed during the run.
    GameState.run = {
      startedAt: 0,
      elapsedMs: 0,
      summary: null,
      startingGold: GameState.gold,
      startingInventory: { ...GameState.inventory }
    };
  }
}
