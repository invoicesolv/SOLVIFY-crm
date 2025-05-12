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
 * Endpoint to find and fix incorrect blog URLs in the database
 * This will change any /posts/ URLs to /blog/ URLs
 */
export async function GET(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('GET /api/debug-generation/fix-blog-urls - Request received');

    // Get the Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('Failed to initialize Supabase admin client');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Find all content with incorrect blog URLs (containing /posts/ instead of /blog/)
    const { data: contentToFix, error: findError } = await supabaseAdmin
      .from('generated_content')
      .select('id, title, blog_post_url')
      .filter('blog_post_url', 'ilike', '%/posts/%')
      .filter('published_to_blog', 'eq', true);

    if (findError) {
      console.error('Error finding content to fix:', findError);
      return NextResponse.json({ error: 'Failed to search for content' }, { status: 500 });
    }

    console.log(`Found ${contentToFix?.length || 0} items with incorrect blog URLs`);

    if (!contentToFix || contentToFix.length === 0) {
      return NextResponse.json({ message: 'No blog URLs need to be fixed', fixed: 0 });
    }

    // Fix each item found
    const fixedItems: Array<{id: string, title: string, oldUrl: string, newUrl: string}> = [];
    let errorCount = 0;

    for (const item of contentToFix) {
      // Replace /posts/ with /blog/ in the URL
      const fixedUrl = item.blog_post_url.replace('/posts/', '/blog/');
      
      console.log(`Fixing URL for "${item.title}": ${item.blog_post_url} -> ${fixedUrl}`);
      
      const { error: updateError } = await supabaseAdmin
        .from('generated_content')
        .update({ blog_post_url: fixedUrl })
        .eq('id', item.id);
      
      if (updateError) {
        console.error(`Error updating item ${item.id}:`, updateError);
        errorCount++;
      } else {
        fixedItems.push({
          id: item.id,
          title: item.title,
          oldUrl: item.blog_post_url,
          newUrl: fixedUrl
        });
      }
    }

    return NextResponse.json({
      message: `Fixed ${fixedItems.length} blog URLs`,
      fixed: fixedItems.length,
      errors: errorCount,
      items: fixedItems
    });
  } catch (error) {
    console.error('Error in fix-blog-urls endpoint:', error);
    return NextResponse.json({ 
      error: `An error occurred: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
} 