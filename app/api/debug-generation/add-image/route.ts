import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { getRandomImage, trackDownload } from '@/lib/unsplash';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client with service role key
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(req: Request) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Environment check
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'This endpoint is only available in development mode' }, { status: 403 });
    }
    
    // Get the request body
    const body = await req.json();
    const { contentId, keyword, apiKey } = body;
    
    if (!contentId) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
    }
    
    // Initialize Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Failed to initialize Supabase admin client' }, { status: 500 });
    }
    
    // Verify the content exists
    const { data: content, error: contentError } = await supabaseAdmin
      .from('generated_content')
      .select('id, title')
      .eq('id', contentId)
      .single();
      
    if (contentError || !content) {
      return NextResponse.json({ 
        error: 'Content not found',
        details: contentError?.message
      }, { status: 404 });
    }
    
    // Fetch a featured image
    const searchKeyword = keyword || content.title.split(' ')[0] || 'business';
    const useApiKey = apiKey || process.env.UNSPLASH_ACCESS_KEY;
    
    if (!useApiKey) {
      return NextResponse.json({ error: 'No Unsplash API key available' }, { status: 400 });
    }
    
    console.log(`Fetching image for keyword: ${searchKeyword}`);
    const image = await getRandomImage(searchKeyword, useApiKey);
    
    if (!image) {
      return NextResponse.json({ error: 'Failed to fetch image from Unsplash' }, { status: 500 });
    }
    
    // Track the download if it's a real Unsplash image
    if (image.id !== 'local-fallback') {
      await trackDownload(image.id);
    }
    
    // Update the content with the featured image
    const { data: updatedContent, error: updateError } = await supabaseAdmin
      .from('generated_content')
      .update({
        featured_image_url: image.url,
        featured_image_alt: image.alt_text,
        featured_image_attribution: {
          author_name: image.author.name,
          author_username: image.author.username,
          author_link: image.author.link,
          unsplash_id: image.id
        },
        has_images: true
      })
      .eq('id', contentId)
      .select('id, title, featured_image_url')
      .single();
      
    if (updateError) {
      return NextResponse.json({
        error: 'Failed to update content with featured image',
        details: updateError.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Featured image added successfully',
      content: updatedContent,
      image: {
        url: image.url,
        alt: image.alt_text,
        author: {
          name: image.author.name,
          username: image.author.username,
          link: image.author.link
        }
      }
    });
    
  } catch (error) {
    console.error('Error adding featured image:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
} 