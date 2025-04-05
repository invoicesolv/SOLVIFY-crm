import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/auth-options';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const propertyId = request.nextUrl.searchParams.get('propertyId');
    console.log('Fetching cron jobs for:', { userId: session.user.id, propertyId });

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Get cron jobs from Supabase
    const { data, error } = await supabase
      .from('cron_jobs')
      .select('*')
      .eq('user_id', session.user.id)
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