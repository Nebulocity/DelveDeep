// Combat archives never share the small synchronous profile storage budget.
export const LEGACY_KEYS = ['delveDeep.combatRecording.v1', 'delveDeep.lastCombatLog.v1'];
const DB_NAME = 'delveDeep.combatDiagnostics.v2';
let databasePromise;
let initialization;
const warnings = new Map();

export function storageWarning(code, message) {
  if (warnings.has(code)) return;
  warnings.set(code, message);
  console.warn(message);
  if (!globalThis.document?.body) return;
  try {
    let notice = document.getElementById('combat-storage-warning');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'combat-storage-warning';
      notice.setAttribute('role', 'alert');
      notice.style.cssText = 'position:fixed;bottom:12px;left:5%;width:90%;z-index:100000;background:#442514;color:#fff1d2;padding:14px;font:16px sans-serif;box-sizing:border-box;max-height:35vh;overflow:auto;';
      document.body.append(notice);
    }
    notice.replaceChildren();
    const text = document.createElement('div');
    text.textContent = [...warnings.values()].join('\n');
    const close = document.createElement('button');
    close.textContent = 'Dismiss';
    close.style.cssText = 'min-height:44px;margin-top:8px;';
    close.onclick = () => notice.remove();
    notice.append(text, close);
  } catch { /* A warning must never interrupt a profile save or combat callback. */ }
}

export function clearStorageWarning(code) {
  warnings.delete(code);
  try {
    const notice = globalThis.document?.getElementById('combat-storage-warning');
    if (!warnings.size) notice?.remove();
    else if (notice?.firstElementChild) notice.firstElementChild.textContent = [...warnings.values()].join('\n');
  } catch { /* Warning cleanup must not affect gameplay saves. */ }
}

export function storageMessages() { return [...warnings.values()]; }

export function openDiagnosticDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    let settled = false;
    const timeout = setTimeout(() => { settled = true; reject(new Error('Diagnostic database opening timed out')); }, 5000);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('sessions', { keyPath: 'id' });
      const chunks = db.createObjectStore('chunks', { keyPath: ['sessionId', 'index'] });
      chunks.createIndex('sessionId', 'sessionId');
      const encounters = db.createObjectStore('encounters', { keyPath: ['sessionId', 'id'] });
      encounters.createIndex('sessionId', 'sessionId');
      db.createObjectStore('legacy', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      clearTimeout(timeout);
      if (settled) { request.result.close(); return; }
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => { clearTimeout(timeout); reject(request.error); };
    request.onblocked = () => storageWarning('database-blocked', 'Combat archive upgrade is blocked by another tab. Close older game tabs. Recording may remain in memory.');
  });
  return databasePromise;
}

// Resolve only after commit, not after individual put requests have succeeded.
export async function diagnosticTransaction(names, mode, callback) {
  const db = await openDiagnosticDatabase();
  return new Promise((resolve, reject) => {
    let transaction;
    let timeout;
    try {
      transaction = db.transaction(names, mode);
      timeout = setTimeout(() => {
        try { transaction.abort(); } catch { reject(new Error('Diagnostic transaction timed out')); }
      }, 10000);
      transaction.oncomplete = () => { clearTimeout(timeout); resolve(); };
      transaction.onerror = () => { clearTimeout(timeout); reject(transaction.error ?? new Error('Diagnostic transaction failed')); };
      transaction.onabort = () => { clearTimeout(timeout); reject(transaction.error ?? new Error('Diagnostic transaction aborted')); };
      callback(transaction);
    } catch (error) {
      clearTimeout(timeout);
      try { transaction?.abort(); } catch { /* It may already have aborted. */ }
      reject(error);
    }
  });
}

export async function diagnosticRead(store, indexName = null, value = undefined) {
  let result;
  await diagnosticTransaction([store], 'readonly', transaction => {
    const source = indexName ? transaction.objectStore(store).index(indexName) : transaction.objectStore(store);
    const request = value === undefined ? source.getAll() : indexName ? source.getAll(value) : source.get(value);
    request.onsuccess = () => { result = request.result; };
  });
  return result;
}

export function initializeDiagnosticStorage() {
  if (initialization) return initialization;
  initialization = (async () => {
    try {
      await openDiagnosticDatabase();
      for (const key of LEGACY_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        // Archive exact bytes, including an unparseable recording, before freeing its old slot.
        // Never overwrite a different prior archive under the same legacy key.
        const prior = await diagnosticRead('legacy', null, key);
        if (prior && prior.raw !== raw) {
          storageWarning('legacy-conflict', 'An older combat archive already exists. Export and explicitly clean up legacy logs in Settings > Export log. The localStorage copy was preserved.');
          continue;
        }
        await diagnosticTransaction(['legacy'], 'readwrite', tx => tx.objectStore('legacy').put({ id: key, raw, archivedAt: new Date().toISOString() }));
        if (localStorage.getItem(key) === raw) localStorage.removeItem(key);
      }
      globalThis.dispatchEvent?.(new Event('delve-diagnostic-storage-ready'));
      return true;
    } catch {
      storageWarning('archive-unavailable', 'Combat archive storage is unavailable. New recording data stays in memory and may be lost on refresh. Existing localStorage logs are preserved; use Settings > Export log for backup and cleanup.');
      return false;
    }
  })();
  return initialization;
}

