import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient as supabase } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const siteUrl = request.nextUrl.searchParams.get('siteUrl');
    console.log('Fetching cron jobs for:', { userId: user.id, siteUrl });

    if (!siteUrl) {
      return NextResponse.json(
        { error: 'Site URL is required' },
        { status: 400 }
      );
    }

    // Get cron jobs from Supabase
    const { data, error } = await supabase
      .from('cron_jobs')
      .select('*')
      .eq('user_id', user.id)
      .eq('site_url', siteUrl)
      .eq('job_type', 'search_console_report')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching cron jobs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch cron jobs' },
        { status: 500 }
      );
    }

    console.log('Found cron jobs:', data);

    return NextResponse.json({
      jobs: data || []
    });
  } catch (error) {
    console.error('Error in cron jobs API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 