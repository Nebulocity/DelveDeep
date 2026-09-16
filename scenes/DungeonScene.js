import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { beginExpedition } from '../game/ExpeditionProgression.js';
import { leaderAbilities } from '../game/LeaderProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class DungeonScene extends Phaser.Scene {
  // I register DungeonScene so the game can navigate to this screen.
  constructor() {

    super('DungeonScene');
  }

  // I review the party and tactics before starting the expedition.
  create() {

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#15120f');

    this.add.text(70, UI_SAFE_TOP + 14, '< PARTY SELECT', { fontFamily: 'Arial', fontSize: '34px', color: '#d6d3d1' })
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => {

        HapticsService.tap(); this.scene.start('PartySelectScene');
      });
    this.add.text(width - 70, UI_SAFE_TOP + 14, 'WORLD MAP', { fontFamily: 'Arial', fontSize: '34px', color: '#d6d3d1' }).setOrigin(1, 0)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => {

        HapticsService.tap(); this.scene.start('TitleScene');
      });

    this.add.text(width / 2, UI_SAFE_TOP + 18, 'BATTLE OVERVIEW', { fontFamily: 'Arial', fontSize: '68px', fontStyle: 'bold', color: '#f5f5f4' }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 75, GameState.currentDelve?.name ?? 'The Delve', { fontFamily: 'Arial', fontSize: '38px', color: '#a8a29e' }).setOrigin(0.5);

    this.add.text(width * 0.28, height * 0.30, 'PARTY', { fontFamily: 'Arial', fontSize: '38px', fontStyle: 'bold', color: '#94a3b8' }).setOrigin(0.5);
    GameState.activeParty.forEach((adventurer, index) => {

      const y = height * 0.38 + index * 92;
      this.add.circle(width * 0.15, y, 30, adventurer.color);
      this.add.text(width * 0.18, y - 18, adventurer.name, { fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#ffffff' });
      this.add.text(width * 0.18, y + 19, `${adventurer.className} • ${adventurer.role} • Lv ${adventurer.level}`, { fontFamily: 'Arial', fontSize: '26px', color: '#cbd5e1' });
    });

    const equipped = GameState.leader?.battleLoadout ?? [];
    this.add.text(width * 0.70, height * 0.30, `BATTLE TACTICS ${equipped.length}/5`, { fontFamily: 'Arial', fontSize: '38px', fontStyle: 'bold', color: '#94a3b8' }).setOrigin(0.5);
    equipped.forEach((id, index) => {

      const ability = leaderAbilities.find((entry) => entry.id === id);
      const y = height * 0.39 + index * 88;
      this.add.rectangle(width * 0.70, y, 700, 64, 0x292524).setStrokeStyle(2, 0x84cc16);
      this.add.text(width * 0.70, y, ability?.name ?? id, { fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#bef264' }).setOrigin(0.5);
    });

    const button = this.add.rectangle(width / 2, height * 0.89, 760, 104, 0x7c2d12).setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height * 0.89, 'DELVE DEEP!', { fontFamily: 'Arial', fontSize: '46px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    button.on('pointerdown', () => {

      HapticsService.confirm(); beginExpedition(); this.scene.start('BattleScene');
    });
  }
}
