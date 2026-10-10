// This is a browser check for the game. Playwright drives the page while the visual QA
// bridge exposes live Phaser scenes. page.evaluate runs in the browser, not in this test
// process, so values cross that boundary as plain serializable data. Wait for observable
// state before checking it; asset loading and animations take time.

import { mkdir } from 'node:fs/promises';

// We handle review hall here, keeping this operation in one place for its callers. This is
// async: await can pause this function while the rest of the page keeps running. width is
// the available width in this coordinate space.
export async function reviewHall(page, output, width) {
  const ensure = (value, message) => { if (!value) throw new Error(message); };
  const errors = [];

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await mkdir(output, { recursive: true });
  await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__, state = qa.state;
    state.gold = 700;

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const hero = state.roster.find((entry) => entry.id === 'caramon-gladiator');
    hero.level = 6;
    hero.skillPoints = 8;
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
    scene.heroId = hero.id;
    scene.tab = 'gear';
    scene.rosterOffset = 0;
    scene.skillOffset = 0;
    qa.activate('AdventurersHallScene');
  });

  const waitScene = async (key) => page.waitForFunction((key) => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(key).sys.isActive(), key);
  await waitScene('RosterScene');
  const click = async (key, value, byText = false, hold = false) => {
    const point = await page.evaluate(({ key, value, byText }) => {
      const game = window.__DELVE_DEEP_VISUAL_QA__.game, scene = game.scene.getScene(key);
      const flatten = (list) => list.flatMap((object) => [object, ...(object.list ? flatten(object.list) : [])]);

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const object = flatten(scene.children.list).find((object) => byText ? object.text === value : object.name === value);
      if (!object) throw new Error(`Missing Hall control: ${value}`);
      const bounds = object.getBounds(), rect = game.canvas.getBoundingClientRect();

      return { x: rect.x + (bounds.x + bounds.width / 2) * rect.width / 2400, y: rect.y + (bounds.y + bounds.height / 2) * rect.height / 1080 };
    }, { key, value, byText });

    if (hold) {
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.waitForFunction(key => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene(key).selectionDetailsClose), key);
      await page.mouse.up();
    } else await page.mouse.click(point.x, point.y, { delay: 70 });
    await page.waitForTimeout(50);
  };

  const capture = async (name) => page.screenshot({ path: `${output}/hall-${name}-${width}.png` });
  const snapshot = async () => page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('RosterScene');

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const hero = qa.state.roster.find((hero) => hero.id === scene.heroId);
    return { id: hero.id, gold: qa.state.gold, sp: hero.skillPoints, gear: hero.equipment, ranks: hero.abilityRanks, loadout: hero.abilityLoadout,
      tab: scene.tab, offset: scene.rosterOffset, modal: Boolean(scene.selectionDetailsClose || scene.equipmentModalClose),
      selectionModal: Boolean(scene.selectionDetailsClose), equipmentModal: Boolean(scene.equipmentModalClose), message: scene.message };
  });

  const revealSkill = async (key) => page.evaluate((key) => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const row = scene.skillList.container.list.find((object) => object.name === `hall-skill-${key}`);
    scene.skillList.set(row.y - 678);
  }, key);

  const headings = await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry. filter keeps entries whose callback returns
    // true. It builds a new list and leaves the original list in place.
    return scene.rosterList.container.list.filter((object) => ['Tanks', 'Healers', 'Melee DPS', 'Ranged DPS'].includes(object.text)).map((object) => object.text);
  });

  ensure(headings.length === 4, 'All four archetype groups must be present');
  await capture('gear');
  await click('RosterScene', 'hall-slot-weapon', false, true);
  ensure((await snapshot()).modal, 'Holding gear must show details');
  await capture('gear-details');
  await click('RosterScene', 'CLOSE', true);
  await click('RosterScene', 'hall-hero-caramon-gladiator', false, true);

  ensure(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry. filter keeps entries whose callback returns
    // true. It builds a new list and leaves the original list in place.
    const text = scene.children.list.filter(object => object.depth >= 11000).map(object => object.text);
    return text.includes('Known Skills') && text.includes('Roar (Rank 1)') && !text.includes('Throw Net');
  }), 'Registry must show only known skills with their ranks');

  await capture('registry');
  await click('RosterScene', 'CLOSE', true);
  await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const row = scene.rosterList.container.list.find((object) => object.name === 'hall-hero-goldmoon');
    scene.rosterList.set(row.y - 600);
  });

  await click('RosterScene', 'hall-hero-goldmoon', false, true);
  await capture('registry-goldmoon');
  ensure(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');

    // every requires all entries to pass the check; an empty list gives true. filter keeps
    // entries whose callback returns true. It builds a new list and leaves the original
    // list in place.
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
  await click('RosterScene', 'Prev');
  await click('RosterScene', 'hall-compare-gear-901');
  ensure(!(await snapshot()).gear.weapon, 'Comparison must not equip before confirmation');
  await capture('comparison');
  await click('RosterScene', 'CANCEL', true);
  ensure(!(await snapshot()).gear.weapon, 'Cancelled comparison changed gear');

  await click('RosterScene', 'hall-compare-gear-901');

  // Transaction refreshes keep the roster alive instead of recreating every card.
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').rosterList.container.setData('transactionMarker', true));
  await click('RosterScene', 'EQUIP', true);
  ensure((await snapshot()).gear.weapon === 'gear-901', 'Confirmed weapon did not equip');
  await click('RosterScene', 'hall-slot-weapon');
  await click('RosterScene', 'Unequip');
  ensure(!(await snapshot()).gear.weapon, 'Unequip did not clear the weapon');
  await click('RosterScene', 'hall-slot-weapon');
  await click('RosterScene', 'hall-compare-gear-901');
  await click('RosterScene', 'EQUIP', true);
  ensure(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').rosterList.container.getData('transactionMarker')),
    'Gear changes must preserve the roster objects');
  await click('RosterScene', 'hall-slot-potion');
  ensure(!await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').children.list.some((object) => object.name === 'hall-compare-gear-904')), 'Mana pack must be excluded for a non-mana hero');
  await click('RosterScene', 'hall-compare-gear-905');
  await click('RosterScene', 'EQUIP', true);
  ensure((await snapshot()).gear.potion === 'gear-905', 'Potion pack did not equip');

  await capture('equipped');
  await click('RosterScene', 'hall-slot-bonuses-weapon');
  ensure((await snapshot()).modal, 'View Stat Bonuses must open the equipped weapon details');
  await capture('stat-bonuses');
  await click('RosterScene', 'CLOSE', true);
  await click('RosterScene', 'hall-all-stats');
  ensure(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry. filter keeps entries whose callback returns
    // true. It builds a new list and leaves the original list in place.
    const labels = scene.children.list.filter(object => object.name?.startsWith('hall-stat-')).map(object => object.name.slice(10));
    const expected = ['Level', 'Health', 'Mana', 'Armor', 'Dodge', 'Block', 'Speed', 'Strength', 'Agility', 'Constitution', 'Intellect', 'Wisdom', 'Hit Chance', 'Crit Chance', 'Crit Multiplier', 'Attack Power', 'Spell Damage', 'Spell Healing', 'Happiness', 'Delves Cleared'];

    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied. every requires all entries to pass the
    // check; an empty list gives true.
    return JSON.stringify(labels.sort()) === JSON.stringify(expected.sort())
      && ['Progress', 'Attributes', 'Defense', 'Offense'].every(title => scene.children.list.some(object => object.text === title));
  }), 'Character stats must contain exactly the requested stats');

  await capture('stats');
  await click('RosterScene', 'Done');
  ensure(!(await snapshot()).modal, 'Done must close the character stats popup');
  const rect = await page.locator('canvas').boundingBox();
  await page.mouse.move(rect.x + 272 * rect.width / 2400, rect.y + 780 * rect.height / 1080);
  await page.mouse.wheel(0, 300);
  const dragState = await snapshot();
  ensure(dragState.offset > 0 && dragState.id === 'caramon-gladiator' && !dragState.modal,
    `Roster wheel must scroll without selecting or inspecting: ${JSON.stringify(dragState)}`);

  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').rosterList.set(0));
  await click('RosterScene', 'hall-tab-skills');

  await revealSkill('cleave');
  await click('RosterScene', 'hall-equip-skill-cleave');
  ensure(!(await snapshot()).loadout.includes('cleave'), 'Unequip must remove the ability');
  await click('RosterScene', 'hall-equip-skill-cleave');
  ensure((await snapshot()).loadout.includes('cleave'), 'Equip must restore the ability');
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').skillList.set(0));
  ensure(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const hidden = scene.skillList.container.list.find((object) => object.input?.enabled && object.getBounds().y > 982);
    return hidden && !hidden.input.hitAreaCallback(hidden.input.hitArea, hidden.displayOriginX, hidden.displayOriginY, hidden);
  }), 'Masked skill controls must reject off-screen taps');

  await click('RosterScene', 'hall-skill-roar', false, true);
  ensure((await snapshot()).modal, 'Skill held details did not open');
  await click('RosterScene', 'CLOSE', true);
  await revealSkill('cleave');
  const beforeTrain = await snapshot();
  await click('RosterScene', 'hall-train-cleave');
  await click('RosterScene', 'CANCEL', true);
  ensure((await snapshot()).gold === beforeTrain.gold, 'Cancelled training spent gold');

  await click('RosterScene', 'hall-train-cleave');
  await click('RosterScene', 'CONFIRM', true);
  const trained = await snapshot();
  ensure(trained.ranks.cleave === 2 && trained.sp === beforeTrain.sp - 2 && trained.gold < beforeTrain.gold, 'Confirmed training did not apply its rank and costs');
  const fixedSlotY = await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').children.list.find((object) => object.name === 'hall-ability-slot-0').y);

  for (const key of ['net', 'sand']) {
    await revealSkill(key);
    await click('RosterScene', `hall-train-${key}`);
    await click('RosterScene', 'CONFIRM', true);
  }
  ensure((await snapshot()).loadout.length === 4, 'Learning must preserve the four-slot limit');
  await revealSkill('sand');
  await click('RosterScene', 'hall-equip-skill-sand');
  ensure((await snapshot()).loadout.length === 4 && (await snapshot()).message.includes('free a slot'), 'A fifth equipped ability must be refused');
  ensure(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').children.list.find((object) => object.name === 'hall-ability-slot-0').y) === fixedSlotY, 'Skill scrolling moved the fixed battle slots');

  const saved = await snapshot();
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene').skillList.set(0));
  ensure(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    return scene.skillList.container.list.some(object => /^Next rank costs \d+ SP and \d+ Gold to train$/.test(object.text));
  }), 'Training cost must use the requested sentence');

  await capture('skills');
  await revealSkill('cleave');
  await click('RosterScene', 'hall-skill-cleave', false, true);
  ensure(await page.evaluate(() => {
    const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('RosterScene');
    const flatten = list => list.flatMap(object => [object, ...(object.list ? flatten(object.list) : [])]);

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry. filter keeps entries whose callback returns
    // true. It builds a new list and leaves the original list in place.
    const text = flatten(scene.children.list).filter(object => object.depth >= 11000).map(object => object.text).join(' ');

    // Current catalog skills can have one damage amount; conditional skills have a range.
    return /Deal \d+(?:-\d+)? physical damage/.test(text) && text.includes('Range:') && text.includes('Cooldown:');
  }), 'Skill details must show numeric damage, measured reach and cooldown');

  await capture('skill-potency');
  await click('RosterScene', 'CLOSE', true);
  await click('RosterScene', 'hall-nav-items');
  await waitScene('ItemsScene');
  await click('ItemsScene', 'hall-category-materials');
  ensure(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('ItemsScene').children.list.filter((object) => object.name?.startsWith('hall-item-')).length) === 1, 'Inventory must hide zero-count materials');
  await capture('items');
  await click('ItemsScene', 'hall-nav-tactics');
  await waitScene('PartyLeaderScene');

  await click('PartyLeaderScene', 'hall-tactic-brace');
  await click('PartyLeaderScene', 'CONFIRM', true);
  await click('PartyLeaderScene', 'hall-tactic-brace');
  ensure(await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.state.leader.battleLoadout.includes('brace')), 'Tactic unlock/equip did not persist');
  await capture('tactics');
  await click('PartyLeaderScene', 'hall-tactic-brace', false, true);
  ensure(await page.evaluate(() => Boolean(window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('PartyLeaderScene').selectionDetailsClose)),
    'Holding a tactic must open its larger detail popup');
  await capture('tactics-details');

  await click('PartyLeaderScene', 'CLOSE', true);
  await click('PartyLeaderScene', 'hall-nav-adventurers');
  await waitScene('RosterScene');
  ensure((await snapshot()).tab === 'skills' && (await snapshot()).id === saved.id, 'Navigation lost character or detail tab');
  await page.reload();
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  const restored = await page.evaluate(() => {

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const state = window.__DELVE_DEEP_VISUAL_QA__.state, hero = state.roster.find((hero) => hero.id === 'caramon-gladiator');
    return { gold: state.gold, gear: hero.equipment, ranks: hero.abilityRanks, loadout: hero.abilityLoadout, tactics: state.leader.battleLoadout };
  });

  ensure(restored.gold === saved.gold && restored.gear.weapon === 'gear-901' && restored.gear.potion === 'gear-905' && restored.ranks.cleave === 2 && restored.loadout.length === 4 && restored.tactics.includes('brace'), 'Reload lost Hall equipment, training or tactics');
  ensure(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
}
