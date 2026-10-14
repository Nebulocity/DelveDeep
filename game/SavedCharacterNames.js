// Refresh saved display names from the current roster without changing IDs, stats,
// equipment or timing. Frozen expeditions and battles keep all their gameplay data.
export function refreshSavedCharacterNames(state) {
  const currentNames = new Map(state.roster.map(hero => [hero.id, hero.name]));
  const replacements = new Map();

  // Remember old labels before changing them so saved target labels and log entries
  // still refer to the same adventurers after a battle resumes.
  const renameMember = member => {
    const name = currentNames.get(member.id);
    if (!name) return;
    if (member.name && member.name !== name) replacements.set(member.name, name);
    member.name = name;
  };

  for (const run of state.everdeep.runs) run.party.forEach(renameMember);
  const battle = state.activeBattle;
  if (!battle) return;
  battle.partyTemplates.forEach(renameMember);
  battle.party.forEach(renameMember);

  // Decoys belong to an adventurer but have their own ID and saved health/timers.
  for (const decoy of battle.decoys ?? []) {
    const ownerName = currentNames.get(decoy.decoyOwnerId);
    if (!ownerName) continue;
    const name = `${ownerName}'s Image`;
    if (decoy.name && decoy.name !== name) replacements.set(decoy.name, name);
    decoy.name = name;
  }

  // Longest labels come first so a full decoy label wins over its owner's name.
  // Escape regex punctuation in saved labels and match whole names, not substrings.
  const labels = [...replacements.keys()].sort((a, b) => b.length - a.length);
  if (!labels.length) return;
  const pattern = new RegExp(`\\b(?:${labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g');
  const renameText = text => typeof text === 'string'
    ? text.replace(pattern, label => replacements.get(label)) : text;

  for (const unit of [...battle.party, ...battle.enemies, ...(battle.decoys ?? [])]) {
    unit.targetName = renameText(unit.targetName);
  }

  // These are presentation fields only. Event IDs, amounts and timestamps stay intact
  // so the resumed summary can combine past and new events under the current names.
  for (const member of battle.log.party ?? []) member.name = renameText(member.name);
  for (const entry of [...battle.log.entries, ...(battle.log.casualties ?? [])]) {
    for (const field of ['actor', 'target', 'message']) entry[field] = renameText(entry[field]);
  }
}
