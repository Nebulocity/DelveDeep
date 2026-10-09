// This is the leader's tactic workspace. Unlocking spends Tactics Points; equipping
// chooses a loadout of up to five already unlocked tactics. Each category scrolls
// independently, so clipping and hit areas must follow the corresponding list.

import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import { showSelectionDetails } from '../ui/SelectionDetails.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { leaderAbilities, hasLeaderAbility, purchaseLeaderAbility, toggleLeaderLoadoutAbility } from '../game/LeaderProgression.js';

import { HALL, hallText, hallPanel, hallButton, hallIcon, hallScroll, addHallFrame } from '../ui/HallUI.js';
import { leaderAbilityDescription } from '../game/AbilityDescriptions.js';
import { getEquippedAdventurer } from '../game/Equipment.js';

const CATEGORIES = [['Assault', 'sword'], ['Protect', 'shield'], ['Restore', 'healer'], ['Prepare', 'satchel']];

const tacticDescription = ability => {

  // The condition before ? chooses the first value when true and the value after : when
  // false. map builds one output entry for each input entry, in the same order. The
  // callback's return value becomes that output entry.
  const partyIds = GameState.activeParty.length ? GameState.activeParty.map(hero => hero.id) : GameState.lastPartyIds;

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  const party = GameState.roster.filter(hero => partyIds.includes(hero.id)).map(hero => getEquippedAdventurer(hero));
  return leaderAbilityDescription(ability, party);
};

export default class PartyLeaderScene extends Phaser.Scene {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor() { super('PartyLeaderScene'); }

  // We build this screen and connect its input after the queued assets are ready. Display
  // objects belong to this scene and are removed when the scene shuts down.
  create() {

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone.
    GameState.leader.battleLoadout ??= ['focusFire'];
    this.message = '';
    this.render();
  }

  // Build the visible workspace from the current selection, page and game state.
  render() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.selectionDetailsClose?.();
    this.children.removeAll(true);
    addHallFrame(this, 'Tactics', this.message);
    const leader = GameState.leader;
    hallPanel(this, 1200, 638, 2296, 736);
    hallText(this, 90, 321, 'Party Tactics', UI_FONT_SIZES.hallTacticHeading, { fontFamily: UI_FONT_FAMILIES.serif });

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    hallText(this, 2310, 321, `Renown Level ${leader.level} · ${leader.tacticsPoints} TP available`, UI_FONT_SIZES.hallTacticRenown, { color: '#ffe0a7' }).setOrigin(1, 0.5);
    hallText(this, 90, 380, `Equipped ${leader.battleLoadout.length}/5 · Hold a tactic for its effect.`, UI_FONT_SIZES.hallTacticMeta, { color: HALL.muted });

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone.
    this.tacticScroll ??= {};
    CATEGORIES.forEach(([category, icon], index) => {
      const x = 340 + index * 573;
      hallIcon(this, icon, x - 177, 447);
      hallText(this, x - 125, 447, category, UI_FONT_SIZES.body36, { fontStyle: UI_FONT_WEIGHTS.bold });

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      const entries = leaderAbilities.filter((ability) => ability.category === category);
      const rowHeight = 224;
      if (!entries.length) hallText(this, x, 620, 'No tactics\navailable yet.', UI_FONT_SIZES.body32, { color: HALL.muted, align: 'center' }).setOrigin(0.5);
      const listObjects = [];
      entries.forEach((ability, row) => {
        const y = 615 + row * rowHeight;
        const unlocked = hasLeaderAbility(leader, ability.id), equipped = leader.battleLoadout.includes(ability.id);
        const childStart = this.children.length;
        hallButton(this, x, y, 513, 206, '', () => this.choose(ability), {
          selected: equipped, details: { title: ability.name, description: tacticDescription(ability) }, name: `hall-tactic-${ability.id}`
        });
        hallText(this, x - 224, y - 66, ability.name, UI_FONT_SIZES.hallTacticName, { fontStyle: UI_FONT_WEIGHTS.bold, wordWrap: { width: 448 } });

        // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the
        // center and 1 is the right/bottom edge. x/y place that anchor, not necessarily
        // the object's corner.
        hallText(this, x - 224, y - 22, ability.description, UI_FONT_SIZES.hallTacticSummary,
          { color: HALL.muted, wordWrap: { width: 448 }, maxLines: 2 }).setOrigin(0, 0);

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        hallText(this, x - 224, y + 75, ability.oncePerEncounter ? 'Once per encounter' : `${ability.cooldown / 1000}s cooldown`, UI_FONT_SIZES.hallTacticSummary, { color: HALL.muted });
        hallText(this, x + 224, y + 75, equipped ? 'Equipped' : unlocked ? 'Tap to equip' : `Unlock · ${ability.cost} TP`, UI_FONT_SIZES.hallTacticSummary,
          { color: equipped ? HALL.green : '#ffe0a7' }).setOrigin(1, 0.5);

        // ... expands these entries into the new list or call. It does not deep-copy the
        // objects inside.
        listObjects.push(...this.children.list.slice(childStart));
      });

      if (entries.length > 2) hallScroll(this, { x: x - 260, y: 505, width: 520, height: 442 },
        listObjects, entries.length * rowHeight, this.tacticScroll[category] ?? 0,
        value => { this.tacticScroll[category] = value; });
    });
  }

  // Apply the selected tactic's unlock or loadout action after checking its current state.
  choose(ability) {
    const leader = GameState.leader;
    if (!hasLeaderAbility(leader, ability.id)) {
      if (leader.tacticsPoints < ability.cost) {
        showSelectionDetails(this, { title: 'Not enough TP', description: `${ability.name} costs ${ability.cost} TP.\nYou have ${leader.tacticsPoints} TP.` });
        return;
      }
      showConfirmation(this, {
        title: `Unlock ${ability.name}`, description: `${tacticDescription(ability)}\n\nSpend ${ability.cost} TP? Available: ${leader.tacticsPoints} TP.`,

        // Run the committed action after the player confirms this decision.
        onConfirm: () => {
          if (purchaseLeaderAbility(leader, ability.id)) {
            this.message = `${ability.name} unlocked. Tap to equip.`;
            HapticsService.confirm();
          }
          else this.message = 'This tactic could not be unlocked.';
          this.render();
        }
      });

      return;
    }

    if (toggleLeaderLoadoutAbility(leader, ability.id)) {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      this.message = `${ability.name} ${leader.battleLoadout.includes(ability.id) ? 'equipped' : 'unequipped'}.`;
      HapticsService.confirm();
    } else this.message = 'All five tactic slots are full. Unequip a tactic first.';
    this.render();
  }
}
