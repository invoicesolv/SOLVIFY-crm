import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const formData = await request.formData();
    const content = formData.get('content') as string;
    const channelId = formData.get('channelId') as string;
    const videoType = formData.get('videoType') as string;
    const userId = formData.get('userId') as string;
    const videoFile = formData.get('video') as File;

    if (!channelId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: channelId or userId' },
        { status: 400 }
      );
    }

    // For video uploads, we need either content (title/description) or a video file
    if (!content && !videoFile) {
      return NextResponse.json(
        { error: 'Either content (for title/description) or video file is required' },
        { status: 400 }
      );
    }

    // Get YouTube access token from integrations table
    const { data: youtubeIntegration, error } = await supabase
      .from('integrations')
      .select('access_token, refresh_token')
      .eq('user_id', userId)
      .eq('service_name', 'youtube')
      .single();

    if (error || !youtubeIntegration) {
      return NextResponse.json(
        { error: 'YouTube account not connected or access token not found' },
        { status: 401 }
      );
    }

    console.log('🎥 [YouTube API] Attempting to upload video to YouTube:', {
      channelId,
      videoType,
      hasVideoFile: !!videoFile,
      videoFileName: videoFile?.name,
      videoFileSize: videoFile?.size,
      contentLength: content?.length || 0
    });

    if (videoFile) {
      // Upload video using YouTube Data API v3
      try {
        // Convert File to Buffer for upload
        const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
        
        // Prepare video metadata
        const videoMetadata = {
          snippet: {
            title: content || `${videoType === 'shorts' ? 'YouTube Short' : 'Video'} - ${new Date().toLocaleDateString()}`,
            description: content || `Uploaded via social media manager${videoType === 'shorts' ? ' as YouTube Short' : ''}`,
            tags: videoType === 'shorts' ? ['shorts', 'short'] : ['video'],
            categoryId: '22', // People & Blogs
            ...(videoType === 'shorts' && {
              // YouTube Shorts specific metadata
              defaultLanguage: 'en'
            })
          },
          status: {
            privacyStatus: 'public', // You can make this configurable
            ...(videoType === 'shorts' && {
              selfDeclaredMadeForKids: false
            })
          }
        };

        // Create proper multipart request for YouTube API
        // YouTube expects exactly 2 parts: metadata (JSON) + media (video file)
        const boundary = `----formdata-youtube-${Date.now()}`;
        
        // Build multipart body manually
        const metadataJson = JSON.stringify(videoMetadata);
        
        let body = '';
        body += `--${boundary}\r\n`;
        body += `Content-Type: application/json; charset=UTF-8\r\n\r\n`;
        body += `${metadataJson}\r\n`;
        body += `--${boundary}\r\n`;
        body += `Content-Type: ${videoFile.type || 'video/mp4'}\r\n\r\n`;
        
        // Convert to Uint8Array for proper binary handling
        const textEncoder = new TextEncoder();
        const bodyStart = textEncoder.encode(body);
        const bodyEnd = textEncoder.encode(`\r\n--${boundary}--\r\n`);
        
        // Combine all parts
        const fullBody = new Uint8Array(bodyStart.length + videoBuffer.length + bodyEnd.length);
        fullBody.set(bodyStart, 0);
        fullBody.set(new Uint8Array(videoBuffer), bodyStart.length);
        fullBody.set(bodyEnd, bodyStart.length + videoBuffer.length);

        console.log('🎥 [YouTube API] Uploading video with metadata:', videoMetadata);
        console.log('🎥 [YouTube API] Video file size:', videoBuffer.length, 'bytes');

        const uploadResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${youtubeIntegration.access_token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: fullBody
        });

        console.log('🎥 [YouTube API] Upload response status:', uploadResponse.status);

        if (uploadResponse.ok) {
          const result = await uploadResponse.json();
          console.log('🎥 [YouTube API] Video upload successful:', result);
          
          return NextResponse.json({
            success: true,
            message: `Successfully uploaded ${videoType === 'shorts' ? 'YouTube Short' : 'video'} to YouTube!`,
            data: {
              videoId: result.id,
              title: result.snippet?.title,
              description: result.snippet?.description,
              thumbnails: result.snippet?.thumbnails,
              videoType,
              url: `https://www.youtube.com/watch?v=${result.id}`,
              status: result.status?.privacyStatus
            },
            type: 'video_upload'
          });
        } else {
          const errorText = await uploadResponse.text();
          console.error('🎥 [YouTube API] Upload failed:', errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: { message: errorText } };
          }
          
          return NextResponse.json({
            success: false,
            message: `Failed to upload video to YouTube: ${errorData.error?.message || 'Unknown error'}`,
            data: { error: errorData },
            type: 'upload_error'
          }, { status: 400 });
        }
      } catch (uploadError) {
        console.error('🎥 [YouTube API] Video upload error:', uploadError);
        return NextResponse.json({
          success: false,
          message: 'Failed to upload video to YouTube',
          data: { error: uploadError instanceof Error ? uploadError.message : 'Unknown error' },
          type: 'upload_error'
        }, { status: 500 });
      }
    } else {
      // No video file provided - text only not supported
      console.log('🎥 [YouTube API] Text-only posting not supported by YouTube Data API');
      
      return NextResponse.json({
        success: false,
        message: 'YouTube requires a video file for uploads. Text-only posts are not supported through the API.',
        data: {
          content,
          channelId,
          videoType,
          status: 'video_required',
          explanation: 'YouTube Data API v3 only supports video uploads. Please select a video file to upload.',
        },
        type: 'video_required'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('🎥 [YouTube API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post to YouTube' },
      { status: 500 }
    );
  }
} 