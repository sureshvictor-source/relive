import Voice from '@react-native-voice/voice';
import OpenAIService, { TranscriptionResult } from './OpenAIService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RealTimeTranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  timestamp: number;
}

export interface TranscriptionOptions {
  language?: string;
  useRealTime?: boolean;
  enableSpeakerDiarization?: boolean;
  saveTranscript?: boolean;
}

export interface TranscriptionSession {
  id: string;
  audioFilePath: string;
  transcript: string;
  segments: Array<{
    text: string;
    start: number;
    end: number;
    speaker?: string;
    confidence: number;
  }>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  language: string;
  duration: number;
}

class TranscriptionService {
  private isVoiceReady = false;
  private currentSession: TranscriptionSession | null = null;
  private realTimeCallback: ((result: RealTimeTranscriptionResult) => void) | null = null;

  constructor() {
    this.initializeVoice();
  }

  /**
   * Initialize voice recognition service
   */
  private async initializeVoice(): Promise<void> {
    try {
      Voice.onSpeechStart = this.onSpeechStart.bind(this);
      Voice.onSpeechRecognized = this.onSpeechRecognized.bind(this);
      Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
      Voice.onSpeechError = this.onSpeechError.bind(this);
      Voice.onSpeechResults = this.onSpeechResults.bind(this);
      Voice.onSpeechPartialResults = this.onSpeechPartialResults.bind(this);

      const available = await Voice.isAvailable();
      this.isVoiceReady = available;

      if (available) {
        console.log('Voice recognition service initialized');
      } else {
        console.warn('Voice recognition not available on this device');
      }
    } catch (error) {
      console.error('Failed to initialize voice recognition:', error);
      this.isVoiceReady = false;
    }
  }

