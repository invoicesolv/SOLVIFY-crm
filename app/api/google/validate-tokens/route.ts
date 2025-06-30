import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { validateAndRefreshAllGoogleTokens } from '@/lib/token-refresh';

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

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Google Token Validation] Starting validation for user:', user.id);
    
    const results = await validateAndRefreshAllGoogleTokens(user.id);
    
    console.log('[Google Token Validation] Results:', {
      success: results.success,
      servicesCount: results.services.length,
      errorsCount: results.errors.length
    });
    
    return NextResponse.json({
      success: results.success,
      message: results.success 
        ? `Successfully validated ${results.services.length} Google services with 2-month token expiration`
        : `Validation completed with ${results.errors.length} errors`,
      services: results.services,
      errors: results.errors,
      summary: {
        totalServices: results.services.length,
        totalErrors: results.errors.length,
        tokenExpiration: '2 months',
        refreshTokenStatus: 'validated'
      }
    });
    
  } catch (error) {
    console.error('[Google Token Validation] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to validate Google tokens',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Just check status without refreshing
    const results = await validateAndRefreshAllGoogleTokens(user.id);
    
    return NextResponse.json({
      status: 'checked',
      services: results.services,
      errors: results.errors,
      summary: {
        connectedServices: results.services.length,
        issuesFound: results.errors.length,
        tokenExpiration: '2 months',
        lastChecked: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[Google Token Check] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check Google tokens',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 