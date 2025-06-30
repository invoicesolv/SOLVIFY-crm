import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('Creating email_templates table...');

    // Create the email_templates table if it doesn't exist
    const { error: createError } = await supabaseAdmin.rpc('execute_raw_sql', {
      sql: `
        -- Create email_templates table
        CREATE TABLE IF NOT EXISTS public.email_templates (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          name TEXT NOT NULL,
          subject TEXT NOT NULL,
          html_content TEXT NOT NULL,
          plain_content TEXT,
          template_type TEXT DEFAULT 'email' CHECK (template_type IN ('email', 'newsletter', 'promotional', 'transactional')),
          category TEXT DEFAULT 'Other',
          thumbnail_url TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS email_templates_workspace_id_idx ON public.email_templates(workspace_id);
        CREATE INDEX IF NOT EXISTS email_templates_user_id_idx ON public.email_templates(user_id);
        CREATE INDEX IF NOT EXISTS email_templates_template_type_idx ON public.email_templates(template_type);
        CREATE INDEX IF NOT EXISTS email_templates_category_idx ON public.email_templates(category);
        CREATE INDEX IF NOT EXISTS email_templates_is_active_idx ON public.email_templates(is_active);
        CREATE INDEX IF NOT EXISTS email_templates_created_at_idx ON public.email_templates(created_at);
        CREATE INDEX IF NOT EXISTS email_templates_updated_at_idx ON public.email_templates(updated_at);
      `
    });

    if (createError) {
      console.error('Table creation error:', createError);
      
      // Fallback: Try to create the table step by step
      try {
        await supabaseAdmin
          .from('email_templates')
          .select('id')
          .limit(1);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Email templates table already exists'
        });
        
      } catch (tableError) {
        console.log('Table doesn\'t exist, providing manual SQL...');
        
        return NextResponse.json({
          success: false,
          error: 'Please create the email_templates table manually in Supabase SQL Editor',
          sql: `
-- Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  plain_content TEXT,
  template_type TEXT DEFAULT 'email' CHECK (template_type IN ('email', 'newsletter', 'promotional', 'transactional')),
  category TEXT DEFAULT 'Other',
  thumbnail_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS email_templates_workspace_id_idx ON public.email_templates(workspace_id);
CREATE INDEX IF NOT EXISTS email_templates_user_id_idx ON public.email_templates(user_id);
CREATE INDEX IF NOT EXISTS email_templates_template_type_idx ON public.email_templates(template_type);
CREATE INDEX IF NOT EXISTS email_templates_category_idx ON public.email_templates(category);
CREATE INDEX IF NOT EXISTS email_templates_is_active_idx ON public.email_templates(is_active);
CREATE INDEX IF NOT EXISTS email_templates_created_at_idx ON public.email_templates(created_at);
CREATE INDEX IF NOT EXISTS email_templates_updated_at_idx ON public.email_templates(updated_at);
          `
        });
      }
    }

    console.log('Email templates table created successfully');
    return NextResponse.json({ 
      success: true, 
      message: 'Email templates table created successfully' 
    });

  } catch (error) {
    console.error('Email templates table creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create email templates table', details: error },
      { status: 500 }
    );
  }
} 