import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import { equippedItem, getEquippedAdventurer } from '../game/Equipment.js';
import { equipmentStatsText } from '../data/items.js';
import { abilityEntries, abilityGoldCost, abilityLevelRequired, MAX_ABILITY_RANK, MAX_EQUIPPED_ABILITIES, purchaseAdventurerAbility, toggleAdventurerAbility } from '../game/AdventurerAbilities.js';
import { happinessLabel, xpRequired } from '../game/AdventurerProgression.js';
import { bindSelectionDetails } from '../ui/SelectionDetails.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import { addHallBackground } from '../ui/HallBackground.js';
import HapticsService from '../services/HapticsService.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

const ROLES = [
  ['Tank', 'TANKS'],
  ['Healer', 'HEALERS'],
  ['Melee DPS', 'MELEE DPS'],
  ['Ranged DPS', 'RANGED DPS']
];

const formatNumber = (value, suffix = '') => Number.isFinite(value) ? `${Math.round(value * 100) / 100}${suffix}` : '—';
const percent = (value) => Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';

export default class RosterScene extends Phaser.Scene {
  constructor() {
    super('RosterScene');
  }

  create() {
    this.role = ROLES[0][0];
    this.heroId = GameState.roster.find((hero) => hero.role === this.role)?.id;
    this.message = '';
    this.render();
  }

  render() {
    this.selectionDetailsClose?.();
    this.children.removeAll(true);
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1b0e09');
    addHallBackground(this, 0.45);
    this.add.rectangle(width / 2, 0, width, UI_SAFE_TOP + 146, 0x180d09, 0.86).setOrigin(0.5, 0);
    this.add.rectangle(width / 2, height, width, 64, 0x180d09, 0.8).setOrigin(0.5, 1);

    this.button(160, UI_SAFE_TOP + 27, 250, 72, '< HALL', () => this.scene.start('AdventurersHallScene'));
    this.add.text(width / 2, UI_SAFE_TOP + 19, 'ADVENTURERS', {
      fontFamily: 'Arial', fontSize: '68px', fontStyle: 'bold', color: '#fff1d2'
    }).setOrigin(0.5);
    this.add.text(width / 2, UI_SAFE_TOP + 86, 'Select an adventurer. Hold an ability for details.', {
      fontFamily: 'Arial', fontSize: '29px', color: '#f4d5ab'
    }).setOrigin(0.5);
    this.add.text(width - 65, UI_SAFE_TOP + 27, `${GameState.gold} GOLD`, {
      fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#fbbf24'
    }).setOrigin(1, 0.5);

    this.panel(315, 655, 550, 730);
    this.panel(1055, 655, 880, 730);
    this.panel(1945, 655, 850, 730);
    this.renderRoles();
    const hero = GameState.roster.find((entry) => entry.id === this.heroId);
    if (hero) {
      this.renderStats(hero);
      this.renderAbilities(hero);
    }
    if (this.message) this.add.text(width / 2, height - 30, this.message, {
      fontFamily: 'Arial', fontSize: '28px', color: '#ffe2a9',
      stroke: '#180d09', strokeThickness: 5
    }).setOrigin(0.5);
  }

  panel(x, y, width, height) {
    this.add.rectangle(x, y, width, height, 0x21130d, 0.91).setStrokeStyle(3, 0x9b6b3b);
  }

