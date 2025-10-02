import OpenAIService, { EmotionalAnalysisResult, ConversationInsights } from './OpenAIService';
import DatabaseService from './DatabaseService';

export interface ConversationAnalysis {
  id: string;
  conversationId: string;
  contactId: string;
  emotionalAnalysis: EmotionalAnalysisResult;
  conversationInsights: ConversationInsights;
  relationshipMetrics: RelationshipMetrics;
  analyzedAt: Date;
  transcript: string;
  duration: number;
}

export interface RelationshipMetrics {
  communicationBalance: number; // -1 to 1 (negative = user dominates, positive = contact dominates)
  supportScore: number; // 1 to 10
  conflictLevel: number; // 1 to 10
  intimacyLevel: number; // 1 to 10
  trustIndicators: number; // 1 to 10
  engagementQuality: number; // 1 to 10
  emotionalResonance: number; // 1 to 10
  improvementAreas: string[];
  strengths: string[];
}

export interface ConversationTrends {
  periodStart: Date;
  periodEnd: Date;
  totalConversations: number;
  averageDuration: number;
  emotionalTrendData: {
    date: string;
    positiveScore: number;
    negativeScore: number;
    engagementLevel: number;
  }[];
  topTopics: string[];
  communicationPatterns: {
    bestTimeOfDay: string;
    preferredCommunicationStyle: string;
    responsePatterns: string;
  };
}

export interface AnalysisFilter {
  contactId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  emotionalTone?: string[];
  engagementThreshold?: number;
}

class ConversationAnalysisService {
  private analyses: Map<string, ConversationAnalysis> = new Map();
  private isInitialized = false;

  constructor() {
    this.loadAnalyses();
  }

