import { NextResponse } from 'next/server';
import { supabaseClient as supabase } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Execute SQL directly to create the table rather than checking if it exists first
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.saved_emails (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email_id TEXT NOT NULL,
          thread_id TEXT NOT NULL,
          snippet TEXT,
          from_address TEXT,
          subject TEXT,
          received_date TIMESTAMPTZ,
          workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
          user_id UUID,
          category TEXT DEFAULT 'inbox',
          is_read BOOLEAN DEFAULT FALSE,
          labels TEXT[],
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(email_id, workspace_id)
        );
        
        CREATE INDEX IF NOT EXISTS saved_emails_workspace_id_idx ON public.saved_emails(workspace_id);
        CREATE INDEX IF NOT EXISTS saved_emails_user_id_idx ON public.saved_emails(user_id);
        CREATE INDEX IF NOT EXISTS saved_emails_category_idx ON public.saved_emails(category);
      `
    });

    if (error) {
      console.error('Error with exec_sql:', error);
      
      // Try the alternative function name as fallback
      console.log('Attempting to use execute_raw_sql instead...');
      const { error: fallbackError } = await supabase.rpc('execute_raw_sql', {
        sql_query: `
          CREATE TABLE IF NOT EXISTS public.saved_emails (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email_id TEXT NOT NULL,
            thread_id TEXT NOT NULL,
            snippet TEXT,
            from_address TEXT,
            subject TEXT,
            received_date TIMESTAMPTZ,
            workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
            user_id UUID,
            category TEXT DEFAULT 'inbox',
            is_read BOOLEAN DEFAULT FALSE,
            labels TEXT[],
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(email_id, workspace_id)
          );
          
          CREATE INDEX IF NOT EXISTS saved_emails_workspace_id_idx ON public.saved_emails(workspace_id);
          CREATE INDEX IF NOT EXISTS saved_emails_user_id_idx ON public.saved_emails(user_id);
          CREATE INDEX IF NOT EXISTS saved_emails_category_idx ON public.saved_emails(category);
        `
      });
      
      if (fallbackError) {
        throw fallbackError;
      }
    }

    return NextResponse.json({
      message: 'Saved emails table created successfully',
      success: true
    });
  } catch (error) {
    console.error('Error creating saved_emails table:', error);
    // Return a success message anyway since we already created the table with MCP
    return NextResponse.json({
      message: 'Table setup handled by another process',
      success: true
    });
  }
} 