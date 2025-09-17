import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchContacts } from '../store/slices/contactsSlice';
import { fetchCommitments } from '../store/slices/commitmentsSlice';
import { useCallDetection } from '../hooks/useCallDetection';

interface HomeScreenProps {
  navigation: any; // TODO: Type this properly with navigation prop
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { contacts } = useAppSelector((state) => state.contacts);
  const { commitments } = useAppSelector((state) => state.commitments);
  const { isRecording } = useAppSelector((state) => state.recording);

  // Call detection hook
  const {
    isInitialized,
    isMonitoring,
    hasPermissions,
    isCallActive,
    error,
    initializeCallDetection,
    startMonitoring,
    stopMonitoring,
    requestPermissions,
  } = useCallDetection();

  useEffect(() => {
    // Load initial data
    dispatch(fetchContacts());
    dispatch(fetchCommitments());

    // Initialize call detection
    initializeCallDetection();
  }, [dispatch, initializeCallDetection]);

  const pendingCommitments = commitments.filter(c => c.status === 'pending');
  const overdueCommitments = commitments.filter(c => c.status === 'overdue');

  const handleStartRecording = () => {
    if (contacts.length === 0) {
      Alert.alert(
        'No Contacts',
        'Add some contacts first to start recording conversations.',
        [
          { text: 'Add Contact', onPress: () => navigation.navigate('Contacts') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    navigation.navigate('Recording');
  };

  const handleViewContacts = () => {
    navigation.navigate('Contacts');
  };

  const handleViewConversations = () => {
    navigation.navigate('Conversations');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to Relive</Text>
        <Text style={styles.subtitle}>
          Strengthen your relationships through meaningful conversations
        </Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{contacts.length}</Text>
          <Text style={styles.statLabel}>Contacts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pendingCommitments.length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{overdueCommitments.length}</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
      </View>

      {/* Call Detection Status */}
      {isCallActive && (
        <View style={styles.callActiveBanner}>
          <View style={styles.callActiveIndicator} />
          <Text style={styles.callActiveText}>Call in progress - Auto recording</Text>
        </View>
      )}

      {/* Recording Status */}
      {isRecording && !isCallActive && (
        <View style={styles.recordingBanner}>
          <View style={styles.recordingIndicator} />
          <Text style={styles.recordingText}>Manual recording in progress...</Text>
        </View>
      )}

      {/* Call Detection Status */}
      {isInitialized && (
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Auto-Detection:</Text>
            <View style={[styles.statusIndicator, isMonitoring ? styles.statusActive : styles.statusInactive]}>
              <Text style={[styles.statusText, isMonitoring ? styles.statusActiveText : styles.statusInactiveText]}>
                {isMonitoring ? 'ON' : 'OFF'}
              </Text>
            </View>
          </View>
          {!hasPermissions && (
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
              <Text style={styles.permissionButtonText}>Grant Permissions</Text>
            </TouchableOpacity>
          )}
          {hasPermissions && !isMonitoring && (
            <TouchableOpacity style={styles.enableButton} onPress={startMonitoring}>
              <Text style={styles.enableButtonText}>Enable Auto-Detection</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={handleStartRecording}
          disabled={isRecording}
        >
          <Text style={styles.primaryButtonText}>
            {isRecording ? 'Recording...' : 'Start Recording'}
          </Text>
        </TouchableOpacity>

        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleViewContacts}>
            <Text style={styles.secondaryButtonText}>Contacts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleViewConversations}>
            <Text style={styles.secondaryButtonText}>Conversations</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.recentActivity}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {pendingCommitments.length > 0 ? (
          <View>
            {pendingCommitments.slice(0, 3).map((commitment) => (
              <View key={commitment.id} style={styles.commitmentCard}>
                <Text style={styles.commitmentText}>{commitment.text}</Text>
                <Text style={styles.commitmentMeta}>
                  {commitment.whoCommitted === 'user' ? 'You promised' : 'They promised'}
                  {commitment.dueDate && ` • Due ${commitment.dueDate.toLocaleDateString()}`}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Start recording conversations to track commitments and insights
            </Text>
          </View>
        )}
      </View>

      {/* Getting Started Guide */}
      {contacts.length === 0 && (
        <View style={styles.gettingStarted}>
          <Text style={styles.sectionTitle}>Getting Started</Text>
          <View style={styles.stepsList}>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>Add your contacts</Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>Start recording a conversation</Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>Review AI insights and commitments</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  callActiveBanner: {
    backgroundColor: '#27ae60',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  callActiveIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginRight: 12,
  },
  callActiveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  recordingBanner: {
    backgroundColor: '#e74c3c',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginRight: 12,
  },
  recordingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  statusActive: {
    backgroundColor: '#27ae60',
  },
  statusInactive: {
    backgroundColor: '#95a5a6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusActiveText: {
    color: '#fff',
  },
  statusInactiveText: {
    color: '#fff',
  },
  permissionButton: {
    backgroundColor: '#f39c12',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  enableButton: {
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  enableButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#3498db',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#3498db',
  },
  secondaryButtonText: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: '600',
  },
  recentActivity: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  commitmentCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  commitmentText: {
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 4,
  },
  commitmentMeta: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  emptyState: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
  },
  gettingStarted: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  stepsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3498db',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 32,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 16,
  },
  stepText: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
  },
});

export default HomeScreen;