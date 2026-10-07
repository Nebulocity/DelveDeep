import { fontPx, UI_FONT_SIZES, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { showTutorialSlideshow } from '../ui/TutorialSlideshow.js';
import { addRegionPanel } from '../ui/RegionMapTheme.js';
import { REGION_RAIL_WIDTH, MAP_HEADER_HEIGHT, MAP_FOOTER_HEIGHT, createRegionLocationRail, updateRegionLocationRail, syncRegionMapCameras } from '../ui/RegionMapUI.js';
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
    addRegionPanel(scene, point.x, point.y, 180, 100, 90, 'normal', false);
    scene.add.text(point.x, point.y, 'LOCKED', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'),
      fontStyle: UI_FONT_WEIGHTS.bold, color: '#ffe2a2' }).setOrigin(0.5).setDepth(91);
  }
  const exit = mapPoint(regionExit.position);
  const open = cleared(regionExit.requiresClear);
  const sign = scene.add.text(exit.x, exit.y, open ? 'HIGHMERE →' : 'PORTAL LOCK', {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('support28'), fontStyle: UI_FONT_WEIGHTS.bold, color: open ? '#c9f2d3' : '#d7b3eb',
    padding: { x: 16, y: 14 }
  }).setOrigin(1, 0.5).setDepth(170).setInteractive({ useHandCursor: true });
  addRegionPanel(scene, exit.x - sign.width / 2, exit.y, sign.width + 14, sign.height + 8, 169, 'normal', false);
  bindSelectionDetails(scene, sign, { title: 'ROAD TO HIGHMERE CRAGS', messageScope: 'map', description: open
    ? 'The Murmuring Abyss is defeated and the road is open. Travel to Highmere Crags will be available in a future update.'
    : 'Defeat The Murmuring Abyss to open the road to Highmere Crags.' }, () => {
    HapticsService.tap();
    scene.showToast(open ? 'Road opened. Highmere Crags is coming next.' : 'Defeat The Murmuring Abyss to open this road.', 'map');
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
  scene.partyLabel = scene.add.text(x, y + 92, 'PARTY', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('support28'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#ffffff', stroke: '#142019', strokeThickness: 5 })
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
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('mapLabel'), fontStyle: UI_FONT_WEIGHTS.bold, color: unlocked ? '#fff1d1' : '#bcc4bb',
      stroke: '#142019', strokeThickness: 5, padding: { x: 18, y: 12 }
    }).setOrigin(0.5).setDepth(170).setInteractive({ useHandCursor: true });
    addRegionPanel(scene, label.x, label.y, nameplate.width + 14, nameplate.height + 8, 169, 'normal', false);
    if (cleared(poi.id) && (poi.type === 'delve' || poi.type === 'void')) {
      scene.add.text(label.x, label.y + 58, '✓', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body34'), color: '#a8efb4', stroke: '#142019', strokeThickness: 5 })
        .setOrigin(0.5).setDepth(180);
    }
    const hit = scene.add.circle(point.x, point.y - 100, 145, 0xffffff, 0.001).setDepth(900);
    const details = () => locationDetails(poi);
    bindSelectionDetails(scene, hit, details, () => selectPoi(scene, poi), undefined, { allowSceneInput: true });
    bindSelectionDetails(scene, nameplate, details, () => selectPoi(scene, poi), undefined, { allowSceneInput: true });
  }
}

function locationDetails(poi) {
  const details = poi.type === 'delve' || poi.type === 'void'
    ? delveDetails(POI_DELVES[poi.id] ?? DELVES[poi.id])
    : poi.type === 'everdeep' ? { title: poi.name, description: everdeepUnlocked()
      ? 'Send adventurers on timed expeditions. Visit the Everdeep to prepare an expedition and review its rewards.'
      : 'Defeat the boss of The Sunken Watch to unlock the Everdeep branch.' }
    : { title: poi.name, description: 'Visit town to prepare your party.', image: poi.conceptArt };
  return { ...details, messageScope: 'map' };
}

export function findParty(scene) {
  const camera = scene.cameras.main;
  scene.partyPan?.stop();
  camera.stopFollow();
  const startX = camera.scrollX;
  const startY = camera.scrollY;
  scene.partyPan = scene.tweens.addCounter({ from: 0, to: 1, duration: 750, ease: 'Sine.easeInOut',
    onUpdate: tween => {
      const target = camera.getScroll(scene.party.x, scene.party.y - scene.partyCameraOffset);
      const t = tween.getValue();
      camera.setScroll(startX + (target.x - startX) * t, startY + (target.y - startY) * t);
    },
    onComplete: () => {
      const x = camera.scrollX, y = camera.scrollY;
      camera.startFollow(scene.party, false, 0.09, 0.09, 0, scene.partyCameraOffset);
      camera.setScroll(x, y);
      scene.partyPan = null;
    }
  });
}

export function selectPoi(scene, poi) {
  HapticsService.tap();
  if (!available(poi)) {
    const required = pois.find((entry) => entry.id === poi.requiresClear);
    scene.showToast(`Defeat the boss of ${required?.name ?? 'the preceding Delve'} to unlock this location.`, 'map');
    return;
  }
  const path = scene.activeEdge
    ? routeFromEdge(scene.activeEdge.id, scene.edgeT, poi.node, cleared)
    : routeBetween(scene.partyNode, poi.node, cleared);
  if (!path) {
    scene.showToast('Clear the preceding Delve bosses to open the road.', 'map');
    return;
  }
  if (poi.template && !GameState.world.discoveredLocations.includes(poi.id)) {
    GameState.world.discoveredLocations.push(poi.id);
    saveProfile();
  }
  scene.travelRoute = path.slice(1);
  scene.destination = poi;
  findParty(scene);
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
  scene.selectionDetailsClose ??= null;
  const { width, height } = scene.scale;
  scene.cameras.main.setBackgroundColor('#233b2b');
  drawWorld(scene);
  createParty(scene);
  renderPois(scene);
  const camera = scene.cameras.main;
  camera.setViewport(REGION_RAIL_WIDTH, MAP_HEADER_HEIGHT, width - REGION_RAIL_WIDTH,
    height - MAP_HEADER_HEIGHT - MAP_FOOTER_HEIGHT).setZoom(0.70);
  camera.setBounds(0, 0, WORLD_COLUMNS * TILE, WORLD_ROWS * TILE);
  scene.partyCameraOffset = camera.height * 0.18 / camera.zoom;
  scene.partyPan = null;
  camera.startFollow(scene.party, false, 0.09, 0.09, 0, scene.partyCameraOffset);
  scene.mapUiCamera = scene.cameras.add(0, 0, width, height, false, 'region-map-ui');
  createRegionLocationRail(scene, pois, available, cleared, locationDetails, poi => selectPoi(scene, poi));
  addRegionPanel(scene, width / 2, 58, width, MAP_HEADER_HEIGHT, 1000);
  scene.add.text(58, 18, 'DELVE DEEP', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('display54'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f8fafc' })
    .setScrollFactor(0).setDepth(1001);
  scene.regionText = scene.add.text(58, 69, 'WORLD MAP', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('mapRegion'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#b2c7d1' })
    .setScrollFactor(0).setDepth(1001);
  scene.currencyText = scene.add.text(width - 58, 26, `Gold: ${GameState.gold}`, {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('mapGold'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fbbf24'
  }).setOrigin(1, 0).setScrollFactor(0).setDepth(1001);
  const recenter = addRegionPanel(scene, width - 185, height - 65, 300, 100, 1000)
    .setInteractive({ useHandCursor: true });
  scene.add.text(width - 185, height - 65, 'FIND PARTY', {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('heading38'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f1f8ec'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
  recenter.on('pointerdown', (pointer, x, y, event) => {
    event?.stopPropagation?.();
    HapticsService.tap();
    findParty(scene);
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
    scene.partyPan?.stop();
    scene.partyPan = null;
    const camera = scene.cameras.main;
    camera.stopFollow();
    camera.setScroll(camera.clampX(camera.scrollX - dx / camera.zoom),
      camera.clampY(camera.scrollY - dy / camera.zoom));
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
  addRegionPanel(scene, (width + REGION_RAIL_WIDTH) / 2, height - MAP_FOOTER_HEIGHT / 2, width - REGION_RAIL_WIDTH, MAP_FOOTER_HEIGHT, 999);
  addDetailsHint(scene, height - 65, 'Drag map to explore. Hold for details.', { x: 1430, fontSize: UI_FONT_SIZES.support28, fixed: true, width: 570 });
  const help = addRegionPanel(scene, 640, height - 65, 300, 100, 1000).setInteractive({ useHandCursor: true });
  scene.add.text(640, height - 65, 'HOW TO PLAY', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('heading38'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f1f8ec' })
    .setOrigin(0.5).setScrollFactor(0).setDepth(1001);
  help.on('pointerdown', () => {
    HapticsService.tap();
    showTutorialSlideshow(scene);
  });
  const reset = addRegionPanel(scene, 970, height - 65, 300, 100, 1000).setInteractive({ useHandCursor: true });
  scene.add.text(970, height - 65, 'DEV TOOLS', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('heading38'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff1d2' })
    .setOrigin(0.5).setScrollFactor(0).setDepth(1001);
  reset.on('pointerdown', () => { HapticsService.tap();
    scene.showDevelopmentTools();
  });
  syncRegionMapCameras(scene);
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
  syncRegionMapCameras(scene);
  updateRegionLocationRail(scene, cleared);
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
