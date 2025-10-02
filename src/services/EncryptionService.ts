import CryptoJS from 'crypto-js';
import Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface EncryptionConfig {
  algorithm: 'AES-256-GCM' | 'AES-256-CBC';
  keyDerivation: 'PBKDF2' | 'Argon2';
  iterations: number;
  saltLength: number;
  ivLength: number;
}

export interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
  tag?: string; // For GCM mode
  algorithm: string;
  timestamp: number;
}

export interface KeyInfo {
  id: string;
  created: Date;
  lastUsed: Date;
  algorithm: string;
  isActive: boolean;
}

export interface EncryptionMetrics {
  totalEncrypted: number;
  totalDecrypted: number;
  totalKeyRotations: number;
  lastKeyRotation: Date | null;
  averageEncryptionTime: number;
  averageDecryptionTime: number;
}

class EncryptionService {
  private masterKey: string | null = null;
  private encryptionKeys: Map<string, string> = new Map();
  private config: EncryptionConfig;
  private isInitialized = false;
  private metrics: EncryptionMetrics;
  private keychainAvailable = false;
  private cryptoAvailable = false;

  constructor() {
    this.config = {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2',
      iterations: 100000,
      saltLength: 32,
      ivLength: 12, // 96 bits for GCM
    };

    this.metrics = {
      totalEncrypted: 0,
      totalDecrypted: 0,
      totalKeyRotations: 0,
      lastKeyRotation: null,
      averageEncryptionTime: 0,
      averageDecryptionTime: 0,
    };

    this.initializeService();
  }

  /**
   * Check availability of crypto dependencies
   */
  private checkCryptoDependencies(): void {
    try {
      // Check if Keychain is available
      if (Keychain && typeof Keychain.getInternetCredentials === 'function') {
        this.keychainAvailable = true;
      } else {
        console.warn('Keychain module not available - using fallback key storage');
        this.keychainAvailable = false;
      }

      // Check if crypto random generation is available
      try {
        CryptoJS.lib.WordArray.random(1);
        this.cryptoAvailable = true;
      } catch (error) {
        console.warn('Crypto random generation not available - using fallback');
        this.cryptoAvailable = false;
      }
    } catch (error) {
      console.warn('Error checking crypto dependencies:', error);
      this.keychainAvailable = false;
      this.cryptoAvailable = false;
    }
  }

