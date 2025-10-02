import AppConfig from '../config/AppConfig';
import AudioRecordingService from './AudioRecordingService';
import AudioStorageService from './AudioStorageService';
import { callDetectionService } from './CallDetectionService';
import OpenAIService from './OpenAIService';
import TranscriptionService from './TranscriptionService';
import CommitmentTrackingService from './CommitmentTrackingService';
import ConversationAnalysisService from './ConversationAnalysisService';
import NotificationService from './NotificationService';
import RelationshipHealthService from './RelationshipHealthService';
import SearchService from './SearchService';
import EncryptionService from './EncryptionService';

export interface ServiceStatus {
  name: string;
  initialized: boolean;
  error?: string;
  dependencies: string[];
}

export interface InitializationReport {
  success: boolean;
  totalServices: number;
  initializedServices: number;
  failedServices: string[];
  serviceStatuses: ServiceStatus[];
  initializationTime: number;
}

class ServiceInitializer {
  private initializationOrder = [
    'AppConfig',
    'EncryptionService',
    'AudioRecordingService',
    'AudioStorageService',
    'OpenAIService',
    'TranscriptionService',
    'NotificationService',
    'CommitmentTrackingService',
    'ConversationAnalysisService',
    'RelationshipHealthService',
    'SearchService',
    'CallDetectionService',
  ];

  private serviceMap = {
    'AppConfig': AppConfig,
    'EncryptionService': EncryptionService,
    'AudioRecordingService': AudioRecordingService,
    'AudioStorageService': AudioStorageService,
    'OpenAIService': OpenAIService,
    'TranscriptionService': TranscriptionService,
    'NotificationService': NotificationService,
    'CommitmentTrackingService': CommitmentTrackingService,
    'ConversationAnalysisService': ConversationAnalysisService,
    'RelationshipHealthService': RelationshipHealthService,
    'SearchService': SearchService,
    'CallDetectionService': callDetectionService,
  };

  private serviceStatuses: Map<string, ServiceStatus> = new Map();

  /**
   * Initialize all services in the correct order
   */
  async initializeAllServices(): Promise<InitializationReport> {
    const startTime = Date.now();
    console.log('🚀 Starting service initialization...');

    let successCount = 0;
    const failedServices: string[] = [];

    // Initialize services in order
    for (const serviceName of this.initializationOrder) {
      const status = await this.initializeService(serviceName);
      this.serviceStatuses.set(serviceName, status);

      if (status.initialized) {
        successCount++;
        console.log(`✅ ${serviceName} initialized successfully`);
      } else {
        failedServices.push(serviceName);
        console.error(`❌ ${serviceName} failed to initialize: ${status.error}`);
      }
    }

    const endTime = Date.now();
    const initializationTime = endTime - startTime;

    const report: InitializationReport = {
      success: failedServices.length === 0,
      totalServices: this.initializationOrder.length,
      initializedServices: successCount,
      failedServices,
      serviceStatuses: Array.from(this.serviceStatuses.values()),
      initializationTime,
    };

    if (report.success) {
      console.log(`🎉 All services initialized successfully in ${initializationTime}ms`);
    } else {
      console.warn(`⚠️  Service initialization completed with ${failedServices.length} failures in ${initializationTime}ms`);
    }

    return report;
  }

