import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

let notificationSerial = Math.floor(Date.now() % 2000000000);

export async function prepareDeathNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    let permission = await LocalNotifications.checkPermissions();
    if (permission.display === 'prompt') permission = await LocalNotifications.requestPermissions();
    if (permission.display === 'granted') await LocalNotifications.createChannel({
      id: 'party-deaths', name: 'Adventurer deaths', importance: 4, vibration: true
    });
  } catch (error) {
    console.warn('Could not enable death notifications.', error);
  }
}

export async function notifyIdleDeath(death, delveName) {
  try {
    const body = `${death.name} died in ${delveName}.`;
    if (Capacitor.isNativePlatform()) {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') return;
      await LocalNotifications.createChannel({
        id: 'party-deaths', name: 'Adventurer deaths', importance: 4, vibration: true
      });
      await LocalNotifications.schedule({ notifications: [{
        id: notificationSerial++ % 2147483647, title: 'Party member down', body,
        channelId: 'party-deaths'
      }] });
    } else if (globalThis.Notification?.permission === 'granted') {
      new Notification('Party member down', { body, tag: `delve-death-${death.id}` });
    }
  } catch (error) {
    console.warn('Could not send death notification.', error);
  }
}
