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
 * DELETE endpoint to remove test posts from the database
 */
export async function DELETE(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('DELETE /api/debug-generation/delete-test-posts - Request received');

    // Get parameters from URL
    const url = new URL(req.url);
    const contentId = url.searchParams.get('id');
    const isTestPost = url.searchParams.get('isTestPost') === 'true';
    const titleMatch = url.searchParams.get('titleMatch');

    // Get the Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('Failed to initialize Supabase admin client');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Set up query
    let query = supabaseAdmin.from('generated_content');

    // Delete specific post if ID is provided
    if (contentId) {
      console.log(`Deleting content with ID: ${contentId}`);
      const { error } = await query.delete().eq('id', contentId);
      
      if (error) {
        console.error('Error deleting content:', error);
        return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
      }
      
      return NextResponse.json({ 
        success: true,
        message: `Content with ID ${contentId} deleted successfully` 
      });
    }
    
    // Delete test posts based on title pattern
    if (titleMatch) {
      console.log(`Deleting content with title matching: ${titleMatch}`);
      const { data: deletedData, error } = await query
        .delete()
        .ilike('title', `%${titleMatch}%`)
        .select('id, title');
      
      if (error) {
        console.error('Error deleting content:', error);
        return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
      }
      
      console.log(`Deleted ${deletedData?.length || 0} posts matching "${titleMatch}"`);
      
      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedData?.length || 0} posts matching "${titleMatch}"`,
        deleted: deletedData
      });
    }
    
    // Delete posts with "Test Post" in the title (default behavior for test posts)
    if (isTestPost) {
      console.log('Deleting all test posts');
      const { data: deletedData, error } = await query
        .delete()
        .or('title.ilike.%Test Post%,title.ilike.%test post%')
        .select('id, title');
      
      if (error) {
        console.error('Error deleting test posts:', error);
        return NextResponse.json({ error: 'Failed to delete test posts' }, { status: 500 });
      }
      
      console.log(`Deleted ${deletedData?.length || 0} test posts`);
      
      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedData?.length || 0} test posts`,
        deleted: deletedData
      });
    }
    
    return NextResponse.json({ 
      error: 'Missing parameters - provide id, isTestPost=true, or titleMatch' 
    }, { status: 400 });
    
  } catch (error) {
    console.error('Error in delete-test-posts endpoint:', error);
    return NextResponse.json({ 
      error: `An error occurred: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
} 