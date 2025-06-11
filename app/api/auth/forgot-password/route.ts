import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: "Email address is required" },
        { status: 400 }
      );
    }
    
    // Check if the user exists
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    
    if (userError) {
      return NextResponse.json(
        { error: "Error checking user" },
        { status: 500 }
      );
    }
    
    if (!user) {
      // Return success even if user does not exist for security
      return NextResponse.json({
        success: true,
        message: "If your email is in our system, you will receive a password reset link shortly"
      });
    }
    
    // Send password reset email using Supabase Auth
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : (process.env.NEXT_PUBLIC_SITE_URL || 'https://crm.solvify.se');
      
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/auth/reset-password`,
    });
    
    const redirectUrl = `${baseUrl}/auth/reset-password`;
    console.log('Password reset attempt:', {
      email,
      redirectTo: redirectUrl,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      baseUrl,
      error: resetError
    });
    
    if (resetError) {
      return NextResponse.json(
        { error: resetError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "If your email is in our system, you will receive a password reset link shortly"
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
} 