import { emitGameplay, PLAYER_SOURCE } from '../game/GameplayEvents.js';
// This manages the illustrated map, camera and traveling party. Roads are traced curves,
// so travel follows their points rather than moving directly through scenery. Map/world
// coordinates move with the camera; fixed menu coordinates belong to the screen.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { openTutorialReplay } from '../ui/TutorialReplay.js';
import { addRegionPanel, addRegionButton, setRegionPanelState } from '../ui/RegionMapTheme.js';
import { REGION_RAIL_WIDTH, MAP_HEADER_HEIGHT, MAP_FOOTER_HEIGHT, createRegionLocationRail, updateRegionLocationRail, syncRegionMapCameras, createRegionMapHeader, refreshRegionMapGold, showRegionDestination } from '../ui/RegionMapUI.js';
import GameState from '../game/GameState.js';
import garrickLayout from '../assets/characters/garrick/sheets/layout.json' with { type: 'json' };
import { CHARACTER_SPRITES } from '../data/characterSprites.js';
import { applyCharacterPose, characterDisplayMetrics } from '../ui/CharacterSpriteDisplay.js';
import { resolveWorldMapCharacter } from '../game/WorldMapCharacter.js';
import delves from '../data/delves.js';
import { saveProfile } from '../game/GameStorage.js';

import HapticsService from '../services/HapticsService.js';
import { createWorldMapAmbience } from '../ui/WorldMapAmbience.js';
import { privateTransfersEnabled, showSaveTransferDialog } from '../ui/SaveTransferDialog.js';
import { bindSelectionDetails, showSelectionDetails, delveDetails } from '../ui/SelectionDetails.js';
import { TILE, WORLD_COLUMNS, WORLD_ROWS, regions, nodes, roads, pois, nodePoint, roadPoint, mapPoint, branchLock, regionExit, routeBetween, routeFromEdge, nearestTown } from '../data/worldMap.js';
import { everdeepUnlocked, settleEverdeep } from '../game/Everdeep.js';
import { REGIONAL_MAPS } from '../data/regionalMaps.js';
import { RegionalMapRenderer } from '../ui/RegionalMapRenderer.js';
import { UI_SAFE_RIGHT } from '../ui/Layout.js';
import { playUiSound } from '../services/UiAudioService.js';
import { available } from '../game/DelveAvailability.js';

export { available };

// Object.fromEntries turns [key, value] pairs back into an object. A later pair with the
// same key replaces the earlier value. map builds one output entry for each input entry,
// in the same order. The callback's return value becomes that output entry.
const DELVES = Object.fromEntries(delves.map((delve) => [delve.id, delve]));

// filter keeps entries whose callback returns true. It builds a new list and leaves the
// original list in place.
const POI_DELVES = Object.fromEntries(pois.filter((poi) => poi.template).map((poi) => [poi.id, {
  ...DELVES[poi.template], id: poi.id, encounterId: poi.template, name: poi.name,
  subtitle: poi.subtitle ?? DELVES[poi.template]?.subtitle,
  prerequisites: poi.requiresClear ? [poi.requiresClear] : [], requiresLocation: null,
}]));
const SPEED = 560;

const cleared = (id) => GameState.development.unlockAll || GameState.world.clearedDelves.includes(id)
  || (GameState.records[id]?.clears ?? 0) > 0;

