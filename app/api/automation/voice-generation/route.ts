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
      script_data,
      voice_service,
      character1_voice_id,
      character2_voice_id,
      voice_api_key
    } = body;

    if (!script_data || !voice_service || !voice_api_key) {
      return NextResponse.json(
        { error: 'Missing required fields: script_data, voice_service, and voice_api_key' },
        { status: 400 }
      );
    }

    // Process each dialogue line in the script
    const audioFiles: Array<{
      character: string;
      dialogue: string;
      audio_url: string;
      duration: number;
      sequence: number;
    }> = [];
    
    for (let i = 0; i < script_data.script.length; i++) {
      const line = script_data.script[i];
      const voiceId = line.character === script_data.script[0].character ? character1_voice_id : character2_voice_id;
      
      if (!voiceId) {
        return NextResponse.json(
          { error: `Missing voice ID for character: ${line.character}` },
          { status: 400 }
        );
      }

      // Generate audio for this line
      const audioResult = await generateAudio({
        text: line.dialogue,
        voice_id: voiceId,
        voice_service,
        api_key: voice_api_key,
        emotion: line.emotion || 'neutral'
      });

      if (!audioResult.success) {
        return NextResponse.json(
          { error: `Failed to generate audio for line ${i + 1}: ${audioResult.error}` },
          { status: 500 }
        );
      }

      audioFiles.push({
        character: line.character,
        dialogue: line.dialogue,
        audio_url: audioResult.audio_url || '',
        duration: audioResult.duration || 0,
        sequence: i
      });
    }

    // Store the generated audio files
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: audioRecord, error: insertError } = await supabaseAdmin
        .from('generated_audio')
        .insert({
          script_id: body.script_id,
          voice_service,
          audio_files: audioFiles,
          total_duration: audioFiles.reduce((sum, file) => sum + (file.duration || 0), 0),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error storing audio:', insertError);
        // Continue anyway, return the audio files even if storage fails
      }

      return NextResponse.json({
        success: true,
        audio_files: audioFiles,
        audio_id: audioRecord?.id,
        total_duration: audioFiles.reduce((sum, file) => sum + (file.duration || 0), 0),
        message: 'Audio generated successfully'
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Return the audio files even if database storage fails
      return NextResponse.json({
        success: true,
        audio_files: audioFiles,
        audio_id: null,
        total_duration: audioFiles.reduce((sum, file) => sum + (file.duration || 0), 0),
        message: 'Audio generated successfully (storage failed)'
      });
    }

  } catch (error) {
    console.error('Voice generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function generateAudio(config: {
  text: string;
  voice_id: string;
  voice_service: string;
  api_key: string;
  emotion?: string;
}): Promise<{ success: boolean; audio_url?: string; duration?: number; error?: string }> {
  
  try {
    switch (config.voice_service) {
      case 'elevenlabs':
        return await generateElevenLabsAudio(config);
      case 'openai':
        return await generateOpenAIAudio(config);
      case 'azure':
        return await generateAzureAudio(config);
      case 'google':
        return await generateGoogleAudio(config);
      case 'replicate':
        return await generateReplicateAudio(config);
      default:
        return { success: false, error: 'Unsupported voice service' };
    }
  } catch (error) {
    return { success: false, error: `Audio generation failed: ${error}` };
  }
}

async function generateElevenLabsAudio(config: {
  text: string;
  voice_id: string;
  api_key: string;
  emotion?: string;
}): Promise<{ success: boolean; audio_url?: string; duration?: number; error?: string }> {
  
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.voice_id}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': config.api_key
      },
      body: JSON.stringify({
        text: config.text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.5,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `ElevenLabs API error: ${errorText}` };
    }

    // Get the audio data
    const audioBuffer = await response.arrayBuffer();
    
    // In a real implementation, you'd upload this to your storage service
    // For now, we'll simulate a successful upload
    const audioUrl = `https://your-storage.com/audio/${Date.now()}.mp3`;
    
    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = config.text.split(' ').length;
    const estimatedDuration = (wordCount / 150) * 60; // seconds

    return {
      success: true,
      audio_url: audioUrl,
      duration: estimatedDuration
    };

  } catch (error) {
    return { success: false, error: `ElevenLabs generation failed: ${error}` };
  }
}

async function generateOpenAIAudio(config: {
  text: string;
  voice_id: string;
  api_key: string;
}): Promise<{ success: boolean; audio_url?: string; duration?: number; error?: string }> {
  
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: config.text,
        voice: config.voice_id, // alloy, echo, fable, onyx, nova, shimmer
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: `OpenAI TTS error: ${errorData.error?.message}` };
    }

    const audioBuffer = await response.arrayBuffer();
    
    // In a real implementation, you'd upload this to your storage service
    const audioUrl = `https://your-storage.com/audio/${Date.now()}.mp3`;
    
    // Estimate duration
    const wordCount = config.text.split(' ').length;
    const estimatedDuration = (wordCount / 150) * 60;

    return {
      success: true,
      audio_url: audioUrl,
      duration: estimatedDuration
    };

  } catch (error) {
    return { success: false, error: `OpenAI TTS generation failed: ${error}` };
  }
}

async function generateAzureAudio(config: {
  text: string;
  voice_id: string;
  api_key: string;
}): Promise<{ success: boolean; audio_url?: string; duration?: number; error?: string }> {
  // Azure Speech Service implementation would go here
  return { success: false, error: 'Azure Speech Service not implemented yet' };
}

async function generateGoogleAudio(config: {
  text: string;
  voice_id: string;
  api_key: string;
}): Promise<{ success: boolean; audio_url?: string; duration?: number; error?: string }> {
  // Google Cloud TTS implementation would go here
  return { success: false, error: 'Google Cloud TTS not implemented yet' };
}

async function generateReplicateAudio(config: {
  text: string;
  voice_id: string;
  api_key: string;
}): Promise<{ success: boolean; audio_url?: string; duration?: number; error?: string }> {
  
  try {
    // Replicate API for TTS - using popular models like Bark or Tortoise TTS
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${config.api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: "suno-ai/bark:b76242b40d67c76ab6742e987628a2a9ac019e11d56ab96c4e91ce03b79b2787", // Bark TTS model
        input: {
          prompt: config.text,
          text_temp: 0.7,
          waveform_temp: 0.7,
          voice_preset: config.voice_id || "v2/en_speaker_6" // Default voice if none specified
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Replicate API error: ${errorText}` };
    }

    const prediction = await response.json();
    
    // Poll for completion (Replicate is async)
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max wait
    
    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: {
          'Authorization': `Token ${config.api_key}`
        }
      });
      
      if (statusResponse.ok) {
        result = await statusResponse.json();
      }
      attempts++;
    }

    if (result.status === 'failed') {
      return { success: false, error: `Replicate generation failed: ${result.error}` };
    }

    if (result.status !== 'succeeded') {
      return { success: false, error: 'Replicate generation timed out' };
    }

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = config.text.split(' ').length;
    const estimatedDuration = (wordCount / 150) * 60; // seconds

    return {
      success: true,
      audio_url: result.output, // Replicate returns the audio URL directly
      duration: estimatedDuration
    };

  } catch (error) {
    return { success: false, error: `Replicate generation failed: ${error}` };
  }
} 