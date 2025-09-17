import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { ConversationInsights, InsightsState } from '../../types';

const initialState: InsightsState = {
  insights: [],
  loading: false,
  error: undefined,
};

export const generateInsights = createAsyncThunk(
  'insights/generateInsights',
  async (conversationId: string) => {
    // TODO: Implement AI insights generation
    // const insights = await AIService.generateInsights(conversationId);
    // return insights;

    const mockInsights: ConversationInsights = {
      id: Date.now().toString(),
      conversationId,
      relationshipQualityChange: 1,
      communicationPatterns: {
        speakingTime: { user: 45, contact: 55 },
        interruptionCount: 2,
        pauseCount: 5,
        averageResponseTime: 1.2,
      },
      suggestedTopics: ['Ask about their new job', 'Follow up on health appointment'],
      actionItems: [
        {
          type: 'follow_up',
          description: 'Check in about their job interview results',
          priority: 'high',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        },
      ],
      conversationStarters: [
        'How did your presentation go?',
        'Have you heard back about the job?',
      ],
      relationshipRecommendations: [
        'Schedule a follow-up call next week',
        'Send a supportive message about their interview',
      ],
      createdAt: new Date(),
    };

    return mockInsights;
  }
);

const insightsSlice = createSlice({
  name: 'insights',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = undefined;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateInsights.pending, (state) => {
        state.loading = true;
      })
      .addCase(generateInsights.fulfilled, (state, action) => {
        state.loading = false;
        state.insights.push(action.payload);
      })
      .addCase(generateInsights.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const { clearError } = insightsSlice.actions;
export default insightsSlice.reducer;