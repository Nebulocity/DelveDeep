import { selectWorldMapCharacter } from '../game/WorldMapCharacter.js';
import { saveProfile } from '../game/GameStorage.js';
import { preparationNotice } from './DelvePreparation.js';
import HapticsService from '../services/HapticsService.js';

export function chooseWorldMapCharacter(scene, id, party) {
  const hero = selectWorldMapCharacter(id, party);
  if (!hero) return;
  saveProfile();
  HapticsService.tap();
  scene.events.emit('world-map-character-changed');
  scene.mapCharacterNotice?.forEach(object => object.destroy());
  const notice = preparationNotice(scene, scene.scale.width / 2, scene.scale.height - 155,
    `${hero.name} will now appear on the World Map.`, { depth: 11000, width: 1300, fontSize: 32 });
  const objects = [notice.panel, notice.text];
  scene.mapCharacterNotice = objects;
  scene.tweens.add({ targets: objects, alpha: 0, delay: 1800, duration: 350,
    onComplete: () => objects.forEach(object => object.destroy()) });
}
