// Dawnwarden Assault art is cosmetic and uses the existing replacement ability IDs.

const prefix = 'ability_v2_dawnwarden_';
const fadeMs = 400;

const sheets = [
  { name: 'solar-strike', abilityName: 'Solar Strike', abilityId: prefix + 'solar_strike',
    width: 49, height: 41, fps: 16, x: -24, y: -22, groundWidth: 49, opacity: 0.9 },
  { name: 'dawnburst', abilityName: 'Dawnburst', abilityId: prefix + 'dawnburst',
    width: 170, height: 77, fps: 14, x: -85, y: -42, groundWidth: 170, opacity: 0.82 },
  { name: 'purifying-flame', abilityName: 'Purifying Flame', abilityId: prefix + 'purifying_flame',
    width: 45, height: 52, fps: 16, x: -22, y: -34, groundWidth: 45, opacity: 0.9 },
  { name: 'light-reprisal', abilityName: "Light's Reprisal", abilityId: prefix + 'light_s_reprisal',
    width: 128, height: 117, fps: 14, x: -64, y: -90, groundWidth: 128, opacity: 0.82 }
];

export const DAWNWARDEN_ASSAULT_EFFECTS = sheets.map(sheet => ({
  ...sheet,
  id: sheet.name,
  className: 'Dawnwarden',
  frames: 32,
  frameMs: 1000 / sheet.fps,
  holdMs: 32 * 1000 / sheet.fps - fadeMs,
  fadeMs,
  followTarget: sheet.abilityName === 'Solar Strike' || sheet.abilityName === 'Purifying Flame',
  coverUnits: sheet.abilityName === 'Dawnburst' || sheet.abilityName === "Light's Reprisal",
  clips: [{ name: 'whole', key: 'dawnwarden-assault-' + sheet.name,
    width: sheet.width, height: sheet.height, frames: 32, start: 0,
    x: sheet.x, y: sheet.y, depth: 'front', loop: false,
    url: new URL(`../assets/effects/dawnwarden-assault/${sheet.name}.png`, import.meta.url).href }]
}));
