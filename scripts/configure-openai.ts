#!/usr/bin/env npx tsx

/**
 * Interactive OpenAI configuration script
 * Helps set up and test OpenAI API integration
 */

import * as readline from 'readline';
import AppConfig from '../src/config/AppConfig';
import OpenAIService from '../src/services/OpenAIService';

interface ConfigurationOptions {
  apiKey?: string;
  model?: string;
  whisperModel?: string;
  testConnection?: boolean;
}

class OpenAIConfigurator {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async configure(options: ConfigurationOptions = {}): Promise<void> {
    console.log('🔧 OpenAI Configuration Setup');
    console.log('================================\n');

    // Initialize AppConfig
    await AppConfig.initialize();

    // Check current configuration
    await this.checkCurrentConfig();

    // Interactive setup if no options provided
    if (!options.apiKey) {
      await this.interactiveSetup();
    } else {
      await this.setupWithOptions(options);
    }

    // Test connection if requested
    if (options.testConnection !== false) {
      await this.testConnection();
    }

    this.rl.close();
  }

  private async checkCurrentConfig(): Promise<void> {
    console.log('📋 Current Configuration:');
    const config = AppConfig.getOpenAIConfig();

    console.log(`API Key: ${config.apiKey ? '✅ Configured' : '❌ Not set'}`);
    console.log(`Model: ${config.model}`);
    console.log(`Whisper Model: ${config.whisperModel}`);

    // Check environment variables
    const envKey = process.env.OPENAI_API_KEY;
    if (envKey) {
      console.log('🌍 Environment variable OPENAI_API_KEY detected');
    }

    console.log('');
  }

  private async interactiveSetup(): Promise<void> {
    console.log('🔑 API Key Setup:');
    console.log('You can get your OpenAI API key from: https://platform.openai.com/api-keys\n');

    // Get API key
    const apiKey = await this.askQuestion('Enter your OpenAI API key (sk-...): ');

    if (!apiKey || !apiKey.startsWith('sk-')) {
      console.log('❌ Invalid API key format. API keys should start with "sk-"');
      return;
    }

    // Get model preferences
    const useGPT4 = await this.askQuestion('Use GPT-4 for analysis? (y/n, default: y): ');
    const model = useGPT4.toLowerCase() === 'n' ? 'gpt-3.5-turbo' : 'gpt-4';

    // Save configuration
    await this.saveConfiguration(apiKey, model);
  }

  private async setupWithOptions(options: ConfigurationOptions): Promise<void> {
    if (options.apiKey) {
      await this.saveConfiguration(
        options.apiKey,
        options.model || 'gpt-4',
        options.whisperModel || 'whisper-1'
      );
    }
  }

  private async saveConfiguration(
    apiKey: string,
    model: string = 'gpt-4',
    whisperModel: string = 'whisper-1'
  ): Promise<void> {
    console.log('💾 Saving configuration...');

    try {
      await AppConfig.setOpenAIApiKey(apiKey);
      await AppConfig.updateConfig({
        openai: {
          apiKey,
          model,
          whisperModel,
        },
      });

      // Configure the service
      OpenAIService.setApiKey(apiKey);

      console.log('✅ Configuration saved successfully!');
      console.log(`   Model: ${model}`);
      console.log(`   Whisper: ${whisperModel}\n`);
    } catch (error) {
      console.error('❌ Failed to save configuration:', error);
    }
  }

  private async testConnection(): Promise<void> {
    console.log('🔍 Testing OpenAI connection...');

    try {
      if (!OpenAIService.isReady()) {
        console.log('❌ OpenAI service not ready');
        return;
      }

      const testMessage = 'Hello! This is a test to verify the OpenAI API connection.';
      const response = await OpenAIService.summarizeConversation(testMessage);

      if (response) {
        console.log('✅ Connection test successful!');
        console.log(`   Response: "${response.substring(0, 100)}..."`);
      } else {
        console.log('❌ Connection test failed - no response received');
      }
    } catch (error) {
      console.error('❌ Connection test failed:', error instanceof Error ? error.message : error);

      if (error instanceof Error && error.message.includes('401')) {
        console.log('💡 This usually means the API key is invalid or expired.');
      } else if (error instanceof Error && error.message.includes('quota')) {
        console.log('💡 This usually means you\'ve exceeded your API quota.');
      }
    }

    console.log('');
  }

  private async displayUsageInfo(): Promise<void> {
    console.log('📚 Usage Information:');
    console.log('====================\n');

    console.log('🤖 Supported Models:');
    console.log('  • gpt-4: Best quality, higher cost');
    console.log('  • gpt-3.5-turbo: Good quality, lower cost');
    console.log('  • whisper-1: Audio transcription\n');

    console.log('💰 Cost Estimation (approximate):');
    console.log('  • GPT-4: ~$0.03 per 1K tokens');
    console.log('  • GPT-3.5-turbo: ~$0.002 per 1K tokens');
    console.log('  • Whisper: ~$0.006 per minute\n');

    console.log('🔒 Security:');
    console.log('  • API keys are stored securely using AsyncStorage');
    console.log('  • Keys are never logged or exported');
    console.log('  • All communications use HTTPS\n');

    console.log('🎯 Features Enabled:');
    console.log('  • Conversation transcription');
    console.log('  • Automatic summarization');
    console.log('  • Commitment extraction');
    console.log('  • Emotional tone analysis');
    console.log('  • Relationship insights');
    console.log('  • Conversation suggestions\n');
  }

  private async askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async showMenu(): Promise<void> {
    while (true) {
      console.log('\n🔧 OpenAI Configuration Menu:');
      console.log('1. Check current configuration');
      console.log('2. Set up API key');
      console.log('3. Test connection');
      console.log('4. Show usage information');
      console.log('5. Export configuration');
      console.log('6. Reset to defaults');
      console.log('0. Exit\n');

      const choice = await this.askQuestion('Select an option (0-6): ');

      switch (choice) {
        case '1':
          await this.checkCurrentConfig();
          break;
        case '2':
          await this.interactiveSetup();
          break;
        case '3':
          await this.testConnection();
          break;
        case '4':
          await this.displayUsageInfo();
          break;
        case '5':
          await this.exportConfiguration();
          break;
        case '6':
          await this.resetConfiguration();
          break;
        case '0':
          console.log('👋 Goodbye!');
          this.rl.close();
          return;
        default:
          console.log('❌ Invalid option. Please try again.');
      }
    }
  }

  private async exportConfiguration(): Promise<void> {
    console.log('📤 Exporting configuration...');
    const exported = AppConfig.exportConfig();
    console.log('\n' + exported);
    console.log('\n✅ Configuration exported (API key redacted for security)');
  }

  private async resetConfiguration(): Promise<void> {
    const confirm = await this.askQuestion('⚠️  Reset to defaults? This will preserve your API key (y/n): ');

    if (confirm.toLowerCase() === 'y') {
      await AppConfig.resetToDefaults();
      console.log('✅ Configuration reset to defaults');
    } else {
      console.log('❌ Reset cancelled');
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const configurator = new OpenAIConfigurator();

  // Check for command line arguments
  if (args.length > 0) {
    const apiKey = args[0];
    const testConnection = !args.includes('--no-test');

    await configurator.configure({
      apiKey,
      testConnection,
    });
  } else {
    // Interactive menu
    await configurator.showMenu();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default OpenAIConfigurator;