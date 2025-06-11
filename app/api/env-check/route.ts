import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Simple environment variable check - don't expose actual values for security
  const envStatus = {
    FACEBOOK_APP_ID: !!process.env.FACEBOOK_APP_ID,
    FACEBOOK_APP_SECRET: !!process.env.FACEBOOK_APP_SECRET,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const missingVars = Object.entries(envStatus)
    .filter(([key, present]) => !present)
    .map(([key]) => key);

  return NextResponse.json({
    status: 'environment_check',
    timestamp: new Date().toISOString(),
    environment_variables: envStatus,
    missing_variables: missingVars,
    missing_count: missingVars.length,
    all_present: missingVars.length === 0,
    recommendations: missingVars.length > 0 ? [
      'Add missing environment variables to your deployment environment',
      'Check your .env.local file for local development',
      'Verify deployment platform environment configuration'
    ] : ['All required environment variables are present']
  });
} 