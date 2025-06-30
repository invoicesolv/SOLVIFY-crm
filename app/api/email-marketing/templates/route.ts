import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient } from '@/lib/supabase-client';
import { getActiveWorkspaceId } from '@/lib/permission';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// GET - Fetch all templates for the user's workspace
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getActiveWorkspaceId(user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    console.log('[Templates API] Fetching templates for workspace:', workspaceId);

    const { data, error } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      .from('email_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[Templates API] Error fetching templates:', error);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    console.log('[Templates API] Found templates:', data?.length || 0);
    return NextResponse.json({ templates: data || [] });

  } catch (error) {
    console.error('[Templates API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new template
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getActiveWorkspaceId(user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

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

    console.log('[Templates API] Creating template:', templateData.name);

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
    } else {
      // Fallback to old workspace logo system
      const { data: workspaceData } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        .from('workspaces')
        .select('company_logo_url')
        .eq('id', workspaceId)
        .single();

      if (workspaceData?.company_logo_url) {
        const logoHtml = `<img src="${workspaceData.company_logo_url}" alt="Company Logo" style="max-width: 200px; height: auto; display: block; margin: 0 auto;">`;
        
        const replacementPatterns = [
          /\{\{company_initial\}\}/gi,
          /\{\{company_logo\}\}/gi,
          /\{\{logo\}\}/gi,
          /\{\{brand_logo\}\}/gi,
          /https:\/\/via\.placeholder\.com\/[^"'\s]+/gi,
        ];

        const companyInitialDivPattern = /<div[^>]*>([^<]*\{\{company_initial\}\}[^<]*)<\/div>/gi;
        if (companyInitialDivPattern.test(htmlContent)) {
          htmlContent = htmlContent.replace(companyInitialDivPattern, `<div style="text-align: center; padding: 8px;">${logoHtml}</div>`);
        } else {
          for (const pattern of replacementPatterns) {
            if (pattern.test(htmlContent)) {
              htmlContent = htmlContent.replace(pattern, logoHtml);
              break;
            }
          }
        }
      }
    }

    const { data, error } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      .from('email_templates')
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        name: templateData.name.trim(),
        subject: templateData.subject.trim(),
        html_content: htmlContent,
        plain_content: templateData.plain_content || '',
        template_type: templateData.template_type || 'email',
        category: templateData.category || 'Other',
        is_active: templateData.is_active !== undefined ? templateData.is_active : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[Templates API] Error creating template:', error);
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    console.log('[Templates API] Template created successfully:', data.id);
    return NextResponse.json({ template: data }, { status: 201 });

  } catch (error) {
    console.error('[Templates API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 