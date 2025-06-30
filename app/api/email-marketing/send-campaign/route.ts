import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient } from '@/lib/supabase-client';
import nodemailer from 'nodemailer';

// Rate limiting configuration
const RATE_LIMITS = {
  gmail: 100, // per hour
  sendgrid: 10000, // per hour
  mailgun: 5000, // per hour
  custom: 1000 // per hour
};

interface SendProgress {
  campaignId: string;
  total: number;
  sent: number;
  failed: number;
  bounced: number;
  status: 'sending' | 'completed' | 'failed' | 'paused';
  errors: string[];
}

// Email delivery service abstraction
class EmailDeliveryService {
  private transporter: nodemailer.Transporter | null = null;
  private provider: string = 'gmail';

  constructor(smtpConfig?: any) {
    if (smtpConfig && smtpConfig.host) {
      this.provider = smtpConfig.host.includes('gmail') ? 'gmail' : smtpConfig.name.toLowerCase();
      this.transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.port === 465,
        auth: {
          user: smtpConfig.username,
          pass: smtpConfig.password
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    } else {
      // No SMTP config found
      this.transporter = null;
      console.warn('No SMTP configuration found. Email sending will be disabled.');
    }
  }

  async sendEmail(to: string, subject: string, html: string, plain: string, from: string, replyTo?: string) {
    if (!this.transporter) {
      // Test mode - simulate email sending
      console.log('TEST MODE: Email would be sent to:', to);
      console.log('Subject:', subject);
      console.log('From:', from);
      return {
        messageId: 'test-message-id-' + Date.now(),
        response: 'Test mode - email simulated'
      };
    }

    const mailOptions = {
      from,
      to,
      subject,
      html,
      text: plain,
      replyTo: replyTo || from,
      headers: {
        'X-Campaign-Type': 'marketing',
        'List-Unsubscribe': `<mailto:unsubscribe@solvify.se?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    };

    return await this.transporter.sendMail(mailOptions);
  }

  getRateLimit(): number {
    return RATE_LIMITS[this.provider as keyof typeof RATE_LIMITS] || RATE_LIMITS.custom;
  }
}

// Progress tracking in memory (in production, use Redis)
const sendingProgress = new Map<string, SendProgress>();

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('=== CAMPAIGN SEND START ===');
    const { campaignId } = await request.json();
    console.log('Campaign ID:', campaignId);

    if (!campaignId) {
      console.log('ERROR: No campaign ID provided');
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    // Get campaign details
    console.log('=== FETCHING CAMPAIGN ===');
    const supabase = supabaseClient;
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    console.log('Campaign found:', !!campaign);
    console.log('Campaign error:', campaignError);
    console.log('Campaign status:', campaign?.status);

    if (campaignError || !campaign) {
      console.log('ERROR: Campaign not found or access denied');
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Allow resending campaigns in any status
    console.log('RESEND: Allowing campaign resend for status:', campaign.status);
    
    if (campaign.status === 'sending') {
      console.log('RETRY: Campaign already in sending status, allowing retry');
    } else if (campaign.status === 'sent') {
      console.log('RESEND: Resending completed campaign');
    } else if (campaign.status === 'failed') {
      console.log('RETRY: Retrying failed campaign');
    } else {
      console.log('SEND: Sending campaign for first time');
    }

    // Get workspace SMTP configuration
    const { data: smtpConfig, error: smtpError } = await supabase
      .from('smtp_configs')
      .select('*')
      .eq('workspace_id', campaign.workspace_id)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    console.log('=== SMTP CONFIG DEBUG ===');
    console.log('Campaign workspace_id:', campaign.workspace_id);
    console.log('SMTP Config found:', !!smtpConfig);
    console.log('SMTP Config:', smtpConfig);
    console.log('SMTP Error:', smtpError);

    // Check if SMTP config exists
    if (!smtpConfig) {
      console.log('ERROR: No SMTP config found for workspace:', campaign.workspace_id);
      return NextResponse.json({ 
        error: 'No SMTP configuration found. Please configure email server settings.' 
      }, { status: 400 });
    }

    // Initialize email service with SMTP config
    const emailService = new EmailDeliveryService(smtpConfig);

    // First get the subscription contact IDs
    const { data: subscriptionData, error: subError } = await supabase
      .from('list_subscriptions')
      .select('contact_id')
      .in('list_id', campaign.selected_lists)
      .eq('status', 'subscribed');

    console.log('Subscription data:', subscriptionData);
    console.log('Subscription error:', subError);

    if (subError || !subscriptionData?.length) {
      console.log('No subscriptions found');
      return NextResponse.json({ error: 'No subscriptions found' }, { status: 400 });
    }

    const contactIds = subscriptionData.map(sub => sub.contact_id);
    console.log('Contact IDs from subscriptions:', contactIds);

    // Now get the actual contacts
    const { data: subscriptions, error: contactsError } = await supabase
      .from('email_contacts')
      .select('id, email, first_name, last_name, status')
      .in('id', contactIds)
      .eq('status', 'active');

    console.log('=== CONTACTS DEBUG ===');
    console.log('Selected lists:', campaign.selected_lists);
    console.log('Contacts Query Result:', { subscriptions, contactsError });
    console.log('Contact count:', subscriptions?.length || 0);

    if (contactsError || !subscriptions?.length) {
      console.log('No contacts found:', contactsError);
      return NextResponse.json({ error: 'No active contacts found' }, { status: 400 });
    }

    // Contacts are now directly returned from email_contacts table
    const actualContacts = subscriptions || [];

    // Initialize progress tracking
    const progress: SendProgress = {
      campaignId,
      total: actualContacts.length,
      sent: 0,
      failed: 0,
      bounced: 0,
      status: 'sending',
      errors: []
    };
    sendingProgress.set(campaignId, progress);

    // Update campaign status and reset counters for resend
    await supabase
      .from('email_campaigns')
      .update({
        status: 'sending',
        sent_at: new Date().toISOString(),
        total_recipients: actualContacts.length,
        // Reset counters for fresh resend
        sent_count: 0,
        delivered_count: 0,
        opened_count: 0,
        clicked_count: 0,
        bounced_count: 0,
        failed_count: 0,
        error_message: null
      })
      .eq('id', campaignId);

    // Start sending emails (non-blocking)
    sendEmailsAsync(campaignId, campaign, actualContacts, emailService, user.id);

    return NextResponse.json({
      success: true,
      message: 'Campaign sending started',
      progress: {
        total: actualContacts.length,
        sent: 0,
        status: 'sending'
      }
    });

  } catch (error) {
    console.error('=== CAMPAIGN SEND ERROR ===');
    console.error('Error starting campaign send:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return NextResponse.json(
      { error: 'Failed to start campaign sending' },
      { status: 500 }
    );
  }
}

// Get sending progress
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaignId');

  if (!campaignId) {
    return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
  }

  const progress = sendingProgress.get(campaignId);
  if (!progress) {
    return NextResponse.json({ error: 'Progress not found' }, { status: 404 });
  }

  return NextResponse.json(progress);
}

// Async email sending function
async function sendEmailsAsync(
  campaignId: string,
  campaign: any,
  contacts: any[],
  emailService: EmailDeliveryService,
  userId: string
) {
  console.log(`[EMAIL SEND] Starting email sending for campaign ${campaignId} to ${contacts.length} contacts`);
  
  const progress = sendingProgress.get(campaignId)!;
  const rateLimit = emailService.getRateLimit();
  const delayBetweenEmails = Math.ceil(3600000 / rateLimit); // milliseconds between emails

  try {
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      console.log(`[EMAIL SEND] Processing contact ${i + 1}/${contacts.length}: ${contact.email}`);

      try {
        // Personalize email content
        const personalizedHtml = personalizeContent(campaign.html_content, contact);
        const personalizedPlain = personalizeContent(campaign.plain_content || '', contact);
        const personalizedSubject = personalizeContent(campaign.subject, contact);

        // Add tracking pixels
        const trackingPixel = `<img src="${process.env.NEXT_PUBLIC_SITE_URL}/api/email-marketing/track/open/${campaignId}/${contact.id}" width="1" height="1" style="display:none;" />`;
        const htmlWithTracking = personalizedHtml + trackingPixel;

        // Add click tracking to links
        const htmlWithClickTracking = addClickTracking(htmlWithTracking, campaignId, contact.id);

        // Send email
        console.log(`[EMAIL SEND] Sending email to ${contact.email}`);
        const result = await emailService.sendEmail(
          contact.email,
          personalizedSubject,
          htmlWithClickTracking,
          personalizedPlain,
          `${campaign.from_name} <${campaign.from_email}>`,
          campaign.reply_to
        );
        console.log(`[EMAIL SEND] Email sent successfully to ${contact.email}:`, result.messageId);

        // Update progress
        progress.sent++;
        
        // Log successful send
        const supabase = supabaseClient;
        await supabase
          .from('email_campaign_sends')
          .insert({
            campaign_id: campaignId,
            contact_id: contact.id,
            email: contact.email,
            status: 'sent',
            sent_at: new Date().toISOString()
          });

        console.log(`[EMAIL SEND] Progress: ${progress.sent}/${progress.total} sent`);

        // Rate limiting delay
        if (i < contacts.length - 1) {
          console.log(`[EMAIL SEND] Waiting ${delayBetweenEmails}ms before next email`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
        }

      } catch (emailError: any) {
        console.error(`[EMAIL SEND] Failed to send email to ${contact.email}:`, emailError);
        progress.failed++;
        progress.errors.push(`${contact.email}: ${emailError.message}`);

        // Log failed send
        const supabase = supabaseClient;
        await supabase
          .from('email_campaign_sends')
          .insert({
            campaign_id: campaignId,
            contact_id: contact.id,
            email: contact.email,
            status: 'failed',
            error_message: emailError.message,
            sent_at: new Date().toISOString()
          });
      }

      // Update progress in database every 10 emails
      if (i % 10 === 0 || i === contacts.length - 1) {
        console.log(`[EMAIL SEND] Updating campaign progress in database`);
        await supabase
          .from('email_campaigns')
          .update({
            sent_count: progress.sent,
            failed_count: progress.failed
          })
          .eq('id', campaignId);
      }
    }

    // Mark campaign as completed
    progress.status = 'completed';
    await supabase
      .from('email_campaigns')
      .update({
        status: 'sent',
        sent_count: progress.sent,
        failed_count: progress.failed,
        completed_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    console.log(`Campaign ${campaignId} completed: ${progress.sent} sent, ${progress.failed} failed`);

  } catch (error) {
    console.error(`Campaign ${campaignId} failed:`, error);
    progress.status = 'failed';
    
    const supabase = supabaseClient;
    await supabase
      .from('email_campaigns')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', campaignId);
  } finally {
    // Clean up progress after 1 hour
    setTimeout(() => {
      sendingProgress.delete(campaignId);
    }, 3600000);
  }
}

// Personalize content with contact data
function personalizeContent(content: string, contact: any): string {
  if (!content) return '';
  
  return content
    .replace(/\{\{first_name\}\}/g, contact.first_name || 'Friend')
    .replace(/\{\{last_name\}\}/g, contact.last_name || '')
    .replace(/\{\{email\}\}/g, contact.email || '')
    .replace(/\{\{company\}\}/g, contact.company || '')
    .replace(/\{\{full_name\}\}/g, `${contact.first_name || ''} ${contact.last_name || ''}`.trim())
    .replace(/\{\{company_name\}\}/g, 'Solvify')
    .replace(/\{\{year\}\}/g, new Date().getFullYear().toString())
    .replace(/\{\{unsubscribe_url\}\}/g, `${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe/${contact.id}`)
    .replace(/\{\{preferences_url\}\}/g, `${process.env.NEXT_PUBLIC_SITE_URL}/preferences/${contact.id}`);
}

// Add click tracking to all links
function addClickTracking(html: string, campaignId: string, contactId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return html.replace(
    /href="([^"]+)"/g,
    `href="${baseUrl}/api/email-marketing/track/click/${campaignId}/${contactId}?url=$1"`
  );
} 