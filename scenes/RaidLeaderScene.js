import Phaser from 'phaser';
import { showSelectionDetails } from '../ui/SelectionDetails.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { leaderAbilities, hasLeaderAbility, purchaseLeaderAbility, toggleLeaderLoadoutAbility } from '../game/LeaderProgression.js';
import { HALL, hallText, hallPanel, hallButton, hallIcon, addHallFrame } from '../ui/HallUI.js';

const CATEGORIES = [['Assault', 'sword'], ['Protect', 'shield'], ['Restore', 'healer'], ['Prepare', 'satchel']];

export default class RaidLeaderScene extends Phaser.Scene {
  constructor() { super('RaidLeaderScene'); }

  create() {
    GameState.leader.battleLoadout ??= ['focusFire'];
    this.message = '';
    this.render();
  }

  render() {
    this.selectionDetailsClose?.();
    this.children.removeAll(true);
    addHallFrame(this, 'Tactics', this.message);
    const leader = GameState.leader;
    hallPanel(this, 1200, 638, 2296, 736);
    hallText(this, 90, 321, 'Raid Leader tactics', 42, { fontFamily: 'Georgia' });
    hallText(this, 2310, 321, `Renown Level ${leader.level} · ${leader.tacticsPoints} TP available`, 34, { color: '#ffe0a7' }).setOrigin(1, 0.5);
    hallText(this, 90, 380, `Equipped ${leader.battleLoadout.length}/5 · Hold a tactic for its effect.`, 30, { color: HALL.muted });
    CATEGORIES.forEach(([category, icon], index) => {
      const x = 340 + index * 573;
      hallIcon(this, icon, x - 177, 447);
      hallText(this, x - 125, 447, category, 36, { fontStyle: 'bold' });
      const entries = leaderAbilities.filter((ability) => ability.category === category);
      if (!entries.length) hallText(this, x, 620, 'No tactics\navailable yet.', 32, { color: HALL.muted, align: 'center' }).setOrigin(0.5);
      entries.forEach((ability, row) => {
        const y = 589 + row * 233;
        const unlocked = hasLeaderAbility(leader, ability.id), equipped = leader.battleLoadout.includes(ability.id);
        hallButton(this, x, y, 513, 212, '', () => this.choose(ability), {
          selected: equipped, details: { title: ability.name, description: ability.description }, name: `hall-tactic-${ability.id}`
        });
        hallText(this, x - 224, y - 62, ability.name, 35, { fontStyle: 'bold', wordWrap: { width: 448 } });
        hallText(this, x - 224, y + 4, ability.cooldown ? `${ability.cooldown / 1000}s cooldown` : 'Once per encounter', 29, { color: HALL.muted });
        hallText(this, x - 224, y + 64, equipped ? 'Equipped' : unlocked ? 'Tap to equip' : `Unlock · ${ability.cost} TP`, 32, { color: equipped ? HALL.green : '#ffe0a7' });
      });
    });
  }

  choose(ability) {
    const leader = GameState.leader;
    if (!hasLeaderAbility(leader, ability.id)) {
      if (leader.tacticsPoints < ability.cost) {
        showSelectionDetails(this, { title: 'Not enough TP', description: `${ability.name} costs ${ability.cost} TP.\nYou have ${leader.tacticsPoints} TP.` });
        return;
      }
      showConfirmation(this, {
        title: `Unlock ${ability.name}`, description: `${ability.description}\n\nSpend ${ability.cost} TP? Available: ${leader.tacticsPoints} TP.`,
        onConfirm: () => {
          if (purchaseLeaderAbility(leader, ability.id)) { this.message = `${ability.name} unlocked. Tap to equip.`; HapticsService.confirm(); }
          else this.message = 'This tactic could not be unlocked.';
          this.render();
        }
      });
      return;
    }
    if (toggleLeaderLoadoutAbility(leader, ability.id)) {
      this.message = `${ability.name} ${leader.battleLoadout.includes(ability.id) ? 'equipped' : 'unequipped'}.`;
      HapticsService.confirm();
    } else this.message = 'All five tactic slots are full. Unequip a tactic first.';
    this.render();
  }
}
