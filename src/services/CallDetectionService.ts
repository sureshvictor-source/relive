import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { store } from '../store';
import { startRecording, stopRecording } from '../store/slices/recordingSlice';
import { addConversation } from '../store/slices/conversationsSlice';
import { mockCallDetectionService } from './MockCallDetectionService';

interface CallDetectionModule {
  startCallMonitoring(): Promise<boolean>;
  stopCallMonitoring(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  isCallActive(): Promise<boolean>;
}

// Native module interfaces (will be implemented as native modules)
const { CallDetectionModule } = NativeModules as {
  CallDetectionModule: CallDetectionModule;
};

// Check if native module is available
const isNativeModuleAvailable = !!CallDetectionModule;

export interface CallEvent {
  type: 'CALL_STARTED' | 'CALL_ENDED' | 'CALL_CONNECTED';
  phoneNumber?: string;
  contactName?: string;
  timestamp: number;
  callId?: string;
}

class CallDetectionService {
  private eventEmitter: NativeEventEmitter | null = null;
  private isMonitoring = false;
  private currentCallId: string | null = null;
  private callStartTime: Date | null = null;

  constructor() {
    if (isNativeModuleAvailable) {
      this.eventEmitter = new NativeEventEmitter(CallDetectionModule as any);
      this.setupEventListeners();
    } else {
      console.warn('CallDetectionModule native module not available. Call detection will be disabled.');
    }
  }

  /**
   * Initialize call detection and request necessary permissions
   */
  async initialize(): Promise<boolean> {
    try {
      if (!isNativeModuleAvailable) {
        console.warn('CallDetectionModule not available on this platform. Using mock service for development.');

        // Use mock service for development/testing
        return await mockCallDetectionService.initialize();
      }

      // Request necessary permissions
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.error('Call detection permissions not granted');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize call detection:', error);
      return false;
    }
  }

  /**
   * Start monitoring for calls
   */
  async startMonitoring(): Promise<boolean> {
    try {
      if (this.isMonitoring) {
        return true;
      }

      if (!isNativeModuleAvailable) {
        console.warn('CallDetectionModule not available, using mock service');
        return await mockCallDetectionService.startCallMonitoring();
      }

      const success = await CallDetectionModule.startCallMonitoring();
      if (success) {
        this.isMonitoring = true;
        console.log('Call monitoring started');
      }

      return success;
    } catch (error) {
      console.error('Failed to start call monitoring:', error);
      return false;
    }
  }

  /**
   * Stop monitoring for calls
   */
  async stopMonitoring(): Promise<boolean> {
    try {
      if (!this.isMonitoring) {
        return true;
      }

      if (!isNativeModuleAvailable) {
        return await mockCallDetectionService.stopCallMonitoring();
      }

      const success = await CallDetectionModule.stopCallMonitoring();
      if (success) {
        this.isMonitoring = false;
        console.log('Call monitoring stopped');
      }

      return success;
    } catch (error) {
      console.error('Failed to stop call monitoring:', error);
      return false;
    }
  }

  /**
   * Request necessary permissions for call detection
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (!isNativeModuleAvailable) {
        return await mockCallDetectionService.requestPermissions();
      }

      return await CallDetectionModule.requestPermissions();
    } catch (error) {
      console.error('Failed to request call detection permissions:', error);
      return false;
    }
  }

  /**
   * Check if there's currently an active call
   */
  async isCallActive(): Promise<boolean> {
    try {
      if (!isNativeModuleAvailable) {
        return await mockCallDetectionService.isCallActive();
      }

      return await CallDetectionModule.isCallActive();
    } catch (error) {
      console.error('Failed to check call status:', error);
      return false;
    }
  }

  /**
   * Setup event listeners for call state changes
   */
  private setupEventListeners(): void {
    if (!this.eventEmitter) {
      return;
    }

    // Listen for call started events
    this.eventEmitter.addListener('CallStarted', this.handleCallStarted.bind(this));

    // Listen for call ended events
    this.eventEmitter.addListener('CallEnded', this.handleCallEnded.bind(this));

    // Listen for call connected events (for more precise timing)
    this.eventEmitter.addListener('CallConnected', this.handleCallConnected.bind(this));
  }

