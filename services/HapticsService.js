// This is our shared touch-feedback entry point. Capacitor supplies native vibration on
// supported devices. Browser previews may have no native haptics; a failed optional
// feedback call should not stop the player's actual action. Background work stays quiet.

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

class HapticsService {

  // This helper gives ordinary presses a light tactile response.
  static async tap() {
    if (this.background) return;

    try {
      await Haptics.impact({
        style: ImpactStyle.Light
      });
    } catch {

      // Let play continue on devices without haptic support.
    }
  }

  // This helper gives committed choices a stronger tactile response.
  static async confirm() {
    if (this.background) return;

    try {
      await Haptics.impact({
        style: ImpactStyle.Medium
      });
    } catch {

      // Let play continue on devices without haptic support.
    }
  }

  // This helper emphasizes major combat events with a heavy tactile response.
  static async heavy() {
    if (this.background) return;

    try {
      await Haptics.impact({
        style: ImpactStyle.Heavy
      });
    } catch {

      // Let play continue on devices without haptic support.
    }
  }

  // This helper celebrates success with the device notification feedback.
  static async success() {
    if (this.background) return;

    try {
      await Haptics.notification({
        type: NotificationType.Success
      });
    } catch {

      // Let play continue on devices without haptic support.
    }
  }
}

export default HapticsService;
