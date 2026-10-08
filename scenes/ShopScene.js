// This screen connects shop controls to owned inventory and shared transaction rules. We
// refresh the visible resources after an action, but affordability is checked again by the
// game helpers when the player actually buys or sells.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';
import { addReturnButton } from '../ui/ReturnButton.js';

export default class ShopScene extends Phaser.Scene {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor() { super('ShopScene'); }

  // We build this screen and connect its input after the queued assets are ready. Display
  // objects belong to this scene and are removed when the scene shuts down.
  create() {

    // The braces pull named fields into local variables. This reads those fields without
    // copying the whole source object.
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1b1713');
    addReturnButton(this, 'Town', () => this.scene.start('TownScene'), { y: UI_SAFE_TOP + 32 });

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    this.add.text(width / 2, UI_SAFE_TOP + 20, 'QUARTERMASTER', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('display69'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f5f5f4'
    }).setOrigin(0.5);
    this.add.text(width - 72, UI_SAFE_TOP + 20, `Gold: ${GameState.gold}`, {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body36'), color: '#fbbf24'
    }).setOrigin(1, 0.5);
    this.add.text(width / 2, height * 0.53, 'No supplies are stocked yet.', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('heading42'), color: '#d6d3d1'
    }).setOrigin(0.5);
  }
}
