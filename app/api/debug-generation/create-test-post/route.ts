import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';

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
 * POST endpoint to create a test blog post
 */
export async function POST(req: Request) {
  try {
    console.log('POST /api/debug-generation/create-test-post - Request received');
    
    // Get the Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('Failed to initialize Supabase admin client');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    // Parse request body
    const body = await req.json();
    const { title, content, published_to_blog = true, blog_post_url = null } = body;
    
    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }
    
    console.log('Creating test post with title:', title);
    
    // Format the slug from the title if blog_post_url is not provided
    let postUrl = blog_post_url;
    if (!postUrl) {
      const slug = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')  // Remove special characters
        .replace(/\s+/g, '-')      // Replace spaces with hyphens
        .replace(/-+/g, '-')       // Replace multiple hyphens with single hyphen
        .trim();                    // Trim leading/trailing spaces
      
      postUrl = `https://crm.solvify.se/blog/${slug}`;
    }
    
    // Insert the test post
    const { data: post, error } = await supabaseAdmin
      .from('generated_content')
      .insert([
        {
          title,
          content,
          published_to_blog,
          blog_post_url: postUrl,
          status: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_featured: true,
          workspace_id: '00000000-0000-0000-0000-000000000000' // Placeholder workspace ID
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating test post:', error);
      return NextResponse.json({ error: 'Failed to create test post' }, { status: 500 });
    }
    
    console.log('Test post created successfully with ID:', post.id);
    
    return NextResponse.json({
      success: true,
      message: 'Test post created successfully',
      post
    });
    
  } catch (error) {
    console.error('Error handling create test post request:', error);
    return NextResponse.json({ 
      error: `An error occurred: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
} 