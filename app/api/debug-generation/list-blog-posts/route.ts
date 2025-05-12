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

// Define types for blog posts
interface BlogPost {
  id: string;
  title: string;
  blog_post_url?: string | null;
  published_to_blog: boolean;
  created_at: string;
  updated_at: string;
  status: string;
  content?: string;
  [key: string]: any; // Allow other fields
}

interface EnrichedBlogPost extends BlogPost {
  isSlugValid: boolean;
  isFeatured: boolean;
  slugStatus: 'valid' | 'invalid';
}

/**
 * GET endpoint to list all blog posts
 */
export async function GET(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('GET /api/debug-generation/list-blog-posts - Request received');

    // Get parameters from URL (optional)
    const url = new URL(req.url);
    const onlyPublished = url.searchParams.get('published') === 'true';
    const getContent = url.searchParams.get('content') === 'true';

    // Get the Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('Failed to initialize Supabase admin client');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Set up query - select fields based on whether we want content too
    let fields = 'id, title, blog_post_url, published_to_blog, created_at, updated_at, status';
    if (getContent) {
      fields += ', content';
    }

    // Query the database
    let query = supabaseAdmin
      .from('generated_content')
      .select(fields);
    
    // Filter if only published posts are requested
    if (onlyPublished) {
      query = query.eq('published_to_blog', true);
    }
    
    // Execute the query
    const { data: posts, error } = await query
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching blog posts:', error);
      return NextResponse.json({ error: 'Failed to fetch blog posts' }, { status: 500 });
    }
    
    // Fetch the API settings to check if there's a mismatch in featured posts
    const { data: apiSettings, error: settingsError } = await supabaseAdmin
      .from('api_settings')
      .select('key, value')
      .in('key', ['featured_post_id', 'featured_post_count']);
    
    let featuredPostId: string | null = null;
    let featuredPostCount = 1;
    
    if (!settingsError && apiSettings) {
      for (const setting of apiSettings) {
        if (setting.key === 'featured_post_id') {
          featuredPostId = setting.value;
        } else if (setting.key === 'featured_post_count') {
          featuredPostCount = parseInt(setting.value) || 1;
        }
      }
    }
    
    // Enrich post data with some additional information
    const enrichedPosts = [];
    
    if (posts && Array.isArray(posts)) {
      for (const post of posts) {
        const isSlugValid = post.blog_post_url ? 
          !post.blog_post_url.includes('%') && !post.blog_post_url.endsWith('-') : 
          false;
        
        const isFeatured = featuredPostId ? 
          post.id === featuredPostId : 
          false;
        
        enrichedPosts.push({
          ...post,
          isSlugValid,
          isFeatured,
          slugStatus: isSlugValid ? 'valid' : 'invalid'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      count: enrichedPosts.length,
      featuredPostId,
      featuredPostCount,
      posts: enrichedPosts
    });
  } catch (error) {
    console.error('Error in list-blog-posts endpoint:', error);
    return NextResponse.json({ 
      error: `An error occurred: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
} 