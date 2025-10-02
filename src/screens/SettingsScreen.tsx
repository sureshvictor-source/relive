import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Alert,
  StyleSheet,
  Switch,
} from 'react-native';
import {
  Header,
  Card,
  Input,
  Button,
  Text,
  Divider,
  ListItem,
  Icon,
} from 'react-native-elements';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsScreenProps {
  navigation: any;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [originalApiKey, setOriginalApiKey] = useState('');
  const [autoRecording, setAutoRecording] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [dataEncryption, setDataEncryption] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [apiKey, autoRec, notifs, encryption] = await Promise.all([
        AsyncStorage.getItem('openai_api_key'),
        AsyncStorage.getItem('auto_recording'),
        AsyncStorage.getItem('notifications'),
        AsyncStorage.getItem('data_encryption'),
      ]);

      setOpenaiApiKey(apiKey || '');
      setOriginalApiKey(apiKey || '');
      setAutoRecording(autoRec !== 'false');
      setNotifications(notifs !== 'false');
      setDataEncryption(encryption !== 'false');
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    }
    setLoading(false);
  };

  const saveApiKey = async () => {
    if (!openaiApiKey.trim()) {
      Alert.alert('Error', 'Please enter a valid OpenAI API key');
      return;
    }

    if (!openaiApiKey.startsWith('sk-')) {
      Alert.alert('Error', 'OpenAI API keys start with "sk-"');
      return;
    }

    setSaveLoading(true);
    try {
      await AsyncStorage.setItem('openai_api_key', openaiApiKey.trim());
      setOriginalApiKey(openaiApiKey.trim());

      Alert.alert(
        'Success! 🎉',
        'Your OpenAI API key has been saved securely.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error saving API key:', error);
      Alert.alert('Error', 'Failed to save API key. Please try again.');
    }
    setSaveLoading(false);
  };

  const saveSetting = async (key: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(key, value.toString());
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
      Alert.alert('Error', `Failed to save ${key} setting`);
    }
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all call recordings, transcripts, and insights. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('Success', 'All data has been cleared');
              loadSettings();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  const exportData = () => {
    Alert.alert(
      'Export Data',
      'Export feature coming soon! You will be able to export your call insights and transcripts.',
      [{ text: 'OK' }]
    );
  };

  const hasApiKeyChanged = openaiApiKey.trim() !== originalApiKey;

  return (
    <View style={styles.container}>
      <Header
        centerComponent={{
          text: 'Settings',
          style: { color: '#fff', fontSize: 20, fontWeight: 'bold' }
        }}
        leftComponent={{
          icon: 'arrow-back',
          color: '#fff',
          onPress: () => navigation.goBack()
        }}
        backgroundColor="#6366f1"
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* API Configuration */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>🔑 API Configuration</Text>

          <Input
            label="OpenAI API Key"
            placeholder="sk-..."
            value={openaiApiKey}
            onChangeText={setOpenaiApiKey}
            secureTextEntry
            leftIcon={{
              type: 'material',
              name: 'vpn-key',
              color: '#6366f1'
            }}
            inputStyle={styles.input}
            labelStyle={styles.inputLabel}
            containerStyle={styles.inputContainer}
          />

          <Text style={styles.helperText}>
            🔒 Your API key is stored securely on your device and never shared.
          </Text>

          <Button
            title={saveLoading ? 'Saving...' : 'Save API Key'}
            onPress={saveApiKey}
            disabled={!hasApiKeyChanged || saveLoading}
            loading={saveLoading}
            buttonStyle={[
              styles.saveButton,
              (!hasApiKeyChanged || saveLoading) && styles.disabledButton
            ]}
            titleStyle={styles.buttonText}
          />
        </Card>

        {/* Recording Settings */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>📱 Recording Settings</Text>

          <ListItem containerStyle={styles.listItem}>
            <Icon name="mic" type="material" color="#6366f1" />
            <ListItem.Content>
              <ListItem.Title style={styles.listTitle}>Auto Recording</ListItem.Title>
              <ListItem.Subtitle style={styles.listSubtitle}>
                Automatically record all calls
              </ListItem.Subtitle>
            </ListItem.Content>
            <Switch
              value={autoRecording}
              onValueChange={(value) => {
                setAutoRecording(value);
                saveSetting('auto_recording', value);
              }}
              trackColor={{ false: '#d1d5db', true: '#a7f3d0' }}
              thumbColor={autoRecording ? '#10b981' : '#9ca3af'}
            />
          </ListItem>

          <Divider style={styles.divider} />

          <ListItem containerStyle={styles.listItem}>
            <Icon name="notifications" type="material" color="#6366f1" />
            <ListItem.Content>
              <ListItem.Title style={styles.listTitle}>Notifications</ListItem.Title>
              <ListItem.Subtitle style={styles.listSubtitle}>
                Get notified about new insights
              </ListItem.Subtitle>
            </ListItem.Content>
            <Switch
              value={notifications}
              onValueChange={(value) => {
                setNotifications(value);
                saveSetting('notifications', value);
              }}
              trackColor={{ false: '#d1d5db', true: '#a7f3d0' }}
              thumbColor={notifications ? '#10b981' : '#9ca3af'}
            />
          </ListItem>

          <Divider style={styles.divider} />

          <ListItem containerStyle={styles.listItem}>
            <Icon name="security" type="material" color="#6366f1" />
            <ListItem.Content>
              <ListItem.Title style={styles.listTitle}>Data Encryption</ListItem.Title>
              <ListItem.Subtitle style={styles.listSubtitle}>
                Encrypt all recordings and transcripts
              </ListItem.Subtitle>
            </ListItem.Content>
            <Switch
              value={dataEncryption}
              onValueChange={(value) => {
                setDataEncryption(value);
                saveSetting('data_encryption', value);
              }}
              trackColor={{ false: '#d1d5db', true: '#a7f3d0' }}
              thumbColor={dataEncryption ? '#10b981' : '#9ca3af'}
            />
          </ListItem>
        </Card>

        {/* Data Management */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>💾 Data Management</Text>

          <Button
            title="Export Data"
            onPress={exportData}
            buttonStyle={[styles.actionButton, { backgroundColor: '#10b981' }]}
            titleStyle={styles.buttonText}
            icon={{
              name: 'download',
              type: 'material',
              size: 20,
              color: '#fff'
            }}
          />

          <Button
            title="Clear All Data"
            onPress={clearAllData}
            buttonStyle={[styles.actionButton, { backgroundColor: '#ef4444' }]}
            titleStyle={styles.buttonText}
            icon={{
              name: 'delete-forever',
              type: 'material',
              size: 20,
              color: '#fff'
            }}
          />
        </Card>

        {/* App Information */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>ℹ️ About Donna</Text>

          <Text style={styles.infoText}>
            <Text style={styles.boldText}>Version:</Text> 1.0.0{'\n'}
            <Text style={styles.boldText}>AI Model:</Text> OpenAI GPT-4{'\n'}
            <Text style={styles.boldText}>Privacy:</Text> All data encrypted locally{'\n'}
            <Text style={styles.boldText}>Support:</Text> settings@donna.ai
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  input: {
    fontSize: 16,
    color: '#1f2937',
  },
  inputLabel: {
    fontWeight: '600',
    color: '#374151',
    fontSize: 14,
    marginBottom: 8,
  },
  inputContainer: {
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 12,
  },
  disabledButton: {
    backgroundColor: '#d1d5db',
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  listItem: {
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  listSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  divider: {
    backgroundColor: '#e5e7eb',
    height: 1,
    marginVertical: 8,
  },
  actionButton: {
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  boldText: {
    fontWeight: '600',
    color: '#1f2937',
  },
});

export default SettingsScreen;