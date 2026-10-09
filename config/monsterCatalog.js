// These authored totals follow the revised monster catalog. Unlisted fields keep the
// existing movement, critical-hit and shared stat defaults; monsters do not gain hero growth.
// Each row is [Health, Armor, Attack Power, basic reach category, destination level].
export const MONSTER_CATALOG = {
  caveSlime: [2400, 80, 25, 'Adjacent', 1],
  elderSlime: [7000, 120, 28, 'Adjacent', 1],
  slimeSovereign: [24000, 160, 230, 'Adjacent', 1],
  ruffian: [2600, 250, 32, 'Adjacent', 3],
  lasher: [4200, 275, 48, 'Ranged', 3],
  hedgeMage: [5800, 200, 64, 'Ranged', 3],
  rongarTheCrusher: [36000, 310, 275, 'Adjacent', 3],
  denWarden: [3000, 285, 38, 'Adjacent', 6],
  denProtector: [4600, 310, 52, 'Adjacent', 6],
  denColossus: [6200, 375, 76, 'Adjacent', 6],
  silvanarkTheForestLord: [42000, 420, 325, 'Adjacent', 6],
  quarryWorm: [5200, 600, 52, 'Adjacent', 12],
  quarryReaver: [7000, 700, 94, 'Adjacent', 12],
  quarryBehemoth: [9000, 800, 108, 'Adjacent', 12],
  depthsSovereign: [67000, 950, 500, 'Ranged', 12],
  sunkenWatcher: [3600, 315, 45, 'Ranged', 16],
  drownedKnell: [4900, 420, 65, 'Ranged', 16],
  deepTongue: [6800, 505, 85, 'Ranged', 16],
  earthsinker: [50000, 800, 375, 'Ranged', 16],
  voidWisp: [8000, 0, 13, 'Ranged', 20],
  voidCrawler: [10000, 0, 16, 'Adjacent', 20],
  voidStalker: [13000, 0, 19, 'Adjacent', 20],
  voidKeeper: [15000, 160, 230, 'Adjacent', 20],
  abyssalSovereign: [84000, 0, 19, 'Adjacent', 20]
};

// Potency is a percentage of Attack Power or Spell Damage. Seconds become milliseconds
// here because battle timers use milliseconds. Extra fields describe targeting or effects.
function strike(name, potency, cooldown, windup, damageType = 'physical', extra = {}) {
  return { name, power: potency, powerUnit: 'percent', damageType, manaCost: 0,
    cooldown: cooldown * 1000, windup: windup * 1000, animation: 'cast', ...extra };
}

// Circles use logical arena units and one warning phase, rather than adding cast and
// telegraph times together. Player-response attacks disable automatic warning dodges.
function circle(name, potency, cooldown, warning, radius, damageType = 'physical', extra = {}) {
  return strike(name, potency, cooldown, warning, damageType,
    { telegraph: warning * 1000, radius, castRange: 300, animation: 'attack', ...extra });
}

