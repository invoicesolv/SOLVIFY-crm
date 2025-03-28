import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { supabase } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

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
    const { propertyId, recipients, analyticsData, isTest, dateRange } = await request.json();
    
    console.log('Received request:', { propertyId, recipients, isTest, dateRange });

    // Only require authentication for non-test emails
    if (!isTest) {
      const session = await getServerSession(authOptions);
      const userId = session?.user?.id;

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

    // Get property name
    const { data: properties } = await supabase
      .from('analytics_properties')
      .select('name')
      .eq('property_id', propertyId)
      .single();

    const propertyName = properties?.name || 'Your Property';
    console.log('Property name:', propertyName);

    // Create email content with a more professional template
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333;">${propertyName} - Analytics Report</h1>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #444;">Overview</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
            <div>
              <h3 style="color: #666;">User Metrics</h3>
              <ul style="list-style: none; padding: 0;">
                <li>Total Users: ${analyticsData.overview.totalUsers}</li>
                <li>Active Users: ${analyticsData.overview.activeUsers}</li>
                <li>New Users: ${analyticsData.overview.newUsers}</li>
              </ul>
            </div>
            <div>
              <h3 style="color: #666;">Performance Metrics</h3>
              <ul style="list-style: none; padding: 0;">
                <li>Page Views: ${analyticsData.overview.pageViews}</li>
                <li>Sessions: ${analyticsData.overview.sessions}</li>
                <li>Bounce Rate: ${analyticsData.overview.bounceRate.toFixed(1)}%</li>
                <li>Engagement Rate: ${analyticsData.overview.engagementRate.toFixed(1)}%</li>
                <li>Avg Duration: ${Math.floor(analyticsData.overview.avgSessionDuration / 60)}m ${Math.floor(analyticsData.overview.avgSessionDuration % 60)}s</li>
              </ul>
            </div>
          </div>
        </div>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #444;">Conversion Details</h2>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px;">
            <div>
              <h3 style="color: #666;">Total Conversions</h3>
              <p style="font-size: 1.5em; margin: 0;">${analyticsData.overview.conversions}</p>
            </div>
            <div>
              <h3 style="color: #666;">Conversion Rate</h3>
              <p style="font-size: 1.5em; margin: 0;">${analyticsData.overview.conversionRate.toFixed(2)}%</p>
            </div>
            <div>
              <h3 style="color: #666;">Total Revenue</h3>
              <p style="font-size: 1.5em; margin: 0;">$${analyticsData.overview.revenue.toLocaleString()}</p>
            </div>
          </div>

          ${analyticsData.overview.conversionEvents?.map((event: ConversionEvent) => `
            <div style="background: #fff; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <h3 style="color: #444; margin: 0;">${event.name}</h3>
                <div>
                  <span style="color: #666;">${event.count} conversions</span>
                  ${event.value ? `<span style="color: #666; margin-left: 10px;">$${event.value.toLocaleString()} value</span>` : ''}
                </div>
              </div>
              
              ${analyticsData.byConversion?.[event.name] ? `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 15px;">
                  <div>
                    <h4 style="color: #666; margin: 0 0 10px 0;">By Device</h4>
                    ${Object.entries(analyticsData.byConversion[event.name].byDevice as Record<string, ConversionStats>)
                      .map(([device, stats]) => `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                          <span style="color: #666;">${device}</span>
                          <span style="color: #444;">${stats.count}</span>
                        </div>
                      `).join('')}
                  </div>
                  <div>
                    <h4 style="color: #666; margin: 0 0 10px 0;">By Source</h4>
                    ${Object.entries(analyticsData.byConversion[event.name].bySource as Record<string, ConversionStats>)
                      .sort((a, b) => b[1].count - a[1].count)
                      .slice(0, 5)
                      .map(([source, stats]) => `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                          <span style="color: #666;">${source || '(direct)'}</span>
                          <span style="color: #444;">${stats.count}</span>
                        </div>
                      `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #444;">Device Breakdown</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
            ${Object.entries(analyticsData.byDevice as Record<string, DeviceStats>).map(([device, stats]) => `
              <div>
                <h3 style="color: #666;">${device.charAt(0).toUpperCase() + device.slice(1)}</h3>
                <ul style="list-style: none; padding: 0;">
                  <li>Sessions: ${stats.sessions}</li>
                  <li>Page Views: ${stats.pageViews}</li>
                  <li>Conversions: ${stats.conversions || 0}</li>
                </ul>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="color: #666; font-size: 0.9em; margin-top: 20px;">
          <p>This report was automatically generated by Solvify Analytics.</p>
          <p>To modify your email preferences, please visit your Analytics Dashboard settings.</p>
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

    // Send email with date range in subject
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER || 'kevin@solvify.se',
      to: recipients,
      subject: `${isTest ? '[TEST] ' : ''}${propertyName} - Analytics Report (${formatDateRange(dateRange)})`,
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