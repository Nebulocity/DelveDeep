import { Capacitor, registerPlugin } from '@capacitor/core';

const combatLogFiles = registerPlugin('CombatLogFiles');

export async function deliverCombatLog(text, filename) {
  if (Capacitor.getPlatform() === 'android') {
    if (!Capacitor.isPluginAvailable('CombatLogFiles')) {
      throw new Error('Install an APK containing the native combat log exporter. Your recording is still kept in the app.');
    }
    const result = await combatLogFiles.exportFile({ text, filename });
    return result.cancelled !== true;
  }

  // Retain copyable text on other native platforms until they have a file exporter.
  if (Capacitor.isNativePlatform()) {
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'width:85vw;height:75vh;background:#292524;color:#fff1d2;padding:20px;';
    const title = document.createElement('p'); title.textContent = 'Combat recording (select and copy to share)';
    const contents = document.createElement('textarea'); contents.readOnly = true; contents.value = text;
    contents.setAttribute('aria-label', 'Combat recording'); contents.style.cssText = 'width:100%;height:70%;font-size:16px;';
    const close = document.createElement('button'); close.textContent = 'Close'; close.style.cssText = 'min-height:44px;';
    close.onclick = () => dialog.close(); dialog.onclose = () => dialog.remove();
    dialog.append(title, contents, close); document.body.append(dialog); dialog.showModal();
    return true;
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}
