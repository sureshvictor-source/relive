import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { zip, unzip } from 'react-native-zip-archive';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import EncryptionService from './EncryptionService';
import AudioStorageService from './AudioStorageService';

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  version: string;
  deviceId: string;
  fileCount: number;
  totalSize: number;
  isEncrypted: boolean;
  driveFileId?: string;
}

export interface BackupData {
  metadata: BackupMetadata;
  audioFiles: any[];
  contacts: any[];
  conversations: any[];
  settings: any;
  appConfig: any;
}

export interface BackupProgress {
  stage: 'preparing' | 'collecting' | 'compressing' | 'encrypting' | 'uploading' | 'completed';
  progress: number; // 0-100
  currentFile?: string;
  totalFiles?: number;
  processedFiles?: number;
}

class BackupService {
  private backupDirectory = `${RNFS.DocumentDirectoryPath}/backups`;
  private tempDirectory = `${RNFS.DocumentDirectoryPath}/temp`;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Create backup and temp directories
      await this.ensureDirectoryExists(this.backupDirectory);
      await this.ensureDirectoryExists(this.tempDirectory);

      // Configure Google Sign-In
      GoogleSignin.configure({
        scopes: ['https://www.googleapis.com/auth/drive.file'],
        webClientId: 'YOUR_WEB_CLIENT_ID', // Configure this in your Google Cloud Console
        offlineAccess: true,
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize BackupService:', error);
    }
  }

  private async ensureDirectoryExists(path: string): Promise<void> {
    try {
      const exists = await RNFS.exists(path);
      if (!exists) {
        await RNFS.mkdir(path);
      }
    } catch (error) {
      console.error(`Failed to create directory ${path}:`, error);
    }
  }

  /**
   * Create a complete backup of all app data
   */
  async createBackup(
    includeAudio: boolean = true,
    uploadToDrive: boolean = false,
    onProgress?: (progress: BackupProgress) => void
  ): Promise<BackupMetadata | null> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const backupId = `backup_${Date.now()}`;
      const backupPath = `${this.backupDirectory}/${backupId}`;

      onProgress?.({
        stage: 'preparing',
        progress: 5,
        currentFile: 'Initializing backup...'
      });

      // Create backup directory
      await this.ensureDirectoryExists(backupPath);

      // Collect all data
      onProgress?.({
        stage: 'collecting',
        progress: 15,
        currentFile: 'Collecting app data...'
      });

      const backupData = await this.collectBackupData(includeAudio, onProgress);

