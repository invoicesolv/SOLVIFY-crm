import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// This endpoint simulates a Vercel cron job trigger
export async function GET(request: NextRequest) {
  try {
    console.log('[Cron Test] Simulating Vercel cron job trigger');
    
    // Add the VERCEL environment variable to simulate the Vercel environment
    process.env.VERCEL = '1';
    
    // Determine which cron job to test
    const path = request.nextUrl.searchParams.get('path') || '/api/cron/send-reports';
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    console.log(`[Cron Test] Triggering cron path: ${path}`);
    
    // Trigger the cron job
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Vercel-Cron/1.0',
        'x-cron-secret': process.env.CRON_SECRET || 'development'
      }
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Cron job failed with status ${response.status}: ${text}`);
    }
    
    const result = await response.json();
    
    return NextResponse.json({
      message: 'Cron job triggered successfully',
      result
    });
  } catch (error) {
    console.error('[Cron Test] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to trigger cron job',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  } finally {
    // Reset the VERCEL environment variable
    delete process.env.VERCEL;
  }
} 