import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('Creating email campaigns table...');

    // Create the email_campaigns table if it doesn't exist
    const { error: createError } = await supabaseAdmin.rpc('exec_raw_sql', {
      query: `
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
      `
    });

    if (createError) {
      console.error('Table creation error:', createError);
      // Try alternative approach - direct SQL execution
      try {
        await supabaseAdmin
          .from('email_campaigns')
          .select('id')
          .limit(1);
        console.log('Table already exists, trying to add missing columns...');
        
        // Add missing columns if table exists but columns are missing
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
        const alterResult = await fetch(`${baseUrl}/api/migrations/add-email-campaign-columns`);
        const alterData = await alterResult.json();
        
        return NextResponse.json({ 
          success: true, 
          message: 'Email campaigns table updated with missing columns',
          details: alterData
        });
        
      } catch (tableError) {
        console.log('Table doesn\'t exist, creating manually...');
        
        // Table doesn't exist, create it manually using SQL
        return NextResponse.json({
          success: false,
          error: 'Please create the email_campaigns table manually in Supabase SQL Editor',
          sql: `
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
          `
        });
      }
    }

    console.log('Email campaigns table created successfully');

    return NextResponse.json({ 
      success: true, 
      message: 'Email campaigns table created successfully'
    });

  } catch (error) {
    console.error('Table creation failed:', error);
    return NextResponse.json(
      { error: 'Table creation failed', details: error },
      { status: 500 }
    );
  }
} 