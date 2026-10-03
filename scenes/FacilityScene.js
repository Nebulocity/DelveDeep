import Phaser from 'phaser';
import { FACILITIES, renderFacilityMenu } from '../ui/FacilityMenu.js';

export default class FacilityScene extends Phaser.Scene {
  constructor() {
    super('FacilityScene');
  }

  init(data) {
    this.facility = FACILITIES[data?.title] ?? FACILITIES.Alchemist;
    this.returnScene = data?.returnScene ?? 'TownScene';
    this.selection = null;
  }

  create() {
    this.render();
  }

  render() {
    renderFacilityMenu(this, this.facility, this.selection,
      (selection) => { this.selection = selection; this.render(); },
      () => {
        if (this.selection) { this.selection = null; this.render(); }
        else this.scene.start(this.returnScene);
      });
  }
}
