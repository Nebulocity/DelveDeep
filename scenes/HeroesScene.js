import TownFeatureScene, { featurePanel, featureBody } from '../ui/TownFeatureUI.js';
import { characterSelector, selectedCharacter } from '../ui/CharacterSelection.js';
import { serviceText, serviceButton } from '../ui/TownServiceTheme.js';
import { hallPortrait } from '../ui/HallUI.js';
import { getEquippedAdventurer } from '../game/Equipment.js';
import { happinessLabel, xpRequired } from '../game/AdventurerProgression.js';
import { MAX_CHARACTER_LEVEL } from '../config/renown.js';
import { CLASS_DESCRIPTIONS } from '../data/classDescriptions.js';
import { STAT_DESCRIPTIONS } from '../data/statDescriptions.js';
import { showSelectionDetails } from '../ui/SelectionDetails.js';

const number = value => Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
const percent = value => `${number((value ?? 0) * 100)}%`;

export default class HeroesScene extends TownFeatureScene {
  constructor() { super('HeroesScene', true); }

  render() {
    const bounds = this.frame('Heroes', 'heroes', { hint: 'Select an adventurer to view progression and current statistics.' });
    characterSelector(this, { ...bounds, width: 440 }, () => { this.statsOffset = 0; this.render(); });
    const hero = selectedCharacter();
    if (!hero) return;
    const identity = { x: 520, y: bounds.y, width: 540, height: bounds.height };
    const detail = { x: 1088, y: bounds.y, width: bounds.width - 1036, height: bounds.height };
    featurePanel(this, identity);
    featurePanel(this, detail);
    serviceText(this, 790, bounds.y + 50, hero.name, 'heading48', { align: 'center', wordWrap: { width: 430 } }).setOrigin(0.5);
    hallPortrait(this, hero, 790, bounds.y + 220, 260);
    serviceText(this, 790, bounds.y + 402, `${hero.className}\n${hero.role}`, 'body34', {
      align: 'center', wordWrap: { width: 430 }
    }).setOrigin(0.5);
    const progress = hero.level >= MAX_CHARACTER_LEVEL ? 'Maximum character level' : `${hero.xp ?? 0} / ${xpRequired(hero.level)} XP`;
    serviceText(this, 790, bounds.y + 505, `Level ${hero.level}\n${progress}`, 'body36', { align: 'center' }).setOrigin(0.5);
    serviceText(this, 790, bounds.y + 599, `${happinessLabel(hero.happiness ?? 70)}\n${hero.happiness ?? 70}% happiness`, 'body32', { align: 'center' }).setOrigin(0.5);
    serviceButton(this, 790, bounds.y + bounds.height - 70, 430, 84, 'About this class', () => {
      showSelectionDetails(this, { title: hero.className, className: hero.className, description: CLASS_DESCRIPTIONS[hero.className] });
    });
    const stats = getEquippedAdventurer(hero);
    serviceText(this, detail.x + 38, detail.y + 32, 'Character Statistics', 'heading40');
    const values = [
      ['Progress', `Level ${hero.level} · Delves cleared ${hero.delvesCompleted ?? 0}`],
      ['Resources', `Health ${number(stats.maxHp)} · Mana ${number(stats.maxMana)}`],
      ['Attributes', `Strength ${number(stats.strength)}\nAgility ${number(stats.agility)}\nConstitution ${number(stats.constitution)}\nIntellect ${number(stats.intellect)}\nWisdom ${number(stats.wisdom)}`],
      ['Defense', `Armor ${number(stats.armor)}\nDodge ${percent(stats.dodge)} · Block ${percent(stats.block)}`],
      ['Offense', `Attack Power ${number(stats.attackPower)}\nSpell Power ${number(stats.spellPower ?? Math.max(stats.spellDamage ?? 0, stats.spellHealing ?? 0))}\nSpeed ${number(stats.speed ?? 100)}\nHit Chance ${percent(stats.hitChance)}\nCrit Chance ${percent(stats.critChance)} · Crit Multiplier ${number(stats.critMultiplier)}x`]
    ];
    featureBody(this, { x: detail.x + 40, y: detail.y + 106, width: detail.width - 106, height: detail.height - 240 },
      values.map(([title, value]) => `${title}\n${value}`).join('\n\n'), this.statsOffset ?? 0, value => { this.statsOffset = value; });
    serviceButton(this, detail.x + detail.width / 2, detail.y + detail.height - 70, detail.width - 100, 84, 'Explain character stats', () => {
      showSelectionDetails(this, { title: 'Character stats', description: Object.entries(STAT_DESCRIPTIONS).map(([name, text]) => `${name}\n${text}`).join('\n\n') });
    });
  }
}
