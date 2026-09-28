// Original transparent PixelLab PNGs. Static URLs let Vite bundle each frame.
// Source prompts, character IDs and first-version directional limits: asset README.
const textures = [
  { key: 'laurana-idle-south-east-0', url: new URL('../assets/characters/laurana/pixellab/idle/south-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-idle-south-east-1', url: new URL('../assets/characters/laurana/pixellab/idle/south-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-idle-south-east-2', url: new URL('../assets/characters/laurana/pixellab/idle/south-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-idle-south-east-3', url: new URL('../assets/characters/laurana/pixellab/idle/south-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-idle-north-east-0', url: new URL('../assets/characters/laurana/pixellab/idle/north-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-idle-north-east-1', url: new URL('../assets/characters/laurana/pixellab/idle/north-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-idle-north-east-2', url: new URL('../assets/characters/laurana/pixellab/idle/north-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-idle-north-east-3', url: new URL('../assets/characters/laurana/pixellab/idle/north-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-0', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-1', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-2', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-3', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-4', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-5', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-5.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-6', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-6.png', import.meta.url).href },
  { key: 'laurana-walk-south-east-7', url: new URL('../assets/characters/laurana/pixellab/walk/south-east/frame-7.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-0', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-0.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-1', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-1.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-2', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-2.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-3', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-3.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-4', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-4.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-5', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-5.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-6', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-6.png', import.meta.url).href },
  { key: 'laurana-walk-north-east-7', url: new URL('../assets/characters/laurana/pixellab/walk/north-east/frame-7.png', import.meta.url).href }
];

// Four rendered facings accept all eight movement headings. West mirrors east;
// separate left-facing art can replace this later without changing combat code.
const facing = {
  south: ['south-east', false], 'south-east': ['south-east', false],
  east: ['south-east', false], 'north-east': ['north-east', false],
  north: ['north-east', false], 'north-west': ['north-east', true],
  west: ['south-east', true], 'south-west': ['south-east', true]
};
const clips = Object.fromEntries(['idle', 'walk'].map(state => [state,
  Object.fromEntries(Object.entries(facing).map(([heading, [source, flipX]]) => [heading, {
    frameMs: state === 'idle' ? 230 : 110,
    frames: Array.from({ length: state === 'idle' ? 4 : 8 }, (_, index) => ({
      key: `laurana-${state}-${source}-${index}`,
      originX: 0.5, originY: 117 / 136, flipX
    }))
  }]))
]));

export const CHARACTER_SPRITES = {
  laurana: { textures, clips, scale: 1.25, footY: 30 }
};

export function preloadCharacterSprites(scene) {
  Object.values(CHARACTER_SPRITES).forEach(definition => {
    definition.textures.forEach(({ key, url }) => {
      if (!scene.textures.exists(key)) scene.load.image(key, url);
    });
  });
}
