import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

        // Accept the launch. SceneDelegate creates the window and Capacitor web view.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {

        // iOS calls this for interruptions or leaving the app. This native hook is empty;
        // browser visibility and the JavaScript background service handle current game timing.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {

        // iOS may suspend the web view after this. No extra native task starts here.
        // The game's saved timestamps let JavaScript account for missed time on return.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {

        // The app is returning. There is no separate native game model to rebuild here.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {

        // The host is active again. Phaser and its JavaScript services own visible updates.
    }

    func applicationWillTerminate(_ application: UIApplication) {

        // This callback is not guaranteed before a suspended app is killed.
        // Gameplay therefore relies on its regular JavaScript saves, not this empty hook.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {

        // Bind new window sessions to our SceneDelegate so they get the Capacitor host above.
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