// Build the selected illustrated region, its traced roads and world display layers.
function drawWorld(scene) {

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects. Origin is the anchor within the object: 0 is the left/top edge,
  // 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
  // necessarily the object's corner.
  scene.regionalMap = new RegionalMapRenderer(scene, REGIONAL_MAPS['pineshire-reach']);
  if (!cleared(branchLock.requiresClear)) {
    const point = mapPoint(branchLock.position);
    addRegionPanel(scene, point.x, point.y, 180, 100, 90, 'normal', false);
    scene.add.text(point.x, point.y, 'LOCKED', { fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body32'),
      fontStyle: UI_FONT_WEIGHTS.bold, color: '#ffe2a2' }).setOrigin(0.5).setDepth(91);
  }

  const exit = mapPoint(regionExit.position);
  const open = cleared(regionExit.requiresClear);

  // This gives the display object an input hit area. Visible artwork alone does not make
  // an object respond to a tap. The condition before ? chooses the first value when true
  // and the value after : when false.
  const sign = scene.add.text(exit.x, exit.y, open ? 'HIGHMERE →' : 'PORTAL LOCK', {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('support28'), fontStyle: UI_FONT_WEIGHTS.bold, color: open ? '#f2d79f' : '#d7b3eb',
    padding: { x: 16, y: 14 }
  }).setOrigin(1, 0.5).setDepth(170).setInteractive({ useHandCursor: true });
  addRegionPanel(scene, exit.x - sign.width / 2, exit.y, sign.width + 14, sign.height + 8, 169, 'normal', false);
  bindSelectionDetails(scene, sign, { title: 'ROAD TO HIGHMERE CRAGS', messageScope: 'map', description: open
    ? 'The Murmuring Abyss is defeated and the road is open. Travel to Highmere Crags will be available in a future update.'
    : 'Defeat The Murmuring Abyss to open the road to Highmere Crags.' }, () => {
    HapticsService.tap();

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    scene.showToast(open ? 'The kobolds are still building this one!' : 'Defeat The Murmuring Abyss to open this road.', 'map');
  }, undefined, { allowSceneInput: true });
}

// Build live units from the selected gear-adjusted roster records and starting formation.
// scene is the Phaser screen that owns the objects, clock and input used here.
function createParty(scene) {

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const savedEdge = roads.find((edge) => edge.id === GameState.world.travel?.edgeId);

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound. ?? uses the fallback only for null or undefined. A
  // real zero or false stays intact. ?. only follows this link when the value exists; a
  // missing optional value gives undefined.
  const t = Math.max(0, Math.min(1, GameState.world.travel?.t ?? 0));

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const start = savedEdge ? roadPoint(savedEdge, t) : nodePoint(GameState.world.currentLocation) ?? nodePoint('pineshire');

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { x, y } = start;

  // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
  // lower-depth objects. Origin is the anchor within the object: 0 is the left/top edge,
  // 0.5 is the center and 1 is the right/bottom edge. x/y place that anchor, not
  // necessarily the object's corner.
  scene.party = scene.add.sprite(x, y, 'world-party-idle', 0)
    .setDisplaySize(271.5, 271.5).setOrigin(0.5, garrickLayout.anchors['south-east'].originY).setDepth(500);
  scene.partyNode = savedEdge ? null : (nodes[GameState.world.currentLocation] ? GameState.world.currentLocation : 'pineshire');
  scene.activeEdge = savedEdge ?? null;
  scene.edgeT = savedEdge ? t : 0;
  scene.travelRoute = [];
  scene.destination = null;

  scene.edgeTarget = savedEdge ? (GameState.world.travel?.target === savedEdge.from ? savedEdge.from : savedEdge.to) : null;
  if (savedEdge && GameState.world.travel?.destinationId) {
    const destination = pois.find((poi) => poi.id === GameState.world.travel.destinationId);
    const path = destination && routeBetween(scene.edgeTarget, destination.node, cleared);
    if (path && available(destination)) {
      scene.destination = destination;
      scene.travelRoute = path.slice(1);
    }
  }

  if (!scene.anims.exists('world-party-idle-south-east')) {

    // Use the same packed rows and timings as combat so map travel plays every
    // new frame in the correct direction instead of stepping into another row.
    for (const [row, facing] of garrickLayout.directions.entries()) {
      for (const state of ['idle', 'walk']) {
        const sheet = garrickLayout.states[state];
        const start = row * sheet.columns;
        scene.anims.create({ key: `world-party-${state}-${facing}`,
          frames: scene.anims.generateFrameNumbers(`world-party-${state}`,
            { start, end: start + sheet.counts[facing] - 1 }),
          frameRate: 1000 / sheet.frameMs, repeat: -1 });
      }
    }
  }

  scene.partyFacing = 'south-east';
  refreshPartyCharacter(scene);

  // Phaser changes textures per frame; retain each authored foot anchor as it does.
  scene.party.on('animationupdate', (_animation, animationFrame) => {
    const clip = scene.mapCharacterDefinition?.clips[scene.partyAnimationState]?.[scene.partyAnimationFacing];
    const pose = clip?.frames[animationFrame.index - 1];
    if (pose) applyCharacterPose(scene.party, pose);
  });
  playPartyAnimation(scene, savedEdge ? 'walk' : 'idle');
  const changed = () => {
    refreshPartyCharacter(scene);
    playPartyAnimation(scene, scene.activeEdge && scene.edgeTarget ? 'walk' : 'idle');
  };
  scene.events.on('world-map-character-changed', changed);
  scene.events.once('shutdown', () => scene.events.off('world-map-character-changed', changed));
}

