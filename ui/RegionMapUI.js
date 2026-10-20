// These builders make the fixed map controls and messages. The map camera moves world
// artwork, while fixed controls should remain in screen space. Keep the visible list mask
// and the list's valid touch region lined up.

import { scrollbarSurface } from './Scrollbar.js';
import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { bindSelectionDetails } from './SelectionDetails.js';
import { addRegionPanel, addRegionButton, setRegionPanelState } from './RegionMapTheme.js';
import { UI_SAFE_LEFT, UI_SAFE_RIGHT } from './Layout.js';
import GameState from '../game/GameState.js';
import { nodePoint } from '../data/worldMap.js';
import { playUiSound } from '../services/UiAudioService.js';
import { animateSettingsCog } from './AnimatedSettingsCog.js';
import { addOrnateCloseButton } from './OrnateCloseButton.js';

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
  fixed(scene.add.text(40, 147, 'DESTINATIONS', {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f2d79f'
  }));

  fixed(scene.add.text(40, 198, 'Choose a destination', {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('mapDestinationHint'), color: '#c6bdac'
  }));
  const hint = fixed(scene.add.text(40, height - 44, 'Hold a destination\nfor details', {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('mapDestinationHint'), color: '#c6bdac', lineSpacing: 4
  })).setOrigin(0, 1);
  const listTop = 248;
  const listBottom = hint.y - hint.height - 28;
  const rowHeight = 144;
  const rowStep = rowHeight + 12;
  const firstY = listTop + rowHeight / 2;

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
    const y = firstY + index * rowStep;
    const open = canVisit(poi);
    const row = addRegionPanel(scene, width / 2 - 6, y, width - 48, rowHeight, 1001, 'normal', true, 'card').setName(`destination-${poi.id}`);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects. The condition before ? chooses the first value when true and
    // the value after : when false.
    const name = fixed(scene.add.text(44, y - rowHeight / 2 + 14, poi.name, {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('mapDestination'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff0cd',
      wordWrap: { width: width - 100 }
    })).setDepth(1002).setAlpha(open ? 1 : 0.55);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    const status = fixed(scene.add.text(44, y + rowHeight / 2 - 25, 'Available', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('mapDestinationStatus'), color: '#dcc38b'
    })).setOrigin(0, 0.5).setDepth(1002);
    name.y = y - (name.height + 8 + status.height) / 2;
    status.y = name.y + name.height + 8 + status.height / 2;
    bindSelectionDetails(scene, row, () => details(poi), () => select(poi), undefined, { allowSceneInput: true });
    list.add([row.regionMapArt, row, name, status]);
    const hitTest = row.input.hitAreaCallback;
    row.input.hitAreaCallback = (area, localX, localY, object) => {
      const screenY = row.y + list.y + localY - row.height / 2;
      return screenY >= listTop && screenY <= listBottom && hitTest(area, localX, localY, object);
    };

    return { poi, row, name, status, open };
  });

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  const maxOffset = Math.max(0, firstY + (locations.length - 1) * rowStep + rowHeight / 2 - listBottom);
  const track = scrollbarSurface(scene, width - 12, (listTop + listBottom) / 2,
    20, listBottom - listTop - 10, 'track', 1003).setScrollFactor(0);
  const thumbHeight = Math.max(70, (listBottom - listTop) ** 2 / (listBottom - listTop + maxOffset));
  const thumb = scrollbarSurface(scene, width - 12, listTop + 5 + thumbHeight / 2,
    20, thumbHeight, 'thumb', 1004).setScrollFactor(0);
  thumb.setScrollbarProgress(0, listBottom - listTop - 10);

  track.setVisible(maxOffset > 0);
  thumb.setVisible(maxOffset > 0);
  const scroll = delta => {

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    list.y = -Math.max(0, Math.min(maxOffset, -list.y + delta));
    if (maxOffset > 0) thumb.y = listTop + 5 + thumbHeight / 2
      + (-list.y / maxOffset) * (listBottom - listTop - 10 - thumbHeight);
    thumb.setScrollbarProgress(maxOffset ? -list.y / maxOffset : 0, listBottom - listTop - 10);
  };

  const inList = pointer => !scene.selectionDetailsClose && pointer.x >= 18 && pointer.x <= width - 18 && pointer.y >= listTop && pointer.y <= listBottom;
  const onWheel = (pointer, objects, deltaX, deltaY) => { if (inList(pointer)) scroll(deltaY); };
  let drag = null;
  const onDown = pointer => { if (inList(pointer)) drag = { id: pointer.id, y: pointer.y, startY: pointer.y }; };
  const onMove = pointer => {
    if (scene.selectionDetailsClose) { drag = null; return; }
    if (!drag || drag.id !== pointer.id || !pointer.isDown) return;
    if (!drag.moving && Math.abs(pointer.y - drag.startY) < 12) return;
    drag.moving = true;
    scene.locationRows.forEach(({ row }) => row.emit('pointerout'));
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
  scene.game.events.on('blur', onUp);
  scene.events.once('shutdown', () => {
    scene.input.off('wheel', onWheel);
    scene.input.off('pointerdown', onDown);
    scene.input.off('pointermove', onMove);
    scene.input.off('pointerup', onUp);
    scene.input.off('gameout', onUp);
    scene.game.events.off('blur', onUp);
  });
  updateRegionLocationRail(scene, isCleared);
}

