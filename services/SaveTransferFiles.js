// Android uses the system document picker, so backups can live outside app storage and
// survive uninstalling. Browser backups use normal downloads and file selection.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { MAX_TRANSFER_BYTES } from '../game/SaveTransfer.js';
const documents = registerPlugin('PrivateSaveFiles');

export async function saveBackupFile(text, filename) {
  if (Capacitor.getPlatform() === 'android') {
    const result = await documents.saveFile({ text, filename });
    return !result.cancelled;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  // Leave enough time for the browser to start copying the Blob, then release its bytes.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

export async function openBackupFile() {
  if (Capacitor.getPlatform() === 'android') {
    const result = await documents.openFile();
    return result.cancelled ? null : result.text;
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ddsave';
    input.style.display = 'none';
    const finish = value => { input.remove(); resolve(value); };
    input.addEventListener('cancel', () => finish(null), { once: true });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      try {
        if (file.size > MAX_TRANSFER_BYTES) throw new Error('Backup file is too large.');
        finish(await file.text());
      } catch (error) { input.remove(); reject(error); }
    }, { once: true });
    document.body.append(input);
    input.click();
  });
}
