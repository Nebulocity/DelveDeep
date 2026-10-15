import { categoryIcon } from '../ui/IdentityIcons.js';
// This is the leader's tactic workspace. Unlocking spends Renown Points; equipping
// chooses a loadout of up to five already unlocked tactics. Each category scrolls
// independently, so clipping and hit areas must follow the corresponding list.

import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import { showSelectionDetails } from '../ui/SelectionDetails.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { leaderAbilities, hasLeaderAbility, purchaseLeaderAbility, toggleLeaderLoadoutAbility, leadershipRequirements } from '../game/LeaderProgression.js';

import { HALL, hallText, hallPanel, hallButton, hallIcon, hallScroll, addHallFrame } from '../ui/HallUI.js';
import { leaderAbilityDescription } from '../game/AbilityDescriptions.js';
import { getEquippedAdventurer } from '../game/Equipment.js';
import { ITEM_RARITIES } from '../data/items.js';

const CATEGORIES = [['Assault', 'sword'], ['Protect', 'shield'], ['Restore', 'healer'], ['Prepare', 'satchel']];

const tacticDescription = ability => {

  // The condition before ? chooses the first value when true and the value after : when
  // false. map builds one output entry for each input entry, in the same order. The
  // callback's return value becomes that output entry.
  const partyIds = GameState.activeParty.length ? GameState.activeParty.map(hero => hero.id) : GameState.lastPartyIds;

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  const party = GameState.roster.filter(hero => partyIds.includes(hero.id)).map(hero => getEquippedAdventurer(hero));
  const requirement = leadershipRequirements(ability);
  const acquisition = requirement.questOnly ? 'Earned through a quest chain.' : 'Costs ' + ability.cost + ' Renown Points.';
  return leaderAbilityDescription(ability, party) + '\n\n' + requirement.name
    + ' · Requires Renown Level ' + requirement.level + '\n' + acquisition;
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
    GameState.leader.battleLoadout ??= [];
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
    hallText(this, 2310, 321, `Renown Level ${leader.level} · ${leader.renownPoints} RP available`, UI_FONT_SIZES.hallTacticRenown, { color: '#ffe0a7' }).setOrigin(1, 0.5);
    hallText(this, 90, 380, `Equipped ${leader.battleLoadout.length}/5 · Hold a tactic for its effect.`, UI_FONT_SIZES.hallTacticMeta, { color: HALL.muted });

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone.
    this.tacticScroll ??= {};
    CATEGORIES.forEach(([category, icon], index) => {
      const x = 340 + index * 573;
      categoryIcon(this, category, x - 177, 447);
      hallText(this, x - 125, 447, category, UI_FONT_SIZES.body36, { fontStyle: UI_FONT_WEIGHTS.bold });

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place.
      const entries = leaderAbilities.filter((ability) => ability.category === category)
        .sort((left, right) => Number(leader.battleLoadout.includes(right.id)) - Number(leader.battleLoadout.includes(left.id)));
      const rowHeight = 224;
      if (!entries.length) hallText(this, x, 620, 'No tactics\navailable yet.', UI_FONT_SIZES.body32, { color: HALL.muted, align: 'center' }).setOrigin(0.5);
      const listObjects = [];
      entries.forEach((ability, row) => {
        const y = 615 + row * rowHeight;
        const unlocked = hasLeaderAbility(leader, ability.id), equipped = leader.battleLoadout.includes(ability.id);
        const requirement = leadershipRequirements(ability);
        const rarity = ITEM_RARITIES[ability.rarity] ?? ITEM_RARITIES.common;
        const rarityTint = Number.parseInt(rarity.color.slice(1), 16);
        const locked = !unlocked && (leader.level < requirement.level || requirement.questOnly);
        const childStart = this.children.length;
        const button = hallButton(this, x, y, 513, 206, '', () => this.choose(ability), {
          selected: equipped, details: { title: ability.name, category: ability.category, description: tacticDescription(ability) }, name: `hall-tactic-${ability.id}`
        });

        // The rarity frame stays visible on locked tactics too. It is artwork only,
        // so the existing button keeps ownership of taps, holds and scroll masking.
        this.add.rectangle(x, y, 505, 198, rarityTint, equipped ? 0.14 : 0.035)
          .setStrokeStyle(equipped ? 5 : 3, rarityTint, 0.95).setName(`tactic-rarity-${ability.id}`);
        if (equipped) this.add.rectangle(x - 244, y, 7, 184, rarityTint).setName(`tactic-equipped-${ability.id}`);

        // Dim the surface only; the effect text and held details stay readable and active.
        if (locked) button.pressVisuals.forEach(face => face.setAlpha(0.55));
        hallText(this, x - 224, y - 66, ability.name, UI_FONT_SIZES.hallTacticName,
          { color: rarity.color, fontStyle: UI_FONT_WEIGHTS.bold, wordWrap: { width: 448 } }).setName(`tactic-name-${ability.id}`);

        // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the
        // center and 1 is the right/bottom edge. x/y place that anchor, not necessarily
        // the object's corner.
        hallText(this, x - 224, y - 36, ability.description, UI_FONT_SIZES.hallTacticSummary,
          { color: HALL.muted, wordWrap: { width: 448 }, maxLines: 2 }).setOrigin(0, 0);

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        hallText(this, x - 224, y + 48, requirement.name + ' · Renown ' + requirement.level + (requirement.questOnly ? '' : ' · ' + ability.cost + ' RP'),
          UI_FONT_SIZES.hallTacticSummary, { color: locked ? HALL.muted : '#ffe0a7' });
        hallText(this, x - 224, y + 82, ability.oncePerEncounter ? 'Once per encounter' : `${ability.cooldown / 1000}s cooldown`, UI_FONT_SIZES.hallTacticSummary, { color: HALL.muted });
        hallText(this, x + 224, y + 82, equipped ? '✓ EQUIPPED' : unlocked ? 'Tap to equip' : requirement.questOnly ? 'Quest reward' : locked ? 'Locked' : `Unlock · ${ability.cost} RP`, UI_FONT_SIZES.hallTacticSummary,
          { color: equipped ? '#d9ffd0' : '#ffe0a7', fontStyle: equipped ? UI_FONT_WEIGHTS.bold : 'normal' }).setOrigin(1, 0.5);

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
      const requirement = leadershipRequirements(ability);
      if (requirement.questOnly || leader.level < requirement.level) {
        showSelectionDetails(this, { title: ability.name, category: ability.category, description: tacticDescription(ability) });
        return;
      }
      if (leader.renownPoints < ability.cost) {
        showSelectionDetails(this, { title: 'Not enough RP', description: `${ability.name} costs ${ability.cost} RP.\nYou have ${leader.renownPoints} RP.` });
        return;
      }
      showConfirmation(this, {
        title: `Unlock ${ability.name}`, description: `${tacticDescription(ability)}\n\nSpend ${ability.cost} RP? Available: ${leader.renownPoints} RP.`,

        // Run the committed action after the player confirms this decision.
        onConfirm: () => {
          if (purchaseLeaderAbility(leader, ability.id)) {
            this.message = leader.battleLoadout.includes(ability.id)
              ? `${ability.name} unlocked and equipped.`
              : `${ability.name} unlocked. All five tactic slots are full; unequip one to make room.`;
            HapticsService.confirm();
          }
          else this.message = 'This tactic could not be unlocked.';
          this.tacticScroll[ability.category] = 0;
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
    this.tacticScroll[ability.category] = 0;
    this.render();
  }
}
