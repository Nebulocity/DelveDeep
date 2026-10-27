import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { createServer } from 'vite';
import { UI_SOUNDS } from '../../data/uiSounds.js';
import { atomicWrite } from './storage.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const contentRoot = path.join(root, 'authoring/tutorial-studio');
const audioRoot = path.join(root, 'sounds/tutorial-studio');
const manifestPath = path.join(root, 'data/tutorialAudioImports.json');
const portraitRoot = path.join(root, 'assets/npcs/imported');
const draftPath = path.join(contentRoot, 'draft.json');
const port = Number(process.env.TUTORIAL_STUDIO_PORT || 5186);
const origin = `http://127.0.0.1:${port}`;
const token = randomUUID();
let writing = false;
const hash = text => createHash('sha256').update(text).digest('hex');
const read = async p => { try { return await fs.readFile(p, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };

// Every writable path is fixed or server-generated. Refuse symlink/junction escapes,
// including otherwise valid paths inside an authoring or audio directory.
async function contained(directory, file) {
  const actual = await fs.realpath(directory);
  if (actual.toLowerCase() !== path.resolve(directory).toLowerCase()) throw new Error('Authoring folders must not be symlinks or junctions.');
  const target = path.resolve(directory, file);
  if (path.dirname(target).toLowerCase() !== actual.toLowerCase()) throw new Error('Path is outside the approved folder.');
  for (const p of [target, target + '.bak']) {
    try { if ((await fs.lstat(p)).isSymbolicLink()) throw new Error('Symbolic file targets are not allowed.'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return target;
}

function noUnsafeKeys(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe JSON key.');
    noUnsafeKeys(child);
  }
}
async function body(req, max = 1200000) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > max) throw new Error('Request exceeds the size limit.'); chunks.push(chunk); }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); noUnsafeKeys(value); return value;
}
async function catalogs() {
  const source = await fs.readFile(path.join(root, 'services/MusicService.js'), 'utf8');
  const music = [...source.matchAll(/'(music-[a-z-]+)'\s*:/g)].map(m => ({ id: m[1], available: true }));
  const imported = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  return { audio: [...music, ...Object.entries(UI_SOUNDS).map(([id, a]) => ({ id: 'ui-' + id, available: !!a.url && a.license?.verified === true })),
    ...await Promise.all(imported.map(async a => ({ id: a.id, available: !!await read(await contained(audioRoot, a.filename)) })))] };
}
function audioSignature(bytes, extension) {
  if (extension === '.ogg') return bytes.subarray(0, 4).toString() === 'OggS';
  if (extension === '.wav') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WAVE';
  if (extension === '.m4a') return bytes.subarray(4, 8).toString() === 'ftyp';
  return extension === '.mp3' && (bytes.subarray(0, 3).toString() === 'ID3' || bytes[0] === 255 && (bytes[1] & 224) === 224);
}
const mimeTypes = { '.ogg': ['audio/ogg', 'application/ogg'], '.mp3': ['audio/mpeg', 'audio/mp3'], '.wav': ['audio/wav', 'audio/x-wav'], '.m4a': ['audio/mp4', 'audio/x-m4a'] };

function portraitDimensions(bytes) {
  if (bytes.length < 45 || bytes.length > 4000000 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    || bytes.readUInt32BE(8) !== 13 || bytes.subarray(12, 16).toString() !== 'IHDR') throw new Error('Choose a valid PNG under 4 MB.');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (width !== height || width < 32 || width > 1024) throw new Error('Portraits must be square, from 32 to 1024 pixels per side.');
  if (!({ 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] })[bytes[25]]?.includes(bytes[24])
    || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] > 1) throw new Error('Unsupported PNG header.');
  const data = []; let ended = false;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.subarray(offset + 4, offset + 8).toString();
    if (offset + length + 12 > bytes.length) throw new Error('Truncated PNG data.');
    if (type === 'IDAT') data.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
    if (type === 'IEND') { ended = length === 0 && offset === bytes.length; break; }
  }
  // Bound decompression independently of the claimed dimensions before storing it.
  if (!ended || !data.length || !inflateSync(Buffer.concat(data), { maxOutputLength: 16000000 }).length) throw new Error('Incomplete PNG image.');
  return { width, height };
}

