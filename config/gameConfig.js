import Phaser from 'phaser';
import BootScene from '../scenes/BootScene.js';
import TitleScene from '../scenes/TitleScene.js';
import TownScene from '../scenes/TownScene.js';
import RosterScene from '../scenes/RosterScene.js';
import RaidLeaderScene from '../scenes/RaidLeaderScene.js';
import ShopScene from '../scenes/ShopScene.js';
import DelveSelectScene from '../scenes/DelveSelectScene.js';
import PartySelectScene from '../scenes/PartySelectScene.js';
import DungeonScene from '../scenes/DungeonScene.js';
import BattleScene from '../scenes/BattleScene.js';
import RewardScene from '../scenes/RewardScene.js';
import FacilityScene from '../scenes/FacilityScene.js';
import AdventurersHallScene from '../scenes/AdventurersHallScene.js';
import BlacksmithScene from '../scenes/BlacksmithScene.js';
import EquipmentScene from '../scenes/EquipmentScene.js';
import ItemsScene from '../scenes/ItemsScene.js';
import EncounterSummaryScene from '../scenes/EncounterSummaryScene.js';

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
    EquipmentScene,
    ItemsScene,
    RosterScene,
    RaidLeaderScene,
    ShopScene,
    DelveSelectScene,
    PartySelectScene,
    DungeonScene,
    BattleScene,
    RewardScene,
    EncounterSummaryScene
  ]
};

export default gameConfig;
