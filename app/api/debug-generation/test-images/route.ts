import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { getRandomImage, trackDownload, UnsplashImage } from '@/lib/unsplash';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the URL params
    const url = new URL(req.url);
    const keyword = url.searchParams.get('keyword') || 'business';
    const workspaceId = url.searchParams.get('workspace_id');
    
    // If a workspace ID is provided, try to get its Unsplash API key
    let apiKey = process.env.UNSPLASH_ACCESS_KEY || '';
    if (workspaceId) {
      const { data, error } = await supabase
        .from('workspace_settings')
        .select('unsplash_api_key')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
        
      if (!error && data?.unsplash_api_key) {
        apiKey = data.unsplash_api_key;
      }
    }
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'No Unsplash API key available',
        suggestion: 'Add an API key in workspace settings or set the UNSPLASH_ACCESS_KEY environment variable'
      }, { status: 400 });
    }
    
    // Fetch image from Unsplash
    console.log(`Fetching Unsplash image for keyword: ${keyword}`);
    const image = await getRandomImage(keyword, apiKey);
    
    if (!image) {
      return NextResponse.json({
        error: 'Failed to fetch image from Unsplash',
        apiKeyFormat: apiKey ? `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}` : 'Not provided'
      }, { status: 500 });
    }
    
    // Track the download if it's a real Unsplash image (not a fallback)
    if (image.id !== 'local-fallback') {
      await trackDownload(image.id);
    }
    
    return NextResponse.json({
      success: true,
      image: {
        url: image.url,
        small_url: image.small_url,
        alt_text: image.alt_text,
        id: image.id,
        author: {
          name: image.author.name,
          username: image.author.username,
          link: image.author.link
        },
        is_fallback: image.id === 'local-fallback'
      }
    });
  } catch (error) {
    console.error('Error testing Unsplash image fetching:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
} 