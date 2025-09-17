import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Commitment, CommitmentsState } from '../../types';

const initialState: CommitmentsState = {
  commitments: [],
  loading: false,
  error: undefined,
};

export const fetchCommitments = createAsyncThunk(
  'commitments/fetchCommitments',
  async () => {
    // TODO: Implement database fetch
    return [];
  }
);

export const addCommitment = createAsyncThunk(
  'commitments/addCommitment',
  async (commitment: Omit<Commitment, 'id' | 'createdAt'>) => {
    // TODO: Implement database insert
    const newCommitment: Commitment = {
      ...commitment,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    return newCommitment;
  }
);

export const updateCommitmentStatus = createAsyncThunk(
  'commitments/updateStatus',
  async ({ id, status }: { id: string; status: Commitment['status'] }) => {
    // TODO: Implement database update
    return { id, status, completedAt: status === 'completed' ? new Date() : undefined };
  }
);

const commitmentsSlice = createSlice({
  name: 'commitments',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = undefined;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCommitments.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCommitments.fulfilled, (state, action) => {
        state.loading = false;
        state.commitments = action.payload;
      })
      .addCase(addCommitment.fulfilled, (state, action) => {
        state.commitments.push(action.payload);
      })
      .addCase(updateCommitmentStatus.fulfilled, (state, action) => {
        const commitment = state.commitments.find(c => c.id === action.payload.id);
        if (commitment) {
          commitment.status = action.payload.status;
          commitment.completedAt = action.payload.completedAt;
        }
      });
  },
});

export default commitmentsSlice.reducer;