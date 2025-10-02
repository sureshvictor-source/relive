// Core type definitions for Relive app

export interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  relationshipType: 'family' | 'friend' | 'partner' | 'colleague';
  relationshipCloseness: number; // 1-10 scale
  lastContactDate: Date;
  relationshipScore: number;
  avatar?: string;
  preferences?: ContactPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactPreferences {
  preferredContactTimes?: TimeRange[];
  topicsTheyEnjoy?: string[];
  topicsToAvoid?: string[];
  giftPreferences?: string[];
  restaurantPreferences?: string[];
  activityPreferences?: string[];
  familyMembers?: FamilyMember[];
  petInformation?: PetInfo[];
  livingSituation?: string;
}

export interface TimeRange {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
}

export interface FamilyMember {
  name: string;
  relationship: string;
  age?: number;
}

export interface PetInfo {
  name: string;
  type: string;
  breed?: string;
  age?: number;
}

export interface Conversation {
  id: string;
  contactId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // seconds
  transcript: string;
  summary?: string;
  emotionalTone: 'positive' | 'negative' | 'neutral' | 'mixed';
  engagementLevel: number; // 1-10
  audioFilePath: string;
  mainTopics?: string[];
  emotionalAnalysis?: EmotionalAnalysis;
  lifeUpdates?: LifeUpdate[];
  sharedMemories?: string[];
  futurePlans?: string[];
  createdAt: Date;
}

export interface EmotionalAnalysis {
  overallSentiment: number; // -1 to 1
  emotions: {
    joy: number;
    sadness: number;
    anger: number;
    fear: number;
    surprise: number;
    disgust: number;
  };
  conversationalBalance: number; // 0.5 = equal participation
  topicDiversity: number;
  emotionalSynchrony: number;
}

export interface LifeUpdate {
  type: 'job_change' | 'health' | 'relationship' | 'achievement' | 'challenge' | 'family' | 'other';
  title: string;
  description: string;
  emotionalImpact: 'positive' | 'negative' | 'neutral';
  importance: number; // 1-5
  followUpNeeded: boolean;
  mentionedAt: Date;
}

export interface Commitment {
  id: string;
  conversationId: string;
  contactId: string;
  text: string;
  type: 'call' | 'meet' | 'send' | 'buy' | 'help' | 'other';
  whoCommitted: 'user' | 'contact';
  dueDate?: Date;
  status: 'pending' | 'completed' | 'overdue' | 'cancelled';
  importanceLevel: number; // 1-5
  context?: string;
  reminderSentCount: number;
  mentionedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface LifeEvent {
  id: string;
  contactId: string;
  conversationId?: string;
  eventType: 'birthday' | 'job_change' | 'health' | 'relationship' | 'achievement' | 'loss' | 'celebration' | 'other';
  eventTitle: string;
  eventDescription?: string;
  eventDate: Date;
  emotionalImpact: 'positive' | 'negative' | 'neutral';
  userResponse?: string;
  followUpNeeded: boolean;
  createdAt: Date;
}

export interface ConversationInsights {
  id: string;
  conversationId: string;
  relationshipQualityChange: number; // -5 to +5
  communicationPatterns: {
    speakingTime: {
      user: number;    // percentage
      contact: number; // percentage
    };
    interruptionCount: number;
    pauseCount: number;
    averageResponseTime: number;
  };
  suggestedTopics: string[];
  actionItems: ActionItem[];
  conversationStarters: string[];
  relationshipRecommendations: string[];
  createdAt: Date;
}

export interface ActionItem {
  type: 'follow_up' | 'research' | 'schedule' | 'purchase' | 'contact_someone' | 'remember';
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
}

export interface Reminder {
  id: string;
  userId: string;
  contactId?: string;
  commitmentId?: string;
  reminderType: 'commitment_due' | 'check_in' | 'birthday' | 'follow_up' | 'life_event';
  message: string;
  scheduledFor: Date;
  status: 'scheduled' | 'sent' | 'dismissed' | 'snoozed';
  sentAt?: Date;
  snoozedUntil?: Date;
  createdAt: Date;
}

// Navigation types
export type RootStackParamList = {
  ServiceTest: undefined;
  Home: undefined;
  Contacts: undefined;
  Conversations: undefined;
  Recording: { contactId?: string };
  Settings: undefined;
  ContactDetail: { contactId: string };
  ConversationDetail: { conversationId: string };
};

// Audio recording types
export interface AudioRecordingConfig {
  sampleRate: number;
  bitRate: number;
  channels: number;
  quality: 'high' | 'medium' | 'low';
}

export interface RecordingSession {
  id: string;
  contactId?: string;
  startTime: Date;
  isRecording: boolean;
  filePath?: string;
  duration: number; // seconds
}

// State types for Redux
export interface AppState {
  contacts: ContactsState;
  conversations: ConversationsState;
  commitments: CommitmentsState;
  recording: RecordingState;
  insights: InsightsState;
  settings: SettingsState;
}

export interface ContactsState {
  contacts: Contact[];
  selectedContact?: Contact;
  loading: boolean;
  error?: string;
}

export interface ConversationsState {
  conversations: Conversation[];
  selectedConversation?: Conversation;
  loading: boolean;
  error?: string;
}

export interface CommitmentsState {
  commitments: Commitment[];
  loading: boolean;
  error?: string;
}

export interface RecordingState {
  currentSession?: RecordingSession;
  isRecording: boolean;
  isProcessing: boolean;
  error?: string;
}

export interface InsightsState {
  insights: ConversationInsights[];
  loading: boolean;
  error?: string;
}

export interface SettingsState {
  user: {
    name?: string;
    email?: string;
  };
  privacy: {
    localOnly: boolean;
    encryptionEnabled: boolean;
    deleteAfterDays?: number;
  };
  notifications: {
    enabled: boolean;
    commitmentReminders: boolean;
    checkInReminders: boolean;
    birthdayReminders: boolean;
  };
  audio: {
    quality: 'high' | 'medium' | 'low';
    autoTranscription: boolean;
  };
}