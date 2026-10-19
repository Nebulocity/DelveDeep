// This private utility uses real password/file controls for the mobile keyboard and
// accessibility. Shared charcoal and gold styling keeps its scrolling controls readable.
import GameState from '../game/GameState.js';
import { LEADER_STORAGE_KEY } from '../game/BuildSave.js';
import { flushProfileSave } from '../game/GameStorage.js';
import { encryptSnapshot, decryptSnapshot, readSnapshot, validateSnapshot,
  replaceSnapshot, RECOVERY_KEY } from '../game/SaveTransfer.js';
import { openBackupFile, saveBackupFile } from '../services/SaveTransferFiles.js';
import './SaveTransferDialog.css';
import { playUiSound, runUiAction } from '../services/UiAudioService.js';

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
  playUiSound(scene, 'dialogOpen');
  scene.selectionDetailsClose?.();
  scene.mapLocationClose?.();
  const previousFocus = document.activeElement;
  const root = document.createElement('div');
  root.className = 'save-transfer-overlay';
  root.innerHTML = `<section class="map-dialog save-transfer-panel" role="dialog" aria-modal="true" aria-labelledby="save-transfer-title">
    <header><h2 id="save-transfer-title">Save Transfer</h2><button type="button" data-action="close" aria-label="Close save transfer">Close</button></header>
    <div data-field="entry">
      <div data-field="choices">
        <p>Move progress between your devices using an encrypted backup file.</p>
        <div class="save-transfer-actions"><button type="button" data-action="start-export">Export this device's progress</button><button type="button" data-action="import">Restore from a backup file</button></div>
        <div class="save-transfer-undo">
          <p>Undo a restore: return to the progress this device had before its last restore.</p>
          <button type="button" data-action="recovery">Undo last restore on this device</button>
          <p data-field="no-recovery" hidden>No restore to undo on this device. To load a transferred file, choose “Restore from a backup file” above.</p>
        </div>
      </div>
      <div data-field="form" hidden>
        <p data-field="instructions"></p>
        <label><span data-field="password-label"></span><input type="password" autocomplete="off" spellcheck="false" data-field="password" maxlength="1024"></label>
        <label data-field="repeat-label" hidden>Repeat your new passphrase<input type="password" autocomplete="off" spellcheck="false" data-field="repeat" maxlength="1024"></label>
        <div class="save-transfer-actions"><button type="button" data-action="export" hidden>Save backup file</button><button type="button" data-action="review" hidden>Open backup and review progress</button><button type="button" data-action="back">Back to transfer options</button></div>
      </div>
    </div>
    <p class="save-transfer-status" role="status" aria-live="polite"></p>
    <div class="save-transfer-preview" hidden></div>
  </section>`;
  document.body.append(root);
  const panel = root.querySelector('section');
  const password = root.querySelector('[data-field="password"]');
  const repeat = root.querySelector('[data-field="repeat"]');
  const status = root.querySelector('.save-transfer-status');
  const preview = root.querySelector('.save-transfer-preview');
  const entry = root.querySelector('[data-field="entry"]');
  const choices = root.querySelector('[data-field="choices"]');
  const form = root.querySelector('[data-field="form"]');
  const recoveryButton = root.querySelector('[data-action="recovery"]');
  const hasRecovery = Boolean(localStorage.getItem(RECOVERY_KEY));
  recoveryButton.hidden = !hasRecovery;
  root.querySelector('[data-field="no-recovery"]').hidden = hasRecovery;
  let busy = false, closed = false, pending = null, recovery = null, selectedBackup = null;

  // Pausing the map prevents road movement and timed rewards while a player reviews
  // the replacement. Resume on dismissal; stopping for restore triggers normal cleanup.
  scene.scene.pause();
  function close(silent = false) {
    if (busy || closed) return;
    closed = true;
    if (!silent) playUiSound(scene, 'dialogClose');
    password.value = '';
    repeat.value = '';
    selectedBackup = null;
    pending = null;
    recovery = null;
    root.remove();
    document.removeEventListener('keydown', keydown);
    scene.events.off('shutdown', shutdown);
    if (scene.scene.isPaused()) scene.scene.resume();
    previousFocus?.focus?.();
  }
  function shutdown() { busy = false; close(true); }
  scene.events.once('shutdown', shutdown);
  function keydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const controls = [...root.querySelectorAll('button:not(:disabled), input:not(:disabled)')]
        .filter(control => control.getClientRects().length > 0);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
    }
  }
  document.addEventListener('keydown', keydown);
  root.querySelector('[data-action="close"]').onclick = () => close();

  // Every async operation disables the panel to prevent overlapping native pickers or
  // duplicate imports. Errors leave existing progress untouched and remain readable.
  async function run(action) {
    if (busy || closed) return;
    busy = true;
    root.querySelectorAll('button, input').forEach(control => { control.disabled = true; });
    status.textContent = 'Working…';
    try {
      await runUiAction(scene, async report => {
        try { await action(report); }
        catch (error) {
          report('failure');
          if (!closed) status.textContent = error.message || 'Backup operation failed.';
        }
      });
    }
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
    entry.hidden = false;
  }

  function showForm(exporting, undo = false) {
    clearPreview();
    choices.hidden = true;
    form.hidden = false;
    password.value = '';
    repeat.value = '';
    root.querySelector('[data-field="repeat-label"]').hidden = !exporting;
    root.querySelector('[data-action="export"]').hidden = !exporting;
    root.querySelector('[data-action="review"]').hidden = exporting;
    root.querySelector('[data-field="password-label"]').textContent = exporting
      ? 'Create a backup passphrase (at least 12 characters)'
      : 'Enter the passphrase used to create this backup';
    root.querySelector('[data-field="instructions"]').textContent = exporting
      ? 'Save a backup file, then send it to your other device. Keep its passphrase safe; forgotten passphrases cannot be recovered.'
      : undo
        ? 'Undo last restore: enter the passphrase used for the recovery backup created during that restore. You will review the old progress before replacing anything.'
        : 'Step 1 complete: backup file selected. Step 2: enter its passphrase once, then open it to review the progress. Nothing is replaced yet.';
    status.textContent = '';
  }

  root.querySelector('[data-action="start-export"]').onclick = () => {
    playUiSound(scene, 'click');
    selectedBackup = null;
    showForm(true);
    password.focus();
  };
  root.querySelector('[data-action="back"]').onclick = () => {
    playUiSound(scene, 'dialogClose');
    clearPreview();
    selectedBackup = null;
    password.value = '';
    repeat.value = '';
    form.hidden = true;
    choices.hidden = false;
    status.textContent = '';
    root.querySelector('[data-action="import"]').focus();
  };

  // Decryption only starts after file selection and passphrase entry are complete.
  password.addEventListener('input', clearPreview);

  root.querySelector('[data-action="export"]').onclick = () => run(async report => {
    clearPreview();
    if (password.value !== repeat.value) throw new Error('The two passphrases do not match.');
    const text = await encryptSnapshot(capture(), password.value);
    const saved = await saveBackupFile(text, filename('backup'));
    status.textContent = saved ? 'Backup saved or download started. Keep it outside the app before uninstalling.' : 'Export cancelled. Your progress is unchanged.';
    if (saved) report('success');
  });

  async function prepareImport(text) {
    clearPreview();
    if (text === null) { status.textContent = 'Restore cancelled. Your progress is unchanged.'; return; }
    pending = await decryptSnapshot(text, password.value);
    const summary = validateSnapshot(pending);
    preview.hidden = false;
    entry.hidden = true;
    const description = document.createElement('p');
    description.textContent = `Backup from ${new Date(summary.savedAt).toLocaleString()}: Renown ${summary.leaderLevel}, ${summary.gold} Gold, ${summary.heroes} adventurers, ${summary.clearedDelves} cleared Delves${summary.activeBattle ? ', with a saved battle' : ''}. This replaces progress on this device.`;
    const saveRecovery = document.createElement('button');
    saveRecovery.type = 'button';
    saveRecovery.textContent = 'Save this device’s current progress and continue';
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
    back.onclick = () => { playUiSound(scene, 'dialogClose'); clearPreview(); status.textContent = ''; };
    preview.append(description, saveRecovery, back);
    status.textContent = 'Step 3: review this backup. Save a recovery copy of this device’s current progress so you can undo the restore. The recovery copy uses the passphrase you just entered.';
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
    back.onclick = () => { playUiSound(scene, 'dialogClose'); clearPreview(); status.textContent = 'Restore cancelled. Your progress is unchanged.'; };
    preview.replaceChildren(preview.firstElementChild, label, confirm, back);
    status.textContent = 'Final step: make sure the recovery file finished saving, then confirm below to restore the reviewed backup.';
  }

  root.querySelector('[data-action="import"]').onclick = () => run(async () => {
    const text = await openBackupFile();
    if (text === null) { status.textContent = 'No file selected. Your progress is unchanged.'; return; }
    selectedBackup = text;
    showForm(false);
  });
  root.querySelector('[data-action="review"]').onclick = () => run(async () => {
    if (selectedBackup === null) throw new Error('Choose a backup file first.');
    await prepareImport(selectedBackup);
  });
  root.querySelector('[data-action="recovery"]').onclick = () => run(async () => {
    const text = localStorage.getItem(RECOVERY_KEY);
    if (!text) throw new Error('There is no restore to undo on this device. Choose “Restore from a backup file” to load a transferred file.');
    selectedBackup = text;
    showForm(false, true);
  });
  panel.querySelector('button').focus();
}
