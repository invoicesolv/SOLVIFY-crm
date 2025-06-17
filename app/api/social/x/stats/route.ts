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

    console.log('🐦 [X API] Fetching user stats for account:', account_id);

    // Fetch X user data using Twitter API v2
    const userResponse = await fetch(`https://api.twitter.com/2/users/me?user.fields=public_metrics`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('🐦 [X API] Response status:', userResponse.status);

    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('🐦 [X API] User data:', userData);
      
      if (userData.data && userData.data.public_metrics) {
        const metrics = userData.data.public_metrics;
        const followers = metrics.followers_count || 0;
        const following = metrics.following_count || 0;
        const tweets = metrics.tweet_count || 0;
        
        // Calculate engagement rate based on followers and activity
        const engagementRate = followers > 0 ? Math.min((following / followers) * 100, 10) : 0;
        
        return NextResponse.json({
          success: true,
          data: {
            followers_count: followers,
            engagement_rate: Math.max(engagementRate, 0.5), // Minimum 0.5%
            following_count: following,
            tweet_count: tweets
          }
        });
      } else {
        console.log('🐦 [X API] No public metrics found');
        return NextResponse.json({
          success: false,
          error: 'No public metrics found',
          data: {
            followers_count: 0,
            engagement_rate: 0
          }
        });
      }
    } else {
      const errorText = await userResponse.text();
      console.error('🐦 [X API] Error:', {
        status: userResponse.status,
        statusText: userResponse.statusText,
        error: errorText
      });
      
      return NextResponse.json({
        success: false,
        error: `X API error: ${userResponse.status} ${userResponse.statusText}`,
        details: errorText
      }, { status: userResponse.status });
    }
  } catch (error) {
    console.error('🐦 [X API] Server error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 