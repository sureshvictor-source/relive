export interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  avatar?: string;
  company?: string;
  lastContactDate: Date;
  totalCalls: number;
  totalDuration: number;
  relationshipScore: number; // AI-derived score 0-100
  tags: string[];
  notes?: string;
  whatsappAvailable?: boolean;
}

export interface CallRecord {
  id: string;
  contactId?: string;
  phoneNumber: string;
  contactName?: string;
  type: 'incoming' | 'outgoing' | 'missed';
  startTime: Date;
  duration: number; // in seconds
  status: 'completed' | 'recording' | 'processing' | 'failed';
  audioFilePath?: string;
  transcriptStatus: 'pending' | 'processing' | 'completed' | 'failed';
  encryptedTranscript?: string;
  rawTranscript?: string; // Temporary, gets encrypted
  insightsGenerated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CallInsight {
  id: string;
  callId: string;
  type: 'sentiment' | 'summary' | 'action_item' | 'follow_up' | 'keyword' | 'topic' | 'mood';
  title: string;
  content: string;
  confidence: number; // 0-1
  timestamp?: number; // Position in call
  priority: 'low' | 'medium' | 'high';
  isActionable: boolean;
  completed?: boolean;
  dueDate?: Date;
  createdAt: Date;
}

export interface CallSummary {
  id: string;
  callId: string;
  overallSentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // -1 to 1
  keyTopics: string[];
  mainPurpose: string;
  outcome: string;
  actionItems: string[];
  followUpRequired: boolean;
  followUpDate?: Date;
  customerSatisfaction?: number; // 1-5
  callQuality: number; // 1-5
  mood: {
    caller: 'happy' | 'neutral' | 'frustrated' | 'angry' | 'excited';
    recipient: 'happy' | 'neutral' | 'frustrated' | 'angry' | 'excited';
  };
  language: string;
  createdAt: Date;
}

export interface TranscriptSegment {
  id: string;
  callId: string;
  speaker: 'caller' | 'recipient';
  text: string;
  startTime: number; // seconds from call start
  duration: number;
  confidence: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  keywords: string[];
}

export interface CallAnalytics {
  totalCalls: number;
  totalDuration: number;
  averageCallDuration: number;
  callsByType: {
    incoming: number;
    outgoing: number;
    missed: number;
  };
  callsByTime: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  sentimentTrend: Array<{
    date: string;
    score: number;
  }>;
  topContacts: Array<{
    contactId: string;
    name: string;
    callCount: number;
    totalDuration: number;
  }>;
  weeklyStats: Array<{
    week: string;
    calls: number;
    duration: number;
  }>;
}

export interface PermissionState {
  microphone: 'granted' | 'denied' | 'not-requested';
  phoneState: 'granted' | 'denied' | 'not-requested';
  contacts: 'granted' | 'denied' | 'not-requested';
  storage: 'granted' | 'denied' | 'not-requested';
  notifications: 'granted' | 'denied' | 'not-requested';
}

export interface AppSettings {
  autoRecording: boolean;
  recordIncoming: boolean;
  recordOutgoing: boolean;
  transcriptionEnabled: boolean;
  insightsEnabled: boolean;
  encryptionEnabled: boolean;
  autoDeleteAfter: number; // days, 0 = never
  audioQuality: 'low' | 'medium' | 'high';
  language: string;
  notificationsEnabled: boolean;
  backupEnabled: boolean;
  cloudSyncEnabled: boolean;
}

export type CallStatus = 'idle' | 'incoming' | 'outgoing' | 'active' | 'recording' | 'ended';

export interface CallState {
  currentCall?: {
    id: string;
    phoneNumber: string;
    contactName?: string;
    type: 'incoming' | 'outgoing';
    startTime: Date;
    isRecording: boolean;
  };
  status: CallStatus;
  recordingEnabled: boolean;
  permissions: PermissionState;
}