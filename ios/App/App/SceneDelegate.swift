import UIKit
import Capacitor


// This is the iOS window host. The Phaser game itself runs inside Capacitor's web view.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {

        // Swift's guard exits early unless this session provides a window scene.
        guard let windowScene = scene as? UIWindowScene else { return }

        // Create the window, place Capacitor's bridge inside it, and show it.
        // The ? calls safely do nothing if the optional window value is missing.
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()


        // Forward the same lifecycle event so Capacitor can notify connected native plugins.
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {

        // Let Capacitor handle links handed to this app by iOS.
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {

        // Pass system continuation activity through the bridge instead of handling it as gameplay.
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
