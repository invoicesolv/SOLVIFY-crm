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
      code,
      input_data,
      workflow_id,
      node_id
    } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Missing required field: code' },
        { status: 400 }
      );
    }

    // Execute the JavaScript code safely
    const result = await executeCode(code, input_data || {});

    if (!result.success) {
      return NextResponse.json(
        { error: `Code execution failed: ${result.error}` },
        { status: 500 }
      );
    }

    // Log the execution for debugging
    if (workflow_id && node_id) {
      try {
        const supabaseAdmin = getSupabaseAdmin();
        await supabaseAdmin
          .from('automation_logs')
          .insert({
            workflow_id,
            node_id,
            node_type: 'code',
            input_data,
            output_data: result.output,
            status: 'success',
            executed_at: new Date().toISOString()
          });
      } catch (logError) {
        console.error('Failed to log code execution:', logError);
        // Don't fail the request if logging fails
      }
    }

    return NextResponse.json({
      success: true,
      output: result.output,
      execution_time: result.execution_time,
      message: 'Code executed successfully'
    });

  } catch (error) {
    console.error('Code execution error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function executeCode(code: string, inputData: any): Promise<{
  success: boolean;
  output?: any;
  execution_time?: number;
  error?: string;
}> {
  try {
    const startTime = Date.now();

    // Create a safe execution context
    const context = {
      input: inputData,
      output: null,
      console: {
        log: (...args: any[]) => console.log('[Code Node]', ...args),
        error: (...args: any[]) => console.error('[Code Node]', ...args),
        warn: (...args: any[]) => console.warn('[Code Node]', ...args)
      },
      JSON: JSON,
      Math: Math,
      Date: Date,
      // Utility functions for common transformations
      utils: {
        // Transform data for JSON2Video
        toJSON2Video: (audioFiles: any[], template: string = 'minecraft_chat') => {
          return {
            template,
            scenes: audioFiles.map((audio, index) => ({
              id: `scene_${index}`,
              duration: audio.duration,
              audio: {
                src: audio.audio_url,
                volume: 1.0
              },
              text: {
                content: audio.dialogue,
                character: audio.character,
                position: template === 'minecraft_chat' ? 'bottom' : 'center'
              }
            }))
          };
        },
        // Merge multiple data sources
        mergeData: (...sources: any[]) => {
          return Object.assign({}, ...sources);
        },
        // Filter and transform arrays
        filterMap: (array: any[], filterFn: (item: any) => boolean, mapFn: (item: any) => any) => {
          return array.filter(filterFn).map(mapFn);
        },
        // Calculate total duration
        totalDuration: (audioFiles: any[]) => {
          return audioFiles.reduce((sum, file) => sum + (file.duration || 0), 0);
        }
      }
    };

    // Create a function that executes the user code
    const executeUserCode = new Function(
      'context',
      `
      with (context) {
        ${code}
        return output;
      }
      `
    );

    // Execute the code
    const result = executeUserCode(context);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      output: result,
      execution_time: executionTime
    };

  } catch (error) {
    return {
      success: false,
      error: `Code execution error: ${error}`
    };
  }
}

// GET endpoint for testing code execution
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testCode = searchParams.get('test');

  if (testCode === 'json2video') {
    // Test code for JSON2Video transformation
    const sampleCode = `
// Transform audio files to JSON2Video format
const audioFiles = input.audio_files || [];
const template = input.template || 'minecraft_chat';

output = utils.toJSON2Video(audioFiles, template);

// Add background video if provided
if (input.background_video) {
  output.background = {
    type: 'video',
    src: input.background_video,
    loop: true
  };
}

// Add title if provided
if (input.title) {
  output.title = {
    text: input.title,
    duration: 3,
    position: 'top'
  };
}
    `;

    const sampleInput = {
      audio_files: [
        {
          character: 'Stewie',
          dialogue: 'Hey Peter, did you see that crazy Minecraft build?',
          audio_url: 'https://example.com/stewie1.mp3',
          duration: 3.5
        },
        {
          character: 'Peter',
          dialogue: 'Oh yeah! That was totally awesome, Stewie!',
          audio_url: 'https://example.com/peter1.mp3',
          duration: 2.8
        }
      ],
      template: 'minecraft_chat',
      background_video: 'https://example.com/minecraft_background.mp4',
      title: 'Stewie & Peter Talk Minecraft'
    };

    const result = await executeCode(sampleCode, sampleInput);

    return NextResponse.json({
      sample_code: sampleCode,
      sample_input: sampleInput,
      result
    });
  }

  return NextResponse.json({
    message: 'Code execution API endpoint',
    available_tests: ['json2video'],
    usage: 'POST with { code, input_data, workflow_id?, node_id? }'
  });
} 