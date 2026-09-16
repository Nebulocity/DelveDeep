const STORAGE_KEY = 'delveDeep.lastCombatLog.v1';

export default class CombatLog {
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

  add(type, message, details = {}) {
    const entry = {
      time: Number(((Date.now() - this.startedAt) / 1000).toFixed(2)),
      wave: details.wave,
      type,
      message,
      ...details
    };
    this.entries.push(entry);
    console.info(`[Combat ${entry.time.toFixed(2)}s] ${message}`, details);

    if (this.entries.length % 10 === 0) this.persist();
    return entry;
  }

  finish(result) {
    this.record.result = result;
    this.record.finishedAt = new Date().toISOString();
    this.add('encounter', `Encounter ended: ${result}`);
    this.persist();
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.record));
    } catch (error) {
      console.warn('Could not save the combat log.', error);
    }
    this.publish();
  }

  publish() {
    // These helpers make the latest encounter easy to inspect from desktop or Android remote devtools.
    globalThis.delveCombatLog = this.record;
    globalThis.getDelveCombatLog = () => JSON.stringify(this.record, null, 2);
  }
}

export function loadLastCombatLog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch (error) {
    console.warn('Could not load the last combat log.', error);
    return null;
  }
}
