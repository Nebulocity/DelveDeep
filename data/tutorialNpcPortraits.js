import tikoAnimation from '../assets/npcs/tiko/tiko-animation.json';
import importedPortraits from './tutorialPortraitImports.json';

const importedFiles = import.meta.glob('../assets/npcs/imported/*.png', { eager: true, query: '?url', import: 'default' });

const frames = (key, count) => Array.from({ length: count }, (_, frame) => ({ key, frame }));
const idle = { frames: frames('tutorial-tiko-idle', tikoAnimation.clips.idle.frames), frameMs: tikoAnimation.clips.idle.frameMs };
const talk = { frames: frames('tutorial-tiko-talk', tikoAnimation.clips.talk.frames), frameMs: tikoAnimation.clips.talk.frameMs,
  durationMs: tikoAnimation.clips.talk.durationMs, next: idle };

// Speaker artwork has its own catalog so NPCs never become recruitable heroes.
export const TUTORIAL_NPC_PORTRAITS = {
  tiko: { label: 'Tiko - retired adventurer / bartender', idle, talk, portraitFrame: idle.frames[0] }
};
for (const entry of importedPortraits) {
  const pose = { key: entry.id };
  TUTORIAL_NPC_PORTRAITS[entry.id] = { label: entry.label, portraitFrame: pose,
    idle: { frames: [pose], frameMs: 1000 } };
}

export function preloadTutorialNpcPortraits(scene) {
  const sheets = [
    ['tutorial-tiko-idle', new URL('../assets/npcs/tiko/tiko-idle-sheet.png', import.meta.url).href],
    ['tutorial-tiko-talk', new URL('../assets/npcs/tiko/tiko-talk-sheet.png', import.meta.url).href]
  ];
  for (const [key, url] of sheets) if (!scene.textures.exists(key)) scene.load.spritesheet(key, url,
    { frameWidth: tikoAnimation.frameWidth, frameHeight: tikoAnimation.frameHeight });
  for (const entry of importedPortraits) {
    const url = importedFiles[`../assets/npcs/imported/${entry.filename}`];
    if (url && !scene.textures.exists(entry.id)) scene.load.image(entry.id, url);
  }
}