  /**
   * Initialize a specific service
   */
  private async initializeService(serviceName: string): Promise<ServiceStatus> {
    const status: ServiceStatus = {
      name: serviceName,
      initialized: false,
      dependencies: this.getServiceDependencies(serviceName),
    };

    try {
      const service = this.serviceMap[serviceName as keyof typeof this.serviceMap];

      if (!service) {
        throw new Error(`Service ${serviceName} not found in service map`);
      }

      // Check if service has an initialize method
      if (typeof service.initialize === 'function') {
        await service.initialize();
      }

      // Perform service-specific initialization
      await this.performServiceSpecificInitialization(serviceName, service);

      status.initialized = true;
    } catch (error) {
      status.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return status;
  }

  /**
   * Perform service-specific initialization tasks
   */
  private async performServiceSpecificInitialization(serviceName: string, service: any): Promise<void> {
    switch (serviceName) {
      case 'AppConfig':
        // Load configuration
        if (!AppConfig.isConfigInitialized()) {
          await AppConfig.initialize();
        }
        break;

      case 'EncryptionService':
        // Verify encryption is working
        const testData = 'test-encryption-data';
        const encrypted = await EncryptionService.encryptData(testData);
        if (!encrypted) {
          throw new Error('Encryption test failed');
        }
        const decrypted = await EncryptionService.decryptData(encrypted);
        if (decrypted !== testData) {
          throw new Error('Encryption roundtrip test failed');
        }
        break;

      case 'OpenAIService':
        // Check if API key is configured
        const config = AppConfig.getOpenAIConfig();
        if (config.apiKey) {
          OpenAIService.setApiKey(config.apiKey);
        } else {
          console.warn('OpenAI API key not configured - AI features will be disabled');
        }
        break;

      case 'AudioRecordingService':
        // Test audio permissions (non-blocking)
        try {
          await AudioRecordingService.checkPermissions();
        } catch (error) {
          console.warn('Audio permissions not available:', error);
        }
        break;

      case 'NotificationService':
        // Apply notification settings from config
        const notificationConfig = AppConfig.getNotificationConfig();
        await NotificationService.updateSettings(notificationConfig);
        break;

      case 'SearchService':
        // Trigger initial index build (in background)
        setTimeout(() => {
          SearchService.rebuildIndex().catch(console.error);
        }, 1000);
        break;

      case 'CallDetectionService':
        // Initialize call detection
        await callDetectionService.initialize();
        break;

      default:
        // For other services, just ensure they exist
        if (!service) {
          throw new Error(`Service ${serviceName} is not available`);
        }
        break;
    }
  }

  /**
   * Get dependencies for a service
   */
  private getServiceDependencies(serviceName: string): string[] {
    const dependencies: Record<string, string[]> = {
      'AppConfig': [],
      'EncryptionService': ['AppConfig'],
      'AudioRecordingService': ['AppConfig'],
      'AudioStorageService': ['EncryptionService'],
      'OpenAIService': ['AppConfig'],
      'TranscriptionService': ['OpenAIService', 'AudioRecordingService'],
      'NotificationService': ['AppConfig'],
      'CommitmentTrackingService': ['OpenAIService', 'NotificationService'],
      'ConversationAnalysisService': ['OpenAIService'],
      'RelationshipHealthService': ['ConversationAnalysisService', 'CommitmentTrackingService'],
      'SearchService': ['TranscriptionService', 'CommitmentTrackingService', 'ConversationAnalysisService'],
      'CallDetectionService': ['AudioRecordingService', 'NotificationService'],
    };

    return dependencies[serviceName] || [];
  }

  /**
   * Get initialization status of all services
   */
  getServiceStatuses(): ServiceStatus[] {
    return Array.from(this.serviceStatuses.values());
  }

  /**
   * Check if a specific service is initialized
   */
  isServiceInitialized(serviceName: string): boolean {
    const status = this.serviceStatuses.get(serviceName);
    return status?.initialized || false;
  }

  /**
   * Get failed services
   */
  getFailedServices(): string[] {
    return Array.from(this.serviceStatuses.values())
      .filter(status => !status.initialized)
      .map(status => status.name);
  }

  /**
   * Reinitialize a specific service
   */
  async reinitializeService(serviceName: string): Promise<boolean> {
    console.log(`🔄 Reinitializing ${serviceName}...`);

    const status = await this.initializeService(serviceName);
    this.serviceStatuses.set(serviceName, status);

    if (status.initialized) {
      console.log(`✅ ${serviceName} reinitialized successfully`);
      return true;
    } else {
      console.error(`❌ ${serviceName} failed to reinitialize: ${status.error}`);
      return false;
    }
  }

  /**
   * Verify all critical services are running
   */
  verifyCriticalServices(): boolean {
    const criticalServices = [
      'AppConfig',
      'EncryptionService',
      'AudioRecordingService',
      'CallDetectionService',
    ];

    return criticalServices.every(serviceName =>
      this.isServiceInitialized(serviceName)
    );
  }

  /**
   * Get health check report
   */
  getHealthCheck(): {
    healthy: boolean;
    criticalServicesOk: boolean;
    totalServices: number;
    healthyServices: number;
    unhealthyServices: string[];
  } {
    const statuses = Array.from(this.serviceStatuses.values());
    const healthyServices = statuses.filter(s => s.initialized).length;
    const unhealthyServices = statuses.filter(s => !s.initialized).map(s => s.name);
    const criticalServicesOk = this.verifyCriticalServices();

    return {
      healthy: unhealthyServices.length === 0,
      criticalServicesOk,
      totalServices: statuses.length,
      healthyServices,
      unhealthyServices,
    };
  }

  /**
   * Cleanup all services
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up services...');

    for (const serviceName of this.initializationOrder.reverse()) {
      try {
        const service = this.serviceMap[serviceName as keyof typeof this.serviceMap];
        if (service && typeof service.cleanup === 'function') {
          await service.cleanup();
        }
      } catch (error) {
        console.error(`Failed to cleanup ${serviceName}:`, error);
      }
    }

    this.serviceStatuses.clear();
    console.log('✅ Service cleanup completed');
  }
}

export default new ServiceInitializer();