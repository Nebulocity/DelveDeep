// Early-delving gear uses fixed budgets, not character-level scaling. Attribute bonuses
// matter: Strength grants 8 Attack Power, Intellect/Wisdom grant 8 Spell Power, and
// Constitution grants 10 Health and Armor. Epic budgets stay below level-15 story gear.
const tanks = ['Gladiator', 'Oathwarden', 'Dawnwarden'];
const physical = ['Barmaid', 'Scoundrel', 'Barbarian', 'Ranger'];
const magical = ['Runedancer', 'Umbramancer', 'Spellbinder', 'Arcanist'];
const healers = ['Dawnpriest', 'Grovekeeper', 'Sanguinist'];
const all = [...tanks, ...physical, ...magical, ...healers];
const light = [...physical, 'Runedancer'];
const casters = ['Umbramancer', 'Spellbinder', 'Arcanist'];
const cloth = [...casters, ...healers];

// Class order also defines the order of the explicitly named rows below.
export const EARLY_GEAR_CLASSES = [...all];
const profiles = {
  Gladiator: ['tank', 'strength'], Oathwarden: ['tank', 'strength'],
  Dawnwarden: ['tank', 'wisdom'], Barmaid: ['light', 'strength'],
  Scoundrel: ['light', 'agility'], Barbarian: ['light', 'strength'],
  Ranger: ['light', 'agility'], Runedancer: ['hybrid', 'strength'],
  Umbramancer: ['caster', 'intellect'], Spellbinder: ['caster', 'intellect'],
  Arcanist: ['caster', 'intellect'], Dawnpriest: ['healer', 'wisdom'],
  Grovekeeper: ['healer', 'wisdom'], Sanguinist: ['healer', 'wisdom']
};
const tiers = {
  common: { primary: 3, power: 5, hp: 22, armor: 18, con: 1, mana: 30, price: 75 },
  uncommon: { primary: 6, power: 8, hp: 42, armor: 35, con: 2, mana: 45, price: 240 },
  rare: { primary: 9, power: 12, hp: 62, armor: 52, con: 3, mana: 65, price: 620 },
  story: { primary: 8, power: 10, hp: 58, armor: 48, con: 3, mana: 60, price: 800 },
  epic: { primary: 12, power: 18, hp: 90, armor: 75, con: 5, mana: 90, price: 1800 }
};
const chance = { common: 0.0025, uncommon: 0.005, rare: 0.0075, story: 0.0075, epic: 0.01 };
const slug = name => name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Variants exchange offense for survival rather than adding a free second stat budget.
function statsFor(className, slot, tier, variant = 0) {
  const [role, attribute] = profiles[className];
  const b = tiers[tier];
  const stats = {};
  if (slot === 'weapon') {
    if (role === 'hybrid') {
      stats.attackPower = b.power / 2;
      stats.spellPower = b.power / 2;
      stats.strength = b.primary / 2;
      stats.intellect = b.primary / 2;
    } else if (role === 'caster' || role === 'healer') {
      stats.spellPower = b.power + 5;
      stats[attribute] = b.primary;
      stats.maxMana = b.mana;
    } else {
      stats.attackPower = b.power;
      stats[attribute === 'wisdom' ? 'strength' : attribute] = b.primary;
    }
    if (variant % 2) {
      const main = role === 'hybrid' ? 'strength' : role === 'tank' ? 'strength' : attribute;
      stats[main] -= 1;
      stats.maxHp = 10;
      stats.hitChance = chance[tier];
    } else stats.critChance = chance[tier];
  } else if (slot === 'armor') {
    stats.maxHp = b.hp;
    stats.armor = b.armor;
    stats.constitution = b.con;
    if (role === 'tank') {
      stats.maxHp += b.hp / 2;
      stats.armor += b.armor / 2;
      stats.block = chance[tier];
      stats.speed = -1;
    } else if (role === 'caster' || role === 'healer') {
      stats.maxMana = b.mana;
      stats[attribute] = Math.max(1, Math.floor(b.primary / 2));
    } else {
      stats[attribute] = Math.max(1, Math.floor(b.primary / 3));
      if (role === 'hybrid') stats.intellect = stats.strength;
      stats.dodge = chance[tier];
    }
    if (variant % 2) {
      stats.armor -= 8;
      stats.maxHp += 8;
    }
    if (variant % 3 === 2) {
      stats.maxHp -= 10;
      stats.speed = (stats.speed ?? 0) + 1;
    }
  } else {
    stats.maxHp = Math.round(b.hp / 2);
    stats.constitution = Math.max(1, Math.floor(b.con / 2));
    if (role === 'hybrid') {
      stats.strength = Math.ceil(b.primary / 3);
      stats.intellect = Math.ceil(b.primary / 3);
    } else stats[attribute] = Math.max(1, Math.floor(b.primary / 2));
    if (role === 'tank') stats.armor = Math.round(b.armor / 2);
    if (role === 'caster' || role === 'healer' || role === 'hybrid') stats.maxMana = Math.round(b.mana / 2);
    if (variant % 2) stats.hitChance = chance[tier];
    else stats.critChance = chance[tier];
  }
  return stats;
}

