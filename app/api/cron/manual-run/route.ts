import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// This endpoint allows manual triggering of cron jobs for testing
export async function POST(request: NextRequest) {
  try {
    // Get the job ID to run from query params
    const jobId = request.nextUrl.searchParams.get('id');
    
    // Check authorization - in production, this should be more secure
    const cronSecret = request.headers.get('x-cron-secret');
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent') || '';
    const isVercelCron = !!process.env.VERCEL && !authHeader && !cronSecret;
    const isInternalCall = userAgent.includes('Vercel-Cron') || isVercelCron;
    const isCronTrigger = cronSecret === (process.env.CRON_SECRET || 'development');
    const isManualTrigger = !!authHeader;
    
    // Allow the request if it's a Vercel cron job, has a valid secret, or is authenticated
    const isAuthorized = isVercelCron || isCronTrigger || isManualTrigger || isInternalCall;
    
    console.log(`[Manual Run] Request type: Vercel: ${isVercelCron}, Secret: ${isCronTrigger}, Auth: ${isManualTrigger}, Internal: ${isInternalCall}`);
    
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!jobId) {
      return NextResponse.json({ error: 'No job ID provided' }, { status: 400 });
    }
    
    // Get the job details to verify it exists
    const { data: job, error: jobError } = await supabaseAdmin
      .from('cron_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
      
    if (jobError || !job) {
      console.error('[Manual Run] Error fetching job:', jobError);
      return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
    }
    
    console.log(`[Manual Run] Triggering job ${jobId} of type ${job.job_type}`);
    
    // Call the process-scheduled-tasks endpoint to handle this job
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/cron/process-scheduled-tasks?jobId=${jobId}`;
    
    // Make the request
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret || 'development'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to trigger job: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();

    return NextResponse.json({ 
      message: `Job ${jobId} triggered successfully`,
      result
    });
  } catch (error) {
    console.error('[Manual Run] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to run job',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 