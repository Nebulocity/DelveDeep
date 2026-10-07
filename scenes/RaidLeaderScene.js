import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import { showSelectionDetails } from '../ui/SelectionDetails.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { leaderAbilities, hasLeaderAbility, purchaseLeaderAbility, toggleLeaderLoadoutAbility } from '../game/LeaderProgression.js';
import { HALL, hallText, hallPanel, hallButton, hallIcon, hallScroll, addHallFrame } from '../ui/HallUI.js';

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
    hallText(this, 90, 321, 'Party Tactics', UI_FONT_SIZES.hallTacticHeading, { fontFamily: UI_FONT_FAMILIES.serif });
    hallText(this, 2310, 321, `Renown Level ${leader.level} · ${leader.tacticsPoints} TP available`, UI_FONT_SIZES.hallTacticRenown, { color: '#ffe0a7' }).setOrigin(1, 0.5);
    hallText(this, 90, 380, `Equipped ${leader.battleLoadout.length}/5 · Hold a tactic for its effect.`, UI_FONT_SIZES.hallTacticMeta, { color: HALL.muted });
    this.tacticScroll ??= {};
    CATEGORIES.forEach(([category, icon], index) => {
      const x = 340 + index * 573;
      hallIcon(this, icon, x - 177, 447);
      hallText(this, x - 125, 447, category, UI_FONT_SIZES.body36, { fontStyle: UI_FONT_WEIGHTS.bold });
      const entries = leaderAbilities.filter((ability) => ability.category === category);
      const rowHeight = 224;
      if (!entries.length) hallText(this, x, 620, 'No tactics\navailable yet.', UI_FONT_SIZES.body32, { color: HALL.muted, align: 'center' }).setOrigin(0.5);
      const listObjects = [];
      entries.forEach((ability, row) => {
        const y = 615 + row * rowHeight;
        const unlocked = hasLeaderAbility(leader, ability.id), equipped = leader.battleLoadout.includes(ability.id);
        const childStart = this.children.length;
        hallButton(this, x, y, 513, 206, '', () => this.choose(ability), {
          selected: equipped, details: { title: ability.name, description: ability.description }, name: `hall-tactic-${ability.id}`
        });
        hallText(this, x - 224, y - 66, ability.name, UI_FONT_SIZES.hallTacticName, { fontStyle: UI_FONT_WEIGHTS.bold, wordWrap: { width: 448 } });
        hallText(this, x - 224, y - 22, ability.description, UI_FONT_SIZES.hallTacticSummary,
          { color: HALL.muted, wordWrap: { width: 448 }, maxLines: 2 }).setOrigin(0, 0);
        hallText(this, x - 224, y + 75, ability.oncePerEncounter ? 'Once per encounter' : `${ability.cooldown / 1000}s cooldown`, UI_FONT_SIZES.hallTacticSummary, { color: HALL.muted });
        hallText(this, x + 224, y + 75, equipped ? 'Equipped' : unlocked ? 'Tap to equip' : `Unlock · ${ability.cost} TP`, UI_FONT_SIZES.hallTacticSummary,
          { color: equipped ? HALL.green : '#ffe0a7' }).setOrigin(1, 0.5);
        listObjects.push(...this.children.list.slice(childStart));
      });
      if (entries.length > 2) hallScroll(this, { x: x - 260, y: 505, width: 520, height: 442 },
        listObjects, entries.length * rowHeight, this.tacticScroll[category] ?? 0,
        value => { this.tacticScroll[category] = value; });
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
