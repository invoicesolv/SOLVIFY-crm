import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
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

/**
 * Clean image URLs by removing Next.js optimization path
 * @param content Markdown content
 * @returns Cleaned content
 */
function cleanImageUrls(content: string): string {
  if (!content) return '';
  
  // Replace Next.js image optimization URLs with direct Unsplash URLs
  return content.replace(
    /!\[(.*?)\]\(https:\/\/crm\.solvify\.se\/_next\/image\?url=(https%3A%2F%2Fimages\.unsplash\.com%2F.*?)(&.*?)\)/g,
    (match, altText, encodedUrl) => {
      try {
        // Decode the URL
        const decodedUrl = decodeURIComponent(encodedUrl);
        console.log(`Replacing optimized URL with direct Unsplash URL: ${decodedUrl.substring(0, 50)}...`);
        return `![${altText}](${decodedUrl})`;
      } catch (e) {
        console.error('Error decoding URL:', e);
        // If decoding fails, keep the original
        return match;
      }
    }
  );
}

export async function POST(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    // Parse request body
    const body = await req.json();
    const { contentId } = body;
    
    if (!contentId) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
    }
    
    // Get the content from the database
    const { data: content, error: contentError } = await supabaseAdmin
      .from('generated_content')
      .select('*')
      .eq('id', contentId)
      .maybeSingle();
      
    if (contentError) {
      return NextResponse.json({ error: 'Error fetching content' }, { status: 500 });
    }
    
    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }
    
    // Clean the content
    const cleanedContent = cleanImageUrls(content.content);
    
    // Check if any replacements were made
    const replacementsCount = (cleanedContent.match(/!\[(.*?)\]\(https:\/\/images\.unsplash\.com/g) || []).length;
    
    // Update the content in the database
    const { error: updateError } = await supabaseAdmin
      .from('generated_content')
      .update({ 
        content: cleanedContent,
        updated_at: new Date().toISOString()
      })
      .eq('id', contentId);
      
    if (updateError) {
      return NextResponse.json({ error: 'Error updating content' }, { status: 500 });
    }
    
    // Clean featured image URL if needed
    let featuredImageFixed = false;
    if (content.featured_image_url && content.featured_image_url.includes('/_next/image?url=')) {
      try {
        // Extract and decode the actual Unsplash URL
        const match = content.featured_image_url.match(/url=(https%3A%2F%2Fimages\.unsplash\.com%2F.*?)(&|$)/);
        if (match && match[1]) {
          const decodedUrl = decodeURIComponent(match[1]);
          console.log(`Replacing optimized featured image URL with direct Unsplash URL`);
          
          // Update featured image URL
          const { error: featuredUpdateError } = await supabaseAdmin
            .from('generated_content')
            .update({ 
              featured_image_url: decodedUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', contentId);
            
          if (!featuredUpdateError) {
            featuredImageFixed = true;
          }
        }
      } catch (e) {
        console.error('Error fixing featured image URL:', e);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Image URLs fixed successfully',
      details: {
        contentId,
        replacementsCount,
        featuredImageFixed
      }
    });
    
  } catch (error) {
    console.error('Error fixing image URLs:', error);
    return NextResponse.json({ 
      error: `Failed to fix image URLs: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
}

/**
 * GET endpoint to scan for potential image issues
 */
export async function GET(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    // Get URL parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const workspaceId = url.searchParams.get('workspace_id');
    
    // Query to find content with potential image issues
    let query = supabaseAdmin
      .from('generated_content')
      .select('id, title, created_at, updated_at')
      .or('content.ilike.%/_next/image?url=%,featured_image_url.ilike.%/_next/image?url=%')
      .order('updated_at', { ascending: false })
      .limit(limit);
      
    // Add workspace filter if provided
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }
    
    // Execute the query
    const { data: posts, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: 'Error scanning for image issues' }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      count: posts?.length || 0,
      posts
    });
    
  } catch (error) {
    console.error('Error scanning for image issues:', error);
    return NextResponse.json({ 
      error: `Failed to scan for image issues: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
} 