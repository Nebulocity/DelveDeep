import TownFeatureScene, { featurePanel, featureList, featureBody, featureSelect } from '../ui/TownFeatureUI.js';
import { characterSelector, selectedCharacter } from '../ui/CharacterSelection.js';
import { serviceText, serviceButton, serviceCard } from '../ui/TownServiceTheme.js';
import GameState from '../game/GameState.js';
import { sortedAbilityEntries, rankedAbility, MAX_EQUIPPED_ABILITIES, MAX_ABILITY_RANK,
  abilityLevelRequired, abilitySkillPointCost, abilityGoldCost, purchaseAdventurerAbility, toggleAdventurerAbility } from '../game/AdventurerAbilities.js';
import { getEquippedAdventurer } from '../game/Equipment.js';
import { abilityDescription } from '../game/AbilityDescriptions.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import { trainingComparison } from '../ui/AbilityPresentation.js';
import { categoryIcon } from '../ui/IdentityIcons.js';
import { abilityMeetsLevel } from '../data/abilityUnlocks.js';
import { ITEM_RARITIES } from '../data/items.js';

export default class AbilitiesScene extends TownFeatureScene {
  constructor() { super('AbilitiesScene', true); }

  render() {
    const hero = selectedCharacter();
    const b = this.frame('Abilities', 'abilities', { resource: hero ? `${hero.skillPoints ?? 0} Skill Points · ${GameState.gold} Gold` : '',
      hint: 'Select a skill to read its full effect, train a rank, or change battle abilities.' });
    characterSelector(this, { ...b, width: 440 }, () => {
      this.abilityKey = null; this.bookOffset = 0; this.descriptionOffset = 0; this.render();
    }, { roleOrder: ['Tank', 'Healer', 'Melee DPS', 'Ranged DPS'] });
    if (!hero) return;
    const loadout = (hero.abilityLoadout ?? []).filter(key => abilityMeetsLevel(hero, hero.abilities[key]));
    const rightX = 520, rightWidth = b.width - 468;
    featurePanel(this, { x: rightX, y: b.y, width: rightWidth, height: 174 });
    serviceText(this, rightX + 32, b.y + 20, `${hero.name} · Battle abilities ${loadout.length}/${MAX_EQUIPPED_ABILITIES}`, 'body34');
    const slotWidth = (rightWidth - 90) / MAX_EQUIPPED_ABILITIES;
    for (let i = 0; i < MAX_EQUIPPED_ABILITIES; i++) {
      const key = loadout[i], ability = hero.abilities[key];
      serviceButton(this, rightX + 45 + slotWidth * (i + 0.5), b.y + 112, slotWidth - 14, 88,
        ability?.name ?? `Empty slot ${i + 1}`, () => { this.abilityKey = key; this.descriptionOffset = 0; this.render(); },
        { compact: true, enabled: Boolean(key), disabledReason: 'This battle slot is empty. Learn an ability and equip it from the skill book.',
          selected: this.abilityKey === key, slot: 'body30', name: `ability-slot-${i}` });
    }
    const top = b.y + 198, height = b.height - 198;
    const library = { x: rightX, y: top, width: 870, height };
    const detail = { x: rightX + 898, y: top, width: rightWidth - 898, height };
    featurePanel(this, library); featurePanel(this, detail);
    this.category ??= 'All';
    const filters = ['All', 'Learned', 'Assault', 'Protect', 'Restore', 'Prepare', 'Generic'];
    filters.forEach((filter, i) => serviceButton(this, library.x + 25 + (i % 4 + 0.5) * 203,
      top + 55 + Math.floor(i / 4) * 70, 191, 60, filter, () => {
        this.category = filter; this.bookOffset = 0; this.render();
      }, { compact: true, selected: this.category === filter, slot: 'body30' }));
    const entries = sortedAbilityEntries(hero).filter(([key, ability]) => this.category === 'All'
      || (this.category === 'Learned' ? hero.abilityRanks?.[key] > 0
        : this.category === 'Generic' ? ability.origin === 'Generic'
          : ability.origin !== 'Generic' && ability.category === this.category));
    if (this.abilityKey && !entries.some(([key]) => key === this.abilityKey)) {
      this.abilityKey = null;
      this.descriptionOffset = 0;
    }
    featureList(this, { x: library.x + 26, y: top + 176, width: library.width - 78, height: height - 208 }, entries,
      ([key, ability], x, y, width) => {
        const rank = hero.abilityRanks?.[key] ?? 0;
        const locked = !abilityMeetsLevel(hero, ability);
        const card = serviceCard(this, x + width / 2, y + 80, width, 150, { selected: key === this.abilityKey });
        if (locked) card.setAlpha(0.7);
        categoryIcon(this, ability.category, x + 48, y + 51, 48).setAlpha(locked ? 0.65 : 1);
        serviceText(this, x + 88, y + 16, ability.name, 'body34', {
          wordWrap: { width: width - 110 }, maxLines: 2,
          color: locked ? '#b7afa2' : (ITEM_RARITIES[ability.rarity] ?? ITEM_RARITIES.common).color
        });
        serviceText(this, x + 22, y + 112, locked ? `Unlocks at Level ${ability.minimumLevel}`
          : `${ability.category} · Rank ${rank}/${MAX_ABILITY_RANK}${ability.innate ? ' · Innate' : loadout.includes(key) ? ' · Equipped' : ''}`,
        'support28', { color: locked ? '#dfbf7a' : '#c6bdac' });
        featureSelect(this, x + width / 2, y + 80, width, 150, () => {
          this.abilityKey = key; this.descriptionOffset = 0; this.render();
        }, { name: `ability-${key}`, visuals: [card] });
      }, { stride: 172, offset: this.bookOffset ?? 0, onScroll: value => { this.bookOffset = value; } });
    if (!entries.length) serviceText(this, library.x + 38, top + 205, 'No abilities in this category.', 'body32');
    const base = hero.abilities[this.abilityKey];
    if (!base) {
      featureBody(this, { x: detail.x + 45, y: top + 65, width: detail.width - 110, height: height - 110 }, 'Select an ability from the skill book.');
      return;
    }
    const key = this.abilityKey, rank = hero.abilityRanks?.[key] ?? 0, next = rank + 1;
    const locked = !abilityMeetsLevel(hero, base);
    const level = abilityLevelRequired(hero, key, next), points = abilitySkillPointCost(next), gold = abilityGoldCost(hero, key, next);
    const reason = next > MAX_ABILITY_RANK ? 'Maximum rank reached.' : hero.level < level ? `Requires character level ${level}.`
      : (hero.skillPoints ?? 0) < points ? 'Not enough skill points.' : GameState.gold < gold ? 'Not enough Gold.' : '';
    serviceText(this, detail.x + 36, top + 28, base.name, 'heading40', { wordWrap: { width: detail.width - 90 }, maxLines: 2 });
    const description = abilityDescription(getEquippedAdventurer(hero), rankedAbility(base, Math.max(1, rank)));
    featureBody(this, { x: detail.x + 36, y: top + 137, width: detail.width - 94, height: height - 332 },
      `${base.name}\n${locked ? `Unlocks at Level ${base.minimumLevel}\n` : ''}Rank ${rank}/${MAX_ABILITY_RANK} · ${base.category}${base.innate ? '\nAlways equipped; uses no battle slot.' : ''}\n\n${description}\n\n${next <= MAX_ABILITY_RANK ? `Next rank: ${points} SP + ${gold} Gold\nRequires level ${level}.` : 'Maximum rank.'}`,
      this.descriptionOffset ?? 0, value => { this.descriptionOffset = value; });
    serviceText(this, detail.x + detail.width / 2, top + height - 147, reason || 'Training uses this character’s skill points and Gold.', 'body30',
      { align: 'center', wordWrap: { width: detail.width - 90 }, color: '#dfcba8' }).setOrigin(0.5);
    const actionWidth = (detail.width - 100) / 2;
    serviceButton(this, detail.x + 36 + actionWidth / 2, top + height - 65, actionWidth, 84,
      base.innate ? 'Always equipped' : loadout.includes(key) ? 'Unequip' : 'Equip', () => this.commit(toggleAdventurerAbility(hero.id, key), 'equipment'),
      { enabled: !locked && rank > 0 && !base.innate, disabledReason: locked ? `Unlocks at Level ${base.minimumLevel}.`
        : base.innate ? 'Innate abilities are always equipped.' : 'Learn this ability before equipping it.',
        compact: true, slot: 'body30' });
    serviceButton(this, detail.x + detail.width - 36 - actionWidth / 2, top + height - 65, actionWidth, 84,
      rank ? 'Train rank' : 'Learn', () => showConfirmation(this, {
        title: `${rank ? 'Train' : 'Learn'} ${base.name}`, category: base.category,
        description: `${hero.name} · Rank ${rank} → ${next}\n\n${trainingComparison(hero, base, rank, next)}\n\nSpend ${points} skill points and ${gold} Gold?\nRequires level ${level}. Price includes ${Math.round(hero.happiness ?? 70)}% happiness.`,
        onConfirm: () => this.commit(purchaseAdventurerAbility(hero.id, key), 'training')
      }), { enabled: !reason, disabledReason: reason, slot: 'body30' });
  }
}
