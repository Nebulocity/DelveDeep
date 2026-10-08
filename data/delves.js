// Delve IDs connect the world map, entry screens, encounter templates and saved
// checkpoints. The difficulty selects reward tables. Keep the saved identity separate from
// a template ID when multiple world destinations reuse one battlefield.

import { createEncounterWaves } from './encounters.js';

import slimeCave from './levels/SlimeCave.js';
import thornbriarHollow from './levels/ThornbriarHollow.js';
import dolmarkDen from './levels/DolmarkDen.js';
import murmuringAbyss from './levels/MurmuringAbyss.js';
import verdantTear from './levels/VerdantTear.js';

const delves = [
  slimeCave,
  thornbriarHollow,
  dolmarkDen,
  murmuringAbyss,
  verdantTear
];

// This helper looks up a delve definition by its persistent identifier.
export function getDelveById(id) {

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  return delves.find((delve) => delve.id === id) ?? null;
}

// Keep overview wave counts aligned with the actual encounter builder.
for (const delve of delves) {
  delve.rooms = createEncounterWaves(delve).length;
}

export default delves;
