import { Platform, Alert, Linking, AppState } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, Permission } from 'react-native-permissions';

export interface PermissionStatus {
  granted: boolean;
  denied: boolean;
  blocked: boolean;
  unavailable: boolean;
  limited?: boolean;
}

export interface PermissionRequest {
  permission: Permission;
  title: string;
  message: string;
  buttonPositive?: string;
  buttonNegative?: string;
  isRequired: boolean;
  feature: string;
}

export interface AppPermissions {
  microphone: PermissionStatus;
  phone: PermissionStatus;
  contacts: PermissionStatus;
  notifications: PermissionStatus;
  storage: PermissionStatus;
  camera?: PermissionStatus;
}

class PermissionsService {
  private appStateSubscription: any;
  private permissionCheckInterval: any;

  constructor() {
    this.setupAppStateListener();
  }

  /**
   * Setup app state listener to check permissions when app becomes active
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Check permissions when app becomes active (user might have changed them in settings)
        this.schedulePermissionCheck();
      }
    });
  }

  /**
   * Schedule a permission check with debouncing
   */
  private schedulePermissionCheck(): void {
    if (this.permissionCheckInterval) {
      clearTimeout(this.permissionCheckInterval);
    }

    this.permissionCheckInterval = setTimeout(() => {
      this.checkAllPermissions().then(permissions => {
        console.log('📱 Updated permissions status:', permissions);
      });
    }, 1000); // 1 second delay
  }

  /**
   * Get platform-specific permission mappings
   */
  private getPermissionMappings(): { [key: string]: Permission } {
    const iOS = {
      microphone: PERMISSIONS.IOS.MICROPHONE,
      phone: PERMISSIONS.IOS.CONTACTS, // iOS doesn't have direct phone permission
      contacts: PERMISSIONS.IOS.CONTACTS,
      notifications: PERMISSIONS.IOS.NOTIFICATIONS,
      camera: PERMISSIONS.IOS.CAMERA,
    };

    const android = {
      microphone: PERMISSIONS.ANDROID.RECORD_AUDIO,
      phone: PERMISSIONS.ANDROID.READ_PHONE_STATE,
      contacts: PERMISSIONS.ANDROID.READ_CONTACTS,
      notifications: PERMISSIONS.ANDROID.POST_NOTIFICATIONS, // Android 13+
      storage: PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
      camera: PERMISSIONS.ANDROID.CAMERA,
    };

    return Platform.OS === 'ios' ? iOS : android;
  }

  /**
   * Convert native permission result to our status format
   */
  private convertPermissionResult(result: string): PermissionStatus {
    return {
      granted: result === RESULTS.GRANTED,
      denied: result === RESULTS.DENIED,
      blocked: result === RESULTS.BLOCKED,
      unavailable: result === RESULTS.UNAVAILABLE,
      limited: result === RESULTS.LIMITED,
    };
  }

  /**
   * Check a single permission
   */
  async checkPermission(permissionType: keyof AppPermissions): Promise<PermissionStatus> {
    try {
      const permissions = this.getPermissionMappings();
      const permission = permissions[permissionType];

      if (!permission) {
        return {
          granted: false,
          denied: true,
          blocked: false,
          unavailable: true,
        };
      }

      const result = await check(permission);
      return this.convertPermissionResult(result);
    } catch (error) {
      console.error(`Error checking ${permissionType} permission:`, error);
      return {
        granted: false,
        denied: true,
        blocked: false,
        unavailable: true,
      };
    }
  }

  /**
   * Request a single permission
   */
  async requestPermission(permissionType: keyof AppPermissions): Promise<PermissionStatus> {
    try {
      const permissions = this.getPermissionMappings();
      const permission = permissions[permissionType];

      if (!permission) {
        return {
          granted: false,
          denied: true,
          blocked: false,
          unavailable: true,
        };
      }

      const result = await request(permission);
      return this.convertPermissionResult(result);
    } catch (error) {
      console.error(`Error requesting ${permissionType} permission:`, error);
      return {
        granted: false,
        denied: true,
        blocked: false,
        unavailable: false,
      };
    }
  }

  /**
   * Check all required permissions
   */
  async checkAllPermissions(): Promise<AppPermissions> {
    const [microphone, phone, contacts, notifications, storage, camera] = await Promise.all([
      this.checkPermission('microphone'),
      this.checkPermission('phone'),
      this.checkPermission('contacts'),
      this.checkPermission('notifications'),
      Platform.OS === 'android' ? this.checkPermission('storage') : Promise.resolve({ granted: true, denied: false, blocked: false, unavailable: false }),
      this.checkPermission('camera'),
    ]);

    const permissions: AppPermissions = {
      microphone,
      phone,
      contacts,
      notifications,
      storage,
    };

    if (Platform.OS === 'android') {
      permissions.camera = camera;
    }

    return permissions;
  }

