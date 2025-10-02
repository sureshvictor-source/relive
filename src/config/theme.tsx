import React from 'react';
import { ThemeProvider } from 'react-native-elements';
import { StatusBar } from 'react-native';

const donnaTheme = {
  colors: {
    primary: '#6366f1',
    secondary: '#10b981',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    text: '#1f2937',
    white: '#ffffff',
    black: '#000000',
    grey0: '#f9fafb',
    grey1: '#f3f4f6',
    grey2: '#e5e7eb',
    grey3: '#d1d5db',
    grey4: '#9ca3af',
    grey5: '#6b7280',
  },
  Button: {
    raised: true,
    buttonStyle: {
      borderRadius: 8,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    titleStyle: {
      fontWeight: '600',
      fontSize: 16,
    },
  },
  Input: {
    inputStyle: {
      fontSize: 16,
      color: '#1f2937',
    },
    inputContainerStyle: {
      borderBottomWidth: 2,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    labelStyle: {
      fontWeight: '600',
      color: '#374151',
      fontSize: 14,
      marginBottom: 8,
    },
  },
  Card: {
    containerStyle: {
      borderRadius: 12,
      marginVertical: 8,
      marginHorizontal: 0,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
  },
  Header: {
    backgroundColor: '#6366f1',
    centerComponentStyle: {
      color: '#ffffff',
      fontSize: 20,
      fontWeight: 'bold',
    },
  },
};

interface DonnaThemeProviderProps {
  children: React.ReactNode;
}

export const DonnaThemeProvider: React.FC<DonnaThemeProviderProps> = ({ children }) => {
  return (
    <ThemeProvider theme={donnaTheme}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#6366f1"
        translucent={true}
      />
      {children}
    </ThemeProvider>
  );
};

export { donnaTheme };