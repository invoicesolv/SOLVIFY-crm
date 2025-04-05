import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { supabase } from '@/lib/supabase'
import nodemailer from 'nodemailer'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options"

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

// Updated helper function to check if a user is an admin
async function isAdmin(userId: string, workspaceId?: string): Promise<boolean> {
  if (!userId) return false;

  // If a specific workspace is provided, check admin status for that workspace
  if (workspaceId) {
    const { data, error } = await supabase
      .from('team_members')
      .select('is_admin')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error) {
      console.error('Error checking admin status:', error);
      return false; // Treat errors as non-admin
    }

    return data?.is_admin === true;
  }

  // Otherwise, check if user is admin in any workspace
  const { data, error } = await supabase
    .from('team_members')
    .select('is_admin')
    .eq('user_id', userId)
    .eq('is_admin', true);

  if (error) {
    console.error('Error checking admin status:', error);
    return false; // Treat errors as non-admin
  }

  // If we found any records where user is admin, return true
  return data && data.length > 0;
}

async function sendInvitationEmail(email: string, inviterName: string, token: string, workspaceName: string, isAdmin: boolean) {
  try {
    console.log('Sending invitation email to:', email);
    
    const role = isAdmin ? 'Administrator' : 'Team Member';
    const mailOptions = {
      from: process.env.EMAIL_USER || 'info@solvify.se',
      to: email,
      subject: `You've been invited to join ${workspaceName} on Solvify CRM`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <img src="https://solvify.se/Solvify-logo-WTE.png" alt="Solvify Logo" style="width: 150px; margin-bottom: 20px;">
              
              <h1 style="color: #2563eb;">You've Been Invited! 🎉</h1>
              
              <p>${inviterName} has invited you to join their workspace in Solvify CRM as a <strong>${role}</strong>.</p>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Workspace:</strong> ${workspaceName}</p>
              </div>
              
              <p>Click the button below to accept this invitation and set up your account:</p>
              
              <div style="margin-top: 30px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://crm.solvify.se'}/register?token=${token}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                   Accept Invitation
                </a>
              </div>
              
              <p style="margin-top: 30px; font-size: 0.9em; color: #6b7280;">
                If you did not expect this invitation, you can safely ignore this email.
              </p>
              
              <p style="font-size: 0.9em; color: #6b7280;">
                Best regards,<br>
                The Solvify Team
              </p>
            </div>
          </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Invitation email sent successfully:', result.response);
    return true;
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    // Get the session to check if the user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get invitation data from request
    const { email, name, workspaceId, workspaceName, isAdmin: inviteeIsAdmin = false } = await req.json();

    // Validate required fields
    if (!email || !workspaceId || !workspaceName) {
      return NextResponse.json({ 
        error: 'Missing required fields: email, workspaceId, and workspaceName must be provided.' 
      }, { status: 400 });
    }

    // Check if the user is an admin for the specific workspace
    const userIsAdmin = await isAdmin(session.user.id, workspaceId);
    if (!userIsAdmin) {
      return NextResponse.json({ error: 'Forbidden. Only admins can send invitations.' }, { status: 403 });
    }

    // Generate invitation token
    const token = uuidv4();
    
    // Set expiration date (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create invitation record in database
    const { data: invitationData, error: inviteError } = await supabase
      .from('invitations')
      .insert({
        token,
        email,
        inviter_id: session.user.id,
        workspace_id: workspaceId,
        is_admin: inviteeIsAdmin,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      })
      .select();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    console.log('Created invitation:', invitationData);

    // Send invitation email
    const emailSent = await sendInvitationEmail(
      email, 
      session.user.name || 'Your colleague', 
      token, 
      workspaceName,
      inviteeIsAdmin
    );

    if (!emailSent) {
      console.error('Failed to send invitation email');
      // We don't return an error here since the invitation was created,
      // but we do log it for troubleshooting
    }

    return NextResponse.json({ 
      success: true, 
      invitation: { token, email, expires_at: expiresAt.toISOString() } 
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json({ 
      error: 'Failed to create invitation', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 