function gear(name, className, slot, tier, variant = 0, description, perk, usableBy = [className]) {
  const rarity = tier === 'story' ? 'rare' : tier;
  const price = ['story', 'epic'].includes(tier) ? null : tiers[tier].price;
  return { id: `early-${slug(name)}`, name, slot, rarity, minimumLevel: tier === 'epic' ? 10 : 1,
    itemLevel: { common: 3, uncommon: 6, rare: 9, story: 9, epic: 10 }[tier],
    usableBy: [...usableBy], stats: statsFor(className, slot, tier, variant),
    price, sellPrice: Math.floor(tiers[tier].price * 0.3), enchantmentSlots: 1,
    description: description ?? `A ${name.toLowerCase()} made for the first journeys beneath Pineshire Reach.`,
    ...(className === 'Runedancer' && slot === 'weapon' ? { weaponType: 'Runeblade', gemstone: 'quartz' } : {}),
    ...(perk ? { perk: { ...perk } } : {}),
    lootRegions: ['pineshire-reach'],
    lootSources: tier === 'epic' ? ['boss', 'everdeep'] : ['wave', 'boss', 'everdeep'],
    lootLocations: tier === 'common' || tier === 'rare' ? ['*'] : tier === 'epic'
      ? ['dolmark-den', 'old-quarry', 'march-west-delves', 'sunken-watch', 'verge-delves', 'murmuring-abyss']
      : ['thornbriar-hollow', 'dolmark-den', 'old-quarry', 'march-west-delves', 'sunken-watch', 'verge-delves', 'murmuring-abyss'] };
}

// Rows have one entry per class, in EARLY_GEAR_CLASSES order. Each name is a distinct
// catalog definition; armor pieces all occupy the game's single armor slot.
const commonWeapons = [
  ['Pitborn Gladius', 'Copperguard Spear'], ['Wayside Longsword', 'Pilgrim Guardblade'],
  ['Dawnlit Sabre', 'Sunward Hammer'], ['Copper Skillet', 'Ashwood Cudgel'],
  ['Tinleaf Shiv', 'Cobble Alley Knife'], ['Boarhide Axe', 'Flintfang Maul'],
  ['Hazel Hunting Bow', 'Reedstring Bow'], ['Quartz Runeblade', 'Agate Dancers Blade'],
  ['Sootwood Staff', 'Duskglass Wand'], ['Coppercoil Rod', 'Garnet Binding Staff'],
  ['Chalkscribed Staff', 'Ivory Page Wand'], ['Brass Chapel Mace', 'Morning Prayer Rod'],
  ['Willowroot Crook', 'Mossbound Mace'], ['Redthorn Sceptre', 'Bloodwood Ritual Mace']
];
const commonArmor = [
  ['Pit Leathers', 'Copper Ring Harness', 'Sparring Hauberk'],
  ['Wayside Mail', 'Vowkeepers Coat', 'Ironbound Gambeson'],
  ['Sunward Mail', 'Daywatch Tabard', 'Brass Dawncoat'],
  ['Taproom Apron', 'Cellar Leather Coat', 'Padded Serving Dress'],
  ['Alleyhide Jerkin', 'Grey Pocketcoat', 'Dockside Leathers'],
  ['Boarskin Harness', 'Hill Clan Vest', 'Roughhide Warcoat'],
  ['Hazelwood Jack', 'Brushland Coat', 'Fletchers Leathers'],
  ['Quartzsewn Vest', 'Agate Dancecoat', 'Ribbonbound Leathers'],
  ['Sootweave Robes', 'Duskmoth Wrap', 'Candleblack Mantle'],
  ['Copperthread Robes', 'Garnet Binding Coat', 'Sigilsewn Vestments'],
  ['Chalkweave Robes', 'Ivory Scholar Coat', 'Parchment Mantle'],
  ['Chapel Linen Vestments', 'Daybreak Prayer Robes', 'Brasshem Surplice'],
  ['Mosswoven Robes', 'Willowbark Wrap', 'Seedkeepers Mantle'],
  ['Redthread Vestments', 'Bloodwood Prayer Robes', 'Rosehem Mantle']
];
const commonAccessories = [
  'Copper Pit Token', 'Wayside Vow Ring', 'Brass Sun Brooch', 'Pewter Taproom Charm',
  'Alley Cats Button', 'Boar Tusk Pendant', 'Hazel Fletching Pin', 'Quartz Dance Anklet',
  'Duskmoth Cameo', 'Copper Sigil Ring', 'Ivory Bookmark', 'Chapel Bell Charm',
  'Willowseed Locket', 'Roseglass Phial'
];
const uncommonArmor = [
  ['Iron Pit Harness', 'Riveted Arena Coat'], ['Vowbound Mail', 'Sentinels Brigandine'],
  ['Dawnforged Hauberk', 'Sunward Brigandine'], ['Brassbutton Barcoat', 'Embroidered Cellar Jack'],
  ['Smokehide Jerkin', 'Lockpickers Coat'], ['Ironboar Harness', 'Trollhide Warcoat'],
  ['Hawkeye Leathers', 'Greenfletch Coat'], ['Fluorite Dancecoat', 'Silverspun Runevest'],
  ['Duskvelvet Robes', 'Mothsilk Mantle'], ['Garnetweave Vestments', 'Silvercoil Robes'],
  ['Illuminators Robes', 'Vellumguard Mantle'], ['Goldhem Prayer Robes', 'Sanctuary Vestments'],
  ['Briarwoven Robes', 'Fernsilk Mantle'], ['Rosequartz Vestments', 'Crimson Sutures Coat']
];
const uncommonAccessories = [
  'Iron Arena Medal', 'Silver Vow Chain', 'Dawnstone Signet', 'Amber Tankard Charm',
  'Smoky Quartz Ring', 'Carved Boar Totem', 'Hawkeye Clasp', 'Fluorite Step Anklet',
  'Mothwing Reliquary', 'Garnet Coil Bracelet', 'Illuminated Page Seal', 'Gold Chapel Rosary',
  'Briarheart Pendant', 'Rosequartz Pulse Ring'
];
const rareWeapons = [
  'Engraved Arena Gladius', 'Silverguard Longsword', 'Sunstone Warhammer', 'Gilded Cellar Mace',
  'Smokesteel Dirk', 'Deepiron Greataxe', 'Hornwood Longbow', 'Moonquartz Runeblade',
  'Dusksilver Staff', 'Garnet Lattice Rod', 'Illuminated Vellum Staff', 'Sunpearl Chapel Mace',
  'Ancient Briar Crook', 'Rosegold Ritual Sceptre'
];
const rareArmor = [
  'Engraved Pit Brigandine', 'Silverguard Hauberk', 'Sunstone Mail', 'Gilded Cellar Coat',
  'Smokesteel Leathers', 'Deepiron War Harness', 'Hornwood Scouts Coat', 'Moonquartz Dancecoat',
  'Dusksilver Mantle', 'Garnet Lattice Robes', 'Illuminated Vellum Robes', 'Sunpearl Vestments',
  'Ancient Briar Mantle', 'Rosegold Ritual Vestments'
];
const rareAccessories = [
  'Engraved Arena Laurel', 'Silverguard Oath Seal', 'Sunstone Reliquary', 'Gilded Tankard Brooch',
  'Smokesteel Lock Ring', 'Deepiron Tusk Torque', 'Hornwood Falcon Charm', 'Moonquartz Step Chain',
  'Dusksilver Moth Brooch', 'Garnet Lattice Signet', 'Illuminated Vellum Seal', 'Sunpearl Rosary',
  'Ancient Briar Seed', 'Rosegold Pulse Locket'
];

