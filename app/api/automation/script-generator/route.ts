import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      character1_name,
      character1_personality,
      character2_name,
      character2_personality,
      topic,
      script_length,
      openai_api_key
    } = body;

    if (!character1_name || !character2_name || !topic) {
      return NextResponse.json(
        { error: 'Missing required fields: character names and topic' },
        { status: 400 }
      );
    }

    // Determine script length parameters
    const lengthParams = {
      short: { duration: '30-60 seconds', exchanges: '4-6' },
      medium: { duration: '1-3 minutes', exchanges: '8-12' },
      long: { duration: '3-5 minutes', exchanges: '15-20' }
    };

    const params = lengthParams[script_length as keyof typeof lengthParams] || lengthParams.medium;

    // Create the prompt for script generation
    const prompt = `Create a funny conversation script between ${character1_name} and ${character2_name} about ${topic}.

CHARACTER PERSONALITIES:
- ${character1_name}: ${character1_personality}
- ${character2_name}: ${character2_personality}

REQUIREMENTS:
- Duration: ${params.duration}
- Number of exchanges: ${params.exchanges}
- Topic: ${topic}
- Make it entertaining and engaging for YouTube audience
- Include natural pauses and reactions
- Keep the conversation flowing naturally
- Make it funny but family-friendly

FORMAT:
Return the script in this exact JSON format:
{
  "title": "Episode title here",
  "script": [
    {
      "character": "${character1_name}",
      "dialogue": "First line of dialogue here",
      "emotion": "neutral/excited/confused/sarcastic"
    },
    {
      "character": "${character2_name}",
      "dialogue": "Response dialogue here",
      "emotion": "neutral/excited/confused/sarcastic"
    }
  ],
  "estimated_duration": "X minutes",
  "topic": "${topic}"
}

Make sure the conversation is engaging, funny, and true to the characters' personalities!`;

    // Generate script using OpenAI
    const scriptResult = await generateScript(prompt, openai_api_key);

    if (!scriptResult.success) {
      return NextResponse.json(
        { error: scriptResult.error },
        { status: 500 }
      );
    }

    // Store the generated script
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: scriptRecord, error: insertError } = await supabaseAdmin
        .from('generated_scripts')
        .insert({
          character1_name,
          character2_name,
          topic,
          script_length,
          script_data: scriptResult.script,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error storing script:', insertError);
        // Continue anyway, return the script even if storage fails
      }

      return NextResponse.json({
        success: true,
        script: scriptResult.script,
        script_id: scriptRecord?.id,
        message: 'Script generated successfully'
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Return the script even if database storage fails
      return NextResponse.json({
        success: true,
        script: scriptResult.script,
        script_id: null,
        message: 'Script generated successfully (storage failed)'
      });
    }

  } catch (error) {
    console.error('Script generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function generateScript(prompt: string, apiKey: string): Promise<{ success: boolean; script?: any; error?: string }> {
  try {
    if (!apiKey) {
      return { success: false, error: 'OpenAI API key is required' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a creative scriptwriter specializing in character-based conversations for YouTube content. You create engaging, funny dialogues that capture each character\'s unique personality and speaking style.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { 
        success: false, 
        error: `OpenAI API error: ${errorData.error?.message || response.statusText}` 
      };
    }

    const data = await response.json();
    const scriptText = data.choices[0].message.content;

    // Try to parse the JSON response
    try {
      const scriptData = JSON.parse(scriptText);
      return { success: true, script: scriptData };
    } catch (parseError) {
      // If JSON parsing fails, return the raw text
      return { 
        success: true, 
        script: {
          title: 'Generated Script',
          script: [{ character: 'System', dialogue: scriptText, emotion: 'neutral' }],
          estimated_duration: '2-3 minutes',
          topic: 'Generated Content'
        }
      };
    }

  } catch (error) {
    return { 
      success: false, 
      error: `Script generation failed: ${error}` 
    };
  }
} 