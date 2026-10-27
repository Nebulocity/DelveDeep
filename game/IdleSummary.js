// These helpers display already banked gains from combat or estimated offline farming.
// The summary never awards a second set of resources when it opens or closes.

export function idleRewardRows(summary, party, materialName) {

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside. map builds one output entry for each input entry, in the same order. The
  // callback's return value becomes that output entry. Object.entries turns own fields
  // into [key, value] pairs so we can visit or transform them.
  const rewards = [
    ...Object.entries(summary.materials ?? {}).map(([id, count]) => ({
      text: `- ${count}x ${materialName(id)}`, item: { id }
    })),
    ...(summary.items ?? []).map(item => ({
      text: `- ${item.count ?? 1}x ${item.name ?? item.itemId ?? item.id}`, item
    }))
  ];

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  return [
    { text: `- ${summary.waves} waves cleared.` },
    { text: `- You gained ${summary.gold} Gold.`, resource: true },
    ...(summary.renownPoints > 0 ? [{ text: `- You gained ${summary.renownPoints} Renown Points and ${summary.renownLevels ?? 0} Renown Levels.` }] : []),
    ...party.map(hero => ({ text: `- ${hero.name} gained ${summary.xpByHero?.[hero.id] ?? summary.xp} Exp.`, resource: true })),
    { text: `- Rewards:${rewards.length ? '' : ' None.'}` },
    ...rewards
  ];
}

export function idleRewardLines(summary, party, materialName) {
  return idleRewardRows(summary, party, materialName).map(row => row.text);
}
