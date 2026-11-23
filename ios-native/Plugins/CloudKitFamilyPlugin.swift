import Foundation
import UIKit
import CloudKit
import Capacitor

/// 苹果原生 iCloud（CloudKit + CKShare）家庭共同喂养插件
///
/// 能力特性：
/// - 真正免登录：直接静默使用本机 Apple ID（CKContainer.default()），无需任何账号注册或验证码
/// - 一键邀请共同领航员：弹出 iOS 原生 UICloudSharingController，支持微信 / iMessage / AirDrop 分享专属邀请链接
/// - 零服务器成本：全部记录与照片存于家庭自己的 iCloud 私有与共享空间，离线照常记录、联网自动同步
@objc(CloudKitFamilyPlugin)
public class CloudKitFamilyPlugin: CAPPlugin, CAPBridgedPlugin, UICloudSharingControllerDelegate {
    public let identifier = "CloudKitFamilyPlugin"
    public let jsName = "CloudKitFamily"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getAccountStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "inviteCoPilot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getParticipants", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pushSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pullLatest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "registerSubscriptions", returnType: CAPPluginReturnPromise)
    ]

    private static let zoneName = "BabyPlanetZone"
    private static let recordType = "BabyPlanetBook"
    private static let rootRecordName = "primary-baby-planet"
    private static let sharedZoneDefaultsKey = "planet_ck_active_shared_zone"

    private let container = CKContainer.default()

    private var privateZoneID: CKRecordZone.ID {
        CKRecordZone.ID(zoneName: Self.zoneName, ownerName: CKCurrentUserDefaultName)
    }

    /// 供 AppDelegate / SceneDelegate 在家人点击微信/AirDrop 邀请链接时调用
    @objc public static func acceptShare(
        metadata: CKShare.Metadata,
        completion: ((Error?) -> Void)? = nil
    ) {
        let op = CKAcceptSharesOperation(shareMetadatas: [metadata])
        op.perShareResultBlock = { _, result in
            if case .success(let share) = result {
                let zoneID = share.recordID.zoneID
                let dict: [String: String] = [
                    "zoneName": zoneID.zoneName,
                    "ownerName": zoneID.ownerName
                ]
                UserDefaults.standard.set(dict, forKey: Self.sharedZoneDefaultsKey)
                NotificationCenter.default.post(name: .planetCloudKitDidUpdate, object: nil)
            }
        }
        op.acceptSharesResultBlock = { result in
            switch result {
            case .success:
                completion?(nil)
            case .failure(let error):
                completion?(error)
            }
        }
        CKContainer.default().add(op)
    }

    public override func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRemoteCloudKitChange),
            name: .planetCloudKitDidUpdate,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func handleRemoteCloudKitChange() {
        notifyListeners("cloudKitDidUpdate", data: [
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ])
    }

    // MARK: - 1. 静默检查本机 Apple ID 的 iCloud 状态（免登录）

    @objc func getAccountStatus(_ call: CAPPluginCall) {
        container.accountStatus { [weak self] status, error in
            if let error = error {
                call.reject("无法读取 iCloud 状态：\(error.localizedDescription)")
                return
            }

            let statusText: String
            let available: Bool
            switch status {
            case .available:
                statusText = "available"
                available = true
            case .noAccount:
                statusText = "noAccount"
                available = false
            case .restricted:
                statusText = "restricted"
                available = false
            case .temporarilyUnavailable:
                statusText = "temporarilyUnavailable"
                available = false
            default:
                statusText = "couldNotDetermine"
                available = false
            }

            let isJoinedShared = UserDefaults.standard.dictionary(forKey: Self.sharedZoneDefaultsKey) != nil

            guard available else {
                call.resolve([
                    "available": false,
                    "status": statusText,
                    "role": isJoinedShared ? "coPilot" : "owner",
                    "userRecordId": ""
                ])
                return
            }

            self?.container.fetchUserRecordID { recordID, _ in
                call.resolve([
                    "available": true,
                    "status": statusText,
                    "role": isJoinedShared ? "coPilot" : "owner",
                    "userRecordId": recordID?.recordName ?? ""
                ])
            }
        }
    }

    // MARK: - 2. 邀请共同领航员（呼出 iOS 原生 UICloudSharingController）

    @objc func inviteCoPilot(_ call: CAPPluginCall) {
        let planetTitle = call.getString("planetTitle") ?? "宝宝的地球登陆手帐"
        let snapshotJson = call.getString("stateJson") ?? ""

        ensurePrivateZoneAndRootRecord(snapshotJson: snapshotJson, planetTitle: planetTitle) { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .failure(let error):
                call.reject("准备 iCloud 共享空间失败：\(error.localizedDescription)")
            case .success(let rootRecord):
                self.fetchOrCreateShare(for: rootRecord, title: "《\(planetTitle)》") { shareResult in
                    switch shareResult {
                    case .failure(let error):
                        call.reject("创建 iCloud 共享链接失败：\(error.localizedDescription)")
                    case .success(let share):
                        DispatchQueue.main.async {
                            guard let vc = self.bridge?.viewController else {
                                call.reject("无法获取当前界面控制器")
                                return
                            }
                            let sharingVC = UICloudSharingController(share: share, container: self.container)
                            sharingVC.delegate = self
                            sharingVC.availablePermissions = [.allowPrivate, .allowReadWrite]
                            if let popover = sharingVC.popoverPresentationController {
                                popover.sourceView = vc.view
                                popover.sourceRect = CGRect(
                                    x: vc.view.bounds.midX,
                                    y: vc.view.bounds.midY,
                                    width: 1,
                                    height: 1
                                )
                            }
                            vc.present(sharingVC, animated: true) {
                                call.resolve([
                                    "presented": true,
                                    "shareUrl": share.url?.absoluteString ?? ""
                                ])
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - 3. 获取当前已共享的共同领航员列表

    @objc func getParticipants(_ call: CAPPluginCall) {
        resolveActiveDatabaseAndZone { [weak self] db, zoneID, isShared in
            guard let self = self else { return }
            let recordID = CKRecord.ID(recordName: Self.rootRecordName, zoneID: zoneID)
            db.fetch(withRecordID: recordID) { record, error in
                if let error = error as? CKError, error.code == .unknownItem {
                    call.resolve(["participants": [], "isShared": isShared])
                    return
                }
                guard let record = record, let shareRef = record.share else {
                    call.resolve(["participants": [], "isShared": isShared])
                    return
                }
                db.fetch(withRecordID: shareRef.recordID) { shareRecord, _ in
                    guard let share = shareRecord as? CKShare else {
                        call.resolve(["participants": [], "isShared": isShared])
                        return
                    }
                    let list: [[String: Any]] = share.participants.map { p in
                        let nameComp = p.userIdentity.nameComponents
                        let displayName = nameComp.flatMap { PersonNameComponentsFormatter().string(from: $0) }
                            ?? (p.role == .owner ? "星球创建者（本机）" : "受邀家庭成员")
                        let acceptance: String
                        switch p.acceptanceStatus {
                        case .accepted: acceptance = "accepted"
                        case .pending: acceptance = "pending"
                        case .removed: acceptance = "removed"
                        default: acceptance = "unknown"
                        }
                        return [
                            "id": p.userIdentity.userRecordID?.recordName ?? UUID().uuidString,
                            "name": displayName,
                            "role": p.role == .owner ? "owner" : "coPilot",
                            "status": acceptance
                        ]
                    }
                    call.resolve(["participants": list, "isShared": true])
                }
            }
        }
    }

    // MARK: - 4. 静默推送最新手帐数据到 iCloud（含照片，通过 CKAsset 避免单字段上限）

    @objc func pushSnapshot(_ call: CAPPluginCall) {
        guard let stateJson = call.getString("stateJson"), !stateJson.isEmpty else {
            call.reject("缺少待同步的手帐数据")
            return
        }
        let updatedAt = call.getString("updatedAt") ?? ISO8601DateFormatter().string(from: Date())
        let updatedBy = call.getString("updatedBy") ?? "家人"
        let planetTitle = call.getString("planetTitle") ?? "宝宝的地球登陆手帐"

        resolveActiveDatabaseAndZone { [weak self] db, zoneID, isShared in
            guard let self = self else { return }
            let performSave = {
                let recordID = CKRecord.ID(recordName: Self.rootRecordName, zoneID: zoneID)
                db.fetch(withRecordID: recordID) { existing, fetchErr in
                    let record: CKRecord
                    if let existing = existing {
                        record = existing
                    } else if let ckErr = fetchErr as? CKError, ckErr.code == .unknownItem {
                        record = CKRecord(recordType: Self.recordType, recordID: recordID)
                    } else if let fetchErr = fetchErr {
                        call.reject("读取云端记录失败：\(fetchErr.localizedDescription)")
                        return
                    } else {
                        record = CKRecord(recordType: Self.recordType, recordID: recordID)
                    }

                    guard let tempUrl = self.writeTempPayload(json: stateJson) else {
                        call.reject("生成临时同步文件失败")
                        return
                    }

                    record["planetTitle"] = planetTitle as CKRecordValue
                    record["updatedAt"] = updatedAt as CKRecordValue
                    record["updatedBy"] = updatedBy as CKRecordValue
                    record["payloadAsset"] = CKAsset(fileURL: tempUrl)

                    let modifyOp = CKModifyRecordsOperation(recordsToSave: [record], recordIDsToDelete: nil)
                    modifyOp.savePolicy = .changedKeys
                    modifyOp.modifyRecordsResultBlock = { result in
                        try? FileManager.default.removeItem(at: tempUrl)
                        switch result {
                        case .success:
                            call.resolve([
                                "synced": true,
                                "updatedAt": updatedAt,
                                "scope": isShared ? "shared" : "private"
                            ])
                        case .failure(let error):
                            call.reject("同步到 iCloud 失败：\(error.localizedDescription)")
                        }
                    }
                    db.add(modifyOp)
                }
            }

            if isShared {
                performSave()
            } else {
                let zone = CKRecordZone(zoneID: zoneID)
                db.save(zone) { _, _ in
                    performSave()
                }
            }
        }
    }

    // MARK: - 5. 从 iCloud 拉取最新手帐快照

    @objc func pullLatest(_ call: CAPPluginCall) {
        resolveActiveDatabaseAndZone { [weak self] db, zoneID, isShared in
            guard let self = self else { return }
            let recordID = CKRecord.ID(recordName: Self.rootRecordName, zoneID: zoneID)
            db.fetch(withRecordID: recordID) { record, error in
                if let ckErr = error as? CKError, ckErr.code == .unknownItem {
                    call.resolve(["found": false, "scope": isShared ? "shared" : "private"])
                    return
                }
                if let error = error {
                    call.reject("拉取 iCloud 数据失败：\(error.localizedDescription)")
                    return
                }
                guard let record = record,
                      let asset = record["payloadAsset"] as? CKAsset,
                      let fileURL = asset.fileURL,
                      let jsonData = try? Data(contentsOf: fileURL),
                      let jsonString = String(data: jsonData, encoding: .utf8) else {
                    call.resolve(["found": false, "scope": isShared ? "shared" : "private"])
                    return
                }
                call.resolve([
                    "found": true,
                    "stateJson": jsonString,
                    "updatedAt": (record["updatedAt"] as? String) ?? "",
                    "updatedBy": (record["updatedBy"] as? String) ?? "",
                    "scope": isShared ? "shared" : "private"
                ])
            }
        }
    }

    // MARK: - 6. 注册静默推送订阅（两台手机实时无感同步）

    @objc func registerSubscriptions(_ call: CAPPluginCall) {
        let info = CKSubscription.NotificationInfo()
        info.shouldSendContentAvailable = true

        let privateSub = CKDatabaseSubscription(subscriptionID: "planet-private-changes")
        privateSub.notificationInfo = info

        let sharedSub = CKDatabaseSubscription(subscriptionID: "planet-shared-changes")
        sharedSub.notificationInfo = info

        let group = DispatchGroup()
        group.enter()
        container.privateCloudDatabase.save(privateSub) { _, _ in group.leave() }
        group.enter()
        container.sharedCloudDatabase.save(sharedSub) { _, _ in group.leave() }

        group.notify(queue: .main) {
            call.resolve(["subscribed": true])
        }
    }

    // MARK: - UICloudSharingControllerDelegate

    public func cloudSharingController(_ csc: UICloudSharingController, failedToSaveShareWithError error: Error) {
        notifyListeners("cloudKitError", data: ["message": error.localizedDescription])
    }

    public func itemTitle(for csc: UICloudSharingController) -> String? {
        return "未知漫游者的登陆手帐"
    }

    public func cloudSharingControllerDidSaveShare(_ csc: UICloudSharingController) {
        notifyListeners("cloudKitDidUpdate", data: ["reason": "shareSaved"])
    }

    public func cloudSharingControllerDidStopSharing(_ csc: UICloudSharingController) {
        notifyListeners("cloudKitDidUpdate", data: ["reason": "shareStopped"])
    }

    // MARK: - Helpers

    private func resolveActiveDatabaseAndZone(completion: @escaping (CKDatabase, CKRecordZone.ID, Bool) -> Void) {
        if let dict = UserDefaults.standard.dictionary(forKey: Self.sharedZoneDefaultsKey) as? [String: String],
           let zName = dict["zoneName"],
           let oName = dict["ownerName"] {
            completion(container.sharedCloudDatabase, CKRecordZone.ID(zoneName: zName, ownerName: oName), true)
            return
        }

        // 检查共享库中是否已存在被邀请加入的 BabyPlanetZone
        container.sharedCloudDatabase.fetchAllRecordZones { [weak self] zones, _ in
            guard let self = self else { return }
            if let sharedZone = zones?.first(where: { $0.zoneID.zoneName == Self.zoneName }) {
                let dict: [String: String] = [
                    "zoneName": sharedZone.zoneID.zoneName,
                    "ownerName": sharedZone.zoneID.ownerName
                ]
                UserDefaults.standard.set(dict, forKey: Self.sharedZoneDefaultsKey)
                completion(self.container.sharedCloudDatabase, sharedZone.zoneID, true)
            } else {
                completion(self.container.privateCloudDatabase, self.privateZoneID, false)
            }
        }
    }

    private func ensurePrivateZoneAndRootRecord(
        snapshotJson: String,
        planetTitle: String,
        completion: @escaping (Result<CKRecord, Error>) -> Void
    ) {
        let db = container.privateCloudDatabase
        let zone = CKRecordZone(zoneID: privateZoneID)
        db.save(zone) { [weak self] _, zoneError in
            guard let self = self else { return }
            if let zoneError = zoneError as? CKError, zoneError.code != .serverRecordChanged {
                completion(.failure(zoneError))
                return
            }

            let recordID = CKRecord.ID(recordName: Self.rootRecordName, zoneID: self.privateZoneID)
            db.fetch(withRecordID: recordID) { existing, fetchErr in
                if let existing = existing {
                    completion(.success(existing))
                    return
                }
                if let ckErr = fetchErr as? CKError, ckErr.code != .unknownItem {
                    completion(.failure(ckErr))
                    return
                }

                let record = CKRecord(recordType: Self.recordType, recordID: recordID)
                record["planetTitle"] = planetTitle as CKRecordValue
                record["updatedAt"] = ISO8601DateFormatter().string(from: Date()) as CKRecordValue
                if !snapshotJson.isEmpty, let tempUrl = self.writeTempPayload(json: snapshotJson) {
                    record["payloadAsset"] = CKAsset(fileURL: tempUrl)
                }
                db.save(record) { saved, saveErr in
                    if let saved = saved {
                        completion(.success(saved))
                    } else {
                        completion(.failure(saveErr ?? NSError(domain: "CloudKitFamily", code: -1)))
                    }
                }
            }
        }
    }

    private func fetchOrCreateShare(
        for rootRecord: CKRecord,
        title: String,
        completion: @escaping (Result<CKShare, Error>) -> Void
    ) {
        let db = container.privateCloudDatabase
        if let shareRef = rootRecord.share {
            db.fetch(withRecordID: shareRef.recordID) { record, error in
                if let share = record as? CKShare {
                    completion(.success(share))
                } else {
                    completion(.failure(error ?? NSError(domain: "CloudKitFamily", code: -2)))
                }
            }
            return
        }

        let share = CKShare(rootRecord: rootRecord)
        share[CKShare.SystemFieldKey.title] = title as CKRecordValue
        share.publicPermission = .none

        let op = CKModifyRecordsOperation(recordsToSave: [rootRecord, share], recordIDsToDelete: nil)
        op.savePolicy = .changedKeys
        op.modifyRecordsResultBlock = { result in
            switch result {
            case .success:
                completion(.success(share))
            case .failure(let error):
                completion(.failure(error))
            }
        }
        db.add(op)
    }

    private func writeTempPayload(json: String) -> URL? {
        let fileURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("planet-sync-\(UUID().uuidString).json")
        do {
            try json.data(using: .utf8)?.write(to: fileURL, options: .atomic)
            return fileURL
        } catch {
            return nil
        }
    }
}

public extension Notification.Name {
    static let planetCloudKitDidUpdate = Notification.Name("planetCloudKitDidUpdate")
}
