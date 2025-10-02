import OpenAI from 'openai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

export interface TranscriptionResult {
  text: string;
  segments: Array<{
    text: string;
    start: number;
    end: number;
    speaker?: string;
  }>;
  confidence: number;
  language: string;
}

export interface CommitmentExtractionResult {
  commitments: Array<{
    id: string;
    text: string;
    whoCommitted: 'user' | 'contact';
    dueDate?: string;
    priority: 'low' | 'medium' | 'high';
    category: string;
    confidence: number;
  }>;
  summary: string;
}

export interface EmotionalAnalysisResult {
  overallTone: 'positive' | 'negative' | 'neutral' | 'mixed';
  emotionalScores: {
    joy: number;
    anger: number;
    sadness: number;
    fear: number;
    surprise: number;
    trust: number;
  };
  sentimentScore: number; // -1 to 1
  engagementLevel: number; // 1 to 10
  stressLevel: number; // 1 to 10
  insights: string[];
}

export interface ConversationInsights {
  keyTopics: string[];
  relationshipDynamics: {
    dominance: 'user' | 'contact' | 'balanced';
    supportLevel: number; // 1 to 10
    conflictLevel: number; // 1 to 10
    intimacyLevel: number; // 1 to 10
  };
  actionItems: string[];
  followUpSuggestions: string[];
  conversationQuality: number; // 1 to 10
}

class OpenAIService {
  private client: OpenAI | null = null;
  private apiKey: string | null = null;
  private isInitialized = false;

  constructor() {
    this.loadApiKey();
  }

  /**
   * Load API key from secure storage
   */
  private async loadApiKey(): Promise<void> {
    try {
      const storedKey = await AsyncStorage.getItem('openai_api_key');
      if (storedKey) {
        this.setApiKey(storedKey);
      }
    } catch (error) {
      console.error('Failed to load OpenAI API key:', error);
    }
  }

  /**
   * Set OpenAI API key and initialize client
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.client = new OpenAI({
      apiKey: apiKey,
      // Note: In production, you might need to use a proxy server
      // to avoid CORS issues in React Native
    });
    this.isInitialized = true;

    // Store API key securely
    AsyncStorage.setItem('openai_api_key', apiKey);
  }

  /**
   * Check if service is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Transcribe audio file to text using Whisper API
   */
  async transcribeAudio(audioFilePath: string): Promise<TranscriptionResult | null> {
    if (!this.isReady()) {
      console.error('OpenAI service not initialized');
      return null;
    }

    try {
      // Check if file exists
      const fileExists = await RNFS.exists(audioFilePath);
      if (!fileExists) {
        console.error('Audio file not found:', audioFilePath);
        return null;
      }

      // For React Native, we need to use fetch with FormData directly
      // since OpenAI SDK doesn't handle React Native file uploads well
      const formData = new FormData();
      formData.append('file', {
        uri: audioFilePath,
        type: 'audio/wav', // Based on our recording format
        name: 'recording.wav',
      } as any);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('language', 'en');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      return {
        text: result.text,
        segments: result.segments?.map((segment: any) => ({
          text: segment.text,
          start: segment.start,
          end: segment.end,
        })) || [],
        confidence: 0.85, // Whisper doesn't provide confidence, so we estimate
        language: result.language || 'en',
      };
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      
      // Fallback to mock transcription for development
      if (__DEV__) {
        console.warn('Using mock transcription for development');
        return this.mockTranscription(audioFilePath);
      }
      
      return null;
    }
  }

