import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { getActiveWorkspaceId } from '@/lib/permission';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use user.id instead of session?.user?.id
    const userId = user.id;

    const workspaceId = await getActiveWorkspaceId(userId);
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'No active workspace found' }, { status: 404 });
    }

    // Get the workspace logo from workspace_logos table (most recent one)
    const { data: logoDataResult, error: logoError } = await supabase
      .from('workspace_logos')
      .select('url, border_radius, name')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let logoData = logoDataResult;

    if (logoError || !logoData?.url) {
      // Fallback to workspace logo if no logos in workspace_logos
      const { data: workspaceData, error: workspaceError } = await supabase
        .from('workspaces')
        .select('company_logo_url')
        .eq('id', workspaceId)
        .single();

      if (workspaceError || !workspaceData?.company_logo_url) {
        return NextResponse.json({ error: 'No workspace logo found' }, { status: 404 });
      }

      logoData = { url: workspaceData.company_logo_url, border_radius: 0, name: 'Company Logo' };
    }

    const borderRadiusStyle = logoData.border_radius ? `border-radius: ${logoData.border_radius}px; ` : '';
    const logoHtml = `<img src="${logoData.url}" alt="${logoData.name || 'Company Logo'}" style="max-width: 200px; height: auto; display: block; margin: 0 auto; ${borderRadiusStyle}border: 1px solid #e5e7eb;">`;

    // Get all templates for this workspace
    const { data: templates, error: templatesError } = await supabase
      .from('email_templates')
      .select('id, html_content')
      .eq('workspace_id', workspaceId);

    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    let updatedCount = 0;

    // Update each template
    for (const template of templates || []) {
      let updatedHtmlContent = template.html_content;
      let hasChanges = false;

      // Replace common logo placeholders
      const replacementPatterns = [
        { pattern: /\{\{company_initial\}\}/gi, replacement: logoHtml },
        { pattern: /\{\{company_logo\}\}/gi, replacement: logoHtml },
        { pattern: /\{\{logo\}\}/gi, replacement: logoHtml },
        { pattern: /\{\{brand_logo\}\}/gi, replacement: logoHtml },
      ];

      // Special handling for company_initial in styled divs
      const companyInitialDivPattern = /<div[^>]*>([^<]*\{\{company_initial\}\}[^<]*)<\/div>/gi;
      if (companyInitialDivPattern.test(updatedHtmlContent)) {
        updatedHtmlContent = updatedHtmlContent.replace(companyInitialDivPattern, `<div style="padding: 8px;">${logoHtml}</div>`);
        hasChanges = true;
      }

      // Apply other replacements
      for (const { pattern, replacement } of replacementPatterns) {
        if (pattern.test(updatedHtmlContent)) {
          updatedHtmlContent = updatedHtmlContent.replace(pattern, replacement);
          hasChanges = true;
        }
      }

      // Update the template if changes were made
      if (hasChanges) {
        const { error: updateError } = await supabase
          .from('email_templates')
          .update({ 
            html_content: updatedHtmlContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', template.id);

        if (!updateError) {
          updatedCount++;
        }
      }
    }

    return NextResponse.json({ 
      message: `Successfully applied logo to ${updatedCount} templates`,
      updatedCount 
    });

  } catch (error) {
    console.error('Error applying logo to templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 