// Replace only the party's visual definition. Road position, facing, route and
// camera follow stay on the same sprite when Settings changes the representative.
function refreshPartyCharacter(scene) {
  scene.party.stop();
  const hero = resolveWorldMapCharacter();
  scene.mapCharacterDefinition = CHARACTER_SPRITES[hero?.id] ?? null;
  scene.mapCharacterMetrics = null;
  scene.partyAnimationState = null;
  scene.partyAnimationFacing = null;
  scene.mapCharacterAnimationPrefix = scene.mapCharacterDefinition ? `world-character-${hero.id}` : 'world-party';
  if (scene.mapCharacterDefinition) {
    for (const state of ['idle', 'walk']) {
      for (const [facing, clip] of Object.entries(scene.mapCharacterDefinition.clips[state])) {
        for (const pose of clip.frames) scene.textures.get(pose.key).setFilter(1);
        const key = `${scene.mapCharacterAnimationPrefix}-${state}-${facing}`;
        if (!scene.anims.exists(key)) scene.anims.create({ key,
          frames: clip.frames.map(frame => ({ key: frame.key, frame: frame.frame })),
          frameRate: 1000 / clip.frameMs, repeat: -1 });
      }
    }
  }
}

// Use one stable body scale for idle and travel while preserving authored foot anchors.
function playPartyAnimation(scene, state) {
  const clips = scene.mapCharacterDefinition?.clips[state];
  const facing = clips && !clips[scene.partyFacing] ? 'south' : scene.partyFacing;
  const frame = clips?.[facing]?.frames[0];
  const changed = scene.partyAnimationState !== state || scene.partyAnimationFacing !== facing;
  scene.partyAnimationState = state;
  scene.partyAnimationFacing = facing;
  scene.party.play(`${scene.mapCharacterAnimationPrefix}-${state}-${facing}`, true);
  if (frame && changed) applyCharacterPose(scene.party, frame);

  const definition = scene.mapCharacterDefinition ?? CHARACTER_SPRITES.garrick;
  const source = scene.mapCharacterDefinition ? definition.clips.idle.south : {
    ...definition.clips.idle['south-east'].frames[0], key: 'world-party-idle', frame: 0
  };
  if (!scene.mapCharacterMetrics) scene.mapCharacterMetrics = characterDisplayMetrics(scene, definition, 'worldMap', { source });
  if (scene.mapCharacterMetrics) scene.party.setScale(scene.mapCharacterMetrics.scale);
}

