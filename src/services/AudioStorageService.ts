import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import CryptoJS from 'crypto-js';

export interface AudioFile {
  id: string;
  fileName: string;
  fileSize: number;
  duration: number;
  createdAt: Date;
  isEncrypted: boolean;
  checksum: string;
  audioData: string; // Base64 encoded audio data
  metadata: {
    contactId?: string;
    conversationId?: string;
    recordingType: 'call' | 'memo' | 'test';
    quality: 'low' | 'medium' | 'high';
  };
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  encryptedFiles: number;
  availableSpace: number;
  lastCleanup: Date | null;
}

class AudioStorageService {
  private encryptionKey: string | null = null;
  private readonly STORAGE_KEYS = {
    AUDIO_FILES: '@relive_audio_files',
    STORAGE_STATS: '@relive_storage_stats',
    LAST_CLEANUP: '@relive_last_cleanup',
  };

  constructor() {
    this.initializeStorage();
  }

  /**
   * Initialize storage - ensure required keys exist
   */
  private async initializeStorage(): Promise<void> {
    try {
      const existingFiles = await AsyncStorage.getItem(this.STORAGE_KEYS.AUDIO_FILES);
      if (!existingFiles) {
        await AsyncStorage.setItem(this.STORAGE_KEYS.AUDIO_FILES, JSON.stringify([]));
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }

  /**
   * Set encryption key for secure storage
   */
  setEncryptionKey(key: string): void {
    this.encryptionKey = key;
  }

  /**
   * Store audio file with optional encryption
   */
  async storeAudioFile(
    audioDataBase64: string,
    metadata: AudioFile['metadata'],
    encrypt: boolean = true
  ): Promise<AudioFile | null> {
    try {
      const fileName = this.generateFileName(metadata.recordingType);
      const id = this.generateFileId();
      let audioData = audioDataBase64;
      let isEncrypted = false;

      if (encrypt && this.encryptionKey) {
        // Encrypt the audio data
        audioData = this.encryptData(audioDataBase64);
        isEncrypted = true;
      }

      // Calculate checksum for integrity verification
      const checksum = this.calculateChecksum(audioDataBase64);

      // Get audio duration (placeholder - would need native module)
      const duration = await this.getAudioDuration(audioDataBase64);

      const audioFile: AudioFile = {
        id,
        fileName,
        fileSize: audioDataBase64.length, // Approximate size based on base64 length
        duration,
        createdAt: new Date(),
        isEncrypted,
        checksum,
        audioData,
        metadata,
      };

      // Save to AsyncStorage
      await this.saveAudioFile(audioFile);

      return audioFile;
    } catch (error) {
      console.error('Failed to store audio file:', error);
      return null;
    }
  }

  /**
   * Retrieve audio file with automatic decryption
   */
  async retrieveAudioFile(fileId: string): Promise<string | null> {
    try {
      const audioFile = await this.getAudioFile(fileId);
      if (!audioFile) {
        return null;
      }

      if (audioFile.isEncrypted && this.encryptionKey) {
        // Decrypt the audio data
        return this.decryptData(audioFile.audioData);
      }

      return audioFile.audioData;
    } catch (error) {
      console.error('Failed to retrieve audio file:', error);
      return null;
    }
  }

  /**
   * Delete audio file and its metadata
   */
  async deleteAudioFile(fileId: string): Promise<boolean> {
    try {
      const files = await this.getStoredFiles();
      const updatedFiles = files.filter(file => file.id !== fileId);

      await AsyncStorage.setItem(this.STORAGE_KEYS.AUDIO_FILES, JSON.stringify(updatedFiles));
      return true;
    } catch (error) {
      console.error('Failed to delete audio file:', error);
      return false;
    }
  }

  /**
   * Get list of all stored audio files
   */
  async getStoredFiles(): Promise<AudioFile[]> {
    try {
      const filesJson = await AsyncStorage.getItem(this.STORAGE_KEYS.AUDIO_FILES);
      if (!filesJson) {
        return [];
      }

      const files = JSON.parse(filesJson);
      // Convert date strings back to Date objects
      return files.map((file: any) => ({
        ...file,
        createdAt: new Date(file.createdAt),
      })).sort((a: AudioFile, b: AudioFile) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Failed to get stored files:', error);
      return [];
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const files = await this.getStoredFiles();
      const totalFiles = files.length;
      const totalSize = files.reduce((sum, file) => sum + file.fileSize, 0);
      const encryptedFiles = files.filter(file => file.isEncrypted).length;

      // AsyncStorage doesn't provide disk space info, so we'll estimate
      const availableSpace = 1000000000; // 1GB placeholder

      // Get last cleanup date
      const lastCleanup = await this.getLastCleanupDate();

      return {
        totalFiles,
        totalSize,
        encryptedFiles,
        availableSpace,
        lastCleanup,
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        encryptedFiles: 0,
        availableSpace: 0,
        lastCleanup: null,
      };
    }
  }

  /**
   * Cleanup old or temporary files
   */
  async cleanupStorage(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const files = await this.getStoredFiles();
      let deletedCount = 0;

      for (const file of files) {
        if (file.createdAt < cutoffDate && file.metadata.recordingType === 'test') {
          const deleted = await this.deleteAudioFile(file.id);
          if (deleted) {
            deletedCount++;
          }
        }
      }

      // Save cleanup date
      await this.saveLastCleanupDate(new Date());

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup storage:', error);
      return 0;
    }
  }

  /**
   * Encrypt data using AES encryption
   */
  private encryptData(data: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set');
    }

    try {
      return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
    } catch (error) {
      console.error('Failed to encrypt data:', error);
      throw error;
    }
  }

  /**
   * Decrypt data using AES decryption
   */
  private decryptData(encryptedData: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set');
    }

    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Failed to decrypt data:', error);
      throw error;
    }
  }

  /**
   * Save audio file to AsyncStorage
   */
  private async saveAudioFile(audioFile: AudioFile): Promise<void> {
    try {
      const files = await this.getStoredFiles();
      files.push(audioFile);
      await AsyncStorage.setItem(this.STORAGE_KEYS.AUDIO_FILES, JSON.stringify(files));
    } catch (error) {
      console.error('Failed to save audio file:', error);
      throw error;
    }
  }

  /**
   * Get specific audio file by ID
   */
  private async getAudioFile(fileId: string): Promise<AudioFile | null> {
    try {
      const files = await this.getStoredFiles();
      return files.find(file => file.id === fileId) || null;
    } catch (error) {
      console.error('Failed to get audio file:', error);
      return null;
    }
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(): string {
    return `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate filename based on recording type
   */
  private generateFileName(type: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${type}_${timestamp}.m4a`;
  }

  /**
   * Calculate data checksum for integrity verification
   */
  private calculateChecksum(data: string): string {
    try {
      return CryptoJS.MD5(data).toString();
    } catch (error) {
      console.error('Failed to calculate checksum:', error);
      return '';
    }
  }

  /**
   * Get audio duration (placeholder implementation)
   */
  private async getAudioDuration(audioData: string): Promise<number> {
    // TODO: Implement actual audio duration detection using native modules
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Get last cleanup date
   */
  private async getLastCleanupDate(): Promise<Date | null> {
    try {
      const cleanupData = await AsyncStorage.getItem(this.STORAGE_KEYS.LAST_CLEANUP);
      if (!cleanupData) {
        return null;
      }
      const data = JSON.parse(cleanupData);
      return new Date(data.lastCleanup);
    } catch (error) {
      return null;
    }
  }

  /**
   * Save last cleanup date
   */
  private async saveLastCleanupDate(date: Date): Promise<void> {
    try {
      const data = { lastCleanup: date.toISOString() };
      await AsyncStorage.setItem(this.STORAGE_KEYS.LAST_CLEANUP, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save cleanup date:', error);
    }
  }
}

export default new AudioStorageService();