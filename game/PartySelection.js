import GameState from './GameState.js';
import { everdeepUnavailableIds } from './Everdeep.js';

export const MAX_PARTY_SIZE = 5;
export const ROLE_LIMITS = { Tank: 1, Healer: 2, DPS: 4 };
export const partyRoleGroup = role => role === 'Tank' || role === 'Healer' ? role : 'DPS';

// Saved IDs are the preparation lineup; combat templates remain expedition-local.
export function selectedParty() {
  return GameState.lastPartyIds.map(id => GameState.roster.find(hero => hero.id === id)).filter(Boolean);
}

export function partyCounts(party) {
  return party.reduce((counts, hero) => {
    counts[partyRoleGroup(hero.role)] += 1;
    counts.total += 1;
    return counts;
  }, { Tank: 0, Healer: 0, DPS: 0, total: 0 });
}

export function partyDepartureProblem(party = selectedParty()) {
  if (GameState.activeBattle) return 'An expedition is already in progress. Return to your active battle.';
  if (GameState.tutorial.status === 'pending'
    || GameState.tutorial.status === 'active' && (!GameState.recruitedIds.includes('garrick')
      || !party.some(hero => hero.id === 'garrick'))) {
    return 'Visit the Tavern to recruit Garrick and add him to your party, or skip the tutorial to receive him for free.';
  }
  if (party.some(hero => !GameState.recruitedIds.includes(hero.id))) return 'Recruit every selected adventurer at the Tavern first.';
  if (party.length !== MAX_PARTY_SIZE) return 'Choose exactly five adventurers to enter this Delve.';
  if (new Set(party.map(hero => hero.id)).size !== party.length) return 'Choose five different adventurers.';
  const counts = partyCounts(party);
  if (Object.entries(ROLE_LIMITS).some(([role, limit]) => counts[role] > limit)) {
    return 'Party limits: one Tank, two Healers, and four DPS.';
  }
  const unavailable = everdeepUnavailableIds();
  if (party.some(hero => unavailable.has(hero.id))) return 'A selected adventurer is in The Everdeep. Change Party or bring them home first.';
  return '';
}

export function partyCompositionWarning(party = selectedParty()) {
  const counts = partyCounts(party);
  const missing = [!counts.Tank && 'Tank', !counts.Healer && 'Healer'].filter(Boolean);
  return missing.length ? `No ${missing.join(' or ')} selected. One Tank, one Healer and three DPS are recommended.` : '';
}