// Refresh visible world destinations from their authored nodes and current saved access.
// scene is the Phaser screen that owns the objects, clock and input used here.
function renderPois(scene) {
  scene.mapLabels = [];
  for (const poi of pois) {
    const point = nodePoint(poi.node);
    const unlocked = available(poi);
    const label = mapPoint(poi.label);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const color = poi.type === 'everdeep' ? 0x257d79 : poi.type === 'void' ? 0x9247bb : poi.type === 'town' ? 0xd5a84f : 0x738db7;

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap. Origin is the anchor within the object: 0 is the
    // left/top edge, 0.5 is the center and 1 is the right/bottom edge. x/y place that
    // anchor, not necessarily the object's corner.
    const nameplate = scene.add.text(0, 0, poi.name, {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('mapLabel'), fontStyle: UI_FONT_WEIGHTS.bold, color: unlocked ? '#fff1d1' : '#bcc4bb',
      stroke: '#111318', strokeThickness: 2, wordWrap: { width: 360 }, align: 'center'
    }).setOrigin(0.5, 0).setDepth(170);
    const status = scene.add.text(0, nameplate.height + 8, 'Current location', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('body34'), color: '#dcc38b'
    }).setOrigin(0.5, 0).setDepth(170);
    const w = Math.max(250, nameplate.width + 48, status.width + 48);
    const h = nameplate.height + status.height + 36;
    const x = Math.max(w / 2 + 24, Math.min(WORLD_COLUMNS * TILE - w / 2 - 24, label.x));
    let y = Math.max(24, Math.min(WORLD_ROWS * TILE - h - 24, label.y - h / 2));

    // Only the display plaque moves when labels would overlap. Nodes, roads and
    // the large landmark touch targets remain at their authored positions.
    for (const other of scene.mapLabels) {
      if (Math.abs(x - other.x) < (w + other.w) / 2 + 20 && y < other.y + other.h + 20 && y + h > other.y - 20) {
        y = Math.max(24, other.y - h - 24);
      }
    }
    const panel = addRegionPanel(scene, 0, h / 2 - 14, w, h, 169, 'normal', false, 'destination').setName('map-location-' + poi.id);
    const plaque = scene.add.container(x, y, [panel.regionMapArt, panel, nameplate, status]).setDepth(169);
    const connector = scene.add.graphics().lineStyle(2, unlocked ? 0xd3a750 : 0x8b887e, 0.45).setDepth(150);
    connector.lineBetween(x, y + h - 14, point.x, point.y - 100);
    connector.fillStyle(unlocked ? color : 0x807b70, 0.9).fillCircle(point.x, point.y - 100, 8);
    scene.mapLabels.push({ poi, panel, nameplate, status, plaque, connector, x, y, w, h, unlocked });

    // Landmark hit areas sit below plaques so their generous radius cannot steal
    // input from a visible card. Fixed controls and modal blockers remain above both.
    const hit = scene.add.circle(point.x, point.y - 100, 145, 0xffffff, 0.001).setDepth(168).setName('map-landmark-' + poi.id);
    const details = () => locationDetails(poi);
    bindSelectionDetails(scene, hit, details, () => inspectDestination(scene, poi), undefined, { allowSceneInput: true });

    // The existing rectangle covers the complete painted card in container space.
    // One binding owns title, status, border and blank-space taps at every camera zoom.
    bindSelectionDetails(scene, panel, details, () => inspectDestination(scene, poi), undefined, { allowSceneInput: true });
    let hovered = false;
    let pressed = null;
    const feedback = () => plaque.setAlpha(pressed !== null ? 0.82 : hovered ? 0.94 : 1);
    const reset = () => { hovered = false; pressed = null; feedback(); };
    const release = pointer => {
      if (pressed === pointer.id) { pressed = null; feedback(); }
    };
    const move = pointer => {
      if (pressed === pointer.id && Math.hypot(pointer.x - pointer.downX, pointer.y - pointer.downY) > 24) reset();
    };
    panel.on('pointerover', pointer => { hovered = !pointer.wasTouch; feedback(); });
    panel.on('pointerdown', pointer => { pressed = pointer.id; feedback(); });
    panel.on('pointerout', reset);
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
    scene.input.on('pointermove', move);
    scene.input.on('gameout', reset);
    scene.game.events.on('blur', reset);
    const cleanup = () => {
      scene.input.off('pointerup', release);
      scene.input.off('pointerupoutside', release);
      scene.input.off('pointermove', move);
      scene.input.off('gameout', reset);
      scene.game.events.off('blur', reset);
      scene.events.off('shutdown', cleanup);
    };
    panel.once('destroy', cleanup);
    scene.events.once('shutdown', cleanup);
  }
  refreshMapLabels(scene);
}

function refreshMapLabels(scene) {
  const camera = scene.cameras.main;
  const view = camera.worldView;
  const inset = 8 / camera.zoom;
  for (const { poi, panel, nameplate, status, plaque, connector, x, y, w, h, unlocked } of scene.mapLabels ?? []) {
    // A plaque enters as a complete label rather than leaving clipped text at a
    // viewport edge. Its landmark hit target stays available while it is hidden.
    const visible = x - w / 2 >= view.x + inset && x + w / 2 <= view.right - inset
      && y - 14 >= view.y + inset && y + h - 14 <= view.bottom - inset;
    plaque.setVisible(visible);
    connector.setVisible(visible);
    const interactive = visible && !scene.selectionDetailsClose;
    if (!interactive && panel.input.enabled) panel.emit('pointerout');
    panel.input.enabled = interactive;
    const here = !scene.activeEdge && scene.partyNode === poi.node;
    const selected = scene.selectedMapPoi?.id === poi.id;
    const label = !unlocked ? 'Locked' : here ? 'Current location' : scene.destination?.id === poi.id ? 'Traveling here'
      : cleared(poi.id) && ['delve', 'void'].includes(poi.type) ? 'Completed' : 'Available';
    if (status.text !== label) status.setText(label);
    nameplate.setColor(here ? '#ffdb86' : unlocked ? '#fff1d2' : '#b5b1a8');
    setRegionPanelState(scene, panel, here || selected ? 'selected' : 'normal', unlocked ? 1 : 0.85);
  }
}

