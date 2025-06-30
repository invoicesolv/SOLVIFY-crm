import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const propertyId = request.nextUrl.searchParams.get('propertyId');
    console.log('Fetching cron jobs for:', { userId: user.id, propertyId });

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Get cron jobs from Supabase
    const { data, error } = await supabaseAdmin
      .from('cron_jobs')
      .select('*')
      .eq('user_id', user.id)
      .eq('property_id', propertyId)
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