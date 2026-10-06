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
    fontFamily: 'Georgia', fontSize: '36px', fontStyle: 'bold', color: '#f2d79f'
  }));
  fixed(scene.add.text(32, 198, 'Choose a place to travel', {
    fontFamily: 'Arial', fontSize: '27px', color: '#b4c4af'
  }));
  scene.locationRows = locations.map((poi, index) => {
    const y = 282 + index * 84;
    const open = canVisit(poi);
    const row = addRegionPanel(scene, width / 2 - 3, y, width - 40, 76, 1001).setName(`destination-${poi.id}`);
    fixed(scene.add.text(38, y - 28, poi.name, {
      fontFamily: 'Georgia', fontSize: '31px', fontStyle: 'bold', color: '#fff0cd'
    })).setDepth(1002).setAlpha(open ? 1 : 0.45);
    const status = fixed(scene.add.text(38, y + 17, '', {
      fontFamily: 'Arial', fontSize: '25px', color: '#acc7a5'
    })).setOrigin(0, 0.5).setDepth(1002);
    bindSelectionDetails(scene, row, () => details(poi), () => select(poi));
    return { poi, row, status, open };
  });
  fixed(scene.add.text(32, height - 95, 'Hold a destination\nfor details', {
    fontFamily: 'Arial', fontSize: '27px', color: '#b4c4af', lineSpacing: 7
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
