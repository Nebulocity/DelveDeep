import enemies from '../data/enemies.js';
import combatSpacing from '../config/combatSpacing.js';
import { arenaDistance, NEAR_DISTANCE } from '../config/combatRanges.js';

// Continuous landing candidates respect the floor outline and living or fallen bodies.
export function chooseWaveLandings(wave, battlefield, terrain, partyUnits, random = Math.random, reservedPoints = []) {
  const width = battlefield.logicalWidth, height = battlefield.logicalHeight;
  const occupied = partyUnits.filter(unit => unit.container?.active !== false);
  const candidates = Array.from({ length: 800 }, () => ({
    x: 40 + random() * (width - 80), y: 40 + random() * (height - 80)
  })).filter(point => (!battlefield.containsArenaPoint || battlefield.containsArenaPoint(point.x, point.y, 16))
    && !terrain?.isBlocked(point.x, point.y, combatSpacing.terrainFootRadius)
    && occupied.every(unit => arenaDistance(unit, point) >= NEAR_DISTANCE)
    && reservedPoints.every(other => arenaDistance(other, point) >= 110));
  const scores = wave.enemies.map(spawn => {
    const definition = enemies[spawn.type];
    return (definition?.boss ? 1000000 : 0) + (definition?.maxHp ?? 0);
  });
  const highest = Math.max(...scores);
  const selected = [];
  const landings = Array(wave.enemies.length).fill(null);
  const order = wave.enemies.map((_, index) => index)
    .sort((a, b) => Number(scores[b] === highest) - Number(scores[a] === highest));
  for (const index of order) {
    const definition = enemies[wave.enemies[index].type];
    const choices = candidates.filter(point => selected.every(other => arenaDistance(point, other) >= 110)
      && !terrain?.isUnitBlocked({ bodyRadius: definition?.bodyRadius ?? 45 },
        point.x, point.y, combatSpacing.terrainFootRadius));
    if (!choices.length) continue;
    const strongest = scores[index] === highest;
    const preferred = strongest ? choices.filter(p => p.y >= height * 0.55
      && Math.abs(p.x - width / 2) <= width * 0.2) : choices;
    const pool = preferred.length ? preferred : choices;
    const score = point => strongest
      ? -Math.abs(point.x - width / 2) - Math.abs(point.y - height * 0.75) * 0.35
      : selected.length ? Math.min(...selected.map(other => arenaDistance(point, other))) : random();
    const ranked = pool.map(point => ({ point, score: score(point) })).sort((a, b) => b.score - a.score);
    const chosen = ranked[0].point;
    landings[index] = chosen;
    selected.push(chosen);
  }
  return landings;
}