export const EARLY_EQUIPMENT = [];
for (const [index, className] of all.entries()) {
  commonWeapons[index].forEach((name, n) => EARLY_EQUIPMENT.push(gear(name, className, 'weapon', 'common', n)));
  commonArmor[index].forEach((name, n) => EARLY_EQUIPMENT.push(gear(name, className, 'armor', 'common', n)));
  EARLY_EQUIPMENT.push(gear(commonAccessories[index], className, 'accessory', 'common'));
  uncommonArmor[index].forEach((name, n) => EARLY_EQUIPMENT.push(gear(name, className, 'armor', 'uncommon', n)));
  EARLY_EQUIPMENT.push(gear(uncommonAccessories[index], className, 'accessory', 'uncommon'));
  EARLY_EQUIPMENT.push(gear(rareWeapons[index], className, 'weapon', 'rare'));
  EARLY_EQUIPMENT.push(gear(rareArmor[index], className, 'armor', 'rare'));
  EARLY_EQUIPMENT.push(gear(rareAccessories[index], className, 'accessory', 'rare'));
}

// Shared pieces fill the non-multiple-of-fourteen requests without leaving a class
// without an option. Rows list name, representative stat profile and actual wearers.
const shared = {
  common: {
    weapon: [
      ['Militia Guardblade', 'Gladiator', tanks], ['Copper Trail Hatchet', 'Barbarian', ['Barbarian', 'Barmaid', 'Scoundrel']],
      ['Hedge Mages Staff', 'Arcanist', casters], ['Wayshrine Mace', 'Dawnpriest', healers]
    ],
    armor: [['Travelworn Leather Coat', 'Ranger', [...tanks, ...light]], ['Hedgewoven Robes', 'Arcanist', cloth]],
    accessory: [
      ['Braided March Cord', 'Gladiator', tanks], ['Copper Gate Seal', 'Gladiator', tanks],
      ['Pewter Shield Pin', 'Gladiator', tanks], ['Hillwalkers Knot', 'Barbarian', physical],
      ['Brass Falcon Band', 'Ranger', physical], ['Amber Dice Charm', 'Barmaid', physical],
      ['Quartz Lamp Bead', 'Arcanist', magical], ['Scribed Riverstone', 'Arcanist', magical],
      ['Linen Prayer Knot', 'Dawnpriest', healers], ['Garden Bell Pendant', 'Grovekeeper', healers],
      ['Delvers Hearthstone', 'Gladiator', all]
    ]
  },
  uncommon: {
    weapon: [
      ['Silvered Watchblade', 'Gladiator', tanks], ['Mithril-edged Dirk', 'Scoundrel', ['Scoundrel', 'Barmaid']],
      ['Ironboar War Axe', 'Barbarian', ['Barbarian']], ['Hawkeye Hornbow', 'Ranger', ['Ranger']],
      ['Fluorite Crescentblade', 'Runedancer', ['Runedancer']], ['Silvercoil Channeling Staff', 'Arcanist', casters],
      ['Goldhem Prayer Mace', 'Dawnpriest', healers], ['Fernwood Ritual Crook', 'Grovekeeper', healers]
    ],
    armor: [
      ['Gatewarden Mail', 'Gladiator', tanks], ['Silverseamed Gambeson', 'Oathwarden', tanks],
      ['Dawnsteel Ring Coat', 'Dawnwarden', tanks], ['Trailwarden Jack', 'Ranger', light],
      ['Ashhide Scout Coat', 'Scoundrel', light], ['Trollstitched Leathers', 'Barbarian', light],
      ['Moonwoven Mantle', 'Umbramancer', casters], ['Silverink Scholar Robes', 'Arcanist', casters],
      ['Sanctuary Silk Vestments', 'Dawnpriest', healers], ['Fernwoven Prayer Robes', 'Grovekeeper', healers]
    ],
    accessory: [
      ['Mithril Gate Medal', 'Gladiator', tanks], ['Silver Rampart Ring', 'Oathwarden', tanks],
      ['Amber Falcon Clasp', 'Ranger', physical], ['Ironboar Tooth Chain', 'Barbarian', physical],
      ['Fluorite Lantern Seal', 'Arcanist', magical], ['Silver Rune Knot', 'Runedancer', magical],
      ['Pearl Prayer Beads', 'Dawnpriest', healers], ['Briarblossom Cameo', 'Grovekeeper', healers]
    ]
  },
  rare: {
    weapon: [['Engraved Patrol Sabre', 'Gladiator', tanks], ['Sunpearl Ritual Staff', 'Dawnpriest', healers]],
    armor: [
      ['Silverthorn Wardmail', 'Gladiator', ['Gladiator', 'Oathwarden']],
      ['Sunstitched Travelcoat', 'Dawnwarden', ['Dawnwarden', 'Barmaid']],
      ['Smokehide Warcoat', 'Scoundrel', ['Scoundrel', 'Barbarian']],
      ['Moonquartz Trailcoat', 'Runedancer', ['Ranger', 'Runedancer']],
      ['Duskgarnet Vestments', 'Umbramancer', ['Umbramancer', 'Spellbinder']],
      ['Illuminated Sanctuary Robes', 'Arcanist', ['Arcanist', 'Dawnpriest']],
      ['Rosebriar Vestments', 'Grovekeeper', ['Grovekeeper', 'Sanguinist']]
    ],
    accessory: [['Pineshire Expedition Seal', 'Gladiator', all]]
  }
};
for (const [tier, slots] of Object.entries(shared)) for (const [slot, rows] of Object.entries(slots)) {
  rows.forEach(([name, className, usableBy], index) => {
    const item = gear(name, className, slot, tier, index, undefined, undefined, usableBy);

    // Universal keepsakes trade the representative class's offense for neutral survival.
    if (usableBy === all) item.stats = { maxHp: tier === 'rare' ? 35 : 15, constitution: tier === 'rare' ? 2 : 1 };
    EARLY_EQUIPMENT.push(item);
  });
}

