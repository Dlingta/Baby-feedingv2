import Foundation
import AVFoundation
import Speech
import Capacitor

/// 苹果原生 Speech 框架离线语音转文字插件
/// 适用于日记随手口述与喂养备注语音输入，优先使用 iPhone 端侧离线模型
@objc(SpeechDictationPlugin)
public class SpeechDictationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechDictationPlugin"
    public let jsName = "SpeechDictation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))
    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    @objc func start(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { [weak self] authStatus in
            guard let self = self else { return }
            guard authStatus == .authorized else {
                call.reject("请在 iPhone 设置中开启语音识别权限")
                return
            }

            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                guard granted else {
                    call.reject("请在 iPhone 设置中开启麦克风权限")
                    return
                }
                DispatchQueue.main.async {
                    do {
                        try self.beginSession()
                        call.resolve(["listening": true])
                    } catch {
                        call.reject("启动语音识别失败：\(error.localizedDescription)")
                    }
                }
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.teardownSession()
            call.resolve(["listening": false])
        }
    }

    private func beginSession() throws {
        teardownSession()

        guard let recognizer = speechRecognizer, recognizer.isAvailable else {
            throw NSError(domain: "SpeechDictation", code: -1, userInfo: [
                NSLocalizedDescriptionKey: "当前设备语音识别暂不可用"
            ])
        }

        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if #available(iOS 13.0, *), recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
        self.recognitionRequest = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }
            if let result = result {
                self.notifyListeners("speechResult", data: [
                    "text": result.bestTranscription.formattedString,
                    "isFinal": result.isFinal
                ])
                if result.isFinal {
                    self.teardownSession()
                }
            }
            if error != nil {
                self.teardownSession()
            }
        }
    }

    private func teardownSession() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask?.cancel()
        recognitionTask = nil
    }
}
