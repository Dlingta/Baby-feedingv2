# 「未知漫游者的登陆手帐」iOS 原生 App（Xcode + CloudKit + Vision + Speech）打包指南

本项目已完整配置 **Capacitor iOS 原生壳 + 3 个原生 Swift 插件**，在保留全部手绘星空界面、字体与 WHO 生长曲线的同时，直接接入苹果原生底层能力：

- **CloudKit + CKShare 家庭协作**（`ios-native/Plugins/CloudKitFamilyPlugin.swift`）：真正免登录、零服务器成本、原生 `UICloudSharingController` 邀请家人，支持微信 / iMessage / AirDrop 一键加入与静默同步。
- **Vision 端侧 OCR**（`ios-native/Plugins/VisionOcrPlugin.swift`）：苹果神经网络引擎本地离线识别纸质手写喂养本。
- **Speech 端侧语音识别**（`ios-native/Plugins/SpeechDictationPlugin.swift`）：中文离线口述日记与喂养备注。

---

## 在 Mac 上构建并安装到 iPhone（5 步）

### 1. 安装依赖并生成 iOS 原生工程
```bash
npm install
npm run build
npx cap add ios
npx cap sync ios
```

### 2. 放入原生 Swift 插件与 AppDelegate 回调
将仓库中的以下文件拖入 Xcode 的 `App / App` 目录（勾选 *Copy items if needed* & *Add to targets: App*）：
- `ios-native/Plugins/CloudKitFamilyPlugin.swift`
- `ios-native/Plugins/VisionOcrPlugin.swift`
- `ios-native/Plugins/SpeechDictationPlugin.swift`
- `ios-native/AppDelegate+CloudKit.swift`

并在 `AppDelegate.swift` 的 `didFinishLaunchingWithOptions` 中补一行：
```swift
application.registerForRemoteNotifications()
```
在 `CAPBridgeViewController` 子类（或自定义 `MyViewController.swift`）中注册三个自定义插件：
```swift
override open func capacitorDidLoad() {
    bridge?.registerPluginInstance(CloudKitFamilyPlugin())
    bridge?.registerPluginInstance(VisionOcrPlugin())
    bridge?.registerPluginInstance(SpeechDictationPlugin())
}
```

### 3. 在 Xcode 开启 iCloud（CloudKit）与推送权限
1. 打开工程：`npx cap open ios`
2. 选中 Target **App → Signing & Capabilities**，选择你的 Apple Developer Team。
3. 点击 **+ Capability**，添加：
   - **iCloud**：勾选 **CloudKit**，勾选或新建容器 `iCloud.com.planetdiary.babyfeeding`
   - **Background Modes**：勾选 **Remote notifications**
   - **Push Notifications**

### 4. 在 `Info.plist` 添加系统权限说明与 CloudKit 分享声明
```xml
<key>CKSharingSupported</key>
<true/>
<key>NSCameraUsageDescription</key>
<string>用于拍摄宝宝成长照片及识别纸质喂养记录本</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>用于从相册导入宝宝照片与纸质喂养记录</string>
<key>NSMicrophoneUsageDescription</key>
<string>用于语音口述成长日记与喂养备注</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>用于将您的中文语音在本地离线转换为日记文字</string>
```

### 5. 真机运行或通过 TestFlight 发给家人
- 连接 iPhone 点击 **Run (⌘R)** 即可真机运行。
- 点击 **Product → Archive → Distribute App → TestFlight & App Store**，上传后在 App Store Connect 的 TestFlight 中添加爸爸/家人 Apple ID，即可实现两台 iPhone 真正的免登录 iCloud 共同喂养同步。
