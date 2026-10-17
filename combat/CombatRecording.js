import { deliverCombatLog } from '../services/CombatLogFiles.js';
import { LEGACY_KEYS, initializeDiagnosticStorage, diagnosticRead, diagnosticTransaction,
  storageWarning, storageMessages } from './DiagnosticStorage.js';

const RAW_LIMIT = 16 * 1024 * 1024;
const TOTAL_RAW_LIMIT = 64 * 1024 * 1024;
const TOTAL_BOSS_LIMIT = 8 * 1024 * 1024;
const TOTAL_CHECKPOINT_LIMIT = 16 * 1024 * 1024;
const BOSS_LIMIT = 2 * 1024 * 1024;
const SUMMARY_LIMIT = 2 * 1024 * 1024;
const TOTAL_SUMMARY_LIMIT = 8 * 1024 * 1024;
const CHECKPOINT_LIMIT = 64 * 1024;
const MAX_ENCOUNTERS = 128;
const MAX_SESSIONS = 128;
const MEMORY_LIMIT = 4 * 1024 * 1024;
const sessions = new Map();
const checkpoints = new Map();
const changedCheckpoints = new Map();
const restoredTotals = new Map();
const restoredDiagnostics = new Map();
const sequenceFloors = new Map();
const pending = [];
let current = null;
let timer;
let writing = Promise.resolve();
let storageAvailable = false;
let writerOwned = false;
let totalRawBytes = 0;
let chunkIndex = 0;
let buffer = [];
let bufferBytes = 0;
let memoryBytes = 0;
let dirty = false;
let latestRecord = null;
let latestEncounterId = null;
const exportedLegacy = new Map();

async function acquireArchiveWriter() {
  if (!globalThis.navigator?.locks?.request) return false;
  return new Promise(resolve => {
    navigator.locks.request('delveDeep-combat-archive-writer', { ifAvailable: true }, lock => {
      resolve(!!lock);
      // Browser lifecycle releases this lock on page close. Other tabs can still read/export.
      if (lock) return new Promise(() => {});
    }).catch(() => resolve(false));
  });
}

function incomplete(session, reason, count = 1) {
  session.incomplete = true;
  session.truncation ??= {};
  session.truncation[reason] = (session.truncation[reason] ?? 0) + count;
}

// Initialization is shared by Settings and startup. Gameplay never waits for this promise.
export const combatRecordingReady = (async () => {
  storageAvailable = await initializeDiagnosticStorage();
  if (!storageAvailable) return;
  try {
    writerOwned = await acquireArchiveWriter();
    const saved = (await diagnosticRead('sessions')).filter(item => item.id !== 'latest-log');
    for (const session of saved) {
      sessions.set(session.id, session);
      session.durable = true;
      totalRawBytes += session.rawBytes ?? 0;
    }
    current = saved.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
    if (!writerOwned) {
      current = null;
      storageAvailable = false;
      storageWarning('recording-writer-unavailable', 'Another game tab owns combat recording storage, or this browser cannot lock archives safely. This tab can export existing archives; new recording data stays in memory and may be lost on refresh.');
      return;
    }
    if (current) {
      const encounters = await diagnosticRead('encounters', 'sessionId', current.id);
      for (const encounter of encounters) checkpoints.set(encounter.id, encounter);
      for (const encounter of encounters) {
        const record = JSON.parse(encounter.text);
        restoredTotals.set(encounter.id, record.diagnostics?.totals);
        restoredDiagnostics.set(encounter.id, record.diagnostics);
        sequenceFloors.set(encounter.id, record.eventSequence ?? 0);
      }
      chunkIndex = current.nextChunkIndex ?? 0;
      if (current.active) {
        current.recovery = 'Resumed after refresh; events in the last uncommitted batch may be missing';
        incomplete(current, 'refresh_uncommitted_tail_unknown');
        dirty = true;
        storageWarning('recording-resumed', 'Combat recording resumed after refresh. Its final uncommitted batch may be missing; the export marks this possible gap.');
      }
    }
  } catch { failStorage(); }
})();

export function isCombatLogging() { return current?.active === true; }
export function hasCombatRecording() { return sessions.size > 0; }
export function recordingSequenceFloor(encounterId) { return sequenceFloors.get(encounterId) ?? 0; }

