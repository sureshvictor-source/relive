import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RecordingState, RecordingSession } from '../../types';

const initialState: RecordingState = {
  currentSession: undefined,
  isRecording: false,
  isProcessing: false,
  error: undefined,
};

// Async thunks for recording operations
export const startRecording = createAsyncThunk(
  'recording/startRecording',
  async (contactId?: string) => {
    // TODO: Implement actual audio recording
    // const session = await AudioService.startRecording(contactId);
    // return session;

    const session: RecordingSession = {
      id: Date.now().toString(),
      contactId,
      startTime: new Date(),
      isRecording: true,
      duration: 0,
    };
    return session;
  }
);

export const stopRecording = createAsyncThunk(
  'recording/stopRecording',
  async (_, { getState }) => {
    // TODO: Implement actual audio recording stop
    // const result = await AudioService.stopRecording();
    // return result;

    const state = getState() as { recording: RecordingState };
    const session = state.recording.currentSession;

    if (!session) {
      throw new Error('No active recording session');
    }

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

    return {
      ...session,
      isRecording: false,
      duration,
      filePath: `/recordings/${session.id}.wav`, // Mock file path
    };
  }
);

export const pauseRecording = createAsyncThunk(
  'recording/pauseRecording',
  async () => {
    // TODO: Implement pause functionality
    // await AudioService.pauseRecording();
  }
);

export const resumeRecording = createAsyncThunk(
  'recording/resumeRecording',
  async () => {
    // TODO: Implement resume functionality
    // await AudioService.resumeRecording();
  }
);

const recordingSlice = createSlice({
  name: 'recording',
  initialState,
  reducers: {
    setProcessing: (state, action: PayloadAction<boolean>) => {
      state.isProcessing = action.payload;
    },
    clearError: (state) => {
      state.error = undefined;
    },
    updateDuration: (state, action: PayloadAction<number>) => {
      if (state.currentSession) {
        state.currentSession.duration = action.payload;
      }
    },
    clearSession: (state) => {
      state.currentSession = undefined;
      state.isRecording = false;
      state.isProcessing = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Start recording
      .addCase(startRecording.pending, (state) => {
        state.error = undefined;
      })
      .addCase(startRecording.fulfilled, (state, action) => {
        state.currentSession = action.payload;
        state.isRecording = true;
      })
      .addCase(startRecording.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to start recording';
        state.isRecording = false;
      })
      // Stop recording
      .addCase(stopRecording.pending, (state) => {
        state.isProcessing = true;
      })
      .addCase(stopRecording.fulfilled, (state, action) => {
        state.currentSession = action.payload;
        state.isRecording = false;
        state.isProcessing = false;
      })
      .addCase(stopRecording.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to stop recording';
        state.isRecording = false;
        state.isProcessing = false;
      })
      // Pause recording
      .addCase(pauseRecording.fulfilled, (state) => {
        state.isRecording = false;
      })
      // Resume recording
      .addCase(resumeRecording.fulfilled, (state) => {
        state.isRecording = true;
      });
  },
});

export const {
  setProcessing,
  clearError,
  updateDuration,
  clearSession,
} = recordingSlice.actions;

export default recordingSlice.reducer;