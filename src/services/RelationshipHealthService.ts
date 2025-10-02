import AsyncStorage from '@react-native-async-storage/async-storage';
import ConversationAnalysisService, { ConversationAnalysis } from './ConversationAnalysisService';
import CommitmentTrackingService, { CommitmentStats } from './CommitmentTrackingService';

export interface RelationshipHealthScore {
  contactId: string;
  overallScore: number; // 1-10
  metrics: {
    communicationFrequency: number; // 1-10
    emotionalConnection: number;    // 1-10
    commitmentReliability: number;  // 1-10
    conflictResolution: number;     // 1-10
    mutualSupport: number;         // 1-10
    trustLevel: number;            // 1-10
    engagementQuality: number;     // 1-10
  };
  trends: {
    improving: boolean;
    declining: boolean;
    stable: boolean;
    changeRate: number; // -1 to 1 (negative = declining, positive = improving)
  };
  insights: {
    strengths: string[];
    concerns: string[];
    recommendations: string[];
  };
  lastUpdated: Date;
  historicalScores: HealthHistoryPoint[];
}

export interface HealthHistoryPoint {
  date: Date;
  score: number;
  primaryFactor: string; // What drove the score at this point
}

export interface RelationshipInsight {
  type: 'strength' | 'concern' | 'recommendation';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  category: 'communication' | 'emotional' | 'commitment' | 'conflict' | 'trust' | 'engagement';
}

export interface HealthReportConfig {
  timeframeDays: number;
  includeComparison: boolean;
  detailedMetrics: boolean;
  includeRecommendations: boolean;
}

class RelationshipHealthService {
  private healthScores: Map<string, RelationshipHealthScore> = new Map();
  private isInitialized = false;

  constructor() {
    this.loadHealthScores();
  }

