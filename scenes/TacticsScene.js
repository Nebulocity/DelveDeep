import TownFeatureScene, { featurePanel, featureList, featureBody, featureSelect } from '../ui/TownFeatureUI.js';
import { serviceText, serviceCard, serviceButton } from '../ui/TownServiceTheme.js';
import { playUiSound } from '../services/UiAudioService.js';
import { showSelectionDetails } from '../ui/SelectionDetails.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { leaderAbilities, hasLeaderAbility, purchaseLeaderAbility, toggleLeaderLoadoutAbility, leadershipRequirements } from '../game/LeaderProgression.js';
import { leaderAbilityDescription } from '../game/AbilityDescriptions.js';
import { getEquippedAdventurer } from '../game/Equipment.js';
import { ITEM_RARITIES } from '../data/items.js';

const CATEGORIES = ['Assault', 'Protect', 'Restore', 'Prepare'];
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const tacticDescription = ability => {
  const partyIds = GameState.activeParty.length ? GameState.activeParty.map(hero => hero.id) : GameState.lastPartyIds;
  const party = GameState.roster.filter(hero => partyIds.includes(hero.id)).map(hero => getEquippedAdventurer(hero));
  const requirement = leadershipRequirements(ability);
  return leaderAbilityDescription(ability, party) + '\n\n' + requirement.name
    + ' · Requires Renown Level ' + requirement.level + '\n'
    + (requirement.questOnly ? 'Earned through a quest chain.' : 'Costs ' + ability.cost + ' Renown Points.');
};

export default class TacticsScene extends TownFeatureScene {
  constructor() { super('TacticsScene'); }

