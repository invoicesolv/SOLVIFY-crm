import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { getUserFromToken } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

interface ConversionEvent {
  name: string;
  count: number;
  value?: number;
}

interface ConversionStats {
  count: number;
  value?: number;
}

interface ConversionBreakdown {
  byDevice: Record<string, ConversionStats>;
  bySource: Record<string, ConversionStats>;
}

interface DeviceStats {
  users: number;
  sessions: number;
  pageViews: number;
  conversions: number;
}

// Create transporter with debug logging
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER || 'kevin@solvify.se',
    pass: process.env.GMAIL_APP_PASSWORD
  },
  debug: true, // Enable debug logs
  logger: true // Log to console
});

export async function POST(request: NextRequest) {
  try {
    const { propertyId, propertyName, recipients, analyticsData, isTest, dateRange } = await request.json();
    
    console.log('Received request:', { propertyId, propertyName, recipients, isTest, dateRange });
    
    // Log the bySource data structure for debugging
    console.log('bySource data structure:', {
      keys: Object.keys(analyticsData.bySource || {}),
      firstSource: analyticsData.bySource && Object.keys(analyticsData.bySource).length > 0 
        ? analyticsData.bySource[Object.keys(analyticsData.bySource)[0]] 
        : 'no sources',
      hasSessionsProperty: analyticsData.bySource && Object.keys(analyticsData.bySource).length > 0 
        ? 'sessions' in analyticsData.bySource[Object.keys(analyticsData.bySource)[0]] 
        : 'no sources'
    });

    // Check for CRON authorization (from cron jobs) first
    const authHeader = request.headers.get('Authorization');
    const isCronAuth = authHeader && authHeader.startsWith('Bearer ') && 
                        authHeader.substring(7) === (process.env.CRON_SECRET || 'development');
    
    // Only require authentication for non-test emails and when not authorized via cron secret
    if (!isTest && !isCronAuth) {
      const user = await getUserFromToken(request);
      const userId = user?.id;

      if (!userId) {
        return NextResponse.json(
          { error: 'User not authenticated' },
          { status: 401 }
        );
      }
    }

    if (!propertyId || !recipients || !analyticsData) {
      console.error('Missing required fields:', { propertyId, recipients, hasAnalyticsData: !!analyticsData });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Format date range for subject
    const formatDateRange = (range: string) => {
      switch (range) {
        case '7days':
          return 'Last 7 Days';
        case '14days':
          return 'Last 14 Days';
        case '28days':
          return 'Last 28 Days';
        case '30days':
          return 'Last 30 Days';
        default:
          return 'Last 7 Days';
      }
    };

    // Use property name from request, fallback to a meaningful default if not provided
    const finalPropertyName = propertyName || 
                              (propertyId ? `Property ${propertyId.replace('properties/', '')}` : 'Your Property');
    console.log('Property name processing:', {
      received_propertyName: propertyName,
      finalPropertyName: finalPropertyName,
      propertyName_type: typeof propertyName,
      propertyName_length: propertyName?.length
    });

    // Create email content with modern design matching the app UI
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${finalPropertyName} - Analytics Report</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
            min-height: 100vh;
            padding: 20px;
          }
          
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.1) 100%);
            animation: shimmer 3s ease-in-out infinite;
          }
          
          @keyframes shimmer {
            0%, 100% { transform: translateX(-100%); }
            50% { transform: translateX(100%); }
          }
          
          .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 10px;
            color: #ffffff;
            text-shadow: 0 4px 8px rgba(0,0,0,0.3);
            position: relative;
            z-index: 1;
          }
          
          .header p {
            font-size: 1.1rem;
            color: #ffffff;
            opacity: 0.9;
            position: relative;
            z-index: 1;
          }
          
          .content {
            padding: 40px;
          }
          
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
          }
          
          .metric-card {
            background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          
          .metric-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #667eea, #764ba2, #f093fb, #f5576c);
            background-size: 200% 100%;
            animation: gradient 3s ease infinite;
          }
          
          @keyframes gradient {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          
          .metric-value {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 8px;
          }
          
          .metric-label {
            color: #64748b;
            font-size: 0.9rem;
            font-weight: 500;
          }
          
          .section {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 30px;
            margin: 30px 0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          
          .section h2 {
            font-size: 1.8rem;
            font-weight: 600;
            margin-bottom: 20px;
            text-align: center;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          
          .device-chart {
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
            border: 1px solid #cbd5e1;
          }
          
          .progress-bar {
            background: #f1f5f9;
            border-radius: 10px;
            height: 20px;
            overflow: hidden;
            margin: 10px 0;
            border: 1px solid #e2e8f0;
          }
          
          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 10px;
            transition: width 0.3s ease;
          }
          
          .device-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .device-item:last-child {
            border-bottom: none;
          }
          
          .device-icon {
            width: 20px;
            height: 20px;
            margin-right: 12px;
            opacity: 0.8;
          }
          
          .footer {
            background: #f8fafc;
            padding: 30px 40px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer p {
            color: #64748b;
            font-size: 0.9rem;
            margin: 5px 0;
          }
          
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 12px;
            font-weight: 600;
            margin: 20px 0;
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
            transition: all 0.3s ease;
          }
          
          .conversion-card {
            background: linear-gradient(145deg, #fef7ff 0%, #fdf2f8 100%);
            border: 1px solid #f3e8ff;
            border-radius: 12px;
            padding: 20px;
            margin: 15px 0;
            box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.05);
          }
          
          .stats-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 10px 0;
          }
          
          .highlight {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${finalPropertyName}</h1>
            <p>Analytics Report • ${formatDateRange(dateRange)}</p>
          </div>
          
          <div class="content">
            <!-- Overview Metrics -->
            <div class="section">
              <h2>📊 Overview</h2>
              <div class="metrics-grid">
                <div class="metric-card">
                  <div class="metric-value">${analyticsData.overview.totalUsers.toLocaleString()}</div>
                  <div class="metric-label">Total Users</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">${analyticsData.overview.activeUsers.toLocaleString()}</div>
                  <div class="metric-label">Active Users</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">${analyticsData.overview.newUsers.toLocaleString()}</div>
                  <div class="metric-label">New Users</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">${analyticsData.overview.pageViews.toLocaleString()}</div>
                  <div class="metric-label">Page Views</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">${analyticsData.overview.sessions.toLocaleString()}</div>
                  <div class="metric-label">Sessions</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">${analyticsData.overview.bounceRate.toFixed(1)}%</div>
                  <div class="metric-label">Bounce Rate</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">${analyticsData.overview.engagementRate.toFixed(1)}%</div>
                  <div class="metric-label">Engagement Rate</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">${Math.floor(analyticsData.overview.avgSessionDuration / 60)}m ${Math.floor(analyticsData.overview.avgSessionDuration % 60)}s</div>
                  <div class="metric-label">Avg Duration</div>
                </div>
              </div>
            </div>
            
            <!-- Device Distribution -->
            <div class="section">
              <h2>📱 Device Distribution</h2>
              <div class="device-chart">
                ${(() => {
                  const deviceData = analyticsData.byDevice || {};
                  const deviceEntries = Object.entries(deviceData);
                  const totalUsers = deviceEntries.reduce((sum, [_, deviceStats]) => {
                    const stats = deviceStats as any;
                    return sum + (stats.users || 0);
                  }, 0);
                  
                  const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'];
                  const deviceIcons = {
                    mobile: '📱',
                    desktop: '💻',
                    tablet: '📱',
                    default: '📱'
                  };
                  
                  return deviceEntries.map(([device, deviceStats], index) => {
                    const stats = deviceStats as any;
                    const users = stats.users || 0;
                    const percentage = totalUsers > 0 ? (users / totalUsers) * 100 : 0;
                    const icon = deviceIcons[device as keyof typeof deviceIcons] || deviceIcons.default;
                    
                    return `
                      <div class="device-item">
                          <div style="display: flex; align-items: center;">
                          <span style="font-size: 1.2rem; margin-right: 12px;">${icon}</span>
                          <span style="font-weight: 500;">${device.charAt(0).toUpperCase() + device.slice(1)}</span>
                        </div>
                        <div style="flex: 1; margin: 0 20px;">
                          <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%; background: ${colors[index % colors.length]};"></div>
                          </div>
                        </div>
                        <div style="font-weight: 600; color: #1e293b;">
                          <span class="highlight">${users.toLocaleString()}</span>
                          <span style="opacity: 0.7; margin-left: 8px;">(${percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                    `;
                  }).join('');
                })()}
              </div>
            </div>
            <!-- Traffic Sources -->
            <div class="section">
              <h2>🌐 Traffic Sources</h2>
              <div style="space-y: 12px;">
            ${(() => {
              const sourceData = analyticsData.bySource || {};
              const sources = Object.entries(sourceData)
                    .map(([source, sourceStats]) => ({
                      name: source === '(direct)' ? 'Direct' : source.charAt(0).toUpperCase() + source.slice(1),
                      sessions: (sourceStats as any)?.sessions || 0,
                      icon: source === '(direct)' ? '🔗' : source.includes('google') ? '🔍' : source.includes('facebook') ? '📘' : '🌐'
                    }))
                .sort((a, b) => b.sessions - a.sessions)
                    .slice(0, 6);
              
              const maxSessions = Math.max(...sources.map(s => s.sessions), 1);
                  const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
                  
              return sources.map((source, index) => {
                const percentage = (source.sessions / maxSessions) * 100;
                return `
                                             <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                         <span style="font-size: 1.2rem; margin-right: 12px;">${source.icon}</span>
                         <div style="min-width: 120px; font-weight: 500; color: #1e293b;">${source.name}</div>
                        <div style="flex: 1; margin: 0 20px;">
                          <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percentage}%; background: ${colors[index % colors.length]};"></div>
                        </div>
                        </div>
                                                 <div style="font-weight: 600; color: #1e293b;">
                           <span class="highlight">${source.sessions.toLocaleString()}</span>
                        </div>
                      </div>
                `;
              }).join('');
            })()}
        </div>
            </div>

            <!-- Conversions -->
            <div class="section">
              <h2>💰 Conversions</h2>
              <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 30px;">
                <div class="metric-card">
                  <div class="metric-value">${analyticsData.overview.conversions.toLocaleString()}</div>
                  <div class="metric-label">Total Conversions</div>
                </div>
                <div class="metric-card">
                  <div class="metric-value">${analyticsData.overview.conversionRate.toFixed(2)}%</div>
                  <div class="metric-label">Conversion Rate</div>
            </div>
                <div class="metric-card">
                  <div class="metric-value">$${analyticsData.overview.revenue.toLocaleString()}</div>
                  <div class="metric-label">Total Revenue</div>
            </div>
          </div>

          ${analyticsData.overview.conversionEvents?.map((event: ConversionEvent) => `
                <div class="conversion-card">
                  <div class="stats-row">
                    <h3 style="margin: 0; font-size: 1.2rem;">${event.name}</h3>
                <div>
                      <span class="highlight">${event.count} conversions</span>
                      ${event.value ? `<span style="margin-left: 15px; opacity: 0.8;">$${event.value.toLocaleString()}</span>` : ''}
                </div>
              </div>
              
              ${analyticsData.byConversion?.[event.name] ? `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px;">
                  <div>
                        <h4 style="margin: 0 0 15px 0; opacity: 0.8;">By Device</h4>
                    ${Object.entries(analyticsData.byConversion[event.name].byDevice as Record<string, ConversionStats>)
                      .map(([device, stats]) => `
                            <div class="stats-row" style="margin: 8px 0;">
                              <span>${device.charAt(0).toUpperCase() + device.slice(1)}</span>
                              <span class="highlight">${stats.count}</span>
                        </div>
                      `).join('')}
                  </div>
                  <div>
                        <h4 style="margin: 0 0 15px 0; opacity: 0.8;">By Source</h4>
                    ${Object.entries(analyticsData.byConversion[event.name].bySource as Record<string, ConversionStats>)
                      .sort((a, b) => b[1].count - a[1].count)
                          .slice(0, 4)
                      .map(([source, stats]) => `
                            <div class="stats-row" style="margin: 8px 0;">
                              <span>${source || 'Direct'}</span>
                              <span class="highlight">${stats.count}</span>
                        </div>
                      `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

            <!-- Device Performance -->
            <div class="section">
              <h2>📊 Device Performance</h2>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                ${Object.entries(analyticsData.byDevice as Record<string, DeviceStats>).map(([device, stats]) => {
                  const deviceIcons = { mobile: '📱', desktop: '💻', tablet: '📱' };
                  const icon = deviceIcons[device as keyof typeof deviceIcons] || '📱';
                  
                  return `
                                         <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.05);">
                       <div style="display: flex; align-items: center; margin-bottom: 15px;">
                         <span style="font-size: 1.5rem; margin-right: 10px;">${icon}</span>
                         <h3 style="margin: 0; font-size: 1.1rem; color: #1e293b;">${device.charAt(0).toUpperCase() + device.slice(1)}</h3>
                       </div>
                      <div style="space-y: 8px;">
                        <div class="stats-row">
                          <span>Sessions</span>
                          <span class="highlight">${stats.sessions.toLocaleString()}</span>
                        </div>
                        <div class="stats-row">
                          <span>Page Views</span>
                          <span class="highlight">${stats.pageViews.toLocaleString()}</span>
                        </div>
                        <div class="stats-row">
                          <span>Conversions</span>
                          <span class="highlight">${(stats.conversions || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- CTA Section -->
            <div style="text-align: center; margin: 40px 0;">
              <a href="https://crm.solvify.se/analytics" class="cta-button">
                View Full Analytics Dashboard
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>🚀 This report was automatically generated by <strong>Solvify Analytics</strong></p>
            <p>To modify your email preferences, please visit your Analytics Dashboard settings</p>
            <p style="margin-top: 15px; opacity: 0.5;">© ${new Date().getFullYear()} Solvify. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
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

    // Send email with date range in subject
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER || 'kevin@solvify.se',
      to: recipients,
      subject: `${isTest ? '[TEST] ' : ''}${finalPropertyName} - Analytics Report (${formatDateRange(dateRange)})`,
      html,
    });

    console.log('Email sent successfully:', info);
    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: Error | unknown) {
    console.error('Detailed error sending analytics report:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Failed to send report', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 