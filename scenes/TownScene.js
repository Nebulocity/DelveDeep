import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { pois } from '../data/worldMap.js';
import { preloadTownAssets } from '../ui/TownAssets.js';
import TownHub from '../ui/TownHub.js';

export default class TownScene extends Phaser.Scene {
  constructor() { super('TownScene'); }

  init(data) {
    const town = pois.find(poi => poi.id === (data?.townId ?? GameState.world.currentLocation) && poi.type === 'town');
    this.townName = data?.townName ?? town?.name ?? 'Pineshire';
    this.townArt = town?.id === 'pineshire' ? 'town' : town?.conceptArt ?? 'town';
  }

  preload() { preloadTownAssets(this); }

  create() {
    this.cameras.main.setBackgroundColor('#1c1917');
    const background = this.add.image(0, 0, this.townArt);
    const fitBackground = () => {
      const { width, height } = this.scale;
      background.setPosition(width / 2, height / 2)
        .setScale(Math.max(width / background.width, height / background.height));
    };
    fitBackground();
    this.hub = new TownHub(this);
    const resize = () => { fitBackground(); this.hub.render(); };
    const back = () => this.hub.back();
    this.scale.on('resize', resize);
    this.input.keyboard?.on('keydown-ESC', back);
    this.events.once('shutdown', () => {
      this.scale.off('resize', resize);
      this.input.keyboard?.off('keydown-ESC', back);
      this.hub.destroy();
    });
  }
}
