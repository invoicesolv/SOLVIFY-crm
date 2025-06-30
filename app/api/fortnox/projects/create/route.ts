import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';
import { getUserFromToken } from '@/lib/auth-utils';
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

// Helper function to create a project in Fortnox
async function createProject(tokenData: any, projectData: any) {
  if (!tokenData || !tokenData.access_token) {
    console.error('No valid token provided to createProject');
    throw new Error('No valid token provided');
  }
  
  console.log(`Creating project in Fortnox with access token`);
  
  try {
    const url = `${BASE_API_URL}projects`;
    console.log(`Calling Fortnox API with URL: ${url}`);
    
    // Format the request body for Fortnox API
    const requestBody = {
      Project: {
        Description: projectData.description,
        Status: projectData.status || 'NOTSTARTED',
        StartDate: projectData.startDate,
        EndDate: projectData.endDate,
        CustomerNumber: projectData.customerNumber,
        Comments: projectData.comments || '',
        ProjectLeader: projectData.projectLeader || ''
      }
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`Fortnox API response status: ${response.status}`);
    
    if (response.status === 201) {
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
    console.error('Error creating project in Fortnox:', e);
    throw e;
  }
}

export async function POST(req: NextRequest) {
  console.log('\n=== Creating Fortnox Project ===');
  
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    
    // Parse the request body
    const requestData = await req.json();
    console.log('Request data:', requestData);
    
    // Basic validation
    if (!requestData.description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }
    
    // Load Fortnox token
    const tokenData = await loadTokenFromSupabase(finalUserId);
    
    if (!tokenData || !tokenData.access_token) {
      console.error('No Fortnox token found for user');
      return NextResponse.json(
        { error: 'Not connected to Fortnox', tokenStatus: 'missing' }, 
        { status: 401 }
      );
    }
    
    // Create the project in Fortnox
    const project = await createProject(tokenData, requestData);
    
    if (!project) {
      return NextResponse.json({ 
        error: `Failed to create project` 
      }, { status: 500 });
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
    
    return NextResponse.json({ 
      message: 'Project created successfully',
      Project: formattedProject 
    }, { status: 201 });
  } catch (error) {
    console.error('Error processing Fortnox project creation request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 