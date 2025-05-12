import { NextResponse } from 'next/server';

/**
 * Handler for important tasks (deprecated)
 * This endpoint exists only to prevent 404 errors from old code
 */
export async function GET() {
  return NextResponse.json({ 
    data: [],
    message: 'Important tasks feature has been deprecated' 
  });
} 