// Refresh destination access, travel and clear labels from current world progress. scene
// is the Phaser screen that owns the objects, clock and input used here.
export function updateRegionLocationRail(scene, isCleared) {

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  for (const { poi, row, name, status, open } of scene.locationRows ?? []) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const traveling = scene.destination?.id === poi.id;
    const here = !scene.activeEdge && scene.partyNode === poi.node;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    setRegionPanelState(scene, row, traveling || here || scene.selectedMapPoi?.id === poi.id ? 'selected' : 'normal', open ? 1 : 0.55);
    name.setColor(here ? '#ffdb86' : '#fff1d2');
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
  animateSettingsCog(scene, settings.panel.pressVisuals[1], settings.panel,
    () => Boolean(scene.selectionDetailsClose));
}

export function refreshRegionMapGold(scene) {
  const value = Math.round(GameState.gold).toLocaleString('en-US');
  if (scene.currencyText?.text === value) return;
  scene.currencyText?.setText(value).setScale(1);
  if (scene.currencyText?.width > 195) scene.currencyText.setScale(195 / scene.currencyText.width);
}

// Measured text keeps the nonmodal card compact without shrinking the reading size.
export function showRegionDestination(scene, poi, { open, completed, details, travel, inspect }) {
  playUiSound(scene, 'navigation');
  scene.mapLocationClose?.();
  scene.selectedMapPoi = poi;
  const camera = scene.cameras.main;
  const w = Math.min(640, camera.width - 64);
  const depth = 1100;
  const objects = [];
  const keep = object => { objects.push(object); return object; };
  const text = (x, y, value, slot, wrap, color = '#fff1d2') => keep(scene.add.text(x, y, value, {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx(slot), color,
    wordWrap: { width: wrap }, align: 'left'
  }).setDepth(depth + 2));
  const title = text(-w / 2 + 38, 28, poi.name, 'body36', w - 174);
  const here = !scene.activeEdge && scene.partyNode === poi.node;
  const traveling = scene.destination?.id === poi.id;
  const waystone = poi.id === 'pineshire' && !scene.activeEdge && scene.partyNode === 'verge-delves';
  const status = text(-w / 2 + 38, Math.max(82, title.y + title.height + 10), !open ? 'Locked' : traveling ? 'Traveling here'
    : here ? 'Current location' : completed ? 'Completed · Available' : 'Available', 'body30', w - 76, '#f2d79f');
  const summary = !open ? 'Defeat the preceding Delve boss to open this road.'
    : waystone ? 'Use the waystone for an instant return to Pineshire.'
    : poi.subtitle ?? (poi.type === 'town' ? 'Prepare your party and visit town services.'
      : poi.type === 'everdeep' ? 'Prepare expeditions and review rewards.' : 'Inspect this place or follow the road.');
  const body = text(-w / 2 + 38, status.y + status.height + 10, summary, 'body30', w - 76, '#c6bdac');
  const h = Math.max(300, body.y + body.height + 152);
  const panel = keep(addRegionPanel(scene, 0, h / 2, w, h, depth));
  objects.push(panel.regionMapArt);
  panel.setInteractive().on('pointerdown', (pointer, x, y, event) => event.stopPropagation());
  const container = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0).setSize(w, h);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    container.destroy(true);
    scene.selectedMapPoi = null;
    scene.mapLocationClose = null;
    scene.events.off('shutdown', close);
  };
  scene.mapLocationClose = close;
  scene.events.once('shutdown', close);
  const addAction = (px, py, bw, label, action, options = {}) => {
    const button = addRegionButton(scene, px, py, bw, 88, label, action, { depth: depth + 3, ...options });
    objects.push(...button.objects);
  };
  const closeControl = addOrnateCloseButton(scene, w / 2 - 78, 76, 96, 88, close, { depth: depth + 3 });
  objects.push(...closeControl.objects);
  const buttonWidth = (w - 100) / 2;
  addAction(-(buttonWidth + 24) / 2, h - 80, buttonWidth, waystone ? 'Return' : here ? 'Enter' : 'Travel', () => {
    close();
    playUiSound(scene, 'navigation');
    travel();
  }, { enabled: open, disabledReason: summary, state: 'selected' });
  addAction((buttonWidth + 24) / 2, h - 80, buttonWidth, 'Details', () => { close(); inspect(details); });
  container.add(objects.sort((a, b) => a.depth - b.depth));

  // Project the unchanged node into the camera, choosing the opposite side with
  // a margin so the card does not jitter while the player drags across the center.
  let side = null;
  const position = () => {
    const point = nodePoint(poi.node);
    const screenX = camera.x + camera.width / 2 + (point.x - camera.midPoint.x) * camera.zoom;
    const screenY = camera.y + camera.height / 2 + (point.y - camera.midPoint.y) * camera.zoom;
    const middle = camera.x + camera.width / 2;
    if (!side) side = screenX < middle ? 'right' : 'left';
    if (side === 'right' && screenX > middle + 100) side = 'left';
    else if (side === 'left' && screenX < middle - 100) side = 'right';
    const x = side === 'right' ? camera.x + camera.width - w / 2 - 24 : camera.x + w / 2 + 24;
    const top = camera.y + 24;
    const bottom = camera.y + camera.height - h - 24;
    const y = screenY < camera.y + camera.height / 2 ? bottom : top;
    container.setPosition(x, Math.max(top, y));
  };
  position();
  scene.events.on('postupdate', position);
  container.once('destroy', () => scene.events.off('postupdate', position));
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
