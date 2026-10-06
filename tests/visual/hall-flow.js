import { mkdir } from 'node:fs/promises';

export async function reviewHall(page, output, width) {
  const ensure = (value, message) => { if (!value) throw new Error(message); };
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await mkdir(output, { recursive: true });
  await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__, state = qa.state;
    state.gold = 700;
    const hero = state.roster.find((entry) => entry.id === 'caramon-gladiator');
    hero.level = 6; hero.skillPoints = 8;
    hero.abilityRanks = { roar: 1, cleave: 1, secondWind: 1 };
    hero.abilityLoadout = ['roar', 'cleave', 'secondWind'];
    hero.equipment = {};
    const blade = (id) => ({ id, itemId: 'field-blade', name: 'Field Blade', slot: 'weapon', rarity: 'common', usableBy: ['Gladiator', 'Dawnwarden'], stats: { attackPower: 2 } });
    state.inventory.equipment = [blade('gear-901'), blade('gear-903'), blade('gear-906'), blade('gear-907'), blade('gear-908'), blade('gear-909'),
      { id: 'gear-902', itemId: 'trail-bow', name: 'Trail Bow', slot: 'weapon', rarity: 'common', usableBy: ['Ranger'], stats: { attackPower: 2 } },
      { id: 'gear-904', itemId: 'clarity-potion', name: 'Mana Potion', slot: 'potion', rarity: 'common', charges: 3, stats: {} },
      { id: 'gear-905', itemId: 'mending-potion', name: 'Health Potion', slot: 'potion', rarity: 'common', charges: 3, stats: {} }];
    state.roster.find((entry) => entry.id === 'laurana').equipment = { weapon: 'gear-903' };
    state.inventory.materials = { iron: 4, cloth: 0 };
    state.leader.tacticsPoints = 4;
    const scene = qa.game.scene.getScene('RosterScene');
    scene.heroId = hero.id; scene.tab = 'gear'; scene.rosterOffset = 0; scene.skillOffset = 0;
    qa.activate('AdventurersHallScene');
  });
  const waitScene = async (key) => page.waitForFunction((key) => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(key).sys.isActive(), key);
  await waitScene('RosterScene');
  const click = async (key, value, byText = false, hold = false) => {
    const point = await page.evaluate(({ key, value, byText }) => {
      const game = window.__DELVE_DEEP_VISUAL_QA__.game, scene = game.scene.getScene(key);
      const flatten = (list) => list.flatMap((object) => [object, ...(object.list ? flatten(object.list) : [])]);
      const object = flatten(scene.children.list).find((object) => byText ? object.text === value : object.name === value);
      if (!object) throw new Error(`Missing Hall control: ${value}`);
      const bounds = object.getBounds(), rect = game.canvas.getBoundingClientRect();
      return { x: rect.x + (bounds.x + bounds.width / 2) * rect.width / 2400, y: rect.y + (bounds.y + bounds.height / 2) * rect.height / 1080 };
    }, { key, value, byText });
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    if (hold) await page.waitForTimeout(650);
    await page.mouse.up();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const capture = async (name) => page.screenshot({ path: `${output}/hall-${name}-${width}.png` });
  const snapshot = async () => page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('RosterScene');
    const hero = qa.state.roster.find((hero) => hero.id === scene.heroId);
    return { id: hero.id, gold: qa.state.gold, sp: hero.skillPoints, gear: hero.equipment, ranks: hero.abilityRanks, loadout: hero.abilityLoadout,
      tab: scene.tab, offset: scene.rosterOffset, modal: Boolean(scene.selectionDetailsClose || scene.equipmentModalClose), message: scene.message };
  });
  const revealSkill = async (key) => page.evaluate((key) => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');
    const row = scene.skillList.container.list.find((object) => object.name === `hall-skill-${key}`);
    scene.skillList.set(row.y - 783);
  }, key);
  const headings = await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');
    return scene.rosterList.container.list.filter((object) => ['Tanks', 'Healers', 'Melee DPS', 'Ranged DPS'].includes(object.text)).map((object) => object.text);
  });
  ensure(headings.length === 4, 'All four archetype groups must be present');
  await capture('gear');
  await click('RosterScene', 'hall-slot-weapon', false, true);
  ensure((await snapshot()).modal, 'Holding gear must show details');
  await capture('gear-details');
  await click('RosterScene', 'CLOSE', true);
  await click('RosterScene', 'hall-hero-caramon-gladiator', false, true);
  await capture('registry');
  await click('RosterScene', 'CLOSE', true);
  await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');
    const row = scene.rosterList.container.list.find((object) => object.name === 'hall-hero-goldmoon');
    scene.rosterList.set(row.y - 600);
  });
  await click('RosterScene', 'hall-hero-goldmoon', false, true);
  await capture('registry-goldmoon');
  ensure(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');
    return scene.children.list.filter((object) => object.type === 'Text' && object.depth >= 11000).every((object) => {
      const bounds = object.getBounds();
      return bounds.x >= 420 && bounds.right <= 1980 && bounds.y >= 55 && bounds.bottom <= 1025;
    });
  }), 'Guild registry text must stay within its framed popup');
  await click('RosterScene', 'CLOSE', true);
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').rosterList.set(0));
  await click('RosterScene', 'hall-slot-weapon');
  const compareNames = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').children.list.filter((object) => object.name?.startsWith('hall-compare-')).map((object) => object.name));
  ensure(compareNames.length === 3 && !compareNames.includes('hall-compare-gear-902') && !compareNames.includes('hall-compare-gear-903'), 'Picker must exclude incompatible and assigned equipment');
  await capture('picker');
  await click('RosterScene', 'Next >');
  ensure(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').children.list.some((object) => object.name === 'hall-compare-gear-909')), 'Equipment pagination must reach the final copy');
  await click('RosterScene', '< Prev');
  await click('RosterScene', 'hall-compare-gear-901');
  ensure(!(await snapshot()).gear.weapon, 'Comparison must not equip before confirmation');
  await capture('comparison');
  await click('RosterScene', 'CANCEL', true);
  ensure(!(await snapshot()).gear.weapon, 'Cancelled comparison changed gear');
  await click('RosterScene', 'hall-compare-gear-901');
  await click('RosterScene', 'EQUIP', true);
  ensure((await snapshot()).gear.weapon === 'gear-901', 'Confirmed weapon did not equip');
  await click('RosterScene', 'hall-slot-potion');
  ensure(!await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').children.list.some((object) => object.name === 'hall-compare-gear-904')), 'Mana pack must be excluded for a non-mana hero');
  await click('RosterScene', 'hall-compare-gear-905'); await click('RosterScene', 'EQUIP', true);
  ensure((await snapshot()).gear.potion === 'gear-905', 'Potion pack did not equip');
  await click('RosterScene', 'hall-all-stats'); await capture('stats'); await click('RosterScene', 'Done');
  const rect = await page.locator('canvas').boundingBox();
  await page.mouse.move(rect.x + 272 * rect.width / 2400, rect.y + 780 * rect.height / 1080);
  await page.mouse.down(); await page.mouse.move(rect.x + 272 * rect.width / 2400, rect.y + 480 * rect.height / 1080, { steps: 8 }); await page.mouse.up();
  ensure((await snapshot()).offset > 0 && (await snapshot()).id === 'caramon-gladiator' && !(await snapshot()).modal, 'Roster drag must scroll without selecting or inspecting');
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').rosterList.set(0));
  await click('RosterScene', 'hall-tab-skills');
  ensure(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');
    const hidden = scene.skillList.container.list.find((object) => object.input?.enabled && object.getBounds().y > 982);
    return hidden && !hidden.input.hitAreaCallback(hidden.input.hitArea, hidden.displayOriginX, hidden.displayOriginY, hidden);
  }), 'Masked skill controls must reject off-screen taps');
  await click('RosterScene', 'hall-skill-roar', false, true);
  ensure((await snapshot()).modal, 'Skill held details did not open');
  await click('RosterScene', 'CLOSE', true);
  await revealSkill('cleave');
  const beforeTrain = await snapshot();
  await click('RosterScene', 'hall-train-cleave'); await click('RosterScene', 'CANCEL', true);
  ensure((await snapshot()).gold === beforeTrain.gold, 'Cancelled training spent gold');
  await click('RosterScene', 'hall-train-cleave'); await click('RosterScene', 'CONFIRM', true);
  const trained = await snapshot();
  ensure(trained.ranks.cleave === 2 && trained.sp === beforeTrain.sp - 2 && trained.gold < beforeTrain.gold, 'Confirmed training did not apply its rank and costs');
  const fixedSlotY = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').children.list.find((object) => object.name === 'hall-ability-slot-0').y);
  for (const key of ['net', 'sand']) {
    await revealSkill(key); await click('RosterScene', `hall-train-${key}`); await click('RosterScene', 'CONFIRM', true);
  }
  ensure((await snapshot()).loadout.length === 4, 'Learning must preserve the four-slot limit');
  await revealSkill('sand'); await click('RosterScene', 'hall-equip-skill-sand');
  ensure((await snapshot()).loadout.length === 4 && (await snapshot()).message.includes('free a slot'), 'A fifth equipped ability must be refused');
  ensure(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').children.list.find((object) => object.name === 'hall-ability-slot-0').y) === fixedSlotY, 'Skill scrolling moved the fixed battle slots');
  const saved = await snapshot();
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').skillList.set(0));
  await capture('skills');
  await click('RosterScene', 'hall-nav-items'); await waitScene('ItemsScene');
  await click('ItemsScene', 'hall-category-materials');
  ensure(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('ItemsScene').children.list.filter((object) => object.name?.startsWith('hall-item-')).length) === 1, 'Inventory must hide zero-count materials');
  await capture('items');
  await click('ItemsScene', 'hall-nav-tactics'); await waitScene('RaidLeaderScene');
  await click('RaidLeaderScene', 'hall-tactic-brace'); await click('RaidLeaderScene', 'CONFIRM', true); await click('RaidLeaderScene', 'hall-tactic-brace');
  ensure(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.leader.battleLoadout.includes('brace')), 'Tactic unlock/equip did not persist');
  await capture('tactics');
  await click('RaidLeaderScene', 'hall-nav-adventurers'); await waitScene('RosterScene');
  ensure((await snapshot()).tab === 'skills' && (await snapshot()).id === saved.id, 'Navigation lost character or detail tab');
  await page.reload();
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  const restored = await page.evaluate(() => {
    const state = window.__DELVE_DEEP_VISUAL_QA__.state, hero = state.roster.find((hero) => hero.id === 'caramon-gladiator');
    return { gold: state.gold, gear: hero.equipment, ranks: hero.abilityRanks, loadout: hero.abilityLoadout, tactics: state.leader.battleLoadout };
  });
  ensure(restored.gold === saved.gold && restored.gear.weapon === 'gear-901' && restored.gear.potion === 'gear-905' && restored.ranks.cleave === 2 && restored.loadout.length === 4 && restored.tactics.includes('brace'), 'Reload lost Hall equipment, training or tactics');
  ensure(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
}
