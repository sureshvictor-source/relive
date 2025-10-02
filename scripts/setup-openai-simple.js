#!/usr/bin/env node

// Simple OpenAI setup script for React Native
// This bypasses the AsyncStorage "window" issue by using a mock implementation

const readline = require('readline');

// Mock AsyncStorage for Node.js environment
global.AsyncStorage = {
  data: {},
  setItem: async (key, value) => {
    console.log(`✅ Would store: ${key} = ${value.substring(0, 10)}...`);
    return Promise.resolve();
  },
  getItem: async (key) => {
    return Promise.resolve(null);
  },
  removeItem: async (key) => {
    return Promise.resolve();
  }
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setupOpenAI() {
  console.log('\n🚀 Relive App - OpenAI Configuration Setup');
  console.log('==========================================\n');

  console.log('📋 What you\'ll need:');
  console.log('1. OpenAI API key (from https://platform.openai.com/api-keys)');
  console.log('2. The key should start with "sk-"');
  console.log('3. Make sure you have billing set up in your OpenAI account\n');

  const apiKey = await askQuestion('🔑 Enter your OpenAI API key: ');

  if (!apiKey || !apiKey.startsWith('sk-')) {
    console.log('❌ Invalid API key format. Should start with "sk-"');
    process.exit(1);
  }

  console.log('\n✅ API Key format looks correct!');

  // Test the API key
  console.log('🧪 Testing API connection...');

  try {
    const testResult = await testApiKey(apiKey);
    if (testResult) {
      console.log('✅ API key works! Connection successful.');

      console.log('\n📱 Next steps to configure in your app:');
      console.log('1. Open the Relive app on your device/simulator');
      console.log('2. Go to Settings > AI Configuration');
      console.log(`3. Enter your API key: ${apiKey.substring(0, 10)}...`);
      console.log('4. Tap "Save" to store the configuration');

      console.log('\n🎯 Available AI Features:');
      console.log('• 🎙️  Audio transcription (Whisper)');
      console.log('• 📝 Commitment extraction');
      console.log('• 😊 Emotional analysis');
      console.log('• 💡 Conversation insights');
      console.log('• 📋 Follow-up suggestions');
      console.log('• 📊 Conversation summaries');

    } else {
      console.log('❌ API key test failed. Please check your key and try again.');
    }
  } catch (error) {
    console.log('❌ Failed to test API key:', error.message);
  }

  rl.close();
}

async function testApiKey(apiKey) {
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "test successful" if you receive this.' }],
      max_tokens: 10
    });

    return response.choices[0]?.message?.content?.includes('test successful');
  } catch (error) {
    console.error('API test error:', error.message);
    return false;
  }
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Run setup
setupOpenAI().catch(console.error);