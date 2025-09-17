package com.reliveapp

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class CallDetectionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var telephonyManager: TelephonyManager? = null
    private var phoneStateListener: CustomPhoneStateListener? = null
    private var isMonitoring = false
    private var currentCallState = TelephonyManager.CALL_STATE_IDLE
    private var callStartTime: Long = 0

    override fun getName(): String {
        return "CallDetectionModule"
    }

    @ReactMethod
    fun startCallMonitoring(promise: Promise) {
        try {
            if (isMonitoring) {
                promise.resolve(true)
                return
            }

            // Check permissions first
            if (!hasRequiredPermissions()) {
                promise.reject("PERMISSION_DENIED", "Required permissions not granted")
                return
            }

            // Initialize telephony manager
            telephonyManager = reactApplicationContext.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

            // Create and register phone state listener
            phoneStateListener = CustomPhoneStateListener()
            telephonyManager?.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE)

            isMonitoring = true
            android.util.Log.d("CallDetection", "📞 Call monitoring started")
            promise.resolve(true)

        } catch (e: Exception) {
            promise.reject("MONITORING_ERROR", "Failed to start call monitoring: ${e.message}")
        }
    }

    @ReactMethod
    fun stopCallMonitoring(promise: Promise) {
        try {
            if (!isMonitoring) {
                promise.resolve(true)
                return
            }

            // Unregister phone state listener
            phoneStateListener?.let { listener ->
                telephonyManager?.listen(listener, PhoneStateListener.LISTEN_NONE)
            }

            phoneStateListener = null
            telephonyManager = null
            isMonitoring = false
            currentCallState = TelephonyManager.CALL_STATE_IDLE

            android.util.Log.d("CallDetection", "📞 Call monitoring stopped")
            promise.resolve(true)

        } catch (e: Exception) {
            promise.reject("MONITORING_ERROR", "Failed to stop call monitoring: ${e.message}")
        }
    }

    @ReactMethod
    fun requestPermissions(promise: Promise) {
        try {
            val activity = currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "No current activity available")
                return
            }

            val permissions = arrayOf(
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.RECORD_AUDIO
            )

            val missingPermissions = permissions.filter { permission ->
                ContextCompat.checkSelfPermission(reactApplicationContext, permission) != PackageManager.PERMISSION_GRANTED
            }

            if (missingPermissions.isEmpty()) {
                promise.resolve(true)
                return
            }

            // Request missing permissions
            ActivityCompat.requestPermissions(activity, missingPermissions.toTypedArray(), PERMISSION_REQUEST_CODE)

            // For now, resolve true - in a real app, you'd wait for the permission result
            // This would require implementing a permission result callback
            promise.resolve(true)

        } catch (e: Exception) {
            promise.reject("PERMISSION_ERROR", "Failed to request permissions: ${e.message}")
        }
    }

    @ReactMethod
    fun isCallActive(promise: Promise) {
        try {
            val isActive = currentCallState == TelephonyManager.CALL_STATE_OFFHOOK
            promise.resolve(isActive)
        } catch (e: Exception) {
            promise.reject("STATUS_ERROR", "Failed to check call status: ${e.message}")
        }
    }

    private fun hasRequiredPermissions(): Boolean {
        val permissions = arrayOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.RECORD_AUDIO
        )

        return permissions.all { permission ->
            ContextCompat.checkSelfPermission(reactApplicationContext, permission) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    inner class CustomPhoneStateListener : PhoneStateListener() {

        override fun onCallStateChanged(state: Int, phoneNumber: String?) {
            super.onCallStateChanged(state, phoneNumber)

            if (!isMonitoring) return

            val timestamp = System.currentTimeMillis()
            val normalizedPhoneNumber = phoneNumber?.let { normalizePhoneNumber(it) }

            when (state) {
                TelephonyManager.CALL_STATE_RINGING -> {
                    // Incoming call ringing
                    android.util.Log.d("CallDetection", "📞 Incoming call ringing: $normalizedPhoneNumber")
                }

                TelephonyManager.CALL_STATE_OFFHOOK -> {
                    // Call connected (either incoming answered or outgoing connected)
                    if (currentCallState != TelephonyManager.CALL_STATE_OFFHOOK) {
                        callStartTime = timestamp

                        val event = Arguments.createMap().apply {
                            putString("type", "CALL_STARTED")
                            putString("callId", "call_$timestamp")
                            putDouble("timestamp", timestamp.toDouble())
                            normalizedPhoneNumber?.let { putString("phoneNumber", it) }
                            // Contact name would require contacts permission and lookup
                        }

                        sendEvent("CallStarted", event)
                        android.util.Log.d("CallDetection", "📞 Call started: $normalizedPhoneNumber")

                        // Send connected event after a short delay
                        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                            val connectedEvent = Arguments.createMap().apply {
                                putString("type", "CALL_CONNECTED")
                                putString("callId", "call_$callStartTime")
                                putDouble("timestamp", System.currentTimeMillis().toDouble())
                            }
                            sendEvent("CallConnected", connectedEvent)
                            android.util.Log.d("CallDetection", "📞 Call connected")
                        }, 500)
                    }
                }

                TelephonyManager.CALL_STATE_IDLE -> {
                    // Call ended
                    if (currentCallState == TelephonyManager.CALL_STATE_OFFHOOK && callStartTime > 0) {
                        val event = Arguments.createMap().apply {
                            putString("type", "CALL_ENDED")
                            putString("callId", "call_$callStartTime")
                            putDouble("timestamp", timestamp.toDouble())
                            normalizedPhoneNumber?.let { putString("phoneNumber", it) }
                        }

                        sendEvent("CallEnded", event)
                        android.util.Log.d("CallDetection", "📞 Call ended: $normalizedPhoneNumber")

                        callStartTime = 0
                    }
                }
            }

            currentCallState = state
        }
    }

    private fun normalizePhoneNumber(phoneNumber: String): String {
        // Remove all non-digits and get last 10 digits for US numbers
        val digits = phoneNumber.replace(Regex("[^\\d]"), "")
        return if (digits.length >= 10) digits.takeLast(10) else digits
    }

    override fun getConstants(): Map<String, Any> {
        return mapOf(
            "CALL_STARTED" to "CALL_STARTED",
            "CALL_ENDED" to "CALL_ENDED",
            "CALL_CONNECTED" to "CALL_CONNECTED"
        )
    }

    companion object {
        private const val PERMISSION_REQUEST_CODE = 1001
    }
}