  /**
   * Request multiple permissions with user-friendly flow
   */
  async requestPermissionsFlow(): Promise<AppPermissions> {
    const permissionRequests: PermissionRequest[] = [
      {
        permission: this.getPermissionMappings().microphone,
        title: '🎤 Microphone Access',
        message: 'Donna needs microphone access to record and analyze your conversations for relationship insights.',
        isRequired: true,
        feature: 'Call Recording & Analysis',
      },
      {
        permission: this.getPermissionMappings().phone,
        title: '📞 Phone Access',
        message: Platform.OS === 'ios' 
          ? 'Donna needs access to detect when calls start and end.'
          : 'Donna needs phone access to detect incoming and outgoing calls automatically.',
        isRequired: true,
        feature: 'Automatic Call Detection',
      },
      {
        permission: this.getPermissionMappings().contacts,
        title: '👥 Contacts Access',
        message: 'Donna can identify callers and provide personalized relationship insights by accessing your contacts.',
        isRequired: false,
        feature: 'Contact Recognition',
      },
      {
        permission: this.getPermissionMappings().notifications,
        title: '🔔 Notification Access',
        message: 'Donna can send you reminders about commitments and provide call analysis updates.',
        isRequired: false,
        feature: 'Smart Reminders',
      },
    ];

    // Add Android-specific permissions
    if (Platform.OS === 'android') {
      permissionRequests.push({
        permission: this.getPermissionMappings().storage,
        title: '💾 Storage Access',
        message: 'Donna needs storage access to save call recordings and analysis data securely.',
        isRequired: true,
        feature: 'Data Storage',
      });
    }

    const finalPermissions: Partial<AppPermissions> = {};

    for (const permissionRequest of permissionRequests) {
      const permissionKey = this.getPermissionKey(permissionRequest.permission);
      
      // Check if already granted
      const currentStatus = await this.checkPermission(permissionKey);
      
      if (currentStatus.granted) {
        finalPermissions[permissionKey] = currentStatus;
        continue;
      }

      // Show permission explanation dialog
      const shouldRequest = await this.showPermissionDialog(permissionRequest);
      
      if (!shouldRequest && !permissionRequest.isRequired) {
        finalPermissions[permissionKey] = currentStatus;
        continue;
      }

      // Request the permission
      const result = await this.requestPermission(permissionKey);
      finalPermissions[permissionKey] = result;

      // Handle blocked permissions
      if (result.blocked && permissionRequest.isRequired) {
        const shouldOpenSettings = await this.showBlockedPermissionDialog(permissionRequest);
        
        if (shouldOpenSettings) {
          await this.openAppSettings();
          // Wait and recheck
          await this.delay(2000);
          finalPermissions[permissionKey] = await this.checkPermission(permissionKey);
        }
      }
    }

    return finalPermissions as AppPermissions;
  }

  /**
   * Get permission key from Permission object
   */
  private getPermissionKey(permission: Permission): keyof AppPermissions {
    const permissions = this.getPermissionMappings();
    
    for (const [key, value] of Object.entries(permissions)) {
      if (value === permission) {
        return key as keyof AppPermissions;
      }
    }
    
    return 'microphone'; // Default fallback
  }

