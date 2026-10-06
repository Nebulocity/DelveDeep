import Phaser from 'phaser';

export default class AdventurersHallScene extends Phaser.Scene {
  constructor() {
    super('AdventurersHallScene');
  }

  create() {
    this.scene.start('RosterScene');
  }
}
