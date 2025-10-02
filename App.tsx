/**
 * Donna - AI-Powered Call Insights Companion
 * @format
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';

import { store } from './src/store';
import { DonnaThemeProvider } from './src/config/theme';
import DashboardScreen from './src/screens/DashboardScreen';
import PermissionsScreen from './src/screens/PermissionsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Legacy screens for fallback
import ServiceTestScreen from './src/components/ServiceTestScreen';

const Stack = createStackNavigator();

function App() {
  const [initialRoute, setInitialRoute] = useState<string>('Dashboard');

  useEffect(() => {
    // For demo purposes, we'll start with Dashboard
    // In production, check permissions and route accordingly
    setInitialRoute('Dashboard');
  }, []);

  return (
    <Provider store={store}>
      <DonnaThemeProvider>
        <SafeAreaProvider>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName={initialRoute}
              screenOptions={{
                headerShown: false,
                cardStyle: { backgroundColor: '#f9fafb' },
                gestureEnabled: true,
                gestureDirection: 'horizontal',
              }}
            >
            {/* Main Donna Screens */}
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{
                title: 'Donna - AI Call Insights',
              }}
            />
            <Stack.Screen
              name="Permissions"
              component={PermissionsScreen}
              options={{
                title: 'Setup Donna',
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                title: 'Settings',
              }}
            />

            {/* Legacy Service Test Screen for Development */}
            <Stack.Screen
              name="ServiceTest"
              component={ServiceTestScreen}
              options={{
                title: 'Donna - Service Test',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#6366f1',
                },
                headerTintColor: '#ffffff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </DonnaThemeProvider>
  </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
