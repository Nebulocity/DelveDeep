import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { beginExpedition } from '../game/ExpeditionProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class DungeonScene extends Phaser.Scene {
  constructor() {
    super('DungeonScene');
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#15120f');

    this.add.text(width / 2, UI_SAFE_TOP + 18, GameState.currentDelve?.name ?? 'THE DELVE', {
      fontFamily: 'Arial',
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#f5f5f4'
    }).setOrigin(0.5);

    this.add.text(width / 2, UI_SAFE_TOP + 66, 'Your party descends into the dark...', {
      fontFamily: 'Arial',
      fontSize: '25px',
      color: '#a8a29e'
    }).setOrigin(0.5);

    this.drawRoute(width, height);
    this.drawParty(width, height);

    const encounterButton = this.add.rectangle(width / 2, height * 0.79, Math.min(860, width * 0.42), 108, 0x7c2d12)
      .setInteractive({ useHandCursor: true });

    this.add.text(width / 2, height * 0.79, 'ENTER ENCOUNTER', {
      fontFamily: 'Arial',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    encounterButton.on('pointerdown', () => {
      HapticsService.confirm();
      beginExpedition();
      this.scene.start('BattleScene');
    });

    this.add.text(width / 2, height * 0.9, 'Return to Guild Hall', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#a8a29e'
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { HapticsService.tap(); this.scene.start('TownScene'); });
  }

  drawRoute(width, height) {
    const graphics = this.add.graphics();
    graphics.lineStyle(10, 0x57534e, 1);
    graphics.beginPath();
    graphics.moveTo(width * 0.22, height * 0.39);
    graphics.lineTo(width * 0.5, height * 0.39);
    graphics.lineTo(width * 0.78, height * 0.39);
    graphics.strokePath();

    this.add.circle(width * 0.22, height * 0.39, 38, 0x78716c);
    this.add.circle(width * 0.5, height * 0.39, 42, 0x9a3412);
    this.add.circle(width * 0.78, height * 0.39, 38, 0x292524);

    this.add.text(width * 0.22, height * 0.45, 'Entrance', {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#d6d3d1'
    }).setOrigin(0.5);

    this.add.text(width * 0.5, height * 0.45, 'Encounter', {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#fdba74'
    }).setOrigin(0.5);

    this.add.text(width * 0.78, height * 0.45, '???', {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#78716c'
    }).setOrigin(0.5);
  }

  drawParty(width, height) {
    this.add.text(width / 2, height * 0.56, 'PARTY', {
      fontFamily: 'Arial',
      fontSize: '25px',
      fontStyle: 'bold',
      color: '#a8a29e'
    }).setOrigin(0.5);

    const spacing = Math.min(260, width * 0.12);
    const startX = width / 2 - spacing * 1.5;

    GameState.activeParty.forEach((adventurer, index) => {
      const x = startX + spacing * index;
      this.add.circle(x, height * 0.64, 46, adventurer.color);
      this.add.text(x, height * 0.695, adventurer.name, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#e7e5e4'
      }).setOrigin(0.5);
    });
  }

}
