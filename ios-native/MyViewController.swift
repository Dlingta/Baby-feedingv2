import UIKit
import Capacitor

/// 在 Xcode Storyboard（Main.storyboard）中将初始 ViewController 的 Custom Class 设为 `MyViewController`，
/// 即可在应用启动时自动注册 CloudKit 家庭共享、Vision 端侧 OCR 与 Speech 离线语音三个原生插件。
class MyViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CloudKitFamilyPlugin())
        bridge?.registerPluginInstance(VisionOcrPlugin())
        bridge?.registerPluginInstance(SpeechDictationPlugin())
    }
}
