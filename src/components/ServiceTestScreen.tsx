import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import ServiceInitializer, { InitializationReport, ServiceStatus } from '../services/ServiceInitializer';
import AudioRecordingService from '../services/AudioRecordingService';
import EncryptionService from '../services/EncryptionService';
import OpenAIService from '../services/OpenAIService';
import AppConfig from '../config/AppConfig';
import { AudioTranscriptionTest } from '../services/__tests__/AudioTranscriptionTest';

const ServiceTestScreen: React.FC = () => {
  const [initReport, setInitReport] = useState<InitializationReport | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [apiKey, setApiKey] = useState<string>('');
  const [currentApiKey, setCurrentApiKey] = useState<string>('');

  useEffect(() => {
    initializeServices();
    loadCurrentApiKey();
  }, []);

  const loadCurrentApiKey = async () => {
    try {
      const config = await AppConfig.getConfig();
      if (config.openai.apiKey) {
        setCurrentApiKey(config.openai.apiKey.substring(0, 10) + '...');
      }
    } catch (error) {
      console.error('Failed to load current API key:', error);
    }
  };

  const initializeServices = async () => {
    setIsInitializing(true);
    try {
      const report = await ServiceInitializer.initializeAllServices();
      setInitReport(report);
    } catch (error) {
      console.error('Service initialization failed:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const testAudioRecording = async () => {
    try {
      setTestResults(prev => ({ ...prev, audio: 'Testing...' }));

      if (isRecording) {
        const session = await AudioRecordingService.stopRecording();
        setIsRecording(false);
        if (session) {
          setTestResults(prev => ({
            ...prev,
            audio: `✅ Recording stopped. Duration: ${Math.round(session.duration / 1000)}s, Size: ${session.fileSize} bytes`
          }));
        } else {
          setTestResults(prev => ({ ...prev, audio: '❌ Failed to stop recording' }));
        }
      } else {
        const session = await AudioRecordingService.startRecording();
        if (session) {
          setIsRecording(true);
          setTestResults(prev => ({ ...prev, audio: '✅ Recording started! Tap again to stop.' }));
        } else {
          setTestResults(prev => ({ ...prev, audio: '❌ Failed to start recording' }));
        }
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, audio: `❌ Error: ${error}` }));
    }
  };

  const testEncryption = async () => {
    try {
      setTestResults(prev => ({ ...prev, encryption: 'Testing...' }));

      const testData = 'Hello, this is a test message for encryption!';
      const encrypted = await EncryptionService.encryptData(testData);

      if (!encrypted) {
        setTestResults(prev => ({ ...prev, encryption: '❌ Encryption failed' }));
        return;
      }

      const decrypted = await EncryptionService.decryptData(encrypted);

      if (decrypted === testData) {
        setTestResults(prev => ({
          ...prev,
          encryption: `✅ Encryption test passed! Encrypted ${testData.length} chars`
        }));
      } else {
        setTestResults(prev => ({ ...prev, encryption: '❌ Decryption mismatch' }));
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, encryption: `❌ Error: ${error}` }));
    }
  };

  const testOpenAI = async () => {
    try {
      setTestResults(prev => ({ ...prev, openai: 'Testing...' }));

      if (!OpenAIService.isReady()) {
        setTestResults(prev => ({
          ...prev,
          openai: '⚠️  OpenAI not configured. Add API key in settings.'
        }));
        return;
      }

      const summary = await OpenAIService.summarizeConversation(
        'This is a test conversation to verify OpenAI integration is working correctly.'
      );

      if (summary) {
        setTestResults(prev => ({
          ...prev,
          openai: `✅ OpenAI test passed! Summary: "${summary.substring(0, 50)}..."`
        }));
      } else {
        setTestResults(prev => ({ ...prev, openai: '❌ OpenAI test failed' }));
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, openai: `❌ Error: ${error}` }));
    }
  };

  const saveApiKey = async () => {
    if (!apiKey || !apiKey.startsWith('sk-')) {
      Alert.alert('Invalid API Key', 'Please enter a valid OpenAI API key that starts with "sk-"');
      return;
    }

    try {
      await AppConfig.setOpenAIApiKey(apiKey);
      OpenAIService.setApiKey(apiKey);
      setCurrentApiKey(apiKey.substring(0, 10) + '...');
      setApiKey('');
      Alert.alert('Success', 'OpenAI API key saved successfully!');

      // Reinitialize services to pick up the new API key
      await initializeServices();
    } catch (error) {
      Alert.alert('Error', 'Failed to save API key. Please try again.');
      console.error('Failed to save API key:', error);
    }
  };

  const clearApiKey = async () => {
    try {
      await AppConfig.setOpenAIApiKey('');
      OpenAIService.setApiKey('');
      setCurrentApiKey('');
      setApiKey('');
      Alert.alert('Success', 'OpenAI API key cleared!');
      await initializeServices();
    } catch (error) {
      Alert.alert('Error', 'Failed to clear API key.');
      console.error('Failed to clear API key:', error);
    }
  };

  const runAudioTranscriptionTests = async () => {
    try {
      setTestResults(prev => ({ ...prev, fullTest: '🧪 Running comprehensive tests...' }));
      
      // Run the comprehensive test suite
      const results = {
        audioRecording: await AudioTranscriptionTest.testAudioRecording(),
        transcription: await AudioTranscriptionTest.testTranscription(),
        openAI: await AudioTranscriptionTest.testOpenAISetup(),
        completeWorkflow: await AudioTranscriptionTest.testCompleteWorkflow(),
      };

      const passedCount = Object.values(results).filter(Boolean).length;
      const totalCount = Object.keys(results).length;

      let resultText = `📊 Test Results: ${passedCount}/${totalCount} passed\n\n`;
      resultText += `${results.audioRecording ? '✅' : '❌'} Audio Recording\n`;
      resultText += `${results.transcription ? '✅' : '❌'} Transcription\n`;
      resultText += `${results.openAI ? '✅' : '❌'} OpenAI Integration\n`;
      resultText += `${results.completeWorkflow ? '✅' : '❌'} Complete Workflow\n\n`;

      if (passedCount === totalCount) {
        resultText += '🎉 All systems ready for Donna!';
      } else {
        resultText += '⚠️  Some tests failed. Check console for details.';
      }

      setTestResults(prev => ({ ...prev, fullTest: resultText }));
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        fullTest: `❌ Test suite failed: ${error}` 
      }));
      console.error('Test suite error:', error);
    }
  };

  const promptForOpenAIKey = () => {
    Alert.prompt(
      'OpenAI API Key',
      'Enter your OpenAI API key to enable AI features:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (apiKey) => {
            if (apiKey) {
              await AppConfig.setOpenAIApiKey(apiKey);
              OpenAIService.setApiKey(apiKey);
              Alert.alert('Success', 'OpenAI API key saved!');
            }
          },
        },
      ],
      'secure-text'
    );
  };

  const renderServiceStatus = (status: ServiceStatus) => {
    return (
      <View key={status.name} style={styles.serviceItem}>
        <View style={styles.serviceHeader}>
          <Text style={styles.serviceName}>{status.name}</Text>
          <Text style={[styles.serviceStatus, status.initialized ? styles.success : styles.error]}>
            {status.initialized ? '✅' : '❌'}
          </Text>
        </View>
        {status.error && (
          <Text style={styles.errorText}>{status.error}</Text>
        )}
        {status.dependencies.length > 0 && (
          <Text style={styles.dependencies}>
            Dependencies: {status.dependencies.join(', ')}
          </Text>
        )}
      </View>
    );
  };

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing Services...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Relive Service Test Dashboard</Text>

      {initReport && (
        <View style={styles.reportContainer}>
          <Text style={styles.sectionTitle}>Initialization Report</Text>
          <Text style={styles.reportText}>
            Success: {initReport.success ? '✅' : '❌'}
          </Text>
          <Text style={styles.reportText}>
            Services: {initReport.initializedServices}/{initReport.totalServices}
          </Text>
          <Text style={styles.reportText}>
            Time: {initReport.initializationTime}ms
          </Text>
          {initReport.failedServices.length > 0 && (
            <Text style={styles.errorText}>
              Failed: {initReport.failedServices.join(', ')}
            </Text>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Statuses</Text>
        {initReport?.serviceStatuses.map(renderServiceStatus)}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Tests</Text>

        <TouchableOpacity style={styles.testButton} onPress={testAudioRecording}>
          <Text style={styles.testButtonText}>
            {isRecording ? 'Stop Audio Recording' : 'Test Audio Recording'}
          </Text>
        </TouchableOpacity>
        {testResults.audio && (
          <Text style={styles.testResult}>{testResults.audio}</Text>
        )}

        <TouchableOpacity style={styles.testButton} onPress={testEncryption}>
          <Text style={styles.testButtonText}>Test Encryption</Text>
        </TouchableOpacity>
        {testResults.encryption && (
          <Text style={styles.testResult}>{testResults.encryption}</Text>
        )}

        <TouchableOpacity style={styles.testButton} onPress={testOpenAI}>
          <Text style={styles.testButtonText}>Test OpenAI Integration</Text>
        </TouchableOpacity>
        {testResults.openai && (
          <Text style={styles.testResult}>{testResults.openai}</Text>
        )}

        <TouchableOpacity 
          style={[styles.testButton, { backgroundColor: '#FF6B35' }]} 
          onPress={() => runAudioTranscriptionTests()}
        >
          <Text style={styles.testButtonText}>Run Complete Audio & Transcription Tests</Text>
        </TouchableOpacity>
        {testResults.fullTest && (
          <Text style={styles.testResult}>{testResults.fullTest}</Text>
        )}

        <View style={styles.apiKeySection}>
          <Text style={styles.apiKeyLabel}>OpenAI API Key Configuration</Text>

          {currentApiKey ? (
            <View style={styles.currentKeyContainer}>
              <Text style={styles.currentKeyLabel}>Current Key:</Text>
              <Text style={styles.currentKeyText}>{currentApiKey}</Text>
              <TouchableOpacity style={styles.clearButton} onPress={clearApiKey}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.noKeyText}>No API key configured</Text>
          )}

          <TextInput
            style={styles.apiKeyInput}
            placeholder="Enter your OpenAI API key (sk-...)"
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry={true}
            autoCorrect={false}
            autoCapitalize="none"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.saveButton, !apiKey && styles.disabledButton]}
              onPress={saveApiKey}
              disabled={!apiKey}
            >
              <Text style={styles.saveButtonText}>Save API Key</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.configButton} onPress={promptForOpenAIKey}>
              <Text style={styles.configButtonText}>Use Popup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.refreshButton} onPress={initializeServices}>
        <Text style={styles.refreshButtonText}>Reinitialize Services</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  reportContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  reportText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  serviceItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  serviceStatus: {
    fontSize: 16,
  },
  success: {
    color: '#4CAF50',
  },
  error: {
    color: '#F44336',
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 4,
  },
  dependencies: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  testButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  testButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  configButton: {
    backgroundColor: '#FF9500',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  configButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  testResult: {
    fontSize: 14,
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
    color: '#333',
  },
  refreshButton: {
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 32,
  },
  refreshButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  apiKeySection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  apiKeyLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  currentKeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#e8f5e8',
    borderRadius: 6,
  },
  currentKeyLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginRight: 8,
  },
  currentKeyText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    fontFamily: 'monospace',
  },
  clearButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  noKeyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  apiKeyInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: 'white',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
});

export default ServiceTestScreen;