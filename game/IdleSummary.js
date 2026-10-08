export function idleRewardLines(summary, party, materialName) {
  const rewards = [
    ...Object.entries(summary.materials ?? {}).map(([id, count]) => `${count}x ${materialName(id)}`),
    ...(summary.items ?? []).map(item => `${item.count ?? 1}x ${item.name ?? item.itemId ?? item.id}`)
  ];
  return [
    `- ${summary.waves} waves cleared.`,
    `- You gained ${summary.gold} Gold.`,
    ...party.map(hero => `- ${hero.name} gained ${summary.xpByHero?.[hero.id] ?? summary.xp} Exp.`),
    `- Rewards: ${rewards.length ? rewards.join(', ') : 'None'}.`
  ];
}
