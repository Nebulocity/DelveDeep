import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

class HapticsService {
  // I give ordinary presses a light tactile response.
  static async tap() {

    try {
      await Haptics.impact({
        style: ImpactStyle.Light
      });
    } catch {
      // I let play continue on devices without haptic support.
    }
  }

  // I give committed choices a stronger tactile response.
  static async confirm() {

    try {
      await Haptics.impact({
        style: ImpactStyle.Medium
      });
    } catch {
      // I let play continue on devices without haptic support.
    }
  }

  // I emphasize major combat events with a heavy tactile response.
  static async heavy() {

    try {
      await Haptics.impact({
        style: ImpactStyle.Heavy
      });
    } catch {
      // I let play continue on devices without haptic support.
    }
  }

  // I celebrate success with the device notification feedback.
  static async success() {

    try {
      await Haptics.notification({
        type: NotificationType.Success
      });
    } catch {
      // I let play continue on devices without haptic support.
    }
  }
}

export default HapticsService;
