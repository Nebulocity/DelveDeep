import { EARLY_GEAR_CLASSES } from './lowLevelEquipment.js';

// One class blend per class plus one universal blend makes fifteen additions per tier.
// Recovery is capped in whole resource points so these remain early-game consumables.
const blends = [
  ['hp', 0.02, 'ward', 'Arena physicians brewed this after the first rescue from the Highmere pits.'],
  ['hp', 0, 'ward', 'Watch escorts carried this blend while searching the flooded gate passages.'],
  ['hp', 0, 'mana', 'Beacon keepers saved a measure for the darkest hour before a Highmere dawn.'],
  ['hp', -0.01, 'ward', 'The Thornbriar innkeeper kept this cordial beneath the hearth for wounded guests.'],
  ['hp', -0.02, 'cleanse', 'Hollow smugglers marked safe antidotes with a small grey moth.'],
  ['hp', 0.02, 'ward', 'Highmere clan guides shared this draught after digging survivors from a rockfall.'],
  ['hp', -0.01, 'cleanse', 'Thornbriar scouts steeped this tonic beside the last open trail.'],
  ['mana', 0, 'hp', 'The Twilight Court served this pale infusion after rehearsals that continued past dawn.'],
  ['mana', 0.02, 'ward', 'A Watch lamplighter brewed this beside a flame that cast no light.'],
  ['mana', 0.01, 'cleanse', 'The quarry wardmaker stained each sealed bottle with a thumbprint of garnet dust.'],
  ['mana', 0, 'hp', 'Highmere archivists warmed this infusion while charting the sky through winter cloud.'],
  ['mana', -0.01, 'ward', 'The Sunken Watch chapel reserved this cordial for the final morning service.'],
  ['mana', -0.01, 'cleanse', 'Seedkeepers made this infusion from the first shoots beneath Silvanark\'s fallen boughs.'],
  ['mana', 0, 'hp', 'Quarry healers shared this rose-colored draught while counting the living after a collapse.'],
  ['hp', 0, 'ward', 'Pineshire delvers left one sealed bottle at every shelter along the homeward road.']
];
const names = {
  common: ['Pitfighters Tonic', 'Wayside Guard Draught', 'Daywatch Cordial', 'Hearthapple Tonic',
    'Grey Moth Tonic', 'Boartusk Draught', 'Hazeltrail Tonic', 'Quartzstep Infusion',
    'Duskleaf Infusion', 'Garnetroot Infusion', 'Scholars Mint Tea', 'Chapel Honeywater',
    'Willowseed Infusion', 'Roseleaf Infusion', 'Pineshire Field Tonic'],
  uncommon: ['Iron Laurel Draught', 'Silver Vow Cordial', 'Sunpetal Draught', 'Amber Hearth Cordial',
    'Smokeberry Tonic', 'Cragboar Draught', 'Greenfletch Cordial', 'Fluorite Step Infusion',
    'Mothsilk Infusion', 'Silvercoil Elixir', 'Illuminators Infusion', 'Goldhem Chapel Cordial',
    'Briarblossom Infusion', 'Rosequartz Elixir', 'Delvers Reserve Tonic'],
  rare: ['Arena Laurel Elixir', 'Silverguard Elixir', 'Sunstone Cordial', 'Golden Hearth Elixir',
    'Smokeglass Tonic', 'Deepiron Bloodroot Draught', 'Hornwood Falcon Elixir', 'Moonquartz Infusion',
    'Dusksilver Infusion', 'Garnet Lattice Elixir', 'Vellumleaf Concentrate', 'Sunpearl Benediction',
    'Ancient Briar Concentrate', 'Rosegold Pulse Elixir', 'Pineshire Expedition Elixir'],
  story: ['The Final Round', 'Gatekeepers Vigil', 'Before the Beacon Fades', 'The Last Guests Cordial',
    'Ninth Door Antidote', 'The Buried Guides Draught', 'Whisperflight Reserve', 'Twilight Rehearsal',
    'The Unlit Lantern', 'Wardmakers Last Measure', 'Highmere Midnight Tea', 'The Missing Matins',
    'Silvanarks First Shoot', 'The Miners Answer', 'A Bottle for the Road'],
  epic: ['Crownbreakers Revival', 'Oath Beyond the Flood', 'Dawn in the Deep', 'The Innkeepers Miracle',
    'The Unheard Escape', 'Highmeres Unburied Heart', 'The Last Kestrels Return', 'Twilight Courts Last Toast',
    'Night Without an Ending', 'The Abyss Unbound', 'The Unwritten Sky', 'Morning for All Who Wait',
    'Spring Beneath the Stone', 'The Answering Heartbeat', 'The Homeward Star']
};
const tiers = {
  common: { fraction: 0.24, flat: 10, hp: 140, mana: 130, cooldown: 15000, price: 60 },
  uncommon: { fraction: 0.30, flat: 12, hp: 185, mana: 175, cooldown: 30000, price: 140 },
  rare: { fraction: 0.36, flat: 16, hp: 230, mana: 215, cooldown: 60000, price: 280 },
  story: { fraction: 0.42, flat: 20, hp: 270, mana: 250, cooldown: 90000, price: 440 },
  epic: { fraction: 0.50, flat: 25, hp: 335, mana: 310, cooldown: 120000, price: 750 }
};
const slug = name => name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-');
export const EARLY_POTIONS = Object.entries(tiers).flatMap(([tier, budget]) =>
  names[tier].map((name, index) => {
    const [resource, bias, extra, lore] = blends[index];
    const enhanced = tier === 'story' || tier === 'epic';
    const epic = tier === 'epic';
    const effect = { resource, fraction: Number((budget.fraction + bias).toFixed(2)),
      flat: budget.flat, maxRestore: budget[resource] };
    if (enhanced) {
      if (extra === 'ward') effect.secondary = { kind: 'ward', amount: epic ? 70 : 40, duration: epic ? 10000 : 8000 };
      else if (extra === 'cleanse') effect.secondary = { kind: 'cleanse', count: epic ? 2 : 1 };
      else effect.secondary = { kind: 'restore', resource: extra, fraction: epic ? 0.10 : 0.06, maxRestore: epic ? 65 : 40 };
    }
    return { id: `early-${slug(name)}`, name, slot: 'potion', rarity: tier === 'story' ? 'rare' : tier,
      minimumLevel: epic ? 10 : 1, itemLevel: { common: 3, uncommon: 6, rare: 9, story: 9, epic: 10 }[tier],
      usableBy: index === 14 ? ['All'] : [EARLY_GEAR_CLASSES[index]], uses: 3,
      cooldown: budget.cooldown, price: budget.price, effect,
      description: enhanced ? lore : `A measured ${name.toLowerCase()} brewed for early expeditions beneath Pineshire Reach.` };
  }));
