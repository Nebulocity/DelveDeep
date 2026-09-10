import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { leaderAbilities, hasLeaderAbility, purchaseLeaderAbility } from '../game/LeaderProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class RaidLeaderScene extends Phaser.Scene {
  constructor() {
    super('RaidLeaderScene');
  }

  create() {
    const { width } = this.scale;
    const leader = GameState.leader;
    this.cameras.main.setBackgroundColor('#11100f');

    this.add.text(56, UI_SAFE_TOP + 6, '< GUILD HALL', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#a8a29e'
    })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        HapticsService.tap();
        this.scene.start('TownScene');
      });

    this.add.text(width / 2, UI_SAFE_TOP + 10, 'RAID LEADER', {
      fontFamily: 'Arial',
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#f5f5f4'
    }).setOrigin(0.5);

    this.add.text(width / 2, UI_SAFE_TOP + 60, `Level ${leader.level}  •  Deep ${leader.highestClearedDepth} Cleared`, {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#d6d3d1'
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, UI_SAFE_TOP + 140, width * 0.82, 112, 0x292524).setStrokeStyle(3, 0x57534e);
    this.add.text(width * 0.11, UI_SAFE_TOP + 114, 'INSPIRATION', {
      fontFamily: 'Arial',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#fbbf24'
    });
    this.pointsText = this.add.text(width * 0.11, UI_SAFE_TOP + 152, `${leader.inspirationPoints} available  •  ${leader.spentInspiration} spent`, {
      fontFamily: 'Arial',
      fontSize: '23px',
      color: '#ffffff'
    });
    this.add.text(width * 0.89, UI_SAFE_TOP + 152, 'Earn 1 every 5 Leader Levels', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#a8a29e'
    }).setOrigin(1, 0);

    this.add.text(width / 2, UI_SAFE_TOP + 240, 'INSPIRATIONS', {
      fontFamily: 'Arial',
      fontSize: '29px',
      fontStyle: 'bold',
      color: '#e7e5e4'
    }).setOrigin(0.5);

    leaderAbilities.forEach((ability, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = width * (column === 0 ? 0.27 : 0.73);
      const y = UI_SAFE_TOP + 355 + row * 190;
      this.createAbilityCard(ability, x, y);
    });
  }

  createAbilityCard(ability, x, y) {
    const { width } = this.scale;
    const leader = GameState.leader;
    const unlocked = hasLeaderAbility(leader, ability.id);
    const cardWidth = width * 0.41;
    const cardHeight = 160;

    const card = this.add.rectangle(x, y, cardWidth, cardHeight, unlocked ? 0x26331f : 0x292524)
      .setStrokeStyle(3, unlocked ? 0x84cc16 : 0x57534e);

    this.add.text(x - cardWidth * 0.44, y - 52, `${ability.name}  •  ${ability.branch}`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      fontStyle: 'bold',
      color: unlocked ? '#bef264' : '#ffffff'
    });

    this.add.text(x - cardWidth * 0.44, y - 15, ability.description, {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#d6d3d1',
      wordWrap: { width: cardWidth * 0.67 }
    });

    const status = this.add.text(x + cardWidth * 0.44, y + 48, unlocked ? 'UNLOCKED' : `${ability.cost} IP`, {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: unlocked ? '#bef264' : '#fbbf24'
    }).setOrigin(1, 0.5);

    if (!unlocked && ability.cost > 0) {
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => {
        if (purchaseLeaderAbility(leader, ability.id)) {
          HapticsService.confirm();
          this.scene.restart();
        } else {
          HapticsService.tap();
          status.setText('NEED MORE IP');
          this.time.delayedCall(900, () => status.setText(`${ability.cost} IP`));
        }
      });
    }
  }
}
