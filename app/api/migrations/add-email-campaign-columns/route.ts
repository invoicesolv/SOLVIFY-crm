import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient as supabase } from '@/lib/supabase-client';

export async function GET() {
  try {
    console.log('Starting email campaigns table migration...');

    // Add missing columns to email_campaigns table
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add schedule_type column
        ALTER TABLE public.email_campaigns 
        ADD COLUMN IF NOT EXISTS schedule_type TEXT DEFAULT 'now' CHECK (schedule_type IN ('now', 'scheduled'));
        
        -- Add scheduled_at column  
        ALTER TABLE public.email_campaigns 
        ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
        
        -- Add reply_to column if missing
        ALTER TABLE public.email_campaigns 
        ADD COLUMN IF NOT EXISTS reply_to TEXT;
        
        -- Add plain_content column if missing
        ALTER TABLE public.email_campaigns 
        ADD COLUMN IF NOT EXISTS plain_content TEXT;
        
        -- Add template_id column if missing
        ALTER TABLE public.email_campaigns 
        ADD COLUMN IF NOT EXISTS template_id UUID;
        
        -- Add selected_lists column if missing (storing as JSON array)
        ALTER TABLE public.email_campaigns 
        ADD COLUMN IF NOT EXISTS selected_lists JSONB DEFAULT '[]'::jsonb;
        
        -- Add error_message column for failed campaigns
        ALTER TABLE public.email_campaigns 
        ADD COLUMN IF NOT EXISTS error_message TEXT;
        
        -- Add completed_at column
        ALTER TABLE public.email_campaigns 
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
        
        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS email_campaigns_schedule_type_idx ON public.email_campaigns(schedule_type);
        CREATE INDEX IF NOT EXISTS email_campaigns_scheduled_at_idx ON public.email_campaigns(scheduled_at);
        CREATE INDEX IF NOT EXISTS email_campaigns_status_idx ON public.email_campaigns(status);
      `
    });

    if (alterError) {
      console.error('Migration error:', alterError);
      throw alterError;
    }

    console.log('Email campaigns table migration completed successfully');

    return NextResponse.json({ 
      success: true, 
      message: 'Email campaigns table migration completed successfully'
    });

  } catch (error) {
    console.error('Migration failed:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error },
      { status: 500 }
    );
  }
} 