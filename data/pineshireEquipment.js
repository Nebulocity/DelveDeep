// Regional finds use existing equipment archetypes and presentation, with explicit
// level requirements independent of rarity. They never enter repeat-farming pools.
export function pineshireEquipment(catalog) {
  const locations = ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'old-quarry',
    'march-west-delves', 'sunken-watch', 'verge-delves', 'murmuring-abyss'];
  const accessories = [
    { id: 'PIN_BRONZE_CHARM', name: 'Bronze Trail Charm', slot: 'accessory', rarity: 'common',
      minimumLevel: 1, usableBy: ['All'], stats: { maxHp: 10 }, price: 25, sellPrice: 7,
      enchantmentSlots: 1, description: 'A small bronze pinecone carried for courage.' },
    { id: 'PIN_IRON_CHARM', name: 'Iron Trail Charm', slot: 'accessory', rarity: 'common',
      minimumLevel: 7, usableBy: ['All'], stats: { maxHp: 25, constitution: 1 }, price: 100,
      sellPrice: 30, enchantmentSlots: 1, description: 'An iron pinecone earned on harder roads.' }
  ];
  const archetypes = ['BDS01', 'BLS01', 'BSS01', 'BHA01', 'BGA01', 'BRM01', 'PST01',
    'PBR01', 'PV01', 'RMD01', 'LRO01', 'ARB01'].map(id => catalog.find(item => item.id === id));
  archetypes.push(accessories[0]);
  const places = ['Dewtrail', 'Slimeglass', 'Briarpath', 'Thornheart', 'Denkeeper',
    'Deepstone', 'Quarrylight', 'Watchwater', 'Whisperwood', 'Dawnseeker'];
  const qualities = { common: ['Wayfarer', 1], uncommon: ['Vigorous', 1.15],
    rare: ['Resonant', 1.3], epic: ['Oathbound', 1.5] };
  const finds = [];
  for (let level = 1; level <= 10; level++) {
    for (const [rarity, [quality, multiplier]] of Object.entries(qualities)) {
      for (const base of archetypes) {
        if (!base) throw new Error('Missing Pineshire equipment archetype');
        const shape = base.name.replace(/^(Bronze|Pine|Amber|Padded|Linen) /, '');
        const scale = (1 + (level - 1) * 0.16) * multiplier;
        const stats = Object.fromEntries(Object.entries(base.stats).map(([stat, value]) =>
          [stat, Math.round(value * (value > 0 ? scale : 1) * 10000) / 10000]));
        finds.push({ ...base, id: `PIN_${base.id}_${level}_${rarity}`, minimumLevel: level, itemLevel: level,
          name: `${places[level - 1]} ${quality} ${shape}`, rarity, stats, price: null,
          sellPrice: Math.max(1, Math.round((base.sellPrice ?? 7) * scale)),
          description: `A level ${level} ${rarity} find from the roads beneath Pineshire.`,
          lootRegions: ['pineshire-reach'], lootSources: ['first-clear'], lootLocations: locations });
      }
    }
  }
  return [...accessories, ...finds];
}
