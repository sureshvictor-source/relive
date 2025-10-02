#!/usr/bin/env npx tsx

/**
 * Simple OpenAI API test script for Node.js environment
 * Tests OpenAI integration without React Native dependencies
 */

import OpenAI from 'openai';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  result?: any;
}

class SimpleOpenAITester {
  private openai: OpenAI;
  private results: TestResult[] = [];

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Testing OpenAI API Integration...\n');

    await this.testConnection();
    await this.testChatCompletion();
    await this.testConversationSummary();
    await this.testCommitmentExtraction();
    await this.testEmotionalAnalysis();

    this.printResults();
  }

  private async runTest(name: string, testFn: () => Promise<any>): Promise<void> {
    console.log(`⏳ Testing ${name}...`);
    const startTime = Date.now();

    try {
      const result = await testFn();
      const duration = Date.now() - startTime;

      this.results.push({
        name,
        success: true,
        duration,
        result,
      });

      console.log(`✅ ${name} - ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.results.push({
        name,
        success: false,
        duration,
        error: errorMessage,
      });

      console.log(`❌ ${name} - ${duration}ms - ${errorMessage}`);
    }

    console.log('');
  }

  private async testConnection(): Promise<any> {
    await this.runTest('API Connection', async () => {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Say "Hello from OpenAI!" to confirm the connection is working.',
          },
        ],
        max_tokens: 50,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content received');
      }

      return { message: content };
    });
  }

  private async testChatCompletion(): Promise<any> {
    await this.runTest('Chat Completion', async () => {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'What is the capital of France? Answer in one word.',
          },
        ],
        max_tokens: 10,
      });

      const content = response.choices[0]?.message?.content;
      if (!content || !content.toLowerCase().includes('paris')) {
        throw new Error('Unexpected response content');
      }

      return { answer: content };
    });
  }

  private async testConversationSummary(): Promise<any> {
    await this.runTest('Conversation Summary', async () => {
      const conversation = `
        John: Hey, how was your vacation?
        Sarah: It was amazing! I went to Japan and visited Tokyo and Kyoto.
        John: That sounds incredible! What was your favorite part?
        Sarah: Definitely the temples in Kyoto. The architecture was breathtaking.
        John: I'd love to visit Japan someday. Any recommendations?
        Sarah: Absolutely! I'll send you my itinerary.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes conversations in 1-2 sentences.',
          },
          {
            role: 'user',
            content: `Please summarize this conversation:\n\n${conversation}`,
          },
        ],
        max_tokens: 100,
      });

      const summary = response.choices[0]?.message?.content;
      if (!summary || summary.length < 10) {
        throw new Error('Summary too short or empty');
      }

      return { summary: summary.substring(0, 150) + '...' };
    });
  }

  private async testCommitmentExtraction(): Promise<any> {
    await this.runTest('Commitment Extraction', async () => {
      const conversation = `
        John: I'll call you tomorrow to discuss the project details.
        Sarah: Great! And I'll send you the budget proposal by Friday.
        John: Perfect. Also, can you remind me to book the conference room?
        Sarah: Sure, I'll help you book it for next Tuesday.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Extract commitments from conversations. Return as JSON array with format:
            [{"who": "person", "what": "action", "when": "timeframe"}]`,
          },
          {
            role: 'user',
            content: `Extract commitments from this conversation:\n\n${conversation}`,
          },
        ],
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No commitments extracted');
      }

      try {
        const commitments = JSON.parse(content);
        if (!Array.isArray(commitments) || commitments.length === 0) {
          throw new Error('Invalid commitments format');
        }
        return { count: commitments.length, commitments };
      } catch {
        // If JSON parsing fails, just return the text content
        return { text: content };
      }
    });
  }

  private async testEmotionalAnalysis(): Promise<any> {
    await this.runTest('Emotional Analysis', async () => {
      const conversation = `
        John: I'm so excited about this new opportunity!
        Sarah: That's wonderful! I'm really happy for you.
        John: Thanks! I was a bit nervous at first, but now I feel confident.
        Sarah: You should be proud of yourself.
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Analyze the emotional tone of conversations. Return JSON with:
            {"overall_sentiment": number (-1 to 1), "primary_emotions": ["emotion1", "emotion2"]}`,
          },
          {
            role: 'user',
            content: `Analyze the emotional tone of this conversation:\n\n${conversation}`,
          },
        ],
        max_tokens: 150,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No emotional analysis returned');
      }

      try {
        const analysis = JSON.parse(content);
        return analysis;
      } catch {
        return { text: content };
      }
    });
  }

  private printResults(): void {
    console.log('\n📊 Test Results Summary');
    console.log('='.repeat(50));

    const successCount = this.results.filter(r => r.success).length;
    const totalTests = this.results.length;
    const averageTime = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${totalTests - successCount}`);
    console.log(`Average Response Time: ${Math.round(averageTime)}ms`);
    console.log(`Success Rate: ${((successCount / totalTests) * 100).toFixed(1)}%`);

    console.log('\n📝 Detailed Results:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const time = `${result.duration}ms`;
      console.log(`${status} ${result.name.padEnd(25)} ${time.padStart(8)}`);

      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      if (result.result && typeof result.result === 'object') {
        const preview = JSON.stringify(result.result).substring(0, 100);
        console.log(`   Result: ${preview}${preview.length >= 100 ? '...' : ''}`);
      }
    });

    console.log('\n🎯 Integration Status:');
    if (successCount === totalTests) {
      console.log('🟢 All tests passed! OpenAI integration is fully functional.');
      console.log('🚀 Ready to enable AI features in the Relive app.');
    } else if (successCount > totalTests / 2) {
      console.log('🟡 Most tests passed. Some features may need attention.');
    } else {
      console.log('🔴 Multiple tests failed. Check API key and configuration.');
    }

    console.log('\n💡 Next Steps:');
    console.log('• Configure the API key in the React Native app');
    console.log('• Test audio transcription with real audio files');
    console.log('• Set up usage monitoring and cost tracking');
    console.log('• Configure rate limiting for production use');
  }
}

// Main execution
async function main() {
  const apiKey = process.argv[2] || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.log('❌ No API key provided!');
    console.log('Usage: npx tsx scripts/test-openai-simple.ts [API_KEY]');
    console.log('Or set OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  if (!apiKey.startsWith('sk-')) {
    console.log('❌ Invalid API key format. Should start with "sk-"');
    process.exit(1);
  }

  console.log('🔑 Using API key:', apiKey.substring(0, 20) + '...');
  console.log('');

  const tester = new SimpleOpenAITester(apiKey);
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export default SimpleOpenAITester;