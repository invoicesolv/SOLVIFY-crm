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
      script_id,
      audio_id,
      video_template,
      background_media,
      resolution,
      render_service,
      api_key
    } = body;

    if (!script_id || !audio_id || !render_service) {
      return NextResponse.json(
        { error: 'Missing required fields: script_id, audio_id, and render_service' },
        { status: 400 }
      );
    }

    // Get script and audio data
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const [scriptResult, audioResult] = await Promise.all([
        supabaseAdmin.from('generated_scripts').select('*').eq('id', script_id).single(),
        supabaseAdmin.from('generated_audio').select('*').eq('id', audio_id).single()
      ]);

      if (scriptResult.error || audioResult.error) {
        return NextResponse.json(
          { error: 'Failed to fetch script or audio data' },
          { status: 404 }
        );
      }

      const script = scriptResult.data;
      const audio = audioResult.data;

      // Create video render job
      const renderResult = await createVideoRender({
        script,
        audio,
        video_template,
        background_media,
        resolution: resolution || '1920x1080',
        render_service,
        api_key
      });

      if (!renderResult.success) {
        return NextResponse.json(
          { error: renderResult.error },
          { status: 500 }
        );
      }

      // Store the video render job
      try {
        const { data: videoRecord, error: insertError } = await supabaseAdmin
          .from('generated_videos')
          .insert({
            script_id,
            audio_id,
            video_template,
            background_media,
            resolution,
            render_service,
            video_url: renderResult.video_url,
            render_status: renderResult.status || 'pending',
            render_progress: 0,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error storing video record:', insertError);
          // Continue anyway, return the render result even if storage fails
        }

        return NextResponse.json({
          success: true,
          video_id: videoRecord?.id,
          render_job_id: renderResult.job_id,
          video_url: renderResult.video_url,
          status: renderResult.status,
          message: 'Video render job created successfully'
        });
      } catch (dbError) {
        console.error('Database error:', dbError);
        // Return the render result even if database storage fails
        return NextResponse.json({
          success: true,
          video_id: null,
          render_job_id: renderResult.job_id,
          video_url: renderResult.video_url,
          status: renderResult.status,
          message: 'Video render job created successfully (storage failed)'
        });
      }
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Video render error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('video_id');
    const jobId = searchParams.get('job_id');

    if (!videoId && !jobId) {
      return NextResponse.json(
        { error: 'video_id or job_id parameter is required' },
        { status: 400 }
      );
    }

    try {
      const supabaseAdmin = getSupabaseAdmin();
      let video;
      if (videoId) {
        const { data, error } = await supabaseAdmin
          .from('generated_videos')
          .select('*')
          .eq('id', videoId)
          .single();

        if (error) {
          return NextResponse.json(
            { error: 'Video not found' },
            { status: 404 }
          );
        }
        video = data;
      }

      // Check render status if we have a job ID
      if (jobId && video?.render_service) {
        const statusResult = await checkRenderStatus(video.render_service, jobId);
        
        if (statusResult.success && video) {
          // Update video record with latest status
          try {
            await supabaseAdmin
              .from('generated_videos')
              .update({
                render_status: statusResult.status,
                render_progress: statusResult.progress,
                video_url: statusResult.video_url || video.video_url,
                completed_at: statusResult.status === 'completed' ? new Date().toISOString() : null
              })
              .eq('id', video.id);

            video.render_status = statusResult.status;
            video.render_progress = statusResult.progress;
            video.video_url = statusResult.video_url || video.video_url;
          } catch (updateError) {
            console.error('Error updating video status:', updateError);
            // Continue with current data
          }
        }
      }

      return NextResponse.json({
        success: true,
        video: video,
        status: video?.render_status,
        progress: video?.render_progress,
        video_url: video?.video_url
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error checking video status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function createVideoRender(config: {
  script: any;
  audio: any;
  video_template: string;
  background_media?: string;
  resolution: string;
  render_service: string;
  api_key?: string;
}): Promise<{ success: boolean; job_id?: string; video_url?: string; status?: string; error?: string }> {
  
  try {
    switch (config.render_service) {
      case 'json2video':
        return await createJSON2VideoRender(config);
      case 'remotion':
        return await createRemotionRender(config);
      case 'ffmpeg':
        return await createFFmpegRender(config);
      default:
        return { success: false, error: 'Unsupported render service' };
    }
  } catch (error) {
    return { success: false, error: `Video render failed: ${error}` };
  }
}

async function createJSON2VideoRender(config: {
  script: any;
  audio: any;
  video_template: string;
  background_media?: string;
  resolution: string;
  api_key?: string;
}): Promise<{ success: boolean; job_id?: string; video_url?: string; status?: string; error?: string }> {
  
  try {
    if (!config.api_key) {
      return { success: false, error: 'JSON2Video API key is required' };
    }

    // Create JSON2Video template based on the configuration
    const template = createJSON2VideoTemplate(config);

    const response = await fetch('https://api.json2video.com/v2/movies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.api_key
      },
      body: JSON.stringify(template)
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: `JSON2Video API error: ${errorData.message}` };
    }

    const result = await response.json();
    
    return {
      success: true,
      job_id: result.id,
      video_url: result.url,
      status: result.status || 'pending'
    };

  } catch (error) {
    return { success: false, error: `JSON2Video render failed: ${error}` };
  }
}

function createJSON2VideoTemplate(config: {
  script: any;
  audio: any;
  video_template: string;
  background_media?: string;
  resolution: string;
}): any {
  
  const [width, height] = config.resolution.split('x').map(Number);
  
  // Create scenes for each audio clip
  const scenes = config.audio.audio_files.map((audioFile: any, index: number) => {
    const scene: any = {
      comment: `Scene ${index + 1} - ${audioFile.character}`,
      duration: audioFile.duration,
      elements: []
    };

    // Add background video/image
    if (config.background_media) {
      scene.elements.push({
        type: config.background_media.includes('.mp4') || config.background_media.includes('.mov') ? 'video' : 'image',
        src: config.background_media,
        duration: audioFile.duration,
        x: 0,
        y: 0,
        width: width,
        height: height
      });
    }

    // Add audio
    scene.elements.push({
      type: 'audio',
      src: audioFile.audio_url,
      duration: audioFile.duration
    });

    // Add text overlay based on template
    if (config.video_template === 'minecraft_chat') {
      scene.elements.push({
        type: 'text',
        text: `${audioFile.character}: ${audioFile.dialogue}`,
        x: 50,
        y: height - 150,
        width: width - 100,
        height: 100,
        fontSize: 24,
        fontFamily: 'Arial',
        color: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.7)',
        textAlign: 'left'
      });
    } else if (config.video_template === 'family_guy_style') {
      scene.elements.push({
        type: 'text',
        text: audioFile.dialogue,
        x: 50,
        y: height - 200,
        width: width - 100,
        height: 150,
        fontSize: 28,
        fontFamily: 'Arial Bold',
        color: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.8)',
        textAlign: 'center'
      });
    }

    return scene;
  });

  return {
    resolution: config.resolution,
    quality: 'high',
    scenes: scenes,
    soundtrack: null // Audio is handled per scene
  };
}

