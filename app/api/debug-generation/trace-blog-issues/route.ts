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
 * Test WordPress connectivity with debug information
 */
async function testWordPressConnection(blogUrl: string): Promise<any> {
  try {
    console.log('Testing WordPress connection to URL:', blogUrl);
    
    // Normalize URL
    const normalizedUrl = blogUrl.replace(/\/$/, '');
    
    // First check if the site is reachable at all
    const siteCheckResults: {
      url: string;
      reachable: boolean;
      isWordPress: boolean;
      apiAccessible: boolean;
      details: {
        homepageStatus?: number;
        homepageStatusText?: string;
        apiStatus?: number;
        apiStatusText?: string;
        apiResponse?: any;
        apiParseError?: string;
        apiError?: string;
        siteError?: string;
      };
    } = {
      url: normalizedUrl,
      reachable: false,
      isWordPress: false,
      apiAccessible: false,
      details: {}
    };
    
    try {
      // Try to fetch the homepage
      const homeResponse = await fetch(normalizedUrl, {
        method: 'GET',
        headers: { 'Accept': 'text/html' },
        signal: AbortSignal.timeout(10000)
      });
      
      siteCheckResults.reachable = homeResponse.ok;
      siteCheckResults.details.homepageStatus = homeResponse.status;
      siteCheckResults.details.homepageStatusText = homeResponse.statusText;
      
      // If we can reach the site, check for WordPress API
      if (homeResponse.ok) {
        try {
          // Try to fetch the WordPress API endpoint
          const apiResponse = await fetch(`${normalizedUrl}/wp-json`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000)
          });
          
          siteCheckResults.apiAccessible = apiResponse.ok;
          siteCheckResults.details.apiStatus = apiResponse.status;
          siteCheckResults.details.apiStatusText = apiResponse.statusText;
          
          if (apiResponse.ok) {
            try {
              const apiData = await apiResponse.json();
              siteCheckResults.isWordPress = !!(apiData && apiData.namespaces && apiData.namespaces.includes('wp/v2'));
              siteCheckResults.details.apiResponse = apiData ? {
                name: apiData.name,
                description: apiData.description,
                namespaces: apiData.namespaces
              } : 'No API data';
            } catch (parseError) {
              siteCheckResults.details.apiParseError = parseError instanceof Error ? parseError.message : String(parseError);
            }
          }
        } catch (apiError) {
          siteCheckResults.details.apiError = apiError instanceof Error ? apiError.message : String(apiError);
        }
      }
    } catch (siteError) {
      siteCheckResults.details.siteError = siteError instanceof Error ? siteError.message : String(siteError);
    }
    
    return siteCheckResults;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test site connectivity with debug information
 */
async function testSiteConnectivity(blogUrl: string): Promise<any> {
  try {
    console.log('Testing site connectivity to URL:', blogUrl);
    
    // Normalize URL
    const normalizedUrl = blogUrl.replace(/\/$/, '');
    
    // First check if the site is reachable at all
    const siteCheckResults: {
      url: string;
      reachable: boolean;
      apiEndpointAccessible?: boolean;
      details: {
        homepageStatus?: number;
        homepageStatusText?: string;
        isYourSite?: boolean; 
        apiEndpointStatus?: number;
        apiEndpointStatusText?: string;
        headers?: Record<string, string>;
        contentType?: string;
        error?: string;
      };
    } = {
      url: normalizedUrl,
      reachable: false,
      apiEndpointAccessible: false,
      details: {}
    };
    
    try {
      // Try to fetch the homepage
      const homeResponse = await fetch(normalizedUrl, {
        method: 'GET',
        headers: { 'Accept': 'text/html' },
        signal: AbortSignal.timeout(10000)
      });
      
      siteCheckResults.reachable = homeResponse.ok;
      siteCheckResults.details.homepageStatus = homeResponse.status;
      siteCheckResults.details.homepageStatusText = homeResponse.statusText;
      
      // Extract response headers
      const headers: Record<string, string> = {};
      homeResponse.headers.forEach((value, key) => {
        headers[key] = value;
      });
      siteCheckResults.details.headers = headers;
      siteCheckResults.details.contentType = homeResponse.headers.get('content-type') || 'unknown';
      
      // Check if the API endpoint is accessible
      try {
        // Try to verify if the API endpoint exists
        const apiEndpoint = `${normalizedUrl}/api/create-post`;
        console.log('Checking if API endpoint exists:', apiEndpoint);
        
        const apiCheckResponse = await fetch(apiEndpoint, {
          method: 'HEAD', // Just check if it exists, don't fetch the body
          signal: AbortSignal.timeout(5000)
        });
        
        siteCheckResults.apiEndpointAccessible = apiCheckResponse.status !== 404;
        siteCheckResults.details.apiEndpointStatus = apiCheckResponse.status;
        siteCheckResults.details.apiEndpointStatusText = apiCheckResponse.statusText;
        
        console.log('API endpoint check results:', {
          status: apiCheckResponse.status,
          statusText: apiCheckResponse.statusText,
          accessible: siteCheckResults.apiEndpointAccessible
        });
      } catch (apiError) {
        console.error('Error checking API endpoint:', apiError);
        siteCheckResults.apiEndpointAccessible = false;
        siteCheckResults.details.error = `API endpoint error: ${apiError instanceof Error ? apiError.message : String(apiError)}`;
      }
      
      // Try to detect if this is your website based on headers or other characteristics
      siteCheckResults.details.isYourSite = 
        headers['server']?.includes('solvify') || 
        normalizedUrl.includes('solvify.se') ||
        normalizedUrl.includes('crm.solvify');
        
    } catch (siteError) {
      siteCheckResults.details.error = siteError instanceof Error ? siteError.message : String(siteError);
    }
    
    return siteCheckResults;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * GET endpoint handler for debugging blog publishing
 */
export async function GET(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Get URL parameter
    const url = new URL(req.url);
    const blogUrl = url.searchParams.get('url');
    
    if (!blogUrl) {
      return NextResponse.json({ error: 'Blog URL parameter is required' }, { status: 400 });
    }
    
    // Test WordPress connectivity
    const connectionTest = await testWordPressConnection(blogUrl);
    
    return NextResponse.json({
      success: true,
      blogUrl,
      testResults: connectionTest
    });
  } catch (error) {
    console.error('Error in debug-generation/trace-blog-issues:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

/**
 * POST endpoint handler for checking a specific content record's blog publishing status
 */
export async function POST(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Initialize Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    // Get request body
    const body = await req.json();
    const { contentId, blogUrl } = body;
    
    let response: any = {
      success: true,
      contentId,
      blogUrl: blogUrl || 'Not provided'
    };
    
    // If contentId is provided, get the content record
    if (contentId) {
      const { data, error } = await supabaseAdmin
        .from('generated_content')
        .select('*')
        .eq('id', contentId)
        .maybeSingle();
        
      if (error) {
        response.contentQuery = {
          success: false,
          error: error.message
        };
      } else if (!data) {
        response.contentQuery = {
          success: false,
          error: 'Content not found'
        };
      } else {
        response.contentQuery = {
          success: true,
          title: data.title,
          status: data.status,
          publishedToBlog: data.published_to_blog || false,
          blogPostUrl: data.blog_post_url || null,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
      }
    }
    
    // If blogUrl is provided, test WordPress connectivity
    if (blogUrl) {
      response.wordpressTest = await testWordPressConnection(blogUrl);
      response.siteConnectivity = await testSiteConnectivity(blogUrl);
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in debug-generation/trace-blog-issues:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 