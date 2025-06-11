import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { supabase } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import authOptions from "@/lib/auth";

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

export async function POST(request: NextRequest) {
  try {
    const { siteUrl, recipients, searchData, isTest, dateRange } = await request.json();
    console.log('Sending search console report:', { siteUrl, recipients, isTest, dateRange });

    // Check for CRON authorization (from cron jobs) first
    const authHeader = request.headers.get('Authorization');
    const isCronAuth = authHeader && authHeader.startsWith('Bearer ') && 
                        authHeader.substring(7) === (process.env.CRON_SECRET || 'development');
    
    // Only require authentication for non-test emails and when not authorized via cron secret
    if (!isTest && !isCronAuth) {
      const session = await getServerSession(authOptions);
      const userId = session?.user?.id;

      if (!userId) {
        return NextResponse.json(
          { error: 'User not authenticated' },
          { status: 401 }
        );
      }
    }

    if (!siteUrl || !recipients || !searchData) {
      console.error('Missing required fields:', { siteUrl, recipients, hasSearchData: !!searchData });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Format date range for email subject
    const formatDateRange = (dateRange: string) => {
      switch (dateRange) {
        case '7days':
          return 'Last 7 Days';
        case '14days':
          return 'Last 14 Days';
        case '28days':
          return 'Last 28 Days';
        case '30days':
          return 'Last 30 Days';
        default:
          return 'Last Period';
      }
    };

    // Create email content with a professional template
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333;">${siteUrl} - Search Console Report</h1>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #444;">Overview</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
            <div>
              <h3 style="color: #666;">Performance Metrics</h3>
              <ul style="list-style: none; padding: 0;">
                <li>Total Clicks: ${searchData.overview.clicks}</li>
                <li>Total Impressions: ${searchData.overview.impressions}</li>
                <li>Average CTR: ${searchData.overview.ctr.toFixed(2)}%</li>
                <li>Average Position: ${searchData.overview.position.toFixed(1)}</li>
              </ul>
            </div>
          </div>
        </div>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #444;">Top Search Queries</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background: #eee;">
                <th style="padding: 10px; text-align: left;">Query</th>
                <th style="padding: 10px; text-align: right;">Clicks</th>
                <th style="padding: 10px; text-align: right;">Impressions</th>
                <th style="padding: 10px; text-align: right;">CTR</th>
                <th style="padding: 10px; text-align: right;">Position</th>
              </tr>
            </thead>
            <tbody>
              ${searchData.topQueries.map((query: any) => `
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 10px;">${query.query}</td>
                  <td style="padding: 10px; text-align: right;">${query.clicks}</td>
                  <td style="padding: 10px; text-align: right;">${query.impressions}</td>
                  <td style="padding: 10px; text-align: right;">${query.ctr}</td>
                  <td style="padding: 10px; text-align: right;">${query.position}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${searchData.keywords ? `
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #444;">Keyword Rankings</h2>
            <div style="margin-bottom: 20px;">
              <h3 style="color: #666;">Overview</h3>
              <ul style="list-style: none; padding: 0;">
                <li>Keywords in Top 3: ${searchData.keywords.metrics.top3}</li>
                <li>Keywords in Top 10: ${searchData.keywords.metrics.top10}</li>
                <li>Total Keywords: ${searchData.keywords.metrics.top100}</li>
              </ul>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #eee;">
                  <th style="padding: 10px; text-align: left;">Keyword</th>
                  <th style="padding: 10px; text-align: right;">Position</th>
                  <th style="padding: 10px; text-align: right;">Clicks</th>
                  <th style="padding: 10px; text-align: right;">CTR</th>
                </tr>
              </thead>
              <tbody>
                ${searchData.keywords.keywords.map((keyword: any) => `
                  <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px;">${keyword.keyword}</td>
                    <td style="padding: 10px; text-align: right;">${keyword.position}</td>
                    <td style="padding: 10px; text-align: right;">${keyword.clicks}</td>
                    <td style="padding: 10px; text-align: right;">${keyword.ctr}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${searchData.backlinks ? `
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #444;">Backlinks Overview</h2>
            <div style="margin-bottom: 20px;">
              <h3 style="color: #666;">Metrics</h3>
              <ul style="list-style: none; padding: 0;">
                <li>Total Backlinks: ${searchData.backlinks.totalBacklinks}</li>
                <li>Dofollow Links: ${searchData.backlinks.metrics.dofollow}</li>
                <li>Nofollow Links: ${searchData.backlinks.metrics.nofollow}</li>
                <li>New Backlinks: ${searchData.backlinks.metrics.newBacklinks}</li>
                <li>Lost Backlinks: ${searchData.backlinks.metrics.lostBacklinks}</li>
              </ul>
            </div>
          </div>
        ` : ''}

        <div style="color: #666; font-size: 0.9em; margin-top: 20px;">
          <p>This report was automatically generated by Solvify Search Console.</p>
          <p>To modify your email preferences, please visit your Search Console Dashboard settings.</p>
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
      to: recipients,
      subject: `${isTest ? '[TEST] ' : ''}${siteUrl} - Search Console Report (${formatDateRange(dateRange)})`,
      html,
    });

    console.log('Email sent successfully:', info);
    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: Error | unknown) {
    console.error('Detailed error sending search console report:', {
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