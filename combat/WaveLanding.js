// Enemy feet use logical arena coordinates: larger y values are farther back.
// Each wave fills a rear arc before using lower, inner arcs on its authored floor.
import enemies from '../data/enemies.js';
import combatSpacing from '../config/combatSpacing.js';
import { arenaDistance, NEAR_DISTANCE } from '../config/combatRanges.js';

const SLOT_SPACING = 150;
const ARC_SPACING = 155;

// Use the saved combat random source so visible play and background play agree.
export function chooseWaveLandings(wave, battlefield, terrain, partyUnits, random = Math.random, reservedPoints = []) {
  const width = battlefield.logicalWidth, height = battlefield.logicalHeight;

  // filter builds a new list of active bodies, including fallen party members.
  const occupied = partyUnits.filter(unit => unit.container?.active !== false);
  const floorContains = point => !battlefield.containsArenaPoint
    || battlefield.containsArenaPoint(point.x, point.y, 16);
  const selected = [...reservedPoints];
  const landings = Array(wave.enemies.length).fill(null);

  // floor rounds down to whole slots; max keeps even a narrow arena's one center slot.
  const columns = Math.max(1, Math.floor((width - 160) / SLOT_SPACING));
  const arcs = [];

  // Sample the rear outline at each column rather than assuming a shared cave floor.
  // A small parabola lowers the wings of the arc. Jitter changes positions without
  // letting neighbors collapse into the same spot. Inner rows are 155 logical units apart.
  for (let row = 0; row < Math.ceil(height / ARC_SPACING); row++) {
    const points = [];
    for (let column = 0; column < columns; column++) {
      const fraction = (column + 0.5) / columns;
      const x = 80 + fraction * (width - 160) + (random() - 0.5) * 24;
      let rearY = height - 32;
      while (rearY > 40 && !floorContains({ x, y: rearY })) rearY -= 12;
      const curve = Math.pow(fraction * 2 - 1, 2) * height * 0.12;
      const y = rearY - 45 - curve - row * ARC_SPACING + (random() - 0.5) * 18;
      const point = { x, y };
      if (y > 40 && floorContains(point)) points.push(point);
    }

    // Fisher-Yates swaps each point with a random earlier point. It randomizes enemy
    // assignment while preserving the rear-to-inner row priority.
    for (let index = points.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [points[index], points[other]] = [points[other], points[index]];
    }
    arcs.push(points);
  }

  // Reserve bosses first, even though their visible entrance happens after the escorts.
  // Equal-HP ordinary enemies receive no center preference, which caused the old pileup.
  // map keeps original indices; sort puts bosses first using true as 1 and false as 0.
  const order = wave.enemies.map((_, index) => index)
    .sort((a, b) => Number(Boolean(enemies[wave.enemies[b].type]?.boss))
      - Number(Boolean(enemies[wave.enemies[a].type]?.boss)));
  for (const index of order) {
    const definition = enemies[wave.enemies[index].type];

    // ?. allows a missing definition; ?? supplies a default only when its value is absent.
    const radius = definition?.bodyRadius ?? 45;
    const clearance = definition?.boss ? 190 : 125;
    for (const arc of arcs) {
      const choices = arc.filter(point => !terrain?.isBlocked(point.x, point.y, combatSpacing.terrainFootRadius)
        && !terrain?.isUnitBlocked({ bodyRadius: radius }, point.x, point.y, combatSpacing.terrainFootRadius)
        && occupied.every(unit => arenaDistance(unit, point) >= NEAR_DISTANCE)
        && selected.every(other => arenaDistance(other, point) >= Math.max(clearance, other.clearance ?? 125)));
      if (!choices.length) continue;
      if (definition?.boss) choices.sort((a, b) => Math.abs(a.x - width / 2) - Math.abs(b.x - width / 2));
      const chosen = choices[0];

      // ... copies x and y into a new record, adding clearance for later reservations.
      landings[index] = { ...chosen, clearance };
      selected.push(landings[index]);
      break;
    }
  }

  // A null landing stays in the existing retry queue instead of spawning on a body.
  return landings;
}
