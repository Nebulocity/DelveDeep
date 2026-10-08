// This connects roster selection, gear and skill training inside the Hall. We keep the
// chosen hero and focused tab when another Hall screen returns. Scrollable lists have a
// visible mask and touch bounds; both need the same layout.

import Phaser from 'phaser';

export default class AdventurersHallScene extends Phaser.Scene {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor() {
    super('AdventurersHallScene');
  }

  // We build this screen and connect its input after the queued assets are ready. Display
  // objects belong to this scene and are removed when the scene shuts down.
  create() {
    this.scene.start('RosterScene');
  }
}