// Build held details for the selected world destination.
function locationDetails(poi) {

  // The condition before ? chooses the first value when true and the value after : when
  // false. ?? uses the fallback only for null or undefined. A real zero or false stays
  // intact.
  const details = poi.type === 'delve' || poi.type === 'void'
    ? delveDetails(POI_DELVES[poi.id] ?? DELVES[poi.id])
    : poi.type === 'everdeep' ? { title: poi.name, description: everdeepUnlocked()
      ? 'Send adventurers on timed expeditions. Visit the Everdeep to prepare an expedition and review its rewards.'
      : 'Defeat the boss of The Sunken Watch to unlock the Everdeep branch.' }
    : { title: poi.name, description: poi.description, image: poi.conceptArt,
      panelWidth: 1500, imageColumn: 520, align: 'left' };

  // ... copies the source's own fields into this object; fields listed later replace
  // earlier ones. This is a shallow copy, so nested objects are still shared.
  return { ...details, messageScope: 'map' };
}

function inspectDestination(scene, poi) {
  HapticsService.tap();
  showRegionDestination(scene, poi, {
    open: available(poi), completed: cleared(poi.id) && ['delve', 'void'].includes(poi.type),
    details: locationDetails(poi), travel: () => selectPoi(scene, poi),
    inspect: details => showSelectionDetails(scene, details)
  });
  emitGameplay(scene, 'selection.changed', { selectionId: poi.id, selectionKind: 'destination' }, PLAYER_SOURCE);
}

// Pan to the traveling party and restore the intended camera follow behavior. scene is the
// Phaser screen that owns the objects, clock and input used here.
export function findParty(scene) {
  const camera = scene.cameras.main;

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  scene.partyPan?.stop();
  camera.stopFollow();
  const startX = camera.scrollX;
  const startY = camera.scrollY;
  scene.partyPan = scene.tweens.addCounter({ from: 0, to: 1, duration: 750, ease: 'Sine.easeInOut',

    // Update the affected display or movement values as this tween advances.
    onUpdate: tween => {
      const target = camera.getScroll(scene.party.x, scene.party.y - scene.partyCameraOffset);
      const t = tween.getValue();
      camera.setScroll(startX + (target.x - startX) * t, startY + (target.y - startY) * t);
    },

    // Finish this animation's remaining work when the tween reaches its end.
    onComplete: () => {
      const x = camera.scrollX, y = camera.scrollY;
      camera.startFollow(scene.party, false, 0.09, 0.09, 0, scene.partyCameraOffset);
      camera.setScroll(x, y);
      scene.partyPan = null;
    }
  });
}

