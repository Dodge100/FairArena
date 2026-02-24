import OpenAI from 'openai';

/**
 * FairArena AI Gateway - OpenAI SDK Test Script
 *
 * Instructions:
 * 1. Install the openai library: npm install openai
 * 2. Set your API key below or via environment variable
 * 3. Run: node test-gateway.mjs
 */

const API_KEY = process.env.FA_API_KEY || 'fa_live_dw132ctxj7o8f4scpbhffjrw_SQLKey';
const BASE_URL = 'http://localhost:3000/v1';

const openai = new OpenAI({
  apiKey: API_KEY,
  baseURL: BASE_URL,
});

async function runTests() {
  console.log('🚀 Starting FairArena AI Gateway Comprehensive Tests...');
  console.log(`📡 Endpoint: ${BASE_URL}\n`);

  try {
    // Test 1: Simple Chat Completion
    console.log('--- Test 1: Simple Chat ---');
    const simpleChat = await openai.chat.completions.create({
      model: 'groq/llama-3.3-70b',
      messages: [{ role: 'user', content: 'Say "Normal chat is working!"' }],
    });
    console.log(`🤖 Response: ${simpleChat.choices[0].message.content}`);
    console.log(`💳 Credits Used: ${simpleChat.x_fairarena?.credits_used ?? 'N/A'}\n`);

    // Test 2: Streaming
    console.log('--- Test 2: Streaming ---');
    process.stdout.write('🤖 Streaming: ');
    const stream = await openai.chat.completions.create({
      model: 'gemini/gemini-2.5-flash',
      messages: [{ role: 'user', content: 'Count from 1 to 5 slowly with spaces.' }],
      stream: true,
      cache: false, // Force no cache for stream test
    });

    let fullText = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullText += content;
      process.stdout.write(content);

      // If the gateway sent FairArena metadata in the last chunk
      if (chunk.x_fairarena) {
        console.log(`\n\n💳 Final Credits Used: ${chunk.x_fairarena.credits_used}`);
      }
    }
    console.log('\n');

    // Test 3: Tool Calling (Function Calling)
    console.log('--- Test 3: Tool Calling ---');
    const tools = [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the current weather in a given location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g. San Francisco, CA',
              },
              unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
            },
            required: ['location'],
          },
        },
      },
    ];

    const toolChat = await openai.chat.completions.create({
      model: 'groq/llama-3.3-70b',
      messages: [{ role: 'user', content: "What's the weather like in New York?" }],
      tools: tools,
      tool_choice: 'auto',
    });

    const toolCall = toolChat.choices[0].message.tool_calls?.[0];
    if (toolCall) {
      console.log('✅ Tool Call Detected!');
      console.log(`🔧 Tool Name: ${toolCall.function.name}`);
      console.log(`📦 Arguments: ${toolCall.function.arguments}`);
    } else {
      console.log('❌ No tool call returned. Assistant replied with text:');
      console.log(toolChat.choices[0].message.content);
    }
    console.log(`💳 Credits Used: ${toolChat.x_fairarena?.credits_used ?? 'N/A'}\n`);

    // Test 4: JSON Mode (Structured Output)
    console.log('--- Test 4: JSON Mode ---');
    const jsonChat = await openai.chat.completions.create({
      model: 'groq/qwen-3-32b',
      messages: [
        { role: 'system', content: 'You are a JSON assistant. Always return valid JSON.' },
        { role: 'user', content: 'Create a JSON object for a user named Alice with age 25.' },
      ],
      response_format: { type: 'json_object' },
    });
    console.log(`🤖 JSON Response: ${jsonChat.choices[0].message.content}`);
    console.log(`💳 Credits Used: ${jsonChat.x_fairarena?.credits_used ?? 'N/A'}\n`);

    console.log('------------------------------------------');
    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test Failed:');
    if (error.response) {
      console.error(`Status: ${error.status}`);
      console.error('Data:', JSON.stringify(error.response, null, 2));
    } else {
      console.error(error.message);
    }

    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 HINT: Is your backend server running on http://localhost:3000?');
    }
  }
}

runTests();