// A compact normal-history copy is safe for both profile snapshots and summary consumers.
// It deliberately excludes diagnostic payloads, casualty arrays and full threat tables.
export function compactCombatLog(record) {
  if (!record) return null;
  const entries = (record.entries ?? []).filter(entry => !entry.diagnostic).slice(-20).map(entry => ({
    time: entry.time, sequence: entry.sequence, wave: entry.wave, type: entry.type,
    message: String(entry.message ?? '').slice(0, 200), actor: entry.actor, actorId: entry.actorId,
    target: entry.target, targetId: entry.targetId, ability: entry.ability, amount: entry.amount,
    actionId: entry.actionId, sourceActionId: entry.sourceActionId
  }));
  const result = { schemaVersion: record.schemaVersion, delve: record.delve, startedAt: record.startedAt,
    finishedAt: record.finishedAt, simulationStartedAt: record.simulationStartedAt,
    party: (record.party ?? []).slice(0, 5).map(unit => ({ name: String(unit.name ?? '').slice(0, 80),
      className: String(unit.className ?? '').slice(0, 80), role: String(unit.role ?? '').slice(0, 40) })),
    result: record.result, summary: record.summary, eventSequence: record.eventSequence,
    entries, persistence: { kind: 'compact_normal_history', omittedEvents: Math.max(0, (record.eventSequence ?? record.entries?.length ?? 0) - entries.length),
      diagnostics: 'Stored separately in combat recording archives when recording is enabled' } };
  // Leave a small fixed reserve even if a source field unexpectedly becomes large.
  if (JSON.stringify(result).length > 12000) {
    result.entries = [];
    result.party = (record.party ?? []).slice(0, 5).map(unit => ({ name: String(unit.name).slice(0, 80) }));
    result.persistence.omittedEvents = record.eventSequence ?? record.entries?.length ?? 0;
  }
  return result;
}

export function saveCompactCombatLog(record) {
  try {
    if (clearingLogs) return;
    // The in-memory summary is immediate; IndexedDB is independent from game save success.
    latestLog = compactCombatLog(record);
    if (lastWriteFailed) return;
    pendingLog = latestLog;
    if (latestTimer) return;
    latestTimer = setTimeout(() => {
      latestTimer = null;
      const value = pendingLog;
      latestWrite = (async () => {
        try {
          if (!await initializeDiagnosticStorage()) return;
          await diagnosticTransaction(['sessions'], 'readwrite', tx => tx.objectStore('sessions').put({ id: 'latest-log', log: value }));
        } catch {
          lastWriteFailed = true;
          storageWarning('latest-log-failed', 'The latest combat summary could not be archived. It remains available in memory; game saves use separate storage.');
        }
      })();
    }, 2000);
  } catch {
    lastWriteFailed = true;
    storageWarning('latest-log-failed', 'The latest combat summary could not be archived. Player saves and combat continue independently.');
  }
}
let latestLog = null;
let pendingLog;
let latestTimer;
let lastWriteFailed = false;
let latestWrite = Promise.resolve();
let clearingLogs = false;

// Only diagnostic stores/keys are cleared. Drain any old latest-summary write first so
// it cannot resurrect a log after the clear transaction commits.
export async function clearDiagnosticLogs(allowMemoryOnly = false) {
  clearingLogs = true;
  clearTimeout(latestTimer);
  latestTimer = null;
  try {
    await latestWrite;
    let durableCleared = true;
    try {
      await diagnosticTransaction(['sessions', 'chunks', 'encounters', 'legacy'], 'readwrite', tx => {
        for (const name of ['sessions', 'chunks', 'encounters', 'legacy']) tx.objectStore(name).clear();
      });
    } catch (error) {
      if (!allowMemoryOnly) throw error;
      durableCleared = false;
    }
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
    latestLog = null;
    pendingLog = null;
    lastWriteFailed = false;
    warnings.clear();
    globalThis.document?.getElementById('combat-storage-warning')?.remove();
    globalThis.dispatchEvent?.(new Event('delve-diagnostic-storage-ready'));
    return durableCleared;
  } finally {
    clearingLogs = false;
  }
}

export async function loadCompactCombatLog() {
  if (latestLog) return latestLog;
  try {
    await initializeDiagnosticStorage();
    const saved = await diagnosticRead('sessions', null, 'latest-log');
    if (saved?.log) return saved.log;
    const archived = await diagnosticRead('legacy', null, LEGACY_KEYS[1]);
    const raw = archived?.raw ?? localStorage.getItem(LEGACY_KEYS[1]);
    return raw ? compactCombatLog(JSON.parse(raw)) : null;
  } catch {
    try {
      const raw = localStorage.getItem(LEGACY_KEYS[1]);
      return raw ? compactCombatLog(JSON.parse(raw)) : null;
    } catch { return null; }
  }
}
