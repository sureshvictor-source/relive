import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import contactsReducer from './slices/contactsSlice';
import conversationsReducer from './slices/conversationsSlice';
import commitmentsReducer from './slices/commitmentsSlice';
import recordingReducer from './slices/recordingSlice';
import insightsReducer from './slices/insightsSlice';
import settingsReducer from './slices/settingsSlice';

export const store = configureStore({
  reducer: {
    contacts: contactsReducer,
    conversations: conversationsReducer,
    commitments: commitmentsReducer,
    recording: recordingReducer,
    insights: insightsReducer,
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks for use throughout the app
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;