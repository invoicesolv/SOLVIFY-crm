import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
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

// Function to check if the error_message column exists and add it if missing
async function ensureErrorMessageColumn() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('Failed to initialize Supabase admin client');
      return false;
    }
    
    // First check if the column exists using admin client
    const { error: columnCheckError } = await supabaseAdmin
      .from('generated_content')
      .select('error_message')
      .limit(1);
      
    if (columnCheckError && columnCheckError.message?.includes('does not exist')) {
      // Column doesn't exist, try to add it
      console.log('Error message column does not exist, attempting to add it');
      
      try {
        // Try to add the column via RPC
        const alterSQL = `
          ALTER TABLE public.generated_content 
          ADD COLUMN IF NOT EXISTS error_message TEXT;
        `;
        
        // Try RPC if available
        try {
          console.log('Attempting to add error_message column using RPC...');
          const { error: alterError } = await supabaseAdmin.rpc('execute_sql', { query: alterSQL });
          
          if (alterError) {
            console.error('Error adding error_message column using RPC:', alterError);
          } else {
            console.log('Added error_message column successfully');
            return true;
          }
        } catch (rpcError) {
          console.error('RPC not available for schema migration:', rpcError);
        }
      } catch (alterError) {
        console.error('Error attempting to add error_message column:', alterError);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking/adding error_message column:', error);
    return false;
  }
}

// Add the deduplication helper function before the GET handler
function deduplicateContentByTitle(content: any[]): any[] {
  // First ensure we have a valid array
  if (!Array.isArray(content) || content.length === 0) {
    return [];
  }
  
  // Sort by created_at in descending order (newest first)
  const sortedContent = [...content].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA; // Newest first
  });
  
  // Keep track of titles we've seen
  const seenTitles = new Set<string>();
  const uniqueContent: any[] = [];
  
  for (const item of sortedContent) {
    // Skip invalid items
    if (!item || !item.title) continue;
    
    // Skip duplicates, keeping only the first (newest) occurrence
    if (seenTitles.has(item.title)) continue;
    
    // Add to unique list and mark title as seen
    seenTitles.add(item.title);
    uniqueContent.push(item);
  }
  
  return uniqueContent;
}

export async function GET(req: Request) {
  try {
    console.log('GET /api/content - Starting request handling');
    
    // Initialize Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('Failed to initialize Supabase admin client');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    // Try to ensure schema includes error_message column
    await ensureErrorMessageColumn();
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log('GET /api/content - No authenticated session found');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('GET /api/content - User ID from session:', session.user.id);

    // Get query parameters
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId');
    const batchId = url.searchParams.get('batchId');
    const contentId = url.searchParams.get('id'); // New: Optional specific content ID

    if (!workspaceId) {
      console.log('GET /api/content - No workspace ID provided');
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    console.log('GET /api/content - Processing request for workspace ID:', workspaceId);
    if (batchId) {
      console.log('GET /api/content - Filtering by batch ID:', batchId);
    }
    if (contentId) {
      console.log('GET /api/content - Fetching specific content ID:', contentId);
    }

    // Check if user has access to the workspace - use regular client for this check
    console.log('GET /api/content - Checking workspace membership...');
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (membershipError) {
      console.error('GET /api/content - Error checking workspace membership:', membershipError);
    }

    console.log('GET /api/content - Checking workspace ownership...');
    const { data: ownedWorkspace, error: ownedError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .eq('owner_id', session.user.id)
      .maybeSingle();

    if (ownedError) {
      console.error('GET /api/content - Error checking workspace ownership:', ownedError);
    }

    if ((membershipError || !membership) && (ownedError || !ownedWorkspace)) {
      console.log('GET /api/content - User does not have access to this workspace');
      return NextResponse.json({ error: 'Access to this workspace denied' }, { status: 403 });
    }

    console.log('GET /api/content - User has access to the workspace');

    // Use admin client to bypass RLS
    try {
      // Get content for this workspace
      console.log('GET /api/content - Fetching content from database...');
      
      // Handle specific content ID request - different from batch requests
      if (contentId) {
        const { data: singleContent, error: singleContentError } = await supabaseAdmin
      .from('generated_content')
      .select('*')
          .eq('id', contentId)
      .eq('workspace_id', workspaceId)
          .maybeSingle(); // Change from .single() to .maybeSingle() to prevent PGRST116 error

        if (singleContentError) {
          console.error('GET /api/content - Error fetching single content:', singleContentError);
          return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }

        if (!singleContent) {
          console.log('GET /api/content - No content found with ID:', contentId);
          return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }

        console.log('GET /api/content - Single content fetched successfully');
        return NextResponse.json({ content: singleContent });
      }
      
      // For batch or workspace requests - always return an array
      // Start building the query
      let query = supabaseAdmin
        .from('generated_content')
        .select('*')
        .eq('workspace_id', workspaceId);
      
      // If batchId is provided, filter by it
      if (batchId) {
        query = query.eq('batch_id', batchId);
        console.log('GET /api/content - Filtering by batch ID:', batchId);
      }
      
      // Order by created_at and execute the query
      const { data: content, error: contentError } = await query
      .order('created_at', { ascending: false });

    if (contentError) {
        // Check if error is related to missing table
        if (contentError.message?.includes('does not exist') || 
            contentError.code === '42P01') {
          console.log('GET /api/content - The generated_content table does not exist');
          return NextResponse.json({ content: [] });
        }
        
        console.error('GET /api/content - Error fetching content:', contentError);
        console.error('GET /api/content - Error details:', contentError.details, contentError.hint, contentError.message);
        return NextResponse.json({ error: contentError.message }, { status: 500 });
      }

      console.log(`GET /api/content - Content fetched successfully. Items: ${content?.length || 0}`);

      // Before returning the content array, deduplicate by title
      if (content && content.length > 0) {
        // Deduplicate by title, keeping the most recent version
        const deduplicatedContent = deduplicateContentByTitle(content);
        console.log(`GET /api/content - Deduplicated content: ${content.length} → ${deduplicatedContent.length}`);
        return NextResponse.json({ content: deduplicatedContent });
    }

    return NextResponse.json({ content: content || [] });
    } catch (dbError) {
      console.error('GET /api/content - Database error:', dbError);
      // Return empty array instead of error to prevent UI breaking
      return NextResponse.json({ content: [] });
    }

  } catch (error) {
    console.error('GET /api/content - Unexpected error:', error);
    // Return empty content array instead of error
    return NextResponse.json({ content: [] });
  }
} 