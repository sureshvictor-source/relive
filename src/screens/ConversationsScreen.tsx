import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { useAppSelector } from '../store';
import { Conversation } from '../types';
import ConversationAnalysisService, { ConversationAnalysis } from '../services/ConversationAnalysisService';
import CommitmentTrackingService, { Commitment } from '../services/CommitmentTrackingService';
import DatabaseService from '../services/DatabaseService';

interface ConversationsScreenProps {
  navigation: any;
}

const ConversationsScreen: React.FC<ConversationsScreenProps> = ({ navigation }) => {
  const { conversations } = useAppSelector((state) => state.conversations);
  const { contacts } = useAppSelector((state) => state.contacts);
  const [dbConversations, setDbConversations] = useState<any[]>([]); // SQLite conversations
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [conversationAnalysis, setConversationAnalysis] = useState<ConversationAnalysis | null>(null);
  const [conversationCommitments, setConversationCommitments] = useState<Commitment[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      await DatabaseService.initialize();
      const conversations = await DatabaseService.getConversations(100); // Load recent 100
      setDbConversations(conversations);
      console.log(`📱 Loaded ${conversations.length} conversations from SQLite`);
    } catch (error) {
      console.error('Failed to load conversations from SQLite:', error);
    }
  };

  const handleConversationPress = async (conversation: any) => {
    setSelectedConversation(conversation);
    
    // Load analysis data
    const analysis = ConversationAnalysisService.getAnalysisByConversation(conversation.id);
    setConversationAnalysis(analysis);
    
    // Load commitments from database
    const commitments = await DatabaseService.getCommitments({ conversationId: conversation.id });
    const mappedCommitments = commitments.map(c => ({
      ...c,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
      dueDate: c.dueDate ? new Date(c.dueDate) : undefined
    }));
    setConversationCommitments(mappedCommitments);
    
    setShowDetailModal(true);
  };

  const getContactName = (contactId: string): string => {
    const contact = contacts.find(c => c.id === contactId);
    return contact?.name || 'Unknown Contact';
  };

  const getEmotionalToneColor = (tone: string): string => {
    switch (tone) {
      case 'positive': return '#27ae60';
      case 'negative': return '#e74c3c';
      case 'mixed': return '#f39c12';
      default: return '#95a5a6';
    }
  };

  const renderConversation = ({ item }: { item: any }) => {
    const contactName = item.contactName || getContactName(item.contactId);
    const toneColor = getEmotionalToneColor(item.emotionalTone);
    
    // Handle both Redux conversation format and database format
    const startTime = item.startTime instanceof Date ? item.startTime : new Date(item.startTime);
    const duration = item.duration || 0;
    
    return (
      <TouchableOpacity 
        style={styles.conversationCard}
        onPress={() => handleConversationPress(item)}
      >
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationTitle}>
            📞 {contactName}
          </Text>
          <Text style={styles.conversationDate}>
            {startTime.toLocaleDateString()}
          </Text>
        </View>
        
        <Text style={styles.conversationSummary} numberOfLines={2}>
          {item.transcript ? item.transcript.slice(0, 120) + '...' : 'No transcript available'}
        </Text>
        
        <View style={styles.conversationMeta}>
          <Text style={styles.metaText}>
            ⏱️ {Math.floor(duration / 60)}m {Math.floor((duration % 60) / 1000)}s
          </Text>
          <View style={[styles.toneBadge, { backgroundColor: toneColor }]}>
            <Text style={styles.toneText}>{item.emotionalTone}</Text>
          </View>
        </View>
        
        <View style={styles.analysisPreview}>
          <Text style={styles.analysisText}>💬 Tap to view AI analysis & commitments</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailModal = () => {
    if (!selectedConversation) return null;

    const contactName = selectedConversation.contactName || getContactName(selectedConversation.contactId);
    const startTime = selectedConversation.startTime instanceof Date ? 
      selectedConversation.startTime : new Date(selectedConversation.startTime);
    const duration = selectedConversation.duration || 0;
    
    return (
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <ScrollView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📞 {contactName}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowDetailModal(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Call Details */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Call Details</Text>
            <Text style={styles.detailText}>Date: {startTime.toLocaleString()}</Text>
            <Text style={styles.detailText}>Duration: {Math.floor(duration / 60)}m {Math.floor((duration % 60) / 1000)}s</Text>
            <Text style={styles.detailText}>Tone: {selectedConversation.emotionalTone}</Text>
          </View>

          {/* Transcript */}
          {selectedConversation.transcript && (
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>📝 Transcript</Text>
              <ScrollView style={styles.transcriptContainer} nestedScrollEnabled>
                <Text style={styles.transcriptText}>{selectedConversation.transcript}</Text>
              </ScrollView>
            </View>
          )}

          {/* AI Analysis */}
          {conversationAnalysis && (
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>🤖 AI Analysis</Text>
              
              {/* Quality Score */}
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Conversation Quality:</Text>
                <Text style={styles.metricValue}>
                  {conversationAnalysis.conversationInsights.conversationQuality}/10
                </Text>
              </View>

              {/* Emotional Analysis */}
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Engagement Level:</Text>
                <Text style={styles.metricValue}>
                  {conversationAnalysis.emotionalAnalysis.engagementLevel}/10
                </Text>
              </View>

              {/* Key Topics */}
              {conversationAnalysis.conversationInsights.keyTopics.length > 0 && (
                <View style={styles.topicsContainer}>
                  <Text style={styles.metricLabel}>Key Topics:</Text>
                  <View style={styles.topicsWrapper}>
                    {conversationAnalysis.conversationInsights.keyTopics.map((topic, index) => (
                      <View key={index} style={styles.topicTag}>
                        <Text style={styles.topicText}>{topic}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Relationship Dynamics */}
              <View style={styles.dynamicsContainer}>
                <Text style={styles.metricLabel}>Relationship Dynamics:</Text>
                <Text style={styles.dynamicText}>
                  Support Level: {conversationAnalysis.conversationInsights.relationshipDynamics.supportLevel}/10
                </Text>
                <Text style={styles.dynamicText}>
                  Conflict Level: {conversationAnalysis.conversationInsights.relationshipDynamics.conflictLevel}/10
                </Text>
                <Text style={styles.dynamicText}>
                  Communication: {conversationAnalysis.conversationInsights.relationshipDynamics.dominance}
                </Text>
              </View>
            </View>
          )}

          {/* Commitments */}
          {conversationCommitments.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>🤝 Commitments ({conversationCommitments.length})</Text>
              {conversationCommitments.map((commitment, index) => (
                <View key={commitment.id} style={styles.commitmentCard}>
                  <View style={styles.commitmentHeader}>
                    <Text style={styles.commitmentText}>{commitment.text}</Text>
                    <View style={[styles.priorityBadge, { 
                      backgroundColor: commitment.priority === 'high' ? '#e74c3c' : 
                                     commitment.priority === 'medium' ? '#f39c12' : '#95a5a6' 
                    }]}>
                      <Text style={styles.priorityText}>{commitment.priority}</Text>
                    </View>
                  </View>
                  <Text style={styles.commitmentMeta}>
                    {commitment.whoCommitted === 'user' ? 'You' : contactName} committed
                    {commitment.dueDate && ` • Due: ${commitment.dueDate.toLocaleDateString()}`}
                  </Text>
                  <Text style={styles.commitmentStatus}>Status: {commitment.status}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </Modal>
    );
  };

  // Use database conversations if available, fallback to Redux conversations
  const displayConversations = dbConversations.length > 0 ? dbConversations : conversations;

  return (
    <View style={styles.container}>
      {displayConversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Donna will automatically record and analyze your calls when enabled
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.startButtonText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
      
      {renderDetailModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  listContainer: {
    padding: 16,
  },
  conversationCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  conversationDate: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  conversationSummary: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
    marginBottom: 12,
  },
  conversationMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#95a5a6',
  },
  toneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  toneText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  analysisPreview: {
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
  },
  analysisText: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6c757d',
    fontWeight: 'bold',
  },
  detailSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 4,
  },
  
  // Transcript Styles
  transcriptContainer: {
    maxHeight: 200,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  transcriptText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  
  // Analysis Styles
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: 'bold',
  },
  topicsContainer: {
    marginBottom: 12,
  },
  topicsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  topicTag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    margin: 2,
  },
  topicText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  dynamicsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  dynamicText: {
    fontSize: 13,
    color: '#495057',
    marginBottom: 4,
  },
  
  // Commitment Styles
  commitmentCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  commitmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  commitmentText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  commitmentMeta: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  commitmentStatus: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConversationsScreen;