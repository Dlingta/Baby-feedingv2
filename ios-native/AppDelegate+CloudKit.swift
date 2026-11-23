import UIKit
import CloudKit
import Capacitor

/// 将以下三个回调放入 Xcode 工程的 `AppDelegate.swift`（或 `SceneDelegate.swift`），
/// 即可实现：
/// 1. 家人点击微信 / iMessage / AirDrop 的 iCloud 邀请链接，自动唤起 App 并一键加入家庭星球
/// 2. 任一方新增喂养或日记后，另一台 iPhone 收到静默推送并自动拉取合并
extension AppDelegate {
    // 1) 在 application(_:didFinishLaunchingWithOptions:) 中调用：
    //    application.registerForRemoteNotifications()

    // 2) 家人点击 iCloud 共享链接一键加入（UIKit AppDelegate 生命周期）
    func application(
        _ application: UIApplication,
        userDidAcceptCloudKitShareWith cloudKitShareMetadata: CKShare.Metadata
    ) {
        CloudKitFamilyPlugin.acceptShare(metadata: cloudKitShareMetadata) { error in
            if let error = error {
                print("[CloudKitFamily] Accept share failed:", error.localizedDescription)
            }
        }
    }

    // 3) 收到 CloudKit 静默推送通知，触发前端自动拉取并智能合并
    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        if CKNotification(fromRemoteNotificationDictionary: userInfo) != nil {
            NotificationCenter.default.post(name: .planetCloudKitDidUpdate, object: nil)
            completionHandler(.newData)
        } else {
            completionHandler(.noData)
        }
    }
}
