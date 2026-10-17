import GameState from './GameState.js';

// Between delves activeParty is cleared, while lastPartyIds retains the chosen party.
export function worldMapParty() {
  if (GameState.activeParty.length) return GameState.activeParty;
  return GameState.lastPartyIds.map(id => GameState.roster.find(hero => hero.id === id)).filter(Boolean);
}

export function resolveWorldMapCharacter(party = worldMapParty()) {
  const hero = party.find(entry => entry.id === GameState.world.mapCharacterId) ?? party[0] ?? null;
  GameState.world.mapCharacterId = hero?.id ?? null;
  return hero;
}

export function selectWorldMapCharacter(id, party = worldMapParty()) {
  const hero = party.find(entry => entry.id === id);
  if (!hero || GameState.world.mapCharacterId === id) return null;
  GameState.world.mapCharacterId = id;
  return hero;
}
