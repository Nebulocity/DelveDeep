import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import { equippedItem, getEquippedAdventurer, ownedEquipment, equipmentOwner, equipItem, unequipItem, equipmentStatsText } from '../game/Equipment.js';
import { abilityEntries, abilityGoldCost, abilityLevelRequired, MAX_ABILITY_RANK, MAX_EQUIPPED_ABILITIES, purchaseAdventurerAbility, toggleAdventurerAbility } from '../game/AdventurerAbilities.js';
import { happinessLabel, xpRequired } from '../game/AdventurerProgression.js';
import { bindSelectionDetails } from '../ui/SelectionDetails.js';
import { showConfirmation } from '../ui/ConfirmationDialog.js';
import { addHallBackground } from '../ui/HallBackground.js';
import HapticsService from '../services/HapticsService.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';
import { addReturnButton } from '../ui/ReturnButton.js';

const ROLES = [
  ['Tank', 'TANKS'],
  ['Healer', 'HEALERS'],
  ['Melee DPS', 'MELEE DPS'],
  ['Ranged DPS', 'RANGED DPS']
];

const heroesForRole = (role) => GameState.roster.filter((hero) => hero.role === role)
  .sort((a, b) => a.name.localeCompare(b.name));

const formatNumber = (value, suffix = '') => Number.isFinite(value) ? `${Math.round(value * 100) / 100}${suffix}` : '—';
const percent = (value) => Number.isFinite(value) ? `${Math.round(value * 100)}%` : '—';

export default class RosterScene extends Phaser.Scene {
  constructor() {
    super('RosterScene');
  }

