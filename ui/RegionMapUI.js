// These builders make the fixed map controls and messages. The map camera moves world
// artwork, while fixed controls should remain in screen space. Keep the visible list mask
// and the list's valid touch region lined up.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { bindSelectionDetails } from './SelectionDetails.js';
import { addRegionPanel, addRegionButton, setRegionPanelState } from './RegionMapTheme.js';
import { UI_SAFE_LEFT, UI_SAFE_RIGHT } from './Layout.js';
import GameState from '../game/GameState.js';

export const REGION_RAIL_WIDTH = 460;
export const MAP_HEADER_HEIGHT = 116;
export const MAP_FOOTER_HEIGHT = 118;

// Build the scrollable destination list and its fixed visible/input bounds. scene is the
// Phaser screen that owns the objects, clock and input used here.
export function createRegionLocationRail(scene, locations, canVisit, isCleared, details, select) {

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { height } = scene.scale;
  const width = REGION_RAIL_WIDTH;
  const fixed = object => object.setScrollFactor(0).setDepth(1000);
  addRegionPanel(scene, width / 2, (height + MAP_HEADER_HEIGHT) / 2, width, height - MAP_HEADER_HEIGHT);
  fixed(scene.add.text(32, 147, 'DESTINATIONS', {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f2d79f'
  }));

  fixed(scene.add.text(32, 198, 'Choose a place to travel', {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('mapDestinationHint'), color: '#c6bdac'
  }));
  const listTop = 239;
  const listBottom = height - 158;
  const rowStep = 102;

  // Scroll factor controls how much the object follows the camera. Zero keeps it fixed
  // while the world scrolls. Depth is drawing order, not distance or size. Higher-depth
  // objects draw on top of lower-depth objects.
  const list = scene.add.container(0, 0).setDepth(1002).setScrollFactor(0);
  const clip = scene.make.graphics({ x: 0, y: 0, add: false });
  clip.fillStyle(0xffffff).fillRect(18, listTop, width - 36, listBottom - listTop);

  // The mask limits which pixels are drawn. It does not automatically limit the touch hit
  // area; input bounds need their own check. A geometry mask uses a Graphics shape to
  // decide which pixels remain visible. The mask shape can be hidden while still clipping
  // its target.
  list.setMask(clip.createGeometryMask());

  // once registers a callback that removes itself after the first matching event.
  scene.events.once('shutdown', () => clip.destroy());

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  scene.locationRows = locations.map((poi, index) => {
    const y = 282 + index * rowStep;
    const open = canVisit(poi);
    const row = addRegionPanel(scene, width / 2 - 3, y, width - 40, 92, 1001).setName(`destination-${poi.id}`);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. The condition before ? chooses the first value when true and
    // the value after : when false.
    const name = fixed(scene.add.text(38, y - 28, poi.name, {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('mapDestination'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff0cd'
    })).setDepth(1002).setAlpha(open ? 1 : 0.55);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    const status = fixed(scene.add.text(38, y + 20, '', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('mapDestinationStatus'), color: '#dcc38b'
    })).setOrigin(0, 0.5).setDepth(1002);
    bindSelectionDetails(scene, row, () => details(poi), () => select(poi));
    list.add([row.regionMapArt, row, name, status]);
    const hitTest = row.input.hitAreaCallback;
    row.input.hitAreaCallback = (area, localX, localY, object) => {
      const screenY = row.y + list.y + localY - row.height / 2;
      return screenY >= listTop && screenY <= listBottom && hitTest(area, localX, localY, object);
    };

    return { poi, row, status, open };
  });

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  const maxOffset = Math.max(0, 282 + (locations.length - 1) * rowStep + 46 - listBottom);
  const track = scene.add.graphics().lineStyle(4, 0xd3a750, 0.35)
    .lineBetween(0, -(listBottom - listTop - 10) / 2, 0, (listBottom - listTop - 10) / 2)
    .setPosition(width - 12, (listTop + listBottom) / 2).setScrollFactor(0).setDepth(1003);
  const thumbHeight = Math.max(70, (listBottom - listTop) ** 2 / (listBottom - listTop + maxOffset));
  const thumb = scene.add.graphics().lineStyle(8, 0xe1c887, 0.9)
    .lineBetween(0, -thumbHeight / 2, 0, thumbHeight / 2)
    .setPosition(width - 12, listTop + 5 + thumbHeight / 2).setScrollFactor(0).setDepth(1004);

  track.setVisible(maxOffset > 0);
  thumb.setVisible(maxOffset > 0);
  const scroll = delta => {

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    list.y = -Math.max(0, Math.min(maxOffset, -list.y + delta));
    if (maxOffset > 0) thumb.y = listTop + 5 + thumbHeight / 2
      + (-list.y / maxOffset) * (listBottom - listTop - 10 - thumbHeight);
  };

  const inList = pointer => pointer.x >= 18 && pointer.x <= width - 18 && pointer.y >= listTop && pointer.y <= listBottom;
  const onWheel = (pointer, objects, deltaX, deltaY) => { if (inList(pointer)) scroll(deltaY); };
  let drag = null;
  const onDown = pointer => { if (inList(pointer)) drag = { id: pointer.id, y: pointer.y, startY: pointer.y }; };
  const onMove = pointer => {
    if (!drag || drag.id !== pointer.id || !pointer.isDown) return;
    if (Math.abs(pointer.y - drag.startY) > 6) scene.locationRows.forEach(({ row }) => row.emit('pointerout'));
    scroll(drag.y - pointer.y);
    drag.y = pointer.y;
  };

  const onUp = () => { drag = null; };

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  scene.input.on('wheel', onWheel);
  scene.input.on('pointerdown', onDown);
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  scene.input.on('gameout', onUp);
  scene.events.once('shutdown', () => {
    scene.input.off('wheel', onWheel);
    scene.input.off('pointerdown', onDown);
    scene.input.off('pointermove', onMove);
    scene.input.off('pointerup', onUp);
    scene.input.off('gameout', onUp);
  });

  fixed(scene.add.text(32, height - 95, 'Hold a destination\nfor details', {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('mapDestinationHint'), color: '#c6bdac', lineSpacing: 7
  }));
  updateRegionLocationRail(scene, isCleared);
}

