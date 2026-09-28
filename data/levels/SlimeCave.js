// Camera-space pixels from the approved 1920 x 1080 Blender composition.
// Keeping the world ID preserves progression and existing saved unlocks.
export default {
  id: 'slime-cave',
  name: 'The Slime Cave',
  mapLabel: 'The Slime Cave',
  subtitle: 'A damp, abandoned cave consumed by living slime.',
  difficulty: 'Easy', recommendedLevel: 1, depth: 1, type: 'delve',
  possibleDrops: ['Gold', 'Healing Tonic', 'Adventurer XP'],
  prerequisites: [],
  map: { x: 0.307, y: 0.475, radius: 0.055 },
  // The new grid stays in the open floor; old image-specific blockers do not apply.
  terrain: [],
  visuals: {
    environment: {
      width: 1920, height: 1080, offsetY: -120,
      floor: { topLeftX: 465, topRightX: 1470, topY: 670,
        bottomLeftX: 380, bottomRightX: 1510, bottomY: 945 },
      layers: [
        { key: 'slime-cave-reference', url: new URL('../../assets/environments/slime-cave/reference.png', import.meta.url).href, depth: -1000 },
        { key: 'slime-cave-background', url: new URL('../../assets/environments/slime-cave/background.png', import.meta.url).href, depth: -990 },
        { key: 'slime-cave-floor', url: new URL('../../assets/environments/slime-cave/battlefield.png', import.meta.url).href, depth: -980 },
        { key: 'slime-cave-foreground', url: new URL('../../assets/environments/slime-cave/foreground.png', import.meta.url).href, depth: 4300 }
      ],
      ambient: {
        key: 'slime-cave-ambient',
        url: new URL('../../assets/environments/slime-cave/ambient.mp4', import.meta.url).href,
        sourceY: 540, width: 1920, height: 540,
        // Only pool neighborhoods are shown. Static receivers around each pool
        // preserve reflections/shadows from the already-rendered animation.
        regions: [
          { x: 325, y: 585, width: 255, height: 130 },
          { x: 625, y: 570, width: 275, height: 108 },
          { x: 1110, y: 550, width: 300, height: 132 },
          { x: 1520, y: 655, width: 130, height: 160 },
          { x: 1140, y: 1030, width: 180, height: 50 }
        ]
      }
    }
  }
};
