import { NextResponse } from "next/server"
import Stripe from "stripe"
import { supabase } from '@/lib/supabase'
import nodemailer from 'nodemailer'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
})

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'info@solvify.se',
    pass: process.env.GMAIL_APP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function sendWelcomeEmail(email: string, name: string, planId: string = 'free') {
  try {
    console.log('Attempting to send welcome email to:', email);
    
    // Get plan details
    const planNames = {
      'free': 'Privatpersoner (Free)',
      'team': 'Team',
      'business': 'Organisationer',
      'enterprise': 'Enterprise'
    };
    
    const planName = planNames[planId as keyof typeof planNames] || 'Free Trial';
    
    const mailOptions = {
      from: 'info@solvify.se',
      to: email,
      subject: 'Welcome to Solvify CRM - Your 14-Day Free Trial Starts Now! 🚀',
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <img src="https://solvify.se/Solvify-logo-WTE.png" alt="Solvify Logo" style="width: 150px; margin-bottom: 20px;">
              
              <h1 style="color: #2563eb;">Welcome to Solvify CRM, ${name}! 🎉</h1>
              
              <p>We're excited to have you on board! Your 14-day free trial of our <strong>${planName}</strong> plan has officially begun.</p>
              
              <h2 style="color: #374151;">What's included in your trial:</h2>
              <ul>
                <li>Full access to all CRM features</li>
                <li>Customer management tools</li>
                <li>Project tracking</li>
                <li>Invoice generation</li>
                <li>Marketing analytics</li>
                <li>And much more!</li>
              </ul>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Quick Tip:</strong> Start by adding your first customer or creating a project to see how Solvify CRM can streamline your business operations.</p>
              </div>
              
              <p>Need help getting started? Our support team is here for you:</p>
              <ul>
                <li>Email: support@solvify.se</li>
                <li>Phone: +46 70 736 80 87</li>
              </ul>
              
              <div style="margin-top: 30px;">
                <a href="https://solvify.se/dashboard" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a>
              </div>
              
              <p style="margin-top: 30px; font-size: 0.9em; color: #6b7280;">
                Best regards,<br>
                The Solvify Team
              </p>
            </div>
          </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent successfully:', result.response);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
}

async function sendAdminNotificationEmail(userData: { name: string, email: string, company: string, planId: string }) {
  try {
    const { name, email, company, planId } = userData;
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@solvify.se'; // Admin email address
    
    console.log('Sending admin notification email about new user:', email);
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@solvify.se',
      to: adminEmail,
      subject: '🔔 New User Registration Alert',
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <img src="https://solvify.se/Solvify-logo-WTE.png" alt="Solvify Logo" style="width: 150px; margin-bottom: 20px;">
              
              <h1 style="color: #2563eb;">New User Registration Alert! 🎉</h1>
              
              <p>A new user has just registered for Solvify CRM.</p>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #374151; margin-top: 0;">User Details:</h2>
                <ul style="margin-bottom: 0;">
                  <li><strong>Name:</strong> ${name}</li>
                  <li><strong>Email:</strong> ${email}</li>
                  <li><strong>Company:</strong> ${company || 'Not provided'}</li>
                  <li><strong>Plan:</strong> ${planId || 'Free Trial'}</li>
                  <li><strong>Registration Time:</strong> ${new Date().toLocaleString()}</li>
                </ul>
              </div>
              
              <div style="margin-top: 30px;">
                <a href="https://solvify.se/admin" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Admin Dashboard</a>
              </div>
              
              <p style="margin-top: 30px; font-size: 0.9em; color: #6b7280;">
                This is an automated notification from your Solvify CRM system.
              </p>
            </div>
          </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Admin notification email sent successfully:', result.response);
    return true;
  } catch (error) {
    console.error('Error sending admin notification email:', error);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    console.log('Registration API called');
    
    const { name, email, password, company, sessionId, planId = 'free' } = await req.json()
    console.log('Registration data received:', { name, email, company, sessionId: !!sessionId, planId });

    // Basic validation
    if (!name || !email || !password) {
      console.error('Missing required fields:', { name: !!name, email: !!email, password: !!password });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    let stripeCustomerId: string | undefined

    try {
      if (sessionId) {
        // For paid subscriptions, retrieve the session and customer
        console.log('Processing paid subscription with session ID:', sessionId);
        const session = await stripe.checkout.sessions.retrieve(sessionId)
        stripeCustomerId = session.customer as string
      } else {
        // For free trial, create a new customer in Stripe
        console.log('Creating free trial customer in Stripe');
        const customer = await stripe.customers.create({
          name,
          email,
          metadata: {
            company,
            planId
          },
        })
        stripeCustomerId = customer.id
        console.log('Stripe customer created:', stripeCustomerId);
      }
    } catch (stripeError) {
      console.error('Stripe error:', stripeError);
      return NextResponse.json(
        { error: "Failed to create Stripe customer" },
        { status: 500 }
      )
    }

    // Send welcome email to user BEFORE creating the Supabase user
    // This ensures our welcome email arrives before the Supabase confirmation email
    console.log('Sending welcome email before user creation');
    const welcomeEmailSent = await sendWelcomeEmail(email, name, planId)
    console.log('Welcome email sent:', welcomeEmailSent);
    
    // Send notification email to admin
    const adminEmailSent = await sendAdminNotificationEmail({ 
      name, 
      email, 
      company,
      planId 
    })
    console.log('Admin notification email sent:', adminEmailSent);

    // Create user in Supabase
    console.log('Creating user in Supabase');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          company,
          stripe_customer_id: stripeCustomerId,
          plan_id: planId
        }
      }
    })

    if (authError) {
      console.error('Supabase auth error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      )
    }

    if (!authData.user) {
      console.error('No user returned from Supabase');
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      )
    }

    console.log('User created in Supabase:', authData.user.id);

    // Create user preferences with trial start date
    console.log('Creating user preferences');
    const { error: prefError } = await supabase
      .from('user_preferences')
      .insert({
        user_id: authData.user.id,
        created_at: new Date().toISOString(),
        has_seen_welcome: false,
        name,
        company,
        email,
        plan_id: planId,
        trial_start_date: new Date().toISOString(),
        trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days from now
      })

    if (prefError) {
      console.error('Error creating user preferences:', prefError);
      // Continue with registration even if preferences creation fails
    } else {
      console.log('User preferences created successfully');
    }

    // Track the registration event
    try {
      console.log('Tracking registration event');
      await supabase
        .from('event_tracking')
        .insert({
          event_type: 'user_registration',
          created_at: new Date().toISOString(),
          details: {
            user_id: authData.user.id,
            name,
            email,
            company,
            plan_id: planId,
            stripe_customer_id: stripeCustomerId
          }
        });
      console.log('Registration event tracked successfully');
    } catch (error) {
      console.error('Error tracking registration event:', error);
      // Continue with registration even if tracking fails
    }

    return NextResponse.json({
      success: true,
      message: "Registration successful",
      userId: authData.user.id,
      planId
    })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Failed to create account", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
} 