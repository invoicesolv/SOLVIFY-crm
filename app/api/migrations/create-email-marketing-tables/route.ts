import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('Setting up email marketing database tables...');

    // Create all email marketing tables
    const { error: createError } = await supabaseAdmin.rpc('execute_raw_sql', {
      sql: `
        -- Create email_campaigns table
        CREATE TABLE IF NOT EXISTS public.email_campaigns (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          name TEXT NOT NULL,
          subject TEXT NOT NULL,
          from_name TEXT NOT NULL,
          from_email TEXT NOT NULL,
          reply_to TEXT,
          html_content TEXT NOT NULL,
          plain_content TEXT,
          template_id UUID,
          selected_lists JSONB DEFAULT '[]'::jsonb,
          status TEXT DEFAULT 'draft',
          schedule_type TEXT DEFAULT 'now',
          scheduled_at TIMESTAMPTZ,
          total_recipients INTEGER DEFAULT 0,
          sent_count INTEGER DEFAULT 0,
          delivered_count INTEGER DEFAULT 0,
          opened_count INTEGER DEFAULT 0,
          clicked_count INTEGER DEFAULT 0,
          bounced_count INTEGER DEFAULT 0,
          failed_count INTEGER DEFAULT 0,
          error_message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          sent_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ
        );

        -- Create email_contacts table
        CREATE TABLE IF NOT EXISTS public.email_contacts (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          first_name TEXT,
          last_name TEXT,
          phone TEXT,
          company TEXT,
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
          source TEXT DEFAULT 'manual',
          custom_fields JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT unique_email_per_workspace UNIQUE (workspace_id, email)
        );

        -- Create email_lists table
        CREATE TABLE IF NOT EXISTS public.email_lists (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          total_contacts INTEGER DEFAULT 0,
          active_contacts INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create list_subscriptions table
        CREATE TABLE IF NOT EXISTS public.list_subscriptions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          list_id UUID REFERENCES public.email_lists(id) ON DELETE CASCADE,
          contact_id UUID REFERENCES public.email_contacts(id) ON DELETE CASCADE,
          status TEXT DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
          subscribed_at TIMESTAMPTZ DEFAULT NOW(),
          unsubscribed_at TIMESTAMPTZ,
          CONSTRAINT unique_list_contact UNIQUE (list_id, contact_id)
        );

        -- Create email_campaign_sends table for tracking individual sends
        CREATE TABLE IF NOT EXISTS public.email_campaign_sends (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
          contact_id UUID,
          email TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
          error_message TEXT,
          sent_at TIMESTAMPTZ DEFAULT NOW(),
          delivered_at TIMESTAMPTZ,
          opened_at TIMESTAMPTZ,
          clicked_at TIMESTAMPTZ
        );

        -- Create email_campaign_opens table for tracking opens
        CREATE TABLE IF NOT EXISTS public.email_campaign_opens (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
          contact_id UUID,
          opened_at TIMESTAMPTZ DEFAULT NOW(),
          user_agent TEXT,
          ip_address INET
        );

        -- Create email_campaign_clicks table for tracking clicks
        CREATE TABLE IF NOT EXISTS public.email_campaign_clicks (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
          contact_id UUID,
          url TEXT NOT NULL,
          clicked_at TIMESTAMPTZ DEFAULT NOW(),
          user_agent TEXT,
          ip_address INET
        );

        -- Create smtp_configs table for email sending configuration
        CREATE TABLE IF NOT EXISTS public.smtp_configs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          host TEXT NOT NULL,
          port INTEGER NOT NULL DEFAULT 587,
          username TEXT NOT NULL,
          password TEXT NOT NULL,
          is_default BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS email_campaigns_workspace_id_idx ON public.email_campaigns(workspace_id);
        CREATE INDEX IF NOT EXISTS email_campaigns_user_id_idx ON public.email_campaigns(user_id);
        CREATE INDEX IF NOT EXISTS email_campaigns_status_idx ON public.email_campaigns(status);
        CREATE INDEX IF NOT EXISTS email_campaigns_schedule_type_idx ON public.email_campaigns(schedule_type);
        CREATE INDEX IF NOT EXISTS email_campaigns_scheduled_at_idx ON public.email_campaigns(scheduled_at);

        CREATE INDEX IF NOT EXISTS email_contacts_workspace_id_idx ON public.email_contacts(workspace_id);
        CREATE INDEX IF NOT EXISTS email_contacts_email_idx ON public.email_contacts(email);
        CREATE INDEX IF NOT EXISTS email_contacts_status_idx ON public.email_contacts(status);

        CREATE INDEX IF NOT EXISTS email_lists_workspace_id_idx ON public.email_lists(workspace_id);
        CREATE INDEX IF NOT EXISTS email_lists_user_id_idx ON public.email_lists(user_id);

        CREATE INDEX IF NOT EXISTS list_subscriptions_list_id_idx ON public.list_subscriptions(list_id);
        CREATE INDEX IF NOT EXISTS list_subscriptions_contact_id_idx ON public.list_subscriptions(contact_id);
        CREATE INDEX IF NOT EXISTS list_subscriptions_status_idx ON public.list_subscriptions(status);

        CREATE INDEX IF NOT EXISTS email_campaign_sends_campaign_id_idx ON public.email_campaign_sends(campaign_id);
        CREATE INDEX IF NOT EXISTS email_campaign_sends_status_idx ON public.email_campaign_sends(status);

        CREATE INDEX IF NOT EXISTS email_campaign_opens_campaign_id_idx ON public.email_campaign_opens(campaign_id);
        CREATE INDEX IF NOT EXISTS email_campaign_opens_opened_at_idx ON public.email_campaign_opens(opened_at);

        CREATE INDEX IF NOT EXISTS email_campaign_clicks_campaign_id_idx ON public.email_campaign_clicks(campaign_id);
        CREATE INDEX IF NOT EXISTS email_campaign_clicks_clicked_at_idx ON public.email_campaign_clicks(clicked_at);

        CREATE INDEX IF NOT EXISTS smtp_configs_workspace_id_idx ON public.smtp_configs(workspace_id);
        CREATE INDEX IF NOT EXISTS smtp_configs_is_default_idx ON public.smtp_configs(is_default);
        CREATE INDEX IF NOT EXISTS smtp_configs_is_active_idx ON public.smtp_configs(is_active);
      `
    });

    if (createError) {
      console.error('Database setup error:', createError);
      throw createError;
    }

    console.log('Email marketing database tables setup completed successfully');

    return NextResponse.json({ 
      success: true, 
      message: 'Email marketing database tables setup completed successfully',
      tables: [
        'email_campaigns',
        'email_contacts', 
        'email_lists',
        'list_subscriptions',
        'email_campaign_sends',
        'email_campaign_opens',
        'email_campaign_clicks',
        'smtp_configs'
      ]
    });

  } catch (error) {
    console.error('Database setup failed:', error);
    return NextResponse.json(
      { error: 'Database setup failed', details: error },
      { status: 500 }
    );
  }
} 