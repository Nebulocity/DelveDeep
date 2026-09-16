export default class OrientationService {

  // This function requests landscape orientation when the browser supports
  // locking it.
  static async lockLandscape() {

    try {
      if (screen?.orientation?.lock) {
        await screen.orientation.lock('landscape');
        return true;
      }
    } catch (error) {
      console.info(
        'Browser orientation lock was unavailable. Native Android orientation should still keep Delve Deep in landscape.',
        error
      );
    }

    return false;
  }
}
