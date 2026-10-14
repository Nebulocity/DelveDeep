// Old character IDs appear in saves as roster entries, targets, Map keys, timer owners
// and texture names. Keep their spellings only here so the live game uses the new IDs.
const characterAliases = [
  { id: 'garrick', name: 'Garrick', ids: ['caramon-gladiator', 'caramon'], names: ['Caramon'] },
  { id: 'aldren', name: 'Aldren', ids: ['sturm'], names: ['Sturm'] },
  { id: 'elyra', name: 'Elyra', ids: ['laurana'], names: ['Laurana'] },
  { id: 'malrec', name: 'Malrec', ids: ['fistandantilus', 'aoth'], names: ['Fistandantilus', 'Aoth'] },
  { id: 'selenne', name: 'Selenne', ids: ['mishakal', 'solenne'], names: ['Mishakal', 'Solenne'] },
  { id: 'sylva', name: 'Sylva', ids: ['goldmoon'], names: ['Goldmoon'] },
  { id: 'durgrim', name: 'Durgrim', ids: ['flint', 'brogan'], names: ['Flint', 'Brogan'] },
  { id: 'chaska', name: 'Chaska', ids: ['riverwind', 'torren'], names: ['Riverwind', 'Torren'] },
  { id: 'zahra', name: 'Zahra', ids: ['tika', 'mara'], names: ['Tika', 'Mara'] },
  { id: 'yasmin', name: 'Yasmin', ids: ['tasslehoff', 'pip'], names: ['Tasslehoff', 'Pip'] },
  { id: 'zareth', name: 'Zareth', ids: ['dalamar', 'corven'], names: ['Dalamar', 'Corven'] },
  { id: 'nadira', name: 'Nadira', ids: ['palin', 'oren'], names: ['Palin', 'Oren'] },
  { id: 'valtheris', name: 'Valtheris', ids: ['raistlin', 'veyrin'], names: ['Raistlin', 'Veyrin'] },
  { id: 'orwen', name: 'Orwen', ids: ['tanis', 'rowan'], names: ['Tanis', 'Rowan'] }
];

// A Map pairs each former spelling with its current value. Longest matches come first
// so an old compound ID is replaced as a whole rather than losing only its first part.
const replacements = new Map();
for (const character of characterAliases) {
  for (const id of character.ids) replacements.set(id, character.id);
  for (const name of character.names) replacements.set(name, character.name);
}
const labels = [...replacements.keys()].sort((a, b) => b.length - a.length);
const pattern = new RegExp(`\\b(?:${labels.join('|')})\\b`, 'g');

// Match whole labels in text and texture keys, including names inside paths. The word
// boundaries keep unrelated words such as pipeline from matching a short former name.
function migrateLabel(label) {
  return label.replace(pattern, match => replacements.get(match));
}

// Work on plain JSON before BattleSnapshot unpacks its tagged Maps and Sets. Recursing
// through every nested key and value keeps threat, movement, status ownership, pending
// casts and frozen expeditions attached to the right hero. Numbers and timing stay as-is.
// This returns a new tree, leaving the stored backup available for recovery unchanged.
export function migrateCharacterIdentities(value) {
  if (typeof value === 'string') return migrateLabel(value);
  if (Array.isArray(value)) return value.map(migrateCharacterIdentities);
  if (!value || typeof value !== 'object') return value;

  // Object.fromEntries builds own properties safely, including any unusual JSON keys.
  // Only character spellings change; field names and the save schema remain the same.
  return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [migrateLabel(key), migrateCharacterIdentities(item)]));
}