  button(x, y, width, height, label, callback, enabled = true, selected = false) {
    const box = this.add.rectangle(x, y, width, height, selected ? 0x6b4527 : 0x3a2418, enabled ? 0.96 : 0.5)
      .setStrokeStyle(3, selected ? 0xffd58e : 0xb9874d);
    this.add.text(x, y, label, {
      fontFamily: 'Arial', fontSize: '27px', fontStyle: 'bold',
      color: enabled ? '#fff1d2' : '#ad9981'
    }).setOrigin(0.5);
    if (enabled) box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      HapticsService.tap();
      callback();
    });
    return box;
  }

  renderRoles() {
    ROLES.forEach(([role, label], index) => {
      const x = index % 2 === 0 ? 190 : 440;
      const y = 345 + Math.floor(index / 2) * 67;
      this.button(x, y, 230, 58, label, () => {
        this.role = role;
        this.heroId = GameState.roster.find((hero) => hero.role === role)?.id;
        this.message = '';
        this.render();
      }, true, this.role === role);
    });
    const heroes = GameState.roster.filter((hero) => hero.role === this.role)
      .sort((a, b) => a.name.localeCompare(b.name));
    heroes.forEach((hero, index) => {
      const y = 525 + index * 119;
      const selected = hero.id === this.heroId;
      const card = this.add.rectangle(315, y, 500, 108, selected ? 0x624126 : 0x302018, 0.96)
        .setStrokeStyle(3, selected ? 0xffd58e : 0x8c6543).setInteractive({ useHandCursor: true });
      this.add.circle(108, y, 30, hero.color).setStrokeStyle(2, 0xffe2a9);
      this.add.text(155, y - 29, hero.name, {
        fontFamily: 'Arial', fontSize: '31px', fontStyle: 'bold', color: '#fff1d2'
      });
      this.add.text(155, y + 13, `${hero.shortName ?? hero.className}  •  Lv ${hero.level}`, {
        fontFamily: 'Arial', fontSize: '23px', color: '#e6c7a3'
      });
      card.on('pointerdown', () => {
        HapticsService.tap();
        this.heroId = hero.id;
        this.message = '';
        this.render();
      });
    });
  }

  renderStats(hero) {
    const effective = getEquippedAdventurer(hero);
    this.add.text(1055, 332, hero.name.toUpperCase(), {
      fontFamily: 'Arial', fontSize: '45px', fontStyle: 'bold', color: '#fff1d2'
    }).setOrigin(0.5);
    this.add.text(1055, 382, `${hero.className}  •  ${hero.role}`, {
      fontFamily: 'Arial', fontSize: '28px', color: '#e8c89f'
    }).setOrigin(0.5);
    this.add.text(1055, 426, `LEVEL ${hero.level}   XP ${hero.xp ?? 0}/${xpRequired(hero.level)}`, {
      fontFamily: 'Arial', fontSize: '28px', color: '#fbbf24'
    }).setOrigin(0.5);

    const stats = [
      ['Health', formatNumber(effective.maxHp)],
      ['Mana', formatNumber(effective.maxMana)],
      ['Mana regen', formatNumber(effective.manaRegen, '/s')],
      ['Attack', formatNumber(effective.attackPower)],
      ['Attack range', formatNumber(effective.attackRange)],
      ['Attack cooldown', formatNumber(effective.attackCooldown, ' ms')],
      ['Attack windup', formatNumber(effective.attackWindup, ' ms')],
      ['Move speed', formatNumber(effective.moveSpeed)],
      ['Armor', percent(effective.armor)],
      ['Crit chance', percent(effective.critChance)],
      ['Crit damage', formatNumber(effective.critMultiplier, 'x')],
      ['Threat', formatNumber(effective.threatMultiplier, 'x')],
      ['Healing', formatNumber(effective.healPower)],
      ['Heal range', formatNumber(effective.healRange)],
      ['Heal cooldown', formatNumber(effective.healCooldown, ' ms')],
      ['Heal windup', formatNumber(effective.healWindup, ' ms')],
      ['Basic heal', formatNumber(effective.basicHealPower)],
      ['Basic heal range', formatNumber(effective.basicHealRange)],
      ['Happiness', `${hero.happiness ?? 70}% ${happinessLabel(hero.happiness ?? 70)}`],
      ['Delves cleared', formatNumber(hero.delvesCompleted ?? 0)]
    ];
    stats.forEach(([label, value], index) => {
      const x = index < 10 ? 650 : 1095;
      const y = 475 + (index % 10) * 35;
      this.add.text(x, y, `${label}: ${value}`, {
        fontFamily: 'Arial', fontSize: '25px', color: '#f1dfca'
      });
    });
    const weapon = equippedItem(hero, 'weapon');
    const armor = equippedItem(hero, 'armor');
    this.add.text(650, 844, `WEAPON  ${weapon?.name ?? 'None'}`, {
      fontFamily: 'Arial', fontSize: '27px', color: '#ffe0a7'
    });
    this.add.text(650, 876, weapon ? equipmentStatsText(weapon.stats) : 'No weapon bonuses', {
      fontFamily: 'Arial', fontSize: '23px', color: '#c7a982'
    });
    this.add.text(650, 910, `ARMOR  ${armor?.name ?? 'None'}`, {
      fontFamily: 'Arial', fontSize: '27px', color: '#ffe0a7'
    });
    this.add.text(650, 944, armor ? equipmentStatsText(armor.stats) : 'No armor bonuses', {
      fontFamily: 'Arial', fontSize: '23px', color: '#c7a982'
    });
  }

  renderAbilities(hero) {
    const loadout = hero.abilityLoadout ?? [];
    this.add.text(1945, 330, 'BATTLE ABILITIES', {
      fontFamily: 'Arial', fontSize: '43px', fontStyle: 'bold', color: '#fff1d2'
    }).setOrigin(0.5);
    this.add.text(1945, 380, `EQUIPPED ${loadout.length}/${MAX_EQUIPPED_ABILITIES}   •   Unlock and rank up with gold`, {
      fontFamily: 'Arial', fontSize: '25px', color: '#e8c89f'
    }).setOrigin(0.5);
    abilityEntries(hero).forEach(([key, ability], index) => {
      const rank = hero.abilityRanks?.[key] ?? 0;
      const equipped = loadout.includes(key);
      const y = 465 + index * 108;
      const row = this.add.rectangle(1945, y, 804, 100, equipped ? 0x4a3420 : 0x302119, 0.96)
        .setStrokeStyle(2, equipped ? 0xe8b35e : 0x795637);
      bindSelectionDetails(this, row, {
        title: ability.name,
        description: `${ability.effect} ability. Range ${Number.isFinite(ability.range) ? ability.range : 'any'} cells. Cooldown ${ability.cooldown / 1000}s.${ability.power != null ? ` Base power ${ability.power}.` : ''}\n\nRanks improve power and duration by 20% and 15% per rank, reduce cooldown by 10% per rank, and improve reactive chance when applicable.`
      }, () => {});
      this.add.text(1560, y - 37, ability.name, {
        fontFamily: 'Arial', fontSize: '27px', fontStyle: 'bold', color: '#fff1d2',
        wordWrap: { width: 415 }
      });
      const nextRank = rank + 1;
      const level = nextRank <= MAX_ABILITY_RANK ? abilityLevelRequired(hero, key, nextRank) : null;
      const cost = nextRank <= MAX_ABILITY_RANK ? abilityGoldCost(hero, key, nextRank) : null;
      this.add.text(1560, y + 13, rank
        ? `R${rank}/${MAX_ABILITY_RANK} ${equipped ? 'EQUIPPED' : 'UNEQUIPPED'}${nextRank <= MAX_ABILITY_RANK ? `  •  NEXT L${level} ${cost}g` : ''}`
        : `LOCKED  •  Level ${level}  •  ${cost}g`, {
        fontFamily: 'Arial', fontSize: '22px', color: equipped ? '#fcd38b' : '#d4b798'
      });
      if (rank) this.button(2070, y, 145, 62, equipped ? 'REMOVE' : 'EQUIP', () => this.commit(toggleAdventurerAbility(hero.id, key)));
      if (nextRank <= MAX_ABILITY_RANK) {
        this.button(2270, y, 170, 62, rank ? `RANK UP` : 'UNLOCK', () => {
          showConfirmation(this, {
            title: rank ? `Rank up ${ability.name}` : `Unlock ${ability.name}`,
            description: `Spend ${cost} gold for rank ${nextRank}?\n\nRequires adventurer level ${level}. Current level: ${hero.level}. Gold available: ${GameState.gold}.`,
            onConfirm: () => this.commit(purchaseAdventurerAbility(hero.id, key))
          });
        }, hero.level >= level && GameState.gold >= cost);
      }
    });
  }

  commit(result) {
    this.message = result.message;
    if (result.ok) {
      saveProfile();
      HapticsService.confirm();
    }
    this.render();
  }
}