function failStorage() {
  storageAvailable = false;
  if (current) { current.storage = 'memory-fallback'; incomplete(current, 'storage_failure'); dirty = true; }
  storageWarning('recording-memory', 'Combat recording could not be saved to IndexedDB. New data stays in bounded memory and may be lost on refresh. Stop logging and export now. Player saves and progression continue independently.');
}

function sealBuffer() {
  if (!buffer.length || !current) return;
  const text = `[${buffer.join(',')}]`;
  pending.push({ sessionId: current.id, index: chunkIndex++, text, bytes: bufferBytes, eventCount: buffer.length, kind: 'events' });
  memoryBytes += bufferBytes;
  current.nextChunkIndex = chunkIndex;
  buffer = []; bufferBytes = 0;
  trimMemory();
}

function trimMemory() {
  while (memoryBytes > MEMORY_LIMIT && pending.length) {
    // Protect boss terminal evidence before routine history when storage is unavailable or slow.
    const index = pending.findIndex(chunk => chunk.kind === 'events');
    const [dropped] = pending.splice(index < 0 ? 0 : index, 1);
    memoryBytes -= dropped.bytes;
    const session = sessions.get(dropped.sessionId);
    if (session) {
      incomplete(session, dropped.kind === 'boss' ? 'memory_boss_chunks_dropped' : 'memory_event_chunks_dropped');
      incomplete(session, `memory_${dropped.kind}_events_dropped`, dropped.eventCount ?? 1);
    }
    storageWarning('recording-memory-limit', 'Combat recording memory limit reached. Older uncommitted events were dropped; the export includes loss counts. Stop logging and export the remaining evidence.');
  }
}

// Preserve aggregate numbers while grouping per-wave monster IDs in checkpoint summaries.
function aggregate(rows, limit = 256) {
  const groups = Object.create(null);
  for (const row of Object.values(rows ?? {})) {
    const key = row.aggregateKey ?? (row.ability ? `${row.boss ? 'boss:' : ''}${row.actor ?? row.actorId}:${row.abilityId ?? row.ability}` : row.name ?? row.id);
    const targetKey = groups[key] || Object.keys(groups).length < limit ? key : 'other_aggregated';
    const result = groups[targetKey] ??= { aggregateKey: targetKey, name: row.name, actor: row.actor, ability: row.ability,
      abilityId: row.abilityId, boss: row.boss, groupedActorIds: true, reasons: {} };
    for (const [field, value] of Object.entries(row)) {
      if (typeof value === 'number' && Number.isFinite(value) && !['incapacitatedAt'].includes(field)) result[field] = (result[field] ?? 0) + value;
    }
    for (const [reason, value] of Object.entries(row.reasons ?? {})) result.reasons[reason] = (result.reasons[reason] ?? 0) + value;
  }
  return groups;
}

function checkpoint(record) {
  const { entries, diagnostics, ...base } = record;
  // Casualty totals remain in summary. Long per-death arrays are event history, not checkpoint state.
  delete base.casualties;
  const baseline = restoredTotals.get(record.startedAt);
  const priorDiagnostics = restoredDiagnostics.get(record.startedAt);
  const combinedTotals = diagnostics ? { ...diagnostics.totals,
    actors: aggregate([...Object.values(baseline?.actors ?? {}), ...Object.values(diagnostics.totals?.actors ?? {})]),
    abilities: aggregate([...Object.values(baseline?.abilities ?? {}), ...Object.values(diagnostics.totals?.abilities ?? {})]) } : baseline;
  if (baseline && diagnostics) for (const key of ['commands', 'interruptAttempts', 'successfulInterrupts']) {
    combinedTotals[key] = (baseline[key] ?? 0) + (diagnostics.totals[key] ?? 0);
  }
  let saved = { ...base, entries: [], diagnostics: diagnostics ? {
    level: diagnostics.level, effectSerial: diagnostics.effectSerial,
    totals: combinedTotals,
    active: diagnostics.active, bossActions: [...new Map([...(priorDiagnostics?.bossActions ?? []),
      ...diagnostics.bossActions].map(action => [action.actionId, action])).values()].slice(-10), waves: [],
    droppedBossActions: diagnostics.droppedBossActions, droppedWaveSummaries: diagnostics.droppedWaveSummaries,
    checkpointRetention: 'Latest ten boss outcomes; boss event chunks retained separately; cumulative totals grouped by actor name and ability',
  } : priorDiagnostics };
  let text = JSON.stringify(saved);
  if (text.length * 2 > CHECKPOINT_LIMIT && saved.diagnostics) {
    saved.diagnostics.active = {};
    saved.diagnostics.bossActions = [];
    saved.diagnostics.totals.actors = aggregate(saved.diagnostics.totals.actors, 32);
    saved.diagnostics.totals.abilities = aggregate(saved.diagnostics.totals.abilities, 32);
    saved.diagnostics.checkpointTruncation = 'Detailed active/boss snapshots omitted and summary groups coalesced to fit storage budget';
    incomplete(current, 'checkpoint_detail_truncations');
    storageWarning('checkpoint-compacted', 'A combat checkpoint was compacted to fit its size budget. Cumulative totals remain, while some snapshot detail was omitted; the export describes the truncation.');
    text = JSON.stringify(saved);
  }
  if (text.length * 2 > CHECKPOINT_LIMIT) {
    incomplete(current, 'checkpoint_size_limit');
    storageWarning('checkpoint-limit', 'A combat summary exceeded its storage limit. The previous checkpoint and retained boss events remain exportable; the recording is marked incomplete.');
    return null;
  }
  return { sessionId: current.id, id: record.startedAt, text };
}

