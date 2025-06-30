import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient } from '@/lib/supabase-client';
import { getActiveWorkspaceId } from '@/lib/permission';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// GET - Fetch a specific template by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getActiveWorkspaceId(user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const templateId = params.id;
    console.log('[Template API] Fetching template:', templateId);

    const { data, error } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error) {
      console.error('[Template API] Error fetching template:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
    }

    // Replace placeholder URLs with actual logos
    let htmlContent = data.html_content;

    // Get workspace logos to replace placeholders
    const { data: workspaceLogos } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      .from('workspace_logos')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (workspaceLogos && workspaceLogos.length > 0) {
      const logo = workspaceLogos[0];
      const borderRadiusStyle = logo.border_radius ? `border-radius: ${logo.border_radius}px; ` : '';
      const logoHtml = `<img src="${logo.url}" alt="${logo.name || 'Company Logo'}" style="max-width: 200px; height: auto; display: block; margin: 0 auto; ${borderRadiusStyle}border: 1px solid #e5e7eb;">`;
      
      // Replace placeholder URLs and other logo placeholders
      const replacementPatterns = [
        /https:\/\/via\.placeholder\.com\/[^"'\s]+/gi,
        /\{\{company_initial\}\}/gi,
        /\{\{company_logo\}\}/gi,
        /\{\{logo\}\}/gi,
        /\{\{brand_logo\}\}/gi,
      ];

      for (const pattern of replacementPatterns) {
        if (pattern.test(htmlContent)) {
          htmlContent = htmlContent.replace(pattern, logoHtml);
        }
      }
    }

    return NextResponse.json({ template: { ...data, html_content: htmlContent } });

  } catch (error) {
    console.error('[Template API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getActiveWorkspaceId(user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const templateId = params.id;
    const templateData = await request.json();

    // Validate required fields
    if (!templateData.name?.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }
    if (!templateData.subject?.trim()) {
      return NextResponse.json({ error: 'Subject line is required' }, { status: 400 });
    }
    if (!templateData.html_content?.trim()) {
      return NextResponse.json({ error: 'Email content is required' }, { status: 400 });
    }

    console.log('[Template API] Updating template:', templateId);

    // Get workspace logos to automatically replace placeholders
    const { data: workspaceLogos } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      .from('workspace_logos')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1);

    let htmlContent = templateData.html_content;

    // If workspace has logos, automatically replace logo placeholders with the most recent one
    if (workspaceLogos && workspaceLogos.length > 0) {
      const logo = workspaceLogos[0];
      const borderRadiusStyle = logo.border_radius ? `border-radius: ${logo.border_radius}px; ` : '';
      const logoHtml = `<img src="${logo.url}" alt="${logo.name || 'Company Logo'}" style="max-width: 200px; height: auto; display: block; margin: 0 auto; ${borderRadiusStyle}border: 1px solid #e5e7eb;">`;
      
      // Replace common logo placeholders
      const replacementPatterns = [
        /\{\{company_initial\}\}/gi,
        /\{\{company_logo\}\}/gi,
        /\{\{logo\}\}/gi,
        /\{\{brand_logo\}\}/gi,
        // Also replace any placeholder image URLs
        /https:\/\/via\.placeholder\.com\/[^"'\s]+/gi,
      ];

      // Special handling for company_initial in styled divs
      const companyInitialDivPattern = /<div[^>]*style="[^"]*"[^>]*>([^<]*\{\{company_initial\}\}[^<]*)<\/div>/gi;
      if (companyInitialDivPattern.test(htmlContent)) {
        htmlContent = htmlContent.replace(companyInitialDivPattern, `<div style="text-align: center; padding: 8px;">${logoHtml}</div>`);
      } else {
        // Try other patterns
        for (const pattern of replacementPatterns) {
          if (pattern.test(htmlContent)) {
            htmlContent = htmlContent.replace(pattern, logoHtml);
            break;
          }
        }
      }
    }

    const { data, error } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      .from('email_templates')
      .update({
        name: templateData.name.trim(),
        subject: templateData.subject.trim(),
        html_content: htmlContent,
        plain_content: templateData.plain_content || '',
        template_type: templateData.template_type || 'email',
        category: templateData.category || 'Other',
        is_active: templateData.is_active !== undefined ? templateData.is_active : true,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      console.error('[Template API] Error updating template:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }

    console.log('[Template API] Template updated successfully:', data.id);
    return NextResponse.json({ template: data });

  } catch (error) {
    console.error('[Template API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getActiveWorkspaceId(user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const templateId = params.id;
    console.log('[Template API] Deleting template:', templateId);

    const { error } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      .from('email_templates')
      .delete()
      .eq('id', templateId)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('[Template API] Error deleting template:', error);
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    console.log('[Template API] Template deleted successfully:', templateId);
    return NextResponse.json({ message: 'Template deleted successfully' });

  } catch (error) {
    console.error('[Template API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 