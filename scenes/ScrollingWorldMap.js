import GameState from '../game/GameState.js';
import delves from '../data/delves.js';
import { saveProfile } from '../game/GameStorage.js';
import HapticsService from '../services/HapticsService.js';
import { bindSelectionDetails, addDetailsHint, delveDetails, showSelectionDetails } from '../ui/SelectionDetails.js';
import { TILE, WORLD_COLUMNS, WORLD_ROWS, regions, nodes, roads, pois, nodePoint, roadPoint, mapPoint, branchLock, regionExit, routeBetween, routeFromEdge, nearestTown } from '../data/worldMap.js';
import { everdeepUnlocked, settleEverdeep } from '../game/Everdeep.js';

const DELVES = Object.fromEntries(delves.map((delve) => [delve.id, delve]));
const POI_DELVES = Object.fromEntries(pois.filter((poi) => poi.template).map((poi) => [poi.id, {
  ...DELVES[poi.template], id: poi.id, encounterId: poi.template, name: poi.name,
  subtitle: poi.subtitle ?? DELVES[poi.template]?.subtitle,
  prerequisites: poi.requiresClear ? [poi.requiresClear] : [], requiresLocation: null,
}]));
const SPEED = 560;

const cleared = (id) => GameState.development.unlockAll || GameState.world.clearedDelves.includes(id)
  || (GameState.records[id]?.clears ?? 0) > 0;

export function available(poi) {
  if (!poi) return false;
  if (GameState.development.unlockAll) return true;
  if (poi.type === 'everdeep') return everdeepUnlocked();
  return !poi.requiresClear || cleared(poi.requiresClear);
}

function drawWorld(scene) {
  scene.add.image(0, 0, 'world-pineshire-final').setOrigin(0)
    .setDisplaySize(WORLD_COLUMNS * TILE, WORLD_ROWS * TILE).setDepth(0);
  if (!cleared(branchLock.requiresClear)) {
    const point = mapPoint(branchLock.position);
    scene.add.rectangle(point.x, point.y, 160, 100, 0x25201c, 0.95)
      .setStrokeStyle(5, 0xc7a76b).setDepth(90);
    scene.add.text(point.x, point.y, 'LOCKED', { fontFamily: 'Arial', fontSize: '32px',
      fontStyle: 'bold', color: '#ffe2a2' }).setOrigin(0.5).setDepth(91);
  }
  const exit = mapPoint(regionExit.position);
  const open = cleared(regionExit.requiresClear);
  const sign = scene.add.text(exit.x, exit.y, open ? 'HIGHMERE →' : 'PORTAL LOCK', {
    fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: open ? '#c9f2d3' : '#d7b3eb',
    backgroundColor: '#18231dee', padding: { x: 16, y: 14 }
  }).setOrigin(1, 0.5).setDepth(170).setInteractive({ useHandCursor: true });
  bindSelectionDetails(scene, sign, { title: 'ROAD TO HIGHMERE CRAGS', description: open
    ? 'The Murmuring Abyss is defeated and the road is open. Travel to Highmere Crags will be available in a future update.'
    : 'Defeat The Murmuring Abyss to open the road to Highmere Crags.' }, () => {
    HapticsService.tap();
    scene.showToast(open ? 'Road opened. Highmere Crags is coming next.' : 'Defeat The Murmuring Abyss to open this road.');
  }, undefined, { allowSceneInput: true });
}

