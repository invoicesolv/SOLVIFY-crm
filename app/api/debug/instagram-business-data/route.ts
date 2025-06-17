import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - please log in',
        debug: { steps: ['Session check failed'] }
      }, { status: 401 });
    }

    console.log('[Instagram Debug] Starting debug for user:', session.user.id);
    
    const debugSteps: string[] = [];
    const errors: any[] = [];
    
    debugSteps.push('Checking for Facebook integrations in database');
    
    // Check if user has any Facebook integrations
    const { data: facebookIntegrations, error: fbError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', session.user.id)
      .in('service_name', ['facebook', 'instagram-business']);

    if (fbError) {
      console.error('[Instagram Debug] Database error:', fbError);
      errors.push({ error: `Database error: ${fbError.message}` });
      return NextResponse.json({
        success: false,
        error: 'Database error while checking Facebook integrations',
        debug: { steps: debugSteps, errors }
      }, { status: 500 });
    }

    debugSteps.push(`Found ${facebookIntegrations?.length || 0} Facebook integrations`);

    if (!facebookIntegrations || facebookIntegrations.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No Facebook integrations found. Please connect Facebook first.',
        debug: { steps: debugSteps }
      }, { status: 404 });
    }

    // Check for Instagram Business accounts
    debugSteps.push('Checking for Instagram Business accounts');
    
    const { data: instagramAccounts, error: igError } = await supabase
      .from('instagram_business_accounts')
      .select(`
        *,
        connected_facebook_page:facebook_pages(name, id)
      `)
      .eq('user_id', session.user.id);

    if (igError) {
      console.error('[Instagram Debug] Instagram accounts error:', igError);
      errors.push({ error: `Instagram accounts error: ${igError.message}` });
    }

    debugSteps.push(`Found ${instagramAccounts?.length || 0} Instagram Business accounts`);

    // Get Facebook pages for context
    const { data: facebookPages, error: pagesError } = await supabase
      .from('facebook_pages')
      .select('*')
      .eq('user_id', session.user.id);

    if (pagesError) {
      console.error('[Instagram Debug] Facebook pages error:', pagesError);
      errors.push({ error: `Facebook pages error: ${pagesError.message}` });
    }

    debugSteps.push(`Found ${facebookPages?.length || 0} Facebook pages`);

    const result = {
      success: instagramAccounts && instagramAccounts.length > 0,
      message: instagramAccounts && instagramAccounts.length > 0 
        ? `Found ${instagramAccounts.length} Instagram Business account(s)`
        : 'No Instagram Business accounts found',
      instagramAccounts: instagramAccounts || [],
      facebookPages: facebookPages || [],
      facebookIntegrations: facebookIntegrations || [],
      debug: {
        steps: debugSteps,
        errors: errors.length > 0 ? errors : undefined,
        userId: session.user.id,
        timestamp: new Date().toISOString()
      }
    };

    console.log('[Instagram Debug] Result:', {
      instagramAccountsCount: instagramAccounts?.length || 0,
      facebookPagesCount: facebookPages?.length || 0,
      facebookIntegrationsCount: facebookIntegrations?.length || 0
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Instagram Debug] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      debug: { 
        steps: ['Unexpected error occurred'],
        errors: [{ error: error instanceof Error ? error.message : String(error) }]
      }
    }, { status: 500 });
  }
} 