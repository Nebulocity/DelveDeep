// Match each existing metal tier's prices, gates, drops and recipe. Splitting the
// longsword's power and Strength gives Runedancer both physical and magical bonuses.
export const RUNEBLADE_TIERS = [
  ['ARB01', 'Amber Runeblade', 'BLS01', 'amber'],
  ['FRB01', 'Fluorite Runeblade', 'ILS01', 'fluorite'],
  ['AMRB01', 'Amethyst Runeblade', 'MLS01', 'amethyst'],
  ['TRB01', 'Topaz Runeblade', 'SLS01', 'topaz']
];

export function runebladeEquipment(catalog) {
  const blades = RUNEBLADE_TIERS.map(([id, name, sourceId, gemstone]) => {
    const source = catalog.find(item => item.id === sourceId);
    return { ...source, id, name, gemstone, weaponType: 'Runeblade', usableBy: ['Runedancer'],
      stats: { ...source.stats, attackPower: source.stats.attackPower / 2,
        spellPower: source.stats.attackPower / 2, strength: source.stats.strength / 2,
        intellect: source.stats.strength / 2 },
      description: `A curved runeblade set with ${gemstone}. Its gemstone gives the dancer's floating runes their voice.` };
  });
  const rare = catalog.find(item => item.id === 'R1L01');
  blades.push({ ...rare, id: 'R1RB01', name: 'Cinder Refrain', gemstone: 'cinder', weaponType: 'Runeblade',
    usableBy: ['Runedancer'], stats: { ...rare.stats, attackPower: 16, spellPower: 16, strength: 24, intellect: 24 },
    perk: { id: 'runic_refrain', name: 'Runic Refrain', amount: 0.3 },
    description: 'The dancers of the Twilight Court practiced their sword forms until even their shadows learned the steps. Though the court lies silent, a second blade still follows every flourish.' });
  return blades;
}

// Recipes inherit actual material quantities and the equivalent tier's discovery rule.
export function runebladeRecipes(recipes) {
  return RUNEBLADE_TIERS.map(([id, name, sourceId]) => {
    const source = recipes.find(recipe => recipe.output.itemId === sourceId);
    return { ...source, id: 'R' + id, name: 'Recipe: ' + name, description: 'Craft ' + name + '.',
      output: { ...source.output, itemId: id }, ingredients: { ...source.ingredients } };
  });
}