  /**
   * Load analyses from storage
   */
  private async loadAnalyses(): Promise<void> {
    try {
      await DatabaseService.initialize();
      // Note: Analyses are now stored in the database and loaded on-demand
      this.isInitialized = true;
      console.log('Conversation Analysis Service initialized with SQLite backend');
    } catch (error) {
      console.error('Failed to load conversation analyses:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Save analysis to database (replaced AsyncStorage with SQLite)
   */
  private async saveAnalysis(analysis: ConversationAnalysis): Promise<boolean> {
    try {
      // Insert the analysis into SQLite database
      const analysisRecord = {
        id: analysis.id,
        conversationId: analysis.conversationId,
        contactId: analysis.contactId,
        keyTopics: JSON.stringify(analysis.conversationInsights.keyTopics),
        relationshipDynamics: JSON.stringify(analysis.relationshipMetrics),
        emotionalScores: JSON.stringify(analysis.emotionalAnalysis.emotionalScores),
        insights: JSON.stringify({
          conversationInsights: analysis.conversationInsights,
          relationshipMetrics: analysis.relationshipMetrics,
          emotionalAnalysis: analysis.emotionalAnalysis
        }),
        processingTime: 0, // Would need to be calculated if needed
        createdAt: analysis.analyzedAt.toISOString()
      };

      // Insert the analysis using raw SQL since it's a complex object
      await DatabaseService.executeSQL(`
        INSERT INTO analyses (
          id, conversationId, contactId, keyTopics, relationshipDynamics, 
          emotionalScores, insights, processingTime, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        analysisRecord.id,
        analysisRecord.conversationId,
        analysisRecord.contactId,
        analysisRecord.keyTopics,
        analysisRecord.relationshipDynamics,
        analysisRecord.emotionalScores,
        analysisRecord.insights,
        analysisRecord.processingTime,
        analysisRecord.createdAt
      ]);

      return true;
    } catch (error) {
      console.error('Failed to save conversation analysis to database:', error);
      return false;
    }
  }

  /**
   * Analyze conversation comprehensively
   */
  async analyzeConversation(
    conversationId: string,
    contactId: string,
    transcript: string,
    duration: number,
    contactName?: string,
    relationshipType?: string
  ): Promise<ConversationAnalysis | null> {
    try {
      console.log('Starting comprehensive conversation analysis...');

      // Run all analyses in parallel for efficiency
      const [emotionalAnalysis, conversationInsights] = await Promise.all([
        OpenAIService.analyzeEmotionalTone(transcript),
        OpenAIService.generateConversationInsights(transcript, contactName, relationshipType),
      ]);

      if (!emotionalAnalysis || !conversationInsights) {
        console.error('Failed to complete conversation analysis');
        return null;
      }

      // Calculate relationship metrics based on the analysis
      const relationshipMetrics = this.calculateRelationshipMetrics(
        emotionalAnalysis,
        conversationInsights,
        transcript
      );

      const analysis: ConversationAnalysis = {
        id: this.generateAnalysisId(),
        conversationId,
        contactId,
        emotionalAnalysis,
        conversationInsights,
        relationshipMetrics,
        analyzedAt: new Date(),
        transcript,
        duration,
      };

      // Store the analysis in database and memory cache
      this.analyses.set(analysis.id, analysis);
      await this.saveAnalysis(analysis);

      console.log('Conversation analysis completed successfully');
      return analysis;
    } catch (error) {
      console.error('Failed to analyze conversation:', error);
      return null;
    }
  }

  /**
   * Calculate relationship metrics from analysis data
   */
  private calculateRelationshipMetrics(
    emotionalAnalysis: EmotionalAnalysisResult,
    conversationInsights: ConversationInsights,
    transcript: string
  ): RelationshipMetrics {
    // Calculate communication balance
    const userWordCount = this.countUserWords(transcript);
    const contactWordCount = this.countContactWords(transcript);
    const totalWords = userWordCount + contactWordCount;
    const communicationBalance = totalWords > 0
      ? ((contactWordCount - userWordCount) / totalWords) * 2 // Scale to -1 to 1
      : 0;

    // Calculate trust indicators based on language patterns
    const trustIndicators = this.calculateTrustIndicators(transcript);

    // Calculate emotional resonance
    const emotionalResonance = this.calculateEmotionalResonance(emotionalAnalysis);

    // Identify improvement areas and strengths
    const { improvementAreas, strengths } = this.identifyRelationshipAspects(
      emotionalAnalysis,
      conversationInsights
    );

    return {
      communicationBalance,
      supportScore: conversationInsights.relationshipDynamics.supportLevel,
      conflictLevel: conversationInsights.relationshipDynamics.conflictLevel,
      intimacyLevel: conversationInsights.relationshipDynamics.intimacyLevel,
      trustIndicators,
      engagementQuality: emotionalAnalysis.engagementLevel,
      emotionalResonance,
      improvementAreas,
      strengths,
    };
  }

  /**
   * Count words spoken by user (simple heuristic)
   */
  private countUserWords(transcript: string): number {
    // Simple pattern matching for user speech indicators
    const userPatterns = /\b(i|my|me|myself|i'm|i've|i'll|i'd)\b/gi;
    const matches = transcript.match(userPatterns);
    return matches ? matches.length * 10 : transcript.length * 0.4; // Estimate
  }

  /**
   * Count words spoken by contact (simple heuristic)
   */
  private countContactWords(transcript: string): number {
    // Simple pattern matching for contact speech indicators
    const contactPatterns = /\b(you|your|yourself|you're|you've|you'll|you'd)\b/gi;
    const matches = transcript.match(contactPatterns);
    return matches ? matches.length * 10 : transcript.length * 0.6; // Estimate
  }

  /**
   * Calculate trust indicators based on language patterns
   */
  private calculateTrustIndicators(transcript: string): number {
    const trustWords = [
      'trust', 'believe', 'honest', 'truth', 'reliable', 'depend', 'count on',
      'faith', 'confidence', 'sure', 'certain', 'promise', 'guarantee'
    ];

    const distrustWords = [
      'doubt', 'suspicious', 'worry', 'concerned', 'afraid', 'uncertain',
      'hesitant', 'skeptical', 'questionable', 'unreliable'
    ];

    const lowerTranscript = transcript.toLowerCase();
    const trustCount = trustWords.filter(word => lowerTranscript.includes(word)).length;
    const distrustCount = distrustWords.filter(word => lowerTranscript.includes(word)).length;

    // Scale to 1-10 with 5 as neutral
    const trustScore = 5 + (trustCount - distrustCount) * 0.5;
    return Math.max(1, Math.min(10, trustScore));
  }

  /**
   * Calculate emotional resonance between speakers
   */
  private calculateEmotionalResonance(emotionalAnalysis: EmotionalAnalysisResult): number {
    const scores = emotionalAnalysis.emotionalScores;

    // High resonance when emotions are balanced and positive
    const positiveEmotions = scores.joy + scores.trust + scores.surprise;
    const negativeEmotions = scores.anger + scores.sadness + scores.fear;

    const emotionalBalance = positiveEmotions - negativeEmotions;
    const resonanceScore = 5 + (emotionalBalance * 2.5); // Scale to 1-10

    return Math.max(1, Math.min(10, resonanceScore));
  }

  /**
   * Identify relationship strengths and improvement areas
   */
  private identifyRelationshipAspects(
    emotionalAnalysis: EmotionalAnalysisResult,
    conversationInsights: ConversationInsights
  ): { improvementAreas: string[]; strengths: string[] } {
    const improvementAreas: string[] = [];
    const strengths: string[] = [];

    // Analyze emotional indicators
    if (emotionalAnalysis.emotionalScores.anger > 0.5) {
      improvementAreas.push('Conflict resolution');
    }
    if (emotionalAnalysis.emotionalScores.sadness > 0.5) {
      improvementAreas.push('Emotional support');
    }
    if (emotionalAnalysis.engagementLevel < 5) {
      improvementAreas.push('Active listening');
    }

    if (emotionalAnalysis.emotionalScores.joy > 0.6) {
      strengths.push('Positive communication');
    }
    if (emotionalAnalysis.emotionalScores.trust > 0.6) {
      strengths.push('Trust and openness');
    }
    if (emotionalAnalysis.engagementLevel >= 7) {
      strengths.push('High engagement');
    }

    // Analyze relationship dynamics
    if (conversationInsights.relationshipDynamics.conflictLevel > 7) {
      improvementAreas.push('Reduce tension');
    }
    if (conversationInsights.relationshipDynamics.supportLevel < 5) {
      improvementAreas.push('Increase support');
    }

    if (conversationInsights.relationshipDynamics.supportLevel >= 7) {
      strengths.push('Mutual support');
    }
    if (conversationInsights.relationshipDynamics.intimacyLevel >= 7) {
      strengths.push('Deep connection');
    }

    return { improvementAreas, strengths };
  }

  /**
   * Get analysis by ID
   */
  getAnalysis(analysisId: string): ConversationAnalysis | null {
    return this.analyses.get(analysisId) || null;
  }

  /**
   * Get analysis by conversation ID
   */
  getAnalysisByConversation(conversationId: string): ConversationAnalysis | null {
    return Array.from(this.analyses.values())
      .find(analysis => analysis.conversationId === conversationId) || null;
  }

  /**
   * Get analyses with filtering
   */
  getAnalyses(filter?: AnalysisFilter): ConversationAnalysis[] {
    let analyses = Array.from(this.analyses.values());

    if (filter) {
      if (filter.contactId) {
        analyses = analyses.filter(a => a.contactId === filter.contactId);
      }

      if (filter.dateRange) {
        analyses = analyses.filter(a => {
          const analyzedAt = a.analyzedAt.getTime();
          return analyzedAt >= filter.dateRange!.start.getTime() &&
                 analyzedAt <= filter.dateRange!.end.getTime();
        });
      }

      if (filter.emotionalTone) {
        analyses = analyses.filter(a =>
          filter.emotionalTone!.includes(a.emotionalAnalysis.overallTone)
        );
      }

      if (filter.engagementThreshold) {
        analyses = analyses.filter(a =>
          a.emotionalAnalysis.engagementLevel >= filter.engagementThreshold!
        );
      }
    }

    return analyses.sort((a, b) => b.analyzedAt.getTime() - a.analyzedAt.getTime());
  }

  /**
   * Generate conversation trends for a contact
   */
  generateConversationTrends(
    contactId: string,
    periodDays: number = 30
  ): ConversationTrends | null {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - periodDays);

    const analyses = this.getAnalyses({
      contactId,
      dateRange: { start: startDate, end: endDate },
    });

    if (analyses.length === 0) {
      return null;
    }

    // Calculate basic metrics
    const totalConversations = analyses.length;
    const averageDuration = analyses.reduce((sum, a) => sum + a.duration, 0) / totalConversations;

    // Generate emotional trend data
    const emotionalTrendData = analyses.map(analysis => ({
      date: analysis.analyzedAt.toISOString().split('T')[0],
      positiveScore: analysis.emotionalAnalysis.emotionalScores.joy +
                    analysis.emotionalAnalysis.emotionalScores.trust,
      negativeScore: analysis.emotionalAnalysis.emotionalScores.anger +
                    analysis.emotionalAnalysis.emotionalScores.sadness,
      engagementLevel: analysis.emotionalAnalysis.engagementLevel,
    }));

    // Extract top topics
    const allTopics = analyses.flatMap(a => a.conversationInsights.keyTopics);
    const topicCounts = allTopics.reduce((counts, topic) => {
      counts[topic] = (counts[topic] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const topTopics = Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic]) => topic);

    return {
      periodStart: startDate,
      periodEnd: endDate,
      totalConversations,
      averageDuration,
      emotionalTrendData,
      topTopics,
      communicationPatterns: {
        bestTimeOfDay: this.calculateBestTimeOfDay(analyses),
        preferredCommunicationStyle: this.calculateCommunicationStyle(analyses),
        responsePatterns: this.calculateResponsePatterns(analyses),
      },
    };
  }

  /**
   * Calculate best time of day for conversations
   */
  private calculateBestTimeOfDay(analyses: ConversationAnalysis[]): string {
    const timeScores = analyses.reduce((scores, analysis) => {
      const hour = analysis.analyzedAt.getHours();
      const timeSlot = this.getTimeSlot(hour);
      const quality = analysis.conversationInsights.conversationQuality;

      scores[timeSlot] = (scores[timeSlot] || 0) + quality;
      return scores;
    }, {} as Record<string, number>);

    return Object.entries(timeScores)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Evening';
  }

  /**
   * Get time slot for hour
   */
  private getTimeSlot(hour: number): string {
    if (hour >= 6 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Night';
  }

  /**
   * Calculate preferred communication style
   */
  private calculateCommunicationStyle(analyses: ConversationAnalysis[]): string {
    const avgIntimacy = analyses.reduce((sum, a) =>
      sum + a.conversationInsights.relationshipDynamics.intimacyLevel, 0) / analyses.length;

    const avgSupport = analyses.reduce((sum, a) =>
      sum + a.conversationInsights.relationshipDynamics.supportLevel, 0) / analyses.length;

    if (avgIntimacy >= 7 && avgSupport >= 7) return 'Deep and supportive';
    if (avgIntimacy >= 6) return 'Personal and open';
    if (avgSupport >= 6) return 'Supportive and caring';
    return 'Casual and friendly';
  }

  /**
   * Calculate response patterns
   */
  private calculateResponsePatterns(analyses: ConversationAnalysis[]): string {
    const avgEngagement = analyses.reduce((sum, a) =>
      sum + a.emotionalAnalysis.engagementLevel, 0) / analyses.length;

    const avgBalance = analyses.reduce((sum, a) =>
      sum + Math.abs(a.relationshipMetrics.communicationBalance), 0) / analyses.length;

    if (avgEngagement >= 8 && avgBalance < 0.3) return 'Highly engaged and balanced';
    if (avgEngagement >= 6) return 'Actively participates';
    if (avgBalance > 0.5) return 'Tends to listen more than speak';
    return 'Standard conversational flow';
  }

  /**
   * Get relationship health score for contact
   */
  getRelationshipHealthScore(contactId: string, periodDays: number = 30): number {
    const trends = this.generateConversationTrends(contactId, periodDays);
    if (!trends) return 5; // Neutral score if no data

    const recentAnalyses = this.getAnalyses({
      contactId,
      dateRange: {
        start: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
    });

    if (recentAnalyses.length === 0) return 5;

    // Calculate weighted health score
    const avgEmotionalScore = recentAnalyses.reduce((sum, a) =>
      sum + (a.emotionalAnalysis.sentimentScore + 1) * 5, 0) / recentAnalyses.length; // Scale to 0-10

    const avgEngagement = recentAnalyses.reduce((sum, a) =>
      sum + a.emotionalAnalysis.engagementLevel, 0) / recentAnalyses.length;

    const avgSupport = recentAnalyses.reduce((sum, a) =>
      sum + a.conversationInsights.relationshipDynamics.supportLevel, 0) / recentAnalyses.length;

    const avgTrust = recentAnalyses.reduce((sum, a) =>
      sum + a.relationshipMetrics.trustIndicators, 0) / recentAnalyses.length;

    // Weighted average (emotional: 25%, engagement: 25%, support: 25%, trust: 25%)
    const healthScore = (avgEmotionalScore * 0.25) + (avgEngagement * 0.25) +
                       (avgSupport * 0.25) + (avgTrust * 0.25);

    return Math.max(1, Math.min(10, healthScore));
  }

  /**
   * Generate unique analysis ID
   */
  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delete analysis
   */
  async deleteAnalysis(analysisId: string): Promise<boolean> {
    try {
      this.analyses.delete(analysisId);
      await this.saveAnalyses();
      return true;
    } catch (error) {
      console.error('Failed to delete analysis:', error);
      return false;
    }
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await this.loadAnalyses();
    }
  }
}

export default new ConversationAnalysisService();