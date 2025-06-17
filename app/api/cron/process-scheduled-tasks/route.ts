import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getValidGoogleToken, handleTokenRefreshOnError } from '@/lib/token-refresh';

export const dynamic = 'force-dynamic';

// Helper function to send email reports
async function sendEmailReport(
  recipients: string[],
  subject: string,
  htmlContent: string,
  attachments?: any[]
) {
  try {
    const emailResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipients,
        subject,
        html: htmlContent,
        attachments: attachments || []
      }),
    });

    if (!emailResponse.ok) {
      throw new Error(`Email API responded with status: ${emailResponse.status}`);
    }

    return await emailResponse.json();
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Helper function to generate analytics report
async function generateAnalyticsReport(userId: string, propertyId: string, dateRange: string = '30daysAgo') {
  try {
    const token = await getValidGoogleToken(userId, 'google-analytics');
    if (!token) {
      throw new Error('No valid Google Analytics token found');
    }

    const analyticsResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/ga4/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        propertyId,
        dateRange,
        metrics: ['sessions', 'users', 'pageviews', 'bounceRate', 'sessionDuration'],
        dimensions: ['date', 'country', 'deviceCategory', 'channelGrouping']
      }),
    });

    if (!analyticsResponse.ok) {
      throw new Error(`Analytics API responded with status: ${analyticsResponse.status}`);
    }

    return await analyticsResponse.json();
  } catch (error) {
    console.error('Error generating analytics report:', error);
    throw error;
  }
}

// Helper function to generate search console report
async function generateSearchConsoleReport(userId: string, siteUrl: string, dateRange: string = '30') {
  try {
    const token = await getValidGoogleToken(userId, 'google-searchconsole');
    if (!token) {
      throw new Error('No valid Google Search Console token found');
    }

    const searchResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/search-console/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        siteUrl,
        dateRange,
        dimensions: ['query', 'page', 'country', 'device'],
        metrics: ['clicks', 'impressions', 'ctr', 'position']
      }),
    });

    if (!searchResponse.ok) {
      throw new Error(`Search Console API responded with status: ${searchResponse.status}`);
    }

    return await searchResponse.json();
  } catch (error) {
    console.error('Error generating search console report:', error);
    throw error;
  }
}

