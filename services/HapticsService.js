import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

class HapticsService {

  // This function gives ordinary presses a light tactile response.
  static async tap() {

    try {
      await Haptics.impact({
        style: ImpactStyle.Light
      });
    } catch {

      // Let play continue on devices without haptic support.
    }
  }

  // This function gives committed choices a stronger tactile response.
  static async confirm() {

    try {
      await Haptics.impact({
        style: ImpactStyle.Medium
      });
    } catch {

      // Let play continue on devices without haptic support.
    }
  }

  // This function emphasizes major combat events with a heavy tactile
  // response.
  static async heavy() {

    try {
      await Haptics.impact({
        style: ImpactStyle.Heavy
      });
    } catch {

      // Let play continue on devices without haptic support.
    }
  }

  // This function celebrates success with the device notification feedback.
  static async success() {

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
