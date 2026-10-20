import { PARTY_LEADER_TAP as tuning } from '../config/partyLeaderTap.js';

export function partyLeaderTapPower(leader, partyUnits, roster) {

  // Membership comes from this encounter, never the bench. Fallen members remain in
  // the active lineup; wave XP may have raised their saved level since battle entry.
  const partyLevels = partyUnits.filter(unit => !unit.isEnemy && !unit.isDecoy)
    .reduce((sum, unit) => sum + (roster.find(hero => hero.id === unit.id)?.level ?? unit.level ?? 1), 0);
  return Math.round((tuning.basePower + tuning.powerPerRenownLevel * (leader?.level ?? 1))
    * (1 + tuning.powerPerPartyLevel * partyLevels));
}