// Validate a destination and route the party through connected roads toward it. scene is
// the Phaser screen that owns the objects, clock and input used here.
export function selectPoi(scene, poi) {

  // The watchtower waystone returns directly to town. It is available only while
  // standing at the tower, so it cannot skip outward boss gates or interrupt travel.
  if (poi?.id === 'pineshire' && !scene.activeEdge && scene.partyNode === 'verge-delves') {
    HapticsService.confirm();
    GameState.world.currentLocation = 'pineshire';
    GameState.world.travel = null;
    scene.destination = null;
    scene.travelRoute = [];
    saveProfile();
    scene.scene.start('TownScene', { townId: 'pineshire', townName: 'Pineshire' });
    return;
  }
  HapticsService.tap();
  if (!available(poi)) {
    playUiSound(scene, 'failure');

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const required = pois.find((entry) => entry.id === poi.requiresClear);

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    scene.showToast(`Defeat the boss of ${required?.name ?? 'the preceding Delve'} to unlock this location.`, 'map');
    return;
  }

  // Map testing skips road time but uses the normal arrival flow and saves the
  // destination. Turning it off immediately restores the road-routing branch below.
  if (GameState.development.mapTestingEnabled === true) {
    const point = nodePoint(poi.node);
    scene.activeEdge = null;
    scene.edgeTarget = null;
    scene.travelRoute = [];
    scene.partyNode = poi.node;
    scene.party.setPosition(point.x, point.y);
    scene.destination = poi;
    arrive(scene);
    return;
  }

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const path = scene.activeEdge
    ? routeFromEdge(scene.activeEdge.id, scene.edgeT, poi.node, cleared)
    : routeBetween(scene.partyNode, poi.node, cleared);

  if (!path) {
    playUiSound(scene, 'failure');
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
    playPartyAnimation(scene, 'walk');
  } else if (path.length === 1) {
    arrive(scene);
  } else {
    advanceEdge(scene);
  }

  persistTravel(scene);
}

// Continue from a finished road segment to the next segment of the current route. scene is
// the Phaser screen that owns the objects, clock and input used here.
function advanceEdge(scene) {
  if (!scene.travelRoute.length) return arrive(scene);
  const next = scene.travelRoute.shift();

  // find returns the first matching entry, or undefined when none matches. Check for that
  // missing result before using its fields.
  const edge = roads.find((candidate) => (candidate.from === scene.partyNode && candidate.to === next)
    || (candidate.to === scene.partyNode && candidate.from === next));
  if (!edge) return;
  scene.activeEdge = edge;
  scene.edgeTarget = next;

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  scene.edgeT = edge.from === scene.partyNode ? 0 : 1;
  scene.partyNode = null;
  playPartyAnimation(scene, 'walk');
}

// Commit arrival at the destination and open the matching location flow. scene is the
// Phaser screen that owns the objects, clock and input used here.
function arrive(scene) {
  playPartyAnimation(scene, 'idle');
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

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  const delve = POI_DELVES[poi.id] ?? DELVES[poi.id];

  // ... copies the source's own fields into this object; fields listed later replace
  // earlier ones. This is a shallow copy, so nested objects are still shared. ?. only
  // follows this link when the value exists; a missing optional value gives undefined.
  GameState.currentDelve = { ...delve, returnTownId: nearestTown(poi.node, cleared, available)?.id ?? 'pineshire' };
  GameState.currentRoom = 0;
  scene.scene.start('DelveSelectScene');
}

