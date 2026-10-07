import { CLASS_DESCRIPTIONS } from '../data/classDescriptions.js';
import { STAT_DESCRIPTIONS } from '../data/statDescriptions.js';
import { showSelectionDetails } from '../ui/SelectionDetails.js';
import Phaser from 'phaser';
import { UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { abilityPower } from '../game/CharacterStats.js';
import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import { equippedItem, getEquippedAdventurer, ownedEquipment, equipmentOwner, equipItem, unequipItem, equipmentStatsText, canEquipItem } from '../game/Equipment.js';
import { abilityGoldCost, abilityLevelRequired, sortedAbilityEntries, MAX_ABILITY_RANK, MAX_EQUIPPED_ABILITIES, purchaseAdventurerAbility, toggleAdventurerAbility, rankedAbility } from '../game/AdventurerAbilities.js';
import { happinessLabel, xpRequired } from '../game/AdventurerProgression.js';
import { characterDetails } from '../ui/SelectionDetails.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import { HALL, HALL_ARCHETYPES, hallText, hallPanel, hallButton, hallDetails, hallIcon, hallPortrait, preloadHallPortraits, addHallFrame, hallScroll } from '../ui/HallUI.js';
import HapticsService from '../services/HapticsService.js';
import { getPotionDefinition } from '../data/items.js';
import { guildSurface, guildCrest, guildRule } from '../ui/GuildHallTheme.js';

const format = (value) => Number.isFinite(value) ? `${Math.round(value * 100) / 100}` : 'None';
const percent = (value) => `${format((value ?? 0) * 100)}%`;
const slotIcons = { weapon: 'sword', armor: 'shield', accessory: 'rune', potion: 'flask' };

export default class RosterScene extends Phaser.Scene {
  constructor() {
    super('RosterScene');
  }

  preload() {
    preloadHallPortraits(this);
  }

  create() {
    this.heroId = GameState.roster.some((hero) => hero.id === this.heroId) ? this.heroId
      : GameState.roster.filter((hero) => hero.role === 'Tank').sort((a, b) => a.name.localeCompare(b.name))[0]?.id ?? GameState.roster[0]?.id;
    this.tab ??= 'gear';
    this.rosterOffset ??= 0;
    this.skillOffset ??= 0;
    this.message = '';
    this.events.once('shutdown', () => { this.equipmentModalClose?.(); this.selectionDetailsClose?.(); });
    this.render();
  }

  render() {
    this.selectionDetailsClose?.();
    this.equipmentModalClose?.();
    this.children.removeAll(true);
    addHallFrame(this, 'Adventurers', this.message);
    hallPanel(this, 272, 638, 440, 736);
    hallPanel(this, 794, 638, 560, 736);
    hallPanel(this, 1723, 638, 1250, 736);
    this.renderRoster();
    const hero = GameState.roster.find((entry) => entry.id === this.heroId);
    if (!hero) {
      hallText(this, 800, 540, 'No adventurers available.', UI_FONT_SIZES.heading40).setOrigin(0.5);
      return;
    }
    this.renderSummary(hero);
    [['gear', 'Gear & potions'], ['skills', 'Skills & training']].forEach(([key, label], index) => {
      hallButton(this, 1414 + index * 618, 326, 586, 112, label, () => {
        this.tab = key; this.render();
      }, { selected: this.tab === key, name: `hall-tab-${key}`, size: UI_FONT_SIZES.hallSection });
    });
    if (this.tab === 'gear') this.renderGear(hero);
    else this.renderSkills(hero);
  }

  renderRoster() {
    hallText(this, 76, 321, 'Adventurers', UI_FONT_SIZES.body36, { fontStyle: UI_FONT_WEIGHTS.bold });
    hallText(this, 465, 321, `${GameState.roster.length}`, UI_FONT_SIZES.hallCount, { color: HALL.muted }).setOrigin(1, 0.5);
    guildRule(this, 272, 355, 356);
    const start = this.children.list.length;
    let y = 379;
    for (const archetype of HALL_ARCHETYPES) {
      const heroes = GameState.roster.filter((hero) => hero.role === archetype.role).sort((a, b) => a.name.localeCompare(b.name));
      if (!heroes.length) continue;
      this.add.circle(108, y + 28, 25, 0x1c130e).setStrokeStyle(2, archetype.color);
      hallIcon(this, archetype.icon, 108, y + 28, archetype.color, 0.78);
      hallText(this, 146, y + 28, archetype.label, UI_FONT_SIZES.body30, { color: `#${archetype.color.toString(16)}`, fontStyle: UI_FONT_WEIGHTS.bold });
      hallText(this, 442, y + 28, `${heroes.length}`, UI_FONT_SIZES.hallRoleCount, { color: HALL.muted }).setOrigin(1, 0.5);
      y += 70;
      this.add.rectangle(80, y, 3, heroes.length * 142 - 14, archetype.color).setOrigin(0, 0);
      for (const hero of heroes) {
        const row = hallButton(this, 273, y + 64, 350, 128, '', () => {
          this.heroId = hero.id; this.skillOffset = 0; this.message = ''; this.render();
        }, { selected: hero.id === this.heroId, details: () => characterDetails(getEquippedAdventurer(hero)), name: `hall-hero-${hero.id}` });
        hallPortrait(this, hero, 139, y + 64, 96);
        hallText(this, 186, y + 41, hero.name, UI_FONT_SIZES.body32, { fontStyle: UI_FONT_WEIGHTS.bold });
        hallText(this, 186, y + 85, `${hero.shortName ?? hero.className}\nLv ${hero.level}`, UI_FONT_SIZES.hallRosterMeta, {
          color: HALL.muted, wordWrap: { width: 254 }
        });
        row.setData('heroId', hero.id);
        y += 142;
      }
      y += 24;
    }
    this.rosterList = hallScroll(this, { x: 72, y: 376, width: 378, height: 604 },
      this.children.list.slice(start), y - 376, this.rosterOffset, (value) => { this.rosterOffset = value; });
  }

  renderSummary(hero) {
    const effective = getEquippedAdventurer(hero);
    hallText(this, 794, 326, hero.name, UI_FONT_SIZES.heading48, { fontFamily: UI_FONT_FAMILIES.serif }).setOrigin(0.5);
    hallButton(this, 794, 382, 488, 66, `${hero.shortName ?? hero.className} ⓘ`, () => {
      showSelectionDetails(this, { title: hero.className, description: CLASS_DESCRIPTIONS[hero.className] });
    }, { name: 'hall-class-info', size: UI_FONT_SIZES.hallClass, details: { title: hero.className, description: CLASS_DESCRIPTIONS[hero.className] } });
    guildRule(this, 794, 462, 420);
    const archetype = HALL_ARCHETYPES.find((entry) => entry.role === hero.role);
    hallIcon(this, archetype?.icon ?? 'shield', 685, 428, archetype?.color, 0.7);
    hallText(this, 728, 428, hero.role, UI_FONT_SIZES.hallRole, { color: HALL.muted });
    hallPortrait(this, hero, 794, 578, 216);
    hallText(this, 547, 709, `Character level ${hero.level}`, UI_FONT_SIZES.hallSummary);
    hallText(this, 1040, 709, `${hero.xp ?? 0} / ${xpRequired(hero.level)} XP`, UI_FONT_SIZES.hallRoleCount, { color: HALL.muted }).setOrigin(1, 0.5);
    this.add.rectangle(547, 742, 493, 10, 0x170f0a).setOrigin(0, 0.5);
    this.add.rectangle(547, 742, 493 * Math.min(1, (hero.xp ?? 0) / xpRequired(hero.level)), 10, HALL.gold).setOrigin(0, 0.5);
    [['Health', format(effective.maxHp)], ['Attack', format(effective.attackPower)], ['Armor', format(effective.armor)], ['Skill points', `${hero.skillPoints ?? 0}`]].forEach(([label, value], index) => {
      const x = 547 + index % 2 * 256, y = 787 + Math.floor(index / 2) * 44;
      hallText(this, x, y, label, UI_FONT_SIZES.hallStat, { color: HALL.muted });
      hallText(this, x + 226, y, value, UI_FONT_SIZES.hallStat).setOrigin(1, 0.5);
      const hit = this.add.rectangle(x + 116, y, 244, 44, 0, 0).setName(`hall-summary-stat-${label}`);
      hallDetails(this, hit, { title: label, description: STAT_DESCRIPTIONS[label === 'Attack' ? 'Attack Power' : label] }, () => {});
    });
    hallText(this, 794, 873, `${happinessLabel(hero.happiness ?? 70)} · ${hero.happiness ?? 70}% happiness`, UI_FONT_SIZES.hallRole, { color: HALL.green }).setOrigin(0.5);
    hallButton(this, 794, 950, 488, 112, 'View all stats', () => this.openStats(hero), { name: 'hall-all-stats', size: UI_FONT_SIZES.hallSection });
  }

  renderGear(hero) {
    hallText(this, 1130, 423, 'Ready for adventure', UI_FONT_SIZES.heading38, { fontStyle: UI_FONT_WEIGHTS.bold });
    ['weapon', 'armor', 'accessory', 'potion'].forEach((slot, index) => {
      const x = 1412 + index % 2 * 609, y = 580 + Math.floor(index / 2) * 253;
      const item = equippedItem(hero, slot);
      hallButton(this, x, y, 563, 216, '', () => this.openEquipment(hero, slot), {
        name: `hall-slot-${slot}`, details: { title: item?.name ?? slot, description: item
          ? slot === 'potion' ? `${item.charges}/3 uses. ${getPotionDefinition(item.itemId)?.description ?? ''}` : equipmentStatsText(item.stats)
          : `Equip an owned, compatible ${slot} for ${hero.name}.` }
      });
      hallIcon(this, slotIcons[slot], x - 220, y, HALL.gold, 1.4);
      hallText(this, x - 160, y - 64, slot.toUpperCase(), UI_FONT_SIZES.support27, { color: HALL.muted });
      hallText(this, x - 160, y - 9, item?.name ?? 'Empty slot', UI_FONT_SIZES.body36, { fontStyle: UI_FONT_WEIGHTS.bold, wordWrap: { width: 412 } });
      if (item && slot !== 'potion') {
        hallButton(this, x + 52, y + 63, 330, 64, 'View Stat Bonuses', () => {
          showSelectionDetails(this, { title: `${item.name} bonuses`, description: equipmentStatsText(item.stats) || 'No stat bonuses.' });
        }, { name: `hall-slot-bonuses-${slot}`, size: UI_FONT_SIZES.hallGearSummary,
          details: { title: `${item.name} bonuses`, description: equipmentStatsText(item.stats) || 'No stat bonuses.' } });
      } else hallText(this, x - 160, y + 66, item ? `${item.charges}/3 potions` : 'Unequipped', UI_FONT_SIZES.hallGearEmpty, {
        color: item ? HALL.green : HALL.muted, wordWrap: { width: 412 }
      });
    });
    hallText(this, 1130, 976, 'Tap a slot to compare compatible items you own.', UI_FONT_SIZES.hallSlotHint, { color: HALL.muted });
  }

  renderSkills(hero) {
    const loadout = hero.abilityLoadout ?? [];
    hallText(this, 1130, 423, 'Battle abilities', UI_FONT_SIZES.body36, { fontStyle: UI_FONT_WEIGHTS.bold });
    hallText(this, 2295, 423, `${loadout.length}/${MAX_EQUIPPED_ABILITIES} equipped`, UI_FONT_SIZES.hallSkillCount, { color: HALL.muted }).setOrigin(1, 0.5);
    for (let index = 0; index < MAX_EQUIPPED_ABILITIES; index++) {
      const key = loadout[index], ability = hero.abilities[key];
      const x = 1268 + index * 293;
      hallButton(this, x, 537, 272, 142, '', () => this.commit(toggleAdventurerAbility(hero.id, key)), {
        enabled: Boolean(key), details: ability ? this.abilityDetails(hero, key, ability) : undefined, name: `hall-ability-slot-${index}`
      });
      hallText(this, x, 493, `SLOT ${index + 1}`, UI_FONT_SIZES.compact24, { color: HALL.muted }).setOrigin(0.5);
      hallText(this, x, 552, ability?.name ?? 'Empty', UI_FONT_SIZES.hallSkillSlot, { align: 'center', wordWrap: { width: 248 } }).setOrigin(0.5);
    }
    hallText(this, 1130, 653, 'Skill book', UI_FONT_SIZES.body36, { fontStyle: UI_FONT_WEIGHTS.bold });
    hallText(this, 2295, 653, `${hero.skillPoints ?? 0} SP available`, UI_FONT_SIZES.support29, { color: HALL.muted }).setOrigin(1, 0.5);
    const start = this.children.list.length;
    const entries = sortedAbilityEntries(hero);
    entries.forEach(([key, ability], index) => {
      const y = 787 + index * 198, rank = hero.abilityRanks?.[key] ?? 0, next = rank + 1;
      const level = abilityLevelRequired(hero, key, next), cost = abilityGoldCost(hero, key, next);
      const canTrain = next <= MAX_ABILITY_RANK && hero.level >= level && (hero.skillPoints ?? 0) >= next && GameState.gold >= cost;
      guildSurface(this, 1710, y, 1156, 182, 'row', canTrain);
      const row = this.add.rectangle(1710, y, 1156, 182, 0, 0);
      row.setName(`hall-skill-${key}`);
      hallDetails(this, row, this.abilityDetails(hero, key, ability), () => {});
      hallText(this, 1152, y - 51, ability.name, UI_FONT_SIZES.hallSkillName, { fontStyle: UI_FONT_WEIGHTS.bold, wordWrap: { width: 688 } });
      const rankStatus = rank ? `Rank ${rank}/10 · ${loadout.includes(key) ? 'Equipped' : 'Learned'}` : 'Not learned';
      const requirement = next <= MAX_ABILITY_RANK && hero.level < level ? ` · Requires level ${level}` : '';
      hallText(this, 1152, y + 5, `${rankStatus}${requirement}`, UI_FONT_SIZES.hallSkillDetail, {
        color: rank ? HALL.green : HALL.muted
      });
      const status = next > MAX_ABILITY_RANK ? 'Maximum rank' : `Next rank costs ${next} SP and ${cost} Gold to train`;
      hallText(this, 1152, y + 55, status, UI_FONT_SIZES.hallSkillDetail, { wordWrap: { width: 688 }, color: canTrain ? '#ffe0a7' : HALL.muted });
      if (rank) hallButton(this, 1941, y, 178, 112, loadout.includes(key) ? 'Unequip' : 'Equip', () => this.commit(toggleAdventurerAbility(hero.id, key)), {
        selected: loadout.includes(key), name: `hall-equip-skill-${key}`, size: UI_FONT_SIZES.support29
      });
      hallButton(this, 2165, y, 210, 112, next > MAX_ABILITY_RANK ? 'Max rank' : rank ? 'Train' : 'Learn', () => {
        showConfirmation(this, {
          title: `${rank ? 'Train' : 'Learn'} ${ability.name}`,
          description: `${hero.name} · Rank ${next} of ${MAX_ABILITY_RANK}\n\nSpend ${next} skill points and ${cost} Gold?\nTraining price includes ${hero.happiness ?? 70}% happiness.\nRequires character level ${level}.`,
          onConfirm: () => this.commit(purchaseAdventurerAbility(hero.id, key))
        });
      }, { enabled: canTrain, name: `hall-train-${key}` });
    });
    this.skillList = hallScroll(this, { x: 1128, y: 692, width: 1178, height: 290 },
      this.children.list.slice(start), entries.length * 198, this.skillOffset, (value) => { this.skillOffset = value; });
  }

  abilityDetails(hero, key, base) {
    const ability = rankedAbility(base, Math.max(1, hero.abilityRanks?.[key] ?? 0));
    const stats = getEquippedAdventurer(hero);
    const amounts = [];
    const damage = ['damage', 'trap'].includes(ability.effect) && !ability.poison;
    const healing = ability.effect === 'heal' || ability.effect === 'refuge';
    if (damage || healing) {
      let low = ability.power, high = ability.highPower ?? ability.lowHealthPower ?? low;
      if (ability.missingHealthBonus) high = low * 2;
      if (ability.rearBonus) high = Math.max(high, low * (1 + ability.rearBonus));
      if (ability.lowHealthBoost) high = Math.max(high, low * (1 + ability.lowHealthBoost));
      const minimum = Math.round(abilityPower(stats, ability, low, healing));
      const maximum = Math.round(abilityPower(stats, ability, high, healing));
      amounts.push(`${healing ? 'Healing' : 'Damage'}: ${Math.min(minimum, maximum)}-${Math.max(minimum, maximum)}`);
      if (ability.healRatio) amounts.push(`Healing: ${Math.round(abilityPower(stats, ability, low, true) * ability.healRatio)}-${Math.round(abilityPower(stats, ability, high, true) * ability.healRatio)} per enemy hit`);
    }
    if (ability.poison) {
      const power = Math.round(abilityPower(stats, ability, ability.poison.power));
      amounts.push(`Damage: ${power}-${power} per poison tick`);
    }
    return { title: ability.name, description: [ability.targetLabel ?? ability.target ?? 'Self only', ...amounts].join('\n\n') };
  }

  openStats(hero) {
    const stats = getEquippedAdventurer(hero);
    const entries = [['Level', format(hero.level)], ['Health', format(stats.maxHp)], ['Mana', format(stats.maxMana)],
      ['Armor', format(stats.armor)], ['Dodge', percent(stats.dodge)], ['Block', percent(stats.block)], ['Speed', format(stats.speed ?? 100)],
      ['Strength', Number.isFinite(stats.strength) ? format(Math.round(stats.strength)) : 'Not set'],
      ['Agility', Number.isFinite(stats.agility) ? format(Math.round(stats.agility)) : 'Not set'],
      ['Constitution', Number.isFinite(stats.constitution) ? format(Math.round(stats.constitution)) : 'Not set'],
      ['Intellect', Number.isFinite(stats.intellect) ? format(Math.round(stats.intellect)) : 'Not set'],
      ['Wisdom', Number.isFinite(stats.wisdom) ? format(Math.round(stats.wisdom)) : 'Not set'],
      ['Hit Chance', percent(stats.hitChance)], ['Crit Chance', percent(stats.critChance)], ['Crit Multiplier', `${format(stats.critMultiplier)}x`],
      ['Attack Power', format(stats.attackPower)], ['Spell Damage', format(stats.spellDamage)], ['Spell Healing', format(stats.spellHealing)],
      ['Happiness', `${hero.happiness ?? 70}%`], ['Delves Cleared', `${hero.delvesCompleted ?? 0}`]];
    const modal = this.modal(`${hero.name} · Character stats`);
    entries.forEach(([label, value], index) => {
      const x = 581 + Math.floor(index / 10) * 634, y = 296 + index % 10 * 52;
      hallText(this, x, y, label, UI_FONT_SIZES.body30, { color: HALL.muted });
      hallText(this, x + 545, y, value, UI_FONT_SIZES.body30).setOrigin(1, 0.5);
      const hit = this.add.rectangle(x + 273, y, 575, 52, 0, 0).setName(`hall-stat-${label}`);
      hallDetails(this, hit, { title: label, description: STAT_DESCRIPTIONS[label], preserveEquipment: true }, () => {});
    });
    hallText(this, 1200, 855, 'Hold a stat to learn what it does.', UI_FONT_SIZES.support28, { color: HALL.muted }).setOrigin(0.5);
    hallButton(this, 1200, 930, 320, 112, 'Done', modal.close, { modal: true });
    modal.finish();
  }

  modal(title) {
    this.equipmentModalClose?.();
    const start = this.children.list.length;
    let closed = false, objects = [];
    const close = () => {
      if (closed) return;
      closed = true;
      objects.forEach((object) => { if (object.active) object.destroy(); });
      this.equipmentModalClose = null;
    };
    this.equipmentModalClose = close;
    const shade = this.add.rectangle(1200, 540, 2400, 1080, 0x000000, 0.75).setInteractive();
    shade.on('pointerdown', (pointer, x, y, event) => event.stopPropagation());
    hallPanel(this, 1200, 540, 1390, 910);
    guildSurface(this, 1200, 159, 1336, 126, 'beam');
    guildCrest(this, 585, 159, 68);
    guildCrest(this, 1815, 159, 68);
    hallText(this, 1200, 159, title, UI_FONT_SIZES.heading42, { fontFamily: UI_FONT_FAMILIES.serif, align: 'center', wordWrap: { width: 1240 } }).setOrigin(0.5);
    return { close, finish: () => {
      objects = this.children.list.slice(start);
      objects.forEach((object) => object.setDepth(2000 + object.depth));
    } };
  }

  openEquipment(hero, slot, page = 0) {
    const entries = ownedEquipment().filter((item) => item.slot === slot && canEquipItem(hero, item) && !equipmentOwner(item.id));
    const pages = Math.max(1, Math.ceil(entries.length / 3));
    page = Math.max(0, Math.min(page, pages - 1));
    const modal = this.modal(`${hero.name} · ${slot[0].toUpperCase() + slot.slice(1)}`);
    const current = equippedItem(hero, slot);
    hallText(this, 564, 250, `Currently: ${current?.name ?? 'Empty slot'}`, UI_FONT_SIZES.body32, { color: HALL.muted });
    if (current) hallButton(this, 1680, 250, 280, 112, 'Unequip', () => { modal.close(); this.commit(unequipItem(hero.id, slot)); }, { modal: true });
    if (!entries.length) hallText(this, 1200, 528, 'No compatible, unequipped items owned.', UI_FONT_SIZES.body36, { color: HALL.muted }).setOrigin(0.5);
    entries.slice(page * 3, page * 3 + 3).forEach((item, index) => {
      const y = 395 + index * 170;
      hallPanel(this, 1200, y, 1260, 150);
      hallText(this, 594, y - 28, item.name, UI_FONT_SIZES.body34, { fontStyle: UI_FONT_WEIGHTS.bold, wordWrap: { width: 842 } });
      hallText(this, 594, y + 37, slot === 'potion' ? `${item.charges}/3 uses · ${getPotionDefinition(item.itemId)?.description ?? ''}` : equipmentStatsText(item.stats), UI_FONT_SIZES.itemSummary, {
        color: HALL.muted, wordWrap: { width: 840 }
      });
      hallButton(this, 1680, y, 270, 112, 'Compare', () => {
        modal.close();
        const effective = getEquippedAdventurer(hero);
        const keys = new Set([...Object.keys(current?.stats ?? {}), ...Object.keys(item.stats ?? {})]);
        const labels = { maxHp: 'Health', attackPower: 'Attack Power', spellDamage: 'Spell Damage', spellHealing: 'Spell Healing', healPower: 'Spell Healing', armor: 'Armor' };
        const comparison = [...keys].map((key) => {
          const before = effective[key] ?? 0, after = before - (current?.stats?.[key] ?? 0) + (item.stats?.[key] ?? 0);
          return `${labels[key] ?? key}: ${format(before)} → ${format(after)}`;
        }).join('\n');
        showConfirmation(this, {
          title: `Equip ${item.name}?`, confirmLabel: 'EQUIP',
          description: `${hero.name} · Replaces ${current?.name ?? 'empty ' + slot + ' slot'}\n\n${comparison || `${item.charges}/3 uses · ${getPotionDefinition(item.itemId)?.description ?? 'No stat bonuses'}`}`,
          onCancel: () => this.openEquipment(hero, slot, page),
          onConfirm: () => this.commit(equipItem(hero.id, item.id))
        });
      }, { modal: true, name: `hall-compare-${item.id}` });
    });
    hallButton(this, 710, 930, 230, 112, 'Prev', () => this.openEquipment(hero, slot, page - 1), { enabled: page > 0, modal: true });
    hallText(this, 1010, 930, `${page + 1}/${pages}`, UI_FONT_SIZES.body32).setOrigin(0.5);
    hallButton(this, 1310, 930, 230, 112, 'Next >', () => this.openEquipment(hero, slot, page + 1), { enabled: page < pages - 1, modal: true });
    hallButton(this, 1680, 930, 270, 112, 'Done', modal.close, { modal: true });
    modal.finish();
  }

  commit(result) {
    this.message = result.message;
    if (result.ok) { saveProfile(); HapticsService.confirm(); }
    this.render();
  }
}
