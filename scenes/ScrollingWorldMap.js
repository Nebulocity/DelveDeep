import GameState from '../game/GameState.js';
import delves from '../data/delves.js';
import { saveProfile } from '../game/GameStorage.js';
import HapticsService from '../services/HapticsService.js';
import { bindSelectionDetails, addDetailsHint, delveDetails, showSelectionDetails } from '../ui/SelectionDetails.js';
import { TILE, WORLD_COLUMNS, WORLD_ROWS, areas, regions, nodes, roads, pois, nodePoint, routeBetween, routeFromEdge, nearestTown } from '../data/worldMap.js';
import { everdeepUnlocked, settleEverdeep } from '../game/Everdeep.js';
import { drawRegionalWorld } from './WorldMapArt.js';
import { poiArt } from '../data/worldMapArt.js';

const DELVES = Object.fromEntries(delves.map((delve) => [delve.id, delve]));
const POI_DELVES = Object.fromEntries(pois.filter((poi) => poi.template).map((poi) => [poi.id, {
  ...DELVES[poi.template], id: poi.id, encounterId: poi.template, name: poi.name, conceptArt: poi.conceptArt ?? DELVES[poi.template]?.conceptArt
}]));
const ORDINARY = ['slime-cave', 'thornbriar-hollow', 'dolmark-den'];
const SPEED = 560;

const cleared = (id) => GameState.development.unlockAll || GameState.world.clearedDelves.includes(id)
  || (GameState.records[id]?.clears ?? 0) > 0;

const portalEligible = () => GameState.development.unlockAll || ORDINARY.every(cleared);

export function available(poi) {
  if (GameState.development.unlockAll || poi.type === 'waypoint' || poi.id === 'pineshire') return true;
  if (poi.type === 'everdeep') return everdeepUnlocked();
  if (poi.template) return poi.type === 'void' ? portalEligible() : cleared('slime-cave');
  if (poi.type === 'void') return portalEligible();
  if (poi.id === 'duskfall') return cleared('thornbriar-hollow');
  if (poi.type === 'town') return true;
  if (poi.id === 'dolmark-den') return GameState.world.discoveredLocations.includes('duskfall');
  const delve = DELVES[poi.id] ?? POI_DELVES[poi.id];
  return GameState.world.discoveredLocations.includes(poi.id)
    && (delve?.prerequisites ?? []).every(cleared)
    && (!delve?.requiresLocation || GameState.world.discoveredLocations.includes(delve.requiresLocation));
}

function drawWorld(scene) {
  drawRegionalWorld(scene);
  for (const area of areas) {
    const region = regions[area.column];
    const x = (area.column * 40 + 8) * TILE;
    const y = (area.row * 24 + 5) * TILE;
    scene.add.text(x, y, `${area.name}\n${region.name}`, {
      fontFamily: 'Georgia', fontSize: '34px', fontStyle: 'bold', color: '#e8dec0',
      align: 'center', stroke: '#17241c', strokeThickness: 7
    }).setOrigin(0.5).setDepth(80);
  }
  for (const [gate, node] of [['murmuring-abyss', 'first-gate-west'], ['verdant-tear', 'second-gate-west']]) {
    if (cleared(gate)) continue;
    const point = nodePoint(node);
    scene.add.rectangle(point.x + TILE / 2, point.y, 140, 230, 0x301743, 0.95)
      .setStrokeStyle(8, 0xb45ee2).setDepth(90);
  }
}

function createParty(scene) {
  const savedEdge = roads.find((edge) => edge.id === GameState.world.travel?.edgeId);
  const t = Math.max(0, Math.min(1, GameState.world.travel?.t ?? 0));
  const start = nodePoint(savedEdge?.from ?? GameState.world.currentLocation) ?? nodePoint('pineshire');
  const end = savedEdge ? nodePoint(savedEdge.to) : start;
  const x = start.x + (end.x - start.x) * t;
  const y = start.y + (end.y - start.y) * t;
  scene.party = scene.add.sprite(x, y, 'world-party-idle', 0)
    .setDisplaySize(176, 176).setOrigin(0.5, 0.78).setDepth(500);
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
    const color = poi.type === 'everdeep' ? 0x257d79 : poi.type === 'void' ? 0x9247bb : poi.type === 'town' ? 0xd5a84f : poi.type === 'waypoint' ? 0xa1b6a5 : 0x738db7;
    scene.add.circle(point.x, point.y, 51, unlocked ? color : 0x415047, 0.95)
      .setStrokeStyle(7, unlocked ? 0xf4eac9 : 0x738278).setDepth(160);
    scene.add.image(point.x - (poi.type === 'town' ? 90 : 0), point.y - 50, poiArt(poi))
      .setDisplaySize(150, 150).setDepth(165).setAlpha(unlocked ? 1 : 0.55);
    scene.add.text(point.x, point.y - 175, poi.name, {
      fontFamily: 'Georgia', fontSize: '35px', fontStyle: 'bold', color: unlocked ? '#fff1d1' : '#aab6ab',
      stroke: '#142019', strokeThickness: 8, backgroundColor: '#16241be0', padding: { x: 14, y: 8 }
    }).setOrigin(0.5).setDepth(170);
    if (cleared(poi.id) && (poi.type === 'delve' || poi.type === 'void')) {
      scene.add.text(point.x + 60, point.y - 48, '✓', { fontFamily: 'Arial', fontSize: '46px', color: '#a8efb4', stroke: '#142019', strokeThickness: 5 })
        .setOrigin(0.5).setDepth(180);
    }
    const hit = scene.add.circle(point.x, point.y, 105, 0xffffff, 0.001).setDepth(900);
    bindSelectionDetails(scene, hit, () => poi.type === 'delve' || poi.type === 'void'
      ? delveDetails(DELVES[poi.id] ?? POI_DELVES[poi.id])
      : poi.type === 'everdeep' ? { title: poi.name, description: everdeepUnlocked()
        ? 'Send five adventurers on a timed expedition. A Writ costs 120 Gold; chests are earned every ten successful waves.'
        : 'Clear The Slime Cave, Thornbriar Hollow, and Dolmark Den to reveal this expedition.' }
      : { title: poi.name, description: poi.type === 'waypoint' ? 'A stopping point along the road.' : 'Visit town to prepare your party.', image: poi.conceptArt },
    () => selectPoi(scene, poi));
  }
}

