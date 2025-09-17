import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Conversation, ConversationsState } from '../../types';

const initialState: ConversationsState = {
  conversations: [],
  selectedConversation: undefined,
  loading: false,
  error: undefined,
};

export const fetchConversations = createAsyncThunk(
  'conversations/fetchConversations',
  async (contactId?: string) => {
    // TODO: Implement database fetch
    return [];
  }
);

export const addConversation = createAsyncThunk(
  'conversations/addConversation',
  async (conversation: Omit<Conversation, 'id' | 'createdAt'>) => {
    // TODO: Implement database insert
    const newConversation: Conversation = {
      ...conversation,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    return newConversation;
  }
);

const conversationsSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    setSelectedConversation: (state, action) => {
      state.selectedConversation = action.payload;
    },
    clearSelectedConversation: (state) => {
      state.selectedConversation = undefined;
    },
    clearError: (state) => {
      state.error = undefined;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loading = false;
        state.conversations = action.payload;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(addConversation.fulfilled, (state, action) => {
        state.conversations.unshift(action.payload);
      });
  },
});

export const {
  setSelectedConversation,
  clearSelectedConversation,
  clearError,
} = conversationsSlice.actions;

export default conversationsSlice.reducer;