// Helper function to generate project report
async function generateProjectReport(userId: string, projectId: string) {
  try {
    // Get project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    // Get project tasks and time entries
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        *,
        time_entries (*)
      `)
      .eq('project_id', projectId);

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
    }

    // Get project invoices
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .eq('project_id', projectId);

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
    }

    // Calculate project statistics
    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter(task => task.status === 'completed').length || 0;
    const totalTimeSpent = tasks?.reduce((total, task) => {
      return total + (task.time_entries?.reduce((taskTotal: number, entry: any) => {
        return taskTotal + (entry.duration || 0);
      }, 0) || 0);
    }, 0) || 0;

    const totalInvoiceAmount = invoices?.reduce((total, invoice) => {
      return total + (invoice.amount || 0);
    }, 0) || 0;

    return {
      project,
      statistics: {
        totalTasks,
        completedTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
        totalTimeSpent: Math.round(totalTimeSpent / 3600), // Convert to hours
        totalInvoiceAmount
      },
      tasks: tasks || [],
      invoices: invoices || []
    };
  } catch (error) {
    console.error('Error generating project report:', error);
    throw error;
  }
}

// Helper function to format report as HTML
function formatReportAsHTML(reportType: string, data: any, propertyId?: string, siteUrl?: string): string {
  const currentDate = new Date().toLocaleDateString();
  
  switch (reportType) {
    case 'analytics_report':
      return `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
              .metric { background-color: #fff; border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 5px; }
              .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
              .metric-label { color: #6c757d; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #dee2e6; padding: 8px; text-align: left; }
              th { background-color: #f8f9fa; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Google Analytics Report</h1>
              <p><strong>Property:</strong> ${propertyId}</p>
              <p><strong>Generated:</strong> ${currentDate}</p>
              <p><strong>Period:</strong> Last 30 days</p>
            </div>
            
            <div class="metrics">
              <h2>Key Metrics</h2>
              <div class="metric">
                <div class="metric-value">${data.totalSessions || 'N/A'}</div>
                <div class="metric-label">Total Sessions</div>
              </div>
              <div class="metric">
                <div class="metric-value">${data.totalUsers || 'N/A'}</div>
                <div class="metric-label">Total Users</div>
              </div>
              <div class="metric">
                <div class="metric-value">${data.totalPageviews || 'N/A'}</div>
                <div class="metric-label">Total Pageviews</div>
              </div>
              <div class="metric">
                <div class="metric-value">${data.bounceRate ? (data.bounceRate * 100).toFixed(2) + '%' : 'N/A'}</div>
                <div class="metric-label">Bounce Rate</div>
              </div>
            </div>

            ${data.topPages ? `
              <h2>Top Pages</h2>
              <table>
                <thead>
                  <tr><th>Page</th><th>Pageviews</th><th>Users</th></tr>
                </thead>
                <tbody>
                  ${data.topPages.slice(0, 10).map((page: any) => `
                    <tr>
                      <td>${page.pagePath || 'N/A'}</td>
                      <td>${page.pageviews || 0}</td>
                      <td>${page.users || 0}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}
          </body>
        </html>
      `;

    case 'search_console_report':
      return `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
              .metric { background-color: #fff; border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 5px; }
              .metric-value { font-size: 24px; font-weight: bold; color: #28a745; }
              .metric-label { color: #6c757d; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #dee2e6; padding: 8px; text-align: left; }
              th { background-color: #f8f9fa; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Google Search Console Report</h1>
              <p><strong>Site:</strong> ${siteUrl}</p>
              <p><strong>Generated:</strong> ${currentDate}</p>
              <p><strong>Period:</strong> Last 30 days</p>
            </div>
            
            <div class="metrics">
              <h2>Search Performance</h2>
              <div class="metric">
                <div class="metric-value">${data.totalClicks || 'N/A'}</div>
                <div class="metric-label">Total Clicks</div>
              </div>
              <div class="metric">
                <div class="metric-value">${data.totalImpressions || 'N/A'}</div>
                <div class="metric-label">Total Impressions</div>
              </div>
              <div class="metric">
                <div class="metric-value">${data.averageCTR ? (data.averageCTR * 100).toFixed(2) + '%' : 'N/A'}</div>
                <div class="metric-label">Average CTR</div>
              </div>
              <div class="metric">
                <div class="metric-value">${data.averagePosition ? data.averagePosition.toFixed(1) : 'N/A'}</div>
                <div class="metric-label">Average Position</div>
              </div>
            </div>

            ${data.topQueries ? `
              <h2>Top Search Queries</h2>
              <table>
                <thead>
                  <tr><th>Query</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr>
                </thead>
                <tbody>
                  ${data.topQueries.slice(0, 20).map((query: any) => `
                    <tr>
                      <td>${query.keys?.[0] || 'N/A'}</td>
                      <td>${query.clicks || 0}</td>
                      <td>${query.impressions || 0}</td>
                      <td>${query.ctr ? (query.ctr * 100).toFixed(2) + '%' : 'N/A'}</td>
                      <td>${query.position ? query.position.toFixed(1) : 'N/A'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}
          </body>
        </html>
      `;

    case 'project_report':
      return `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
              .metric { background-color: #fff; border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 5px; }
              .metric-value { font-size: 24px; font-weight: bold; color: #6f42c1; }
              .metric-label { color: #6c757d; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #dee2e6; padding: 8px; text-align: left; }
              th { background-color: #f8f9fa; }
              .status-completed { color: #28a745; font-weight: bold; }
              .status-in-progress { color: #ffc107; font-weight: bold; }
              .status-pending { color: #6c757d; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Project Report: ${data.project?.name || 'Unknown Project'}</h1>
              <p><strong>Generated:</strong> ${currentDate}</p>
              <p><strong>Description:</strong> ${data.project?.description || 'No description'}</p>
            </div>
            
            <div class="metrics">
              <h2>Project Statistics</h2>
              <div class="metric">
                <div class="metric-value">${data.statistics?.totalTasks || 0}</div>
                <div class="metric-label">Total Tasks</div>
              </div>
              <div class="metric">
                <div class="metric-value">${data.statistics?.completedTasks || 0}</div>
                <div class="metric-label">Completed Tasks</div>
              </div>
              <div class="metric">
                <div class="metric-value">${data.statistics?.completionRate?.toFixed(1) || 0}%</div>
                <div class="metric-label">Completion Rate</div>
              </div>
              <div class="metric">
                <div class="metric-value">${data.statistics?.totalTimeSpent || 0}h</div>
                <div class="metric-label">Total Time Spent</div>
              </div>
              <div class="metric">
                <div class="metric-value">$${data.statistics?.totalInvoiceAmount?.toFixed(2) || '0.00'}</div>
                <div class="metric-label">Total Invoice Amount</div>
              </div>
            </div>

            ${data.tasks && data.tasks.length > 0 ? `
              <h2>Recent Tasks</h2>
              <table>
                <thead>
                  <tr><th>Task</th><th>Status</th><th>Priority</th><th>Due Date</th></tr>
                </thead>
                <tbody>
                  ${data.tasks.slice(0, 10).map((task: any) => `
                    <tr>
                      <td>${task.title || 'Untitled Task'}</td>
                      <td><span class="status-${task.status}">${task.status || 'pending'}</span></td>
                      <td>${task.priority || 'medium'}</td>
                      <td>${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            ${data.invoices && data.invoices.length > 0 ? `
              <h2>Recent Invoices</h2>
              <table>
                <thead>
                  <tr><th>Invoice #</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  ${data.invoices.slice(0, 5).map((invoice: any) => `
                    <tr>
                      <td>${invoice.invoice_number || 'N/A'}</td>
                      <td>$${invoice.amount?.toFixed(2) || '0.00'}</td>
                      <td>${invoice.status || 'draft'}</td>
                      <td>${invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}
          </body>
        </html>
      `;

    default:
      return `
        <html>
          <body>
            <h1>Report Generated</h1>
            <p>Generated on: ${currentDate}</p>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          </body>
        </html>
      `;
  }
}

// Helper function to process email campaigns
async function processEmailCampaign(job: any) {
  const config = job.settings.automation_config || {};
  
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/email-marketing/send-campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: config.email_template || 'Automated email campaign',
        contactListId: config.contact_list_id,
        userId: job.user_id,
        isAutomated: true
      }),
    });

    if (!response.ok) {
      throw new Error(`Email campaign API responded with status: ${response.status}`);
    }

    await updateJobSuccess(job.id);
  } catch (error) {
    console.error('Error processing email campaign:', error);
    throw error;
  }
}

// Helper function to process invoice creation
async function processInvoiceCreation(job: any) {
  const config = job.settings.automation_config || {};
  
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/fortnox/invoices/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-id': job.user_id
      },
      body: JSON.stringify({
        customerNumber: config.customer_number,
        comments: config.invoice_template || 'Automated invoice',
        invoiceRows: [{
          ArticleNumber: 'AUTO-001',
          Description: config.invoice_template || 'Automated service',
          Quantity: 1,
          Price: 100 // Default price, should be configurable
        }],
        invoiceType: config.auto_send ? 'INVOICE' : 'OFFER'
      }),
    });

    if (!response.ok) {
      throw new Error(`Invoice creation API responded with status: ${response.status}`);
    }

    await updateJobSuccess(job.id);
  } catch (error) {
    console.error('Error processing invoice creation:', error);
    throw error;
  }
}

// Helper function to process calendar events
async function processCalendarEvent(job: any) {
  const config = job.settings.automation_config || {};
  
  try {
    const eventDate = new Date();
    eventDate.setHours(eventDate.getHours() + 1); // Schedule 1 hour from now
    const endDate = new Date(eventDate.getTime() + (config.event_duration || 60) * 60000);

    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/calendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: config.event_title || 'Automated Event',
        start: eventDate.toISOString(),
        end: endDate.toISOString(),
        event_type: config.event_type || 'reminder',
        userId: job.user_id
      }),
    });

    if (!response.ok) {
      throw new Error(`Calendar API responded with status: ${response.status}`);
    }

    await updateJobSuccess(job.id);
  } catch (error) {
    console.error('Error processing calendar event:', error);
    throw error;
  }
}

// Helper function to process chat messages
async function processChatMessage(job: any) {
  const config = job.settings.automation_config || {};
  
  try {
    // This would integrate with your chat system
    // For now, we'll send it as an email notification
    await sendEmailReport(
      [config.chat_channel || job.settings.recipients[0]],
      'Automated Chat Message',
      `<p>${config.message_content || 'Automated message'}</p>`
    );

    await updateJobSuccess(job.id);
  } catch (error) {
    console.error('Error processing chat message:', error);
    throw error;
  }
}

// Helper function to process social media posts
async function processSocialMediaPost(job: any) {
  const config = job.settings.automation_config || {};
  
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/social-media/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: config.message_content || 'Automated social media post',
        platforms: [config.platform || 'facebook'],
        userId: job.user_id,
        publishImmediately: true
      }),
    });

    if (!response.ok) {
      throw new Error(`Social media API responded with status: ${response.status}`);
    }

    await updateJobSuccess(job.id);
  } catch (error) {
    console.error('Error processing social media post:', error);
    throw error;
  }
}

// Helper function to process project creation
async function processProjectCreation(job: any) {
  const config = job.settings.automation_config || {};
  
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name: `Automated Project - ${new Date().toLocaleDateString()}`,
        description: config.project_template || 'Automatically created project',
        user_id: config.auto_assign ? job.user_id : null,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Project creation failed: ${error.message}`);
    }

    await updateJobSuccess(job.id);
  } catch (error) {
    console.error('Error processing project creation:', error);
    throw error;
  }
}

// Helper function to process data sync
async function processDataSync(job: any) {
  const config = job.settings.automation_config || {};
  
  try {
    let response;
    
    switch (config.sync_source) {
      case 'google_analytics':
        response = await fetch(`${process.env.NEXTAUTH_URL}/api/ga4/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: job.user_id, target: config.sync_target })
        });
        break;
      case 'search_console':
        response = await fetch(`${process.env.NEXTAUTH_URL}/api/search-console/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: job.user_id, target: config.sync_target })
        });
        break;
      case 'calendar':
        response = await fetch(`${process.env.NEXTAUTH_URL}/api/calendar/sync-workspace`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: job.user_id })
        });
        break;
      default:
        throw new Error(`Unknown sync source: ${config.sync_source}`);
    }

    if (!response?.ok) {
      throw new Error(`Data sync API responded with status: ${response?.status}`);
    }

    await updateJobSuccess(job.id);
  } catch (error) {
    console.error('Error processing data sync:', error);
    throw error;
  }
}

// Helper function to update job success status
async function updateJobSuccess(jobId: string) {
  const nextRun = new Date();
  nextRun.setDate(nextRun.getDate() + 1); // Default to next day

  await supabase
    .from('cron_jobs')
    .update({
      last_run: new Date().toISOString(),
      next_run: nextRun.toISOString(),
      execution_status: 'success',
      error_message: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);
}

// Main function to process a single cron job
async function processCronJob(job: any) {
  console.log(`[Process Cron Job] Processing job ${job.id} of type ${job.job_type}`);
  
  try {
    let reportData: any = {};
    let subject = '';
    
    switch (job.job_type) {
      case 'analytics_report':
        if (!job.property_id) {
          throw new Error('Property ID is required for analytics reports');
        }
        reportData = await generateAnalyticsReport(job.user_id, job.property_id);
        subject = `Analytics Report - ${job.property_id} - ${new Date().toLocaleDateString()}`;
        break;
        
      case 'search_console_report':
        if (!job.site_url) {
          throw new Error('Site URL is required for search console reports');
        }
        reportData = await generateSearchConsoleReport(job.user_id, job.site_url);
        subject = `Search Console Report - ${job.site_url} - ${new Date().toLocaleDateString()}`;
        break;
        
      case 'project_report':
        if (!job.property_id) { // Using property_id field for project_id
          throw new Error('Project ID is required for project reports');
        }
        reportData = await generateProjectReport(job.user_id, job.property_id);
        subject = `Project Report - ${reportData.project?.name || 'Unknown'} - ${new Date().toLocaleDateString()}`;
        break;

      case 'email_campaign':
        await processEmailCampaign(job);
        return { success: true, jobId: job.id }; // Early return for email campaigns

      case 'invoice_creation':
        await processInvoiceCreation(job);
        return { success: true, jobId: job.id }; // Early return for invoice creation

      case 'calendar_event':
        await processCalendarEvent(job);
        return { success: true, jobId: job.id }; // Early return for calendar events

      case 'chat_message':
        await processChatMessage(job);
        return { success: true, jobId: job.id }; // Early return for chat messages

      case 'social_media_post':
        await processSocialMediaPost(job);
        return { success: true, jobId: job.id }; // Early return for social media posts

      case 'project_creation':
        await processProjectCreation(job);
        return { success: true, jobId: job.id }; // Early return for project creation

      case 'data_sync':
        await processDataSync(job);
        return { success: true, jobId: job.id }; // Early return for data sync
        
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }
    
    // Format the report as HTML
    const htmlContent = formatReportAsHTML(
      job.job_type, 
      reportData, 
      job.property_id, 
      job.site_url
    );
    
    // Send the email
    await sendEmailReport(
      job.settings.recipients,
      subject,
      htmlContent
    );
    
    // Calculate next run time
    const nextRun = calculateNextRunTime(
      job.settings.frequency,
      job.settings.send_day,
      job.settings.send_time
    );
    
    // Update the job with success status
        await supabase
          .from('cron_jobs')
          .update({
        last_run: new Date().toISOString(),
            next_run: nextRun.toISOString(),
        execution_status: 'success',
        error_message: null,
        updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
        
    console.log(`[Process Cron Job] Successfully processed job ${job.id}`);
    return { success: true, jobId: job.id };
    
  } catch (error: any) {
    console.error(`[Process Cron Job] Error processing job ${job.id}:`, error);
    
    // Update the job with error status
        await supabase
          .from('cron_jobs')
          .update({
        execution_status: 'failed',
        error_message: error.message || 'Unknown error',
        updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
        
    return { success: false, jobId: job.id, error: error.message };
  }
}

// Helper function to calculate next run time
function calculateNextRunTime(frequency: string, sendDay: string, sendTime: string): Date {
  const now = new Date();
  const [hours, minutes] = sendTime.split(':').map(Number);
  
  if (frequency === 'daily') {
    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    return nextRun;
  } else if (frequency === 'weekly') {
    const dayMap: { [key: string]: number } = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
      'friday': 5, 'saturday': 6, 'sunday': 0
    };
    const targetDay = dayMap[sendDay.toLowerCase()];
    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);
    
    const daysUntilTarget = (targetDay - now.getDay() + 7) % 7;
    if (daysUntilTarget === 0 && nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 7);
    } else {
      nextRun.setDate(nextRun.getDate() + daysUntilTarget);
    }
    return nextRun;
  } else if (frequency === 'monthly') {
    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);
    nextRun.setDate(1); // First day of month
    if (nextRun <= now) {
      nextRun.setMonth(nextRun.getMonth() + 1);
    }
    return nextRun;
  }
  
  return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to tomorrow
}

// Main GET endpoint
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');
    
    // If jobId is provided, run that specific job (manual run)
    if (jobId) {
      console.log(`[Manual Run] Processing job ${jobId}`);
      
      const { data: job, error } = await supabase
        .from('cron_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
        
      if (error || !job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      
      const result = await processCronJob(job);
      return NextResponse.json(result);
    }
    
    // Otherwise, process all scheduled jobs that are due
    console.log('[Scheduled Run] Processing all due jobs');
    
    const now = new Date().toISOString();
    const { data: dueJobs, error } = await supabase
      .from('cron_jobs')
      .select('*')
      .eq('status', 'active')
      .lte('next_run', now);
      
    if (error) {
      console.error('Error fetching due jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch due jobs' }, { status: 500 });
    }
    
    if (!dueJobs || dueJobs.length === 0) {
      return NextResponse.json({ message: 'No jobs due for processing', processedJobs: 0 });
    }
    
    console.log(`[Scheduled Run] Found ${dueJobs.length} jobs due for processing`);
    
    // Process all due jobs
    const results = await Promise.allSettled(
      dueJobs.map(job => processCronJob(job))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
    
    return NextResponse.json({
      message: `Processed ${dueJobs.length} jobs`,
      successful,
      failed,
      processedJobs: dueJobs.length
    });
    
  } catch (error) {
    console.error('Error in process-scheduled-tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 