// Run with Node to check held character details after real wave XP rewards.
// Load the UI helper without Phaser so this check needs no browser or display.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import GameState from '../game/GameState.js';
import { awardOrdinaryWave } from '../game/DelveCheckpoints.js';
import { xpRequired } from '../game/AdventurerProgression.js';
import { getDelveById } from '../data/delves.js';

globalThis.localStorage = { getItem: () => null, setItem() {} };
const context = { GameState, abilitySummary: () => 'Equipped skill details' };
const source = readFileSync(new URL('../ui/SelectionDetails.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '');
vm.runInNewContext(`${source}\nglobalThis.characterDetails = characterDetails;`, context);
const details = context.characterDetails;
const delve = getDelveById('slime-cave');

// Ordinary clears and farm clears both raise the roster level. The encounter's
// starting stats and resources stay on the live unit, even in an old saved snapshot.
for (const farming of [false, true]) {
  const hero = { id: 'hero', name: 'Hero', level: 2, xp: xpRequired(2) - 1,
    maxHp: 100, attackPower: 10, happiness: 70 };
  GameState.roster = [hero];
  GameState.activeParty = [{ ...hero }];
  GameState.world.clearedDelves = [];
  GameState.delveCheckpoints = farming ? { [delve.id]: { nextWave: 5, campUnlocked: true } } : {};
  const unit = { ...hero, className: 'Cleric', role: 'Healer', alive: true,
    hp: 37, maxMana: 80, mana: 21, abilities: { heal: {} } };
  assert.match(details(unit).description, /Level 2/);
  awardOrdinaryWave(delve, farming ? 4 : 0, 5, farming, [unit], () => 0);
  assert.equal(hero.level, 3);
  assert.equal(unit.level, 2);
  assert.match(details(unit).description, /Level 3\nHP: 37\/100 \| Mana: 21\/80/);
  assert.match(details(unit).description, /Equipped skill details/);

  // Reopening details reads later progression rather than caching the first result.
  hero.level = 5;
  assert.match(details(unit).description, /Level 5/);
  assert.match(details({ ...unit, id: 'missing' }).description, /Level 2/);

  // Monster levels come from their authored combat data, even if an ID matches.
  assert.match(details({ ...unit, isEnemy: true, level: 7 }).description, /Level: 7/);
}
console.log('Battle summaries show current roster levels after ordinary and farm rewards.');