// Refresh destination access, travel and clear labels from current world progress. scene
// is the Phaser screen that owns the objects, clock and input used here.
export function updateRegionLocationRail(scene, isCleared) {

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  for (const { poi, row, status, open } of scene.locationRows ?? []) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const traveling = scene.destination?.id === poi.id;
    const here = !scene.activeEdge && scene.partyNode === poi.node;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    setRegionPanelState(scene, row, traveling || here || scene.selectedMapPoi?.id === poi.id ? 'selected' : 'normal', open ? 1 : 0.55);
    const waystone = poi.id === 'pineshire' && !scene.activeEdge && scene.partyNode === 'verge-delves';
    status.setText(waystone ? 'Waystone · Instant return' : !open ? 'Locked' : traveling ? 'Traveling...' : here ? 'Party is here'
      : isCleared(poi.id) && ['delve', 'void'].includes(poi.type) ? 'Completed · Available' : 'Available')
      .setAlpha(open ? 1 : 0.45);
  }
}

// The header stays flush with the usable canvas. Currency slots and settings keep
// their own bounds, leaving the regional artwork unobstructed below it.
export function createRegionMapHeader(scene, onSettings) {
  const { width } = scene.scale;
  const fixed = object => object.setDepth(1003).setScrollFactor(0);
  addRegionPanel(scene, width / 2, MAP_HEADER_HEIGHT / 2, width, MAP_HEADER_HEIGHT);
  fixed(scene.add.image(UI_SAFE_LEFT + 40, 58, 'town-hub-world-map').setDisplaySize(80, 80));
  fixed(scene.add.text(UI_SAFE_LEFT + 100, 58, 'World Map', {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('heading48'), color: '#fff1d2', fontStyle: 'bold'
  }).setOrigin(0, 0.5));
  scene.regionText = fixed(scene.add.text((REGION_RAIL_WIDTH + width - 840) / 2, 58, '', {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('heading40'), color: '#f2d79f'
  }).setOrigin(0.5));
  const settingsX = width - UI_SAFE_RIGHT - 48;
  const aetherX = settingsX - 235;
  const goldX = aetherX - 340;
  for (const [x, key] of [[goldX, 'gold'], [aetherX, 'exchange']]) {
    addRegionPanel(scene, x, 58, 320, 88, 1000, 'normal', true, 'capsule');
    fixed(scene.add.image(x - 111, 58, `town-hub-${key}`).setDisplaySize(62, 62));
  }
  scene.currencyText = fixed(scene.add.text(goldX + 20, 58, '', {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('mapGold'), color: '#ffe0a0'
  }).setOrigin(0.5));
  fixed(scene.add.text(aetherX + 24, 58, 'Aether —', {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('body32'), color: '#ddd0f2'
  }).setOrigin(0.5));
  const settings = addRegionButton(scene, settingsX, 58, 96, 96, '', onSettings, { icon: 'town-hub-settings' });
  settings.panel.setName('world-map-settings');
}

