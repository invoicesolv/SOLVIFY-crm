import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      message, 
      platform, 
      channel, 
      username, 
      workspaceId,
      triggerConfig 
    } = await request.json();

    console.log('[Chat Trigger] Processing chat message:', {
      platform,
      channel,
      username,
      messageLength: message?.length,
      hasTriggerConfig: !!triggerConfig
    });

    // Check if message matches trigger criteria
    if (triggerConfig) {
      // Check platform match
      if (triggerConfig.chat_platform && triggerConfig.chat_platform !== platform) {
        return NextResponse.json({ 
          triggered: false, 
          reason: 'Platform mismatch' 
        });
      }

      // Check channel match
      if (triggerConfig.chat_channel && triggerConfig.chat_channel !== channel) {
        return NextResponse.json({ 
          triggered: false, 
          reason: 'Channel mismatch' 
        });
      }

      // Check username match
      if (triggerConfig.from_user && triggerConfig.from_user !== username) {
        return NextResponse.json({ 
          triggered: false, 
          reason: 'User mismatch' 
        });
      }

      // Check keyword match
      if (triggerConfig.message_keywords) {
        const keywords = triggerConfig.message_keywords.toLowerCase().split(',').map((k: string) => k.trim());
        const messageText = message.toLowerCase();
        const hasKeyword = keywords.some((keyword: string) => messageText.includes(keyword));
        
        if (!hasKeyword) {
          return NextResponse.json({ 
            triggered: false, 
            reason: 'Keyword mismatch' 
          });
        }
      }
    }

    console.log('[Chat Trigger] Message matches trigger criteria');

    // If AI chatbot is enabled, generate response
    let chatbotResponse: string | null = null;
    if (triggerConfig?.use_ai_chatbot) {
      try {
        console.log('[Chat Trigger] Generating AI chatbot response');
        
        // Get OpenAI API key from workspace settings
        const { data: settings } = await supabase
          .from('workspace_settings')
          .select('openai_api_key')
          .eq('workspace_id', workspaceId)
          .single();

        if (!settings?.openai_api_key) {
          console.error('[Chat Trigger] No OpenAI API key found');
          return NextResponse.json({
            triggered: true,
            error: 'OpenAI API key not configured for this workspace'
          });
        }

        const openai = new OpenAI({
          apiKey: settings.openai_api_key,
        });

        // Prepare chatbot instructions
        const systemPrompt = triggerConfig.chatbot_instructions || 
          "You are a helpful AI assistant. Respond to user messages in a friendly and professional manner. Keep responses concise and helpful.";

        // Generate response using OpenAI
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          max_tokens: 500,
          temperature: 0.7,
        });

        chatbotResponse = completion.choices[0]?.message?.content || null;
        console.log('[Chat Trigger] Generated chatbot response:', chatbotResponse ? chatbotResponse.substring(0, 100) + '...' : 'No response generated');

        // If this is internal workspace chat, send the response directly
        if (platform === 'internal_chat' && workspaceId && chatbotResponse) {
          await supabase
            .from('chat_messages')
            .insert({
              content: chatbotResponse,
              user_id: 'ai-assistant', // Special user ID for AI
              workspace_id: workspaceId,
              message_type: 'text',
              metadata: {
                generated_by: 'automation_trigger',
                trigger_config: triggerConfig,
                original_message: message,
                original_user: username
              }
            });
        }

      } catch (error) {
        console.error('[Chat Trigger] Error generating chatbot response:', error);
        chatbotResponse = "Sorry, I'm having trouble responding right now. Please try again later.";
      }
    }

    // Log the trigger event
    await supabase
      .from('automation_logs')
      .insert({
        workspace_id: workspaceId,
        trigger_type: 'chat_message',
        trigger_data: {
          message,
          platform,
          channel,
          username,
          trigger_config: triggerConfig
        },
        response_data: {
          chatbot_response: chatbotResponse
        },
        status: 'completed',
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      triggered: true,
      chatbot_response: chatbotResponse,
      platform,
      channel,
      message: 'Chat trigger processed successfully'
    });

  } catch (error) {
    console.error('[Chat Trigger] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process chat trigger',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 