  /**
   * Handle call started event
   */
  private async handleCallStarted(event: CallEvent): Promise<void> {
    try {
      console.log('Call started:', event);

      this.currentCallId = event.callId || `call_${Date.now()}`;
      this.callStartTime = new Date(event.timestamp);

      // Find contact by phone number if available
      let contactId: string | undefined;
      if (event.phoneNumber) {
        contactId = await this.findContactByPhoneNumber(event.phoneNumber);
      }

      // Start recording automatically
      const action = await store.dispatch(startRecording(contactId));

      // Show notification to user
      this.showCallDetectedNotification(event.contactName || event.phoneNumber || 'Unknown');

    } catch (error) {
      console.error('Error handling call started:', error);
    }
  }

  /**
   * Handle call connected event (call actually active)
   */
  private handleCallConnected(event: CallEvent): void {
    console.log('Call connected:', event);

    // Update call start time to when call actually connected
    this.callStartTime = new Date(event.timestamp);
  }

  /**
   * Handle call ended event
   */
  private async handleCallEnded(event: CallEvent): Promise<void> {
    try {
      console.log('Call ended:', event);

      if (!this.currentCallId || !this.callStartTime) {
        console.warn('Call ended but no active call tracking');
        return;
      }

      // Stop recording
      await store.dispatch(stopRecording());

      // Calculate call duration
      const endTime = new Date(event.timestamp);
      const duration = Math.floor((endTime.getTime() - this.callStartTime.getTime()) / 1000);

      // Find contact by phone number if available
      let contactId: string | undefined;
      if (event.phoneNumber) {
        contactId = await this.findContactByPhoneNumber(event.phoneNumber);
      }

      // Create conversation record
      const conversation = {
        contactId: contactId || 'unknown',
        startTime: this.callStartTime,
        endTime,
        duration,
        transcript: '', // Will be filled by transcription service
        emotionalTone: 'neutral' as const,
        engagementLevel: 5,
        audioFilePath: `recordings/${this.currentCallId}.wav`, // Mock path
      };

      await store.dispatch(addConversation(conversation));

      // Reset call tracking
      this.currentCallId = null;
      this.callStartTime = null;

      // Show call completed notification
      this.showCallCompletedNotification(duration);

    } catch (error) {
      console.error('Error handling call ended:', error);
    }
  }

  /**
   * Find contact by phone number
   */
  private async findContactByPhoneNumber(phoneNumber: string): Promise<string | undefined> {
    const state = store.getState();
    const contacts = state.contacts.contacts;

    // Simple phone number matching (in real app, would need better normalization)
    const contact = contacts.find(c =>
      c.phone && this.normalizePhoneNumber(c.phone) === this.normalizePhoneNumber(phoneNumber)
    );

    return contact?.id;
  }

  /**
   * Normalize phone number for comparison
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digits and get last 10 digits
    const digits = phoneNumber.replace(/\D/g, '');
    return digits.slice(-10);
  }

  /**
   * Show notification when call is detected
   */
  private showCallDetectedNotification(contactInfo: string): void {
    // TODO: Implement push notification or in-app notification
    console.log(`📞 Recording started for call with ${contactInfo}`);

    // For now, we could use Alert, but in production would use proper notifications
    // Alert.alert(
    //   'Call Detected',
    //   `Recording started for call with ${contactInfo}`,
    //   [{ text: 'OK' }]
    // );
  }

  /**
   * Show notification when call is completed
   */
  private showCallCompletedNotification(duration: number): void {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationText = `${minutes}m ${seconds}s`;

    console.log(`✅ Call recording completed. Duration: ${durationText}`);

    // TODO: Implement proper notification
    // Alert.alert(
    //   'Call Recorded',
    //   `Call recording completed. Duration: ${durationText}`,
    //   [{ text: 'View Recording', onPress: () => navigation.navigate('Conversations') }]
    // );
  }

  /**
   * Get current monitoring status
   */
  isCurrentlyMonitoring(): boolean {
    if (!isNativeModuleAvailable) {
      return mockCallDetectionService.isCurrentlyMonitoring();
    }
    return this.isMonitoring;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.eventEmitter) {
      this.eventEmitter.removeAllListeners('CallStarted');
      this.eventEmitter.removeAllListeners('CallEnded');
      this.eventEmitter.removeAllListeners('CallConnected');
    }

    this.stopMonitoring();
  }
}

// Export singleton instance
export const callDetectionService = new CallDetectionService();
export default CallDetectionService;