  /**
   * Mock transcription for development/testing
   */
  private mockTranscription(audioFilePath: string): TranscriptionResult {
    const mockTexts = [
      "Hey, how are you doing today?",
      "I wanted to follow up on our conversation from yesterday.",
      "Let's schedule a meeting next week to discuss the project.",
      "Thanks for calling, I really appreciate you reaching out.",
      "Can we reschedule our lunch for Friday instead of Thursday?"
    ];

    const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)];

    return {
      text: randomText,
      segments: [{
        text: randomText,
        start: 0,
        end: 5,
      }],
      confidence: 0.95,
      language: 'en',
    };
  }

  /**
   * Extract commitments from conversation text
   */
  async extractCommitments(conversationText: string, contactName?: string): Promise<CommitmentExtractionResult | null> {
    if (!this.isReady()) {
      console.error('OpenAI service not initialized');
      return null;
    }

    try {
      const prompt = `
Analyze the following conversation and extract any commitments, promises, or actionable items made by either person.

Conversation:
${conversationText}

Please identify:
1. Specific commitments or promises made
2. Who made each commitment (user or ${contactName || 'contact'})
3. Any mentioned deadlines or timeframes
4. Priority level (low/medium/high)
5. Category (work, personal, social, etc.)

Format your response as JSON with the following structure:
{
  "commitments": [
    {
      "text": "exact commitment text",
      "whoCommitted": "user" or "contact",
      "dueDate": "YYYY-MM-DD or null",
      "priority": "low/medium/high",
      "category": "category name",
      "confidence": 0.0-1.0
    }
  ],
  "summary": "brief summary of the conversation"
}
`;

      const response = await this.client!.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing conversations and extracting commitments and actionable items. Be precise and only extract clear, specific commitments.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const result = JSON.parse(content);

        // Add unique IDs to commitments
        result.commitments = result.commitments.map((commitment: any) => ({
          ...commitment,
          id: `commitment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        }));

        return result;
      }

      return null;
    } catch (error) {
      console.error('Failed to extract commitments:', error);
      return null;
    }
  }

  /**
   * Analyze emotional tone and sentiment of conversation
   */
  async analyzeEmotionalTone(conversationText: string): Promise<EmotionalAnalysisResult | null> {
    if (!this.isReady()) {
      console.error('OpenAI service not initialized');
      return null;
    }

    try {
      const prompt = `
Analyze the emotional tone and sentiment of this conversation:

${conversationText}

Provide a detailed emotional analysis including:
1. Overall emotional tone
2. Specific emotion scores (0-1 scale)
3. Sentiment score (-1 to 1)
4. Engagement level (1-10)
5. Stress level indicators (1-10)
6. Key insights about the emotional dynamics

Format as JSON:
{
  "overallTone": "positive/negative/neutral/mixed",
  "emotionalScores": {
    "joy": 0.0-1.0,
    "anger": 0.0-1.0,
    "sadness": 0.0-1.0,
    "fear": 0.0-1.0,
    "surprise": 0.0-1.0,
    "trust": 0.0-1.0
  },
  "sentimentScore": -1.0 to 1.0,
  "engagementLevel": 1-10,
  "stressLevel": 1-10,
  "insights": ["insight 1", "insight 2", ...]
}
`;

      const response = await this.client!.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert emotional intelligence analyst. Analyze conversations with empathy and psychological insight.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 800,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }

      return null;
    } catch (error) {
      console.error('Failed to analyze emotional tone:', error);
      return null;
    }
  }

  /**
   * Generate comprehensive conversation insights
   */
  async generateConversationInsights(
    conversationText: string,
    contactName?: string,
    relationshipType?: string
  ): Promise<ConversationInsights | null> {
    if (!this.isReady()) {
      console.error('OpenAI service not initialized');
      return null;
    }

    try {
      const prompt = `
Analyze this conversation for relationship insights:

Conversation:
${conversationText}

Context:
- Contact: ${contactName || 'Unknown'}
- Relationship: ${relationshipType || 'Unknown'}

Provide insights about:
1. Key conversation topics
2. Relationship dynamics and balance
3. Action items that emerged
4. Follow-up suggestions
5. Overall conversation quality

Format as JSON:
{
  "keyTopics": ["topic1", "topic2", ...],
  "relationshipDynamics": {
    "dominance": "user/contact/balanced",
    "supportLevel": 1-10,
    "conflictLevel": 1-10,
    "intimacyLevel": 1-10
  },
  "actionItems": ["action1", "action2", ...],
  "followUpSuggestions": ["suggestion1", "suggestion2", ...],
  "conversationQuality": 1-10
}
`;

      const response = await this.client!.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a relationship counselor and communication expert. Analyze conversations to provide helpful insights for strengthening relationships.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }

      return null;
    } catch (error) {
      console.error('Failed to generate conversation insights:', error);
      return null;
    }
  }

  /**
   * Generate follow-up suggestions based on conversation
   */
  async generateFollowUpSuggestions(
    conversationText: string,
    contactName?: string,
    relationshipType?: string
  ): Promise<string[] | null> {
    if (!this.isReady()) {
      console.error('OpenAI service not initialized');
      return null;
    }

    try {
      const prompt = `
Based on this conversation, suggest thoughtful follow-up actions to strengthen the relationship:

Conversation:
${conversationText}

Context:
- Contact: ${contactName || 'Unknown'}
- Relationship: ${relationshipType || 'Unknown'}

Provide 3-5 specific, actionable follow-up suggestions that would show care and maintain the relationship.
Return as a JSON array of strings.
`;

      const response = await this.client!.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a relationship expert who helps people maintain and strengthen their personal connections through thoughtful actions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }

      return null;
    } catch (error) {
      console.error('Failed to generate follow-up suggestions:', error);
      return null;
    }
  }

  /**
   * Summarize conversation for quick review
   */
  async summarizeConversation(conversationText: string, maxLength: number = 150): Promise<string | null> {
    if (!this.isReady()) {
      console.error('OpenAI service not initialized');
      return null;
    }

    try {
      const prompt = `
Summarize this conversation in ${maxLength} characters or less, focusing on the main topics and any important outcomes:

${conversationText}
`;

      const response = await this.client!.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a skilled summarizer who creates concise, meaningful summaries of conversations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: Math.floor(maxLength / 2), // Approximate token limit
      });

      return response.choices[0]?.message?.content || null;
    } catch (error) {
      console.error('Failed to summarize conversation:', error);
      return null;
    }
  }

  /**
   * Clear stored API key
   */
  async clearApiKey(): Promise<void> {
    this.apiKey = null;
    this.client = null;
    this.isInitialized = false;
    await AsyncStorage.removeItem('openai_api_key');
  }
}

export default new OpenAIService();