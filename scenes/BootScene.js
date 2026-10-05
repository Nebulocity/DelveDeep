import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import adventurers from '../data/adventurers.js';
import OrientationService from '../services/OrientationService.js';
import { loadLeaderProgression } from '../game/LeaderProgression.js';
import { loadProfile } from '../game/GameStorage.js';
import { prepareBuildSave } from '../game/BuildSave.js';
import partyIdleUrl from '../assets/characters/caramon-gladiator/reference-v2/sheets/idle.png?url';
import partyWalkUrl from '../assets/characters/caramon-gladiator/reference-v2/sheets/walk.png?url';
import townUrl from '../assets/screens/town.png?url';
import adventurersHallUrl from '../assets/screens/adventurerhall.png?url';
import alchemistUrl from '../assets/screens/alchemist.png?url';
import blacksmithUrl from '../assets/screens/blacksmith.png?url';
import enchanterUrl from '../assets/screens/enchanter.png?url';
import townSignHallUrl from '../assets/screens/town-signs/hall.png?url';
import townSignAlchemistUrl from '../assets/screens/town-signs/alchemist.png?url';
import townSignBlacksmithUrl from '../assets/screens/town-signs/blacksmith.png?url';
import townSignEnchanterUrl from '../assets/screens/town-signs/enchanter.png?url';
import townSignWorldMapUrl from '../assets/screens/town-signs/world-map.png?url';
import townSignDetailsUrl from '../assets/screens/town-signs/details.png?url';
import townForestUrl from '../assets/screens/town-concepts/pineshire.png?url';
import townMountainUrl from '../assets/screens/town-concepts/mountain-hold.png?url';
import townRiverUrl from '../assets/screens/town-concepts/river-town.png?url';
import townMarshUrl from '../assets/screens/town-concepts/marsh-town.png?url';
import townDesertUrl from '../assets/screens/town-concepts/desert-town.png?url';
import townCastleUrl from '../assets/screens/town-concepts/castle-town.png?url';
import { trackLoading } from '../ui/LoadingScreen.js';
import delves from '../data/delves.js';
import pineshireMapUrl from '../assets/world-map/illustrated-regions-v1/01-pineshire-reach-v4.png?url';

export default class BootScene extends Phaser.Scene {

  // This function registers BootScene so the game can navigate to this
  // screen.
  constructor() {

    super('BootScene');
  }

  // This function loads the world map before the player enters the game.
  preload() {

    trackLoading(this);
    this.load.image('world-pineshire-final', pineshireMapUrl);
    this.load.spritesheet('world-party-idle', partyIdleUrl, { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('world-party-walk', partyWalkUrl, { frameWidth: 256, frameHeight: 256 });
    this.load.image('town', townUrl);
    this.load.image('adventurers-hall', adventurersHallUrl);
    this.load.image('alchemist', alchemistUrl);
    this.load.image('blacksmith', blacksmithUrl);
    this.load.image('enchanter', enchanterUrl);
    this.load.image('town-sign-hall', townSignHallUrl);
    this.load.image('town-sign-alchemist', townSignAlchemistUrl);
    this.load.image('town-sign-blacksmith', townSignBlacksmithUrl);
    this.load.image('town-sign-enchanter', townSignEnchanterUrl);
    this.load.image('town-sign-world-map', townSignWorldMapUrl);
    this.load.image('town-sign-details', townSignDetailsUrl);
    for (const delve of delves) {
      const layer = delve.visuals?.environment?.layers[0];
      if (layer) this.load.image(layer.key, layer.url);
    }
    this.load.image('town-concept-pineshire', townForestUrl);
    this.load.image('town-concept-mountain-hold', townMountainUrl);
    this.load.image('town-concept-river-town', townRiverUrl);
    this.load.image('town-concept-marsh-town', townMarshUrl);
    this.load.image('town-concept-desert-town', townDesertUrl);
    this.load.image('town-concept-castle-town', townCastleUrl);
    this.load.image('everdeep-concept', delves.find((delve) => delve.id === 'murmuring-abyss').visuals.environment.layers[0].url);
  }

  // This function restores the session and enters the world map in landscape.
  create() {

    const sign = this.textures.get('town-sign-details');
    const source = sign.getSourceImage();
    if (!sign.has('panel')) sign.add('panel', 0, 0, Math.round(source.height * 0.125), source.width, Math.round(source.height * 0.71));
    this.textures.get('world-pineshire-final').setFilter(1);
    this.initializeGameState();
    OrientationService.lockLandscape();
    this.scene.start('TitleScene');
  }

  // This function restores persistent progress and prepares clean encounter
  // state.
  initializeGameState() {

    prepareBuildSave();

    // Rebuild base stats from current definitions, then merge saved growth.
    loadProfile(adventurers);
    GameState.development.toolsVisible = true;

    // Public builds use ordinary progression even after a local development session.
    if (!import.meta.env.DEV) {
      GameState.development.unlockAll = false;
      GameState.development.replayCleared = false;
    }

    // Restore player progression from its separate save record.
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

    // Seed the snapshot used to roll back run gold.
    GameState.run = {
      startedAt: 0,
      elapsedMs: 0,
      summary: null,
      startingGold: GameState.gold
    };
  }
}
