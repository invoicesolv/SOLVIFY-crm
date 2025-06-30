import { NextResponse } from "next/server"
import { supabaseClient as supabase } from '@/lib/supabase-client'
import bcryptjs from 'bcryptjs'
import { sendWelcomeEmail } from '@/lib/email'
import axios from 'axios' // Added for reCAPTCHA verification

export async function POST(req: Request) {
  try {
    // Get registration data from request
    const { email, password, name, token, recaptchaToken } = await req.json()

    // reCAPTCHA verification
    if (!recaptchaToken) {
      return NextResponse.json({ error: "reCAPTCHA token is missing" }, { status: 400 });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      console.error("RECAPTCHA_SECRET_KEY is not set in environment variables for invite registration.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;

    try {
      const recaptchaResponse = await axios.post(verificationURL);
      if (!recaptchaResponse.data.success || recaptchaResponse.data.score < 0.5) { // Check score for v3
        console.warn(`Invite reCAPTCHA verification failed: success=${recaptchaResponse.data.success}, score=${recaptchaResponse.data.score}`, recaptchaResponse.data['error-codes']);
        return NextResponse.json({ error: "reCAPTCHA verification failed. Are you a robot?" }, { status: 403 });
      }
    } catch (error) {
      console.error("Error during invite reCAPTCHA verification:", error);
      return NextResponse.json({ error: "Failed to verify reCAPTCHA for invite" }, { status: 500 });
    }

    // Validate required fields: name is now strictly required and cannot be empty.
    if (!name || name.trim() === "" || !email || !password || !token) {
      return NextResponse.json({ error: 'Missing required fields: name, email, password, and token are all required, and name cannot be empty.' }, { status: 400 })
    }

    // Hash the password
    const salt = await bcryptjs.genSalt(10)
    const hashedPassword = await bcryptjs.hash(password, salt)

    const trimmedName = name.trim();

    // Process the invitation and create user using our SQL function
    const { data, error } = await supabase.rpc('process_invitation', {
      p_token: token,
      p_hashed_password: hashedPassword,
      p_name: trimmedName // Use the provided and trimmed name
    })

    if (error) {
      console.error('Error processing invitation:', error)
      return NextResponse.json({ 
        error: error.message || 'Failed to process invitation' 
      }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to create user account' 
      }, { status: 500 })
    }

    // Send welcome email
    await sendWelcomeEmail(
      email,
      trimmedName // Use the provided and trimmed name
    )

    return NextResponse.json({
      success: true,
      message: 'Registration successful'
    })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An error occurred during registration' 
    }, { status: 500 })
  }
} 