  create() {
    this.role = ROLES[0][0];
    this.heroId = heroesForRole(this.role)[0]?.id;
    this.message = '';
    this.abilityScroll = 0;
    this.input.on('wheel', (pointer, objects, dx, dy) => {
      if (pointer.x >= 1535 && pointer.y >= 415 && pointer.y <= 990) this.scrollAbilities(dy);
    });
    let dragY = null;
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown || pointer.x < 1535 || pointer.y < 415 || pointer.y > 990) { dragY = null; return; }
      if (dragY !== null) this.scrollAbilities(dragY - pointer.y);
      dragY = pointer.y;
    });
    this.input.on('pointerup', () => { dragY = null; });
    this.events.once('shutdown', () => this.abilityMaskShape?.destroy());
    this.render();
  }

  scrollAbilities(delta) {
    if (!this.abilityList || !this.abilityScrollMax) return;
    const next = Phaser.Math.Clamp(this.abilityScroll + delta, 0, this.abilityScrollMax);
    if (next === this.abilityScroll) return;
    this.abilityScroll = next;
    this.abilityList.y = -next;
  }

  render() {
    this.selectionDetailsClose?.();
    this.equipmentModalClose?.();
    this.abilityMaskShape?.destroy();
    this.children.removeAll(true);
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1b0e09');
    addHallBackground(this, 0.45);
    this.add.rectangle(width / 2, 0, width, UI_SAFE_TOP + 146, 0x180d09, 0.86).setOrigin(0.5, 0);
    this.add.rectangle(width / 2, height, width, 64, 0x180d09, 0.8).setOrigin(0.5, 1);

    addReturnButton(this, "Adventurer's Hall", () => this.scene.start('AdventurersHallScene'), { y: UI_SAFE_TOP + 27 });
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
        this.heroId = heroesForRole(role)[0]?.id;
        this.abilityScroll = 0;
        this.message = '';
        this.render();
      }, true, this.role === role);
    });
    const heroes = heroesForRole(this.role);
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
        this.abilityScroll = 0;
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
    const equipment = [
      ['weapon', 725],
      ['armor', 945],
      ['accessory', 1165],
      ['potion', 1385]
    ];
    equipment.forEach(([slot, x]) => {
      const item = equippedItem(hero, slot);
      this.add.text(x, 837, slot.toUpperCase(), { fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: '#ffe0a7' }).setOrigin(0.5);
      this.add.text(x, 872, item?.name ?? 'Empty slot', {
        fontFamily: 'Arial', fontSize: '23px', color: item ? '#fff1d2' : '#c7a982',
        wordWrap: { width: 195 }, align: 'center'
      }).setOrigin(0.5);
      this.add.text(x, 915, slot === 'potion' ? (item ? `${item.charges}/3 uses` : '3 uses per pack')
        : item ? equipmentStatsText(item.stats) : 'No bonuses', {
        fontFamily: 'Arial', fontSize: '20px', color: '#c7a982', wordWrap: { width: 195 }, align: 'center'
      }).setOrigin(0.5);
      this.button(x, 971, 170, 64, 'EQUIP', () => this.openEquipment(hero, slot));
    });
  }

  openEquipment(hero, slot, page = 0) {
    this.equipmentModalClose?.();
    const { width, height } = this.scale;
    const entries = ownedEquipment().filter((instance) => {
      return instance.slot === slot && (slot === 'potion'
        || instance.className === hero.className || instance.usableBy?.includes(hero.className))
        && !equipmentOwner(instance.id);
    });
    const pages = Math.max(1, Math.ceil(entries.length / 3));
    page = Math.max(0, Math.min(page, pages - 1));
    const objects = [];
    const add = (object, depth = 2002) => { object.setDepth(depth); objects.push(object); return object; };
    const close = () => { objects.forEach((object) => object.destroy()); this.equipmentModalClose = null; };
    this.equipmentModalClose = close;
    add(this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.76).setInteractive(), 2000)
      .on('pointerdown', (pointer, x, y, event) => event.stopPropagation());
    add(this.add.rectangle(width / 2, height / 2, 1390, 790, 0x21130d, 0.98).setStrokeStyle(4, 0xd9a662).setInteractive(), 2001)
      .on('pointerdown', (pointer, x, y, event) => event.stopPropagation());
    add(this.add.text(width / 2, 199, `${hero.name.toUpperCase()}  •  ${slot.toUpperCase()}`, {
      fontFamily: 'Arial', fontSize: '42px', fontStyle: 'bold', color: '#fff1d2'
    }).setOrigin(0.5));
    const modalButton = (x, y, label, callback, enabled = true, buttonWidth = 220) => {
      const box = add(this.add.rectangle(x, y, buttonWidth, 68, 0x6b4527, enabled ? 1 : 0.45).setStrokeStyle(3, 0xd9a662));
      add(this.add.text(x, y, label, { fontFamily: 'Arial', fontSize: '27px', fontStyle: 'bold', color: '#fff1d2' }).setOrigin(0.5));
      if (enabled) box.setInteractive({ useHandCursor: true }).on('pointerdown', (pointer, localX, localY, event) => {
        event.stopPropagation(); HapticsService.tap(); callback();
      });
    };
    modalButton(1780, 200, 'CLOSE', close);
    const current = equippedItem(hero, slot);
    add(this.add.text(625, 256, `Currently equipped: ${current?.name ?? 'None'}`, {
      fontFamily: 'Arial', fontSize: '29px', color: '#ffe0a7'
    }));
    if (current) modalButton(1740, 258, 'UNEQUIP', () => { close(); this.commit(unequipItem(hero.id, slot)); });
    if (!entries.length) add(this.add.text(width / 2, 525, slot === 'potion'
      ? 'No potion packs are available yet.' : 'No equipment is available yet.', {
      fontFamily: 'Arial', fontSize: '32px', color: '#e8c89f', wordWrap: { width: 1130 }, align: 'center'
    }).setOrigin(0.5));
    entries.slice(page * 3, page * 3 + 3).forEach((instance, index) => {
      const item = instance;
      const y = 350 + index * 172;
      add(this.add.rectangle(width / 2, y + 45, 1260, 146, 0x382315, 0.96).setStrokeStyle(2, 0x9b6b3b));
      add(this.add.text(630, y + 10, item.name, { fontFamily: 'Arial', fontSize: '32px', fontStyle: 'bold', color: '#fff1d2' }));
      add(this.add.text(630, y + 56, slot === 'potion' ? `${item.charges}/3 uses`
        : equipmentStatsText(item.stats) || 'No bonuses', {
        fontFamily: 'Arial', fontSize: '26px', color: '#e8c89f', wordWrap: { width: 820 }
      }));
      modalButton(1740, y + 45, 'EQUIP', () => { close(); this.commit(equipItem(hero.id, instance.id)); });
    });
    modalButton(770, 866, '< PREV', () => this.openEquipment(hero, slot, page - 1), page > 0);
    add(this.add.text(width / 2, 866, `${page + 1} / ${pages}`, { fontFamily: 'Arial', fontSize: '29px', color: '#fff1d2' }).setOrigin(0.5));
    modalButton(1630, 866, 'NEXT >', () => this.openEquipment(hero, slot, page + 1), page < pages - 1);
  }

  renderAbilities(hero) {
    const loadout = hero.abilityLoadout ?? [];
    this.add.text(1945, 330, 'BATTLE ABILITIES', {
      fontFamily: 'Arial', fontSize: '43px', fontStyle: 'bold', color: '#fff1d2'
    }).setOrigin(0.5);
    this.add.text(1945, 380, `EQUIPPED ${loadout.length}/${MAX_EQUIPPED_ABILITIES}   •   Unlock with gold`, {
      fontFamily: 'Arial', fontSize: '25px', color: '#e8c89f'
    }).setOrigin(0.5);
    const firstRow = this.children.list.length;
    const entries = abilityEntries(hero);
    entries.forEach(([key, ability], index) => {
      const rank = hero.abilityRanks?.[key] ?? 0;
      const equipped = loadout.includes(key);
      const y = 480 + index * 132;
      const row = this.add.rectangle(1945, y, 804, 124, equipped ? 0x4a3420 : 0x302119, 0.96)
        .setStrokeStyle(2, equipped ? 0xe8b35e : 0x795637);
      bindSelectionDetails(this, row, {
        title: ability.name,
        description: `${ability.effect} ability. Range ${Number.isFinite(ability.range) ? ability.range : 'any'} cells. Cooldown ${ability.cooldown / 1000}s.${ability.power != null ? ` Base power ${ability.power}.` : ''}\n\nRanks improve power and duration by 20% and 15% per rank, reduce cooldown by 10% per rank, and improve reactive chance when applicable.`
      }, () => {});
      this.add.text(1560, y - 51, ability.name, {
        fontFamily: 'Arial', fontSize: '27px', fontStyle: 'bold', color: '#fff1d2',
        wordWrap: { width: 415 }
      });
      const nextRank = rank + 1;
      const level = nextRank <= MAX_ABILITY_RANK ? abilityLevelRequired(hero, key, nextRank) : null;
      const cost = nextRank <= MAX_ABILITY_RANK ? abilityGoldCost(hero, key, nextRank) : null;
      this.add.text(1560, y - 3, rank
        ? `R${rank}/${MAX_ABILITY_RANK} ${equipped ? 'EQUIPPED' : 'UNEQUIPPED'}`
        : `LOCKED  •  Level ${level}  •  ${cost}g`, {
        fontFamily: 'Arial', fontSize: '22px', color: equipped ? '#fcd38b' : '#d4b798',
        wordWrap: { width: 415 }
      });
      if (rank && nextRank <= MAX_ABILITY_RANK) this.add.text(1560, y + 31, '•  TRAINING COMING SOON', {
        fontFamily: 'Arial', fontSize: '22px', color: equipped ? '#fcd38b' : '#d4b798',
        wordWrap: { width: 750 }
      });
      if (rank) this.button(2050, y - 18, 170, 62, equipped ? 'UNEQUIP' : 'EQUIP', () => this.commit(toggleAdventurerAbility(hero.id, key)));
      if (nextRank <= MAX_ABILITY_RANK) {
        if (rank) this.button(2240, y - 18, 170, 62, 'TRAIN', () => {}, false);
        else this.button(2240, y - 18, 170, 62, 'UNLOCK', () => {
          showConfirmation(this, {
            title: `Unlock ${ability.name}`,
            description: `Spend ${cost} gold for rank ${nextRank}?\n\nRequires adventurer level ${level}. Current level: ${hero.level}. Gold available: ${GameState.gold}.`,
            onConfirm: () => this.commit(purchaseAdventurerAbility(hero.id, key))
          });
        }, hero.level >= level && GameState.gold >= cost);
      }
    });
    const rowObjects = this.children.list.slice(firstRow);
    this.abilityList = this.add.container(0, -this.abilityScroll, rowObjects);
    this.abilityScrollMax = Math.max(0, 480 + (entries.length - 1) * 132 + 62 - 990);
    this.abilityScroll = Math.min(this.abilityScroll, this.abilityScrollMax);
    this.abilityList.y = -this.abilityScroll;
    const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillRect(1535, 415, 820, 575);
    this.abilityList.setMask(maskShape.createGeometryMask());
    this.abilityMaskShape = maskShape;
    if (this.abilityScrollMax > 0) this.add.text(1945, 1002, 'SCROLL FOR MORE ABILITIES', {
      fontFamily: 'Arial', fontSize: '22px', color: '#e8c89f'
    }).setOrigin(0.5);
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
