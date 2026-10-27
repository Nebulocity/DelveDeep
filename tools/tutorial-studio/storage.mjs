import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// Rename replaces the target only after a complete, flushed temporary write and
// backup. A failed backup/rename leaves the last good target intact.
export async function atomicWrite(target, text) {
  let previous;
  try { previous = await fs.readFile(target, 'utf8'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; previous = null; }
  const temp = target + '.' + randomUUID() + '.tmp';
  const backup = target + '.backup-' + randomUUID();
  try {
    const file = await fs.open(temp, 'wx');
    try { await file.writeFile(text, 'utf8'); await file.sync(); } finally { await file.close(); }
    if (previous !== null) {
      await fs.writeFile(backup, previous, { flag: 'wx' });
      await fs.rename(backup, target + '.bak');
    }
    await fs.rename(temp, target);
  } finally { await fs.rm(temp, { force: true }); await fs.rm(backup, { force: true }); }
}
