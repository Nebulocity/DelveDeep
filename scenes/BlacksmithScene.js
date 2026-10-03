import Phaser from 'phaser';
import { FACILITIES, renderFacilityMenu } from '../ui/FacilityMenu.js';

export default class BlacksmithScene extends Phaser.Scene {
  constructor() { super('BlacksmithScene'); }

  create() {
    this.mode = null;
    this.render();
  }

  render() {
    renderFacilityMenu(this, FACILITIES.Blacksmith, this.mode,
      (mode) => { this.mode = mode; this.render(); },
      () => {
        if (this.mode) { this.mode = null; this.render(); }
        else this.scene.start('TownScene');
      });
  }
}
