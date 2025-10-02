import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppConfiguration {
  openai: {
    apiKey: string | null;
    model: string;
    whisperModel: string;
  };
  encryption: {
    algorithm: string;
    keyRotationDays: number;
  };
  notifications: {
    enabled: boolean;
    quietHours: {
      start: string;
      end: string;
    };
    reminderTimings: {
      commitmentDays: number;
      followUpDays: number;
      relationshipCheckDays: number;
    };
  };
  audio: {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    maxRecordingMinutes: number;
  };
  search: {
    indexUpdateInterval: number;
    maxResults: number;
    enableFuzzyMatching: boolean;
  };
  relationshipHealth: {
    updateInterval: number;
    trendPeriodDays: number;
    minInteractionsForScore: number;
  };
  storage: {
    maxAudioFiles: number;
    cleanupOlderThanDays: number;
    autoCleanupEnabled: boolean;
  };
  development: {
    debugMode: boolean;
    mockServicesEnabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

class AppConfig {
  private config: AppConfiguration;
  private isInitialized = false;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): AppConfiguration {
    return {
      openai: {
        apiKey: null,
        model: 'gpt-4',
        whisperModel: 'whisper-1',
      },
      encryption: {
        algorithm: 'AES-256-GCM',
        keyRotationDays: 90,
      },
      notifications: {
        enabled: true,
        quietHours: {
          start: '22:00',
          end: '08:00',
        },
        reminderTimings: {
          commitmentDays: 1,
          followUpDays: 3,
          relationshipCheckDays: 14,
        },
      },
      audio: {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        maxRecordingMinutes: 120, // 2 hours max
      },
      search: {
        indexUpdateInterval: 300000, // 5 minutes
        maxResults: 50,
        enableFuzzyMatching: true,
      },
      relationshipHealth: {
        updateInterval: 86400000, // 24 hours
        trendPeriodDays: 30,
        minInteractionsForScore: 3,
      },
      storage: {
        maxAudioFiles: 1000,
        cleanupOlderThanDays: 90,
        autoCleanupEnabled: true,
      },
      development: {
        debugMode: typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development',
        mockServicesEnabled: typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development',
        logLevel: (typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development') ? 'debug' : 'warn',
      },
    };
  }

  /**
   * Initialize configuration by loading from storage
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      this.isInitialized = true;
      console.log('App configuration initialized');
    } catch (error) {
      console.error('Failed to initialize app configuration:', error);
      this.isInitialized = true; // Continue with defaults
    }
  }

  /**
   * Load configuration from AsyncStorage
   */
  private async loadConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('app_config');
      if (stored) {
        const savedConfig = JSON.parse(stored);
        this.config = { ...this.config, ...savedConfig };
      }
    } catch (error) {
      console.error('Failed to load app configuration:', error);
    }
  }

  /**
   * Save configuration to AsyncStorage
   */
  async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem('app_config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save app configuration:', error);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfiguration {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<AppConfiguration>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
  }

  /**
   * Get OpenAI configuration
   */
  getOpenAIConfig() {
    return this.config.openai;
  }

  /**
   * Set OpenAI API key
   */
  async setOpenAIApiKey(apiKey: string): Promise<void> {
    this.config.openai.apiKey = apiKey;
    await this.saveConfig();
  }

  /**
   * Get notification configuration
   */
  getNotificationConfig() {
    return this.config.notifications;
  }

  /**
   * Update notification settings
   */
  async updateNotificationConfig(updates: Partial<AppConfiguration['notifications']>): Promise<void> {
    this.config.notifications = { ...this.config.notifications, ...updates };
    await this.saveConfig();
  }

  /**
   * Get audio configuration
   */
  getAudioConfig() {
    return this.config.audio;
  }

  /**
   * Get search configuration
   */
  getSearchConfig() {
    return this.config.search;
  }

  /**
   * Get relationship health configuration
   */
  getRelationshipHealthConfig() {
    return this.config.relationshipHealth;
  }

  /**
   * Get storage configuration
   */
  getStorageConfig() {
    return this.config.storage;
  }

  /**
   * Get development configuration
   */
  getDevelopmentConfig() {
    return this.config.development;
  }

  /**
   * Check if in development mode
   */
  isDevelopmentMode(): boolean {
    return this.config.development.debugMode;
  }

  /**
   * Check if mock services are enabled
   */
  isMockServicesEnabled(): boolean {
    return this.config.development.mockServicesEnabled;
  }

  /**
   * Get log level
   */
  getLogLevel(): string {
    return this.config.development.logLevel;
  }

  /**
   * Export configuration as JSON
   */
  exportConfig(): string {
    const exportableConfig = { ...this.config };
    // Remove sensitive data from export
    exportableConfig.openai.apiKey = '***REDACTED***';
    return JSON.stringify(exportableConfig, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  async importConfig(configJson: string): Promise<boolean> {
    try {
      const importedConfig = JSON.parse(configJson);

      // Validate configuration structure
      if (this.validateConfig(importedConfig)) {
        // Don't import API key for security
        delete importedConfig.openai?.apiKey;

        this.config = { ...this.config, ...importedConfig };
        await this.saveConfig();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: any): boolean {
    const requiredSections = ['openai', 'encryption', 'notifications', 'audio', 'search'];
    return requiredSections.every(section => config.hasOwnProperty(section));
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    const apiKey = this.config.openai.apiKey; // Preserve API key
    this.config = this.getDefaultConfig();
    this.config.openai.apiKey = apiKey; // Restore API key
    await this.saveConfig();
  }

  /**
   * Check if configuration is initialized
   */
  isConfigInitialized(): boolean {
    return this.isInitialized;
  }
}

export default new AppConfig();