      // Create metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        version: '1.0.0',
        deviceId: await this.getDeviceId(),
        fileCount: backupData.audioFiles.length + backupData.contacts.length + backupData.conversations.length,
        totalSize: 0,
        isEncrypted: true,
      };

      // Save backup data to files
      await this.saveBackupData(backupPath, { ...backupData, metadata });

      onProgress?.({
        stage: 'compressing',
        progress: 60,
        currentFile: 'Compressing backup...'
      });

      // Create zip archive
      const zipPath = `${this.backupDirectory}/${backupId}.relive`;
      await zip(backupPath, zipPath);

      // Encrypt the backup
      onProgress?.({
        stage: 'encrypting',
        progress: 75,
        currentFile: 'Encrypting backup...'
      });

      const encryptedZipPath = await this.encryptBackup(zipPath);

      // Get final file size
      const stats = await RNFS.stat(encryptedZipPath);
      metadata.totalSize = stats.size;

      // Upload to Google Drive if requested
      if (uploadToDrive) {
        onProgress?.({
          stage: 'uploading',
          progress: 85,
          currentFile: 'Uploading to Google Drive...'
        });

        const driveFileId = await this.uploadToGoogleDrive(encryptedZipPath, metadata);
        if (driveFileId) {
          metadata.driveFileId = driveFileId;
        }
      }

      // Clean up temporary files
      await RNFS.unlink(backupPath);
      if (!uploadToDrive) {
        await RNFS.unlink(zipPath);
      }

      // Save metadata
      await this.saveBackupMetadata(metadata);

      onProgress?.({
        stage: 'completed',
        progress: 100,
        currentFile: 'Backup completed successfully'
      });

      return metadata;
    } catch (error) {
      console.error('Failed to create backup:', error);
      return null;
    }
  }

  /**
   * Restore from a backup
   */
  async restoreBackup(
    backupId: string,
    restoreFromDrive: boolean = false,
    onProgress?: (progress: BackupProgress) => void
  ): Promise<boolean> {
    try {
      onProgress?.({
        stage: 'preparing',
        progress: 5,
        currentFile: 'Preparing restore...'
      });

      let backupPath: string;

      if (restoreFromDrive) {
        // Download from Google Drive
        onProgress?.({
          stage: 'collecting',
          progress: 15,
          currentFile: 'Downloading from Google Drive...'
        });

        const metadata = await this.getBackupMetadata(backupId);
        if (!metadata?.driveFileId) {
          throw new Error('No Google Drive file ID found for this backup');
        }

        backupPath = await this.downloadFromGoogleDrive(metadata.driveFileId, backupId);
      } else {
        backupPath = `${this.backupDirectory}/${backupId}.relive.encrypted`;
      }

      // Decrypt backup
      onProgress?.({
        stage: 'encrypting',
        progress: 25,
        currentFile: 'Decrypting backup...'
      });

      const decryptedPath = await this.decryptBackup(backupPath);

      // Extract archive
      onProgress?.({
        stage: 'compressing',
        progress: 40,
        currentFile: 'Extracting backup...'
      });

      const extractPath = `${this.tempDirectory}/${backupId}_restore`;
      await unzip(decryptedPath, extractPath);

      // Load backup data
      const backupData = await this.loadBackupData(extractPath);

      // Restore data
      onProgress?.({
        stage: 'collecting',
        progress: 60,
        currentFile: 'Restoring app data...'
      });

      await this.restoreBackupData(backupData, onProgress);

      // Clean up
      await RNFS.unlink(extractPath);
      await RNFS.unlink(decryptedPath);

      onProgress?.({
        stage: 'completed',
        progress: 100,
        currentFile: 'Restore completed successfully'
      });

      return true;
    } catch (error) {
      console.error('Failed to restore backup:', error);
      return false;
    }
  }

  /**
   * Get list of available backups
   */
  async getBackupList(): Promise<BackupMetadata[]> {
    try {
      const backupsJson = await AsyncStorage.getItem('backup_metadata_list');
      if (backupsJson) {
        const backups = JSON.parse(backupsJson);
        return backups.map((backup: any) => ({
          ...backup,
          timestamp: new Date(backup.timestamp)
        }));
      }
      return [];
    } catch (error) {
      console.error('Failed to get backup list:', error);
      return [];
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      // Delete local files
      const backupPath = `${this.backupDirectory}/${backupId}.relive.encrypted`;
      if (await RNFS.exists(backupPath)) {
        await RNFS.unlink(backupPath);
      }

      // Delete from Google Drive if exists
      const metadata = await this.getBackupMetadata(backupId);
      if (metadata?.driveFileId) {
        await this.deleteFromGoogleDrive(metadata.driveFileId);
      }

      // Remove from metadata list
      await this.removeBackupMetadata(backupId);

      return true;
    } catch (error) {
      console.error('Failed to delete backup:', error);
      return false;
    }
  }

  /**
   * Auto backup (called periodically)
   */
  async scheduleAutoBackup(): Promise<void> {
    try {
      const lastBackup = await AsyncStorage.getItem('last_auto_backup');
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      if (!lastBackup || (now - parseInt(lastBackup)) > oneDayMs) {
        // Create automatic backup
        await this.createBackup(true, true);
        await AsyncStorage.setItem('last_auto_backup', now.toString());
      }
    } catch (error) {
      console.error('Failed to schedule auto backup:', error);
    }
  }

  // Private helper methods

  private async collectBackupData(includeAudio: boolean, onProgress?: (progress: BackupProgress) => void): Promise<BackupData> {
    const audioFiles = includeAudio ? await AudioStorageService.getStoredFiles() : [];

    // Get all contacts (implement based on your contacts storage)
    const contactsJson = await AsyncStorage.getItem('contacts') || '[]';
    const contacts = JSON.parse(contactsJson);

    // Get all conversations (implement based on your conversations storage)
    const conversationsJson = await AsyncStorage.getItem('conversations') || '[]';
    const conversations = JSON.parse(conversationsJson);

    // Get app settings
    const settingsJson = await AsyncStorage.getItem('app_settings') || '{}';
    const settings = JSON.parse(settingsJson);

    // Get app config
    const configJson = await AsyncStorage.getItem('app_config') || '{}';
    const appConfig = JSON.parse(configJson);

    return {
      metadata: {} as BackupMetadata, // Will be filled later
      audioFiles,
      contacts,
      conversations,
      settings,
      appConfig
    };
  }

  private async saveBackupData(backupPath: string, backupData: BackupData): Promise<void> {
    // Save each data type to separate files
    await RNFS.writeFile(`${backupPath}/metadata.json`, JSON.stringify(backupData.metadata), 'utf8');
    await RNFS.writeFile(`${backupPath}/audio_files.json`, JSON.stringify(backupData.audioFiles), 'utf8');
    await RNFS.writeFile(`${backupPath}/contacts.json`, JSON.stringify(backupData.contacts), 'utf8');
    await RNFS.writeFile(`${backupPath}/conversations.json`, JSON.stringify(backupData.conversations), 'utf8');
    await RNFS.writeFile(`${backupPath}/settings.json`, JSON.stringify(backupData.settings), 'utf8');
    await RNFS.writeFile(`${backupPath}/app_config.json`, JSON.stringify(backupData.appConfig), 'utf8');
  }

  private async loadBackupData(extractPath: string): Promise<BackupData> {
    const metadata = JSON.parse(await RNFS.readFile(`${extractPath}/metadata.json`, 'utf8'));
    const audioFiles = JSON.parse(await RNFS.readFile(`${extractPath}/audio_files.json`, 'utf8'));
    const contacts = JSON.parse(await RNFS.readFile(`${extractPath}/contacts.json`, 'utf8'));
    const conversations = JSON.parse(await RNFS.readFile(`${extractPath}/conversations.json`, 'utf8'));
    const settings = JSON.parse(await RNFS.readFile(`${extractPath}/settings.json`, 'utf8'));
    const appConfig = JSON.parse(await RNFS.readFile(`${extractPath}/app_config.json`, 'utf8'));

    return {
      metadata,
      audioFiles,
      contacts,
      conversations,
      settings,
      appConfig
    };
  }

  private async restoreBackupData(backupData: BackupData, onProgress?: (progress: BackupProgress) => void): Promise<void> {
    // Restore audio files
    for (let i = 0; i < backupData.audioFiles.length; i++) {
      const audioFile = backupData.audioFiles[i];
      onProgress?.({
        stage: 'collecting',
        progress: 60 + (i / backupData.audioFiles.length) * 30,
        currentFile: `Restoring audio file ${i + 1}/${backupData.audioFiles.length}`,
        totalFiles: backupData.audioFiles.length,
        processedFiles: i
      });

      // Restore audio file using AudioStorageService
      // Implementation depends on your AudioStorageService structure
    }

    // Restore other data
    await AsyncStorage.setItem('contacts', JSON.stringify(backupData.contacts));
    await AsyncStorage.setItem('conversations', JSON.stringify(backupData.conversations));
    await AsyncStorage.setItem('app_settings', JSON.stringify(backupData.settings));
    await AsyncStorage.setItem('app_config', JSON.stringify(backupData.appConfig));
  }

  private async encryptBackup(filePath: string): Promise<string> {
    try {
      const data = await RNFS.readFile(filePath, 'base64');
      const encryptedData = await EncryptionService.encryptData(data);

      if (!encryptedData) {
        throw new Error('Failed to encrypt backup data');
      }

      const encryptedPath = `${filePath}.encrypted`;
      await RNFS.writeFile(encryptedPath, encryptedData, 'utf8');

      // Remove unencrypted file
      await RNFS.unlink(filePath);

      return encryptedPath;
    } catch (error) {
      console.error('Failed to encrypt backup:', error);
      throw error;
    }
  }

  private async decryptBackup(filePath: string): Promise<string> {
    try {
      const encryptedData = await RNFS.readFile(filePath, 'utf8');
      const decryptedData = await EncryptionService.decryptData(encryptedData);

      if (!decryptedData) {
        throw new Error('Failed to decrypt backup data');
      }

      const decryptedPath = filePath.replace('.encrypted', '');
      await RNFS.writeFile(decryptedPath, decryptedData, 'base64');

      return decryptedPath;
    } catch (error) {
      console.error('Failed to decrypt backup:', error);
      throw error;
    }
  }

  private async uploadToGoogleDrive(filePath: string, metadata: BackupMetadata): Promise<string | null> {
    try {
      // Check if user is signed in
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) {
        const userInfo = await GoogleSignin.signIn();
        if (!userInfo) {
          throw new Error('Google Sign-In failed');
        }
      }

      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;

      // Read file
      const fileData = await RNFS.readFile(filePath, 'base64');

      // Upload to Google Drive
      const fileName = `relive_backup_${metadata.id}.relive`;
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'multipart/related; boundary="foo_bar_baz"',
        },
        body: [
          '--foo_bar_baz',
          'Content-Type: application/json; charset=UTF-8',
          '',
          JSON.stringify({
            name: fileName,
            description: `Relive app backup created on ${metadata.timestamp.toISOString()}`,
            parents: ['appDataFolder'] // Store in app-specific folder
          }),
          '',
          '--foo_bar_baz',
          'Content-Type: application/octet-stream',
          'Content-Transfer-Encoding: base64',
          '',
          fileData,
          '--foo_bar_baz--'
        ].join('\r\n')
      });

      if (!response.ok) {
        throw new Error(`Google Drive upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.id;
    } catch (error) {
      console.error('Failed to upload to Google Drive:', error);
      return null;
    }
  }

  private async downloadFromGoogleDrive(fileId: string, backupId: string): Promise<string> {
    try {
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Google Drive download failed: ${response.statusText}`);
      }

      const data = await response.text();
      const downloadPath = `${this.tempDirectory}/${backupId}.relive.encrypted`;

      await RNFS.writeFile(downloadPath, data, 'utf8');
      return downloadPath;
    } catch (error) {
      console.error('Failed to download from Google Drive:', error);
      throw error;
    }
  }

  private async deleteFromGoogleDrive(fileId: string): Promise<void> {
    try {
      const tokens = await GoogleSignin.getTokens();
      const accessToken = tokens.accessToken;

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Google Drive delete failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to delete from Google Drive:', error);
    }
  }

  private async getDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    try {
      const existingBackups = await this.getBackupList();
      const updatedBackups = [...existingBackups, metadata];
      await AsyncStorage.setItem('backup_metadata_list', JSON.stringify(updatedBackups));
    } catch (error) {
      console.error('Failed to save backup metadata:', error);
    }
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    try {
      const backups = await this.getBackupList();
      return backups.find(backup => backup.id === backupId) || null;
    } catch (error) {
      console.error('Failed to get backup metadata:', error);
      return null;
    }
  }

  private async removeBackupMetadata(backupId: string): Promise<void> {
    try {
      const existingBackups = await this.getBackupList();
      const updatedBackups = existingBackups.filter(backup => backup.id !== backupId);
      await AsyncStorage.setItem('backup_metadata_list', JSON.stringify(updatedBackups));
    } catch (error) {
      console.error('Failed to remove backup metadata:', error);
    }
  }
}

export default new BackupService();