// Story rows contain two class-exclusive items for each slot. Their fixed statistics
// are a little lower than plain rares to pay for their conditional perks.
const storyPerks = {
  guard: ['last_muster', 0.03, 0.5],
  parry: ['live_to_tell', 0.02, 0.5],
  duel: ['fair_rates', 0.04],
  opener: ['enough_to_share', 0.04, 0.75],
  finish: ['bring_home_supper', 0.015, 0.35],
  rescue: ['sentence_commuted', 0.05, 0.35],
  care: ['doctors_orders', 0.04, 0.4],
  receive: ['familiar_care', 0.05, 0.4],
  reserve: ['through_the_night', 0.04, 0.7],
  ember: ['banked_embers', 0.05, 0.3],
  cover: ['woodland_cover', 0.015, 0.75],
  company: ['honest_days_work', 0.04, 0.7]
};
function storyPerk(key, name, epic = false) {
  const [id, amount, threshold] = storyPerks[key];
  return { id, name, amount: Number((amount * (epic ? 1.5 : 1)).toFixed(4)),
    ...(threshold === undefined ? {} : { threshold }) };
}

// A row is [name, perk key, perk name, lore]. Geography is flavor, never a dependency
// on an unimplemented map or monster system.
const stories = [
  {
    weapon: [
      ['Rongars Toothpick', 'duel', 'Stand Your Ground', 'A pit champion fashioned this blade from a tooth left in Rongar\'s feeding trough. Its chipped edge still carries the marks of that escape.'],
      ['Cragpit Challenger', 'rescue', 'Answer the Bell', 'Highmere quarry fighters rang a cracked bell before every rescue bout. This short spear was carried by the last volunteer to answer.']
    ],
    armor: [
      ['Gelwarden Harness', 'guard', 'Stubborn Hide', 'Pineshire pit guards sealed this harness with boiled cave gel after watching slime seep through ordinary mail.'],
      ['Ashring Champion Coat', 'receive', 'Second Wind', 'A scorched laurel is sewn inside the coat of a fighter who survived three nights beneath the Old Quarry.']
    ],
    accessory: [
      ['Cracked Arena Bell', 'parry', 'Final Round', 'The smallest bell in the Highmere pits was reserved for fighters who refused to yield. Its clapper has worn through one side.'],
      ['Rongars Brass Tag', 'duel', 'Uninvited Guest', 'Someone scratched a champion\'s tally into this feeding tag before stealing it from Dolmark Den.']
    ]
  },
  {
    weapon: [
      ['Watchmans Last Oath', 'duel', 'Keep the Gate', 'The Sunken Watch gatekeeper drove this blade through the gate chain when the flood came, holding the passage open for those behind him.'],
      ['Highmere Witness', 'rescue', 'Unbroken Promise', 'A sworn escort carried this sword over the Highmere Crags while guiding quarry children through a winter rockfall.']
    ],
    armor: [
      ['Drowned Gatekeepers Mail', 'guard', 'Hold the Passage', 'Salt has blackened every ring except the small oath seal over the heart. The armor was recovered facing the Sunken Watch gate.'],
      ['Cragwatch Vowcoat', 'receive', 'Remember the Living', 'The names stitched beneath this coat\'s collar belong to travelers rescued from Highmere ledges.']
    ],
    accessory: [
      ['Gatekeepers Chain Link', 'parry', 'One Link Holds', 'This bent link once bore the weight of the Sunken Watch floodgate. A broken oath would have been easier to carry.'],
      ['Witness Stone of Highmere', 'guard', 'Witness the Stand', 'Highmere escorts pressed their vows into soft stone before crossing the crags. This one has never split.']
    ]
  },
  {
    weapon: [
      ['First Light at the Watch', 'duel', 'Meet the Darkness', 'A watchwarden kept this hammer beside a shuttered east window, waiting for a dawn the drowned tower never saw.'],
      ['Cragbeacon Sabre', 'rescue', 'Beacon Oath', 'The last keeper of Highmere\'s eastern beacon carried this blade when its lamps could no longer be lit.']
    ],
    armor: [
      ['Sunken Dawn Hauberk', 'guard', 'Light Beneath Water', 'A sunrise is etched inside each shoulder plate, where the waters of the Sunken Watch could not quite scour it away.'],
      ['Cragbeacon Daymail', 'receive', 'Shelter at Daybreak', 'Highmere pilgrims left strips of gold cloth on this beacon keeper\'s mail in thanks for safe shelter.']
    ],
    accessory: [
      ['Unlit Beacon Lens', 'parry', 'Keep the Spark', 'A hairline flame remains suspended in this lens from the abandoned Highmere beacon. It gives no heat.'],
      ['Watch Dawn Reliquary', 'guard', 'Morning Remains', 'A drowned watchwarden sealed a dry sunflower petal inside this brass reliquary before taking the final watch.']
    ]
  },
  {
    weapon: [
      ['Last Supper Skillet', 'company', 'A Full Table', 'The Thornbriar innkeeper fed the evacuation party before barring her own kitchen door with this iron skillet.'],
      ['Rongars Tab', 'finish', 'Payment Due', 'A cellar keeper scratched Rongar\'s unpaid tally into a cudgel, though nobody remembers what he ordered.']
    ],
    armor: [
      ['Thornbriar Cellar Apron', 'cover', 'Behind the Barrels', 'The apron\'s deep pockets held bread and bandages when Thornbriar\'s cellar became a refuge.'],
      ['Innkeepers Final Coat', 'receive', 'On the House', 'Travelers repaired this coat with scraps from their own cloaks after its owner sheltered them from Dolmark raiders.']
    ],
    accessory: [
      ['Last Guests Tankard', 'company', 'One More Round', 'Every guest who escaped the Thornbriar inn left a mark around this tankard\'s pewter rim.'],
      ['Cellar Key of Pineshire', 'finish', 'Closing Time', 'The inn\'s cellar door is long gone, but this key still smells faintly of applewood smoke.']
    ]
  },
  {
    weapon: [
      ['Murmur in the Lock', 'finish', 'Quiet Ending', 'A thief claimed this narrow blade could hear the locks beneath the Murmuring Abyss. She returned without her tools.'],
      ['Thornbriar Debtknife', 'opener', 'Collected in Advance', 'The knife was hidden in a hollow walking stick beside a tally of debts owed by Thornbriar\'s missing tollkeepers.']
    ],
    armor: [
      ['Mothsmuggler Coat', 'cover', 'Leave No Footprint', 'Duskmoth scales were brushed into this coat by smugglers who used the dry channels beneath the Sunken Watch.'],
      ['Abyss Locksmith Leathers', 'receive', 'Another Way Out', 'The inner lining contains a map of doors no living delver has found in the Murmuring Abyss.']
    ],
    accessory: [
      ['Ninth Lockpick Ring', 'finish', 'Last Tumbler', 'Eight matching lockpicks were found beside an open Abyss coffer. The ninth had been twisted into this ring.'],
      ['Thornbriar Toll Penny', 'opener', 'First Claim', 'A tollkeeper bit this coin to prove it was false, then kept it through three changes of allegiance.']
    ]
  },
  {
    weapon: [
      ['Highmere Avalanche', 'rescue', 'Break the Line', 'This axe was dug from the path of a Highmere avalanche beside the broken shackles of a quarry gang.'],
      ['Silvanarks Splinter', 'opener', 'Old Fury', 'A storm tore the haft from a tree scarred by Silvanark. The clan smith kept the living knot beneath its iron head.']
    ],
    armor: [
      ['Cragbreaker Warhide', 'guard', 'Weather the Fall', 'Layered hides protected a Highmere clan guide while he dug a buried caravan out by hand.'],
      ['Thornroot Clan Harness', 'receive', 'Blood of the Grove', 'The harness was traded to a wounded wanderer by forest folk who would not speak Silvanark\'s name.']
    ],
    accessory: [
      ['Avalanche Tusk', 'rescue', 'No One Buried', 'A Highmere guide blew this hollow tusk until the searchers heard him through the snow.'],
      ['Silvanarks Bark Shard', 'opener', 'Wake the Roots', 'Fresh sap still gathers along a splinter taken from the oldest scar in Thornbriar Hollow.']
    ]
  },
  {
    weapon: [
      ['Thornbriar Whisperbow', 'opener', 'First Feather', 'The Hollow\'s scouts wrapped this bow in moss to keep its string from warning the creatures between the roots.'],
      ['Highmere Kestrel', 'finish', 'Falling Feather', 'Crag scouts carved a kestrel under this bow\'s grip in memory of a bird that led them to a missing child.']
    ],
    armor: [
      ['Hollow Trackers Jack', 'cover', 'Under the Ferns', 'The jack\'s mottled panels were dyed with berries growing only where Thornbriar\'s old paths have disappeared.'],
      ['Kestrelkeepers Trailcoat', 'receive', 'Return to the Roost', 'A Highmere falconer sewed a strip of every rescued scout\'s cloak into this weathered trailcoat.']
    ],
    accessory: [
      ['Whisperflight Pin', 'opener', 'Unheard Approach', 'A scout pinned this feather to her quiver before entering the Hollow without a hunting bell.'],
      ['Highmere Kestrel Jess', 'finish', 'Sure Descent', 'The leather has been cut and retied so often that only the tiny silver kestrel remains original.']
    ]
  },
  {
    weapon: [
      ['Echo of the First Step', 'company', 'Remembered Measure', 'A quartz blade lay across the Twilight Court\'s smallest practice circle, as if its dancer had only paused between steps.'],
      ['Cragglass Refrain', 'opener', 'Opening Measure', 'A traveling dancer set Highmere storm glass into this blade so her runes could remember the sound of mountain rain.']
    ],
    armor: [
      ['Twilight Practice Vest', 'cover', 'Unbroken Step', 'Faded chalk still marks the turns of a vanished instructor\'s hands along this dance vest.'],
      ['Stormglass Dancecoat', 'receive', 'Find the Measure', 'Tiny Highmere glass beads were sewn into the hem to sound a quiet rhythm through the fog.']
    ],
    accessory: [
      ['Twilight Counting Bead', 'company', 'Keep the Company', 'One bead remains on a cord once used to count the Twilight Court\'s evening rehearsals.'],
      ['Rainkeepers Anklet', 'opener', 'Before the Thunder', 'The anklet rings only when its wearer moves; the Highmere artisan insisted rain should have a partner.']
    ]
  },
  {
    weapon: [
      ['Mothlight Extinguished', 'reserve', 'Hoard the Dusk', 'A Sunken Watch lamplighter darkened this staff so the things beneath the water could not follow its glow.'],
      ['The Abyss Listens', 'ember', 'Last Whisper', 'Words appear beneath this staff\'s lacquer when it is carried near the Murmuring Abyss, but never in the same order.']
    ],
    armor: [
      ['Lamplighters Duskweave', 'guard', 'Bank the Light', 'Soot from the Sunken Watch\'s last lantern has settled into every fold of this mantle.'],
      ['Murmurwoven Mantle', 'receive', 'Answer Softly', 'A delver stitched the sounds she heard below the Abyss into this robe, using knots where words failed.']
    ],
    accessory: [
      ['Darkened Watch Wick', 'reserve', 'Unspent Flame', 'The wick was pulled from a drowned lantern with its end still warm.'],
      ['Abyss Echo Shell', 'ember', 'A Voice Remains', 'Held to the ear, this shell repeats the final word spoken beside the Murmuring Abyss.']
    ]
  },
  {
    weapon: [
      ['Crimson Quarry Writ', 'reserve', 'Read the Fine Rune', 'A quarry overseer bound a debt spirit into the garnet at this rod\'s tip. The contract ends where the stone was broken.'],
      ['Thornbriar Binding Needle', 'ember', 'Draw the Last Thread', 'The Hollow\'s first wardmaker used this long needle to stitch a warning into the roots of a living tree.']
    ],
    armor: [
      ['Overseers Runeweave', 'guard', 'Binding Clause', 'The Old Quarry\'s overseer wore these vestments beneath plain work clothes, concealing the clauses that bound his stone servants.'],
      ['Rootscript Binding Robes', 'receive', 'Thread Rejoined', 'The pattern records an unfinished ward discovered beneath Thornbriar\'s oldest root bridge.']
    ],
    accessory: [
      ['Quarry Contract Seal', 'reserve', 'Unbroken Clause', 'A stone servant carried this seal long after its overseer disappeared into the Old Quarry.'],
      ['Garnet of the Last Knot', 'ember', 'The Binding Holds', 'A single root is trapped inside the gem, still bent into the wardmaker\'s final knot.']
    ]
  },
  {
    weapon: [
      ['The Missing Watch Page', 'reserve', 'Margin of Light', 'This staff shelters a page from the Sunken Watch ledger describing a sunrise absent from every other account.'],
      ['Highmere Sky Index', 'ember', 'Read the Stars', 'An archivist etched star positions along this wand after clouds hid the Highmere summit for an entire season.']
    ],
    armor: [
      ['Drowned Archivists Mantle', 'guard', 'Preserve the Record', 'Water blurred every label in the Watch archive except the keeper\'s name inside this mantle.'],
      ['Crag Observatory Robes', 'receive', 'A Clearer Sky', 'Tiny lens covers line these robes, each engraved with the date of a clear Highmere night.']
    ],
    accessory: [
      ['Watch Ledger Clasp', 'reserve', 'Keep the Place', 'The clasp still grips a scrap of the Sunken Watch\'s final inventory page.'],
      ['Highmere Star Lens', 'ember', 'One Star Left', 'The damaged lens shows one star clearly even beneath the lowest ceilings of the Old Quarry.']
    ]
  },
  {
    weapon: [
      ['Bell of the Lost Morning', 'care', 'Mercy at Dawn', 'A priest carried this bell-headed mace into the Sunken Watch when its morning service failed to answer.'],
      ['Highmere Pilgrims Rest', 'care', 'Light for the Fallen', 'The mace\'s hollow head held coals for a pilgrim shelter above Highmere\'s last pass.']
    ],
    armor: [
      ['Lost Morning Vestments', 'receive', 'Answer the Bell', 'These vestments were found folded beside the Sunken Watch chapel bell, their hem still dry.'],
      ['Crag Pilgrims Surplice', 'guard', 'Shelter the Flame', 'Pilgrims patched the surplice with strips of their prayer flags while waiting out a Highmere storm.']
    ],
    accessory: [
      ['Silent Matins Bell', 'care', 'A Quiet Benediction', 'The bell has no clapper, but the survivors of the Watch remembered its sound.'],
      ['Highmere Hearth Coal', 'care', 'Shared Warmth', 'A cool black coal is kept in this reliquary in memory of the shelter\'s final winter fire.']
    ]
  },
  {
    weapon: [
      ['Silvanarks Unfallen Bough', 'care', 'Tend the Wounded', 'A green shoot grew from this fallen branch after Silvanark\'s passing shattered the forest floor.'],
      ['Thornbriar Seedkeeper', 'care', 'Room to Grow', 'The crook\'s hollow grip carried the last seeds gathered before the Hollow\'s paths closed.']
    ],
    armor: [
      ['Unfallen Grove Mantle', 'receive', 'Roots Remember', 'The mantle\'s living fibers were woven from shoots that survived beneath Silvanark\'s fallen branches.'],
      ['Seedwardens Last Wrap', 'guard', 'Winter Shelter', 'The Hollow\'s seedwarden wrapped the final nursery in this robe before the first frost reached the roots.']
    ],
    accessory: [
      ['Silvanarks Green Acorn', 'care', 'Life in the Scar', 'This acorn was found growing in an old wound on Silvanark\'s bark.'],
      ['Hollow Nursery Key', 'care', 'Open for Spring', 'The wooden key belongs to a nursery swallowed by Thornbriar roots, though its teeth are newly green.']
    ]
  },
  {
    weapon: [
      ['The Quarrys Kind Cut', 'care', 'Leave None Behind', 'A quarry healer used this rosewood mace to break shackles before treating the wrists beneath them.'],
      ['Crimson Watch Vigil', 'care', 'Life Still Answers', 'A blood healer carved each saved watchman\'s pulse into the handle during the Sunken Watch flood.']
    ],
    armor: [
      ['Rose of the Quarry Coat', 'receive', 'A Steadier Pulse', 'Red stitches mark the places where a healer tore strips from this coat for the quarry wounded.'],
      ['Crimson Vigil Vestments', 'guard', 'Keep the Pulse', 'The vestments were washed in the Watch\'s rising waters until only the embroidered red veins remained.']
    ],
    accessory: [
      ['Freed Miners Pulse Stone', 'care', 'A Life Returned', 'The stone was passed from hand to hand as rescued quarry workers counted those still alive.'],
      ['Watch Healers Rose Phial', 'care', 'One More Heartbeat', 'A dried rose petal floats in the phial once carried by the Watch\'s final blood healer.']
    ]
  }
];
for (const [index, className] of all.entries()) for (const slot of ['weapon', 'armor', 'accessory']) {
  stories[index][slot].forEach(([name, key, perkName, lore], variant) => {
    EARLY_EQUIPMENT.push(gear(name, className, slot, 'story', variant, lore, storyPerk(key, perkName)));
  });
}

