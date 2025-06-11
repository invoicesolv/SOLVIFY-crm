import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from "@/lib/auth";
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - Fetch cron jobs for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: cronJobs, error } = await supabase
      .from('cron_jobs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching cron jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch cron jobs' }, { status: 500 });
    }

    return NextResponse.json({ jobs: cronJobs || [] });
  } catch (error) {
    console.error('Error in GET /api/cron:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new cron job
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      job_type,
      property_id,
      site_url,
      status = 'active',
      settings,
      next_run
    } = body;

    // Validate required fields
    if (!job_type || !settings || !next_run) {
      return NextResponse.json(
        { error: 'Missing required fields: job_type, settings, next_run' },
        { status: 400 }
      );
    }

    // Validate job type specific requirements
    if (job_type === 'analytics_report' && !property_id) {
      return NextResponse.json(
        { error: 'property_id is required for analytics reports' },
        { status: 400 }
      );
    }

    if (job_type === 'search_console_report' && !site_url) {
      return NextResponse.json(
        { error: 'site_url is required for search console reports' },
        { status: 400 }
      );
    }

    if (job_type === 'project_report' && !property_id) {
      return NextResponse.json(
        { error: 'property_id (project_id) is required for project reports' },
        { status: 400 }
      );
    }

    // Create the cron job
    const cronJobData = {
      user_id: session.user.id,
      job_type,
      status,
      settings,
      next_run,
      updated_at: new Date().toISOString(),
      ...(property_id && { property_id }),
      ...(site_url && { site_url })
    };

    const { data: newJob, error } = await supabase
      .from('cron_jobs')
      .insert([cronJobData])
      .select()
      .single();

    if (error) {
      console.error('Error creating cron job:', error);
      return NextResponse.json({ error: 'Failed to create cron job' }, { status: 500 });
    }

    return NextResponse.json({ job: newJob }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/cron:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update an existing cron job
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Verify the job belongs to the user
    const { data: existingJob, error: fetchError } = await supabase
      .from('cron_jobs')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !existingJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Update the job
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data: updatedJob, error } = await supabase
      .from('cron_jobs')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating cron job:', error);
      return NextResponse.json({ error: 'Failed to update cron job' }, { status: 500 });
    }

    return NextResponse.json({ job: updatedJob });
  } catch (error) {
    console.error('Error in PATCH /api/cron:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a cron job
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Verify the job belongs to the user and delete it
    const { error } = await supabase
      .from('cron_jobs')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error deleting cron job:', error);
      return NextResponse.json({ error: 'Failed to delete cron job' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/cron:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 