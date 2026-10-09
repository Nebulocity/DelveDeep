// These compositions preserve the workbook's authored counts. The count in each pair
// belongs to that monster; stale Total cells do not trim the supplied composition.
const groups = {
  'slime-cave': [
    [['caveSlime', 3]], [['caveSlime', 5]],
    [['elderSlime', 1], ['caveSlime', 3]], [['elderSlime', 2], ['caveSlime', 1]],
    [['elderSlime', 2], ['caveSlime', 1]],
    [['slimeSovereign', 1], ['elderSlime', 2], ['caveSlime', 1]]
  ],
  'thornbriar-hollow': [
    [['ruffian', 3]], [['lasher', 2], ['ruffian', 2]],
    [['hedgeMage', 2], ['lasher', 2], ['ruffian', 2]],
    [['hedgeMage', 2], ['lasher', 2], ['ruffian', 4]],
    [['hedgeMage', 2], ['lasher', 4], ['ruffian', 4]],
    [['rongarTheCrusher', 1], ['hedgeMage', 2], ['lasher', 2], ['ruffian', 2]]
  ],
  'old-quarry': [
    [['quarryWorm', 3]], [['quarryReaver', 2], ['quarryWorm', 2]],
    [['quarryBehemoth', 2], ['quarryReaver', 2], ['quarryWorm', 2]],
    [['quarryBehemoth', 2], ['quarryReaver', 2], ['quarryWorm', 4]],
    [['quarryBehemoth', 2], ['quarryReaver', 4], ['quarryWorm', 4]],
    [['depthsSovereign', 1], ['quarryBehemoth', 2], ['quarryReaver', 2], ['quarryWorm', 2]]
  ]
};

// Positions are logical arena units. Reusing these landing positions keeps larger
// groups inside the established spawn area; combat separates their feet after landing.
export function catalogWaves(id) {
  return groups[id]?.map((group, waveIndex) => ({
    boss: waveIndex === groups[id].length - 1,
    enemies: group.flatMap(([type, count]) => Array.from({ length: count }, () => type))
      .map((type, index) => ({ type, arenaX: 350 + (index % 4) * 235,
        arenaY: 760 + Math.floor(index / 4) * 75 }))
  }));
}

// Spread the opening progression over the requested difficulty length. Reserve the
// final two slots for the authored farming composition and boss. Clone every spawn so
// one wave's mutations cannot change another wave or a later run.
export function expandCatalogWaves(waves, count) {
  const opening = waves.slice(0, -2);
  return Array.from({ length: count }, (_, index) => {
    const source = index >= count - 2 ? waves[waves.length - (count - index)]
      : opening[Math.min(opening.length - 1, Math.floor(index * opening.length / (count - 2)))];
    return { ...source, enemies: source.enemies.map(enemy => ({ ...enemy })) };
  });
}
