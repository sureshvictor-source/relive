import AudioRecord from 'react-native-audio-record';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import AudioStorageService from './AudioStorageService';

export interface RecordingSession {
  id: string;
  contactId?: string;
  startTime: Date;
  endTime?: Date;
  tempFilePath: string;
  filePath?: string;
  duration: number;
  fileSize: number;
  isProcessing: boolean;
}

export interface AudioRecordingConfig {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  audioSource: number;
  wavFile: string;
}

class AudioRecordingService {
  private currentSession: RecordingSession | null = null;
  private isRecording = false;
  private audioRecordAvailable = false;

  constructor() {
    this.initializeAudioRecord();
  }

  private initializeAudioRecord(): void {
    try {
      if (!AudioRecord || typeof AudioRecord.init !== 'function') {
        console.warn('AudioRecord module not available, audio recording will be disabled');
        this.audioRecordAvailable = false;
        return;
      }

      const options = {
        sampleRate: 16000,  // 16kHz sample rate
        channels: 1,        // Mono
        bitsPerSample: 16,  // 16-bit
        audioSource: 6,     // VOICE_RECOGNITION
        wavFile: 'temp.wav' // temp filename
      };

      AudioRecord.init(options);
      this.audioRecordAvailable = true;
    } catch (error) {
      console.error('Failed to initialize AudioRecord:', error);
      this.audioRecordAvailable = false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);

        return (
          grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED &&
          grants[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const microphonePermission = await request(PERMISSIONS.IOS.MICROPHONE);
        const speechRecognitionPermission = await request(PERMISSIONS.IOS.SPEECH_RECOGNITION);

        return (
          microphonePermission === RESULTS.GRANTED &&
          speechRecognitionPermission === RESULTS.GRANTED
        );
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const audioPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        const phonePermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
        return audioPermission && phonePermission;
      } else {
        const microphonePermission = await check(PERMISSIONS.IOS.MICROPHONE);
        const speechRecognitionPermission = await check(PERMISSIONS.IOS.SPEECH_RECOGNITION);

        return (
          microphonePermission === RESULTS.GRANTED &&
          speechRecognitionPermission === RESULTS.GRANTED
        );
      }
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }

  private getRecordingConfig(): AudioRecordingConfig {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `call_recording_${timestamp}.wav`;

    return {
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6,
      wavFile: filename,
    };
  }

  async startRecording(contactId?: string): Promise<RecordingSession | null> {
    try {
      if (!this.audioRecordAvailable) {
        console.warn('AudioRecord module not available, cannot start recording');
        Alert.alert(
          'Recording Unavailable',
          'Audio recording is not available on this device.',
          [{ text: 'OK' }]
        );
        return null;
      }

      const hasPermissions = await this.checkPermissions();
      if (!hasPermissions) {
        const granted = await this.requestPermissions();
        if (!granted) {
          Alert.alert(
            'Permissions Required',
            'Relive needs microphone access to record calls. Please enable permissions in Settings.',
            [{ text: 'OK' }]
          );
          return null;
        }
      }

      if (this.currentSession) {
        console.warn('Recording already in progress');
        return this.currentSession;
      }

      const config = this.getRecordingConfig();

      // Update AudioRecord configuration
      if (AudioRecord && typeof AudioRecord.init === 'function') {
        AudioRecord.init({
          sampleRate: config.sampleRate,
          channels: config.channels,
          bitsPerSample: config.bitsPerSample,
          audioSource: config.audioSource,
          wavFile: config.wavFile
        });
      }

      if (AudioRecord && typeof AudioRecord.start === 'function') {
        AudioRecord.start();
      }
      this.isRecording = true;

      this.currentSession = {
        id: Date.now().toString(),
        contactId,
        startTime: new Date(),
        tempFilePath: config.wavFile,
        duration: 0,
        fileSize: 0,
        isProcessing: false,
      };

      console.log('Recording started:', config.wavFile);
      return this.currentSession;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return null;
    }
  }

  async stopRecording(): Promise<RecordingSession | null> {
    try {
      if (!this.currentSession || !this.isRecording) {
        console.warn('No active recording session');
        return null;
      }

      let audioFile = null;
      if (this.audioRecordAvailable && AudioRecord && typeof AudioRecord.stop === 'function') {
        audioFile = await AudioRecord.stop();
      }
      this.isRecording = false;

      const endTime = new Date();
      let fileSize = 0;

      // Convert audio file to base64 and store using AudioStorageService
      if (audioFile) {
        try {
          const duration = endTime.getTime() - this.currentSession.startTime.getTime();
          
          // Read the audio file from filesystem and convert to base64
          const audioFilePath = audioFile;
          let audioDataBase64 = '';
          
          try {
            // Check if file exists
            const fileExists = await RNFS.exists(audioFilePath);
            if (fileExists) {
              // Read file as base64
              audioDataBase64 = await RNFS.readFile(audioFilePath, 'base64');
              
              // Get actual file stats
              const fileStat = await RNFS.stat(audioFilePath);
              fileSize = fileStat.size;
            } else {
              console.warn('Audio file does not exist at path:', audioFilePath);
              fileSize = this.estimateFileSize(duration);
              // Use placeholder for missing file
              audioDataBase64 = 'placeholder_missing_file';
            }
          } catch (fsError) {
            console.warn('Failed to read audio file, using placeholder:', fsError);
            fileSize = this.estimateFileSize(duration);
            audioDataBase64 = 'placeholder_read_error';
          }

          const audioFileRecord = await AudioStorageService.storeAudioFile(
            audioDataBase64,
            {
              contactId: this.currentSession.contactId,
              recordingType: 'call',
              quality: 'medium'
            },
            true // encrypt
          );

          if (audioFileRecord) {
            console.log('Audio file stored successfully:', audioFileRecord.id);
          }
        } catch (storageError) {
          console.error('Failed to store audio file:', storageError);
        }
      }

      const completedSession: RecordingSession = {
        ...this.currentSession,
        endTime,
        duration: endTime.getTime() - this.currentSession.startTime.getTime(),
        fileSize,
        filePath: audioFile || this.currentSession.tempFilePath,
      };

      this.currentSession = null;
      console.log('Recording stopped successfully');

      return completedSession;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.currentSession = null;
      this.isRecording = false;
      return null;
    }
  }

  private estimateFileSize(durationMs: number): number {
    // Estimate file size based on recording parameters
    const sampleRate = 16000;
    const channels = 1;
    const bitsPerSample = 16;
    const bytesPerSecond = (sampleRate * channels * bitsPerSample) / 8;
    const durationSeconds = durationMs / 1000;
    return Math.round((durationSeconds * bytesPerSecond) + 44); // +44 for WAV header
  }

  async pauseRecording(): Promise<boolean> {
    // Note: react-native-audio-record doesn't support pause/resume
    // For now, we'll stop and restart recording if needed
    console.warn('Pause/resume not supported with current audio package');
    return false;
  }

  async resumeRecording(): Promise<boolean> {
    // Note: react-native-audio-record doesn't support pause/resume
    // For now, we'll stop and restart recording if needed
    console.warn('Pause/resume not supported with current audio package');
    return false;
  }

  getCurrentSession(): RecordingSession | null {
    return this.currentSession;
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording && this.currentSession !== null;
  }

  async getRecordingsList(): Promise<string[]> {
    try {
      const audioFiles = await AudioStorageService.getStoredFiles();
      return audioFiles
        .filter(file => file.metadata.recordingType === 'call')
        .map(file => file.id)
        .sort((a, b) => b.localeCompare(a)); // Sort by newest first
    } catch (error) {
      console.error('Failed to get recordings list:', error);
      return [];
    }
  }

  async deleteRecording(fileId: string): Promise<boolean> {
    try {
      return await AudioStorageService.deleteAudioFile(fileId);
    } catch (error) {
      console.error('Failed to delete recording:', error);
      return false;
    }
  }

  async getRecordingDuration(fileId: string): Promise<number> {
    try {
      const audioFiles = await AudioStorageService.getStoredFiles();
      const audioFile = audioFiles.find(file => file.id === fileId);
      return audioFile ? audioFile.duration : 0;
    } catch (error) {
      console.error('Failed to get recording duration:', error);
      return 0;
    }
  }

  cleanup(): void {
    if (this.currentSession && this.isRecording) {
      this.stopRecording();
    }
    this.isRecording = false;
    this.currentSession = null;
  }

  isAudioRecordAvailable(): boolean {
    return this.audioRecordAvailable;
  }
}

export default new AudioRecordingService();