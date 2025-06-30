import { NextResponse } from "next/server"
import Stripe from "stripe"
import { supabaseClient as supabase } from '@/lib/supabase-client'
import nodemailer from 'nodemailer'
import axios from 'axios' // Added for reCAPTCHA verification

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
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
    return true;
  } catch (error) {
    return false;
  }
}

async function sendAdminNotificationEmail(userData: { name: string, email: string, company: string, planId: string }) {
  try {
    const { name, email, company, planId } = userData;
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@solvify.se'; // Admin email address
    
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
    return true;
  } catch (error) {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { name, email, password, company, sessionId, planId = 'free', recaptchaToken } = await req.json()

    // reCAPTCHA verification
    if (!recaptchaToken) {
      return NextResponse.json({ error: "reCAPTCHA token is missing" }, { status: 400 });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      console.error("RECAPTCHA_SECRET_KEY is not set in environment variables.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;

    try {
      const recaptchaResponse = await axios.post(verificationURL);
      if (!recaptchaResponse.data.success || recaptchaResponse.data.score < 0.5) { // Check score for v3
        console.warn(`reCAPTCHA verification failed: success=${recaptchaResponse.data.success}, score=${recaptchaResponse.data.score}`, recaptchaResponse.data['error-codes']);
        return NextResponse.json({ error: "reCAPTCHA verification failed. Are you a robot?" }, { status: 403 });
      }
      // console.log("reCAPTCHA verification successful, score:", recaptchaResponse.data.score);
    } catch (error) {
      console.error("Error during reCAPTCHA verification:", error);
      return NextResponse.json({ error: "Failed to verify reCAPTCHA" }, { status: 500 });
    }

    // Basic validation - ensure name is not just an empty string
    if (!name || name.trim() === "" || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields, or name is empty." },
        { status: 400 }
      )
    }

    let stripeCustomerId: string | undefined

    try {
      if (sessionId) {
        // For paid subscriptions, retrieve the session and customer
        const session = await stripe.checkout.sessions.retrieve(sessionId)
        stripeCustomerId = session.customer as string
      } else {
        // For free trial, create a new customer in Stripe
        const customer = await stripe.customers.create({
          name,
          email,
          metadata: {
            company,
            planId
          },
        })
        stripeCustomerId = customer.id
      }
    } catch (stripeError) {
      return NextResponse.json(
        { error: "Failed to create Stripe customer" },
        { status: 500 }
      )
    }

    // Send welcome email to user BEFORE creating the Supabase user
    // This ensures our welcome email arrives before the Supabase confirmation email
    const welcomeEmailSent = await sendWelcomeEmail(email, name, planId)
    
    // Send notification email to admin
    const adminEmailSent = await sendAdminNotificationEmail({ 
      name: name.trim(), // Use trimmed name 
      email, 
      company,
      planId 
    })

    // Create user in Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name.trim(), // Use trimmed name
          company,
          stripe_customer_id: stripeCustomerId,
          plan_id: planId
        }
      }
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      )
    }

    // Create user preferences with trial start date
    const { error: prefError } = await supabase
      .from('user_preferences')
      .insert({
        user_id: authData.user.id,
        created_at: new Date().toISOString(),
        has_seen_welcome: false,
        name: name.trim(), // Use trimmed name
        company,
        email,
        plan_id: planId,
        trial_start_date: new Date().toISOString(),
        trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days from now
      })

    // Create workspace for the user
    let workspaceId: string | null = null;
    try {
      // Create a new workspace for the user
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          name: `${company || name.trim()}'s Workspace`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (workspaceError) {
        console.error('Error creating workspace:', workspaceError);
      } else if (workspace) {
        workspaceId = workspace.id;
        console.log('Created workspace:', workspaceId, 'for user:', authData.user.id);

        // Add user as admin member of the workspace
        const { error: memberError } = await supabase
          .from('team_members')
          .insert({
            user_id: authData.user.id,
            workspace_id: workspaceId,
            role: 'admin',
            email: email,
            created_at: new Date().toISOString()
          });

        if (memberError) {
          console.error('Error adding user to workspace:', memberError);
        } else {
          console.log('Added user to workspace as admin:', authData.user.id, workspaceId);
        }
      }
    } catch (error) {
      console.error('Error in workspace setup:', error);
      // Continue with registration even if workspace creation fails
    }

    // Track the registration event
    try {
      await supabase
        .from('event_tracking')
        .insert({
          event_type: 'user_registration',
          created_at: new Date().toISOString(),
          details: {
            user_id: authData.user.id,
            name: name.trim(), // Use trimmed name
            email,
            company,
            plan_id: planId,
            stripe_customer_id: stripeCustomerId,
            workspace_id: workspaceId
          }
        });
    } catch (error) {
      // Continue with registration even if tracking fails
    }

    return NextResponse.json({
      success: true,
      message: "Registration successful",
      userId: authData.user.id,
      planId
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create account", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
} 