const epicWeapons = [
  ['Crownbreaker of the Crags', 'duel', 'Challenge the Crown', 'Highmere\'s pit tyrant offered this blade to anyone who could take it from him. The missing crown on its pommel tells the rest.'],
  ['Oath Beneath the Flood', 'rescue', 'Carry Them Home', 'The Watch gatekeeper\'s successor swore her vow beneath the floodwater and surfaced carrying two children and this sword.'],
  ['Dawn Beyond the Deep', 'duel', 'Kindle the Gate', 'A beacon shard glows inside the hammer that struck open the Sunken Watch\'s sealed chapel doors.'],
  ['The Innkeepers Welcome', 'company', 'A Place for Everyone', 'The innkeeper melted every abandoned tankard into this mace after the Hollow evacuation, leaving a seat for every missing guest.'],
  ['The Unheard Farewell', 'finish', 'Close the Account', 'A master locksmith left this knife beside the Abyss coffer she refused to open, along with a letter addressed to whoever came next.'],
  ['Highmere Breaks Its Chains', 'rescue', 'No One Left Below', 'The first freed quarry worker carried this axe back into the crags until every shackle from his old gang had been broken.'],
  ['The Last Kestrels Flight', 'opener', 'Claim the Horizon', 'The last Highmere scout strung this bow with a cord from the rescue bells and followed a kestrel into a storm no patrol would enter.'],
  ['Twilight Courts Encore', 'company', 'A Dance Remembered', 'Fourteen abandoned practice blades rang when this runeblade was lifted from the Twilight Court. Its quartz still answers the final note.'],
  ['Lantern at the Worlds End', 'ember', 'The Last Light Waits', 'A Watch lamplighter carried this black staff into the Abyss with a lantern whose flame could be seen only in its shadow.'],
  ['Writ Against the Abyss', 'reserve', 'The Final Clause', 'The quarry wardmaker left one contract unfinished: a binding written for the voice beneath the Murmuring Abyss.'],
  ['The Unwritten Constellation', 'reserve', 'Read Beyond the Margin', 'Highmere\'s archivist charted a constellation reflected only in the waters of the Sunken Watch and sealed the page inside this staff.'],
  ['Morning for the Missing', 'care', 'Let the Bell Answer', 'The lost chapel bell was recast around the names of those who never returned from the Sunken Watch. Its voice is gentle.'],
  ['Spring Beneath Silvanark', 'care', 'The Grove Endures', 'A seedkeeper planted this crook in the deepest scar left by Silvanark. By morning, its wood had flowered around the iron head.'],
  ['The Heartbeat After Silence', 'care', 'Call Them Back', 'A quarry healer carried this sceptre through the drowned Watch, listening for heartbeats where the searchers had stopped calling.']
];
const epicArmor = [
  ['Cragpits Unbowed Harness', 'guard', 'Refuse the Fall', 'The harness carries a small bronze plate from every fighter who stood against Highmere\'s pit tyrant.'],
  ['Mail of the Unbroken Crossing', 'guard', 'The Crossing Holds', 'Broken links from the Watch gate chain were forged into the coat of the escort who brought the final survivors home.'],
  ['Daymail of the Drowned Beacon', 'guard', 'Dawn Will Return', 'A beacon lens rests beneath this hauberk\'s breastplate, catching light even in the lowest chambers of the Watch.'],
  ['Hearthwarden of Thornbriar', 'receive', 'Room at the Hearth', 'The innkeeper\'s coat was remade from the cloaks of the travelers she sheltered beneath Thornbriar.'],
  ['Mantle of the Ninth Door', 'cover', 'A Door Still Open', 'A seam inside these leathers traces the one Abyss passage missing from the locksmith\'s map.'],
  ['Warhide of the Freed Crags', 'guard', 'Stand for the Buried', 'Every iron stud was once part of a Highmere quarry shackle. None has been polished.'],
  ['Kestrels Homeward Coat', 'cover', 'Find the Safe Wind', 'The Highmere scouts lined this coat with messages recovered from patrols that never made the descent.'],
  ['Vest of the Final Measure', 'cover', 'Never Miss the Step', 'Twilight Court dancers embroidered their names inside this vest before the rehearsal that has no surviving account.'],
  ['Mantle of the Patient Dark', 'guard', 'Wait Through the Night', 'This mantle was found hanging beside a still-burning shadow in the Watch\'s flooded lantern room.'],
  ['Vestments of the Unbroken Writ', 'guard', 'The Binding Endures', 'The unfinished Abyss contract has been stitched into the lining, where its closing rune remains blank.'],
  ['Robes of the Hidden Firmament', 'receive', 'A Star Remains', 'The Highmere archivist lined these robes with the sky as it appeared in the drowned Watch\'s reflection.'],
  ['Surplice of Returning Morning', 'receive', 'Answer with Light', 'The chapel survivors each added one gold stitch to these vestments before their first service above ground.'],
  ['Mantle of the Deepest Spring', 'receive', 'Roots Reach Further', 'Living roots from Silvanark\'s oldest scar hold the mantle together without a single metal clasp.'],
  ['Vestments of the Answering Pulse', 'receive', 'Life Answers Life', 'The names of the quarry wounded are stitched beside a red thread that continues around the hem without a break.']
];
for (const [index, className] of all.entries()) {
  for (const [slot, rows] of [['weapon', epicWeapons], ['armor', epicArmor]]) {
    const [name, key, perkName, lore] = rows[index];
    EARLY_EQUIPMENT.push(gear(name, className, slot, 'epic', 0, lore, storyPerk(key, perkName, true)));
  }
}
const epicAccessories = [
  ['Seal of the Final Gate', 'Gladiator', tanks, 'guard', 'No Passage Lost', 'The Sunken Watch\'s gate seal was recovered intact after every hinge around it had failed.'],
  ['Highmere Rescue Bell', 'Oathwarden', tanks, 'parry', 'Answer the Rescue', 'Highmere rescuers carried this bell beneath their armor so the buried could hear a heartbeat approaching.'],
  ['Laurel of the Homeward Hunt', 'Ranger', physical, 'finish', 'Bring Everyone Home', 'The Hollow scouts wove this laurel around the names of companions recovered from the thorns.'],
  ['The Innkeepers Last Token', 'Barmaid', physical, 'company', 'A Shared Victory', 'Every traveler who returned to the ruined Thornbriar inn left a coin beneath the hearthstone.'],
  ['Twilight Observatory Prism', 'Arcanist', magical, 'reserve', 'Light Held in Trust', 'A dancer carried this Highmere prism to the Twilight Court, hoping to teach its runes the paths of stars.'],
  ['Whisper Beneath the Wick', 'Umbramancer', magical, 'ember', 'The Flame Remembers', 'The lamplighter trapped a single Abyss whisper inside the glass before extinguishing his last lantern.'],
  ['Rosary of the Returning Spring', 'Grovekeeper', healers, 'care', 'Mercy Takes Root', 'Each bead encloses a seed gathered from the shelters along Thornbriar\'s evacuation path.'],
  ['The Watchs Answering Heart', 'Sanguinist', healers, 'care', 'One Heart More', 'The surviving Watch healers sealed their prayer inside a roseglass heart before parting at dawn.']
];
for (const [name, className, usableBy, key, perkName, lore] of epicAccessories) {
  const item = gear(name, className, 'accessory', 'epic', 0, lore, storyPerk(key, perkName, true), usableBy);

  // Shared damage-role accessories use an equal split so Rangers and Runedancers get
  // useful choices without receiving both classes' full offensive stat allocations.
  if (usableBy === physical) item.stats = { maxHp: 45, constitution: 2, strength: 3, agility: 3, critChance: 0.01 };
  if (usableBy === magical) item.stats = { maxHp: 45, constitution: 2, intellect: 4, wisdom: 2, maxMana: 45, critChance: 0.01 };
  EARLY_EQUIPMENT.push(item);
}