// Create the world artwork, party, destinations and camera-follow controls.
export function createScrollingWorldMap(scene) {
  settleEverdeep();

  // ??= fills a missing value once. It leaves an existing value, including zero or false,
  // alone.
  scene.selectionDetailsClose ??= null;

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { width, height } = scene.scale;
  scene.cameras.main.setBackgroundColor('#111318');
  drawWorld(scene);
  scene.regionalMap.layers.environment.add(createWorldMapAmbience(scene, scene.regionalMap.definition.legacyAmbience));
  createParty(scene);
  renderPois(scene);
  const camera = scene.cameras.main;
  camera.setViewport(REGION_RAIL_WIDTH, MAP_HEADER_HEIGHT, width - REGION_RAIL_WIDTH,
    height - MAP_HEADER_HEIGHT - MAP_FOOTER_HEIGHT).setZoom(0.7);

  camera.setBounds(0, 0, WORLD_COLUMNS * TILE, WORLD_ROWS * TILE);
  scene.partyCameraOffset = camera.height * 0.18 / camera.zoom;
  scene.partyPan = null;
  camera.startFollow(scene.party, false, 0.09, 0.09, 0, scene.partyCameraOffset);
  scene.mapUiCamera = scene.cameras.add(0, 0, width, height, false, 'region-map-ui');
  createRegionLocationRail(scene, pois, available, cleared, locationDetails, poi => inspectDestination(scene, poi));
  createRegionMapHeader(scene, () => {
    scene.mapLocationClose?.();
    scene.showDevelopmentTools();
  });
  let drag = null;
  const startDrag = (pointer, objects) => {

    // some stops with true as soon as one entry passes the check; an empty list gives
    // false.
    if (scene.selectionDetailsClose || objects.some((object) => object.scrollFactorX === 0 || object.depth >= 1000)) return;
    drag = { id: pointer.id, x: pointer.x, y: pointer.y, startX: pointer.x, startY: pointer.y, moving: false };
  };

  const moveDrag = (pointer) => {
    if (!drag || drag.id !== pointer.id || !pointer.isDown) return;

    // Math.hypot calculates straight-line length from the x/y differences: square each,
    // add them, then take the square root.
    if (!drag.moving && Math.hypot(pointer.x - drag.startX, pointer.y - drag.startY) <= 24) return;
    drag.moving = true;
    const dx = pointer.x - drag.x;
    const dy = pointer.y - drag.y;

    if (!dx && !dy) return;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
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

  // once registers a callback that removes itself after the first matching event.
  scene.events.once('shutdown', () => {
    scene.input.off('pointerdown', startDrag);
    scene.input.off('pointermove', moveDrag);
    scene.input.off('pointerup', endDrag);
    scene.input.off('gameout', endDrag);
  });
  const footerY = height - MAP_FOOTER_HEIGHT / 2;
  addRegionPanel(scene, (width + REGION_RAIL_WIDTH) / 2, footerY,
    width - REGION_RAIL_WIDTH, MAP_FOOTER_HEIGHT, 999);
  const utility = (x, label, action) => addRegionButton(scene, x, footerY, 300, 90, label, () => {
    scene.mapLocationClose?.();
    action();
  });
  utility(REGION_RAIL_WIDTH + 180, 'Tutorial', () => openTutorialReplay(scene));
  if (privateTransfersEnabled) utility(REGION_RAIL_WIDTH + 510, 'Save Transfer', () => {
    persistTravel(scene);
    showSaveTransferDialog(scene);
  });
  utility(width - UI_SAFE_RIGHT - 150, 'Find Party', () => findParty(scene));
  scene.add.text((REGION_RAIL_WIDTH + 680 + width - UI_SAFE_RIGHT - 320) / 2, footerY,
    'Drag to explore · Hold for details', {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('body30'), color: '#c6bdac'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
  syncRegionMapCameras(scene);

  scene.time.addEvent({ delay: 2000, loop: true, callback: () => persistTravel(scene) });
  scene.events.once('shutdown', () => persistTravel(scene));
}

// Save the current road ID, progress and destination so travel can resume later. scene is
// the Phaser screen that owns the objects, clock and input used here.
function persistTravel(scene) {
  if (!scene.activeEdge) return;

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact. ?.
  // only follows this link when the value exists; a missing optional value gives
  // undefined.
  GameState.world.travel = { edgeId: scene.activeEdge.id, t: scene.edgeT, target: scene.edgeTarget,
    destinationId: scene.destination?.id ?? null };
  saveProfile();
}

// Advance active travel with elapsed time and synchronize the visible party and camera.
// scene is the Phaser screen that owns the objects, clock and input used here. delta is
// elapsed frame time in milliseconds; divide by 1000 for movement in seconds.
export function updateScrollingWorldMap(scene, delta) {
  syncRegionMapCameras(scene);
  updateRegionLocationRail(scene, cleared);
  refreshMapLabels(scene);
  const region = regions[0];

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  scene.regionText?.setText(region.name);
  refreshRegionMapGold(scene);
  if (scene.selectionDetailsClose) return;
  if (!scene.activeEdge || !scene.edgeTarget) return;
  const edge = scene.activeEdge;
  const before = roadPoint(edge, scene.edgeT);

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const sign = scene.edgeTarget === edge.to ? 1 : -1;

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  scene.edgeT = Math.max(0, Math.min(1, scene.edgeT + sign * SPEED * Math.min(delta, 100) / 1000 / edge.length));
  const point = roadPoint(edge, scene.edgeT);
  scene.party.setPosition(point.x, point.y);
  const dx = point.x - before.x;
  const dy = point.y - before.y;
  const facing = `${dy < 0 ? 'north' : 'south'}-${dx < 0 ? 'west' : 'east'}`;

  if (scene.partyFacing !== facing) {
    scene.partyFacing = facing;
    playPartyAnimation(scene, 'walk');
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
