import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import { bindSelectionDetails } from './SelectionDetails.js';
import { addRegionPanel, setRegionPanelState } from './RegionMapTheme.js';

export const REGION_RAIL_WIDTH = 460;
export const MAP_HEADER_HEIGHT = 116;
export const MAP_FOOTER_HEIGHT = 146;

export function createRegionLocationRail(scene, locations, canVisit, isCleared, details, select) {
  const { height } = scene.scale;
  const width = REGION_RAIL_WIDTH;
  const fixed = object => object.setScrollFactor(0).setDepth(1000);
  addRegionPanel(scene, width / 2, (height + MAP_HEADER_HEIGHT) / 2, width, height - MAP_HEADER_HEIGHT);
  fixed(scene.add.text(32, 147, 'DESTINATIONS', {
    fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('body36'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#f2d79f'
  }));
  fixed(scene.add.text(32, 198, 'Choose a place to travel', {
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('mapDestinationHint'), color: '#b4c4af'
  }));
  const listTop = 239;
  const listBottom = height - 158;
  const rowStep = 102;
  const list = scene.add.container(0, 0).setDepth(1002).setScrollFactor(0);
  const clip = scene.make.graphics({ x: 0, y: 0, add: false });
  clip.fillStyle(0xffffff).fillRect(18, listTop, width - 36, listBottom - listTop);
  list.setMask(clip.createGeometryMask());
  scene.events.once('shutdown', () => clip.destroy());
  scene.locationRows = locations.map((poi, index) => {
    const y = 282 + index * rowStep;
    const open = canVisit(poi);
    const row = addRegionPanel(scene, width / 2 - 3, y, width - 40, 92, 1001).setName(`destination-${poi.id}`);
    const name = fixed(scene.add.text(38, y - 28, poi.name, {
      fontFamily: UI_FONT_FAMILIES.serif, fontSize: fontPx('mapDestination'), fontStyle: UI_FONT_WEIGHTS.bold, color: '#fff0cd'
    })).setDepth(1002).setAlpha(open ? 1 : 0.55);
    const status = fixed(scene.add.text(38, y + 20, '', {
      fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('mapDestinationStatus'), color: '#acc7a5'
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
  const maxOffset = Math.max(0, 282 + (locations.length - 1) * rowStep + 46 - listBottom);
  const track = scene.add.graphics().lineStyle(4, 0x9ab39b, 0.45)
    .lineBetween(0, -(listBottom - listTop - 10) / 2, 0, (listBottom - listTop - 10) / 2)
    .setPosition(width - 12, (listTop + listBottom) / 2).setScrollFactor(0).setDepth(1003);
  const thumbHeight = Math.max(70, (listBottom - listTop) ** 2 / (listBottom - listTop + maxOffset));
  const thumb = scene.add.graphics().lineStyle(8, 0xe1c887, 0.9)
    .lineBetween(0, -thumbHeight / 2, 0, thumbHeight / 2)
    .setPosition(width - 12, listTop + 5 + thumbHeight / 2).setScrollFactor(0).setDepth(1004);
  track.setVisible(maxOffset > 0);
  thumb.setVisible(maxOffset > 0);
  const scroll = delta => {
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
    fontFamily: UI_FONT_FAMILIES.sans, fontSize: fontPx('mapDestinationHint'), color: '#b4c4af', lineSpacing: 7
  }));
  updateRegionLocationRail(scene, isCleared);
}

export function updateRegionLocationRail(scene, isCleared) {
  for (const { poi, row, status, open } of scene.locationRows ?? []) {
    const traveling = scene.destination?.id === poi.id;
    const here = !scene.activeEdge && scene.partyNode === poi.node;
    setRegionPanelState(scene, row, traveling || here ? 'selected' : 'normal', open ? 1 : 0.4);
    status.setText(!open ? 'Locked' : traveling ? 'Traveling...' : here ? 'Party is here'
      : isCleared(poi.id) && ['delve', 'void'].includes(poi.type) ? 'Cleared · Travel' : 'Travel')
      .setAlpha(open ? 1 : 0.45);
  }
}

export function syncRegionMapCameras(scene) {
  const map = scene.cameras.main;
  const ui = scene.mapUiCamera;
  if (!ui) return;
  for (const object of scene.children.list) {
    const fixed = object.depth >= 999 || object.name === 'region-map-surface';
    object.cameraFilter = fixed
      ? (object.cameraFilter | map.id) & ~ui.id
      : (object.cameraFilter | ui.id) & ~map.id;
    if (fixed) object.setScrollFactor(0);
  }
}
