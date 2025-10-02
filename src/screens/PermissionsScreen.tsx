import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import {
  Header,
  Card,
  Button,
  ListItem,
  Avatar,
  Badge,
  Icon,
  CheckBox,
  Divider,
} from 'react-native-elements';
import PermissionsService, { AppPermissions, PermissionStatus } from '../services/PermissionsService';

interface PermissionsScreenProps {
  navigation: any;
}

interface PermissionItem {
  key: keyof AppPermissions;
  title: string;
  description: string;
  reason: string;
  icon: string;
  critical: boolean;
  feature: string;
}

const PermissionsScreen: React.FC<PermissionsScreenProps> = ({ navigation }) => {
  const [permissions, setPermissions] = useState<AppPermissions>({
    microphone: { granted: false, denied: false, blocked: false, unavailable: false },
    phone: { granted: false, denied: false, blocked: false, unavailable: false },
    contacts: { granted: false, denied: false, blocked: false, unavailable: false },
    storage: { granted: false, denied: false, blocked: false, unavailable: false },
    notifications: { granted: false, denied: false, blocked: false, unavailable: false },
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [isRequestingAll, setIsRequestingAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const permissionItems: PermissionItem[] = [
    {
      key: 'microphone',
      title: 'Microphone Access',
      description: 'Record call audio for transcription and insights',
      reason: 'Essential for capturing call conversations',
      icon: 'mic',
      critical: true,
      feature: 'Call Recording & Analysis',
    },
    {
      key: 'phone',
      title: 'Phone State Access',
      description: 'Detect incoming and outgoing calls automatically',
      reason: 'Required to know when calls start and end',
      icon: 'phone',
      critical: true,
      feature: 'Automatic Call Detection',
    },
    {
      key: 'contacts',
      title: 'Contacts Access',
      description: 'Match phone numbers with contact names',
      reason: 'Provides context and better insights',
      icon: 'contacts',
      critical: false,
      feature: 'Contact Recognition',
    },
    {
      key: 'notifications',
      title: 'Notifications',
      description: 'Alert you about insights and call summaries',
      reason: 'Keep you informed about important findings',
      icon: 'notifications',
      critical: false,
      feature: 'Smart Reminders',
    },
  ];

  // Add storage permission for Android
  if (Platform.OS === 'android') {
    permissionItems.push({
      key: 'storage',
      title: 'Storage Access',
      description: 'Save call recordings and encrypted transcripts',
      reason: 'Store your data securely on device',
      icon: 'storage',
      critical: true,
      feature: 'Data Storage',
    });
  }

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    try {
      const allPermissions = await PermissionsService.checkAllPermissions();
      setPermissions(allPermissions);
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const getPermissionStatusText = (status: PermissionStatus): string => {
    return PermissionsService.getPermissionStatusText(status);
  };

  const getPermissionStatusColor = (status: PermissionStatus): string => {
    return PermissionsService.getPermissionStatusColor(status);
  };

  const getPermissionStatusIcon = (status: PermissionStatus): string => {
    return PermissionsService.getPermissionStatusIcon(status);
  };

  const requestPermission = async (item: PermissionItem) => {
    try {
      const currentStatus = permissions[item.key];
      
      if (currentStatus.blocked) {
        Alert.alert(
          'Permission Blocked',
          `${item.title} was previously denied. To enable it, please:\n\n1. Open Settings\n2. Go to Apps → Donna\n3. Enable "${item.title}"\n4. Return to Donna`,
          [
            { text: 'Continue Without', style: 'cancel', onPress: () => handleSkipPermission(item) },
            { text: 'Open Settings', onPress: () => PermissionsService.openAppSettings() },
          ]
        );
        return false;
      }

      const result = await PermissionsService.requestPermission(item.key);
      
      // Update permissions state
      setPermissions(prev => ({
        ...prev,
        [item.key]: result,
      }));

      if (result.blocked || result.denied) {
        if (item.critical) {
          Alert.alert(
            'Critical Permission Required',
            `${item.title} is essential for Donna's core functionality. Without this permission, key features won't work.`,
            [
              { text: 'Try Again', onPress: () => requestPermission(item) },
              { text: 'Open Settings', onPress: () => PermissionsService.openAppSettings() },
              { text: 'Continue Anyway', style: 'destructive', onPress: () => handleSkipPermission(item) },
            ]
          );
        } else {
          Alert.alert(
            'Permission Optional',
            `${item.title} enhances your Donna experience but isn't required. You can enable it later in Settings.`,
            [
              { text: 'Continue Without', style: 'default' },
              { text: 'Open Settings', onPress: () => PermissionsService.openAppSettings() },
            ]
          );
        }
        return false;
      }

      return result.granted;
    } catch (error) {
      console.error(`Error requesting ${item.key} permission:`, error);

      Alert.alert(
        'Permission Error',
        `Unable to request ${item.title}. This might be due to device restrictions. You can enable it manually in Settings.`,
        [
          { text: 'Continue', style: 'default' },
          { text: 'Open Settings', onPress: () => PermissionsService.openAppSettings() },
        ]
      );
      return false;
    }
  };

  const handleSkipPermission = (item: PermissionItem) => {
    setPermissions(prev => ({
      ...prev,
      [item.key]: { granted: false, denied: true, blocked: false, unavailable: false },
    }));
  };

  const requestAllPermissions = async () => {
    setIsRequestingAll(true);

    try {
      // Use the comprehensive permissions flow from the service
      const finalPermissions = await PermissionsService.requestPermissionsFlow();
      setPermissions(finalPermissions);
      
      // Check if we have required permissions
      const hasRequired = await PermissionsService.hasRequiredPermissions();
      
      if (hasRequired) {
        Alert.alert(
          'Setup Complete! 🎉',
          'Donna is ready to record and analyze your calls.',
          [
            {
              text: 'Get Started',
              onPress: () => navigation.replace('Dashboard'),
            },
          ]
        );
      } else {
        Alert.alert(
          'Setup Incomplete',
          'Some required permissions are still missing. You can continue with limited functionality or set them up later in Settings.',
          [
            { text: 'Continue Anyway', onPress: () => navigation.replace('Dashboard') },
            { text: 'Retry Setup', onPress: requestAllPermissions },
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting all permissions:', error);
      Alert.alert(
        'Permission Error',
        'There was an error setting up permissions. You can try again or continue with limited functionality.'
      );
    } finally {
      setIsRequestingAll(false);
      setCurrentStep(0);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkAllPermissions();
    setRefreshing(false);
  };

  const allCriticalGranted = permissionItems
    .filter(item => item.critical)
    .every(item => permissions[item.key]?.granted === true);

  const renderPermissionItem = (item: PermissionItem, index: number) => {
    const status = permissions[item.key];
    const isActive = isRequestingAll && currentStep === index;
    const statusColor = getPermissionStatusColor(status);
    const statusIcon = getPermissionStatusIcon(status);
    const statusText = getPermissionStatusText(status);

    return (
      <Card key={item.key} containerStyle={[
        styles.permissionCard,
        isActive && styles.activeCard,
        status?.granted && styles.grantedCard,
      ]}>
        <ListItem containerStyle={styles.listContainer}>
          <Avatar
            rounded
            icon={{
              name: item.icon,
              type: 'material',
              color: status?.granted ? '#10b981' : '#6366f1'
            }}
            backgroundColor={status?.granted ? '#d1fae5' : '#e0e7ff'}
            size="medium"
          />

          <ListItem.Content>
            <View style={styles.permissionHeader}>
              <ListItem.Title style={styles.permissionTitle}>
                {item.title}
              </ListItem.Title>
              {item.critical && (
                <Text style={styles.criticalBadge}>REQUIRED</Text>
              )}
            </View>

            <ListItem.Subtitle style={styles.permissionDescription}>
              {item.description}
            </ListItem.Subtitle>

            <Text style={styles.permissionReason}>
              Why needed: {item.reason}
            </Text>
            
            <Text style={styles.featureText}>
              Feature: {item.feature}
            </Text>
          </ListItem.Content>
        </ListItem>

        <Divider style={styles.divider} />

        <View style={styles.permissionActions}>
          <View style={styles.statusContainer}>
            <Avatar
              rounded
              icon={{
                name: statusIcon,
                type: 'material',
                color: '#fff'
              }}
              backgroundColor={statusColor}
              size="small"
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusText}
            </Text>
          </View>

          {!status?.granted && (
            <Button
              title={status?.blocked ? 'Open Settings' : 'Grant'}
              buttonStyle={[styles.permissionButton, {
                backgroundColor: status?.blocked ? '#f59e0b' : '#6366f1'
              }]}
              onPress={() => status?.blocked ? PermissionsService.openAppSettings() : requestPermission(item)}
            />
          )}
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        centerComponent={{
          text: 'Setup Donna 🤖',
          style: { color: '#fff', fontSize: 20, fontWeight: 'bold' }
        }}
        leftComponent={{
          icon: 'arrow-back',
          color: '#fff',
          onPress: () => navigation.goBack()
        }}
        backgroundColor="#6366f1"
      />

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Card containerStyle={styles.introCard}>
          <Text h4 style={styles.introTitle}>
            Grant permissions to unlock AI-powered call insights
          </Text>
          <Text style={styles.introText}>
            Donna needs these permissions to provide intelligent call insights and keep your data secure.
          </Text>
        </Card>

        {permissionItems.map((item, index) => renderPermissionItem(item, index))}

        <Card containerStyle={styles.privacyCard}>
          <Text h4 style={styles.sectionTitle}>
            🔒 Privacy & Security
          </Text>
          <View style={styles.privacyList}>
            <CheckBox
              title="All call recordings are encrypted and stored locally"
              checked={true}
              disabled={true}
              checkedColor="#10b981"
              containerStyle={styles.checkboxContainer}
              textStyle={styles.checkboxText}
            />
            <CheckBox
              title="Transcripts are processed securely using OpenAI"
              checked={true}
              disabled={true}
              checkedColor="#10b981"
              containerStyle={styles.checkboxContainer}
              textStyle={styles.checkboxText}
            />
            <CheckBox
              title="No data is shared without your consent"
              checked={true}
              disabled={true}
              checkedColor="#10b981"
              containerStyle={styles.checkboxContainer}
              textStyle={styles.checkboxText}
            />
            <CheckBox
              title="You can delete all data at any time"
              checked={true}
              disabled={true}
              checkedColor="#10b981"
              containerStyle={styles.checkboxContainer}
              textStyle={styles.checkboxText}
            />
          </View>
        </Card>

        <View style={styles.actionButtons}>
          <Button
            title={isRequestingAll ? 'Setting up...' : 'Grant All Permissions'}
            buttonStyle={styles.primaryButton}
            loading={isRequestingAll}
            onPress={requestAllPermissions}
          />

          {allCriticalGranted ? (
            <Button
              title="Continue to Dashboard"
              type="outline"
              buttonStyle={styles.secondaryButton}
              titleStyle={{ color: '#6366f1' }}
              onPress={() => navigation.replace('Dashboard')}
            />
          ) : (
            <Button
              title="Skip Setup"
              type="clear"
              titleStyle={{ color: '#6b7280' }}
              onPress={() => navigation.replace('Dashboard')}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  introCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#e0e7ff',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  introTitle: {
    color: '#1e1b4b',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  introText: {
    color: '#3730a3',
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionCard: {
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeCard: {
    borderColor: '#6366f1',
    backgroundColor: '#f8faff',
  },
  grantedCard: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  listContainer: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  permissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  criticalBadge: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    textAlign: 'center',
    overflow: 'hidden',
  },
  permissionDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
    lineHeight: 18,
  },
  permissionReason: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    lineHeight: 16,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  divider: {
    backgroundColor: '#e5e7eb',
    height: 1,
    marginVertical: 12,
  },
  permissionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  permissionButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  privacyCard: {
    borderRadius: 12,
    marginVertical: 16,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  sectionTitle: {
    color: '#1f2937',
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  privacyList: {
    marginTop: 8,
  },
  checkboxContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginLeft: 0,
    marginRight: 0,
    paddingVertical: 4,
  },
  checkboxText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: 'normal',
    marginLeft: 8,
  },
  actionButtons: {
    paddingVertical: 24,
    paddingBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  secondaryButton: {
    borderColor: '#6366f1',
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 16,
  },
});

export default PermissionsScreen;