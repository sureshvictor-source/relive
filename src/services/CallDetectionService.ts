import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { store } from '../store';
import { startRecording, stopRecording } from '../store/slices/recordingSlice';
import { addConversation } from '../store/slices/conversationsSlice';
import { mockCallDetectionService } from './MockCallDetectionService';
import AudioRecordingService, { RecordingSession } from './AudioRecordingService';
import TranscriptionService from './TranscriptionService';
import ConversationAnalysisService from './ConversationAnalysisService';
import CommitmentTrackingService from './CommitmentTrackingService';
import DatabaseService from './DatabaseService';

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
  private currentRecordingSession: RecordingSession | null = null;

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
      this.currentRecordingSession = await AudioRecordingService.startRecording(contactId);

      if (this.currentRecordingSession) {
        await store.dispatch(startRecording(contactId));
        // Show notification to user
        this.showCallDetectedNotification(event.contactName || event.phoneNumber || 'Unknown');
      } else {
        console.error('Failed to start audio recording for call');
      }

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
      const completedSession = await AudioRecordingService.stopRecording();
      await store.dispatch(stopRecording());

      // Calculate call duration
      const endTime = new Date(event.timestamp);
      const duration = Math.floor((endTime.getTime() - this.callStartTime.getTime()) / 1000);

      // Find contact by phone number if available
      let contactId: string | undefined;
      if (event.phoneNumber) {
        contactId = await this.findContactByPhoneNumber(event.phoneNumber);
      }

      // Start comprehensive analysis in background if recording was successful
      let transcript = '';
      let analysisCompleted = false;
      
      if (completedSession?.filePath) {
        try {
          console.log('🎯 Starting comprehensive call analysis...');
          
          // 1. Transcribe the audio
          console.log('📝 Transcribing audio...');
          const transcriptionSession = await TranscriptionService.transcribeAudioFile(
            completedSession.filePath,
            {
              language: 'en',
              saveTranscript: true,
              enableSpeakerDiarization: true,
            }
          );

          if (transcriptionSession?.transcript) {
            transcript = transcriptionSession.transcript;
            console.log('✅ Transcription completed successfully');
            
            // Get contact name for better AI analysis
            const state = store.getState();
            const contact = contactId ? state.contacts.contacts.find(c => c.id === contactId) : null;
            const contactName = contact?.name || 'Unknown Contact';
            const relationshipType = contact?.relationshipType || 'unknown';
            
            // 2. Run AI analysis in parallel
            console.log('🤖 Starting AI analysis and commitment extraction...');
            const [conversationAnalysis, extractedCommitments] = await Promise.allSettled([
              // Comprehensive conversation analysis
              ConversationAnalysisService.analyzeConversation(
                this.currentCallId || 'unknown',
                contactId || 'unknown', 
                transcript,
                duration,
                contactName,
                relationshipType
              ),
              // Extract commitments
              CommitmentTrackingService.extractCommitmentsFromConversation(
                this.currentCallId || 'unknown',
                contactId || 'unknown',
                transcript,
                contactName
              )
            ]);
            
            if (conversationAnalysis.status === 'fulfilled' && conversationAnalysis.value) {
              console.log('✅ Conversation analysis completed');
              console.log(`   - Quality Score: ${conversationAnalysis.value.conversationInsights.conversationQuality}/10`);
              console.log(`   - Emotional Tone: ${conversationAnalysis.value.emotionalAnalysis.overallTone}`);
              console.log(`   - Key Topics: ${conversationAnalysis.value.conversationInsights.keyTopics.join(', ')}`);
            } else {
              console.warn('⚠️  Conversation analysis failed');
            }
            
            if (extractedCommitments.status === 'fulfilled' && extractedCommitments.value) {
              const commitments = extractedCommitments.value;
              console.log(`✅ Commitment extraction completed - found ${commitments.length} commitments`);
              commitments.forEach((commitment, index) => {
                console.log(`   ${index + 1}. ${commitment.text} (${commitment.whoCommitted}, ${commitment.priority})`);
              });
            } else {
              console.warn('⚠️  Commitment extraction failed');
            }
            
            analysisCompleted = true;
            
          } else {
            console.warn('⚠️  Transcription failed, skipping AI analysis');
          }
          
        } catch (analysisError) {
          console.warn('⚠️  Comprehensive analysis failed:', analysisError);
        }
      }

      // Create conversation record with actual recording path and transcript
      const conversation = {
        contactId: contactId || 'unknown',
        startTime: this.callStartTime,
        endTime,
        duration: completedSession?.duration || duration * 1000, // Use actual recording duration if available
        transcript,
        emotionalTone: 'neutral' as const,
        engagementLevel: 5,
        audioFilePath: completedSession?.filePath || '', // Use actual recording path
        recordingId: completedSession?.id,
      };

      await store.dispatch(addConversation(conversation));

      // Also save to SQLite database with full conversation details
      const conversationRecord = {
        id: this.currentCallId,
        contactId: conversation.contactId,
        contactName: event.contactName,
        phoneNumber: event.phoneNumber,
        startTime: conversation.startTime.toISOString(),
        endTime: conversation.endTime?.toISOString(),
        duration: conversation.duration,
        transcript: conversation.transcript,
        audioFilePath: conversation.audioFilePath,
        emotionalTone: conversation.emotionalTone,
        engagementLevel: conversation.engagementLevel,
        conversationQuality: 5, // Default, will be updated by analysis
        analysisCompleted: analysisCompleted
      };

      await DatabaseService.insertConversation(conversationRecord);
      console.log('💾 Conversation saved to SQLite database');

      // Reset call tracking
      this.currentCallId = null;
      this.callStartTime = null;
      this.currentRecordingSession = null;

      // Show call completed notification with analysis status
      this.showCallCompletedNotification(duration, analysisCompleted, transcript.length > 0);

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
  private showCallCompletedNotification(duration: number, analysisCompleted: boolean = false, transcribed: boolean = false): void {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationText = `${minutes}m ${seconds}s`;

    let statusMessage = `✅ Call recording completed. Duration: ${durationText}`;
    
    if (transcribed) {
      statusMessage += '\n📝 Transcript generated';
      
      if (analysisCompleted) {
        statusMessage += '\n🤖 AI analysis completed - commitments extracted';
      } else {
        statusMessage += '\n⚠️ AI analysis failed';
      }
    } else {
      statusMessage += '\n⚠️ Transcription failed';
    }

    console.log(statusMessage);

    // TODO: Implement proper notification with analysis results
    // Alert.alert(
    //   'Donna Call Analysis Complete',
    //   statusMessage,
    //   [
    //     { text: 'View Details', onPress: () => navigation.navigate('Conversations') },
    //     { text: 'OK', style: 'default' }
    //   ]
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