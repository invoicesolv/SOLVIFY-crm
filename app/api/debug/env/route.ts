import { NextResponse } from 'next/server'

export async function GET() {
  // Only allow in development or if explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG !== 'true') {
    return NextResponse.json({ error: 'Debug endpoint disabled in production' }, { status: 403 })
  }

  const envCheck = {
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    timestamp: new Date().toISOString()
  }

  return NextResponse.json(envCheck)
}
