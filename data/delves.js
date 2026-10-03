import { createEncounterWaves } from './encounters.js';

import slimeCave from './levels/SlimeCave.js';
import thornbriarHollow from './levels/ThornbriarHollow.js';
import dolmarkDen from './levels/DolmarkDen.js';
import murmuringAbyss from './levels/MurmuringAbyss.js';
import vibrantTear from './levels/VibrantTear.js';

const delves = [
  slimeCave,
  thornbriarHollow,
  dolmarkDen,
  murmuringAbyss,
  vibrantTear
];

// This function looks up a delve definition by its persistent identifier.
export function getDelveById(id) {

  return delves.find((delve) => delve.id === id) ?? null;
}

// Keep overview wave counts aligned with the actual encounter builder.
for (const delve of delves) {
  delve.rooms = createEncounterWaves(delve).length;
}

export default delves;
