import enemies from '../data/enemies.js';
import combatSpacing from '../config/combatSpacing.js';

const shuffle = (items, random) => {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
};

// Select distinct, walkable grid squares while keeping every landing clear of party squares.
export function chooseWaveLandings(wave, battlefield, terrain, partyUnits, random = Math.random, reservedCells = []) {
  const occupied = partyUnits.filter(unit => unit.container?.active !== false)
    .map(unit => battlefield.arenaPointToCell(unit.arenaX, unit.arenaY));
  const cells = [];
  for (let row = 0; row < battlefield.rows; row += 1) {
    for (let column = 0; column < battlefield.columns; column += 1) {
      if (occupied.some(cell => Math.abs(cell.column - column) <= 1 && Math.abs(cell.row - row) <= 1)) continue;
      if (reservedCells.some(cell => cell.column === column && cell.row === row)) continue;
      const point = battlefield.getCellCenter(column, row);
      if (terrain?.isBlocked(point.x, point.y, combatSpacing.terrainFootRadius)) continue;
      cells.push({ column, row, x: point.x, y: point.y });
    }
  }

  const scores = wave.enemies.map(spawn => {
    const definition = enemies[spawn.type];
    return (definition?.boss ? 1000000 : 0) + (definition?.maxHp ?? 0);
  });
  const highest = Math.max(...scores);
  const selected = [];
  const available = shuffle(cells, random);
  const landings = Array(wave.enemies.length).fill(null);
  const order = wave.enemies.map((_, index) => index)
    .sort((a, b) => Number(scores[b] === highest) - Number(scores[a] === highest));

  for (const index of order) {
    const spawn = wave.enemies[index];
    const definition = enemies[spawn.type];
    const choices = available.filter(cell => !terrain?.isUnitBlocked({ bodyRadius: definition?.bodyRadius ?? 45 },
      cell.x, cell.y, combatSpacing.terrainFootRadius));
    if (choices.length === 0) continue;
    const isHighest = scores[index] === highest;
    const preferred = isHighest
      ? choices.filter(cell => cell.row >= Math.floor(battlefield.rows / 2)
        && Math.abs(cell.column + 0.5 - battlefield.columns / 2) <= battlefield.columns * 0.2)
      : choices;
    const pool = preferred.length > 0 ? preferred : choices;
    const score = cell => isHighest
      ? -Math.abs(cell.column + 0.5 - battlefield.columns / 2) - (battlefield.rows - 1 - cell.row) * 0.35
      : selected.length === 0 ? 0 : Math.min(...selected.map(other =>
        Math.hypot((cell.column - other.column) / battlefield.columns,
          (cell.row - other.row) / battlefield.rows)));
    const best = Math.max(...pool.map(score));
    const finalists = pool.filter(cell => Math.abs(score(cell) - best) < 0.001);
    const chosen = finalists[Math.floor(random() * finalists.length)];
    landings[index] = chosen;
    selected.push(chosen);
    available.splice(available.indexOf(chosen), 1);
  }
  return landings;
}
