import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

// This is handled by Vercel Cron
// In vercel.json: { "path": "/api/cron/send-project-reports", "schedule": "0 9 * * 1" }
export async function GET(request: NextRequest) {
  try {
    // Get authorization header (for manual testing)
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret');
    const jobId = request.nextUrl.searchParams.get('jobId');
    
    // For production, you should validate that the request is actually from Vercel Cron
    // Vercel doesn't send an authorization header for cron jobs,
    // so this check is only for manual API calls during testing
    const isManualTrigger = !!authHeader;
    const isCronTrigger = cronSecret === (process.env.CRON_SECRET || 'development');
    
    console.log(`[Cron Project Reports] Starting execution at ${new Date().toISOString()} (Manual: ${isManualTrigger}, Cron: ${isCronTrigger}, JobId: ${jobId || 'all'})`);
    
    // Get all project report jobs that are due to run
    const now = new Date();
    
    // Prepare the query
    let query = supabase
      .from('cron_jobs')
      .select('*')
      .eq('status', 'active')
      .eq('job_type', 'project_report');
    
    // If jobId is provided, only process that specific job
    if (jobId) {
      console.log(`[Cron Project Reports] Processing specific job ID: ${jobId}`);
      query = query.eq('id', jobId);
    } else {
      // Otherwise, get all jobs due to run
      query = query.lte('next_run', now.toISOString());
    }
    
    const { data: jobs, error } = await query;
    
    if (error) {
      console.error('[Cron Project Reports] Error fetching jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
    }
    
    console.log(`[Cron Project Reports] Found ${jobs?.length || 0} jobs due for execution`);
    
    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ message: 'No jobs to process' });
    }
    
    // Process each job
    const sendPromises = jobs.map(async (job) => {
      try {
        console.log(`[Cron Project Reports] Processing job for project with ID: ${job.property_id}`);
        
        // Debug the job settings
        console.log(`[Cron Project Reports] Job settings:`, job.settings);
        
        // Check if Gmail app password is set
        if (!process.env.GMAIL_APP_PASSWORD) {
          console.error('[Cron Project Reports] GMAIL_APP_PASSWORD environment variable is not set!');
          throw new Error('Email configuration error: GMAIL_APP_PASSWORD not set');
        }
        
        // Extract recipients properly
        const recipients = job.settings?.recipients || [];
        console.log(`[Cron Project Reports] Job ${job.id} has ${recipients.length} recipients:`, recipients);
        
        // Get the project details
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', job.property_id)
          .single();
        
        if (projectError) {
          console.error(`[Cron Project Reports] Error fetching project ${job.property_id}:`, projectError);
          throw new Error(`Could not find project with ID ${job.property_id}`);
        }

        // Get project tasks
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('project_id', job.property_id)
          .order('status', { ascending: true })
          .order('priority', { ascending: false });

        if (tasksError) {
          console.error(`[Cron Project Reports] Error fetching tasks for project ${job.property_id}:`, tasksError);
          throw new Error(`Could not fetch tasks for project with ID ${job.property_id}`);
        }

        // Check if we have recipients to send to
        if (recipients.length > 0) {
          // Call the same API endpoint used for manual project reports
          const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.solvify.se'}/api/send-project-report`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CRON_SECRET || 'development'}` // Add auth for internal API
            },
            body: JSON.stringify({
              projectName: project.name,
              tasks: tasks || [],
              isTest: false,
              recipients: recipients
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send project report');
          }
          
          const responseData = await response.json();
          console.log(`[Cron Project Reports] Successfully sent project report: ${responseData.messageId || 'No message ID'}`);
        } else {
          console.warn(`[Cron Project Reports] No recipients specified for job ${job.id}`);
        }
        
        // Calculate next run time
        const nextRun = calculateNextRunTime(job);
        
        // Update job status
        const { error: updateError } = await supabase
          .from('cron_jobs')
          .update({
            last_run: now.toISOString(),
            next_run: nextRun.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', job.id);
        
        if (updateError) {
          console.error(`[Cron Project Reports] Error updating job ${job.id}:`, updateError);
        }
        
        console.log(`[Cron Project Reports] Successfully processed report for project ${job.property_id}`);
        
        return { success: true, jobId: job.id, projectId: job.property_id };
      } catch (error) {
        console.error(`[Cron Project Reports] Error processing job ${job.id}:`, error);
        
        // Update job to indicate failure
        await supabase
          .from('cron_jobs')
          .update({
            updated_at: now.toISOString()
          })
          .eq('id', job.id);
        
        return { success: false, jobId: job.id, error: error instanceof Error ? error.message : String(error) };
      }
    });
    
    const results = await Promise.all(sendPromises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`[Cron Project Reports] Completed: ${results.length} processed, ${successful} successful, ${failed} failed`);
    
    return NextResponse.json({
      message: `Processed ${results.length} reports`,
      successful,
      failed,
      results
    });
  } catch (error) {
    console.error('[Cron Project Reports] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Helper function to calculate the next run time based on job settings
function calculateNextRunTime(job: any): Date {
  const now = new Date();
  const nextRun = new Date(now);
  
  // Default is to run weekly (7 days from now) at 9am
  nextRun.setDate(now.getDate() + 7);
  nextRun.setHours(9, 0, 0, 0);
  
  // If job has specific frequency settings, use those
  if (job.settings && job.settings.frequency) {
    switch (job.settings.frequency.toLowerCase()) {
      case 'daily':
        nextRun.setDate(now.getDate() + 1);
        break;
      case 'weekly':
        // If job specifies day of week, calculate next occurrence
        if (job.settings.send_day) {
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const targetDay = days.indexOf(job.settings.send_day.toLowerCase());
          
          if (targetDay !== -1) {
            const currentDay = now.getDay();
            const daysUntilTarget = (targetDay + 7 - currentDay) % 7;
            nextRun.setDate(now.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
          }
        } else {
          // Default to 7 days from now
          nextRun.setDate(now.getDate() + 7);
        }
        break;
      case 'monthly':
        nextRun.setMonth(now.getMonth() + 1);
        break;
      default:
        // Default to weekly
        nextRun.setDate(now.getDate() + 7);
    }
  }
  
  // If job specifies time of day, set it
  if (job.settings && job.settings.send_time) {
    const [hours, minutes] = job.settings.send_time.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      nextRun.setHours(hours, minutes, 0, 0);
    }
  }
  
  return nextRun;
} 