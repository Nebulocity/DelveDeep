import GameState from './GameState.js';
import { grantMaterial } from './Equipment.js';
import { grantAdventurerXp } from './AdventurerProgression.js';
import { saveProfile } from './GameStorage.js';

export const WAVE_REWARDS = {
  Easy: { gold: 12, goldStep: 3, xp: 8, materialCount: 1 },
  Difficult: { gold: 20, goldStep: 4, xp: 12, materialCount: 1 },
  Tough: { gold: 30, goldStep: 5, xp: 17, materialCount: 2 },
  'Very Tough': { gold: 42, goldStep: 6, xp: 23, materialCount: 2 },
  'Incredibly Tough': { gold: 56, goldStep: 7, xp: 30, materialCount: 3 },
  Impossible: { gold: 72, goldStep: 8, xp: 38, materialCount: 3 }
};

const MATERIAL_IDS = ['iron', 'leather', 'cloth', 'herb', 'essence'];

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

export function awardOrdinaryWave(delve, waveIndex, bossIndex, farming = false) {
  if (!isOrdinaryDelve(delve) || !Number.isSafeInteger(waveIndex)
    || waveIndex < 0 || waveIndex >= bossIndex
    || (farming && (waveIndex !== bossIndex - 1 || !getDelveCheckpoint(delve, bossIndex).campUnlocked))) return null;
  const checkpoint = getDelveCheckpoint(delve, bossIndex);
  if (!farming && waveIndex !== checkpoint.nextWave) return null;
  const values = WAVE_REWARDS[delve.difficulty] ?? WAVE_REWARDS.Easy;
  const gold = values.gold + values.goldStep * waveIndex;
  const xp = farming ? Math.max(1, Math.floor(values.xp / 2)) : values.xp;
  const materialId = MATERIAL_IDS[(delve.id.length + waveIndex) % MATERIAL_IDS.length];
  GameState.gold += gold;
  grantMaterial(materialId, values.materialCount);
  const partyIds = new Set(GameState.activeParty.map((hero) => hero.id));
  GameState.roster.filter((hero) => partyIds.has(hero.id)).forEach((hero) => grantAdventurerXp(hero, xp));
  if (!farming) GameState.delveCheckpoints[delve.id] = {
    nextWave: waveIndex + 1,
    campUnlocked: waveIndex + 1 >= bossIndex
  };
  saveProfile();
  return { gold, xp, materialId, materialCount: values.materialCount, farming };
}