// Authored potency and behavior take precedence over stale flat damage in the workbook.
// Missing named skills use provisional 120-180% attacks and 300% boss finales. All costs
// stay at zero mana until a mana economy is authored for these monsters.
export const MONSTER_SKILLS = {
  lasher: { primary: strike('Whip Lash', 100, 2, 0.5, 'physical', { animation: 'attack' }) },
  hedgeMage: {
    primary: strike('Bramble Shroud', 100, 5, 2, 'spell', { animation: 'attack' }),
    secondary: strike('Briar Bolt', 214.2857142857143, 3, 1, 'spell', { animation: 'attack' })
  },
  rongarTheCrusher: {
    primary: circle('Mace Sweep', 137.5, 6, 2, 145),
    secondary: circle('Intimidating Stomp', 156, 6, 1.25, 145, 'physical',
      { areaCenter: 'caster', stunDuration: 3000, allowCrit: true }),
    tertiary: circle('Belch', 160, 10, 3, 300, 'spell', { areaCenter: 'caster', stunDuration: 3000 })
  },
  denProtector: { primary: circle('Bark Slam', 180, 5.4, 1.35, 165, 'physical', { castRange: 220 }) },
  denColossus: {
    primary: strike('Vine Lash', 158.8235294117647, 5.4, 0.75),
    secondary: circle('Briar Storm', 105.88235294117647, 7.2, 1.35, 165, 'spell')
  },
  silvanarkTheForestLord: {
    primary: strike('Root Lance', 100, 2, 0.4, 'physical', { castRange: 500, animation: 'attack' }),
    secondary: circle('Shatterbark', 180, 10, 2, 250, 'physical', { areaCenter: 'caster' }),
    tertiary: circle('Forest Quake', 300, 16, 6, 500, 'physical',
      { castRange: Number.MAX_SAFE_INTEGER, areaCenter: 'caster', autoAvoid: false })
  },
  quarryWorm: {
    primary: strike('Grinding Maw', 120, 5, 0.8, 'physical', { animation: 'attack', castRange: 100 }),
    secondary: strike('Stone Spit', 150, 8, 1.2)
  },
  quarryReaver: {
    primary: strike('Shard Rend', 150, 6, 1, 'physical', { animation: 'attack', castRange: 100 }),
    secondary: strike('Crystal Lance', 180, 9, 1.5, 'spell')
  },
  quarryBehemoth: {
    primary: strike('Boulder Smash', 180, 6, 1.5, 'physical', { animation: 'attack', castRange: 100 }),
    secondary: circle('Fault Stomp', 150, 10, 2, 240, 'physical', { areaCenter: 'caster' })
  },
  depthsSovereign: {
    primary: strike('Crown of Spikes', 150, 8, 2, 'spell'),
    secondary: circle('Seismic Rupture', 180, 14, 3, 240),
    tertiary: circle("Mountain's Wrath", 300, 30, 6, 500, 'physical',
      { castRange: Number.MAX_SAFE_INTEGER, areaCenter: 'caster', autoAvoid: false })
  },
  sunkenWatcher: {
    primary: strike('Ghostly Slash', 120, 5, 1, 'spell'),
    secondary: strike('Seaspray Orb', 150, 8, 1.5, 'spell')
  },
  drownedKnell: {
    primary: strike('Diseased Bite', 120, 5, 1, 'physical', { animation: 'attack', castRange: 100 }),
    secondary: strike('Venom Spit', 150, 8, 1.5)
  },
  deepTongue: {
    primary: strike('Lure', 120, 8, 2, 'spell'),
    secondary: strike('Enthralled Bite', 180, 6, 1, 'physical', { animation: 'attack', castRange: 100 })
  },
  earthsinker: {
    primary: circle('Call the Deep', 150, 10, 2, 190, 'spell'),
    secondary: circle('Sinkhole', 180, 14, 3, 240),
    tertiary: circle('Boulder Splash', 300, 30, 6, 500, 'physical',
      { castRange: Number.MAX_SAFE_INTEGER, areaCenter: 'caster', autoAvoid: false })
  },
  voidWisp: { primary: strike('Void Lance', 130.76923076923077, 5.2, 0.6, 'spell') },
  voidCrawler: {
    primary: strike('Dark Bolt', 130.76923076923077, 5.2, 0.6, 'spell'),
    secondary: strike('Rift Crush', 100, 1.18, 0.31, 'spell', { animation: 'attack', castRange: 86 })
  },
  voidStalker: {
    primary: circle('Abyssal Collapse', 168.75, 5.6, 1.25, 150, 'physical', { animation: 'leap', castRange: 220 }),
    secondary: strike('Soul Rend', 125, 6.8, 0.72, 'physical', { animation: 'leap' })
  },
  voidKeeper: {
    primary: strike('Crushing Emptiness', 100, 1.18, 0.36, 'physical', { animation: 'attack', castRange: 92 }),
    secondary: circle('Stasis Beam', 178.94736842105263, 5.2, 1.45, 190, 'physical',
      { animation: 'area', castRange: 220 })
  }
};
