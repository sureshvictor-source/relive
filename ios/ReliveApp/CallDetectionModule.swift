import Foundation
import CallKit
import React
import Contacts

@objc(CallDetectionModule)
class CallDetectionModule: RCTEventEmitter, CXCallObserverDelegate {

    private var callObserver: CXCallObserver?
    private var isMonitoring = false
    private var activeCallUUIDs: Set<UUID> = []

    override init() {
        super.init()
        setupCallObserver()
    }

    // MARK: - React Native Bridge Methods

    @objc
    func startCallMonitoring(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            if self.isMonitoring {
                resolve(true)
                return
            }

            self.isMonitoring = true
            NSLog("📞 Call monitoring started")
            resolve(true)
        }
    }

    @objc
    func stopCallMonitoring(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            self.isMonitoring = false
            self.activeCallUUIDs.removeAll()
            NSLog("📞 Call monitoring stopped")
            resolve(true)
        }
    }

    @objc
    func requestPermissions(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        // iOS CallKit doesn't require special permissions for call observation
        // But we should request contacts permission for better caller identification
        let contactStore = CNContactStore()
        
        contactStore.requestAccess(for: .contacts) { granted, error in
            DispatchQueue.main.async {
                if let error = error {
                    NSLog("Contacts permission error: \(error)")
                }
                
                // Always resolve true since contacts permission is optional for call detection
                resolve(true)
            }
        }
    }

    @objc
    func isCallActive(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            let hasActiveCalls = !self.activeCallUUIDs.isEmpty
            resolve(hasActiveCalls)
        }
    }

    // MARK: - CallKit Observer Setup

    private func setupCallObserver() {
        callObserver = CXCallObserver()
        callObserver?.setDelegate(self, queue: nil)
    }

    // MARK: - CXCallObserverDelegate

    func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        guard isMonitoring else { return }

        let callUUID = call.uuid
        let timestamp = Date().timeIntervalSince1970 * 1000 // Convert to milliseconds

        // Determine call state and emit appropriate events
        if call.hasConnected && !call.hasEnded {
            // Call is active/connected
            if !activeCallUUIDs.contains(callUUID) {
                activeCallUUIDs.insert(callUUID)

                // Emit call started event
                let event: [String: Any] = [
                    "type": "CALL_STARTED",
                    "callId": callUUID.uuidString,
                    "timestamp": timestamp,
                    "phoneNumber": extractPhoneNumber(from: call),
                    "contactName": extractContactName(from: call)
                ]

                sendEvent(withName: "CallStarted", body: event)
                NSLog("📞 Call started: \\(callUUID)")

                // Also emit connected event for more precise timing
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    let connectedEvent: [String: Any] = [
                        "type": "CALL_CONNECTED",
                        "callId": callUUID.uuidString,
                        "timestamp": Date().timeIntervalSince1970 * 1000
                    ]

                    self.sendEvent(withName: "CallConnected", body: connectedEvent)
                    NSLog("📞 Call connected: \\(callUUID)")
                }
            }
        } else if call.hasEnded {
            // Call has ended
            if activeCallUUIDs.contains(callUUID) {
                activeCallUUIDs.remove(callUUID)

                let event: [String: Any] = [
                    "type": "CALL_ENDED",
                    "callId": callUUID.uuidString,
                    "timestamp": timestamp,
                    "phoneNumber": extractPhoneNumber(from: call),
                    "contactName": extractContactName(from: call)
                ]

                sendEvent(withName: "CallEnded", body: event)
                NSLog("📞 Call ended: \\(callUUID)")
            }
        }
    }

    // MARK: - Helper Methods

    private func extractPhoneNumber(from call: CXCall) -> String? {
        // Note: iOS CallKit doesn't directly provide phone numbers for privacy reasons
        // The CXCall object doesn't have a handle property - this information isn't available
        // Phone numbers would need to be obtained through other means or user input
        return nil
    }

    private func extractContactName(from call: CXCall) -> String? {
        // Try to get contact name if phone number is available
        guard let phoneNumber = extractPhoneNumber(from: call) else {
            return nil
        }
        
        return lookupContactName(for: phoneNumber)
    }
    
    private func lookupContactName(for phoneNumber: String) -> String? {
        let store = CNContactStore()
        let keysToFetch = [CNContactGivenNameKey, CNContactFamilyNameKey, CNContactPhoneNumbersKey]
        
        do {
            let contacts = try store.unifiedContacts(matching: CNContact.predicateForContacts(matching: CNPhoneNumber(stringValue: phoneNumber)), keysToFetch: keysToFetch as [CNKeyDescriptor])
            
            if let contact = contacts.first {
                let firstName = contact.givenName
                let lastName = contact.familyName
                return "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
            }
        } catch {
            NSLog("Error looking up contact: \(error)")
        }
        
        return nil
    }

    // MARK: - React Native Event Emitter

    override func supportedEvents() -> [String]! {
        return ["CallStarted", "CallEnded", "CallConnected"]
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    override func constantsToExport() -> [AnyHashable: Any]! {
        return [
            "CALL_STARTED": "CALL_STARTED",
            "CALL_ENDED": "CALL_ENDED",
            "CALL_CONNECTED": "CALL_CONNECTED"
        ]
    }

    // MARK: - Background Monitoring

    override func startObserving() {
        // Called when JS side starts listening for events
        // Can be used to enable more intensive monitoring if needed
    }

    override func stopObserving() {
        // Called when JS side stops listening for events
        // Can be used to reduce monitoring to save battery
    }

    deinit {
        callObserver?.setDelegate(nil, queue: nil)
        callObserver = nil
    }
}

// MARK: - React Native Bridge Header

@objc(CallDetectionModuleBridge)
class CallDetectionModuleBridge: NSObject {

    @objc
    static func moduleName() -> String! {
        return "CallDetectionModule"
    }

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return true
    }
}