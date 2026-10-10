// Native notifications tell the player about actual party deaths while away. Permission
// and platform support are checked separately from combat. Keep the notification request
// tied to recorded deaths so replaying a summary does not invent events.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Math.floor rounds toward the smaller whole number, so 3.8 becomes 3. % gives the
// remainder. With a nonnegative index and positive list length, it wraps the index back to
// the start of the list.
let notificationSerial = Math.floor(Date.now() % 2000000000);

// Check platform and permission before enabling native death notifications.
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

// Request a notification for a recorded background casualty, respecting permission and
// duplicate guards.
export async function notifyIdleDeath(death, delveName) {
  try {
    const body = `${death.name} died in ${delveName}.`;
    if (Capacitor.isNativePlatform()) {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') return;
      await LocalNotifications.createChannel({
        id: 'party-deaths', name: 'Adventurer deaths', importance: 4, vibration: true
      });

      // % gives the remainder. With a nonnegative index and positive list length, it wraps
      // the index back to the start of the list.
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