function captureCheckpoint() {
  if (!current || !latestRecord) return;
  try {
    const saved = checkpoint(latestRecord);
    if (saved) {
      const delta = saved.text.length * 2 - (checkpoints.get(saved.id)?.text.length ?? 0) * 2;
      const total = [...sessions.values()].reduce((sum, session) => sum + (session.checkpointBytes ?? 0), 0);
      if (total + delta > TOTAL_CHECKPOINT_LIMIT) {
        incomplete(current, 'total_checkpoint_budget');
        current.active = false; current.stoppedAt = new Date().toISOString();
        storageWarning('summary-budget', 'Recording stopped because the archive summary budget is full. Export recordings and explicitly remove verified archives to make room. The previous summaries remain available.');
        return;
      }
      current.checkpointBytes = (current.checkpointBytes ?? 0) + delta;
      checkpoints.set(saved.id, saved); changedCheckpoints.set(saved.id, saved);
    }
  } catch { failStorage(); }
}

export function persistCombatRecording() {
  if (!current || !dirty || timer) return;
  timer = setTimeout(() => { timer = null; void flushCombatRecording(); }, 2000);
}

export async function flushCombatRecording() {
  clearTimeout(timer); timer = null;
  captureCheckpoint();
  sealBuffer();
  if (!current || !dirty || !storageAvailable) return;
  const session = current;
  const chunks = pending.filter(chunk => chunk.sessionId === session.id);
  const encounters = [...changedCheckpoints.values()].filter(row => row.sessionId === session.id);
  // Snapshot once per batch. Neither metadata nor old event chunks are reserialized per event.
  const metadata = JSON.parse(JSON.stringify(session));
  dirty = false;
  writing = writing.then(async () => {
    if (!storageAvailable) return;
    try {
      await diagnosticTransaction(['sessions', 'chunks', 'encounters'], 'readwrite', tx => {
        tx.objectStore('sessions').put(metadata);
        for (const chunk of chunks) tx.objectStore('chunks').put(chunk);
        for (const encounter of encounters) tx.objectStore('encounters').put(encounter);
      });
      session.durable = true;
      for (const chunk of chunks) {
        const index = pending.indexOf(chunk);
        if (index >= 0) { pending.splice(index, 1); memoryBytes -= chunk.bytes; }
      }
      for (const encounter of encounters) if (changedCheckpoints.get(encounter.id) === encounter) changedCheckpoints.delete(encounter.id);
    } catch { failStorage(); }
  });
  await writing;
}

