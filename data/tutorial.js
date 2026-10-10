// This is the tutorial slide list: video URLs, labels and captions. The slideshow loads a
// clip when its slide is shown and disposes it when leaving that slide.

export const tutorialSlides = [
  {
    title: 'Visit Pineshire',
    caption: 'Visit Pineshire to explore the Adventurer\'s Hall and shops. Then tap The Slime Cave on the world map to travel there.',
    video: new URL('../assets/tutorial/town.mp4', import.meta.url).href
  },

  {
    title: 'Choose your party',
    caption: 'Choose five adventurers: up to one Tank, two Healers, and four DPS. Your party fights automatically; select adventurers and give orders to guide them.',
    video: new URL('../assets/tutorial/party-select.mp4', import.meta.url).href
  },

  {
    title: 'Use battle tactics',
    caption: 'Tap a ready tactic to help your party. Focus Fire is known from the start. Learn more tactics in town as your Renown Level increases.',
    video: new URL('../assets/tutorial/tactics.mp4', import.meta.url).href
  },

  {
    title: 'Make camp and farm',
    caption: 'At camp, return to town, farm for XP and loot, or face the boss. Cancel Farm returns to camp after the current wave clears and pays its rewards.',
    video: new URL('../assets/tutorial/farm.mp4', import.meta.url).href
  },

  {
    title: 'Explore the Everdeep',
    caption: 'Defeat Delve bosses to open new roads and unlock the Everdeep. Send five adventurers on an expedition for treasure. Clear the region\'s Void Portal to open the road onward.',
    video: new URL('../assets/tutorial/everdeep.mp4', import.meta.url).href
  }
];
