export const PLANNED_ADVENTURER_LEVEL = 50;

// Each cost advances one level, starting at the band's first level. From level 25,
// every successive cost increases by 300 XP without resetting at bracket boundaries.
export const ADVENTURER_XP_BANDS = [
  { start: 1, cap: 5, costs: [100, 125, 150, 200] },
  { start: 5, cap: 10, costs: [250, 300, 350, 400, 450] },
  { start: 10, cap: 15, costs: [525, 600, 675, 750, 825] },
  { start: 15, cap: 20, costs: [925, 1025, 1125, 1225, 1325] },
  { start: 20, cap: 25, costs: [1525, 1725, 1925, 2125, 2325] },
  { start: 25, cap: 30, costs: [2625, 2925, 3225, 3525, 3825] },
  { start: 30, cap: 35, costs: [4125, 4425, 4725, 5025, 5325] },
  { start: 35, cap: 40, costs: [5625, 5925, 6225, 6525, 6825] },
  { start: 40, cap: 45, costs: [7125, 7425, 7725, 8025, 8325] },
  { start: 45, cap: 50, costs: [8625, 8925, 9225, 9525, 9825] }
];

export const ADVENTURER_XP_COSTS = ADVENTURER_XP_BANDS.flatMap(band => band.costs);