export async function startCombatLogging() {
  await combatRecordingReady;
  await flushCombatRecording();
  if (current?.active) return;
  if (!storageAvailable && current) {
    storageWarning('memory-session-retained', 'The memory-only recording is retained. Export and explicitly remove it before starting another memory-only session.');
    return;
  }
  if (sessions.size >= MAX_SESSIONS) {
    storageWarning('session-limit', '128 combat recordings are retained. Export recordings before explicitly removing archives to make room. No archives were deleted.');
    return;
  }
  const id = globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${sessions.size}`;
  current = { id, storageVersion: 2, startedAt: new Date().toISOString(), active: true,
    rawBytes: 0, rawEvents: 0, bossBytes: 0, summaryBytes: 0, checkpointBytes: 0, nextChunkIndex: 0, encounterCount: 0,
    storage: storageAvailable ? 'indexedDB' : 'memory-fallback', limits: {
      rawBytes: RAW_LIMIT, totalRawBytes: TOTAL_RAW_LIMIT, bossBytes: BOSS_LIMIT,
      totalBossBytes: TOTAL_BOSS_LIMIT, totalCheckpointBytes: TOTAL_CHECKPOINT_LIMIT,
      summaryBytes: SUMMARY_LIMIT, totalSummaryBytes: TOTAL_SUMMARY_LIMIT,
      encounterCount: MAX_ENCOUNTERS, checkpointBytes: CHECKPOINT_LIMIT, pendingMemoryBytes: MEMORY_LIMIT } };
  sessions.set(id, current);
  checkpoints.clear(); changedCheckpoints.clear(); restoredTotals.clear(); restoredDiagnostics.clear(); sequenceFloors.clear(); chunkIndex = 0; latestRecord = null; latestEncounterId = null; dirty = true;
  await flushCombatRecording();
}

export function recordCombatEntry(log, entry) {
  if (!current?.active || !log.simulationNow || log.backgroundProgress?.isReplaying) return;
  try {
    if (latestEncounterId !== log.record.startedAt) {
      captureCheckpoint();
      if (!current.active) { dirty = true; void flushCombatRecording(); return; }
      if (!checkpoints.has(log.record.startedAt) && current.encounterCount >= MAX_ENCOUNTERS) {
        current.active = false; current.stoppedAt = new Date().toISOString();
        incomplete(current, 'encounter_limit'); dirty = true;
        storageWarning('encounter-limit', 'Recording stopped at 128 encounters. Export it, then start a new recording. Game progression continues.');
        void flushCombatRecording(); return;
      }
      if (!checkpoints.has(log.record.startedAt)) current.encounterCount++;
      latestEncounterId = log.record.startedAt;
    }
    latestRecord = log.record;
    sequenceFloors.set(log.record.startedAt, entry.sequence ?? 0);
    const text = JSON.stringify({ encounterId: log.record.startedAt, ...entry });
    const bytes = text.length * 2;
    if (bytes <= 256 * 1024 && current.rawBytes + bytes <= RAW_LIMIT && totalRawBytes + bytes <= TOTAL_RAW_LIMIT && current.rawEvents < 100000) {
      buffer.push(text); bufferBytes += bytes;
      current.rawBytes += bytes; totalRawBytes += bytes; current.rawEvents++;
    } else {
      incomplete(current, 'raw_events_dropped');
      storageWarning('raw-limit', 'Combat recording raw history limit reached. New routine events are omitted; bounded boss outcomes and cumulative summaries continue. Export and start a new session, or explicitly remove exported archives.');
    }
    if (entry.boss && /^action_(resolved|cancelled|interrupted|failed|expired)$/.test(entry.type)) {
      const totalBossBytes = [...sessions.values()].reduce((sum, session) => sum + (session.bossBytes ?? 0), 0);
      if (current.bossBytes + bytes <= BOSS_LIMIT && totalBossBytes + bytes <= TOTAL_BOSS_LIMIT) {
        sealBuffer();
        pending.push({ sessionId: current.id, index: chunkIndex++, text: `[${text}]`, bytes, eventCount: 1, kind: 'boss' });
        current.nextChunkIndex = chunkIndex; current.bossBytes += bytes; memoryBytes += bytes; trimMemory();
      } else { incomplete(current, 'boss_outcomes_dropped'); storageWarning('boss-limit', 'Combat recording boss evidence limit reached. Cumulative outcome totals continue; export now to preserve the retained evidence.'); }
    }
    if (['wave_diagnostics', 'encounter_diagnostics'].includes(entry.type)) {
      const compactTotals = totals => totals ? { ...totals, actors: aggregate(totals.actors), abilities: aggregate(totals.abilities) } : undefined;
      const summaryText = JSON.stringify({ ...entry, encounterId: log.record.startedAt,
        totals: compactTotals(entry.totals), waveStartTotals: compactTotals(entry.waveStartTotals) });
      const summaryBytes = summaryText.length * 2;
      const total = [...sessions.values()].reduce((sum, session) => sum + (session.summaryBytes ?? 0), 0);
      if (current.summaryBytes + summaryBytes <= SUMMARY_LIMIT && total + summaryBytes <= TOTAL_SUMMARY_LIMIT) {
        sealBuffer();
        pending.push({ sessionId: current.id, index: chunkIndex++, text: `[${summaryText}]`, bytes: summaryBytes, eventCount: 1, kind: 'summary' });
        current.nextChunkIndex = chunkIndex; current.summaryBytes += summaryBytes; memoryBytes += summaryBytes; trimMemory();
      } else {
        incomplete(current, 'wave_summaries_dropped');
        storageWarning('wave-summary-limit', 'Wave summary history reached its archive limit. Cumulative encounter totals continue; older stored summaries remain available.');
      }
    }
    dirty = true;
    if (buffer.length >= 128 || bufferBytes >= 256 * 1024) sealBuffer();
    persistCombatRecording();
  } catch { failStorage(); }
}

export async function stopCombatLogging() {
  await combatRecordingReady;
  if (current?.active) { current.active = false; current.stoppedAt = new Date().toISOString(); dirty = true; }
  await flushCombatRecording();
}

export async function exportCombatRecording(id = current?.id) {
  await combatRecordingReady;
  await flushCombatRecording();
  id ??= current?.id;
  const session = sessions.get(id);
  if (!session) return;
  let chunks = [], encounterRows = [];
  let archiveReadFailed = false;
  try {
    chunks = await diagnosticRead('chunks', 'sessionId', id);
    encounterRows = await diagnosticRead('encounters', 'sessionId', id);
  } catch { archiveReadFailed = session.durable === true; }
  const byIndex = new Map(chunks.map(chunk => [chunk.index, chunk]));
  for (const chunk of pending.filter(item => item.sessionId === id)) byIndex.set(chunk.index, chunk);
  const byEncounter = new Map(encounterRows.map(row => [row.id, row]));
  if (id === current?.id) for (const [key, row] of checkpoints) byEncounter.set(key, row);
  const encounters = new Map([...byEncounter].map(([key, row]) => [key, JSON.parse(row.text)]));
  for (const chunk of [...byIndex.values()].sort((a, b) => a.index - b.index)) for (const event of JSON.parse(chunk.text)) {
    const { encounterId, ...entry } = event;
    if (!encounters.has(encounterId)) encounters.set(encounterId, { startedAt: encounterId, entries: [], checkpointMissing: true });
    const encounter = encounters.get(encounterId);
    if (chunk.kind === 'boss') (encounter.bossTerminalEvents ??= []).push(entry);
    else if (chunk.kind === 'summary') (encounter.diagnosticSummaries ??= []).push(entry);
    else encounter.entries.push(entry);
  }
  const result = { ...session, incomplete: session.incomplete || archiveReadFailed,
    archiveReadFailed, warnings: storageMessages(), encounters: [...encounters.values()] };
  if (archiveReadFailed) storageWarning('export-partial', 'The stored archive could not be read. This export contains only data still in memory and is marked incomplete.');
  const delivered = await deliverCombatLog(JSON.stringify(result, null, 2), `delve-combat-session-${session.startedAt.replace(/[:.]/g, '-')}.json`);
  return delivered && !archiveReadFailed;
}

export async function showCombatArchives() {
  await combatRecordingReady;
  const dialog = document.createElement('dialog');
  dialog.style.cssText = 'width:85vw;max-height:80vh;overflow:auto;background:#292524;color:#fff1d2;padding:20px;font:18px sans-serif;';
  const title = document.createElement('h2'); title.textContent = 'Combat recordings'; dialog.append(title);
  const note = document.createElement('p');
  note.textContent = 'Save or share and verify the JSON file before removing archives. Cleanup only affects the selected combat log; player saves and settings are never removed.';
  dialog.append(note);
  const add = (label, action) => {
    const button = document.createElement('button'); button.textContent = label;
    button.style.cssText = 'min-height:44px;margin:6px;';
    button.onclick = async () => { button.disabled = true; try { await action(button); }
      catch (error) { storageWarning('archive-operation', `Combat archive operation failed. ${error?.message ?? 'Try exporting again.'} Your recording remains available in the app.`); }
      finally { if (button.isConnected) button.disabled = false; } };
    dialog.append(button); return button;
  };
  for (const session of [...sessions.values()].reverse()) {
    const row = document.createElement('p'); row.textContent = `${session.startedAt}${session.active ? ' (recording)' : ''}${session.incomplete ? ' (incomplete)' : ''}`; dialog.append(row);
    let exportRequested = false;
    add('Export recording', async () => { exportRequested = await exportCombatRecording(session.id) === true; });
    add('Remove this exported archive…', async button => {
      if (!sessions.has(session.id)) return;
      if (!exportRequested || session.active) { storageWarning('cleanup-export-first', 'Stop this recording, export it and verify the downloaded file before removing its archive.'); return; }
      if (!globalThis.confirm('Have you verified the exported recording? Permanently remove only this combat archive?')) return;
      if (session.durable && !writerOwned) {
        storageWarning('archive-cleanup-locked', 'Use the recording owner tab to remove stored archives. No archive was removed from this tab.');
        return;
      }
      if (session.durable) await diagnosticTransaction(['sessions', 'chunks', 'encounters'], 'readwrite', tx => {
        tx.objectStore('sessions').delete(session.id);
        for (const store of ['chunks', 'encounters']) {
          const request = tx.objectStore(store).index('sessionId').openKeyCursor(IDBKeyRange.only(session.id));
          request.onsuccess = () => { const cursor = request.result; if (cursor) { tx.objectStore(store).delete(cursor.primaryKey); cursor.continue(); } };
        }
      });
      sessions.delete(session.id); totalRawBytes -= session.rawBytes ?? 0;
      for (let index = pending.length - 1; index >= 0; index--) if (pending[index].sessionId === session.id) { memoryBytes -= pending[index].bytes; pending.splice(index, 1); }
      if (current?.id === session.id) { current = null; checkpoints.clear(); changedCheckpoints.clear(); restoredTotals.clear(); restoredDiagnostics.clear(); sequenceFloors.clear(); latestRecord = null; latestEncounterId = null; }
      button.textContent = 'Archive removed'; row.textContent += ' (removed)';
    });
  }
  for (const key of LEGACY_KEYS) {
    let archive;
    try { archive = await diagnosticRead('legacy', null, key); } catch { /* Original copy stays accessible below. */ }
    let local;
    try { local = localStorage.getItem(key); } catch { /* Reported by storage initialization. */ }
    const versions = [...new Set([archive?.raw, local].filter(Boolean))];
    for (const [index, raw] of versions.entries()) {
      const label = document.createElement('p'); label.textContent = `${key} (legacy copy ${index + 1})`; dialog.append(label);
      add('Export original legacy data', async () => {
        if (await deliverCombatLog(raw, `${key}-legacy.json`)) exportedLegacy.set(raw, true);
      });
      add('Clean up this exported legacy copy…', async button => {
        if (!exportedLegacy.has(raw)) { storageWarning('legacy-export-first', 'Export and verify this exact legacy copy before cleanup.'); return; }
        if (!globalThis.confirm('Have you verified this exported legacy log? Remove this exact combat copy from browser storage? Player saves and settings are kept.')) return;
        if (localStorage.getItem(key) === raw) localStorage.removeItem(key);
        if (archive?.raw === raw) await diagnosticTransaction(['legacy'], 'readwrite', tx => tx.objectStore('legacy').delete(key));
        globalThis.dispatchEvent?.(new Event('delve-diagnostic-storage-ready'));
        button.textContent = 'Legacy copy cleaned up';
      });
    }
  }
  if (!dialog.querySelector('button')) { const empty = document.createElement('p'); empty.textContent = 'No stored combat recordings.'; dialog.append(empty); }
  add('Close', () => dialog.close()); dialog.onclose = () => dialog.remove();
  document.body.append(dialog); dialog.showModal();
}

globalThis.addEventListener?.('pagehide', () => { void flushCombatRecording(); });
globalThis.document?.addEventListener('visibilitychange', () => { if (document.hidden) void flushCombatRecording(); });
