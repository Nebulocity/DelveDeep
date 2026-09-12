import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import {
  leaderAbilities,
  hasLeaderAbility,
  purchaseLeaderAbility,
  toggleLeaderLoadoutAbility
} from '../game/LeaderProgression.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class RaidLeaderScene extends Phaser.Scene {
  constructor() { super('RaidLeaderScene'); }

  create() {
    const { width } = this.scale;
    const leader = GameState.leader;
    leader.battleLoadout = Array.isArray(leader.battleLoadout) ? leader.battleLoadout : ['focusFire'];
    this.cameras.main.setBackgroundColor('#11100f');

    this.add.text(70, UI_SAFE_TOP + 10, "< ADVENTURER'S HALL", { fontFamily:'Arial', fontSize:'39px', color:'#d6d3d1' })
      .setInteractive({ useHandCursor:true }).on('pointerdown', () => { HapticsService.tap(); this.scene.start('AdventurersHallScene'); });

    this.add.text(width/2, UI_SAFE_TOP + 14, 'BATTLE TACTICS', { fontFamily:'Arial', fontSize:'72px', fontStyle:'bold', color:'#f5f5f4' }).setOrigin(0.5);
    this.add.text(width/2, UI_SAFE_TOP + 66, `Tactics Rank ${leader.level}  •  ${leader.inspirationPoints} Inspiration available`, { fontFamily:'Arial', fontSize:'34px', color:'#d6d3d1' }).setOrigin(0.5);
    this.loadoutText = this.add.text(width/2, UI_SAFE_TOP + 108, '', { fontFamily:'Arial', fontSize:'33px', fontStyle:'bold', color:'#fbbf24' }).setOrigin(0.5);
    this.refreshLoadoutText();

    this.add.text(width/2, UI_SAFE_TOP + 154, 'UNLOCK ABILITIES • TAP AN UNLOCKED ABILITY TO EQUIP / UNEQUIP', { fontFamily:'Arial', fontSize:'32px', color:'#a8a29e' }).setOrigin(0.5);

    leaderAbilities.forEach((ability,index) => {
      const col=index%3, row=Math.floor(index/3);
      const x=width*(0.19+col*0.31), y=UI_SAFE_TOP+290+row*225;
      this.createAbilityCard(ability,x,y,width*0.285,190);
    });
  }

  refreshLoadoutText() {
    const loadout = GameState.leader.battleLoadout ?? [];
    const names = loadout.map((id) => leaderAbilities.find((a) => a.id===id)?.name).filter(Boolean);
    this.loadoutText.setText(`TACTICS LOADOUT ${loadout.length}/5  •  ${names.length ? names.join('  |  ') : 'None equipped'}`);
  }

  createAbilityCard(ability,x,y,cardWidth,cardHeight) {
    const leader=GameState.leader;
    const unlocked=hasLeaderAbility(leader,ability.id);
    const equipped=(leader.battleLoadout??[]).includes(ability.id);
    const card=this.add.rectangle(x,y,cardWidth,cardHeight,equipped?0x243b2a:unlocked?0x292524:0x211f1d)
      .setStrokeStyle(4,equipped?0x84cc16:unlocked?0xa8a29e:0x57534e).setInteractive({useHandCursor:true});
    this.add.text(x-cardWidth*0.43,y-62,ability.name,{fontFamily:'Arial',fontSize:'38px',fontStyle:'bold',color:equipped?'#bef264':'#ffffff'});
    this.add.text(x-cardWidth*0.43,y-24,ability.description,{fontFamily:'Arial',fontSize:'27px',color:'#d6d3d1',wordWrap:{width:cardWidth*0.84}});
    const status=this.add.text(x+cardWidth*0.43,y+65,equipped?'EQUIPPED':unlocked?'UNLOCKED':`${ability.cost} IP`,{fontFamily:'Arial',fontSize:'28px',fontStyle:'bold',color:equipped?'#bef264':unlocked?'#93c5fd':'#fbbf24'}).setOrigin(1,0.5);

    card.on('pointerdown',()=>{
      if (!hasLeaderAbility(leader,ability.id)) {
        if (purchaseLeaderAbility(leader,ability.id)) { HapticsService.confirm(); this.scene.restart(); }
        else { HapticsService.tap(); status.setText('NEED MORE IP'); this.time.delayedCall(800,()=>status.setText(`${ability.cost} IP`)); }
        return;
      }
      if (!toggleLeaderLoadoutAbility(leader,ability.id)) {
        HapticsService.tap(); status.setText('LOADOUT FULL'); this.time.delayedCall(900,()=>this.scene.restart()); return;
      }
      HapticsService.confirm(); this.scene.restart();
    });
  }
}
