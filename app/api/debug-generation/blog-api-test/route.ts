import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';

// Properly format a slug from a title
function formatSlug(title: string): string {
  // Convert to lowercase
  let slug = title.toLowerCase();
  
  // Replace question marks with nothing instead of encoding them
  slug = slug.replace(/\?/g, '');
  
  // Replace spaces and special chars with hyphens
  slug = slug.replace(/[^\w\s-]/g, '');
  slug = slug.replace(/[\s_-]+/g, '-');
  
  // Remove any leading or trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');
  
  // Trim to reasonable length if needed
  if (slug.length > 60) {
    slug = slug.substring(0, 60);
  }
  
  return slug;
}

/**
 * Test API communication with the blog platform
 */
export async function POST(req: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get request body
    const body = await req.json();
    const { 
      blogUrl,
      testContentTitle = 'Test Post - Please Ignore',
      testContentBody = '<p>This is a test post to verify API connectivity.</p>'
    } = body;

    if (!blogUrl) {
      return NextResponse.json({ error: 'Blog URL is required' }, { status: 400 });
    }

    // Normalize URL by removing trailing slashes
    const normalizedUrl = blogUrl.replace(/\/$/, '');
    
    const testResults = {
      success: false,
      blogUrl: normalizedUrl,
      steps: [] as Array<{step: string, success: boolean, details: any}>
    };

    // Step 1: Check if the site is reachable
    try {
      testResults.steps.push({step: 'Site reachability check', success: false, details: {}});
      const siteCheck = await fetch(normalizedUrl, {
        method: 'GET',
        headers: { 'Accept': 'text/html' },
        signal: AbortSignal.timeout(10000)
      });
      
      const currentStep = testResults.steps[testResults.steps.length - 1];
      currentStep.success = siteCheck.ok;
      currentStep.details = {
        status: siteCheck.status,
        statusText: siteCheck.statusText,
        contentType: siteCheck.headers.get('content-type')
      };
      
      if (!siteCheck.ok) {
        return NextResponse.json(testResults);
      }
    } catch (error) {
      const currentStep = testResults.steps[testResults.steps.length - 1];
      currentStep.details = { error: error instanceof Error ? error.message : String(error) };
      return NextResponse.json(testResults);
    }

    // Step 2: Check if the API endpoint exists
    try {
      testResults.steps.push({step: 'API endpoint check', success: false, details: {}});
      const apiEndpoint = `${normalizedUrl}/api/create-post`;
      
      const apiCheck = await fetch(apiEndpoint, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      
      const currentStep = testResults.steps[testResults.steps.length - 1];
      currentStep.success = apiCheck.status !== 404;
      currentStep.details = {
        status: apiCheck.status,
        statusText: apiCheck.statusText,
        endpoint: apiEndpoint
      };
      
      if (apiCheck.status === 404) {
        currentStep.details.message = 'API endpoint not found. Please implement this endpoint on your blog platform.';
        return NextResponse.json(testResults);
      }
    } catch (error) {
      const currentStep = testResults.steps[testResults.steps.length - 1];
      currentStep.details = { error: error instanceof Error ? error.message : String(error) };
      return NextResponse.json(testResults);
    }

    // Step 3: Send a test post request to the API
    try {
      testResults.steps.push({step: 'API test post', success: false, details: {}});
      const apiEndpoint = `${normalizedUrl}/api/create-post`;
      
      // Generate a unique slug for the test post using our improved function
      const timestamp = Date.now();
      const testSlug = formatSlug(`test-post-${timestamp}`);
      
      const apiResponse = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SOLVIFY_SITE_API_KEY || ''}`
        },
        body: JSON.stringify({
          title: testContentTitle,
          content: testContentBody,
          slug: testSlug,
          category: 'test',
          featured: false, // Explicitly set to false to avoid overriding featured posts
          path: 'blog', // Explicitly set the path to 'blog'
          isTest: true // Flag to indicate this is a test post
        })
      });
      
      const currentStep = testResults.steps[testResults.steps.length - 1];
      
      let responseData;
      try {
        responseData = await apiResponse.json();
      } catch (e) {
        responseData = { error: 'Invalid JSON response' };
      }
      
      currentStep.success = apiResponse.ok;
      currentStep.details = {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        responseData,
        expectedUrl: `${normalizedUrl}/blog/${testSlug}`
      };
      
      // Set overall success based on the last step
      testResults.success = currentStep.success;
    } catch (error) {
      const currentStep = testResults.steps[testResults.steps.length - 1];
      currentStep.details = { error: error instanceof Error ? error.message : String(error) };
    }

    return NextResponse.json(testResults);
    
  } catch (error) {
    console.error('Error in debug-generation/blog-api-test:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 