import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import {
  Header,
  Card,
  Button,
  Text,
  Avatar,
  ListItem,
  Badge,
  Icon,
  FAB,
} from 'react-native-elements';
import { CallRecord, CallInsight, CallAnalytics } from '../types/CallTypes';
import { useAppSelector } from '../store';
import ConversationAnalysisService from '../services/ConversationAnalysisService';
import CommitmentTrackingService from '../services/CommitmentTrackingService';
import { callDetectionService } from '../services/CallDetectionService';
import DatabaseService from '../services/DatabaseService';

interface DashboardProps {
  navigation: any;
}

const DashboardScreen: React.FC<DashboardProps> = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [recentCalls, setRecentCalls] = useState<CallRecord[]>([]);
  const [insights, setInsights] = useState<CallInsight[]>([]);
  const [analytics, setAnalytics] = useState<CallAnalytics | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [relationshipMetrics, setRelationshipMetrics] = useState<any>(null);
  const [recentCommitments, setRecentCommitments] = useState<any[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Get data from Redux store
  const { conversations } = useAppSelector((state) => state.conversations);
  const { contacts } = useAppSelector((state) => state.contacts);

  useEffect(() => {
    loadDashboardData();
    checkPermissions();
    checkMonitoringStatus();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Initialize database
      await DatabaseService.initialize();
      
      // Load database statistics for accurate metrics
      const dbStats = await DatabaseService.getStatistics();
      const dbConversations = await DatabaseService.getConversations(50); // Get recent 50
      const dbCommitments = await DatabaseService.getCommitments({ limit: 100 });
      
      // Load conversation analyses from memory (since they're complex objects)
      const analyses = ConversationAnalysisService.getAnalyses();
      
      // Load commitment stats
      const commitmentStats = CommitmentTrackingService.getCommitmentStats();
      const upcomingCommitments = CommitmentTrackingService.getUpcomingCommitments(7);
      
      // Calculate relationship metrics using database data
      const totalConversations = dbStats.totalConversations || conversations.length;
      const totalContacts = dbStats.totalContacts || contacts.length;
      const avgQuality = analyses.length > 0 
        ? analyses.reduce((sum, a) => sum + a.conversationInsights.conversationQuality, 0) / analyses.length 
        : 0;

      // Calculate average duration from database conversations
      const averageCallDuration = dbConversations.length > 0
        ? dbConversations.reduce((sum, c) => sum + c.duration, 0) / dbConversations.length / 1000 / 60
        : conversations.length > 0 
        ? conversations.reduce((sum, c) => sum + c.duration, 0) / conversations.length / 1000 / 60
        : 0;

      setAnalytics({
        totalCalls: totalConversations,
        weeklyStats: [{ calls: Math.ceil(totalConversations / 4) }], // Estimate
        averageCallDuration,
        totalContacts
      } as any);

      setRelationshipMetrics({
        totalRelationships: totalContacts,
        avgConversationQuality: avgQuality,
        totalCommitments: dbStats.totalCommitments || commitmentStats.totalCommitments,
        completionRate: dbStats.totalCommitments > 0 ? 
          (dbStats.completedCommitments / dbStats.totalCommitments) * 100 : 
          commitmentStats.completionRate,
        upcomingCommitments: upcomingCommitments.length
      });

      setRecentCommitments(upcomingCommitments.slice(0, 3));

      // Generate insights from recent analyses
      const recentInsights = analyses.slice(0, 3).map((analysis, index) => ({
        id: `insight_${index}`,
        title: `${analysis.conversationInsights.keyTopics[0] || 'Conversation'} Analysis`,
        content: `Quality: ${analysis.conversationInsights.conversationQuality}/10, ${analysis.emotionalAnalysis.overallTone} tone`,
        priority: analysis.conversationInsights.conversationQuality >= 7 ? 'high' : 
                 analysis.conversationInsights.conversationQuality >= 5 ? 'medium' : 'low',
        timestamp: analysis.analyzedAt,
        type: 'ai_analysis'
      }));

      setInsights(recentInsights);
      
      console.log('📊 Dashboard loaded with SQLite data:', {
        totalConversations,
        totalCommitments: dbStats.totalCommitments,
        totalContacts,
        avgQuality: avgQuality.toFixed(1)
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const checkPermissions = async () => {
    // Check if call monitoring is available and has permissions
    const monitoring = callDetectionService.isCurrentlyMonitoring();
    setHasPermissions(monitoring);
  };

  const checkMonitoringStatus = () => {
    const monitoring = callDetectionService.isCurrentlyMonitoring();
    setIsMonitoring(monitoring);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const openWhatsApp = (phoneNumber: string) => {
    const url = `whatsapp://send?phone=${phoneNumber}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert('WhatsApp not installed');
        }
      })
      .catch((err) => console.error('Error opening WhatsApp:', err));
  };

  const makeCall = (phoneNumber: string) => {
    const url = `tel:${phoneNumber}`;
    Linking.openURL(url);
  };

  const renderHeader = () => (
    <Header
      centerComponent={{
        text: 'Hello! 👋 I\'m Donna',
        style: { color: '#fff', fontSize: 20, fontWeight: 'bold' }
      }}
      rightComponent={{
        icon: 'settings',
        color: '#fff',
        onPress: () => navigation.navigate('Settings')
      }}
      backgroundColor="#6366f1"
    />
  );

  const renderQuickStats = () => {
    if (!analytics || !relationshipMetrics) {
      return (
        <View style={styles.statsContainer}>
          <Card containerStyle={styles.statCard}>
            <Text h2 style={styles.statNumber}>--</Text>
            <Text style={styles.statLabel}>Total Calls</Text>
          </Card>
          <Card containerStyle={styles.statCard}>
            <Text h2 style={styles.statNumber}>--</Text>
            <Text style={styles.statLabel}>Relationships</Text>
          </Card>
          <Card containerStyle={styles.statCard}>
            <Text h2 style={styles.statNumber}>--</Text>
            <Text style={styles.statLabel}>Commitments</Text>
          </Card>
        </View>
      );
    }

    return (
      <View style={styles.statsContainer}>
        <Card containerStyle={styles.statCard}>
          <Text h2 style={[styles.statNumber, { color: '#6366f1' }]}>
            {analytics.totalCalls}
          </Text>
          <Text style={styles.statLabel}>Total Calls</Text>
        </Card>
        <Card containerStyle={styles.statCard}>
          <Text h2 style={[styles.statNumber, { color: '#10b981' }]}>
            {relationshipMetrics.totalRelationships}
          </Text>
          <Text style={styles.statLabel}>Relationships</Text>
        </Card>
        <Card containerStyle={styles.statCard}>
          <Text h2 style={[styles.statNumber, { color: '#f59e0b' }]}>
            {relationshipMetrics.totalCommitments}
          </Text>
          <Text style={styles.statLabel}>Commitments</Text>
        </Card>
      </View>
    );
  };

  const renderRelationshipHealth = () => {
    if (!relationshipMetrics) return null;

    const healthScore = Math.round(relationshipMetrics.avgConversationQuality);
    const completionRate = Math.round(relationshipMetrics.completionRate);

    return (
      <Card containerStyle={styles.sectionCard}>
        <Text h4 style={styles.sectionTitle}>
          💝 Relationship Health
        </Text>
        
        <View style={styles.healthMetrics}>
          <View style={styles.healthMetricItem}>
            <View style={[styles.healthScore, { backgroundColor: healthScore >= 7 ? '#10b981' : healthScore >= 5 ? '#f59e0b' : '#ef4444' }]}>
              <Text style={styles.healthScoreText}>{healthScore}</Text>
            </View>
            <Text style={styles.healthLabel}>Avg Quality</Text>
          </View>

          <View style={styles.healthMetricItem}>
            <View style={[styles.healthScore, { backgroundColor: completionRate >= 80 ? '#10b981' : completionRate >= 60 ? '#f59e0b' : '#ef4444' }]}>
              <Text style={styles.healthScoreText}>{completionRate}%</Text>
            </View>
            <Text style={styles.healthLabel}>Follow-through</Text>
          </View>

          <View style={styles.healthMetricItem}>
            <View style={[styles.healthScore, { backgroundColor: relationshipMetrics.upcomingCommitments > 0 ? '#6366f1' : '#9ca3af' }]}>
              <Text style={styles.healthScoreText}>{relationshipMetrics.upcomingCommitments}</Text>
            </View>
            <Text style={styles.healthLabel}>Upcoming</Text>
          </View>
        </View>

        {relationshipMetrics.upcomingCommitments > 0 && (
          <TouchableOpacity 
            style={styles.healthAction}
            onPress={() => navigation.navigate('Commitments')}
          >
            <Text style={styles.healthActionText}>
              🗓️ {relationshipMetrics.upcomingCommitments} commitments due this week
            </Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  };

  const renderEmptyState = () => (
    <Card containerStyle={styles.emptyStateCard}>
      <View style={styles.emptyStateContent}>
        <Text style={{ fontSize: 60, textAlign: 'center', marginBottom: 16 }}>
          📞
        </Text>
        <Text h3 style={styles.emptyTitle}>
          No calls recorded yet
        </Text>
        <Text style={styles.emptySubtitle}>
          Make or receive your first call to see AI-powered insights, transcripts, and analytics appear here.
        </Text>

        <View style={styles.emptyStateActions}>
          <Card containerStyle={[styles.permissionCard, { backgroundColor: isMonitoring ? '#d1fae5' : '#fef3c7' }]}>
            <Icon 
              name={isMonitoring ? "check-circle" : "warning"} 
              type="material" 
              color={isMonitoring ? "#10b981" : "#f59e0b"} 
              size={30} 
            />
            <Text style={[styles.permissionText, { color: isMonitoring ? "#065f46" : "#92400e" }]}>
              {isMonitoring 
                ? "🎉 Donna is monitoring calls and ready to help!"
                : "🔐 Setup required to start recording calls"
              }
            </Text>
            {!isMonitoring && (
              <Button
                title="Setup Call Monitoring"
                onPress={() => navigation.navigate('Permissions')}
                buttonStyle={[styles.permissionButton, { backgroundColor: isMonitoring ? "#10b981" : "#f59e0b" }]}
              />
            )}
          </Card>

          <Button
            title="Test Call"
            onPress={() => makeCall('+1234567890')}
            buttonStyle={[styles.actionButton, { backgroundColor: '#6366f1' }]}
            icon={{
              name: 'call',
              type: 'material',
              size: 20,
              color: '#fff'
            }}
          />
          <Button
            title="View Settings"
            type="outline"
            onPress={() => navigation.navigate('Settings')}
            buttonStyle={styles.outlineButton}
            titleStyle={{ color: '#6366f1' }}
          />
        </View>
      </View>
    </Card>
  );

  const renderRecentInsights = () => {
    if (insights.length === 0) {
      return (
        <Card containerStyle={styles.sectionCard}>
          <Text h4 style={styles.sectionTitle}>
            🧠 Recent Insights
          </Text>
          <View style={styles.emptyInsights}>
            <Text style={styles.emptyText}>
              AI insights from your calls will appear here
            </Text>
          </View>
        </Card>
      );
    }

    return (
      <Card containerStyle={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text h4 style={styles.sectionTitle}>
            🧠 Recent Insights
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Insights')}>
            <Text style={styles.viewAllText}>
              View All
            </Text>
          </TouchableOpacity>
        </View>

        {insights.slice(0, 3).map((insight) => (
          <ListItem key={insight.id} containerStyle={styles.insightItem}>
            <Avatar
              rounded
              icon={{ name: 'lightbulb', type: 'material', color: '#6366f1' }}
              backgroundColor="#e0e7ff"
              size="small"
            />
            <ListItem.Content>
              <ListItem.Title style={styles.insightTitle}>
                {insight.title}
              </ListItem.Title>
              <ListItem.Subtitle numberOfLines={2} style={styles.insightContent}>
                {insight.content}
              </ListItem.Subtitle>
            </ListItem.Content>
            <Badge
              value={insight.priority.toUpperCase()}
              status={getPriorityStatus(insight.priority)}
              badgeStyle={styles.priorityBadge}
            />
          </ListItem>
        ))}
      </Card>
    );
  };

  const renderQuickActions = () => (
    <Card containerStyle={styles.sectionCard}>
      <Text h4 style={styles.sectionTitle}>
        ⚡ Quick Actions
      </Text>

      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => navigation.navigate('Contacts')}
        >
          <Avatar
            rounded
            icon={{ name: 'people', type: 'material', color: '#6366f1' }}
            backgroundColor="#e0e7ff"
            size="medium"
          />
          <Text style={styles.quickActionText}>Contacts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => navigation.navigate('Analytics')}
        >
          <Avatar
            rounded
            icon={{ name: 'analytics', type: 'material', color: '#10b981' }}
            backgroundColor="#d1fae5"
            size="medium"
          />
          <Text style={styles.quickActionText}>Analytics</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => navigation.navigate('SearchScreen')}
        >
          <Avatar
            rounded
            icon={{ name: 'search', type: 'material', color: '#f59e0b' }}
            backgroundColor="#fef3c7"
            size="medium"
          />
          <Text style={styles.quickActionText}>Search</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionItem}
          onPress={() => navigation.navigate('Settings')}
        >
          <Avatar
            rounded
            icon={{ name: 'settings', type: 'material', color: '#8b5cf6' }}
            backgroundColor="#ede9fe"
            size="medium"
          />
          <Text style={styles.quickActionText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  const getPriorityStatus = (priority: string): 'success' | 'warning' | 'error' | 'primary' => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'primary';
    }
  };

  return (
    <View style={styles.container}>
      {renderHeader()}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {renderQuickStats()}

          {conversations.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {renderRelationshipHealth()}
              {renderRecentInsights()}
              {renderQuickActions()}
            </>
          )}
        </View>
      </ScrollView>

      <FAB
        placement="right"
        icon={{ name: 'add-call', type: 'material', color: '#fff' }}
        color="#6366f1"
        onPress={() => makeCall('+1234567890')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    paddingVertical: 20,
  },
  statNumber: {
    color: '#9ca3af',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    color: '#1f2937',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    color: '#6366f1',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyStateCard: {
    marginTop: 16,
    marginBottom: 32,
    borderRadius: 12,
    padding: 24,
  },
  emptyStateContent: {
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#1f2937',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyStateActions: {
    width: '100%',
    alignItems: 'center',
  },
  permissionCard: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  permissionText: {
    color: '#92400e',
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 8,
  },
  permissionButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
    width: '100%',
  },
  outlineButton: {
    borderColor: '#6366f1',
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 12,
    width: '100%',
  },
  emptyInsights: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
  },
  insightItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  insightContent: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 18,
  },
  priorityBadge: {
    borderRadius: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  quickActionItem: {
    alignItems: 'center',
    marginBottom: 16,
    width: '22%',
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginTop: 8,
  },
  
  // Relationship Health Styles
  healthMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthMetricItem: {
    alignItems: 'center',
  },
  healthScore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  healthScoreText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  healthLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  healthAction: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  healthActionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
});

export default DashboardScreen;