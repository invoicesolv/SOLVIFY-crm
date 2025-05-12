import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Get endpoint to check content for published blog posts
 */
export async function GET(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get the Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    // Get published posts with their content
    const { data: posts, error } = await supabaseAdmin
      .from('generated_content')
      .select('id, title, content, blog_post_url, is_featured, updated_at')
      .eq('published_to_blog', true)
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching blog posts:', error);
      return NextResponse.json({ error: 'Failed to fetch blog posts' }, { status: 500 });
    }
    
    if (!posts || posts.length === 0) {
      return NextResponse.json({ message: 'No published blog posts found' });
    }
    
    // Check for unique content
    const contentHashes = new Map();
    const duplicateContent = [];
    
    // Process each post to check for duplicates
    const postsWithInfo = posts.map(post => {
      // Create a hash of the first 100 characters to check for duplicates
      const contentPreview = post.content?.substring(0, 100) || '';
      const contentHash = Buffer.from(contentPreview).toString('base64');
      
      // Track duplicate content
      if (contentHashes.has(contentHash) && contentPreview) {
        duplicateContent.push({
          id: post.id,
          title: post.title,
          duplicateOf: contentHashes.get(contentHash)
        });
      } else if (contentPreview) {
        contentHashes.set(contentHash, post.id);
      }
      
      // Extract the slug from the URL
      const urlParts = post.blog_post_url?.split('/') || [];
      const slug = urlParts[urlParts.length - 1] || '';
      
      return {
        id: post.id,
        title: post.title,
        url: post.blog_post_url,
        slug,
        is_featured: post.is_featured,
        contentLength: post.content?.length || 0,
        contentPreview: post.content?.substring(0, 100) + '...' || 'No content'
      };
    });
    
    return NextResponse.json({
      success: true,
      count: posts.length,
      uniqueContentCount: contentHashes.size,
      hasDuplicateContent: duplicateContent.length > 0,
      duplicateContent,
      posts: postsWithInfo
    });
    
  } catch (error) {
    console.error('Error checking blog content:', error);
    return NextResponse.json({ 
      error: `An error occurred: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
} 