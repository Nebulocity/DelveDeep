const STORAGE_KEY = 'delveDeep.lastCombatLog.v1';

export default class CombatLog {

  // This function starts a reviewable record of this encounter and its party.
  constructor(delveName, party) {

    this.startedAt = Date.now();
    this.entries = [];
    this.record = {
      delve: delveName,
      startedAt: new Date(this.startedAt).toISOString(),
      party: party.map((unit) => ({ name: unit.name, className: unit.className, role: unit.role })),
      result: 'in progress',
      entries: this.entries
    };

    this.publish();
    this.add('encounter', `Encounter started: ${delveName}`);
    this.persist();
  }

  // This function records a combat event to help review how the encounter
  // unfolded.
  add(type, message, details = {}) {

    // Timestamp the event relative to the encounter start and include any
    // structured combat details.
    const entry = {
      time: Number(((Date.now() - this.startedAt) / 1000).toFixed(2)),
      wave: details.wave,
      type,
      message,
      ...details
    };
    this.entries.push(entry);
    console.info(`[Combat ${entry.time.toFixed(2)}s] ${message}`, details);

    // Save periodically to retain recent events without writing storage on
    // every log entry.
    if (this.entries.length % 10 === 0) this.persist();
    return entry;
  }

  // This function closes the combat record with the encounter outcome.
  finish(result) {

    this.record.result = result;
    this.record.finishedAt = new Date().toISOString();
    this.add('encounter', `Encounter ended: ${result}`);
    this.persist();
  }

  // This function saves the latest combat record for later inspection.
  persist() {

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.record));
    } catch (error) {
      console.warn('Could not save the combat log.', error);
    }
    this.publish();
  }

  // This function exposes the current combat record for debugging on either
  // platform.
  publish() {

    globalThis.delveCombatLog = this.record;

    // Provide a readable export for inspecting the encounter in devtools.
    globalThis.getDelveCombatLog = () => JSON.stringify(this.record, null, 2);
  }
}

// This function recovers the previous combat record when reviewing a run.
export function loadLastCombatLog() {

  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch (error) {
    console.warn('Could not load the last combat log.', error);
    return null;
  }
}
