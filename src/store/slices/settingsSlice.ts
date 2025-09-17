import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SettingsState } from '../../types';

const initialState: SettingsState = {
  user: {
    name: undefined,
    email: undefined,
  },
  privacy: {
    localOnly: true,
    encryptionEnabled: true,
    deleteAfterDays: 365, // 1 year default
  },
  notifications: {
    enabled: true,
    commitmentReminders: true,
    checkInReminders: true,
    birthdayReminders: true,
  },
  audio: {
    quality: 'high',
    autoTranscription: true,
  },
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateUserProfile: (state, action: PayloadAction<{ name?: string; email?: string }>) => {
      state.user = { ...state.user, ...action.payload };
    },
    updatePrivacySettings: (state, action: PayloadAction<Partial<SettingsState['privacy']>>) => {
      state.privacy = { ...state.privacy, ...action.payload };
    },
    updateNotificationSettings: (state, action: PayloadAction<Partial<SettingsState['notifications']>>) => {
      state.notifications = { ...state.notifications, ...action.payload };
    },
    updateAudioSettings: (state, action: PayloadAction<Partial<SettingsState['audio']>>) => {
      state.audio = { ...state.audio, ...action.payload };
    },
    resetToDefaults: () => initialState,
  },
});

export const {
  updateUserProfile,
  updatePrivacySettings,
  updateNotificationSettings,
  updateAudioSettings,
  resetToDefaults,
} = settingsSlice.actions;

export default settingsSlice.reducer;