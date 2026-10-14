// Each short clip teaches one part of the game. The pointer, press pulse and gentle zoom
// are baked into the videos, so they also appear during offline Android playback.

export const tutorialSlides = [
  {
    title: 'Visit Pineshire and the Hall',
    caption: 'Tap Pineshire, then the Adventurer\'s Hall sign. Follow the pointer; the gold PRESS pulse marks each tap.',
    video: new URL('../assets/tutorial/town.mp4', import.meta.url).href
  },
  {
    title: 'Inspect an adventurer',
    caption: 'Tap an adventurer to select them. Hold their card to read their stats and known skills, then tap Close.',
    video: new URL('../assets/tutorial/inspect.mp4', import.meta.url).href
  },
  {
    title: 'Equip gear and potions',
    caption: 'Choose an adventurer, tap Equip beside a slot, then Equip an owned item. Only compatible gear is offered.',
    video: new URL('../assets/tutorial/equipment.mp4', import.meta.url).href
  },
  {
    title: 'Train an ability',
    caption: 'Open Abilities, tap Train, and confirm the Gold and skill point cost. Higher ranks require higher character levels.',
    video: new URL('../assets/tutorial/abilities.mp4', import.meta.url).href
  },
  {
    title: 'Learn and equip an ability',
    caption: 'Tap Learn and confirm. New skills fill an empty slot; use Unequip and Equip to change your four-ability battle loadout.',
    video: new URL('../assets/tutorial/learn-ability.mp4', import.meta.url).href
  },
  {
    title: 'Unlock and equip a tactic',
    caption: 'Open Tactics. Spend your starting Renown Point on Focus!, confirm, then tap it again to equip it for battle.',
    video: new URL('../assets/tutorial/tactics-town.mp4', import.meta.url).href
  },
  {
    title: 'Buy potion packs',
    caption: 'Visit the Alchemist, choose Buy, and purchase a potion pack. Equip it in the Hall before entering a Delve.',
    video: new URL('../assets/tutorial/alchemist.mp4', import.meta.url).href
  },
  {
    title: 'Buy equipment',
    caption: 'Visit the Blacksmith, choose Buy, and browse a category. Purchased gear goes into your inventory for equipping.',
    video: new URL('../assets/tutorial/blacksmith.mp4', import.meta.url).href
  },
  {
    title: 'Craft from recipes',
    caption: 'Choose Craft at the Blacksmith. Hold a recipe to inspect it, then craft with the listed materials and Gold.',
    video: new URL('../assets/tutorial/crafting.mp4', import.meta.url).href
  },
  {
    title: 'Enchant your gear',
    caption: 'At the Enchanter, choose Enchant, select an owned scroll, then choose compatible gear. The scroll is consumed.',
    video: new URL('../assets/tutorial/enchanter.mp4', import.meta.url).href
  },
  {
    title: 'Travel to a Delve',
    caption: 'Return to the World Map and tap The Slime Cave in Destinations. Your party follows the road to its entrance.',
    video: new URL('../assets/tutorial/map-travel.mp4', import.meta.url).href
  },
  {
    title: 'Review the Delve',
    caption: 'Hold Delve Info to read its difficulty, preparation needs, and possible drops. Close it, then tap Party Select.',
    video: new URL('../assets/tutorial/delve-info.mp4', import.meta.url).href
  },
  {
    title: 'Choose five adventurers',
    caption: 'Tap five adventurers: at most one Tank, two Healers, and four DPS. Tap Battle Overview when your lineup is ready.',
    video: new URL('../assets/tutorial/party-select.mp4', import.meta.url).href
  },
  {
    title: 'Review and enter battle',
    caption: 'Hold a party member to review their gear and skills. Check your tactics, then tap Delve Deep! to begin.',
    video: new URL('../assets/tutorial/battle-overview.mp4', import.meta.url).href
  },
  {
    title: 'Pause and move your party',
    caption: 'Your party fights automatically. Pause to plan: tap All, Move, then a floor destination. Resume to watch the order.',
    video: new URL('../assets/tutorial/battle-move.mp4', import.meta.url).href
  },
  {
    title: 'Choose an attack target',
    caption: 'Select a role group, tap Attack, then tap an enemy. Resume combat. You can also select one adventurer by their card.',
    video: new URL('../assets/tutorial/battle-attack.mp4', import.meta.url).href
  },
  {
    title: 'Use your battle tactics',
    caption: 'Tap Focus!, then an enemy. Brace! protects the party without a target. Tactics queued on Pause take effect on Resume.',
    video: new URL('../assets/tutorial/tactics.mp4', import.meta.url).href
  },
  {
    title: 'Use an equipped potion',
    caption: 'Hold Potion on a party card to inspect its pack. Tap it to restore that adventurer\'s resource and spend one use.',
    video: new URL('../assets/tutorial/potions.mp4', import.meta.url).href
  },
  {
    title: 'Farm from camp',
    caption: 'Clear the pre-boss waves to reach camp. Farm repeats a cleared wave. Cancel Farm and confirm to stop after the current fight.',
    video: new URL('../assets/tutorial/farm.mp4', import.meta.url).href
  },
  {
    title: 'Face the boss',
    caption: 'At camp, Face the Boss begins the final challenge. Win to open the next road and earn Renown. Banked wave rewards stay saved.',
    video: new URL('../assets/tutorial/boss.mp4', import.meta.url).href
  },
  {
    title: 'Begin an Everdeep expedition',
    caption: 'Defeat the Sunken Watch boss to unlock the Everdeep. Choose five adventurers, browse More Adventurers, then buy a 120 Gold writ.',
    video: new URL('../assets/tutorial/everdeep.mp4', import.meta.url).href
  },
  {
    title: 'Claim treasure and recall',
    caption: 'Every ten cleared Everdeep waves earns a chest. Claim it, or recall early. Claim all earned chests before dismissing an expedition.',
    video: new URL('../assets/tutorial/everdeep-rewards.mp4', import.meta.url).href
  }
];
