import { CronJob } from 'cron';
import fetch from 'node-fetch';

// Create the refresh stats job - runs every 15 minutes
export function startStatsRefreshJob() {
  try {
    console.log('[Cron] Setting up dashboard stats refresh job');
    
    // Define the cron job to run every 15 minutes
    const job = new CronJob(
      '*/15 * * * *', // cron pattern: every 15 minutes
      async () => {
        console.log('[Cron] Running dashboard stats refresh job at', new Date().toISOString());
        
        try {
          // Secret key for authorization (should match CRON_SECRET_KEY in environment)
          const secretKey = process.env.CRON_SECRET_KEY;
          
          if (!secretKey) {
            console.error('[Cron] Missing CRON_SECRET_KEY environment variable');
            return;
          }
          
          // Determine the base URL based on environment
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
          
          // Call our cron job API endpoint
          const response = await fetch(`${baseUrl}/api/cron/refresh-stats`, {
            headers: {
              'Authorization': `Bearer ${secretKey}`
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API responded with status ${response.status}: ${errorText}`);
          }
          
          const data = await response.json();
          console.log('[Cron] Stats refresh completed successfully:', {
            processed: data.processed,
            successful: data.successful,
            failed: data.failed
          });
        } catch (error) {
          console.error('[Cron] Error running stats refresh job:', error);
        }
      },
      null, // onComplete - not used
      true, // start immediately
      'UTC' // timezone
    );
    
    // Check if job is running - use type assertion to avoid TypeScript error
    console.log('[Cron] Stats refresh job initialized:', job ? 'Yes' : 'No');
    
    // Return the job so it can be stopped if needed
    return job;
  } catch (error) {
    console.error('[Cron] Error setting up stats refresh job:', error);
    return null;
  }
} 