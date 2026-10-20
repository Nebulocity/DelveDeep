// These are the game-wide Phaser settings. Our drawing space is 2400 by 1080 logical
// pixels. FIT scales that whole canvas to the available device space without stretching
// it. Screens use these logical coordinates, while style.css handles the phone cutouts and
// system bars around the canvas. The first scene in the list boots the game; the other
// entries register screens we can start by name.

import Phaser from 'phaser';
import BootScene from '../scenes/BootScene.js';
import TitleScene from '../scenes/TitleScene.js';
import TownScene from '../scenes/TownScene.js';
import HeroesScene from '../scenes/HeroesScene.js';
import AbilitiesScene from '../scenes/AbilitiesScene.js';
import EquipmentScene from '../scenes/EquipmentScene.js';
import TacticsScene from '../scenes/TacticsScene.js';
import InventoryScene from '../scenes/InventoryScene.js';
import QuestJournalScene from '../scenes/QuestJournalScene.js';
import MarketScene from '../scenes/MarketScene.js';
import TavernScene from '../scenes/TavernScene.js';
import ExchangeScene from '../scenes/ExchangeScene.js';

import DelveSelectScene from '../scenes/DelveSelectScene.js';
import PartySelectScene from '../scenes/PartySelectScene.js';
import BattleScene from '../scenes/BattleScene.js';
import RewardScene from '../scenes/RewardScene.js';
import FacilityScene from '../scenes/FacilityScene.js';

import BlacksmithScene from '../scenes/BlacksmithScene.js';
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
    HeroesScene,
    AbilitiesScene,
    EquipmentScene,
    TacticsScene,
    InventoryScene,
    QuestJournalScene,
    MarketScene,
    TavernScene,
    ExchangeScene,
    FacilityScene,
    BlacksmithScene,
    DelveSelectScene,
    PartySelectScene,
    BattleScene,
    RewardScene,
    EncounterSummaryScene,
    EverdeepScene
  ]
};

export default gameConfig;
