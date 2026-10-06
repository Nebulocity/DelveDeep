export function restoreEverdeep(saved) {
  const candidates = saved?.schemaVersion === 2 ? saved.runs
    : saved?.schemaVersion === 1 && saved.activeRun ? [saved.activeRun] : [];
  const ids = new Set();
  const runs = (Array.isArray(candidates) ? candidates : []).filter(run => {
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
  return { schemaVersion: 2, runs, totals: {
    runsStarted: Math.max(0, Number.isSafeInteger(saved?.totals?.runsStarted) ? saved.totals.runsStarted : 0),
    chestsClaimed: Math.max(0, Number.isSafeInteger(saved?.totals?.chestsClaimed) ? saved.totals.chestsClaimed : 0)
  } };
}
