import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    
    // Test basic integrations table access
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId);

    if (integrationsError) {
      console.error('Integrations query error:', integrationsError);
      return NextResponse.json({ 
        error: 'Failed to query integrations', 
        details: integrationsError 
      }, { status: 500 });
    }

    // Test YouTube-specific query
    const { data: youtubeIntegration, error: youtubeError } = await supabase
      .from('integrations')
      .select('service_name')
      .eq('user_id', userId)
      .eq('service_name', 'youtube')
      .maybeSingle();

    return NextResponse.json({
      status: 'success',
      userId,
      integrations: integrations || [],
      youtubeIntegration: youtubeIntegration || null,
      youtubeError: youtubeError || null,
      message: 'Integrations table access working correctly'
    });

  } catch (error: any) {
    console.error('API route error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 });
  }
} 