export function refreshRegionMapGold(scene) {
  const value = Math.round(GameState.gold).toLocaleString('en-US');
  if (scene.currencyText?.text === value) return;
  scene.currencyText?.setText(value).setScale(1);
  if (scene.currencyText?.width > 195) scene.currencyText.setScale(195 / scene.currencyText.width);
}

// Selection is a small, dismissible card. Full encounter information remains in
// the existing scrollable held-details dialog; Travel calls the original router.
export function showRegionDestination(scene, poi, { open, completed, details, travel, inspect }) {
  scene.mapLocationClose?.();
  scene.selectedMapPoi = poi;
  const { width, height } = scene.scale;
  const w = Math.min(760, width - REGION_RAIL_WIDTH - UI_SAFE_LEFT - UI_SAFE_RIGHT);
  const h = 344;
  const x = width - UI_SAFE_RIGHT - w / 2;
  const y = height - MAP_FOOTER_HEIGHT - h / 2 - 20;
  const top = y - h / 2;
  const depth = 1100;
  const objects = [];
  const keep = object => { objects.push(object); return object; };
  const close = () => {
    objects.forEach(object => object.destroy());
    scene.selectedMapPoi = null;
    scene.mapLocationClose = null;
    scene.events.off('shutdown', close);
  };
  scene.mapLocationClose = close;
  scene.events.once('shutdown', close);
  const panel = keep(addRegionPanel(scene, x, y, w, h, depth));
  panel.setInteractive().on('pointerdown', (pointer, localX, localY, event) => event.stopPropagation());
  const text = (px, py, value, slot, color = '#fff1d2') => keep(scene.add.text(px, py, value, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx(slot), color,
    wordWrap: { width: w - 110 }, align: 'left'
  }).setScrollFactor(0).setDepth(depth + 2));
  text(x - w / 2 + 44, top + 28, poi.name, 'heading40');
  const here = !scene.activeEdge && scene.partyNode === poi.node;
  const traveling = scene.destination?.id === poi.id;
  const waystone = poi.id === 'pineshire' && !scene.activeEdge && scene.partyNode === 'verge-delves';
  text(x - w / 2 + 44, top + 88, !open ? 'Locked' : traveling ? 'Traveling here' : here ? 'Current location'
    : completed ? 'Completed · Available' : 'Available', 'body30', '#f2d79f');
  const summary = !open ? 'Defeat the preceding Delve boss to unlock this destination.'
    : waystone ? 'The Sunken Watch waystone can return you directly to Pineshire.'
    : poi.subtitle ?? (poi.type === 'town' ? 'Prepare your party, visit the market, and rest in town.'
      : poi.type === 'everdeep' ? 'Prepare expeditions and review their rewards.' : 'Review this destination, then follow the road with your party.');
  text(x - w / 2 + 44, top + 134, summary, 'body32', '#c6bdac');
  const addAction = (px, py, bw, label, action, options = {}) => {
    const button = addRegionButton(scene, px, py, bw, 84, label, action, { depth: depth + 3, ...options });
    objects.push(button.panel, button.text);
  };
  addAction(x + w / 2 - 63, top + 52, 76, '×', close);
  addAction(x - w / 2 + 201, top + h - 66, 310, waystone ? 'Return to Pineshire' : here ? 'Enter location' : 'Travel', () => {
    close();
    travel();
  }, { enabled: open, state: 'selected' });
  addAction(x + w / 2 - 193, top + h - 66, 290, 'Details', () => { close(); inspect(details); });
  syncRegionMapCameras(scene);
}

// Keep fixed controls and scrollable world artwork assigned to the appropriate camera.
// scene is the Phaser screen that owns the objects, clock and input used here.
export function syncRegionMapCameras(scene) {
  const map = scene.cameras.main;
  const ui = scene.mapUiCamera;
  if (!ui) return;

  for (const object of scene.children.list) {
    const fixed = object.depth >= 999 || object.name === 'region-map-surface';

    // The condition before ? chooses the first value when true and the value after : when
    // false. These bit operators work with 32-bit integers. >>> shifts in zero bits, while
    // ^ mixes bits with XOR. They are different from ordinary multiplication or
    // exponentiation.
    object.cameraFilter = fixed
      ? (object.cameraFilter | map.id) & ~ui.id
      : (object.cameraFilter | ui.id) & ~map.id;

    if (fixed) object.setScrollFactor(0);
  }
}