await fs.mkdir(contentRoot, { recursive: true }); await fs.mkdir(audioRoot, { recursive: true });
await fs.mkdir(portraitRoot, { recursive: true });
const server = await createServer({ configFile: false, root, appType: 'mpa',
  define: { __DELVE_DEEP_BUILD_ID__: JSON.stringify('tutorial-studio-disposable') },
  server: { host: '127.0.0.1', hmr: { host: '127.0.0.1', port: port + 1 }, middlewareMode: true, watch: { ignored: ['**/authoring/**', '**/output/**', '**/project-backup/**', '**/android/**', '**/data/tutorialAudioImports.json', '**/sounds/tutorial-studio/**', '**/data/tutorialPortraitImports.json', '**/assets/npcs/imported/**'] }, fs: { strict: true, allow: [root] } },
  optimizeDeps: { entries: ['tools/tutorial-studio/index.html', 'tools/tutorial-studio/preview.html'] }
});
const api = async (req, res) => {
  if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403).end('Local host only.'); return; }
  const url = new URL(req.url, origin);
  if (url.pathname === '/') { res.writeHead(302, { Location: '/tools/tutorial-studio/index.html' }).end(); return; }
  if (!url.pathname.startsWith('/__studio/api/')) return server.middlewares(req, res, () => res.writeHead(404).end('Not found'));
  const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
  try {
    // Use the same live validator as the editor instead of Node's startup import cache.
    const { validatePresentation, PRESENTATION_VALIDATOR_VERSION } = await server.ssrLoadModule('/game/TutorialPresentation.js');
    if (req.method === 'GET' && url.pathname === '/__studio/api/bootstrap') {
      const text = await read(await contained(contentRoot, 'draft.json'));
      const baseline = JSON.parse(await fs.readFile(path.join(root, 'data/tutorialPresentation.json'), 'utf8'));
      return reply(200, { token, validatorVersion: PRESENTATION_VALIDATOR_VERSION, revision: hash(text ?? ''), draft: text ? JSON.parse(text) : baseline, baseline });
    }
    if (req.method !== 'POST' || req.headers.origin !== origin || req.headers['x-studio-token'] !== token) return reply(403, { error: 'Same-origin Studio token required.' });
    if (writing) return reply(409, { error: 'Another write is in progress.' });
    writing = true;
    try {
      if (['/__studio/api/save', '/__studio/api/publish'].includes(url.pathname)) {
        const { document, revision } = await body(req);
        const issues = validatePresentation(document, await catalogs());
        if (issues.some(i => i.level === 'error')) return reply(422, { error: 'Draft validation failed.', issues });
        const target = await contained(contentRoot, 'draft.json');
        if (hash(await read(target) ?? '') !== revision) return reply(409, { error: 'Draft changed on disk. Export your edits, then Reload before saving.' });
        const text = JSON.stringify(document, null, 2) + '\n';
        await atomicWrite(target, text);
        if (url.pathname.endsWith('/publish')) {
          const published = await contained(path.join(root, 'data'), 'tutorialPresentation.json');
          await atomicWrite(published, text); server.moduleGraph.invalidateAll();
        }
        return reply(200, { revision: hash(text), issues });
      }
      if (url.pathname === '/__studio/api/restore-backup') {
        await body(req);
        const target = await contained(contentRoot, 'draft.json');
        const text = await read(target + '.bak');
        if (!text || validatePresentation(JSON.parse(text), await catalogs()).some(i => i.level === 'error')) throw new Error('No valid backup is available.');
        await atomicWrite(target, text); return reply(200, { revision: hash(text), draft: JSON.parse(text) });
      }
      if (url.pathname === '/__studio/api/import-portrait') {
        const data = await body(req, 5600000);
        if (typeof data.label !== 'string' || !data.label.trim() || data.label.trim().length > 80 || /[\x00-\x1f]/.test(data.label)) throw new Error('Enter a speaker name between 1 and 80 characters.');
        if (typeof data.filename !== 'string' || !/^[a-zA-Z0-9_ .-]{1,120}\.png$/i.test(data.filename) || data.mime !== 'image/png') throw new Error('Choose a PNG file with a plain filename, without paths.');
        if (typeof data.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64)) throw new Error('Invalid portrait data.');
        const bytes = Buffer.from(data.base64, 'base64');
        const { width, height } = portraitDimensions(bytes);
        const id = 'portrait-' + randomUUID(), filename = id + '.png';
        const asset = await contained(portraitRoot, filename);
        const manifest = await contained(path.join(root, 'data'), 'tutorialPortraitImports.json');
        const entries = JSON.parse(await fs.readFile(manifest, 'utf8'));
        await fs.writeFile(asset, bytes, { flag: 'wx' });
        try { entries.push({ id, filename, label: data.label.trim(), width, height }); await atomicWrite(manifest, JSON.stringify(entries, null, 2) + '\n'); }
        catch (e) { await fs.rm(asset, { force: true }); throw e; }
        server.moduleGraph.invalidateAll();
        return reply(200, { id, label: data.label.trim() });
      }
      if (url.pathname === '/__studio/api/import-audio') {
        const data = await body(req, 12000000);
        if (typeof data.filename !== 'string' || !/^[a-zA-Z0-9_ .-]{1,120}$/.test(data.filename)) throw new Error('Use a plain audio filename without paths.');
        const ext = path.extname(data.filename).toLowerCase();
        if (!mimeTypes[ext]?.includes(data.mime) || !['sfx', 'ambience', 'music', 'voice'].includes(data.kind)) throw new Error('Supported formats: OGG, MP3, WAV, M4A with matching audio MIME.');
        if (typeof data.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64)) throw new Error('Invalid audio data.');
        const bytes = Buffer.from(data.base64, 'base64');
        if (bytes.length < 16 || bytes.length > 8000000 || !audioSignature(bytes, ext)) throw new Error('Audio signature does not match the extension, or exceeds 8 MB.');
        const id = 'tutorial-' + randomUUID(), filename = id + ext;
        const asset = await contained(audioRoot, filename);
        const manifest = await contained(path.join(root, 'data'), 'tutorialAudioImports.json');
        const entries = JSON.parse(await fs.readFile(manifest, 'utf8'));
        await fs.writeFile(asset, bytes, { flag: 'wx' });
        try { entries.push({ id, filename, kind: data.kind, label: data.filename }); await atomicWrite(manifest, JSON.stringify(entries, null, 2) + '\n'); }
        catch (e) { await fs.rm(asset, { force: true }); throw e; }
        server.moduleGraph.invalidateAll();
        return reply(200, { id, message: 'Imported and registered. Reload preview to refresh the audio library.' });
      }
      reply(404, { error: 'Unknown Studio endpoint.' });
    } finally { writing = false; }
  } catch (e) { reply(400, { error: e.message }); }
};
const listener = http.createServer((req, res) => { api(req, res).catch(e => { res.writeHead(500).end('Studio request failed.'); console.error(e); }); });
listener.listen(port, '127.0.0.1', () => console.log(`Tutorial Studio: ${origin}\nSave draft keeps authoring separate; Apply to game updates local story presentation.`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { listener.close(); server.close().finally(() => process.exit()); });
