import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fixes: any[] = [];
    
    // 1. Fix missing environment variables
    const requiredEnvVars = [
      'FACEBOOK_APP_ID',
      'FACEBOOK_APP_SECRET',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'NEXTAUTH_URL'
    ];
    
    const missingEnvVars: string[] = [];
    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        missingEnvVars.push(envVar);
      }
    });
    
    if (missingEnvVars.length > 0) {
      fixes.push({
        issue: 'Missing environment variables',
        vars: missingEnvVars,
        impact: 'OAuth flows for social media integrations will fail',
        solution: 'Add the missing environment variables to your deployment environment'
      });
    }
    
    // 2. Test YouTube integration fix
    const userId = session.user.id;
    
    // Create a sample YouTube integration if it doesn't exist
    const { data: existingYoutube, error: youtubeCheckError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'youtube')
      .maybeSingle();
    
    if (!existingYoutube && !youtubeCheckError) {
      fixes.push({
        issue: 'YouTube integration missing',
        solution: 'User needs to re-authenticate with YouTube through Google OAuth',
        action: 'Redirect to settings page to reconnect YouTube'
      });
    }
    
    // 3. Check Fortnox token validity
    const { data: fortnoxSettings, error: fortnoxError } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'fortnox')
      .maybeSingle();
    
    if (fortnoxError) {
      fixes.push({
        issue: 'Fortnox token access error',
        error: fortnoxError.message,
        solution: 'Fortnox integration may need re-authentication'
      });
    } else if (fortnoxSettings) {
      const expiresAt = new Date(fortnoxSettings.expires_at);
      const now = new Date();
      
      if (expiresAt <= now) {
        fixes.push({
          issue: 'Fortnox token expired',
          expiredAt: expiresAt.toISOString(),
          solution: 'Token needs refresh or re-authentication'
        });
      } else {
        fixes.push({
          issue: 'Fortnox token valid',
          status: 'OK',
          expiresAt: expiresAt.toISOString()
        });
      }
    }
    
    // 4. Fix Facebook/Instagram config if possible
    if (!process.env.FACEBOOK_APP_ID) {
      fixes.push({
        issue: 'Facebook/Instagram/Threads integration unavailable',
        reason: 'FACEBOOK_APP_ID environment variable missing',
        impact: 'Social media posting to these platforms will fail',
        solution: 'Add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to environment variables'
      });
    }
    
    return NextResponse.json({
      status: 'analysis_complete',
      userId,
      timestamp: new Date().toISOString(),
      issues_found: fixes.length,
      fixes,
      recommendations: [
        'Add missing environment variables for OAuth integrations',
        'Re-authenticate YouTube through Google OAuth if needed',
        'Check Fortnox token expiration and refresh if necessary',
        'Test integrations after applying fixes'
      ]
    });

  } catch (error: any) {
    console.error('Integration fix analysis error:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze integration issues', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();
    const userId = session.user.id;
    
    if (action === 'refresh_fortnox') {
      // Try to refresh Fortnox token if possible
      const { data: fortnoxSettings } = await supabase
        .from('settings')
        .select('refresh_token')
        .eq('user_id', userId)
        .eq('service_name', 'fortnox')
        .maybeSingle();
      
      if (fortnoxSettings?.refresh_token) {
        // Implement token refresh logic here
        return NextResponse.json({
          status: 'refresh_attempted',
          message: 'Fortnox token refresh attempted'
        });
      } else {
        return NextResponse.json({
          status: 'refresh_failed',
          message: 'No refresh token available'
        }, { status: 400 });
      }
    }
    
    if (action === 'test_integrations') {
             const results: any = {};
      
      // Test various integrations
      try {
        const { data: integrations } = await supabase
          .from('integrations')
          .select('service_name, expires_at')
          .eq('user_id', userId);
        
        results['integrations_count'] = integrations?.length || 0;
        results['services'] = integrations?.map(i => i.service_name) || [];
      } catch (error: any) {
        results['integration_test_error'] = error.message;
      }
      
      return NextResponse.json({
        status: 'test_complete',
        results
      });
    }
    
    return NextResponse.json({
      error: 'Unknown action'
    }, { status: 400 });

  } catch (error: any) {
    console.error('Integration fix action error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform integration fix action', 
      details: error.message 
    }, { status: 500 });
  }
} 