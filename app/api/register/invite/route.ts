import { NextResponse } from "next/server"
import { supabase } from '@/lib/supabase'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER || 'info@solvify.se',
    pass: process.env.GMAIL_APP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function sendWelcomeEmail(email: string, name: string, workspaceName: string) {
  try {
    console.log('Sending welcome email to invited user:', email);
    
    const mailOptions = {
      from: process.env.EMAIL_USER || 'info@solvify.se',
      to: email,
      subject: `Welcome to ${workspaceName} on Solvify CRM`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <img src="https://solvify.se/Solvify-logo-WTE.png" alt="Solvify Logo" style="width: 150px; margin-bottom: 20px;">
              
              <h1 style="color: #2563eb;">Welcome to ${workspaceName}! 🎉</h1>
              
              <p>You have successfully joined the ${workspaceName} workspace on Solvify CRM.</p>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Getting Started:</strong> Log in to your account to start collaborating with your team.</p>
              </div>
              
              <div style="margin-top: 30px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a>
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

export async function POST(req: Request) {
  try {
    // Get registration data from request
    const { email, password, name, token } = await req.json();

    // Validate required fields
    if (!email || !password || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find the invitation by token
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (invitationError || !invitation) {
      console.error('Error fetching invitation:', invitationError);
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    // Log the invitation data to verify it contains workspace_id
    console.log("Invitation data:", invitation);

    // Check if the invitation has a workspace_id
    if (!invitation.workspace_id) {
      console.error('Error: workspace_id is missing from invitation');
      return NextResponse.json({ error: 'Invalid invitation: missing workspace ID' }, { status: 400 });
    }

    // Check if the invitation has expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    
    if (expiresAt < now) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    // Verify that the email matches the invitation
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Email does not match invitation' }, { status: 400 });
    }

    // Create user in Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          invited_by: invitation.inviter_id,
          workspace_id: invitation.workspace_id
        }
      }
    });

    if (authError) {
      console.error('Supabase auth error:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      );
    }

    if (!authData.user) {
      console.error('No user returned from Supabase');
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Create user profile
    console.log('Creating user profile');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        user_id: authData.user.id,
        name: name || email.split('@')[0],
        email: email,
        phone: '',
        company: '',
        role: 'User',
        address: '',
        city: '',
        country: '',
        website: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Critical: If profile creation fails, we should return an error
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      );
    }

    console.log('User profile created successfully:', profileData);

    // Get workspace information
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', invitation.workspace_id)
      .single();

    if (workspaceError) {
      console.error('Error fetching workspace:', workspaceError);
    }

    // Add the user to the team_members table
    const { data: teamMemberData, error: teamMemberError } = await supabase
      .from('team_members')
      .insert({
        user_id: authData.user.id,
        name: name || email.split('@')[0],
        email,
        workspace_id: invitation.workspace_id,  // Critical field
        is_admin: invitation.is_admin,
        permissions: invitation.permissions,
        created_at: new Date().toISOString()
      })
      .select();

    if (teamMemberError) {
      console.error('Error adding team member:', teamMemberError);
      // CRITICAL: Do not continue if team_members creation fails
      return NextResponse.json({ error: 'Failed to add user to team' }, { status: 500 });
    }

    console.log("Team member created:", teamMemberData);

    // Create user preferences
    const { error: prefError } = await supabase
      .from('user_preferences')
      .insert({
        user_id: authData.user.id,
        created_at: new Date().toISOString(),
        has_seen_welcome: false,
        name,
        email,
        plan_id: 'team',
        trial_start_date: new Date().toISOString(),
        trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days from now
      });

    if (prefError) {
      console.error('Error creating user preferences:', prefError);
      // Continue with registration even if preferences creation fails
    }

    // Send welcome email
    await sendWelcomeEmail(
      email, 
      name || email.split('@')[0], 
      workspace?.name || 'Your Team'
    );

    // Delete the invitation
    const { error: deleteError } = await supabase
      .from('invitations')
      .delete()
      .eq('token', token);

    if (deleteError) {
      console.error('Error deleting invitation:', deleteError);
      // Continue since the main functionality worked
    }

    return NextResponse.json({
      success: true,
      message: 'Registration successful',
      userId: authData.user.id,
      workspaceId: invitation.workspace_id
    });
  } catch (error) {
    console.error('Error in invite registration:', error);
    return NextResponse.json(
      { error: 'Failed to complete registration', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 