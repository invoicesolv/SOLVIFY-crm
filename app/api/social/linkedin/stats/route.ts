import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { access_token, account_id } = await request.json();

    if (!access_token) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    console.log('💼 [LinkedIn API] Fetching user stats for account:', account_id);

    // Fetch LinkedIn profile data
    const profileResponse = await fetch('https://api.linkedin.com/v2/people/~:(id,firstName,lastName,profilePicture(displayImage~:playableStreams))', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('💼 [LinkedIn API] Response status:', profileResponse.status);

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      console.log('💼 [LinkedIn API] Profile data:', profileData);
      
      // LinkedIn API doesn't provide follower count in basic profile
      // Would need additional permissions for network size
      return NextResponse.json({
        success: true,
        data: {
          followers_count: 0, // LinkedIn doesn't provide this in basic API
          engagement_rate: 2.5, // Default engagement rate
          profile_data: profileData
        }
      });
    } else {
      const errorText = await profileResponse.text();
      console.error('💼 [LinkedIn API] Error:', {
        status: profileResponse.status,
        statusText: profileResponse.statusText,
        error: errorText
      });
      
      return NextResponse.json({
        success: false,
        error: `LinkedIn API error: ${profileResponse.status} ${profileResponse.statusText}`,
        details: errorText
      }, { status: profileResponse.status });
    }
  } catch (error) {
    console.error('💼 [LinkedIn API] Server error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 