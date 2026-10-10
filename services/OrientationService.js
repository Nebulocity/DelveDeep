// We ask the host to keep the game in landscape. Browser and native support can differ, so
// this request is optional and errors must not stop the game from opening.

export default class OrientationService {

  // This helper requests landscape orientation when the browser supports locking it.
  static async lockLandscape() {

    try {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
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
