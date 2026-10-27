import catalog from './dialoguePortraits.json';

const metadata = import.meta.glob([
  '../assets/npcs/*/animation.json',
  '../assets/characters/*/portraits/animation.json',
  '../assets/enemies/*/*/portraits/animation.json'
], { eager: true, import: 'default' });
const images = import.meta.glob([
  '../assets/npcs/*/portrait.png', '../assets/npcs/*/*-sheet.png',
  '../assets/characters/*/portraits/*.png',
  '../assets/enemies/*/*/portraits/*.png'
], { eager: true, query: '?url', import: 'default' });

// These are dialogue assets, independent of the combat sprite and recruitment catalogs.
export const DIALOGUE_PORTRAITS = Object.fromEntries(catalog.flatMap(entry => {
  const root = `../${entry.directory}/`;
  const definition = metadata[`${root}animation.json`];
  if (!definition?.clips?.idle) return [];
  const textures = [{ key: `dialogue-${entry.id}-portrait`, url: images[`${root}portrait.png`] }];
  const clips = {};
  for (const [name, clip] of Object.entries(definition.clips)) {
    const key = `dialogue-${entry.id}-${name}`;
    textures.push({ key, url: images[root + clip.file], frameWidth: 256, frameHeight: 256 });
    clips[name] = { frames: Array.from({ length: clip.frameCount }, (_, frame) => ({ key, frame })),
      frameMs: clip.frameDurationMs, durationMs: clip.durationMs, loop: clip.loop };
  }
  for (const [name, clip] of Object.entries(definition.clips)) {
    if (clip.next) clips[name].next = clips[clip.next];
  }
  return [[entry.id, { ...entry, label: `${entry.name} - ${entry.role}`, idle: clips.idle,
    talk: clips.speak, special: clips.snap, portraitFrame: { key: `dialogue-${entry.id}-portrait` },
    textures, available: textures.every(texture => !!texture.url) }]];
}));

const games = new WeakMap();
const managerFor = game => {
  if (!games.has(game)) games.set(game, new Map());
  return games.get(game);
};

function retire(game, id, entry) {
  if (managerFor(game).get(id) !== entry) return;
  if (entry.users.size || entry.loading) return;
  for (const texture of entry.art.textures) {
    if (game.textures.exists(texture.key)) game.textures.remove(texture.key);
  }
  managerFor(game).delete(id);
}

// Only visible speakers hold their sheets in texture memory. A canceled request may finish loading,
// but its callback cannot revive an old speaker and its unused textures are then released.
export function acquireDialoguePortrait(scene, id, ready) {
  const art = DIALOGUE_PORTRAITS[id];
  if (!art?.available) { queueMicrotask(() => ready(false)); return () => {}; }
  const manager = managerFor(scene.game);
  let entry = manager.get(id);
  if (!entry) {
    entry = { art, users: new Set(), loading: false, callbacks: new Map() };
    manager.set(id, entry);
  }
  const user = {};
  entry.users.add(user);
  entry.callbacks.set(user, ready);
  const loaded = () => art.textures.every(texture => scene.textures.exists(texture.key));
  if (loaded()) {
    queueMicrotask(() => { if (entry.users.has(user)) ready(true); });
  } else if (!entry.loading) {
    entry.loading = true;
    const finish = () => {
      scene.load.off('complete', finish);
      scene.events.off('shutdown', stopped);
      entry.loading = false;
      const ok = loaded();
      for (const [token, callback] of entry.callbacks) if (entry.users.has(token)) callback(ok);
      entry.callbacks.clear();
      retire(scene.game, id, entry);
    };
    const stopped = () => {
      scene.load.off('complete', finish);
      entry.loading = false;
      const callbacks = [...entry.callbacks];
      entry.callbacks.clear();
      for (const [token, callback] of callbacks) if (entry.users.has(token)) callback(false, 'interrupted');
      retire(scene.game, id, entry);
    };
    scene.load.once('complete', finish);
    scene.events.once('shutdown', stopped);
    for (const texture of art.textures) {
      if (scene.textures.exists(texture.key)) continue;
      if (texture.frameWidth) scene.load.spritesheet(texture.key, texture.url,
        { frameWidth: texture.frameWidth, frameHeight: texture.frameHeight });
      else scene.load.image(texture.key, texture.url);
    }
    if (!scene.load.isLoading()) scene.load.start();
  }
  return () => {
    entry.users.delete(user);
    entry.callbacks.delete(user);
    retire(scene.game, id, entry);
  };
}

export function dialoguePortraitTextureStats(game) {
  return [...managerFor(game)].map(([id, entry]) => ({ id, users: entry.users.size,
    loading: entry.loading, decodedBytes: entry.art.textures.reduce((sum, art) => {
      const texture = game.textures.exists(art.key) ? game.textures.get(art.key) : null;
      const source = texture?.source?.[0];
      return sum + (source ? source.width * source.height * 4 : 0);
    }, 0) }));
}
