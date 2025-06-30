import { NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// Initialize Resend email client with more robust error handling
let resend: any = null;
try {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    resend = new Resend(resendApiKey);
  } else {
    console.warn('RESEND_API_KEY not found in environment variables');
  }
} catch (error) {
  console.error('Failed to initialize Resend:', error);
}

const fromEmail = process.env.EMAIL_FROM || 'noreply@solvify.se';

// Create Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * POST endpoint to handle newsletter signups
 */
export async function POST(req: Request) {
  try {
    // Parse request body
    const body = await req.json();
    const { email } = body;
    
    // Validate email
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    
    // Get Supabase client
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    // Check if the email already exists in the newsletter list
    const { data: existingSubscribers } = await supabase
      .from('newsletter_subscribers')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    
    if (existingSubscribers) {
      return NextResponse.json({ 
        success: true,
        message: 'You are already subscribed to our newsletter!'
      });
    }
    
    // Insert new subscriber
    const { data: newSubscriber, error } = await supabase
      .from('newsletter_subscribers')
      .insert([{ 
        email: email.toLowerCase(),
        status: 'subscribed',
        signup_date: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error saving subscriber:', error);
      return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
    }
    
    // Send confirmation email
    let emailSent = false;
    
    if (resend) {
      try {
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: `Solvify CRM <${fromEmail}>`,
          to: [email],
          subject: 'Welcome to Solvify CRM Newsletter',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4F46E5;">Welcome to the Solvify CRM Newsletter!</h2>
              <p>Thank you for subscribing to our newsletter. You'll now receive the latest CRM insights, tips, and strategies straight to your inbox.</p>
              <p>If you didn't sign up for this newsletter, please ignore this email or contact our support team.</p>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="font-size: 14px; color: #666;">
                  Solvify CRM - The all-in-one solution that replaces 8+ separate business tools.<br>
                  <a href="https://crm.solvify.se" style="color: #4F46E5; text-decoration: none;">crm.solvify.se</a>
                </p>
                <p style="font-size: 12px; color: #999;">
                  You can unsubscribe at any time by clicking the unsubscribe link at the bottom of any of our emails.
                </p>
              </div>
            </div>
          `,
        });
        
        emailSent = !emailError && !!emailData;
        
        if (emailError) {
          console.error('Error sending confirmation email:', emailError);
        }
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    } else {
      console.warn('Resend email service not configured - skipping confirmation email');
    }
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Thank you for subscribing to our newsletter!',
      emailSent,
      subscriberId: newSubscriber?.id
    });
    
  } catch (error) {
    console.error('Error handling newsletter signup:', error);
    return NextResponse.json({ 
      error: `An error occurred: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
} 