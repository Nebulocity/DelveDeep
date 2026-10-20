import GameState from './GameState.js';

import { selectedParty } from './PartySelection.js';

// Preparation always resolves current roster data from the one saved lineup.
export function worldMapParty() {
  return selectedParty();
}

export function resolveWorldMapCharacter(party = worldMapParty()) {
  // A chosen representative remains selected even after leaving the active party.
  const hero = GameState.roster.find(entry => entry.id === GameState.world.mapCharacterId) ?? party[0] ?? null;
  GameState.world.mapCharacterId = hero?.id ?? null;
  return hero;
}

export function selectWorldMapCharacter(id, party = worldMapParty()) {
  const hero = party.find(entry => entry.id === id);
  if (!hero || GameState.world.mapCharacterId === id) return null;
  GameState.world.mapCharacterId = id;
  return hero;
}
