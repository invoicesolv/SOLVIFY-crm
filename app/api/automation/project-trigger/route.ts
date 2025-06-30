import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/global-auth';
import nodemailer from 'nodemailer';

// Email transporter (same as your other email services)
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER || 'kevin@solvify.se',
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
  
  return transporter;
}

// Helper function to get status colors for tasks
function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'completed':
      return '#10b981'; // green
    case 'in_progress':
      return '#3b82f6'; // blue
    case 'pending':
      return '#f59e0b'; // yellow
    case 'blocked':
      return '#ef4444'; // red
    case 'cancelled':
      return '#6b7280'; // gray
    default:
      return '#6b7280'; // gray
  }
}

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {

    const { 
      projectId, 
      triggerType, // 'completion', 'progress_milestone', 'status_change'
      triggerData,
      workspaceId 
    } = await request.json();

    console.log('[🎯 PROJECT TRIGGER] Event received:', {
      projectId,
      triggerType,
      triggerData,
      workspaceId,
      userId: user.id,
      timestamp: new Date().toISOString()
    });

    // Fetch project details
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('[❌ PROJECT TRIGGER] Project not found:', { projectId, error: projectError });
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.log('[📊 PROJECT TRIGGER] Project details:', {
      id: project.id,
      name: project.name,
      status: project.status,
      customer: project.customer_name || project.customerId
    });

    // Handle different trigger types
    let shouldTrigger = false;
    let triggerReason = '';

    switch (triggerType) {
      case 'completion':
        shouldTrigger = project.status === 'completed';
        triggerReason = `Project marked as completed`;
        console.log('[✅ PROJECT TRIGGER] Completion check:', { 
          shouldTrigger, 
          currentStatus: project.status 
        });
        break;

      case 'progress_milestone':
        const progress = await calculateProjectProgress(projectId);
        const targetPercentage = triggerData?.percentage || 25;
        shouldTrigger = progress >= targetPercentage;
        triggerReason = `Project reached ${progress}% progress (target: ${targetPercentage}%)`;
        console.log('[📈 PROJECT TRIGGER] Progress milestone check:', { 
          currentProgress: progress,
          targetPercentage,
          shouldTrigger,
          triggerReason
        });
        break;

      case 'status_change':
        const previousStatus = triggerData?.previousStatus;
        const currentStatus = project.status;
        shouldTrigger = previousStatus !== currentStatus;
        triggerReason = `Project status changed from ${previousStatus} to ${currentStatus}`;
        console.log('[🔄 PROJECT TRIGGER] Status change check:', { 
          previousStatus,
          currentStatus,
          shouldTrigger,
          triggerReason
        });
        break;

      default:
        console.log('[⚠️ PROJECT TRIGGER] Unknown trigger type:', triggerType);
        return NextResponse.json({ error: 'Unknown trigger type' }, { status: 400 });
    }

    if (shouldTrigger) {
      console.log('[🚀 PROJECT TRIGGER] TRIGGER ACTIVATED!', {
        projectId,
        projectName: project.name,
        triggerType,
        triggerReason,
        timestamp: new Date().toISOString()
      });

      // Log the trigger event to database
      await supabaseAdmin
        .from('automation_logs')
        .insert({
          workspace_id: workspaceId,
          trigger_type: 'project_event',
          trigger_data: {
            projectId,
            projectName: project.name,
            triggerType,
            triggerReason,
            projectData: {
              status: project.status,
              customer: project.customer_name || project.customerId,
              startDate: project.startDate,
              endDate: project.endDate
            }
          },
          status: 'completed',
          created_at: new Date().toISOString()
        });

      // Send automated project report
      console.log('[📧 PROJECT TRIGGER] Sending automated report...');
      await sendProjectTriggerReport(project, triggerType, triggerReason, user.id, workspaceId, triggerData);

      console.log('[💾 PROJECT TRIGGER] Event logged to database successfully');

      return NextResponse.json({
        triggered: true,
        triggerType,
        triggerReason,
        project: {
          id: project.id,
          name: project.name,
          status: project.status
        },
        timestamp: new Date().toISOString(),
        message: `Project trigger activated: ${triggerReason}`
      });

    } else {
      console.log('[⏭️ PROJECT TRIGGER] No trigger needed:', {
        projectId,
        triggerType,
        reason: 'Conditions not met'
      });

      return NextResponse.json({
        triggered: false,
        triggerType,
        reason: 'Trigger conditions not met',
        project: {
          id: project.id,
          name: project.name,
          status: project.status
        }
      });
    }

  } catch (error) {
    console.error('[💥 PROJECT TRIGGER] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process project trigger',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

// Helper function to calculate project progress
async function calculateProjectProgress(projectId: string): Promise<number> {
  try {
    console.log('[📊 PROJECT PROGRESS] Calculating progress for project:', projectId);

    // Get all tasks for this project
    const { data: tasks, error } = await supabaseAdmin
      .from('project_tasks')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      console.error('[❌ PROJECT PROGRESS] Error fetching tasks:', error);
      return 0;
    }

    if (!tasks || tasks.length === 0) {
      console.log('[📊 PROJECT PROGRESS] No tasks found, returning 0%');
      return 0;
    }

    // Calculate progress based on checklist completion (matching frontend logic)
    let totalProgress = 0;
    
    tasks.forEach(task => {
      if (task.checklist && Array.isArray(task.checklist)) {
        const totalItems = task.checklist.length;
        if (totalItems > 0) {
          const completedItems = task.checklist.filter((item: any) => item.done).length;
          const taskProgress = Math.round((completedItems / totalItems) * 100);
          totalProgress += taskProgress;
        }
      }
    });

    const progressPercentage = tasks.length > 0 ? Math.round(totalProgress / tasks.length) : 0;

    console.log('[📊 PROJECT PROGRESS] Calculation complete:', {
      projectId,
      totalTasks: tasks.length,
      totalProgress,
      progressPercentage
    });

    return progressPercentage;

  } catch (error) {
    console.error('[💥 PROJECT PROGRESS] Error calculating progress:', error);
    return 0;
  }
}

// Helper function to send automated project reports
async function sendProjectTriggerReport(
  project: any, 
  triggerType: string, 
  triggerReason: string, 
  userId: string, 
  workspaceId: string,
  triggerData?: any
) {
  try {
    console.log('[📧 REPORT SENDER] Generating project trigger report...', {
      projectId: project.id,
      projectName: project.name,
      triggerType,
      triggerReason
    });

    // First, get project report configuration to understand what tasks to include
    let reportConfig: any = {
      task_selection: 'all_tasks',
      subtask_inclusion: 'all_subtasks',
      include_comments: true
    };
    let shouldIncludeTasks = true; // Always include tasks by default
    
    // Check automation configurations to get task selection settings
    const { data: taskAutomationConfigs, error: taskConfigError } = await supabaseAdmin
      .from('cron_jobs')
      .select('settings')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('job_type', 'workflow');

    if (taskAutomationConfigs && taskAutomationConfigs.length > 0) {
      // Find the project report configuration
      taskAutomationConfigs.forEach(config => {
        if (config.settings?.workflow_data?.nodes) {
          config.settings.workflow_data.nodes.forEach((node: any) => {
            if (node.subtype === 'project_report') {
              const nodeProjectId = node.data?.project_id;
              if (!nodeProjectId || nodeProjectId === project.id) {
                reportConfig = { ...reportConfig, ...(node.data || {}) };
                console.log('[📋 TASK FETCHER] Found project report config:', reportConfig);
              }
            }
          });
        }
      });
    }
    
    console.log('[📋 TASK FETCHER] Using config:', reportConfig);

    // Fetch tasks and subtasks based on configuration
    let tasksContent = '';
    if (shouldIncludeTasks) {
      console.log('[📋 TASK FETCHER] Fetching tasks for project:', project.id);
      
      // Build task query based on task selection
      let taskQuery = supabaseAdmin
        .from('project_tasks')
        .select(`
          id, title, status, priority, due_date, assigned_to, progress, checklist
        `)
        .eq('project_id', project.id);

      // Apply task filters based on configuration
      const taskSelection = reportConfig.task_selection || 'all_tasks';
      switch (taskSelection) {
        case 'completed_only':
          taskQuery = taskQuery.eq('status', 'completed');
          break;
        case 'pending_only':
          taskQuery = taskQuery.in('status', ['pending', 'in_progress']);
          break;
        case 'overdue_only':
          taskQuery = taskQuery.lt('due_date', new Date().toISOString()).neq('status', 'completed');
          break;
        case 'high_priority':
          taskQuery = taskQuery.eq('priority', 'high');
          break;
        case 'specific_tasks':
          if (reportConfig.specific_task_ids && reportConfig.specific_task_ids.length > 0) {
            taskQuery = taskQuery.in('id', reportConfig.specific_task_ids);
          }
          break;
        // Default: all_tasks - no additional filters
      }

      const { data: tasks, error: tasksError } = await taskQuery;
      
      if (tasksError) {
        console.error('[❌ TASK FETCHER] Error fetching tasks:', tasksError);
      } else {
        console.log('[✅ TASK FETCHER] Raw tasks data:', JSON.stringify(tasks, null, 2));
        console.log('[✅ TASK FETCHER] Fetched tasks count:', tasks?.length || 0);
      }
      
      if (tasks && tasks.length > 0) {
        
        // Apply subtask filters
        const subtaskInclusion = reportConfig.subtask_inclusion || 'all_subtasks';
        const filteredTasks = tasks.map(task => {
          let filteredChecklist = task.checklist || [];
          
          switch (subtaskInclusion) {
            case 'completed_only':
              filteredChecklist = filteredChecklist.filter((item: any) => item.done);
              break;
            case 'pending_only':
              filteredChecklist = filteredChecklist.filter((item: any) => !item.done);
              break;
            case 'assigned_only':
              filteredChecklist = filteredChecklist.filter((item: any) => item.assigned_to);
              break;
            case 'none':
              filteredChecklist = [];
              break;
            // Default: all_subtasks - no filtering
          }
          
          return { ...task, checklist: filteredChecklist };
        });

        // Calculate task statistics (using the proven template approach)
        const totalTasks = filteredTasks.length;
        const completedTasks = filteredTasks.filter(task => task.status === 'completed').length;
        const totalChecklistItems = filteredTasks.reduce((sum, task) => sum + (task.checklist?.length || 0), 0);
        const completedChecklistItems = filteredTasks.reduce((sum, task) => 
          sum + (task.checklist?.filter((item: any) => item.done).length || 0), 0);
        const overallProgress = totalChecklistItems > 0 ? Math.round((completedChecklistItems / totalChecklistItems) * 100) : 0;

        // Get upcoming deadlines (from proven template)
        const upcomingDeadlines = filteredTasks
          .flatMap(task => 
            (task.checklist || [])
              .filter((item: any) => !item.done && item.deadline)
              .map((item: any) => ({
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

        // Generate tasks HTML content using the PROVEN template structure
        tasksContent = `
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #444;">📊 Project Overview</h2>
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
            <h2 style="color: #444;">📋 Task Details</h2>
            <div style="display: grid; gap: 16px;">
              ${filteredTasks.map(task => {
                const taskProgress = (task.checklist?.length || 0) > 0
                  ? Math.round(((task.checklist?.filter((item: any) => item.done).length || 0) / (task.checklist?.length || 1)) * 100)
                  : 0;
                
                return `
                  <div style="background: white; padding: 16px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                      <h3 style="color: #444; margin: 0;">${task.title}</h3>
                      <span style="color: #666;">${taskProgress}% Complete</span>
                    </div>
                    ${task.due_date ? `<p style="color: #666; margin: 8px 0;">Deadline: ${new Date(task.due_date).toLocaleDateString()}</p>` : ''}
                    <div style="background: #eee; height: 8px; border-radius: 4px; margin: 12px 0;">
                      <div style="background: #22c55e; height: 100%; width: ${taskProgress}%; border-radius: 4px;"></div>
                    </div>
                    <div style="margin-top: 12px;">
                      ${(task.checklist || []).map((item: any) => `
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
              <h2 style="color: #444;">⏰ Upcoming Deadlines</h2>
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
        `;
      } else {
        tasksContent = `
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="color: #6b7280; margin: 0;">📋 No tasks found matching the selected criteria.</p>
          </div>
        `;
      }
    }

    // Generate project-specific report content
    const reportContent = {
      subject: `🎯 Project Update: ${project.name} - ${triggerReason}`,
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            🎯 Project Update Notification
          </h2>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Project Details</h3>
            <p><strong>Project Name:</strong> ${project.name}</p>
            <p><strong>Current Status:</strong> <span style="background: #e0f2fe; padding: 2px 8px; border-radius: 4px; color: #0277bd;">${project.status}</span></p>
            <p><strong>Update:</strong> ${triggerReason}</p>
            <p><strong>Customer:</strong> ${project.customer_name || 'Not assigned'}</p>
            ${project.start_date ? `<p><strong>Start Date:</strong> ${new Date(project.start_date).toLocaleDateString()}</p>` : ''}
            ${project.end_date ? `<p><strong>End Date:</strong> ${new Date(project.end_date).toLocaleDateString()}</p>` : ''}
            <p><strong>Updated:</strong> ${new Date().toLocaleString()}</p>
          </div>

          ${triggerType === 'completion' ? `
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #065f46;">🎉 Project Completed!</h4>
            <p style="margin-bottom: 0;">Congratulations! Your project "${project.name}" has been marked as completed.</p>
          </div>
          ` : ''}

          ${triggerType === 'progress_milestone' ? `
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #92400e;">📈 Progress Milestone Reached!</h4>
            <p style="margin-bottom: 0;">Your project "${project.name}" has reached a significant progress milestone.</p>
          </div>
          ` : ''}

          ${triggerType === 'status_change' ? `
          <div style="background: #e0f2fe; border-left: 4px solid #0277bd; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #01579b;">🔄 Status Update</h4>
            <p style="margin-bottom: 0;">The status of your project "${project.name}" has been updated.</p>
          </div>
          ` : ''}

          ${tasksContent}

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
            <p>This is an automated project notification. You are receiving this because you are associated with this project.</p>
            <p>Project ID: ${project.id}</p>
          </div>
        </div>
      `,
      metadata: {
        projectId: project.id,
        projectName: project.name,
        triggerType,
        triggerReason,
        timestamp: new Date().toISOString()
      }
    };

    // Get project-specific email recipients
    let recipients: string[] = [];
    
    // 1. First, get the customer email associated with this project
    if (project.customer_id) {
      console.log('[📧 REPORT SENDER] Fetching customer email for project:', {
        projectId: project.id,
        customerId: project.customer_id
      });
      
      const { data: customer, error: customerError } = await supabaseAdmin
        .from('customers')
        .select('email, name, contact_person')
        .eq('id', project.customer_id)
        .single();
      
      if (customer && customer.email) {
        recipients.push(customer.email);
        console.log('[✅ REPORT SENDER] Added customer email:', {
          customerName: customer.name,
          contactPerson: customer.contact_person,
          email: customer.email
        });
      } else {
        console.log('[⚠️ REPORT SENDER] No customer email found:', {
          customerId: project.customer_id,
          error: customerError?.message
        });
      }
    }
    
    // 2. Also check if there are any project-specific automation configurations
    // that might have additional recipients for this specific project
    const { data: automationConfigs, error: configError } = await supabaseAdmin
      .from('cron_jobs')
      .select('settings')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('job_type', 'workflow');

    if (automationConfigs && automationConfigs.length > 0) {
      // Extract additional email recipients from automation workflow configurations
      // but only for this specific project or general project triggers
      automationConfigs.forEach(config => {
        // Check workflow nodes for project report actions
        if (config.settings?.workflow_data?.nodes) {
          config.settings.workflow_data.nodes.forEach((node: any) => {
            // Look for project report actions with email recipients
            if (node.subtype === 'project_report' && node.data?.report_recipients) {
              // Check if this automation is for all projects or this specific project
              const nodeProjectId = node.data?.project_id;
              if (!nodeProjectId || nodeProjectId === project.id) {
                recipients.push(node.data.report_recipients);
                console.log('[📧 REPORT SENDER] Added automation recipient:', {
                  recipient: node.data.report_recipients,
                  projectSpecific: !!nodeProjectId
                });
              }
            }
          });
        }
      });
    }

    // Remove duplicates and filter out empty emails
    recipients = [...new Set(recipients)].filter(email => email && email.includes('@'));

    // 3. If no customer email found, add fallback recipients (project owner, workspace admin)
    if (recipients.length === 0) {
      console.log('[⚠️ REPORT SENDER] No customer email found, adding fallback recipients...');
      
      // Add the user who owns this project as a fallback
      const { data: projectOwner, error: ownerError } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', project.user_id || userId)
        .single();
      
      if (projectOwner && projectOwner.email) {
        recipients.push(projectOwner.email);
        console.log('[📧 REPORT SENDER] Added project owner as fallback:', projectOwner.email);
      }
      
      // Also add any general automation recipients as final fallback
      if (automationConfigs && automationConfigs.length > 0) {
        automationConfigs.forEach(config => {
          if (config.settings?.recipients) {
            recipients = recipients.concat(config.settings.recipients);
          }
        });
      }
      
      // Remove duplicates again
      recipients = [...new Set(recipients)].filter(email => email && email.includes('@'));
    }

    console.log('[📧 REPORT SENDER] Final email recipients:', {
      projectId: project.id,
      projectName: project.name,
      customerName: project.customer_name,
      automationConfigs: automationConfigs?.length || 0,
      recipients: recipients.length,
      emails: recipients
    });

    if (recipients.length === 0) {
      console.log('[❌ REPORT SENDER] No email recipients found - cannot send notification');
      return;
    }

    // Send the actual emails using nodemailer
    console.log('[📧 REPORT SENDER] Sending emails to recipients...');
    
    for (const recipient of recipients) {
      try {
        const info = await getTransporter().sendMail({
          from: process.env.EMAIL_USER || 'kevin@solvify.se',
          to: recipient,
          subject: reportContent.subject,
          html: reportContent.body,
        });
        
        console.log('[✅ REPORT SENDER] Email sent successfully:', {
          recipient,
          messageId: info.messageId,
          subject: reportContent.subject,
          projectName: project.name,
          customerName: project.customer_name,
          triggerType,
          timestamp: new Date().toISOString()
        });
      } catch (emailError) {
        console.error('[❌ REPORT SENDER] Failed to send email:', {
          recipient,
          error: emailError instanceof Error ? emailError.message : String(emailError)
        });
      }
    }

    // Log the report sending to database
    await supabaseAdmin
      .from('automation_logs')
      .insert({
        workspace_id: workspaceId,
        trigger_type: 'report_sent',
        trigger_data: {
          reportType: 'project_specific_notification',
          projectId: project.id,
          projectName: project.name,
          customerName: project.customer_name,
          customerId: project.customer_id,
          triggerType,
          triggerReason,
          recipients: recipients.join(', '),
          reportContent: reportContent.subject,
          emailsSent: recipients.length
        },
        status: 'completed',
        created_at: new Date().toISOString()
      });

    console.log('[✅ REPORT SENDER] Project trigger report sent successfully!');

  } catch (error) {
    console.error('[💥 REPORT SENDER] Error sending project report:', error);
    
    // Log the error
    await supabaseAdmin
      .from('automation_logs')
      .insert({
        workspace_id: workspaceId,
        trigger_type: 'report_error',
        trigger_data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          projectId: project.id,
          triggerType
        },
        status: 'failed',
        created_at: new Date().toISOString()
      });
  }
}