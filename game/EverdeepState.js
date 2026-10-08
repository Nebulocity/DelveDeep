// This restores and normalizes saved Everdeep records. Older single-expedition saves are
// migrated into the current expedition list. Keep each expedition's frozen party, claimed
// milestones and timing together so one expedition cannot take another's rewards.

export function restoreEverdeep(saved) {

  // The condition before ? chooses the first value when true and the value after : when
  // false. ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  const candidates = saved?.schemaVersion === 2 ? saved.runs
    : saved?.schemaVersion === 1 && saved.activeRun ? [saved.activeRun] : [];

  // A Set keeps each value once. has checks membership without searching a list for
  // duplicate entries.
  const ids = new Set();

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  const runs = (Array.isArray(candidates) ? candidates : []).filter(run => {

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries. map builds one output entry for each input entry, in the same
    // order. The callback's return value becomes that output entry. every requires all
    // entries to pass the check; an empty list gives true.
    if (!run || typeof run.id !== 'string' || ids.has(run.id)
      || !Array.isArray(run.party) || run.party.length !== 5
      || new Set(run.party.map(member => member?.id)).size !== 5
      || !run.party.every(member => Number.isFinite(member?.power) && Number.isFinite(member?.level))
      || !Number.isFinite(run.startedAtMs) || !Number.isFinite(run.endsAtMs)
      || !Number.isFinite(run.waveIntervalMs) || run.waveIntervalMs <= 0
      || !Number.isSafeInteger(run.resolvedWave) || run.resolvedWave < 0 || run.resolvedWave > 60
      || !Number.isSafeInteger(run.earnedChestCount) || run.earnedChestCount < 0 || run.earnedChestCount > 6
      || !Number.isSafeInteger(run.claimedChestCount) || run.claimedChestCount < 0
      || run.claimedChestCount > run.earnedChestCount) return false;

    ids.add(run.id);
    return true;
  });

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  return { schemaVersion: 2, runs, totals: {
    runsStarted: Math.max(0, Number.isSafeInteger(saved?.totals?.runsStarted) ? saved.totals.runsStarted : 0),
    chestsClaimed: Math.max(0, Number.isSafeInteger(saved?.totals?.chestsClaimed) ? saved.totals.chestsClaimed : 0)
  } };
}