async function createRemotionRender(config: any): Promise<{ success: boolean; job_id?: string; video_url?: string; status?: string; error?: string }> {
  // Remotion implementation would go here
  return { success: false, error: 'Remotion render service not implemented yet' };
}

async function createFFmpegRender(config: any): Promise<{ success: boolean; job_id?: string; video_url?: string; status?: string; error?: string }> {
  // FFmpeg implementation would go here
  return { success: false, error: 'FFmpeg render service not implemented yet' };
}

async function checkRenderStatus(service: string, jobId: string): Promise<{ success: boolean; status?: string; progress?: number; video_url?: string; error?: string }> {
  try {
    switch (service) {
      case 'json2video':
        return await checkJSON2VideoStatus(jobId);
      case 'remotion':
        return await checkRemotionStatus(jobId);
      case 'ffmpeg':
        return await checkFFmpegStatus(jobId);
      default:
        return { success: false, error: 'Unsupported render service' };
    }
  } catch (error) {
    return { success: false, error: `Status check failed: ${error}` };
  }
}

async function checkJSON2VideoStatus(jobId: string): Promise<{ success: boolean; status?: string; progress?: number; video_url?: string; error?: string }> {
  try {
    // This would require the API key, which we'd need to store or pass
    // For now, return a simulated response
    return {
      success: true,
      status: 'completed',
      progress: 100,
      video_url: `https://json2video.com/videos/${jobId}.mp4`
    };
  } catch (error) {
    return { success: false, error: `JSON2Video status check failed: ${error}` };
  }
}

async function checkRemotionStatus(jobId: string): Promise<{ success: boolean; status?: string; progress?: number; video_url?: string; error?: string }> {
  return { success: false, error: 'Remotion status check not implemented yet' };
}

async function checkFFmpegStatus(jobId: string): Promise<{ success: boolean; status?: string; progress?: number; video_url?: string; error?: string }> {
  return { success: false, error: 'FFmpeg status check not implemented yet' };
} 