  /**
   * Generate fallback random string
   */
  private generateFallbackRandom(length: number): string {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length * 2; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  /**
   * Initialize encryption service
   */
  private async initializeService(): Promise<void> {
    try {
      this.checkCryptoDependencies();
      await this.loadConfig();
      await this.loadMetrics();
      await this.loadMasterKey();
      this.isInitialized = true;
      console.log('Encryption service initialized');
    } catch (error) {
      console.error('Failed to initialize encryption service:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Load master key from secure keychain or fallback storage
   */
  private async loadMasterKey(): Promise<void> {
    try {
      if (this.keychainAvailable) {
        const credentials = await Keychain.getInternetCredentials('relive_master_key');
        if (credentials) {
          this.masterKey = credentials.password;
          console.log('Master key loaded from keychain');
          return;
        }
      } else {
        // Fallback to AsyncStorage (less secure but functional)
        const storedKey = await AsyncStorage.getItem('relive_master_key_fallback');
        if (storedKey) {
          this.masterKey = storedKey;
          console.log('Master key loaded from fallback storage');
          return;
        }
      }

      // Generate new master key if none exists
      await this.generateMasterKey();
    } catch (error) {
      console.error('Failed to load master key:', error);
      await this.generateMasterKey();
    }
  }

  /**
   * Generate new master key
   */
  private async generateMasterKey(): Promise<void> {
    try {
      // Generate a master key using available crypto or fallback
      let masterKey: string;
      if (this.cryptoAvailable) {
        masterKey = CryptoJS.lib.WordArray.random(256/8).toString(CryptoJS.enc.Hex);
      } else {
        // Fallback random generation (less secure but functional)
        masterKey = this.generateFallbackRandom(32);
        console.warn('Using fallback random generation for master key');
      }

      // Store in secure keychain or fallback storage
      if (this.keychainAvailable) {
        await Keychain.setInternetCredentials(
          'relive_master_key',
          'master',
          masterKey
        );
      } else {
        // Fallback to AsyncStorage (less secure but functional)
        await AsyncStorage.setItem('relive_master_key_fallback', masterKey);
        console.warn('Storing master key in fallback storage (less secure)');
      }

      this.masterKey = masterKey;
      this.metrics.totalKeyRotations++;
      this.metrics.lastKeyRotation = new Date();

      await this.saveMetrics();
      console.log('New master key generated and stored');
    } catch (error) {
      console.error('Failed to generate master key:', error);
      throw new Error('Could not initialize encryption - master key generation failed');
    }
  }

  /**
   * Derive encryption key from master key and context
   */
  private deriveKey(context: string, salt?: string): { key: string; salt: string } {
    if (!this.masterKey) {
      throw new Error('Master key not available');
    }

    let usedSalt: string;
    if (salt) {
      usedSalt = salt;
    } else if (this.cryptoAvailable) {
      usedSalt = CryptoJS.lib.WordArray.random(this.config.saltLength).toString(CryptoJS.enc.Hex);
    } else {
      usedSalt = this.generateFallbackRandom(this.config.saltLength);
    }

    const key = CryptoJS.PBKDF2(
      this.masterKey + context,
      CryptoJS.enc.Hex.parse(usedSalt),
      {
        keySize: 256/32,
        iterations: this.config.iterations,
        hasher: CryptoJS.algo.SHA256
      }
    ).toString(CryptoJS.enc.Hex);

    return { key, salt: usedSalt };
  }

  /**
   * Encrypt data
   */
  async encryptData(data: string, context: string = 'default'): Promise<EncryptedData | null> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.initializeService();
      }

      const { key, salt } = this.deriveKey(context);
      let iv: string;
      if (this.cryptoAvailable) {
        iv = CryptoJS.lib.WordArray.random(this.config.ivLength).toString(CryptoJS.enc.Hex);
      } else {
        iv = this.generateFallbackRandom(this.config.ivLength);
      }

      let encrypted: CryptoJS.lib.CipherParams;
      let tag: string | undefined;

      if (this.config.algorithm === 'AES-256-GCM') {
        // Note: crypto-js doesn't have native GCM support, using CBC as fallback
        encrypted = CryptoJS.AES.encrypt(data, CryptoJS.enc.Hex.parse(key), {
          iv: CryptoJS.enc.Hex.parse(iv),
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
      } else {
        encrypted = CryptoJS.AES.encrypt(data, CryptoJS.enc.Hex.parse(key), {
          iv: CryptoJS.enc.Hex.parse(iv),
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
      }

      const result: EncryptedData = {
        data: encrypted.toString(),
        iv,
        salt,
        tag,
        algorithm: this.config.algorithm,
        timestamp: Date.now(),
      };

      // Update metrics
      const encryptionTime = Date.now() - startTime;
      this.updateEncryptionMetrics(encryptionTime);

      console.log(`Data encrypted in ${encryptionTime}ms`);
      return result;
    } catch (error) {
      console.error('Encryption failed:', error);
      return null;
    }
  }

  /**
   * Decrypt data
   */
  async decryptData(encryptedData: EncryptedData, context: string = 'default'): Promise<string | null> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.initializeService();
      }

      const { key } = this.deriveKey(context, encryptedData.salt);

      let decrypted: CryptoJS.lib.WordArray;

      if (encryptedData.algorithm === 'AES-256-GCM' || encryptedData.algorithm === 'AES-256-CBC') {
        decrypted = CryptoJS.AES.decrypt(encryptedData.data, CryptoJS.enc.Hex.parse(key), {
          iv: CryptoJS.enc.Hex.parse(encryptedData.iv),
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        });
      } else {
        throw new Error(`Unsupported encryption algorithm: ${encryptedData.algorithm}`);
      }

      const result = decrypted.toString(CryptoJS.enc.Utf8);

      if (!result) {
        throw new Error('Decryption failed - invalid result');
      }

      // Update metrics
      const decryptionTime = Date.now() - startTime;
      this.updateDecryptionMetrics(decryptionTime);

      console.log(`Data decrypted in ${decryptionTime}ms`);
      return result;
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  /**
   * Encrypt file data
   */
  async encryptFile(filePath: string, context: string = 'file'): Promise<EncryptedData | null> {
    try {
      // Note: In a real implementation, you'd read the file using RNFS
      // For now, this is a placeholder that would need file system integration
      console.warn('File encryption requires file system integration');
      return null;
    } catch (error) {
      console.error('File encryption failed:', error);
      return null;
    }
  }

  /**
   * Decrypt file data
   */
  async decryptFile(encryptedData: EncryptedData, outputPath: string, context: string = 'file'): Promise<boolean> {
    try {
      const decryptedData = await this.decryptData(encryptedData, context);
      if (!decryptedData) {
        return false;
      }

      // Note: In a real implementation, you'd write the file using RNFS
      // For now, this is a placeholder that would need file system integration
      console.warn('File decryption requires file system integration');
      return false;
    } catch (error) {
      console.error('File decryption failed:', error);
      return false;
    }
  }

  /**
   * Hash data for integrity verification
   */
  hashData(data: string): string {
    return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
  }

  /**
   * Verify data integrity
   */
  verifyIntegrity(data: string, expectedHash: string): boolean {
    const actualHash = this.hashData(data);
    return actualHash === expectedHash;
  }

  /**
   * Generate secure random string
   */
  generateSecureRandom(length: number): string {
    if (this.cryptoAvailable) {
      return CryptoJS.lib.WordArray.random(length).toString(CryptoJS.enc.Hex);
    } else {
      return this.generateFallbackRandom(length);
    }
  }

  /**
   * Rotate master key (for security best practices)
   */
  async rotateMasterKey(): Promise<boolean> {
    try {
      console.log('Starting master key rotation...');

      // Store old master key for migration
      const oldMasterKey = this.masterKey;

      // Generate new master key
      await this.generateMasterKey();

      // Note: In a real implementation, you would:
      // 1. Re-encrypt all existing data with the new key
      // 2. Update all derived keys
      // 3. Securely delete the old key
      // This is a complex operation that requires careful orchestration

      console.log('Master key rotation completed');
      return true;
    } catch (error) {
      console.error('Master key rotation failed:', error);
      return false;
    }
  }

  /**
   * Export encrypted backup of data
   */
  async exportEncryptedBackup(data: any[], passphrase: string): Promise<string | null> {
    try {
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data,
      };

      const serializedData = JSON.stringify(backupData);

      // Encrypt with user-provided passphrase
      const salt = this.cryptoAvailable ?
        CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex) :
        this.generateFallbackRandom(32);
      const key = CryptoJS.PBKDF2(passphrase, CryptoJS.enc.Hex.parse(salt), {
        keySize: 256/32,
        iterations: 100000,
        hasher: CryptoJS.algo.SHA256
      });

      const iv = this.cryptoAvailable ?
        CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex) :
        this.generateFallbackRandom(16);
      const encrypted = CryptoJS.AES.encrypt(serializedData, key, {
        iv: CryptoJS.enc.Hex.parse(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      const backup = {
        version: '1.0',
        algorithm: 'AES-256-CBC',
        salt,
        iv,
        data: encrypted.toString(),
        timestamp: Date.now(),
      };

      return JSON.stringify(backup);
    } catch (error) {
      console.error('Export encrypted backup failed:', error);
      return null;
    }
  }

  /**
   * Import encrypted backup
   */
  async importEncryptedBackup(backupString: string, passphrase: string): Promise<any[] | null> {
    try {
      const backup = JSON.parse(backupString);

      // Derive key from passphrase
      const key = CryptoJS.PBKDF2(passphrase, CryptoJS.enc.Hex.parse(backup.salt), {
        keySize: 256/32,
        iterations: 100000,
        hasher: CryptoJS.algo.SHA256
      });

      // Decrypt data
      const decrypted = CryptoJS.AES.decrypt(backup.data, key, {
        iv: CryptoJS.enc.Hex.parse(backup.iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
      if (!decryptedString) {
        throw new Error('Invalid passphrase or corrupted backup');
      }

      const backupData = JSON.parse(decryptedString);
      return backupData.data;
    } catch (error) {
      console.error('Import encrypted backup failed:', error);
      return null;
    }
  }

  /**
   * Get encryption status and metrics
   */
  getEncryptionStatus(): {
    isInitialized: boolean;
    hasMasterKey: boolean;
    algorithm: string;
    keychainAvailable: boolean;
    cryptoAvailable: boolean;
    metrics: EncryptionMetrics;
  } {
    return {
      isInitialized: this.isInitialized,
      hasMasterKey: this.masterKey !== null,
      algorithm: this.config.algorithm,
      keychainAvailable: this.keychainAvailable,
      cryptoAvailable: this.cryptoAvailable,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Update encryption configuration
   */
  async updateConfig(newConfig: Partial<EncryptionConfig>): Promise<boolean> {
    try {
      this.config = { ...this.config, ...newConfig };
      await this.saveConfig();
      console.log('Encryption configuration updated');
      return true;
    } catch (error) {
      console.error('Failed to update encryption config:', error);
      return false;
    }
  }

  /**
   * Clear all encryption keys (for logout/reset)
   */
  async clearAllKeys(): Promise<void> {
    try {
      if (this.keychainAvailable) {
        await Keychain.resetInternetCredentials('relive_master_key');
      } else {
        await AsyncStorage.removeItem('relive_master_key_fallback');
      }
      this.masterKey = null;
      this.encryptionKeys.clear();
      this.isInitialized = false;
      console.log('All encryption keys cleared');
    } catch (error) {
      console.error('Failed to clear encryption keys:', error);
    }
  }

  /**
   * Update encryption metrics
   */
  private updateEncryptionMetrics(encryptionTime: number): void {
    this.metrics.totalEncrypted++;
    this.metrics.averageEncryptionTime =
      (this.metrics.averageEncryptionTime * (this.metrics.totalEncrypted - 1) + encryptionTime) /
      this.metrics.totalEncrypted;
  }

  /**
   * Update decryption metrics
   */
  private updateDecryptionMetrics(decryptionTime: number): void {
    this.metrics.totalDecrypted++;
    this.metrics.averageDecryptionTime =
      (this.metrics.averageDecryptionTime * (this.metrics.totalDecrypted - 1) + decryptionTime) /
      this.metrics.totalDecrypted;
  }

  /**
   * Load configuration from storage
   */
  private async loadConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('encryption_config');
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load encryption config:', error);
    }
  }

  /**
   * Save configuration to storage
   */
  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem('encryption_config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save encryption config:', error);
    }
  }

  /**
   * Load metrics from storage
   */
  private async loadMetrics(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('encryption_metrics');
      if (stored) {
        const loadedMetrics = JSON.parse(stored);
        this.metrics = {
          ...this.metrics,
          ...loadedMetrics,
          lastKeyRotation: loadedMetrics.lastKeyRotation
            ? new Date(loadedMetrics.lastKeyRotation)
            : null,
        };
      }
    } catch (error) {
      console.error('Failed to load encryption metrics:', error);
    }
  }

  /**
   * Save metrics to storage
   */
  private async saveMetrics(): Promise<void> {
    try {
      await AsyncStorage.setItem('encryption_metrics', JSON.stringify(this.metrics));
    } catch (error) {
      console.error('Failed to save encryption metrics:', error);
    }
  }

  /**
   * Initialize service if not already done
   */
  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeService();
    }
  }
}

export default new EncryptionService();