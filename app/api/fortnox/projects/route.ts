import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// Fortnox API URL
const BASE_API_URL = 'https://api.fortnox.se/3/';

// Create Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Helper function to load token from Supabase
async function loadTokenFromSupabase(userId: string) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Failed to initialize Supabase client');
    }

    const { data, error } = await supabase
      .from('user_fortnox_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error loading token from Supabase:', error);
      return null;
    }

    if (!data) {
      console.error('No token found for user:', userId);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in loadTokenFromSupabase:', error);
    return null;
  }
}

// Helper function to fetch projects from Fortnox
async function fetchProjects(tokenData: any) {
  if (!tokenData || !tokenData.access_token) {
    console.error('No valid token provided to fetchProjects');
    throw new Error('No valid token provided');
  }
  
  console.log(`Fetching projects from Fortnox with access token`);
  
  try {
    // Construct the URL for projects
    const baseUrl = `${BASE_API_URL}projects`;
    
    // Use pagination to fetch all projects
    const allProjects: any[] = [];
    let page = 1;
    let hasMorePages = true;
    const pageSize = 500; // Larger page size to reduce API calls
    
    while (hasMorePages) {
      const url = `${baseUrl}?limit=${pageSize}&page=${page}`;
      console.log(`Calling Fortnox API with URL: ${url} (page ${page})`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Fortnox API response status for page ${page}: ${response.status}`);
      
      if (response.status === 200) {
        const data = await response.json();
        const pageProjects = data.Projects || [];
        console.log(`Retrieved ${pageProjects.length} projects from page ${page}`);
        
        // Add this page's projects to our collection
        allProjects.push(...pageProjects);
        
        // Check if we've reached the last page
        if (pageProjects.length < pageSize) {
          hasMorePages = false;
          console.log(`End of projects reached at page ${page}`);
        } else {
          page++;
        }
      } else {
        // Try to get more information about the error
        try {
          const errorText = await response.text();
          let errorDetails = errorText;
          
          // Try to parse as JSON if possible
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.ErrorInformation) {
              errorDetails = `${errorJson.ErrorInformation.message} (Code: ${errorJson.ErrorInformation.code})`;
            }
          } catch (jsonErr) {
            // Not JSON, use the text as is
          }
          
          console.error(`Fortnox API error: ${response.status} - ${errorText}`);
          throw new Error(`Fortnox API error: ${response.status} - ${errorDetails}`);
        } catch (e) {
          if (e instanceof Error && e.message.includes('Fortnox API error')) {
            throw e; // Re-throw our custom error
          }
          console.error(`Could not parse error response: ${e}`);
          throw new Error(`Fortnox API error: ${response.status}`);
        }
      }
    }
    
    console.log(`Successfully retrieved a total of ${allProjects.length} projects from Fortnox`);
    return allProjects;
  } catch (e) {
    console.error('Error fetching projects from Fortnox:', e);
    throw e;
  }
}

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  console.log('\n=== Fetching Fortnox Projects ===');
  
  // Get user ID from session or request header
  let userId: string | null = null;
  
  // First try to get from the session
  const session = await getUserFromToken(req);
  if (session?.id) {
    userId = session.id;
    console.log('Using user ID from session:', userId);
  } else {
    // If no session, check for user-id header (for client-side API calls)
    userId = req.headers.get('user-id');
    console.log('Using user ID from header:', userId);
  }
  
  if (!userId) {
    console.error('No user ID found in session or header');
    return NextResponse.json({ error: 'Unauthorized - No user ID' }, { status: 401 });
  }
  
  const finalUserId = userId;
  
  try {
    // Load Fortnox token
    const tokenData = await loadTokenFromSupabase(finalUserId);
    
    if (!tokenData || !tokenData.access_token) {
      console.error('No Fortnox token found for user');
      return NextResponse.json(
        { error: 'Not connected to Fortnox', tokenStatus: 'missing' }, 
        { status: 401 }
      );
    }
    
    // Fetch projects from Fortnox
    const allProjects = await fetchProjects(tokenData);
    console.log(`Total projects fetched from Fortnox: ${allProjects.length}`);
    
    // Format the projects for response
    const formattedProjects = allProjects.map(project => ({
      ProjectNumber: project.ProjectNumber,
      Description: project.Description,
      Status: project.Status,
      StartDate: project.StartDate,
      EndDate: project.EndDate,
      CustomerNumber: project.CustomerNumber,
      CustomerName: project.CustomerName,
      Comments: project.Comments,
      ProjectLeader: project.ProjectLeader
    }));
    
    return NextResponse.json({
      Projects: formattedProjects,
      count: formattedProjects.length
    });
  } catch (error) {
    console.error('Error processing Fortnox projects request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 