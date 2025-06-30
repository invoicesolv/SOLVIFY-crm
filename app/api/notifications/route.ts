import { NextRequest, NextResponse } from 'next/server';
import { supabaseDb } from '@/lib/supabase-database';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-nextauth';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

// Create email transporter
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

// Function to get user details for email
async function getUserDetails(userId: string) {
  console.log('[getUserDetails] Looking up user:', userId);
  
  // First try to get from team_members table
  const { data: teamMember, error: teamError } = await supabaseDb
    .from('team_members')
    .select('email, name, user_id, workspace_id')
    .eq('user_id', userId);

  console.log('[getUserDetails] Team members query result:', { teamMember, teamError });

  if (!teamError && teamMember && teamMember.length > 0) {
    const member = teamMember[0]; // Get first match
    console.log('[getUserDetails] Found team member:', { email: member.email, name: member.name });
    return {
      email: member.email,
      full_name: member.name
    };
  }

  // If no team member found, try to find by email in team_members table
  // This is a fallback for cases where user_id might not match
  console.log('[getUserDetails] No team member found by user_id, trying alternative approaches...');
  
  // Skip the users table fallback since it doesn't exist
  console.log('[getUserDetails] No email found for user:', userId);
  return null;
}

// Function to get task details for email
async function getTaskDetails(taskId: string) {
  console.log('[getTaskDetails] Looking up task:', taskId);
  
  const { data, error } = await supabaseDb
    .from('project_tasks')
    .select(`
      id,
      title,
      due_date,
      project_id,
      projects (
        id,
        name
      )
    `)
    .eq('id', taskId)
    .single();

  console.log('[getTaskDetails] Task query result:', { data, error });

  if (error) {
    console.error('Error fetching task details:', error);
    return null;
  }

  return data;
}

// Function to send task assignment email
async function sendTaskAssignmentEmail(assignedUserId: string, taskId: string, assignerName: string) {
  if (!process.env.GMAIL_APP_PASSWORD) {
    console.error('[Email] GMAIL_APP_PASSWORD not configured, skipping email notification');
    return;
  }

  try {
    // Get assigned user details
    const assignedUser = await getUserDetails(assignedUserId);
    if (!assignedUser?.email) {
      console.error('[Email] No email found for assigned user:', assignedUserId);
      return;
    }

    // Get task details
    const task = await getTaskDetails(taskId);
    if (!task) {
      console.error('[Email] Task not found:', taskId);
      return;
    }

    const subject = `New Task Assigned: ${task.title}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <img src="https://solvify.se/Solvify-logo-WTE.png" alt="Solvify Logo" style="width: 150px; margin-bottom: 20px;">
            
            <h1 style="color: #2563eb;">New Task Assignment</h1>
            
            <p>${assignerName} has assigned you a new task in project "${task.projects?.name || 'Unknown Project'}".</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #374151; margin-top: 0;">Task Details:</h2>
              <ul style="margin-bottom: 0;">
                <li><strong>Task:</strong> ${task.title}</li>
                <li><strong>Project:</strong> ${task.projects?.name || 'Unknown Project'}</li>
                ${task.due_date ? `<li><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</li>` : ''}
              </ul>
            </div>
            
            <div style="margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://solvify.se'}/projects/${task.project_id}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                 View Task
              </a>
            </div>
          </div>
        </body>
      </html>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'info@solvify.se',
      to: assignedUser.email,
      subject,
      html,
    });

    console.log('[Email] Task assignment email sent successfully to:', assignedUser.email);
  } catch (error) {
    console.error('[Email] Error sending task assignment email:', error);
    // Don't throw error - email failure shouldn't block notification creation
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get session from NextAuth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = session.user;

    console.log('[Notifications GET] Fetching notifications for user:', user.id);

    // Get user's workspace(s)
    const { data: teamMemberships, error: teamError } = await supabaseDb
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id);

    if (teamError) {
      console.error('[Notifications GET] Error fetching team memberships:', teamError);
      return NextResponse.json({ error: 'Failed to fetch team memberships' }, { status: 500 });
    }

    if (!teamMemberships || teamMemberships.length === 0) {
      console.log('[Notifications GET] No workspaces found for user');
      return NextResponse.json({ notifications: [] });
    }

    const workspaceIds = teamMemberships.map(tm => tm.workspace_id);
    console.log('[Notifications GET] Found workspaces:', workspaceIds);

    // Fetch notifications for user's workspaces
    const { data: notifications, error: notificationsError } = await supabaseDb
      .from('notifications')
      .select('*')
      .in('workspace_id', workspaceIds)
      .order('created_at', { ascending: false })
      .limit(1000); // Reasonable limit

    if (notificationsError) {
      console.error('[Notifications GET] Error fetching notifications:', notificationsError);
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    console.log('[Notifications GET] Found notifications:', notifications?.length || 0);

    return NextResponse.json({ 
      notifications: notifications || [],
      success: true 
    });

  } catch (error) {
    console.error('[Notifications GET] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get session from NextAuth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = session.user;

    const { 
      type, 
      title, 
      message, 
      user_id, 
      workspace_id,
      task_id, 
      project_id,
      metadata 
    } = await request.json();

    console.log('[Notifications] Creating notification:', {
      type,
      title,
      message,
      user_id,
      workspace_id,
      task_id,
      project_id,
      created_by: user.id
    });

    // Map the type to match database constraints
    let notification_type = type;
    if (type === 'task_assignment') {
      notification_type = 'task';
    }

    // Determine entity_id and entity_type
    let entity_id: string | null = null;
    let entity_type: string | null = null;
    
    if (task_id) {
      entity_id = task_id;
      entity_type = 'task';
    } else if (project_id) {
      entity_id = project_id;
      entity_type = 'project';
    }

    // Get workspace_id if not provided
    let final_workspace_id = workspace_id;
    if (!final_workspace_id) {
      // Get user's workspace from team_members
      const { data: teamMember } = await supabaseDb
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', user_id)
        .single();
      
      final_workspace_id = teamMember?.workspace_id;
    }

    // Create notification
    const { data, error } = await supabaseDb
      .from('notifications')
      .insert({
        notification_type,
        title,
        message,
        user_id,
        workspace_id: final_workspace_id,
        entity_id,
        entity_type,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[Notifications] Error creating notification:', error);
      return NextResponse.json(
        { error: 'Failed to create notification', details: error.message },
        { status: 500 }
      );
    }

    // Send email notification for task assignments
    if (type === 'task_assignment' && task_id && user_id) {
      console.log('[Notifications] Sending email notification for task assignment');
      // Send email in background (don't wait for it)
      sendTaskAssignmentEmail(user_id, task_id, user.name || user.email || 'Team Member').catch(emailError => {
        console.error('[Notifications] Email sending failed:', emailError);
      });
    }

    console.log('[Notifications] Notification created successfully:', data);
    return NextResponse.json({ notification: data });
  } catch (error) {
    console.error('[Notifications] Error in notifications POST:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Get session from NextAuth
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = session.user;

    const { notification_id, read } = await request.json();
    console.log(`[Notifications PATCH] User ${user.id} marking notification ${notification_id} as read=${read}`);

    const updateData: any = {};
    if (read) {
      updateData.read_at = new Date().toISOString();
    } else {
      updateData.read_at = null;
    }

    const { error } = await supabaseDb
      .from('notifications')
      .update(updateData)
      .eq('id', notification_id)
      .eq('user_id', user.id); // Ensure user can only update their own notifications

    if (error) {
      console.error('Error updating notification:', error);
      return NextResponse.json(
        { error: 'Failed to update notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in notifications PATCH:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 