  render() {
    const leader = GameState.leader;
    leader.battleLoadout ??= [];
    const b = this.frame('Party Tactics', 'tactics', { resource: `Renown Level ${leader.level}\n${leader.renownPoints} Renown Points`,
      hint: 'Select a tactic to read its full effect. Equip up to five party-wide tactics.' });
    const loadout = { x: b.x, y: b.y, width: 470, height: b.height };
    const library = { x: 550, y: b.y, width: 875, height: b.height };
    const detail = { x: 1453, y: b.y, width: b.width - 1401, height: b.height };
    [loadout, library, detail].forEach(panel => featurePanel(this, panel));
    serviceText(this, loadout.x + 30, b.y + 30, `Equipped ${leader.battleLoadout.length}/5`, 'heading40');
    for (let i = 0; i < 5; i++) {
      const ability = leaderAbilities.find(entry => entry.id === leader.battleLoadout[i]);
      serviceButton(this, loadout.x + 235, b.y + 145 + i * 128, 410, 110, ability?.name ?? `Empty tactic slot ${i + 1}`, () => {
        this.tacticId = ability.id; this.descriptionOffset = 0; this.render();
      }, { enabled: Boolean(ability), disabledReason: 'This tactic slot is empty. Unlock and equip a tactic from the library.',
        compact: true, selected: this.tacticId === ability?.id, slot: 'body30' });
    }
    this.category ??= 'Assault';
    CATEGORIES.forEach((category, index) => serviceButton(this, library.x + 30 + (index + 0.5) * 203,
      b.y + 65, 190, 70, category, () => { this.category = category; this.libraryOffset = 0; this.render(); },
      { selected: this.category === category, compact: true, slot: 'body30' }));
    const entries = leaderAbilities.filter(ability => ability.category === this.category)
      .sort((a, z) => RARITY_ORDER.indexOf(a.rarity ?? 'common') - RARITY_ORDER.indexOf(z.rarity ?? 'common')
        || a.cost - z.cost || a.name.localeCompare(z.name));
    featureList(this, { x: library.x + 26, y: b.y + 130, width: library.width - 80, height: b.height - 164 }, entries,
      (ability, x, y, width) => {
        const unlocked = hasLeaderAbility(leader, ability.id), equipped = leader.battleLoadout.includes(ability.id);
        const rarity = ITEM_RARITIES[ability.rarity] ?? ITEM_RARITIES.common;
        const requirement = leadershipRequirements(ability);
        const card = serviceCard(this, x + width / 2, y + 80, width, 150, { selected: ability.id === this.tacticId, rarity: rarity.color });
        serviceText(this, x + 22, y + 14, ability.name, 'body34', { wordWrap: { width: width - 44 }, maxLines: 2, color: rarity.color });
        serviceText(this, x + 22, y + 112, equipped ? 'Equipped' : unlocked ? 'Unlocked' : requirement.questOnly ? 'Quest reward required' : `Renown ${requirement.level} · ${ability.cost} RP`, 'body30', { color: '#c6bdac' });
        featureSelect(this, x + width / 2, y + 80, width, 150, () => { this.tacticId = ability.id; this.descriptionOffset = 0; this.render(); },
          { name: `tactic-${ability.id}`, visuals: [card] });
      }, { stride: 172, offset: this.libraryOffset ?? 0, onScroll: value => { this.libraryOffset = value; } });
    const ability = leaderAbilities.find(entry => entry.id === this.tacticId);
    if (!ability) {
      featureBody(this, { x: detail.x + 40, y: b.y + 60, width: detail.width - 110, height: b.height - 120 }, 'Choose a tactic from the library or equipped lineup to inspect its full description.');
      return;
    }
    const unlocked = hasLeaderAbility(leader, ability.id), equipped = leader.battleLoadout.includes(ability.id);
    const requirement = leadershipRequirements(ability);
    const reason = !unlocked && requirement.questOnly ? 'Earn this tactic through its quest reward.'
      : !unlocked && leader.level < requirement.level ? `Requires Renown Level ${requirement.level}.`
        : !unlocked && leader.renownPoints < ability.cost ? 'Not enough Renown Points.'
          : unlocked && !equipped && leader.battleLoadout.length >= 5 ? 'All five slots are full. Unequip a tactic first.' : '';
    serviceText(this, detail.x + 35, b.y + 36, ability.name, 'heading40', { wordWrap: { width: detail.width - 90 }, maxLines: 2 });
    featureBody(this, { x: detail.x + 38, y: b.y + 150, width: detail.width - 102, height: b.height - 360 },
      `${ability.name}\n\n${tacticDescription(ability)}\n\n${ability.oncePerEncounter ? 'Once per encounter.' : `${ability.cooldown / 1000}s cooldown.`}`,
      this.descriptionOffset ?? 0, value => { this.descriptionOffset = value; });
    serviceText(this, detail.x + detail.width / 2, b.bottom - 155, reason || (unlocked ? 'Available to change your party loadout.' : `Unlock for ${ability.cost} RP.`),
      'body32', { align: 'center', wordWrap: { width: detail.width - 100 }, color: '#dfcba8' }).setOrigin(0.5);
    serviceButton(this, detail.x + detail.width / 2, b.bottom - 65, detail.width - 90, 86,
      unlocked ? equipped ? 'Unequip tactic' : 'Equip tactic' : `Unlock · ${ability.cost} RP`, () => this.choose(ability),
      { enabled: !reason, disabledReason: reason });
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
        playUiSound(this, 'failure');
        showSelectionDetails(this, { title: 'Not enough RP', description: `${ability.name} costs ${ability.cost} RP.\nYou have ${leader.renownPoints} RP.` });
        return;
      }
      showConfirmation(this, {
        title: `Unlock ${ability.name}`, description: `${tacticDescription(ability)}\n\nSpend ${ability.cost} RP? Available: ${leader.renownPoints} RP.`,

        // Run the committed action after the player confirms this decision.
        onConfirm: () => {
          if (purchaseLeaderAbility(leader, ability.id)) {
            playUiSound(this, 'success');
            this.message = leader.battleLoadout.includes(ability.id)
              ? `${ability.name} unlocked and equipped.`
              : `${ability.name} unlocked. All five tactic slots are full; unequip one to make room.`;
            HapticsService.confirm();
          }
          else { playUiSound(this, 'failure'); this.message = 'This tactic could not be unlocked.'; }
          this.libraryOffset = 0;
          this.render();
        }
      });

      return;
    }

    if (toggleLeaderLoadoutAbility(leader, ability.id)) {
      playUiSound(this, 'equipment');

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      this.message = `${ability.name} ${leader.battleLoadout.includes(ability.id) ? 'equipped' : 'unequipped'}.`;
      HapticsService.confirm();
    } else { playUiSound(this, 'failure'); this.message = 'All five tactic slots are full. Unequip a tactic first.'; }
    this.libraryOffset = 0;
    this.render();
  }
}
