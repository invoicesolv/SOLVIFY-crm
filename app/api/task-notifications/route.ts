import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getServerSession } from 'next-auth';
import authOptions from "@/lib/auth";
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Create transporter
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

async function getUserDetails(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user details:', error);
    return null;
  }

  return data;
}

async function getTaskDetails(taskId: string) {
  const { data, error } = await supabase
    .from('project_tasks')
    .select(`
      *,
      projects:project_id (
        name
      ),
      assigner:user_id (
        email,
        full_name
      )
    `)
    .eq('id', taskId)
    .single();

  if (error) {
    console.error('Error fetching task details:', error);
    return null;
  }

  return data;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { type, taskId, assignedToId } = await request.json();

    // Get task details
    const task = await getTaskDetails(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Get assigned user details
    const assignedUser = await getUserDetails(assignedToId);
    if (!assignedUser) {
      return NextResponse.json(
        { error: 'Assigned user not found' },
        { status: 404 }
      );
    }

    // Get assigner details
    const assigner = await getUserDetails(session.user.id);
    if (!assigner) {
      return NextResponse.json(
        { error: 'Assigner details not found' },
        { status: 404 }
      );
    }

    let subject = '';
    let html = '';
    let emailRecipient = '';

    if (type === 'assignment') {
      subject = `New Task Assigned: ${task.title}`;
      emailRecipient = assignedUser.email;
      html = `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <img src="https://solvify.se/Solvify-logo-WTE.png" alt="Solvify Logo" style="width: 150px; margin-bottom: 20px;">
              
              <h1 style="color: #2563eb;">New Task Assignment</h1>
              
              <p>${assigner.full_name} has assigned you a new task in project "${task.projects.name}".</p>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #374151; margin-top: 0;">Task Details:</h2>
                <ul style="margin-bottom: 0;">
                  <li><strong>Task:</strong> ${task.title}</li>
                  <li><strong>Project:</strong> ${task.projects.name}</li>
                  ${task.description ? `<li><strong>Description:</strong> ${task.description}</li>` : ''}
                  ${task.due_date ? `<li><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</li>` : ''}
                </ul>
              </div>
              
              <div style="margin-top: 30px;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/projects/${task.project_id}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                   View Task
                </a>
              </div>
            </div>
          </body>
        </html>
      `;
    } else if (type === 'completion') {
      subject = `Task Completed: ${task.title}`;
      // Send to the original assigner of the task
      emailRecipient = task.assigner.email;
      html = `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <img src="https://solvify.se/Solvify-logo-WTE.png" alt="Solvify Logo" style="width: 150px; margin-bottom: 20px;">
              
              <h1 style="color: #2563eb;">Task Completed ✅</h1>
              
              <p>${assignedUser.full_name} has completed their assigned task in project "${task.projects.name}".</p>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #374151; margin-top: 0;">Task Details:</h2>
                <ul style="margin-bottom: 0;">
                  <li><strong>Task:</strong> ${task.title}</li>
                  <li><strong>Project:</strong> ${task.projects.name}</li>
                  ${task.description ? `<li><strong>Description:</strong> ${task.description}</li>` : ''}
                  <li><strong>Completed By:</strong> ${assignedUser.full_name}</li>
                  <li><strong>Completion Time:</strong> ${new Date().toLocaleString()}</li>
                </ul>
              </div>
              
              <div style="margin-top: 30px;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/projects/${task.project_id}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                   View Task
                </a>
              </div>
            </div>
          </body>
        </html>
      `;
    }

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'info@solvify.se',
      to: emailRecipient,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending task notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
} 