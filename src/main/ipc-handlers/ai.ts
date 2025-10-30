/**
 * AI IPC Handlers
 * Handles AI-powered features like script generation for teleprompter
 * Story S9: Teleprompter
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { GenerateScriptRequest, GenerateScriptResponse } from '../../types/teleprompter';

/**
 * Register all AI IPC handlers
 */
export function registerAIHandlers(): void {
  console.log('[AIHandlers] Registering AI IPC handlers...');

  // Generate script with AI
  ipcMain.handle('ai:generate-script', handleGenerateScript);

  console.log('[AIHandlers] AI IPC handlers registered');
}

/**
 * Handle script generation request using OpenAI API
 * Uses environment variable OPENAI_API_KEY if available
 * Falls back to mock response for testing/offline use
 */
async function handleGenerateScript(
  event: IpcMainInvokeEvent,
  request: GenerateScriptRequest
): Promise<GenerateScriptResponse> {
  try {
    const { topic, duration, feedback, previousScript } = request;

    // Validation
    if (!topic || topic.trim().length === 0) {
      throw new Error('Topic is required');
    }
    if (!duration || duration < 1 || duration > 300) {
      throw new Error('Duration must be between 1 and 300 seconds');
    }

    console.log(`[AIHandlers] Generating script for topic: "${topic}", duration: ${duration}s`);

    // Build prompt
    let userPrompt: string;
    if (feedback && previousScript) {
      userPrompt = `Here is the previously generated script:\n\n${previousScript}\n\nUser feedback: ${feedback}\n\nPlease rewrite the script for a ${duration}-second video based on this feedback. Keep it concise, engaging, and natural to read aloud. Output only the script text, no preamble or explanations.`;
    } else if (feedback) {
      userPrompt = `Write a script about "${topic}" for a ${duration}-second video. Feedback: ${feedback}. Keep it concise, engaging, and natural to read aloud. Output only the script text, no preamble or explanations.`;
    } else {
      userPrompt = `Write a concise script about "${topic}" for a ${duration}-second video. Keep it engaging and natural to read aloud. Output only the script text, no preamble or explanations.`;
    }

    // Try to use OpenAI API
    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
      return await callOpenAIAPI(userPrompt, duration);
    } else {
      // Fallback to mock response
      console.log('[AIHandlers] No API key found, using mock response');
      return generateMockScript(topic, duration);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AIHandlers] Script generation failed:', errorMessage);
    throw new Error(`Script generation failed: ${errorMessage}`);
  }
}

/**
 * Call OpenAI API to generate script
 */
async function callOpenAIAPI(
  userPrompt: string
): Promise<GenerateScriptResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert script writer for video content. Generate concise, engaging, and natural-sounding scripts that are optimized for reading aloud. Output only the script text, no preamble or explanations.',
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} ${error}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const scriptText = data.choices[0]?.message?.content || '';

    if (!scriptText) {
      throw new Error('No script content returned from API');
    }

    // Estimate duration: ~150 words per minute, ~5 chars per word
    const wordCount = scriptText.split(/\s+/).length;
    const estimatedDuration = Math.ceil((wordCount / 150) * 60);

    return {
      scriptText: scriptText.trim(),
      estimatedDuration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('abort')) {
      throw new Error('Script generation timed out (>10 seconds)');
    }
    throw error;
  }
}

/**
 * Generate a mock script for testing/offline use
 * Ensures the feature works even without API access
 */
function generateMockScript(topic: string, duration: number): GenerateScriptResponse {
  const mockScripts: { [key: string]: string } = {
    creatine: `Creatine is one of the most researched supplements in fitness. It helps your muscles produce energy during intense exercise, allowing you to train harder and longer. Most studies show creatine increases muscle mass, strength, and overall athletic performance. It's affordable, safe when used properly, and has been used by athletes for decades. If you're serious about improving your workouts, creatine is worth considering.`,
    coffee: `Coffee is more than just a morning ritual—it's a science-backed productivity booster. The caffeine in coffee blocks adenosine receptors in your brain, keeping you alert and focused. Studies show coffee drinkers have better memory, faster reaction times, and improved mental clarity. Beyond caffeine, coffee contains powerful antioxidants that support overall health. Whether you enjoy it black or with cream, coffee can be a valuable part of your daily routine.`,
    workout: `Getting fit doesn't require expensive equipment or hours at the gym. Consistency is the real secret. Start with small, achievable goals—maybe 20 minutes of exercise three times a week. Mix cardio with strength training to build endurance and muscle. Listen to your body, rest when needed, and gradually increase intensity. Remember, the best workout is the one you'll actually do. Make it enjoyable, stay consistent, and results will follow.`,
  };

  // Look for a matching topic in mock scripts
  const lowerTopic = topic.toLowerCase();
  for (const [key, value] of Object.entries(mockScripts)) {
    if (lowerTopic.includes(key)) {
      return {
        scriptText: value,
        estimatedDuration: Math.round(value.split(/\s+/).length / 150 * 60),
      };
    }
  }

  // Generate a generic script based on duration
  const baseScript = `Today, I want to talk about "${topic}". This is an important topic that affects many people. Let me break it down for you. First, it's essential to understand the fundamentals. Second, we need to look at practical applications. Third, consider the real-world impact. Finally, remember that taking action is what matters most. Whatever your situation, you now have the tools to move forward. Keep learning and keep growing.`;

  // Adjust script length based on duration
  const wordCount = baseScript.split(/\s+/).length;
  const wordsNeeded = Math.round((duration / 60) * 150); // 150 WPM

  let script = baseScript;
  if (wordsNeeded > wordCount) {
    // Extend script
    script += ` Remember that ${topic} is an ongoing journey. Stay committed to your goals. Whether you're starting fresh or advancing further, every step counts. The key to success is persistence. Don't give up when things get tough. Keep pushing forward, and you'll achieve your objectives. Thank you for listening.`;
  } else if (wordsNeeded < wordCount * 0.5) {
    // Shorten script
    script = baseScript.split('.').slice(0, 3).join('.') + '.';
  }

  return {
    scriptText: script,
    estimatedDuration: duration,
  };
}