export function selectPoi(scene, poi) {
  HapticsService.tap();
  if (!available(poi)) {
    scene.showToast(poi.type === 'void' || poi.type === 'everdeep' ? 'Clear all three ordinary Delves to reveal this location.'
      : poi.template ? 'Clear The Slime Cave to explore branch Delves.'
        : poi.id === 'duskfall' ? 'Clear Thornbriar Hollow to visit Duskfall.'
          : 'Follow the starting Delves to reveal this location.');
    return;
  }
  const path = scene.activeEdge
    ? routeFromEdge(scene.activeEdge.id, scene.edgeT, poi.node, cleared)
    : routeBetween(scene.partyNode, poi.node, cleared);
  if (!path) {
    scene.showToast('A Void Portal blocks the road ahead. Defeat it to open the crossing.');
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
  if (poi.id === 'duskfall' && !GameState.world.discoveredLocations.includes('dolmark-den')) GameState.world.discoveredLocations.push('dolmark-den');
  saveProfile();
  if (poi.type === 'town') return scene.scene.start('TownScene', { townId: poi.id, townName: poi.name });
  if (poi.type === 'everdeep') {
    settleEverdeep();
    return scene.scene.start('EverdeepScene');
  }
  if (poi.type === 'waypoint') return;
  const delve = DELVES[poi.id] ?? POI_DELVES[poi.id];
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
  scene.cameras.main.centerOn(scene.party.x, scene.party.y);
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
  scene.input.on('pointerdown', (pointer, objects) => {
    if (objects.length) return;
    drag = { id: pointer.id, x: pointer.x, y: pointer.y };
  });
  scene.input.on('pointermove', (pointer) => {
    if (!drag || drag.id !== pointer.id || !pointer.isDown) return;
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
  });
  scene.input.on('pointerup', () => { drag = null; });
  scene.input.on('gameout', () => { drag = null; });
  scene.add.rectangle(width / 2, height, width, 146, 0x070b10, 0.84)
    .setOrigin(0.5, 1).setScrollFactor(0).setDepth(999);
  addDetailsHint(scene, height - 65, 'Drag map. Tap to travel. Hold for details.').setX(width / 2 + 150).setFontSize(32).setScrollFactor(0);
  const help = scene.add.rectangle(190, height - 65, 300, 100, 0x142a23, 0.96)
    .setStrokeStyle(3, 0x9cc5ad).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });
  scene.add.text(190, height - 65, 'HOW TO PLAY', { fontFamily: 'Arial', fontSize: '38px', fontStyle: 'bold', color: '#f1f8ec' })
    .setOrigin(0.5).setScrollFactor(0).setDepth(1001);
  help.on('pointerdown', () => {
    HapticsService.tap();
    showSelectionDetails(scene, { title: 'WELCOME TO DELVE DEEP', description:
      'Visit Pineshire to prepare, then tap The Slime Cave. Choose five adventurers: up to one Tank, two Healers, and four DPS.\n\nYour party fights automatically. Select adventurers to give orders and use Raid Leader tactics during combat.\n\nCleared waves bank rewards. At camp you can farm, return to town, or challenge the boss. Clear the three starting Delves to reveal the portals. Defeat each road portal to reach the next region.\n\nProgress saves on this device. Branch encounters share existing enemy and scenery themes. Enchanting is a preview in this demo.' });
  });
  const devTools = import.meta.env.DEV && new URLSearchParams(window.location.search).has('devTools');
  const reset = scene.add.rectangle(520, height - 65, 300, 100, 0x342a23, 0.96)
    .setStrokeStyle(3, 0xc9b28b).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });
  scene.add.text(520, height - 65, devTools ? 'DEV TOOLS' : 'NEW GAME', { fontFamily: 'Arial', fontSize: '38px', fontStyle: 'bold', color: '#fff1d2' })
    .setOrigin(0.5).setScrollFactor(0).setDepth(1001);
  reset.on('pointerdown', () => { HapticsService.tap();
    if (devTools) scene.showDevelopmentTools();
    else scene.showResetConfirmation(() => {});
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
  const region = regions[Math.max(0, Math.min(2, Math.floor((scene.cameras.main.midPoint?.x ?? scene.party.x) / (40 * TILE))))];
  scene.regionText?.setText(`WORLD MAP  ·  ${region.name}`);
  if (scene.selectionDetailsClose) return;
  if (!scene.activeEdge || !scene.edgeTarget) return;
  const edge = scene.activeEdge;
  const a = nodePoint(edge.from);
  const b = nodePoint(edge.to);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const sign = scene.edgeTarget === edge.to ? 1 : -1;
  scene.edgeT = Math.max(0, Math.min(1, scene.edgeT + sign * SPEED * Math.min(delta, 100) / 1000 / length));
  scene.party.setPosition(a.x + (b.x - a.x) * scene.edgeT, a.y + (b.y - a.y) * scene.edgeT);
  scene.partyLabel.setPosition(scene.party.x, scene.party.y + 92);
  const dx = (b.x - a.x) * sign;
  const dy = (b.y - a.y) * sign;
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
