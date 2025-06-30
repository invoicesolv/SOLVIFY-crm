import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { AuthFlowDebugger, visualizeToken, visualizeCookies } from '@/lib/auth-debug';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Clear previous debug steps
    AuthFlowDebugger.clearFlow();
    
    AuthFlowDebugger.logStep('🔍 Debug API Called', true);
    
    // 1. Analyze Request Headers
    const headers = Object.fromEntries(request.headers.entries());
    AuthFlowDebugger.logStep('📋 Request Headers Analysis', true, headers);
    
    // 2. Analyze Cookies
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').map(c => c.trim()).filter(Boolean);
    const cookieAnalysis = visualizeCookies(cookies);
    console.log(cookieAnalysis);
    AuthFlowDebugger.logStep('🍪 Cookie Analysis', true, { 
      totalCookies: cookies.length, 
      cookies: cookies.slice(0, 10) // Limit to first 10 for readability
    });
    
    // 3. Check NextAuth Session
    let nextAuthSession = null;
    try {
      nextAuthSession = await getServerSession(authOptions);
      AuthFlowDebugger.logStep('🔐 NextAuth Session Check', !!nextAuthSession, nextAuthSession);
    } catch (error) {
      AuthFlowDebugger.logStep('🔐 NextAuth Session Check', false, undefined, 
        error instanceof Error ? error.message : 'Unknown error');
    }
    
    // 4. Check Supabase Auth Cookie
    const supabaseAuthCookie = cookies.find(cookie => 
      cookie.includes('sb-') && cookie.includes('-auth-token')
    );
    
    if (supabaseAuthCookie) {
      AuthFlowDebugger.logStep('🔑 Supabase Auth Cookie Found', true, { 
        cookieName: supabaseAuthCookie.split('=')[0],
        cookieLength: supabaseAuthCookie.length 
      });
      
      // Try to extract and analyze the token
      try {
        const tokenValue = supabaseAuthCookie.split('=')[1];
        if (tokenValue) {
          const decodedValue = decodeURIComponent(tokenValue);
          console.log(visualizeToken(decodedValue));
          AuthFlowDebugger.logStep('🔍 Supabase Token Analysis', true, { 
            tokenLength: decodedValue.length,
            tokenPreview: decodedValue.substring(0, 100) + '...'
          });
        }
      } catch (error) {
        AuthFlowDebugger.logStep('🔍 Supabase Token Analysis', false, undefined,
          error instanceof Error ? error.message : 'Token parsing error');
      }
    } else {
      AuthFlowDebugger.logStep('🔑 Supabase Auth Cookie', false, undefined, 'No Supabase auth cookie found');
    }
    
    // 5. Test Database Connection
    try {
      const { data: testQuery, error: dbError } = await supabaseAdmin
        .from('profiles')
        .select('count')
        .limit(1);
        
      AuthFlowDebugger.logStep('🗄️ Database Connection Test', !dbError, { 
        success: !dbError,
        error: dbError?.message 
      });
    } catch (error) {
      AuthFlowDebugger.logStep('🗄️ Database Connection Test', false, undefined,
        error instanceof Error ? error.message : 'Database error');
    }
    
    // 6. Check User Profile Mapping
    if (nextAuthSession?.user?.email) {
      try {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('id, name, email')
          .eq('email', nextAuthSession.user.email)
          .single();
          
        AuthFlowDebugger.logStep('👤 User Profile Mapping', !profileError, {
          userEmail: nextAuthSession.user.email,
          profileFound: !!profile,
          profileId: profile?.id,
          error: profileError?.message
        });
      } catch (error) {
        AuthFlowDebugger.logStep('👤 User Profile Mapping', false, undefined,
          error instanceof Error ? error.message : 'Profile lookup error');
      }
    }
    
    // Generate visualization
    const flowChart = AuthFlowDebugger.generateFlowChart();
    console.log(flowChart);
    
    // Return comprehensive debug info
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      authFlow: AuthFlowDebugger.getFullFlow(),
      flowVisualization: flowChart,
      summary: {
        nextAuthWorking: !!nextAuthSession,
        supabaseAuthCookie: !!supabaseAuthCookie,
        userEmail: nextAuthSession?.user?.email,
        cookieCount: cookies.length,
        authCookiesCount: cookies.filter(c => 
          c.includes('auth') || c.includes('session') || c.includes('token')
        ).length
      },
      recommendations: generateRecommendations(nextAuthSession, supabaseAuthCookie, cookies)
    });
    
  } catch (error) {
    AuthFlowDebugger.logStep('❌ Debug API Error', false, undefined,
      error instanceof Error ? error.message : 'Unknown error');
      
    return NextResponse.json({
      error: 'Debug API failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      authFlow: AuthFlowDebugger.getFullFlow()
    }, { status: 500 });
  }
}

function generateRecommendations(
  nextAuthSession: any, 
  supabaseAuthCookie: string | undefined, 
  cookies: string[]
): string[] {
  const recommendations: string[] = [];
  
  if (!nextAuthSession) {
    recommendations.push('❌ NextAuth session not found - check NEXTAUTH_SECRET and session configuration');
  }
  
  if (!supabaseAuthCookie) {
    recommendations.push('⚠️ No Supabase auth cookie found - this is expected with NextAuth migration');
  }
  
  if (nextAuthSession && !supabaseAuthCookie) {
    recommendations.push('✅ Clean NextAuth setup - no conflicting Supabase auth cookies');
  }
  
  const authCookies = cookies.filter(c => 
    c.includes('auth') || c.includes('session') || c.includes('token')
  );
  
  if (authCookies.length === 0) {
    recommendations.push('❌ No authentication cookies found - user may not be logged in');
  } else {
    recommendations.push(`✅ Found ${authCookies.length} authentication-related cookies`);
  }
  
  if (nextAuthSession?.user?.email === 'kevin@solvify.se') {
    recommendations.push('✅ Admin user detected - emergency bypass should work');
  }
  
  return recommendations;
}
