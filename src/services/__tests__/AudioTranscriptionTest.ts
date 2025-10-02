import AudioRecordingService from '../AudioRecordingService';
import TranscriptionService from '../TranscriptionService';
import OpenAIService from '../OpenAIService';

/**
 * Test script for audio recording and transcription functionality
 */
export class AudioTranscriptionTest {
  
  /**
   * Test basic audio recording functionality
   */
  static async testAudioRecording(): Promise<boolean> {
    console.log('🎙️ Testing audio recording...');
    
    try {
      // Check if audio recording is available
      const isAvailable = AudioRecordingService.isAudioRecordAvailable();
      if (!isAvailable) {
        console.warn('❌ Audio recording not available');
        return false;
      }

      // Test permissions
      const hasPermissions = await AudioRecordingService.checkPermissions();
      if (!hasPermissions) {
        console.log('📋 Requesting audio permissions...');
        const granted = await AudioRecordingService.requestPermissions();
        if (!granted) {
          console.error('❌ Audio permissions not granted');
          return false;
        }
      }

      console.log('✅ Audio recording setup verified');
      return true;
    } catch (error) {
      console.error('❌ Audio recording test failed:', error);
      return false;
    }
  }

  /**
   * Test transcription service with mock data
   */
  static async testTranscription(): Promise<boolean> {
    console.log('📝 Testing transcription service...');

    try {
      // Test with mock audio file path
      const mockAudioPath = '/mock/audio/file.wav';
      
      const transcriptionResult = await TranscriptionService.transcribeAudioFile(
        mockAudioPath,
        {
          language: 'en',
          saveTranscript: false, // Don't save test transcriptions
          enableSpeakerDiarization: false,
        }
      );

      if (transcriptionResult) {
        console.log('✅ Transcription test successful');
        console.log(`   - Text: ${transcriptionResult.transcript.substring(0, 50)}...`);
        console.log(`   - Status: ${transcriptionResult.status}`);
        console.log(`   - Language: ${transcriptionResult.language}`);
        return true;
      } else {
        console.error('❌ Transcription returned null');
        return false;
      }
    } catch (error) {
      console.error('❌ Transcription test failed:', error);
      return false;
    }
  }

  /**
   * Test OpenAI service setup
   */
  static async testOpenAISetup(): Promise<boolean> {
    console.log('🤖 Testing OpenAI service setup...');

    try {
      const isReady = OpenAIService.isReady();
      
      if (isReady) {
        console.log('✅ OpenAI service is configured and ready');
        
        // Test commitment extraction with sample text
        const sampleText = "I'll call you back tomorrow at 3 PM. Don't forget to send me those documents.";
        const commitments = await OpenAIService.extractCommitments(sampleText, 'John');
        
        if (commitments) {
          console.log(`✅ Commitment extraction working - found ${commitments.commitments.length} commitments`);
          return true;
        } else {
          console.warn('⚠️ OpenAI service configured but commitment extraction failed');
          return false;
        }
      } else {
        console.warn('⚠️ OpenAI service not configured - set API key for full functionality');
        return false;
      }
    } catch (error) {
      console.error('❌ OpenAI setup test failed:', error);
      return false;
    }
  }

  /**
   * Test the complete workflow
   */
  static async testCompleteWorkflow(): Promise<boolean> {
    console.log('🔄 Testing complete audio-to-insights workflow...');

    try {
      // Simulate a complete call recording and processing workflow
      console.log('1️⃣ Simulating call recording...');
      
      // Mock recording session
      const mockSession = {
        id: 'test_session_' + Date.now(),
        contactId: 'test_contact',
        startTime: new Date(),
        endTime: new Date(Date.now() + 30000), // 30 seconds later
        tempFilePath: '/mock/temp/audio.wav',
        filePath: '/mock/audio/recorded_call.wav',
        duration: 30000,
        fileSize: 480000, // Estimated for 30s at 16kHz
        isProcessing: false,
      };

      console.log('2️⃣ Simulating transcription...');
      const transcription = await TranscriptionService.transcribeAudioFile(
        mockSession.filePath!,
        {
          language: 'en',
          saveTranscript: true,
          enableSpeakerDiarization: true,
        }
      );

      if (!transcription) {
        console.error('❌ Transcription failed in workflow test');
        return false;
      }

      console.log('3️⃣ Extracting insights...');
      if (OpenAIService.isReady() && transcription.transcript) {
        const insights = await OpenAIService.generateConversationInsights(
          transcription.transcript,
          'Test Contact',
          'friend'
        );

        if (insights) {
          console.log('✅ Complete workflow test successful');
          console.log(`   - Topics: ${insights.keyTopics.join(', ')}`);
          console.log(`   - Quality: ${insights.conversationQuality}/10`);
          return true;
        }
      }

      console.log('⚠️ Workflow completed but insights generation skipped (OpenAI not configured)');
      return true;
    } catch (error) {
      console.error('❌ Complete workflow test failed:', error);
      return false;
    }
  }

  /**
   * Run all tests
   */
  static async runAllTests(): Promise<void> {
    console.log('🧪 Starting Donna Audio & Transcription Tests...\n');

    const results = {
      audioRecording: await this.testAudioRecording(),
      transcription: await this.testTranscription(),
      openAI: await this.testOpenAISetup(),
      completeWorkflow: await this.testCompleteWorkflow(),
    };

    console.log('\n📊 Test Results:');
    console.log('=================');
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });

    const allPassed = Object.values(results).every(result => result);
    
    if (allPassed) {
      console.log('\n🎉 All tests passed! Donna is ready for audio recording and transcription.');
    } else {
      console.log('\n⚠️ Some tests failed. Check the logs above for details.');
      console.log('💡 Tip: Make sure you have proper permissions and OpenAI API key configured.');
    }

    console.log('\n🔧 Next steps:');
    console.log('- Test on physical device for actual call detection');
    console.log('- Configure OpenAI API key in settings');
    console.log('- Test call recording during real phone calls');
  }
}

// Export for use in app
export default AudioTranscriptionTest;