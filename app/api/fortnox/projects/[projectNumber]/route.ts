import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

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

// Helper function to fetch a specific project from Fortnox
async function fetchProjectByNumber(tokenData: any, projectNumber: string) {
  if (!tokenData || !tokenData.access_token) {
    console.error('No valid token provided to fetchProjectByNumber');
    throw new Error('No valid token provided');
  }
  
  console.log(`Fetching project ${projectNumber} from Fortnox with access token`);
  
  try {
    // Construct the URL for the specific project
    const url = `${BASE_API_URL}projects/${projectNumber}`;
    console.log(`Calling Fortnox API with URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Fortnox API response status: ${response.status}`);
    
    if (response.status === 200) {
      const data = await response.json();
      return data.Project || null;
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
  } catch (e) {
    console.error(`Error fetching project ${projectNumber} from Fortnox:`, e);
    throw e;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { projectNumber: string } }
) {
  console.log(`\n=== Fetching Fortnox Project: ${params.projectNumber} ===`);
  
  // Get user ID from session or request header
  let userId: string | null = null;
  
  // First try to get from the session
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    userId = session.user.id;
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
  const projectNumber = params.projectNumber;
  
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
    
    // Fetch the specific project from Fortnox
    const project = await fetchProjectByNumber(tokenData, projectNumber);
    
    if (!project) {
      return NextResponse.json({ 
        error: `Project with number ${projectNumber} not found` 
      }, { status: 404 });
    }
    
    // Format the project for response
    const formattedProject = {
      ProjectNumber: project.ProjectNumber,
      Description: project.Description,
      Status: project.Status,
      StartDate: project.StartDate,
      EndDate: project.EndDate,
      CustomerNumber: project.CustomerNumber,
      CustomerName: project.CustomerName,
      Comments: project.Comments,
      ProjectLeader: project.ProjectLeader
    };
    
    return NextResponse.json({ Project: formattedProject });
  } catch (error) {
    console.error('Error processing Fortnox project request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 