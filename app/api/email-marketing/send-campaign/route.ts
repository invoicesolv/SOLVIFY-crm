import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
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
    if (smtpConfig) {
      this.provider = smtpConfig.name.toLowerCase();
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
      // Default to Gmail
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER || 'noreply@solvify.se',
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });
    }
  }

  async sendEmail(to: string, subject: string, html: string, plain: string, from: string, replyTo?: string) {
    if (!this.transporter) {
      throw new Error('Email transporter not configured');
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaignId } = await request.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', session.user.id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      return NextResponse.json({ error: 'Campaign cannot be sent in current status' }, { status: 400 });
    }

    // Get workspace SMTP configuration
    const { data: smtpConfig } = await supabase
      .from('smtp_configs')
      .select('*')
      .eq('workspace_id', campaign.workspace_id)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    // Initialize email service
    const emailService = new EmailDeliveryService(smtpConfig);

    // Get contacts from selected lists
    const { data: contacts, error: contactsError } = await supabase
      .from('email_contacts')
      .select('*')
      .in('list_id', campaign.selected_lists)
      .eq('status', 'active')
      .neq('unsubscribed', true);

    if (contactsError || !contacts?.length) {
      return NextResponse.json({ error: 'No active contacts found' }, { status: 400 });
    }

    // Initialize progress tracking
    const progress: SendProgress = {
      campaignId,
      total: contacts.length,
      sent: 0,
      failed: 0,
      bounced: 0,
      status: 'sending',
      errors: []
    };
    sendingProgress.set(campaignId, progress);

    // Update campaign status
    await supabase
      .from('email_campaigns')
      .update({
        status: 'sending',
        sent_at: new Date().toISOString(),
        total_recipients: contacts.length
      })
      .eq('id', campaignId);

    // Start sending emails (non-blocking)
    sendEmailsAsync(campaignId, campaign, contacts, emailService, session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Campaign sending started',
      progress: {
        total: contacts.length,
        sent: 0,
        status: 'sending'
      }
    });

  } catch (error) {
    console.error('Error starting campaign send:', error);
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
  const progress = sendingProgress.get(campaignId)!;
  const rateLimit = emailService.getRateLimit();
  const delayBetweenEmails = Math.ceil(3600000 / rateLimit); // milliseconds between emails

  try {
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      try {
        // Personalize email content
        const personalizedHtml = personalizeContent(campaign.html_content, contact);
        const personalizedPlain = personalizeContent(campaign.plain_content, contact);
        const personalizedSubject = personalizeContent(campaign.subject, contact);

        // Add tracking pixels
        const trackingPixel = `<img src="${process.env.NEXTAUTH_URL}/api/email-marketing/track/open/${campaignId}/${contact.id}" width="1" height="1" style="display:none;" />`;
        const htmlWithTracking = personalizedHtml + trackingPixel;

        // Add click tracking to links
        const htmlWithClickTracking = addClickTracking(htmlWithTracking, campaignId, contact.id);

        // Send email
        await emailService.sendEmail(
          contact.email,
          personalizedSubject,
          htmlWithClickTracking,
          personalizedPlain,
          `${campaign.from_name} <${campaign.from_email}>`,
          campaign.reply_to
        );

        // Update progress
        progress.sent++;
        
        // Log successful send
        await supabase
          .from('email_campaign_sends')
          .insert({
            campaign_id: campaignId,
            contact_id: contact.id,
            email: contact.email,
            status: 'sent',
            sent_at: new Date().toISOString()
          });

        // Rate limiting delay
        if (i < contacts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
        }

      } catch (emailError: any) {
        console.error(`Failed to send email to ${contact.email}:`, emailError);
        progress.failed++;
        progress.errors.push(`${contact.email}: ${emailError.message}`);

        // Log failed send
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
    .replace(/\{\{unsubscribe_url\}\}/g, `${process.env.NEXTAUTH_URL}/unsubscribe/${contact.id}`)
    .replace(/\{\{preferences_url\}\}/g, `${process.env.NEXTAUTH_URL}/preferences/${contact.id}`);
}

// Add click tracking to all links
function addClickTracking(html: string, campaignId: string, contactId: string): string {
  const baseUrl = process.env.NEXTAUTH_URL;
  return html.replace(
    /href="([^"]+)"/g,
    `href="${baseUrl}/api/email-marketing/track/click/${campaignId}/${contactId}?url=$1"`
  );
} 