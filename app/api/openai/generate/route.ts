import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabaseAdmin = getSupabaseAdmin();
  
  if (!supabaseAdmin) {
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      console.error('Unauthorized request to OpenAI API');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, apiKey, model = 'gpt-3.5-turbo', max_tokens = 800 } = body;

    console.log('OpenAI request received for model:', model);
    console.log('Max tokens:', max_tokens);
    console.log('API key length:', apiKey?.length || 0);
    console.log('Prompt length:', prompt?.length || 0);

    if (!prompt || !apiKey) {
      console.error('Missing required fields:', { hasPrompt: !!prompt, hasApiKey: !!apiKey });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify API key format (simple check, not validating with OpenAI)
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
      console.error('Invalid API key format');
      return NextResponse.json({ error: 'Invalid API key format' }, { status: 400 });
    }

    try {
      console.log('Calling OpenAI API...');
      // Call OpenAI API with the provided API key
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that drafts email responses. Your responses should be professional, clear, and directly address the points raised in the original email. Be concise and to the point. If the user provides additional context or knowledge, use it to inform and enhance your response without explicitly mentioning it was provided as context. Prioritize any specific guidance in the additional context section as it represents the user\'s expertise.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: max_tokens,
          temperature: 0.7,
        }),
      });

      console.log('OpenAI API response status:', response.status);
      
      const responseData = await response.json();
      
      // Log a summary of the response
      if (responseData.error) {
        console.error('OpenAI API Error:', {
          status: response.status,
          error: responseData.error
        });
      } else {
        console.log('OpenAI API Success:', {
          status: response.status,
          modelUsed: responseData.model,
          promptTokens: responseData.usage?.prompt_tokens,
          completionTokens: responseData.usage?.completion_tokens,
          totalTokens: responseData.usage?.total_tokens
        });
      }

      if (!response.ok) {
        // Handle token limit errors specifically
        if (responseData.error?.message?.includes('maximum context length')) {
          return NextResponse.json(
            { 
              error: 'The email is too long for AI processing. Please try with a shorter email or summarize the content.',
              originalError: responseData.error?.message
            }, 
            { status: 413 }  // 413 = Payload Too Large
          );
        }
        
        // Handle invalid API key
        if (response.status === 401) {
          return NextResponse.json(
            { error: 'Invalid OpenAI API key. Please check your API key in workspace settings.' },
            { status: 401 }
          );
        }
        
        // Handle other API errors
        return NextResponse.json(
          { error: `OpenAI API error: ${responseData.error?.message || 'Unknown error'}` }, 
          { status: response.status }
        );
      }

      const generatedText = responseData.choices[0]?.message?.content || '';
      
      if (!generatedText) {
        console.error('No generated text in OpenAI response');
        return NextResponse.json({ error: 'No text generated' }, { status: 500 });
      }

      console.log('Generated text length:', generatedText.length);
      return NextResponse.json({ text: generatedText });
    } catch (apiError) {
      console.error('OpenAI API fetch error:', apiError);
      return NextResponse.json(
        { error: 'Failed to connect to OpenAI API. Please try again.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in OpenAI generate route:', error);
    return NextResponse.json(
      { error: 'Failed to generate response. Please try again.' }, 
      { status: 500 }
    );
  }
} 