  /**
   * Transcribe audio file using OpenAI Whisper
   */
  async transcribeAudioFile(
    audioFilePath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionSession | null> {
    try {
      const sessionId = this.generateSessionId();

      const session: TranscriptionSession = {
        id: sessionId,
        audioFilePath,
        transcript: '',
        segments: [],
        status: 'processing',
        createdAt: new Date(),
        language: options.language || 'en',
        duration: 0,
      };

      this.currentSession = session;

      // Use OpenAI Whisper for transcription
      const result = await OpenAIService.transcribeAudio(audioFilePath);

      if (result) {
        session.transcript = result.text;
        session.segments = result.segments.map((segment, index) => ({
          text: segment.text,
          start: segment.start,
          end: segment.end,
          speaker: options.enableSpeakerDiarization ? this.detectSpeaker(segment.text, index) : undefined,
          confidence: result.confidence,
        }));
        session.status = 'completed';
        session.completedAt = new Date();
        session.language = result.language;
        session.duration = result.segments.length > 0
          ? result.segments[result.segments.length - 1].end - result.segments[0].start
          : 0;

        // Save transcript if requested
        if (options.saveTranscript) {
          await this.saveTranscriptSession(session);
        }

        console.log('Transcription completed successfully');
        return session;
      } else {
        session.status = 'failed';
        console.error('Failed to transcribe audio file');
        return session;
      }
    } catch (error) {
      console.error('Error during transcription:', error);
      if (this.currentSession) {
        this.currentSession.status = 'failed';
        return this.currentSession;
      }
      return null;
    } finally {
      this.currentSession = null;
    }
  }

  /**
   * Start real-time transcription
   */
  async startRealTimeTranscription(
    callback: (result: RealTimeTranscriptionResult) => void,
    options: TranscriptionOptions = {}
  ): Promise<boolean> {
    if (!this.isVoiceReady) {
      console.error('Voice recognition not available');
      return false;
    }

    try {
      this.realTimeCallback = callback;

      await Voice.start(options.language || 'en-US', {
        EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
        EXTRA_CALLING_PACKAGE: 'com.reliveapp',
        EXTRA_PARTIAL_RESULTS: true,
        REQUEST_PERMISSIONS_AUTO: true,
      });

      console.log('Real-time transcription started');
      return true;
    } catch (error) {
      console.error('Failed to start real-time transcription:', error);
      return false;
    }
  }

  /**
   * Stop real-time transcription
   */
  async stopRealTimeTranscription(): Promise<void> {
    try {
      await Voice.stop();
      this.realTimeCallback = null;
      console.log('Real-time transcription stopped');
    } catch (error) {
      console.error('Failed to stop real-time transcription:', error);
    }
  }

  /**
   * Get transcription session by ID
   */
  async getTranscriptionSession(sessionId: string): Promise<TranscriptionSession | null> {
    try {
      const stored = await AsyncStorage.getItem(`transcription_${sessionId}`);
      if (stored) {
        const session = JSON.parse(stored);
        session.createdAt = new Date(session.createdAt);
        if (session.completedAt) {
          session.completedAt = new Date(session.completedAt);
        }
        return session;
      }
      return null;
    } catch (error) {
      console.error('Failed to get transcription session:', error);
      return null;
    }
  }

  /**
   * Get all transcription sessions
   */
  async getAllTranscriptionSessions(): Promise<TranscriptionSession[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const transcriptionKeys = keys.filter(key => key.startsWith('transcription_'));

      const sessions: TranscriptionSession[] = [];

      for (const key of transcriptionKeys) {
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const session = JSON.parse(stored);
          session.createdAt = new Date(session.createdAt);
          if (session.completedAt) {
            session.completedAt = new Date(session.completedAt);
          }
          sessions.push(session);
        }
      }

      return sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Failed to get transcription sessions:', error);
      return [];
    }
  }

  /**
   * Delete transcription session
   */
  async deleteTranscriptionSession(sessionId: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(`transcription_${sessionId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete transcription session:', error);
      return false;
    }
  }

  /**
   * Search transcriptions by text
   */
  async searchTranscriptions(query: string): Promise<TranscriptionSession[]> {
    try {
      const allSessions = await this.getAllTranscriptionSessions();
      const lowercaseQuery = query.toLowerCase();

      return allSessions.filter(session =>
        session.transcript.toLowerCase().includes(lowercaseQuery) ||
        session.segments.some(segment =>
          segment.text.toLowerCase().includes(lowercaseQuery)
        )
      );
    } catch (error) {
      console.error('Failed to search transcriptions:', error);
      return [];
    }
  }

  /**
   * Export transcription as text
   */
  exportTranscriptionAsText(session: TranscriptionSession): string {
    let output = `Transcription Session: ${session.id}\n`;
    output += `Date: ${session.createdAt.toLocaleString()}\n`;
    output += `Language: ${session.language}\n`;
    output += `Duration: ${Math.round(session.duration)}s\n`;
    output += `Status: ${session.status}\n\n`;
    output += `--- TRANSCRIPT ---\n\n`;

    if (session.segments.length > 0) {
      session.segments.forEach((segment, index) => {
        const timestamp = `[${this.formatTime(segment.start)} - ${this.formatTime(segment.end)}]`;
        const speaker = segment.speaker ? `${segment.speaker}: ` : '';
        output += `${timestamp} ${speaker}${segment.text}\n`;
      });
    } else {
      output += session.transcript;
    }

    return output;
  }

  /**
   * Save transcript session to storage
   */
  private async saveTranscriptSession(session: TranscriptionSession): Promise<void> {
    try {
      await AsyncStorage.setItem(`transcription_${session.id}`, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to save transcript session:', error);
    }
  }

  /**
   * Detect speaker based on simple heuristics
   */
  private detectSpeaker(text: string, segmentIndex: number): string {
    // Simple speaker detection based on patterns
    // In a real implementation, you'd use proper speaker diarization

    const userIndicators = ['i ', 'my ', 'me ', 'myself'];
    const contactIndicators = ['you ', 'your ', 'yourself'];

    const lowerText = text.toLowerCase();
    const userCount = userIndicators.filter(indicator => lowerText.includes(indicator)).length;
    const contactCount = contactIndicators.filter(indicator => lowerText.includes(indicator)).length;

    if (userCount > contactCount) {
      return 'User';
    } else if (contactCount > userCount) {
      return 'Contact';
    } else {
      // Alternate speakers as fallback
      return segmentIndex % 2 === 0 ? 'User' : 'Contact';
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `transcript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format time in seconds to MM:SS format
   */
  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Voice recognition event handlers
  private onSpeechStart(event: any): void {
    console.log('Speech recognition started');
  }

  private onSpeechRecognized(event: any): void {
    console.log('Speech recognized');
  }

  private onSpeechEnd(event: any): void {
    console.log('Speech recognition ended');
  }

  private onSpeechError(event: any): void {
    console.error('Speech recognition error:', event.error);
  }

  private onSpeechResults(event: any): void {
    if (this.realTimeCallback && event.value && event.value.length > 0) {
      this.realTimeCallback({
        text: event.value[0],
        isFinal: true,
        confidence: 0.8, // Estimated confidence
        timestamp: Date.now(),
      });
    }
  }

  private onSpeechPartialResults(event: any): void {
    if (this.realTimeCallback && event.value && event.value.length > 0) {
      this.realTimeCallback({
        text: event.value[0],
        isFinal: false,
        confidence: 0.6, // Lower confidence for partial results
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    try {
      await Voice.destroy();
      this.realTimeCallback = null;
      this.currentSession = null;
      this.isVoiceReady = false;
    } catch (error) {
      console.error('Failed to destroy transcription service:', error);
    }
  }
}

export default new TranscriptionService();