function createParty(scene) {
  const savedEdge = roads.find((edge) => edge.id === GameState.world.travel?.edgeId);
  const t = Math.max(0, Math.min(1, GameState.world.travel?.t ?? 0));
  const start = savedEdge ? roadPoint(savedEdge, t) : nodePoint(GameState.world.currentLocation) ?? nodePoint('pineshire');
  const { x, y } = start;
  scene.party = scene.add.sprite(x, y, 'world-party-idle', 0)
    .setDisplaySize(136, 136).setOrigin(0.5, 0.78).setDepth(500);
  scene.partyNode = savedEdge ? null : (nodes[GameState.world.currentLocation] ? GameState.world.currentLocation : 'pineshire');
  scene.activeEdge = savedEdge ?? null;
  scene.edgeT = savedEdge ? t : 0;
  scene.travelRoute = [];
  scene.destination = null;
  scene.edgeTarget = savedEdge ? (GameState.world.travel?.target === savedEdge.from ? savedEdge.from : savedEdge.to) : null;
  if (savedEdge && GameState.world.travel?.destinationId) {
    const destination = pois.find((poi) => poi.id === GameState.world.travel.destinationId);
    const path = destination && routeBetween(scene.edgeTarget, destination.node, cleared);
    if (path && available(destination)) { scene.destination = destination; scene.travelRoute = path.slice(1); }
  }
  if (!scene.anims.exists('world-party-idle-south-east')) {
    for (const [index, facing] of ['south-east', 'south-west', 'north-east', 'north-west'].entries()) {
      scene.anims.create({ key: `world-party-idle-${facing}`,
        frames: scene.anims.generateFrameNumbers('world-party-idle', { start: index * 4, end: index * 4 + 3 }),
        frameRate: 5, repeat: -1 });
      scene.anims.create({ key: `world-party-walk-${facing}`,
        frames: scene.anims.generateFrameNumbers('world-party-walk', { start: index * 8, end: index * 8 + 7 }),
        frameRate: 9, repeat: -1 });
    }
  }
  scene.partyFacing = 'south-east';
  scene.party.play(savedEdge ? 'world-party-walk-south-east' : 'world-party-idle-south-east');
  scene.partyLabel = scene.add.text(x, y + 92, 'PARTY', { fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', color: '#ffffff', stroke: '#142019', strokeThickness: 5 })
    .setOrigin(0.5).setDepth(510);
}

function renderPois(scene) {
  for (const poi of pois) {
    const point = nodePoint(poi.node);
    const unlocked = available(poi);
    const label = mapPoint(poi.label);
    const color = poi.type === 'everdeep' ? 0x257d79 : poi.type === 'void' ? 0x9247bb : poi.type === 'town' ? 0xd5a84f : 0x738db7;
    scene.add.circle(label.x, label.y + 58, 22, unlocked ? color : 0x415047, 0.95)
      .setStrokeStyle(4, unlocked ? 0xf4eac9 : 0x738278).setDepth(160);
    const nameplate = scene.add.text(label.x, label.y, `${unlocked ? '' : 'LOCKED · '}${poi.name}`, {
      fontFamily: 'Georgia', fontSize: '36px', fontStyle: 'bold', color: unlocked ? '#fff1d1' : '#bcc4bb',
      stroke: '#142019', strokeThickness: 5, backgroundColor: '#16241bee', padding: { x: 18, y: 12 }
    }).setOrigin(0.5).setDepth(170).setInteractive({ useHandCursor: true });
    if (cleared(poi.id) && (poi.type === 'delve' || poi.type === 'void')) {
      scene.add.text(label.x, label.y + 58, '✓', { fontFamily: 'Arial', fontSize: '34px', color: '#a8efb4', stroke: '#142019', strokeThickness: 5 })
        .setOrigin(0.5).setDepth(180);
    }
    const hit = scene.add.circle(point.x, point.y - 100, 145, 0xffffff, 0.001).setDepth(900);
    const details = () => poi.type === 'delve' || poi.type === 'void'
      ? delveDetails(POI_DELVES[poi.id] ?? DELVES[poi.id])
      : poi.type === 'everdeep' ? { title: poi.name, description: everdeepUnlocked()
        ? 'Send five adventurers on a timed expedition. A Writ costs 120 Gold; chests are earned every ten successful waves.'
        : 'Defeat the boss of The Sunken Watch to unlock the Everdeep branch.' }
      : { title: poi.name, description: 'Visit town to prepare your party.', image: poi.conceptArt };
    bindSelectionDetails(scene, hit, details, () => selectPoi(scene, poi), undefined, { allowSceneInput: true });
    bindSelectionDetails(scene, nameplate, details, () => selectPoi(scene, poi), undefined, { allowSceneInput: true });
  }
}

export function selectPoi(scene, poi) {
  HapticsService.tap();
  if (!available(poi)) {
    const required = pois.find((entry) => entry.id === poi.requiresClear);
    scene.showToast(`Defeat the boss of ${required?.name ?? 'the preceding Delve'} to unlock this location.`);
    return;
  }
  const path = scene.activeEdge
    ? routeFromEdge(scene.activeEdge.id, scene.edgeT, poi.node, cleared)
    : routeBetween(scene.partyNode, poi.node, cleared);
  if (!path) {
    scene.showToast('Clear the preceding Delve bosses to open the road.');
    return;
  }
  if (poi.template && !GameState.world.discoveredLocations.includes(poi.id)) {
    GameState.world.discoveredLocations.push(poi.id);
    saveProfile();
  }
  scene.travelRoute = path.slice(1);
  scene.destination = poi;
  scene.cameras.main.startFollow(scene.party, false, 0.09, 0.09);
  if (scene.activeEdge) {
    scene.edgeTarget = path[0];
    scene.party.play(`world-party-walk-${scene.partyFacing}`, true);
  } else if (path.length === 1) {
    arrive(scene);
  } else {
    advanceEdge(scene);
  }
  persistTravel(scene);
}

function advanceEdge(scene) {
  if (!scene.travelRoute.length) return arrive(scene);
  const next = scene.travelRoute.shift();
  const edge = roads.find((candidate) => (candidate.from === scene.partyNode && candidate.to === next)
    || (candidate.to === scene.partyNode && candidate.from === next));
  if (!edge) return;
  scene.activeEdge = edge;
  scene.edgeTarget = next;
  scene.edgeT = edge.from === scene.partyNode ? 0 : 1;
  scene.partyNode = null;
  scene.party.play(`world-party-walk-${scene.partyFacing}`, true);
}

function arrive(scene) {
  scene.party.play(`world-party-idle-${scene.partyFacing}`, true);
  const poi = scene.destination;
  scene.destination = null;
  if (!poi) return;
  GameState.world.currentLocation = poi.id;
  GameState.world.travel = null;
  if (!GameState.world.discoveredLocations.includes(poi.id)) GameState.world.discoveredLocations.push(poi.id);
  saveProfile();
  if (poi.type === 'town') return scene.scene.start('TownScene', { townId: poi.id, townName: poi.name });
  if (poi.type === 'everdeep') {
    settleEverdeep();
    return scene.scene.start('EverdeepScene');
  }
  if (poi.type === 'waypoint') return;
  const delve = POI_DELVES[poi.id] ?? DELVES[poi.id];
  GameState.currentDelve = { ...delve, returnTownId: nearestTown(poi.node, cleared, available)?.id ?? 'pineshire' };
  GameState.currentRoom = 0;
  scene.scene.start('DelveSelectScene');
}

export function createScrollingWorldMap(scene) {
  settleEverdeep();
  const { width, height } = scene.scale;
  scene.cameras.main.setBackgroundColor('#233b2b');
  drawWorld(scene);
  createParty(scene);
  renderPois(scene);
  scene.cameras.main.setBounds(0, 0, WORLD_COLUMNS * TILE, WORLD_ROWS * TILE);
  scene.cameras.main.startFollow(scene.party, false, 0.09, 0.09);
  scene.cameras.main.setFollowOffset(0, height * 0.22);
  scene.cameras.main.centerOn(scene.party.x, scene.party.y - height * 0.22);
  scene.add.rectangle(width / 2, 58, width, 116, 0x070b10, 0.9).setScrollFactor(0).setDepth(1000);
  scene.add.text(58, 18, 'DELVE DEEP', { fontFamily: 'Arial', fontSize: '54px', fontStyle: 'bold', color: '#f8fafc' })
    .setScrollFactor(0).setDepth(1001);
  scene.regionText = scene.add.text(58, 69, 'WORLD MAP', { fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#94a3b8' })
    .setScrollFactor(0).setDepth(1001);
  scene.currencyText = scene.add.text(width - 58, 26, `Gold: ${GameState.gold}`, {
    fontFamily: 'Arial', fontSize: '31px', fontStyle: 'bold', color: '#fbbf24'
  }).setOrigin(1, 0).setScrollFactor(0).setDepth(1001);
  const recenter = scene.add.rectangle(width - 185, height - 65, 300, 100, 0x142a23, 0.96)
    .setStrokeStyle(3, 0x9cc5ad).setScrollFactor(0).setDepth(1000)
    .setInteractive({ useHandCursor: true });
  scene.add.text(width - 185, height - 65, 'FIND PARTY', {
    fontFamily: 'Arial', fontSize: '38px', fontStyle: 'bold', color: '#f1f8ec'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
  recenter.on('pointerdown', (pointer, x, y, event) => {
    event?.stopPropagation?.();
    HapticsService.tap();
    scene.cameras.main.startFollow(scene.party, false, 0.09, 0.09);
  });
  let drag = null;
  const startDrag = (pointer, objects) => {
    if (scene.selectionDetailsClose || objects.some((object) => object.scrollFactorX === 0 || object.depth >= 1000)) return;
    drag = { id: pointer.id, x: pointer.x, y: pointer.y, startX: pointer.x, startY: pointer.y, moving: false };
  };
  const moveDrag = (pointer) => {
    if (!drag || drag.id !== pointer.id || !pointer.isDown) return;
    if (!drag.moving && Math.hypot(pointer.x - drag.startX, pointer.y - drag.startY) <= 24) return;
    drag.moving = true;
    const dx = pointer.x - drag.x;
    const dy = pointer.y - drag.y;
    if (!dx && !dy) return;
    scene.cameras.main.stopFollow();
    scene.cameras.main.setScroll(
      Math.max(0, Math.min(WORLD_COLUMNS * TILE - width, scene.cameras.main.scrollX - dx)),
      Math.max(0, Math.min(WORLD_ROWS * TILE - height, scene.cameras.main.scrollY - dy))
    );
    drag.x = pointer.x;
    drag.y = pointer.y;
  };
  const endDrag = () => { drag = null; };
  scene.input.on('pointerdown', startDrag);
  scene.input.on('pointermove', moveDrag);
  scene.input.on('pointerup', endDrag);
  scene.input.on('gameout', endDrag);
  scene.events.once('shutdown', () => {
    scene.input.off('pointerdown', startDrag);
    scene.input.off('pointermove', moveDrag);
    scene.input.off('pointerup', endDrag);
    scene.input.off('gameout', endDrag);
  });
  scene.add.rectangle(width / 2, height, width, 146, 0x070b10, 0.84)
    .setOrigin(0.5, 1).setScrollFactor(0).setDepth(999);
  addDetailsHint(scene, height - 65, 'Drag map. Tap to travel. Hold for details.', { x: width / 2 + 150, fontSize: 30, fixed: true, width: 1060 });
  const help = scene.add.rectangle(190, height - 65, 300, 100, 0x142a23, 0.96)
    .setStrokeStyle(3, 0x9cc5ad).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });
  scene.add.text(190, height - 65, 'HOW TO PLAY', { fontFamily: 'Arial', fontSize: '38px', fontStyle: 'bold', color: '#f1f8ec' })
    .setOrigin(0.5).setScrollFactor(0).setDepth(1001);
  help.on('pointerdown', () => {
    HapticsService.tap();
    showSelectionDetails(scene, { title: 'WELCOME TO DELVE DEEP', panelWidth: 1700, description:
      'Visit Pineshire to prepare, then tap The Slime Cave. Choose five adventurers: up to one Tank, two Healers, and four DPS.\n\nYour party fights automatically. Select adventurers to give orders and use Raid Leader tactics during combat.\n\nCleared waves bank rewards. At camp you can farm, return to town, or challenge the boss. Defeat each Delve boss to open the next road. The Sunken Watch opens the Y-branch to the Everdeep and Murmuring Abyss.\n\nDefeat the portal to open the exit toward Highmere. This first-region build ends there. Progress saves on this device. The Enchanter has no stock yet.' });
  });
  const reset = scene.add.rectangle(520, height - 65, 300, 100, 0x342a23, 0.96)
    .setStrokeStyle(3, 0xc9b28b).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });
  scene.add.text(520, height - 65, 'DEV TOOLS', { fontFamily: 'Arial', fontSize: '38px', fontStyle: 'bold', color: '#fff1d2' })
    .setOrigin(0.5).setScrollFactor(0).setDepth(1001);
  reset.on('pointerdown', () => { HapticsService.tap();
    scene.showDevelopmentTools();
  });
  scene.time.addEvent({ delay: 2000, loop: true, callback: () => persistTravel(scene) });
  scene.events.once('shutdown', () => persistTravel(scene));
}

function persistTravel(scene) {
  if (!scene.activeEdge) return;
  GameState.world.travel = { edgeId: scene.activeEdge.id, t: scene.edgeT, target: scene.edgeTarget,
    destinationId: scene.destination?.id ?? null };
  saveProfile();
}

export function updateScrollingWorldMap(scene, delta) {
  const region = regions[0];
  scene.regionText?.setText(`WORLD MAP  ·  ${region.name}`);
  if (scene.selectionDetailsClose) return;
  if (!scene.activeEdge || !scene.edgeTarget) return;
  const edge = scene.activeEdge;
  const before = roadPoint(edge, scene.edgeT);
  const sign = scene.edgeTarget === edge.to ? 1 : -1;
  scene.edgeT = Math.max(0, Math.min(1, scene.edgeT + sign * SPEED * Math.min(delta, 100) / 1000 / edge.length));
  const point = roadPoint(edge, scene.edgeT);
  scene.party.setPosition(point.x, point.y);
  scene.partyLabel.setPosition(scene.party.x, scene.party.y + 92);
  const dx = point.x - before.x;
  const dy = point.y - before.y;
  const facing = `${dy < 0 ? 'north' : 'south'}-${dx < 0 ? 'west' : 'east'}`;
  if (scene.partyFacing !== facing) {
    scene.partyFacing = facing;
    scene.party.play(`world-party-walk-${facing}`, true);
  }
  if (scene.edgeT !== (sign > 0 ? 1 : 0)) return;
  scene.partyNode = scene.edgeTarget;
  scene.activeEdge = null;
  scene.edgeTarget = null;
  GameState.world.currentLocation = scene.partyNode;
  GameState.world.travel = null;
  saveProfile();
  advanceEdge(scene);
}
