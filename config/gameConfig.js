// These are the game-wide Phaser settings. Our drawing space is 2400 by 1080 logical
// pixels. FIT scales that whole canvas to the available device space without stretching
// it. Screens use these logical coordinates, while style.css handles the phone cutouts and
// system bars around the canvas. The first scene in the list boots the game; the other
// entries register screens we can start by name.

import Phaser from 'phaser';
import BootScene from '../scenes/BootScene.js';
import TitleScene from '../scenes/TitleScene.js';
import TownScene from '../scenes/TownScene.js';
import RosterScene from '../scenes/RosterScene.js';
import PartyLeaderScene from '../scenes/PartyLeaderScene.js';

import DelveSelectScene from '../scenes/DelveSelectScene.js';
import PartySelectScene from '../scenes/PartySelectScene.js';
import DungeonScene from '../scenes/DungeonScene.js';
import BattleScene from '../scenes/BattleScene.js';
import RewardScene from '../scenes/RewardScene.js';
import FacilityScene from '../scenes/FacilityScene.js';
import AdventurersHallScene from '../scenes/AdventurersHallScene.js';

import BlacksmithScene from '../scenes/BlacksmithScene.js';
import ItemsScene from '../scenes/ItemsScene.js';
import EncounterSummaryScene from '../scenes/EncounterSummaryScene.js';
import EverdeepScene from '../scenes/EverdeepScene.js';

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 2400,
  height: 1080,
  backgroundColor: '#10131a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },

  scene: [
    BootScene,
    TitleScene,
    TownScene,
    FacilityScene,
    AdventurersHallScene,
    BlacksmithScene,
    ItemsScene,
    RosterScene,
    PartyLeaderScene,
    DelveSelectScene,
    PartySelectScene,
    DungeonScene,
    BattleScene,
    RewardScene,
    EncounterSummaryScene,
    EverdeepScene
  ]
};

export default gameConfig;
