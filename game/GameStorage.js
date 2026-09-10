import GameState from './GameState.js';

const STORAGE_KEY = 'delveDeep.profile.v2';

export function loadProfile(baseRoster) {
  let saved = null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    saved = raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Could not load Delve Deep profile.', error);
  }

  const savedRoster = new Map((saved?.roster ?? []).map((entry) => [entry.id, entry]));

  GameState.gold = Number.isFinite(saved?.gold) ? saved.gold : 0;
  GameState.inventory = {
    healingTonic: Math.max(0, saved?.inventory?.healingTonic ?? 0)
  };
  GameState.records = saved?.records ?? {};

  GameState.roster = baseRoster.map((base) => {
    const prior = savedRoster.get(base.id) ?? {};
    return {
      ...base,
      level: Math.max(1, prior.level ?? base.level ?? 1),
      xp: Math.max(0, prior.xp ?? 0),
      happiness: Math.min(100, Math.max(0, prior.happiness ?? 70)),
      delvesCompleted: Math.max(0, prior.delvesCompleted ?? 0),
      maxHp: prior.maxHp ?? base.maxHp,
      attackPower: prior.attackPower ?? base.attackPower,
      healPower: prior.healPower ?? base.healPower
    };
  });
}

export function saveProfile() {
  const profile = {
    gold: GameState.gold,
    inventory: GameState.inventory,
    records: GameState.records,
    roster: GameState.roster.map((adventurer) => ({
      id: adventurer.id,
      level: adventurer.level,
      xp: adventurer.xp ?? 0,
      happiness: adventurer.happiness ?? 70,
      delvesCompleted: adventurer.delvesCompleted ?? 0,
      maxHp: adventurer.maxHp,
      attackPower: adventurer.attackPower,
      healPower: adventurer.healPower
    }))
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn('Could not save Delve Deep profile.', error);
  }
}
