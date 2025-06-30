import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getUserFromToken } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

// Create transporter with debug logging
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER || 'kevin@solvify.se',
    pass: process.env.GMAIL_APP_PASSWORD
  },
  debug: true,
  logger: true
});

interface Task {
  title: string;
  deadline?: string;
  checklist: Array<{
    text: string;
    done: boolean;
    deadline?: string;
  }>;
}

interface ProjectReport {
  projectName: string;
  tasks: Task[];
  isTest?: boolean;
  recipients: string[];
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use user.id instead of session?.user?.id
    const userId = user.id;

    const { projectName, tasks, isTest, recipients }: ProjectReport = await request.json();
    
    console.log('Received request:', { projectName, taskCount: tasks.length, isTest, recipients });

    // Check for CRON authorization (from cron jobs) first
    const authHeader = request.headers.get('Authorization');
    const isCronAuth = authHeader && authHeader.startsWith('Bearer ') && 
                        authHeader.substring(7) === (process.env.CRON_SECRET || 'development');
    
    // Only require authentication for non-test emails and when not authorized via cron secret
    if (!isTest && !isCronAuth) {
      if (!userId) {
        return NextResponse.json(
          { error: 'User not authenticated' },
          { status: 401 }
        );
      }
    }

    if (!projectName || !tasks || !recipients) {
      console.error('Missing required fields:', { projectName, hasTasks: !!tasks, recipients });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate project statistics
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => 
      task.checklist.every(item => item.done)
    ).length;

    const totalChecklistItems = tasks.reduce((sum, task) => sum + task.checklist.length, 0);
    const completedChecklistItems = tasks.reduce(
      (sum, task) => sum + task.checklist.filter(item => item.done).length, 
      0
    );

    const overallProgress = totalChecklistItems > 0 
      ? Math.round((completedChecklistItems / totalChecklistItems) * 100) 
      : 0;

    // Get upcoming deadlines
    const upcomingDeadlines = tasks
      .flatMap(task => 
        task.checklist
          .filter(item => !item.done && item.deadline)
          .map(item => ({
            task: task.title,
            item: item.text,
            deadline: item.deadline
          }))
      )
      .sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      })
      .slice(0, 5);

    // Create email content with professional template matching analytics/search console style
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333;">${projectName} - Project Report</h1>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #444;">Overview</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
            <div>
              <h3 style="color: #666;">Project Metrics</h3>
              <ul style="list-style: none; padding: 0;">
                <li>Total Tasks: ${totalTasks}</li>
                <li>Completed Tasks: ${completedTasks}</li>
                <li>Total Checklist Items: ${totalChecklistItems}</li>
                <li>Completed Items: ${completedChecklistItems}</li>
                <li>Overall Progress: ${overallProgress}%</li>
              </ul>
            </div>
          </div>
        </div>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #444;">Task Details</h2>
          <div style="display: grid; gap: 16px;">
            ${tasks.map(task => {
              const taskProgress = task.checklist.length > 0
                ? Math.round((task.checklist.filter(item => item.done).length / task.checklist.length) * 100)
                : 0;
              
              return `
                <div style="background: white; padding: 16px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 style="color: #444; margin: 0;">${task.title}</h3>
                    <span style="color: #666;">${taskProgress}% Complete</span>
                  </div>
                  ${task.deadline ? `<p style="color: #666; margin: 8px 0;">Deadline: ${new Date(task.deadline).toLocaleDateString()}</p>` : ''}
                  <div style="background: #eee; height: 8px; border-radius: 4px; margin: 12px 0;">
                    <div style="background: #22c55e; height: 100%; width: ${taskProgress}%; border-radius: 4px;"></div>
                  </div>
                  <div style="margin-top: 12px;">
                    ${task.checklist.map(item => `
                      <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                        <span style="color: ${item.done ? '#22c55e' : '#666'};">
                          ${item.done ? '✓' : '○'} ${item.text}
                        </span>
                        ${item.deadline ? `
                          <span style="color: #666; font-size: 0.9em;">
                            Due: ${new Date(item.deadline).toLocaleDateString()}
                          </span>
                        ` : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        ${upcomingDeadlines.length > 0 ? `
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #444;">Upcoming Deadlines</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr style="background: #eee;">
                  <th style="padding: 10px; text-align: left;">Task</th>
                  <th style="padding: 10px; text-align: left;">Item</th>
                  <th style="padding: 10px; text-align: right;">Deadline</th>
                </tr>
              </thead>
              <tbody>
                ${upcomingDeadlines.map(({ task, item, deadline }) => `
                  <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px;">${task}</td>
                    <td style="padding: 10px;">${item}</td>
                    <td style="padding: 10px; text-align: right;">${new Date(deadline!).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div style="color: #666; font-size: 0.9em; margin-top: 20px;">
          <p>This report was automatically generated by Solvify Project Management.</p>
          <p>To modify your email preferences, please visit your Project Dashboard settings.</p>
        </div>
      </div>
    `;

    console.log('Attempting to send email to:', recipients);
    
    // Verify GMAIL_APP_PASSWORD is set
    if (!process.env.GMAIL_APP_PASSWORD) {
      console.error('GMAIL_APP_PASSWORD environment variable is not set');
      return NextResponse.json(
        { error: 'Email configuration error' },
        { status: 500 }
      );
    }

    // Send email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER || 'kevin@solvify.se',
      to: recipients.join(', '),
      subject: `${isTest ? '[TEST] ' : ''}${projectName} - Project Report`,
      html,
    });

    console.log('Email sent successfully:', info);
    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('Error sending project report:', error);
    return NextResponse.json(
      { error: 'Failed to send report', details: error.message },
      { status: 500 }
    );
  }
} 