// These helpers display already banked gains from combat or estimated offline farming.
// The summary never awards a second set of resources when it opens or closes.

export function idleRewardLines(summary, party, materialName) {

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside. map builds one output entry for each input entry, in the same order. The
  // callback's return value becomes that output entry. Object.entries turns own fields
  // into [key, value] pairs so we can visit or transform them.
  const rewards = [
    ...Object.entries(summary.materials ?? {}).map(([id, count]) => `${count}x ${materialName(id)}`),
    ...(summary.items ?? []).map(item => `${item.count ?? 1}x ${item.name ?? item.itemId ?? item.id}`)
  ];

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  return [
    `- ${summary.waves} waves cleared.`,
    `- You gained ${summary.gold} Gold.`,
    ...(summary.renownPoints > 0 ? [`- You gained ${summary.renownPoints} Renown Points and ${summary.renownLevels ?? 0} Renown Levels.`] : []),
    ...party.map(hero => `- ${hero.name} gained ${summary.xpByHero?.[hero.id] ?? summary.xp} Exp.`),
    `- Rewards: ${rewards.length ? rewards.join(', ') : 'None'}.`
  ];
}
