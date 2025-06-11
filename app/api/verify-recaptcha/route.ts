import { NextResponse } from 'next/server';

// Google reCAPTCHA secret key 
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '6LflizkrAAAAAETv_73-baAk2JPdngn8pF2wfPnQ';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'reCAPTCHA token is missing' },
        { status: 400 }
      );
    }

    // Verify the token with Google's reCAPTCHA API
    const response = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${token}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const data = await response.json();

    // Check if verification was successful
    if (data.success) {
      return NextResponse.json({ success: true });
    } else {
      console.error('reCAPTCHA verification failed:', data);
      return NextResponse.json(
        { success: false, message: 'reCAPTCHA verification failed' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
} 