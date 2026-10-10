// Older snapshots have no encounterWaveCount. Keep their earned camp and boss entries
// when a difficulty change extends a Delve; existing unit stats and IDs stay untouched.
export function migrateEncounterSnapshot(snapshot, delve, bossIndex, checkpoint) {
  if (!snapshot || snapshot.encounterWaveCount === delve.rooms) return snapshot;
  const entry = snapshot.run?.entry;
  const oldIndex = snapshot.scene.currentWaveIndex;

  // ?. permits an absent camp list; .at(-1) reads the last reached camp. ?? falls
  // back to the ordinary final pre-boss camp when this Delve has no custom camp list.
  const index = entry === 'boss' ? bossIndex : entry === 'farm' && checkpoint?.campUnlocked
    ? (delve.campWaves?.filter(wave => wave <= checkpoint.nextWave).at(-1) ?? bossIndex) - 1
    : oldIndex;
  if (index === oldIndex) return snapshot;

  // Only countdown and landing batches refer to the wave index. Attack events refer
  // to stable unit IDs instead. Copy these records so the original snapshot stays valid.
  return { ...snapshot, encounterWaveCount: delve.rooms,
    scene: { ...snapshot.scene, currentWaveIndex: index },
    events: snapshot.events.map(event => event.data?.index === oldIndex
      ? { ...event, data: { ...event.data, index } } : event) };
}

// Abyss formerly paid at portal completion, with no wave checkpoint. Resume its already
// reached wave without replaying earlier fights or granting rewards retroactively.
export function legacyPortalCheckpoint(snapshot, delve, bossIndex) {
  if (!delve.campWaves?.length || snapshot.encounterWaveCount !== undefined) return null;
  const completed = snapshot.scene.currentWaveIndex + (snapshot.scene.waveRetreating ? 1 : 0);
  const nextWave = Math.min(bossIndex, Math.max(0, completed));
  return { nextWave, campUnlocked: delve.campWaves.some(wave => wave <= nextWave) };
}
