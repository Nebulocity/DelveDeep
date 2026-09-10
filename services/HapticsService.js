import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

class HapticsService {
  static async tap() {
    try {
      await Haptics.impact({
        style: ImpactStyle.Light
      });
    } catch {
      // Ignore when haptics aren't available.
    }
  }

  static async confirm() {
    try {
      await Haptics.impact({
        style: ImpactStyle.Medium
      });
    } catch {
      // Ignore when haptics aren't available.
    }
  }

  static async heavy() {
    try {
      await Haptics.impact({
        style: ImpactStyle.Heavy
      });
    } catch {
      // Ignore when haptics aren't available.
    }
  }

  static async success() {
    try {
      await Haptics.notification({
        type: NotificationType.Success
      });
    } catch {
      // Ignore when haptics aren't available.
    }
  }
}

export default HapticsService;