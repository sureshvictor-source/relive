import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  ProgressBarAndroid,
} from 'react-native';
import BackupService, { BackupMetadata, BackupProgress } from '../services/BackupService';

const BackupScreen: React.FC = () => {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupProgress, setBackupProgress] = useState<BackupProgress | null>(null);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [uploadToDrive, setUploadToDrive] = useState(true);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);

  useEffect(() => {
    loadBackups();
    loadSettings();
  }, []);

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const backupList = await BackupService.getBackupList();
      setBackups(backupList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    } catch (error) {
      console.error('Failed to load backups:', error);
      Alert.alert('Error', 'Failed to load backup list');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    // Load backup settings from storage
    // Implementation depends on your settings storage
  };

  const createBackup = async () => {
    if (isCreatingBackup) return;

    Alert.alert(
      'Create Backup',
      `This will create a backup of all your data${includeAudio ? ' including audio files' : ''}${uploadToDrive ? ' and upload it to Google Drive' : ''}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Backup',
          onPress: async () => {
            setIsCreatingBackup(true);
            setBackupProgress({ stage: 'preparing', progress: 0 });

            try {
              const metadata = await BackupService.createBackup(
                includeAudio,
                uploadToDrive,
                (progress) => {
                  setBackupProgress(progress);
                }
              );

              if (metadata) {
                Alert.alert('Success', 'Backup created successfully');
                await loadBackups();
              } else {
                Alert.alert('Error', 'Failed to create backup');
              }
            } catch (error) {
              console.error('Backup creation failed:', error);
              Alert.alert('Error', 'Failed to create backup');
            } finally {
              setIsCreatingBackup(false);
              setBackupProgress(null);
            }
          },
        },
      ]
    );
  };

  const restoreBackup = async (backup: BackupMetadata) => {
    if (isRestoring) return;

    Alert.alert(
      'Restore Backup',
      `This will restore your data from the backup created on ${backup.timestamp.toLocaleDateString()}. This will overwrite your current data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setIsRestoring(true);
            setBackupProgress({ stage: 'preparing', progress: 0 });

            try {
              const success = await BackupService.restoreBackup(
                backup.id,
                !!backup.driveFileId,
                (progress) => {
                  setBackupProgress(progress);
                }
              );

              if (success) {
                Alert.alert('Success', 'Backup restored successfully. Please restart the app.');
              } else {
                Alert.alert('Error', 'Failed to restore backup');
              }
            } catch (error) {
              console.error('Backup restore failed:', error);
              Alert.alert('Error', 'Failed to restore backup');
            } finally {
              setIsRestoring(false);
              setBackupProgress(null);
            }
          },
        },
      ]
    );
  };

  const deleteBackup = async (backup: BackupMetadata) => {
    Alert.alert(
      'Delete Backup',
      `Are you sure you want to delete the backup from ${backup.timestamp.toLocaleDateString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await BackupService.deleteBackup(backup.id);
              if (success) {
                await loadBackups();
              } else {
                Alert.alert('Error', 'Failed to delete backup');
              }
            } catch (error) {
              console.error('Failed to delete backup:', error);
              Alert.alert('Error', 'Failed to delete backup');
            }
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getProgressStageText = (stage: string): string => {
    switch (stage) {
      case 'preparing': return 'Preparing...';
      case 'collecting': return 'Collecting data...';
      case 'compressing': return 'Compressing...';
      case 'encrypting': return 'Encrypting...';
      case 'uploading': return 'Uploading...';
      case 'completed': return 'Completed';
      default: return 'Processing...';
    }
  };

  const renderBackupItem = (backup: BackupMetadata) => (
    <View key={backup.id} style={styles.backupItem}>
      <View style={styles.backupInfo}>
        <Text style={styles.backupDate}>
          {backup.timestamp.toLocaleDateString()} at {backup.timestamp.toLocaleTimeString()}
        </Text>
        <Text style={styles.backupDetails}>
          {backup.fileCount} files • {formatFileSize(backup.totalSize)}
          {backup.driveFileId && ' • 📁 Google Drive'}
          {backup.isEncrypted && ' • 🔒 Encrypted'}
        </Text>
        <Text style={styles.backupId}>ID: {backup.id}</Text>
      </View>
      <View style={styles.backupActions}>
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={() => restoreBackup(backup)}
          disabled={isRestoring || isCreatingBackup}
        >
          <Text style={styles.restoreButtonText}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteBackup(backup)}
          disabled={isRestoring || isCreatingBackup}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading backups...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Backup & Restore</Text>

      {/* Progress Indicator */}
      {(isCreatingBackup || isRestoring) && backupProgress && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {isCreatingBackup ? 'Creating Backup' : 'Restoring Backup'}
          </Text>
          <Text style={styles.progressStage}>
            {getProgressStageText(backupProgress.stage)}
          </Text>
          <ProgressBarAndroid
            styleAttr="Horizontal"
            indeterminate={false}
            progress={backupProgress.progress / 100}
            color="#007AFF"
            style={styles.progressBar}
          />
          <Text style={styles.progressPercent}>
            {Math.round(backupProgress.progress)}%
          </Text>
          {backupProgress.currentFile && (
            <Text style={styles.progressFile}>
              {backupProgress.currentFile}
            </Text>
          )}
        </View>
      )}

      {/* Backup Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backup Settings</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Include Audio Files</Text>
          <Switch
            value={includeAudio}
            onValueChange={setIncludeAudio}
            disabled={isCreatingBackup || isRestoring}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Upload to Google Drive</Text>
          <Switch
            value={uploadToDrive}
            onValueChange={setUploadToDrive}
            disabled={isCreatingBackup || isRestoring}
          />
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Auto Backup (Daily)</Text>
          <Switch
            value={autoBackupEnabled}
            onValueChange={setAutoBackupEnabled}
            disabled={isCreatingBackup || isRestoring}
          />
        </View>
      </View>

      {/* Create Backup Button */}
      <TouchableOpacity
        style={[styles.createBackupButton, (isCreatingBackup || isRestoring) && styles.disabledButton]}
        onPress={createBackup}
        disabled={isCreatingBackup || isRestoring}
      >
        {isCreatingBackup ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.createBackupButtonText}>Create New Backup</Text>
        )}
      </TouchableOpacity>

      {/* Backup List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Backups ({backups.length})</Text>

        {backups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No backups found</Text>
            <Text style={styles.emptyStateSubtext}>
              Create your first backup to protect your data
            </Text>
          </View>
        ) : (
          backups.map(renderBackupItem)
        )}
      </View>

      {/* Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About Backups</Text>
        <Text style={styles.infoText}>
          • Backups include all your conversations, contacts, settings, and optionally audio files
        </Text>
        <Text style={styles.infoText}>
          • All backups are encrypted for your security
        </Text>
        <Text style={styles.infoText}>
          • Google Drive backups are stored in your private app folder
        </Text>
        <Text style={styles.infoText}>
          • Local backups are stored on your device only
        </Text>
        <Text style={styles.infoText}>
          • Auto backup creates daily backups automatically
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  progressContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  progressStage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    marginBottom: 8,
  },
  progressPercent: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  progressFile: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  createBackupButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  createBackupButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  backupItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backupInfo: {
    flex: 1,
    marginRight: 16,
  },
  backupDate: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  backupDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  backupId: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  backupActions: {
    flexDirection: 'row',
    gap: 8,
  },
  restoreButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  restoreButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
});

export default BackupScreen;