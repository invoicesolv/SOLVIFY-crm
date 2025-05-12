import { NextRequest, NextResponse } from 'next/server';
import { startStatsRefreshJob } from './cron';

// Store the cron job globally
let statsRefreshJob: any = null;

// Start the job if we're on the server
if (typeof window === 'undefined') {
  try {
    // Only start the job if it hasn't been started yet
    if (!statsRefreshJob) {
      console.log('[Middleware] Initializing stats refresh cron job');
      statsRefreshJob = startStatsRefreshJob();
    }
  } catch (error) {
    console.error('[Middleware] Error initializing cron job:', error);
  }
}

export async function middleware(request: NextRequest) {
  try {
    // Debug log for middleware invocation - can be helpful for tracking
    console.log('[Middleware Debug] Request:', {
      pathname: request.nextUrl.pathname,
      cookies: request.cookies,
      referer: request.headers.get('referer') || ''
    });

    // Skip API routes to avoid unnecessary processing
    if (request.nextUrl.pathname.startsWith('/api/')) {
      console.log('[Middleware] Skipping API route:', request.nextUrl.pathname);
      return NextResponse.next();
    }

    // Continue with the rest of your middleware logic
    // ...

    return NextResponse.next();
  } catch (error) {
    console.error('[Middleware] Error:', error);
    return NextResponse.next();
  }
} 