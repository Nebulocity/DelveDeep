import { recordCombatEntry, persistCombatRecording, recordingSequenceFloor } from './CombatRecording.js';
import { saveCompactCombatLog, loadCompactCombatLog } from './DiagnosticStorage.js';

// We keep a readable history plus totals for the encounter. Entries describe what actually
// happened, rather than guessing damage from an animation. Recent entries are bounded for
// save size, while summary totals and casualty evidence must survive a long farming
// session.

import CombatDiagnostics from './CombatDiagnostics.js';


export default class CombatLog {

  attachDiagnostics(scene) {
    this.diagnostics = new CombatDiagnostics(this, scene);
    scene.events.once('shutdown', () => {
      if (!this.record.finishedAt) {
        this.diagnostics.close('scene_shutdown');
        this.persist();
      }
      this.diagnostics.dispose();
    });
  }

  // Use the combat simulation's clock for event timestamps during catch-up.
  setSimulationClock(now) {
    this.simulationNow = now;

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone. ?? uses the fallback only for null or undefined. A real zero or false
    // stays intact. ?. only follows this link when the value exists; a missing optional
    // value gives undefined.
    this.record.simulationStartedAt ??= now() - (this.entries.at(-1)?.time ?? 0) * 1000;
  }

  // This helper starts a reviewable record of this encounter and its party.
  constructor(delveName, party) {

    this.startedAt = Date.now();
    this.entries = [];
    this.entryCount = 0;

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    this.record = {
      schemaVersion: 2,
      eventSequence: 0,
      droppedEntries: 0,
      delve: delveName,
      startedAt: new Date(this.startedAt).toISOString(),
      party: party.map((unit) => ({ name: unit.name, className: unit.className, role: unit.role })),
      summary: { partyDamageTaken: 0, partyHealing: 0, partyDeaths: 0, enemyDamageTaken: 0 },
      result: 'in progress',
      entries: this.entries
    };

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries.
    this.partyNames = new Set(party.map((unit) => unit.name));

    this.publish();
    this.add('encounter', `Encounter started: ${delveName}`);
    this.persist();
  }

  // This helper records a combat event to help review how the encounter unfolded.
  add(type, message, details = {}) {

    // Timestamp the event relative to the encounter start and include any structured
    // combat details.
    const entry = {
      time: Number(((this.simulationNow ? this.simulationNow() - this.record.simulationStartedAt
        : Date.now() - this.startedAt) / 1000).toFixed(2)),
      wave: details.wave,
      type,
      message,
      ...details,
      sequence: this.record.eventSequence = Math.max(this.record.eventSequence ?? 0, recordingSequenceFloor(this.record.startedAt)) + 1
    };

    this.entries.push(entry);
    this.entryCount += 1;
    if (this.entries.length > 2000) {
      this.entries.shift();
      this.record.droppedEntries = (this.record.droppedEntries ?? 0) + 1;
      this.record.truncation = { reason: 'recent_history_limit', limit: 2000,
        droppedEvents: this.record.droppedEntries, firstRetainedSequence: this.entries[0].sequence };
    }
    this.diagnostics?.observe(entry);

    if (type === 'damage') {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const summaryKey = details.targetSide === 'enemy' ? 'enemyDamageTaken' : 'partyDamageTaken';

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      this.record.summary[summaryKey] += Number(details.amount ?? 0);
    }

    if (type === 'healing' && details.targetSide !== 'enemy') this.record.summary.partyHealing += Number(details.amount ?? 0);
    if (type === 'death' && (details.targetSide === 'party' || (!details.targetSide && this.partyNames.has(details.target)))) {
      this.record.summary.partyDeaths += 1;

      // ??= fills a missing value once. It leaves an existing value, including zero or
      // false, alone.
      this.record.casualties ??= [];

      // ... copies the source's own fields into this object; fields listed later replace
      // earlier ones. This is a shallow copy, so nested objects are still shared.
      this.record.casualties.push({ ...entry });
    }

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    recordCombatEntry(this, entry);
    this.onEntry?.(entry);
    if (!entry.diagnostic && !this.backgroundProgress?.isReplaying) console.info(`[Combat ${entry.time.toFixed(2)}s] ${message}`, details);

    // Save periodically to retain recent events without writing storage on every log
    // entry.
    if (this.entryCount % 10 === 0 && !this.backgroundProgress?.isReplaying
      && (!this.diagnostics?.enabled || !this.simulationNow || this.simulationNow() - (this.lastDiagnosticPersistAt ?? -Infinity) >= 1000)) this.persist();
    return entry;
  }

  // This helper closes the combat record with the encounter outcome.
  finish(result) {

    this.diagnostics?.close(result);
    this.record.result = result;
    this.record.finishedAt = new Date().toISOString();
    this.add('encounter', `Encounter ended: ${result}`);
    this.persist();
  }

  // This helper saves the latest combat record for later inspection.
  persist() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (this.backgroundProgress?.isReplaying) return;
    this.lastDiagnosticPersistAt = this.simulationNow?.();
    persistCombatRecording();

    saveCompactCombatLog(this.record);

    this.publish();
  }

  // This helper exposes the current combat record for debugging on either platform.
  publish() {

    globalThis.delveCombatLog = this.record;

    // Provide a readable export for inspecting the encounter in devtools.
    globalThis.getDelveCombatLog = () => JSON.stringify(this.record, null, 2);
    globalThis.downloadDelveCombatLog = () => {
      const blob = new Blob([JSON.stringify(this.record, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `delve-combat-${this.startedAt}.json`;
      link.click();
      URL.revokeObjectURL(url);
    };
  }
}

// This helper recovers the previous combat record when reviewing a run.
export function loadLastCombatLog() {
  return loadCompactCombatLog();
}
