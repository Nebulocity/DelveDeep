import { delveMaterialIds } from './DelveDrops.js';
import GameState from './GameState.js';
import { grantMaterial } from './Equipment.js';
import { grantAdventurerXp, adjustHappiness } from './AdventurerProgression.js';
import { saveProfile } from './GameStorage.js';

export const WAVE_REWARDS = {
  Easy: { gold: 12, goldStep: 3, xp: 8, materialCount: 1 },
  Difficult: { gold: 20, goldStep: 4, xp: 12, materialCount: 1 },
  Tough: { gold: 30, goldStep: 5, xp: 17, materialCount: 2 },
  'Very Tough': { gold: 42, goldStep: 6, xp: 23, materialCount: 2 },
  'Incredibly Tough': { gold: 56, goldStep: 7, xp: 30, materialCount: 3 },
  Impossible: { gold: 72, goldStep: 8, xp: 38, materialCount: 3 }
};

export const FARM_REWARDS = {
  Easy: { gold: 1, xp: 1, happiness: 1, materialCount: 1 },
  Difficult: { gold: 2, xp: 2, happiness: 2, materialCount: 2 },
  Tough: { gold: 3, xp: 3, happiness: 3, materialCount: 2 },
  'Very Tough': { gold: 4, xp: 4, happiness: 4, materialCount: 3 },
  'Incredibly Tough': { gold: 5, xp: 5, happiness: 5, materialCount: 3 },
  Impossible: { gold: 6, xp: 6, happiness: 6, materialCount: 3 }
};


export function isOrdinaryDelve(delve = GameState.currentDelve) {
  return delve?.type === 'delve';
}

export function getDelveCheckpoint(delve = GameState.currentDelve, bossIndex = (delve?.rooms ?? 1) - 1) {
  if (!isOrdinaryDelve(delve)) return null;
  const saved = GameState.delveCheckpoints?.[delve.id];
  const legacyClear = GameState.world.clearedDelves.includes(delve.id);
  const nextWave = Math.min(bossIndex, Math.max(0, saved?.nextWave ?? (legacyClear ? bossIndex : 0)));
  return { nextWave, campUnlocked: saved?.campUnlocked === true || legacyClear || nextWave >= bossIndex };
}

export function awardOrdinaryWave(delve, waveIndex, bossIndex, farming = false, partyUnits = [], random = Math.random) {
  if (!isOrdinaryDelve(delve) || !Number.isSafeInteger(waveIndex)
    || waveIndex < 0 || waveIndex >= bossIndex
    || (farming && (waveIndex !== bossIndex - 1 || !getDelveCheckpoint(delve, bossIndex).campUnlocked))) return null;
  const checkpoint = getDelveCheckpoint(delve, bossIndex);
  if (!farming && waveIndex !== checkpoint.nextWave) return null;
  const table = farming ? FARM_REWARDS : WAVE_REWARDS;
  const values = table[delve.difficulty] ?? table.Easy;
  const gold = farming ? values.gold : values.gold + values.goldStep * waveIndex;
  const xp = values.xp;
  const pool = delveMaterialIds(delve);
  const materials = {};
  for (let index = 0; index < values.materialCount && pool.length; index += 1) {
    const id = pool[farming ? Math.floor(random() * pool.length) : (delve.id.length + waveIndex) % pool.length];
    materials[id] = (materials[id] ?? 0) + 1;
  }
  GameState.gold += gold;
  Object.entries(materials).forEach(([id, count]) => grantMaterial(id, count));
  const partyIds = new Set((farming ? partyUnits.filter(unit => unit.alive) : GameState.activeParty).map(hero => hero.id));
  const xpByHero = {};
  GameState.roster.filter(hero => partyIds.has(hero.id)).forEach(hero => {
    grantAdventurerXp(hero, xp);
    xpByHero[hero.id] = xp;
    if (farming) {
      adjustHappiness(hero, values.happiness);
      const unit = partyUnits.find(member => member.id === hero.id);
      if (unit) unit.happiness = hero.happiness;
    }
  });
  if (!farming) GameState.delveCheckpoints[delve.id] = {
    nextWave: waveIndex + 1,
    campUnlocked: waveIndex + 1 >= bossIndex
  };
  saveProfile();
  const materialId = Object.keys(materials)[0];
  return { gold, xp, xpByHero, happiness: values.happiness ?? 0, materials,
    materialId, materialCount: materials[materialId] ?? 0, farming };
}
