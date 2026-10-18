// This private utility uses real password/file controls for the mobile keyboard and
// accessibility. Shared charcoal and gold styling keeps its scrolling controls readable.
import GameState from '../game/GameState.js';
import { LEADER_STORAGE_KEY } from '../game/BuildSave.js';
import { flushProfileSave } from '../game/GameStorage.js';
import { encryptSnapshot, decryptSnapshot, readSnapshot, validateSnapshot,
  replaceSnapshot, RECOVERY_KEY } from '../game/SaveTransfer.js';
import { openBackupFile, saveBackupFile } from '../services/SaveTransferFiles.js';
import './SaveTransferDialog.css';

// Temporarily offer encrypted testing backups in every build, including the APK.
export const privateTransfersEnabled = true;

function capture() {
  if (!flushProfileSave()) throw new Error('Could not save current progress. Make space on this device and try again.');
  localStorage.setItem(LEADER_STORAGE_KEY, JSON.stringify(GameState.leader));
  return readSnapshot();
}

const filename = label => `DelveDeep-${label}-${new Date().toISOString().replace(/[:.]/g, '-')}.ddsave`;

export function showSaveTransferDialog(scene) {
  if (!privateTransfersEnabled || document.querySelector('.save-transfer-overlay')) return;
  scene.selectionDetailsClose?.();
  scene.mapLocationClose?.();
  const previousFocus = document.activeElement;
  const root = document.createElement('div');
  root.className = 'save-transfer-overlay';
  root.innerHTML = `<section class="map-dialog save-transfer-panel" role="dialog" aria-modal="true" aria-labelledby="save-transfer-title">
    <header><h2 id="save-transfer-title">Save import and export</h2><button type="button" data-action="close" aria-label="Close save transfer">Close</button></header>
    <p>Encrypted backups for your own devices. Keep the backup passphrase safe; forgotten passphrases cannot be recovered.</p>
    <label>Backup passphrase (at least 12 characters)<input type="password" autocomplete="off" spellcheck="false" data-field="password" maxlength="1024"></label>
    <label data-field="repeat-label">Repeat passphrase for export<input type="password" autocomplete="off" data-field="repeat" maxlength="1024"></label>
    <div class="save-transfer-actions"><button type="button" data-action="export">Export backup</button><button type="button" data-action="import">Choose backup to restore</button><button type="button" data-action="recovery">Restore previous progress</button></div>
    <p class="save-transfer-status" role="status" aria-live="polite"></p>
    <div class="save-transfer-preview" hidden></div>
  </section>`;
  document.body.append(root);
  const panel = root.querySelector('section');
  const password = root.querySelector('[data-field="password"]');
  const repeat = root.querySelector('[data-field="repeat"]');
  const status = root.querySelector('.save-transfer-status');
  const preview = root.querySelector('.save-transfer-preview');
  let busy = false, closed = false, pending = null, recovery = null;

  // Pausing the map prevents road movement and timed rewards while a player reviews
  // the replacement. Resume on dismissal; stopping for restore triggers normal cleanup.
  scene.scene.pause();
  function close() {
    if (busy || closed) return;
    closed = true;
    password.value = '';
    repeat.value = '';
    root.remove();
    document.removeEventListener('keydown', keydown);
    scene.events.off('shutdown', shutdown);
    if (scene.scene.isPaused()) scene.scene.resume();
    previousFocus?.focus?.();
  }
  function shutdown() { busy = false; close(); }
  scene.events.once('shutdown', shutdown);
  function keydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const controls = [...root.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
    }
  }
  document.addEventListener('keydown', keydown);
  root.querySelector('[data-action="close"]').onclick = close;

  // Every async operation disables the panel to prevent overlapping native pickers or
  // duplicate imports. Errors leave existing progress untouched and remain readable.
  async function run(action) {
    if (busy || closed) return;
    busy = true;
    root.querySelectorAll('button, input').forEach(control => { control.disabled = true; });
    status.textContent = 'Working…';
    try { await action(); }
    catch (error) { if (!closed) status.textContent = error.message || 'Backup operation failed.'; }
    finally {
      busy = false;
      if (!closed) root.querySelectorAll('button, input').forEach(control => { control.disabled = false; });
    }
  }

  function clearPreview() {
    pending = null;
    recovery = null;
    preview.replaceChildren();
    preview.hidden = true;
    panel.querySelectorAll(':scope > p:first-of-type, :scope > label, .save-transfer-actions').forEach(element => { element.hidden = false; });
  }

  // Changing the passphrase invalidates any previously decrypted restore preview.
  password.addEventListener('input', clearPreview);

  root.querySelector('[data-action="export"]').onclick = () => run(async () => {
    clearPreview();
    if (password.value !== repeat.value) throw new Error('The two passphrases do not match.');
    const text = await encryptSnapshot(capture(), password.value);
    const saved = await saveBackupFile(text, filename('backup'));
    status.textContent = saved ? 'Backup saved or download started. Keep it outside the app before uninstalling.' : 'Export cancelled. Your progress is unchanged.';
  });

  async function prepareImport(text) {
    clearPreview();
    if (text === null) { status.textContent = 'Restore cancelled. Your progress is unchanged.'; return; }
    pending = await decryptSnapshot(text, password.value);
    const summary = validateSnapshot(pending);
    preview.hidden = false;
    panel.querySelectorAll(':scope > p:first-of-type, :scope > label, .save-transfer-actions').forEach(element => { element.hidden = true; });
    const description = document.createElement('p');
    description.textContent = `Backup from ${new Date(summary.savedAt).toLocaleString()}: Renown ${summary.leaderLevel}, ${summary.gold} Gold, ${summary.heroes} adventurers, ${summary.clearedDelves} cleared Delves${summary.activeBattle ? ', with a saved battle' : ''}. This replaces progress on this device.`;
    const saveRecovery = document.createElement('button');
    saveRecovery.type = 'button';
    saveRecovery.textContent = 'Save recovery backup before replacing';
    saveRecovery.onclick = () => run(async () => {
      recovery = await encryptSnapshot(capture(), password.value);
      if (!await saveBackupFile(recovery, filename('before-restore'))) {
        recovery = null;
        status.textContent = 'Recovery backup cancelled. No progress was replaced.';
        return;
      }
      showConfirmation();
    });
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = 'Back';
    back.onclick = () => { clearPreview(); status.textContent = ''; };
    preview.append(description, saveRecovery, back);
    status.textContent = 'Backup validated. Save a recovery copy of current progress to continue.';
  }

  // Confirmation is separate from file selection and decryption. In browsers, the
  // explicit checkbox also asks the player to verify the recovery download completed.
  function showConfirmation() {
    const label = document.createElement('label');
    label.className = 'save-transfer-check';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    label.append(checkbox, document.createTextNode('I saved the recovery backup and want to replace current progress.'));
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.textContent = 'Replace progress and reload';
    confirm.className = 'save-transfer-danger';
    confirm.onclick = () => run(async () => {
      if (!checkbox.checked) throw new Error('Confirm that you saved the recovery backup first.');
      const incoming = pending, previous = recovery;

      // Stop the map before replacing storage: its shutdown handler saves road state.
      // Otherwise an old scene could write over the freshly imported profile.
      const manager = scene.scene.manager;
      manager.stop(scene.sys.settings.key);
      try { replaceSnapshot(incoming, previous); }
      catch (error) { window.alert(error.message); }
      finally { manager.start('BootScene'); }
    });
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = 'Cancel restore';
    back.onclick = () => { clearPreview(); status.textContent = 'Restore cancelled. Your progress is unchanged.'; };
    preview.replaceChildren(preview.firstElementChild, label, confirm, back);
    status.textContent = 'Recovery backup saved or downloaded. Its passphrase is the one entered above. Confirm replacement when ready.';
  }

  root.querySelector('[data-action="import"]').onclick = () => run(async () => prepareImport(await openBackupFile()));
  root.querySelector('[data-action="recovery"]').onclick = () => run(async () => {
    const text = localStorage.getItem(RECOVERY_KEY);
    if (!text) throw new Error('No previous restore backup is stored on this device.');
    await prepareImport(text);
  });
  panel.querySelector('button').focus();
}