  /**
   * Load health scores from storage
   */
  private async loadHealthScores(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('relationship_health_scores');
      if (stored) {
        const scoresArray: RelationshipHealthScore[] = JSON.parse(stored);
        scoresArray.forEach(score => {
          score.lastUpdated = new Date(score.lastUpdated);
          score.historicalScores = score.historicalScores.map(point => ({
            ...point,
            date: new Date(point.date),
          }));
          this.healthScores.set(score.contactId, score);
        });
      }
      this.isInitialized = true;
      console.log(`Loaded ${this.healthScores.size} relationship health scores`);
    } catch (error) {
      console.error('Failed to load relationship health scores:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Save health scores to storage
   */
  private async saveHealthScores(): Promise<void> {
    try {
      const scoresArray = Array.from(this.healthScores.values());
      await AsyncStorage.setItem('relationship_health_scores', JSON.stringify(scoresArray));
    } catch (error) {
      console.error('Failed to save relationship health scores:', error);
    }
  }

  /**
   * Calculate comprehensive relationship health score
   */
  async calculateRelationshipHealth(
    contactId: string,
    timeframeDays: number = 30
  ): Promise<RelationshipHealthScore | null> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - timeframeDays);

      // Get conversation analyses for the timeframe
      const analyses = ConversationAnalysisService.getAnalyses({
        contactId,
        dateRange: { start: startDate, end: endDate },
      });

      // Get commitment statistics
      const commitmentStats = CommitmentTrackingService.getCommitmentStats(contactId);

      if (analyses.length === 0) {
        console.warn(`No conversation data available for contact ${contactId}`);
        return this.createEmptyHealthScore(contactId);
      }

      // Calculate individual metrics
      const metrics = {
        communicationFrequency: this.calculateCommunicationFrequency(analyses, timeframeDays),
        emotionalConnection: this.calculateEmotionalConnection(analyses),
        commitmentReliability: this.calculateCommitmentReliability(commitmentStats),
        conflictResolution: this.calculateConflictResolution(analyses),
        mutualSupport: this.calculateMutualSupport(analyses),
        trustLevel: this.calculateTrustLevel(analyses),
        engagementQuality: this.calculateEngagementQuality(analyses),
      };

      // Calculate weighted overall score
      const overallScore = this.calculateOverallScore(metrics);

      // Calculate trends
      const trends = await this.calculateTrends(contactId, overallScore);

      // Generate insights
      const insights = this.generateInsights(metrics, trends, analyses);

      // Update historical data
      const historicalScores = await this.updateHistoricalScores(contactId, overallScore);

      const healthScore: RelationshipHealthScore = {
        contactId,
        overallScore,
        metrics,
        trends,
        insights,
        lastUpdated: new Date(),
        historicalScores,
      };

      // Store the health score
      this.healthScores.set(contactId, healthScore);
      await this.saveHealthScores();

      console.log(`Calculated relationship health score for contact ${contactId}: ${overallScore.toFixed(1)}/10`);
      return healthScore;
    } catch (error) {
      console.error('Failed to calculate relationship health:', error);
      return null;
    }
  }

  /**
   * Calculate communication frequency score
   */
  private calculateCommunicationFrequency(analyses: ConversationAnalysis[], timeframeDays: number): number {
    const conversationsPerWeek = (analyses.length / timeframeDays) * 7;

    // Score based on conversation frequency
    if (conversationsPerWeek >= 3) return 10;      // Daily+ communication
    if (conversationsPerWeek >= 2) return 8;       // Every other day
    if (conversationsPerWeek >= 1) return 6;       // Weekly
    if (conversationsPerWeek >= 0.5) return 4;     // Bi-weekly
    if (conversationsPerWeek >= 0.25) return 2;    // Monthly
    return 1;                                       // Less than monthly
  }

  /**
   * Calculate emotional connection score
   */
  private calculateEmotionalConnection(analyses: ConversationAnalysis[]): number {
    if (analyses.length === 0) return 5;

    const avgIntimacy = analyses.reduce((sum, a) =>
      sum + a.conversationInsights.relationshipDynamics.intimacyLevel, 0) / analyses.length;

    const avgEmotionalResonance = analyses.reduce((sum, a) =>
      sum + a.relationshipMetrics.emotionalResonance, 0) / analyses.length;

    const avgPositiveEmotions = analyses.reduce((sum, a) => {
      const emotions = a.emotionalAnalysis.emotionalScores;
      return sum + (emotions.joy + emotions.trust) / 2;
    }, 0) / analyses.length;

    // Weighted average (intimacy: 40%, resonance: 30%, positive emotions: 30%)
    return (avgIntimacy * 0.4) + (avgEmotionalResonance * 0.3) + (avgPositiveEmotions * 10 * 0.3);
  }

  /**
   * Calculate commitment reliability score
   */
  private calculateCommitmentReliability(stats: CommitmentStats): number {
    if (stats.totalCommitments === 0) return 7; // Neutral score for no commitments

    const completionRate = stats.completionRate / 100; // Convert percentage to decimal
    const overdueRate = stats.totalCommitments > 0 ? stats.overdueCommitments / stats.totalCommitments : 0;

    // Base score on completion rate, penalize overdue items
    const baseScore = completionRate * 10;
    const overdueePenalty = overdueRate * 3;

    return Math.max(1, Math.min(10, baseScore - overdueePenalty));
  }

  /**
   * Calculate conflict resolution score
   */
  private calculateConflictResolution(analyses: ConversationAnalysis[]): number {
    if (analyses.length === 0) return 5;

    const avgConflictLevel = analyses.reduce((sum, a) =>
      sum + a.conversationInsights.relationshipDynamics.conflictLevel, 0) / analyses.length;

    const conflictTrend = this.calculateConflictTrend(analyses);

    // Lower conflict level = higher score
    const baseScore = 11 - avgConflictLevel;

    // Adjust based on trend (improving = bonus, worsening = penalty)
    const trendAdjustment = conflictTrend * 2;

    return Math.max(1, Math.min(10, baseScore + trendAdjustment));
  }

  /**
   * Calculate mutual support score
   */
  private calculateMutualSupport(analyses: ConversationAnalysis[]): number {
    if (analyses.length === 0) return 5;

    return analyses.reduce((sum, a) =>
      sum + a.conversationInsights.relationshipDynamics.supportLevel, 0) / analyses.length;
  }

  /**
   * Calculate trust level score
   */
  private calculateTrustLevel(analyses: ConversationAnalysis[]): number {
    if (analyses.length === 0) return 5;

    return analyses.reduce((sum, a) =>
      sum + a.relationshipMetrics.trustIndicators, 0) / analyses.length;
  }

  /**
   * Calculate engagement quality score
   */
  private calculateEngagementQuality(analyses: ConversationAnalysis[]): number {
    if (analyses.length === 0) return 5;

    const avgEngagement = analyses.reduce((sum, a) =>
      sum + a.emotionalAnalysis.engagementLevel, 0) / analyses.length;

    const avgConversationQuality = analyses.reduce((sum, a) =>
      sum + a.conversationInsights.conversationQuality, 0) / analyses.length;

    // Weighted average (engagement: 60%, quality: 40%)
    return (avgEngagement * 0.6) + (avgConversationQuality * 0.4);
  }

  /**
   * Calculate overall weighted score
   */
  private calculateOverallScore(metrics: RelationshipHealthScore['metrics']): number {
    const weights = {
      communicationFrequency: 0.15,
      emotionalConnection: 0.20,
      commitmentReliability: 0.15,
      conflictResolution: 0.15,
      mutualSupport: 0.15,
      trustLevel: 0.10,
      engagementQuality: 0.10,
    };

    return Object.entries(metrics).reduce((sum, [key, value]) => {
      const weight = weights[key as keyof typeof weights] || 0;
      return sum + (value * weight);
    }, 0);
  }

  /**
   * Calculate conflict trend
   */
  private calculateConflictTrend(analyses: ConversationAnalysis[]): number {
    if (analyses.length < 2) return 0;

    const sortedAnalyses = analyses.sort((a, b) => a.analyzedAt.getTime() - b.analyzedAt.getTime());
    const recentHalf = sortedAnalyses.slice(Math.floor(sortedAnalyses.length / 2));
    const earlierHalf = sortedAnalyses.slice(0, Math.floor(sortedAnalyses.length / 2));

    const recentAvgConflict = recentHalf.reduce((sum, a) =>
      sum + a.conversationInsights.relationshipDynamics.conflictLevel, 0) / recentHalf.length;

    const earlierAvgConflict = earlierHalf.reduce((sum, a) =>
      sum + a.conversationInsights.relationshipDynamics.conflictLevel, 0) / earlierHalf.length;

    // Return trend: negative = improving (less conflict), positive = worsening
    return (recentAvgConflict - earlierAvgConflict) / 10; // Normalize to -1 to 1 range
  }

  /**
   * Calculate trends compared to previous scores
   */
  private async calculateTrends(contactId: string, currentScore: number): Promise<RelationshipHealthScore['trends']> {
    const existingScore = this.healthScores.get(contactId);

    if (!existingScore || existingScore.historicalScores.length < 2) {
      return {
        improving: false,
        declining: false,
        stable: true,
        changeRate: 0,
      };
    }

    const recentScores = existingScore.historicalScores
      .slice(-3) // Look at last 3 data points
      .map(point => point.score);

    const previousScore = recentScores[recentScores.length - 1];
    const changeRate = (currentScore - previousScore) / 10; // Normalize to -1 to 1

    const improving = changeRate > 0.1;
    const declining = changeRate < -0.1;
    const stable = !improving && !declining;

    return {
      improving,
      declining,
      stable,
      changeRate,
    };
  }

  /**
   * Generate insights based on metrics and trends
   */
  private generateInsights(
    metrics: RelationshipHealthScore['metrics'],
    trends: RelationshipHealthScore['trends'],
    analyses: ConversationAnalysis[]
  ): RelationshipHealthScore['insights'] {
    const strengths: string[] = [];
    const concerns: string[] = [];
    const recommendations: string[] = [];

    // Identify strengths (scores >= 7)
    Object.entries(metrics).forEach(([key, value]) => {
      if (value >= 7) {
        const strengthMap: Record<string, string> = {
          communicationFrequency: 'Regular and consistent communication',
          emotionalConnection: 'Strong emotional bond',
          commitmentReliability: 'Excellent at keeping promises',
          conflictResolution: 'Handles disagreements well',
          mutualSupport: 'Highly supportive relationship',
          trustLevel: 'High level of mutual trust',
          engagementQuality: 'Engaged and meaningful conversations',
        };
        strengths.push(strengthMap[key] || `Strong ${key}`);
      }
    });

    // Identify concerns (scores <= 4)
    Object.entries(metrics).forEach(([key, value]) => {
      if (value <= 4) {
        const concernMap: Record<string, string> = {
          communicationFrequency: 'Infrequent communication',
          emotionalConnection: 'Limited emotional intimacy',
          commitmentReliability: 'Difficulty keeping commitments',
          conflictResolution: 'Struggles with conflict resolution',
          mutualSupport: 'Low mutual support',
          trustLevel: 'Trust issues present',
          engagementQuality: 'Conversations lack depth',
        };
        concerns.push(concernMap[key] || `Low ${key}`);
      }
    });

    // Generate recommendations based on concerns and trends
    if (metrics.communicationFrequency <= 5) {
      recommendations.push('Schedule regular check-ins to improve communication frequency');
    }

    if (metrics.emotionalConnection <= 5) {
      recommendations.push('Share more personal experiences to deepen emotional connection');
    }

    if (metrics.commitmentReliability <= 5) {
      recommendations.push('Focus on following through on promises and commitments');
    }

    if (metrics.conflictResolution <= 5) {
      recommendations.push('Practice active listening and empathy during disagreements');
    }

    if (trends.declining) {
      recommendations.push('Recent decline detected - consider having an open conversation about the relationship');
    }

    // Add positive reinforcement recommendations
    if (trends.improving) {
      recommendations.push('Great progress! Continue current positive communication patterns');
    }

    return { strengths, concerns, recommendations };
  }

  /**
   * Update historical scores
   */
  private async updateHistoricalScores(contactId: string, newScore: number): Promise<HealthHistoryPoint[]> {
    const existingScore = this.healthScores.get(contactId);
    let historicalScores: HealthHistoryPoint[] = existingScore?.historicalScores || [];

    // Add new data point
    const newPoint: HealthHistoryPoint = {
      date: new Date(),
      score: newScore,
      primaryFactor: this.determinePrimaryFactor(newScore, existingScore),
    };

    historicalScores.push(newPoint);

    // Keep only last 30 data points to manage storage
    if (historicalScores.length > 30) {
      historicalScores = historicalScores.slice(-30);
    }

    return historicalScores;
  }

  /**
   * Determine primary factor affecting the score
   */
  private determinePrimaryFactor(currentScore: number, existingScore?: RelationshipHealthScore): string {
    if (!existingScore) return 'Initial assessment';

    const previousScore = existingScore.overallScore;
    const change = currentScore - previousScore;

    if (Math.abs(change) < 0.5) return 'Stable';
    if (change > 0) return 'Improving communication';
    return 'Declining interaction';
  }

  /**
   * Create empty health score for contacts with no data
   */
  private createEmptyHealthScore(contactId: string): RelationshipHealthScore {
    return {
      contactId,
      overallScore: 5,
      metrics: {
        communicationFrequency: 5,
        emotionalConnection: 5,
        commitmentReliability: 5,
        conflictResolution: 5,
        mutualSupport: 5,
        trustLevel: 5,
        engagementQuality: 5,
      },
      trends: {
        improving: false,
        declining: false,
        stable: true,
        changeRate: 0,
      },
      insights: {
        strengths: [],
        concerns: ['No recent conversation data available'],
        recommendations: ['Start a conversation to begin relationship tracking'],
      },
      lastUpdated: new Date(),
      historicalScores: [],
    };
  }

  /**
   * Get relationship health score
   */
  getRelationshipHealth(contactId: string): RelationshipHealthScore | null {
    return this.healthScores.get(contactId) || null;
  }

  /**
   * Get all relationship health scores
   */
  getAllRelationshipHealthScores(): RelationshipHealthScore[] {
    return Array.from(this.healthScores.values())
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Get relationships needing attention
   */
  getRelationshipsNeedingAttention(threshold: number = 5): RelationshipHealthScore[] {
    return Array.from(this.healthScores.values())
      .filter(score => score.overallScore <= threshold || score.trends.declining)
      .sort((a, b) => a.overallScore - b.overallScore);
  }

  /**
   * Generate health report
   */
  generateHealthReport(
    contactId?: string,
    config: HealthReportConfig = {
      timeframeDays: 30,
      includeComparison: true,
      detailedMetrics: true,
      includeRecommendations: true,
    }
  ): string {
    const scores = contactId
      ? [this.getRelationshipHealth(contactId)].filter(Boolean)
      : this.getAllRelationshipHealthScores();

    let report = 'RELATIONSHIP HEALTH REPORT\n';
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `Timeframe: ${config.timeframeDays} days\n\n`;

    if (scores.length === 0) {
      report += 'No relationship data available.\n';
      return report;
    }

    scores.forEach((score, index) => {
      report += `${index + 1}. Contact ID: ${score.contactId}\n`;
      report += `   Overall Score: ${score.overallScore.toFixed(1)}/10\n`;

      if (config.detailedMetrics) {
        report += '   Detailed Metrics:\n';
        Object.entries(score.metrics).forEach(([key, value]) => {
          const label = key.replace(/([A-Z])/g, ' $1').toLowerCase();
          report += `     ${label}: ${value.toFixed(1)}/10\n`;
        });
      }

      report += `   Trend: ${score.trends.improving ? 'Improving' : score.trends.declining ? 'Declining' : 'Stable'}\n`;

      if (score.insights.strengths.length > 0) {
        report += `   Strengths: ${score.insights.strengths.join(', ')}\n`;
      }

      if (score.insights.concerns.length > 0) {
        report += `   Concerns: ${score.insights.concerns.join(', ')}\n`;
      }

      if (config.includeRecommendations && score.insights.recommendations.length > 0) {
        report += '   Recommendations:\n';
        score.insights.recommendations.forEach(rec => {
          report += `     - ${rec}\n`;
        });
      }

      report += '\n';
    });

    return report;
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await this.loadHealthScores();
    }
  }
}

export default new RelationshipHealthService();