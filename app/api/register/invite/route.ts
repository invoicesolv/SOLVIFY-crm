import { NextResponse } from "next/server"
import { supabase } from '@/lib/supabase'
import bcryptjs from 'bcryptjs'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(req: Request) {
  try {
    // Get registration data from request
    const { email, password, name, token } = await req.json()

    // Validate required fields
    if (!email || !password || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Hash the password
    const salt = await bcryptjs.genSalt(10)
    const hashedPassword = await bcryptjs.hash(password, salt)

    // Process the invitation and create user using our SQL function
    const { data, error } = await supabase.rpc('process_invitation', {
      p_token: token,
      p_hashed_password: hashedPassword,
      p_name: name || email.split('@')[0]
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

    const userDetails = data[0]

    // Send welcome email (with only two parameters as expected)
    await sendWelcomeEmail(
      email,
      name || email.split('@')[0]
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