  /**
   * Show permission request dialog
   */
  private showPermissionDialog(permissionRequest: PermissionRequest): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        permissionRequest.title,
        `${permissionRequest.message}\n\n📱 Feature: ${permissionRequest.feature}`,
        [
          {
            text: permissionRequest.buttonNegative || (permissionRequest.isRequired ? 'Not Now' : 'Skip'),
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: permissionRequest.buttonPositive || 'Allow',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Show blocked permission dialog
   */
  private showBlockedPermissionDialog(permissionRequest: PermissionRequest): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Permission Required',
        `${permissionRequest.feature} requires ${permissionRequest.title.replace(/[^\w\s]/gi, '')} permission.\n\nTo enable this feature, please go to Settings and allow the permission manually.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Open Settings',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Open app settings
   */
  async openAppSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('Failed to open app settings:', error);
      Alert.alert(
        'Settings Unavailable',
        'Please manually go to your device Settings > Apps > Donna to manage permissions.'
      );
    }
  }

  /**
   * Check if core permissions are granted
   */
  async hasRequiredPermissions(): Promise<boolean> {
    const permissions = await this.checkAllPermissions();
    
    // Core required permissions
    const corePermissions = [
      permissions.microphone.granted,
      permissions.phone.granted,
    ];

    // Android also requires storage
    if (Platform.OS === 'android') {
      corePermissions.push(permissions.storage.granted);
    }

    return corePermissions.every(permission => permission);
  }

  /**
   * Get permissions summary for display
   */
  async getPermissionsSummary(): Promise<{
    total: number;
    granted: number;
    missing: string[];
    recommendations: string[];
  }> {
    const permissions = await this.checkAllPermissions();
    const permissionEntries = Object.entries(permissions);
    
    const total = permissionEntries.length;
    const granted = permissionEntries.filter(([, status]) => status.granted).length;
    const missing: string[] = [];
    const recommendations: string[] = [];

    permissionEntries.forEach(([key, status]) => {
      if (!status.granted) {
        const displayName = this.getPermissionDisplayName(key);
        missing.push(displayName);
        
        if (status.blocked) {
          recommendations.push(`${displayName}: Go to Settings to enable`);
        } else {
          recommendations.push(`${displayName}: Tap to allow`);
        }
      }
    });

    return {
      total,
      granted,
      missing,
      recommendations,
    };
  }

  /**
   * Get user-friendly permission display name
   */
  private getPermissionDisplayName(permission: string): string {
    const displayNames: { [key: string]: string } = {
      microphone: 'Microphone',
      phone: 'Phone',
      contacts: 'Contacts',
      notifications: 'Notifications',
      storage: 'Storage',
      camera: 'Camera',
    };

    return displayNames[permission] || permission;
  }

  /**
   * Show permissions onboarding flow
   */
  async showOnboardingFlow(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        '👋 Welcome to Donna!',
        'Donna helps you build stronger relationships by analyzing your conversations and tracking commitments.\n\nTo get started, we need a few permissions to provide the best experience.',
        [
          {
            text: 'Maybe Later',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Continue Setup',
            onPress: async () => {
              const permissions = await this.requestPermissionsFlow();
              const hasRequired = await this.hasRequiredPermissions();
              resolve(hasRequired);
            },
          },
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Validate specific feature permissions
   */
  async validateFeaturePermissions(feature: 'recording' | 'contacts' | 'notifications'): Promise<{
    canUse: boolean;
    missingPermissions: string[];
    instructions: string[];
  }> {
    const permissions = await this.checkAllPermissions();
    let requiredPermissions: (keyof AppPermissions)[] = [];
    let instructions: string[] = [];

    switch (feature) {
      case 'recording':
        requiredPermissions = ['microphone', 'phone'];
        if (Platform.OS === 'android') {
          requiredPermissions.push('storage');
        }
        instructions = [
          'Enable Microphone to record conversations',
          'Enable Phone to detect calls automatically',
        ];
        if (Platform.OS === 'android') {
          instructions.push('Enable Storage to save recordings');
        }
        break;

      case 'contacts':
        requiredPermissions = ['contacts'];
        instructions = ['Enable Contacts to identify callers'];
        break;

      case 'notifications':
        requiredPermissions = ['notifications'];
        instructions = ['Enable Notifications for reminders and updates'];
        break;
    }

    const missingPermissions = requiredPermissions.filter(
      perm => !permissions[perm]?.granted
    ).map(perm => this.getPermissionDisplayName(perm));

    const canUse = missingPermissions.length === 0;

    return {
      canUse,
      missingPermissions,
      instructions: canUse ? [] : instructions,
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    
    if (this.permissionCheckInterval) {
      clearTimeout(this.permissionCheckInterval);
    }
  }

  /**
   * Get permission status color for UI
   */
  getPermissionStatusColor(status: PermissionStatus): string {
    if (status.granted) return '#10b981'; // Green
    if (status.blocked) return '#ef4444'; // Red
    if (status.denied) return '#f59e0b'; // Orange
    return '#6b7280'; // Gray
  }

  /**
   * Get permission status icon for UI
   */
  getPermissionStatusIcon(status: PermissionStatus): string {
    if (status.granted) return 'check-circle';
    if (status.blocked) return 'block';
    if (status.denied) return 'warning';
    return 'help-outline';
  }

  /**
   * Get permission status text for UI
   */
  getPermissionStatusText(status: PermissionStatus): string {
    if (status.granted) return 'Allowed';
    if (status.blocked) return 'Blocked';
    if (status.denied) return 'Denied';
    if (status.unavailable) return 'Not Available';
    return 'Unknown';
  }
}

export default new PermissionsService();