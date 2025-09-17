import { useEffect, useState, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { callDetectionService } from '../services/CallDetectionService';
import { useAppSelector } from '../store';

export interface CallDetectionState {
  isInitialized: boolean;
  isMonitoring: boolean;
  hasPermissions: boolean;
  isCallActive: boolean;
  error: string | null;
}

export interface CallDetectionActions {
  initializeCallDetection: () => Promise<boolean>;
  startMonitoring: () => Promise<boolean>;
  stopMonitoring: () => Promise<boolean>;
  requestPermissions: () => Promise<boolean>;
  checkCallStatus: () => Promise<boolean>;
}

export function useCallDetection(): CallDetectionState & CallDetectionActions {
  const [state, setState] = useState<CallDetectionState>({
    isInitialized: false,
    isMonitoring: false,
    hasPermissions: false,
    isCallActive: false,
    error: null,
  });

  const settings = useAppSelector((state) => state.settings);

  /**
   * Initialize call detection service
   */
  const initializeCallDetection = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, error: null }));

      const initialized = await callDetectionService.initialize();

      if (initialized) {
        const hasPermissions = await callDetectionService.requestPermissions();

        setState(prev => ({
          ...prev,
          isInitialized: initialized,
          hasPermissions
        }));

        return initialized && hasPermissions;
      }

      setState(prev => ({
        ...prev,
        isInitialized: false,
        error: 'Failed to initialize call detection'
      }));

      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, []);

  /**
   * Start monitoring for calls
   */
  const startMonitoring = useCallback(async (): Promise<boolean> => {
    try {
      if (!state.isInitialized) {
        const initialized = await initializeCallDetection();
        if (!initialized) {
          return false;
        }
      }

      if (!state.hasPermissions) {
        Alert.alert(
          'Permissions Required',
          'Relive needs permission to detect phone calls for automatic recording. Please grant the required permissions.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Grant Permissions',
              onPress: async () => {
                await requestPermissions();
              }
            }
          ]
        );
        return false;
      }

      const success = await callDetectionService.startMonitoring();

      setState(prev => ({
        ...prev,
        isMonitoring: success,
        error: success ? null : 'Failed to start monitoring'
      }));

      if (success) {
        console.log('📞 Call detection monitoring started');
      }

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [state.isInitialized, state.hasPermissions]);

  /**
   * Stop monitoring for calls
   */
  const stopMonitoring = useCallback(async (): Promise<boolean> => {
    try {
      const success = await callDetectionService.stopMonitoring();

      setState(prev => ({
        ...prev,
        isMonitoring: !success,
        error: success ? null : 'Failed to stop monitoring'
      }));

      if (success) {
        console.log('📞 Call detection monitoring stopped');
      }

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, []);

  /**
   * Request necessary permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const hasPermissions = await callDetectionService.requestPermissions();

      setState(prev => ({ ...prev, hasPermissions }));

      if (!hasPermissions) {
        Alert.alert(
          'Permissions Denied',
          Platform.select({
            ios: 'Please go to Settings > Relive and enable microphone access to automatically detect and record calls.',
            android: 'Please go to Settings > Apps > Relive > Permissions and enable Phone and Microphone access.',
          }) || 'Please enable required permissions in your device settings.',
          [{ text: 'OK' }]
        );
      }

      return hasPermissions;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, []);

  /**
   * Check if there's currently an active call
   */
  const checkCallStatus = useCallback(async (): Promise<boolean> => {
    try {
      const isActive = await callDetectionService.isCallActive();

      setState(prev => ({ ...prev, isCallActive: isActive }));

      return isActive;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, []);

  /**
   * Auto-start monitoring when app loads (if user has enabled auto-recording)
   */
  useEffect(() => {
    const autoStartMonitoring = async () => {
      // Only auto-start if user has auto-recording enabled in settings
      if (settings.privacy.localOnly && !state.isMonitoring) {
        const initialized = await initializeCallDetection();
        if (initialized) {
          await startMonitoring();
        }
      }
    };

    autoStartMonitoring();
  }, [settings.privacy.localOnly]);

  /**
   * Periodically check call status when monitoring is active
   */
  useEffect(() => {
    if (!state.isMonitoring) {
      return;
    }

    const interval = setInterval(() => {
      checkCallStatus();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [state.isMonitoring, checkCallStatus]);

  /**
   * Show user-friendly notifications for call detection status
   */
  useEffect(() => {
    if (state.error) {
      console.error('Call Detection Error:', state.error);
    }
  }, [state.error]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (state.isMonitoring) {
        callDetectionService.stopMonitoring();
      }
    };
  }, []);

  return {
    ...state,
    initializeCallDetection,
    startMonitoring,
    stopMonitoring,
    requestPermissions,
    checkCallStatus,
  };
}