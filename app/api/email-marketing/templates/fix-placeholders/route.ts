import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient } from '@/lib/supabase-client';
import { getActiveWorkspaceId } from '@/lib/permission';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// POST - Fix all templates with placeholder URLs
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

    console.log('[Fix Placeholders API] Fixing templates for workspace:', workspaceId);

    // Get workspace logos
    const { data: workspaceLogos } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      .from('workspace_logos')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!workspaceLogos || workspaceLogos.length === 0) {
      return NextResponse.json({ error: 'No workspace logo found' }, { status: 400 });
    }

    const logo = workspaceLogos[0];
    const borderRadiusStyle = logo.border_radius ? `border-radius: ${logo.border_radius}px; ` : '';
    const logoHtml = `<img src="${logo.url}" alt="${logo.name || 'Company Logo'}" style="max-width: 200px; height: auto; display: block; margin: 0 auto; ${borderRadiusStyle}border: 1px solid #e5e7eb;">`;

    // Get all templates with placeholder URLs
    const { data: templates, error: fetchError } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      .from('email_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .like('html_content', '%via.placeholder.com%');

    if (fetchError) {
      console.error('[Fix Placeholders API] Error fetching templates:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    if (!templates || templates.length === 0) {
      return NextResponse.json({ message: 'No templates with placeholder URLs found', updatedCount: 0 });
    }

    console.log(`[Fix Placeholders API] Found ${templates.length} templates with placeholder URLs`);

    let updatedCount = 0;
    const replacementPatterns = [
      /https:\/\/via\.placeholder\.com\/[^"'\s]+/gi,
      /\{\{company_initial\}\}/gi,
      /\{\{company_logo\}\}/gi,
      /\{\{logo\}\}/gi,
      /\{\{brand_logo\}\}/gi,
    ];

    // Update each template
    for (const template of templates) {
      let htmlContent = template.html_content;
      let hasChanges = false;

      // Apply replacements
      for (const pattern of replacementPatterns) {
        if (pattern.test(htmlContent)) {
          htmlContent = htmlContent.replace(pattern, logoHtml);
          hasChanges = true;
        }
      }

      // Special handling for company_initial in styled divs
      const companyInitialDivPattern = /<div[^>]*style="[^"]*"[^>]*>([^<]*\{\{company_initial\}\}[^<]*)<\/div>/gi;
      if (companyInitialDivPattern.test(htmlContent)) {
        htmlContent = htmlContent.replace(companyInitialDivPattern, `<div style="text-align: center; padding: 8px;">${logoHtml}</div>`);
        hasChanges = true;
      }

      if (hasChanges) {
        const { error: updateError } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
          .from('email_templates')
          .update({
            html_content: htmlContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', template.id)
          .eq('workspace_id', workspaceId);

        if (updateError) {
          console.error(`[Fix Placeholders API] Error updating template ${template.id}:`, updateError);
        } else {
          updatedCount++;
          console.log(`[Fix Placeholders API] Updated template: ${template.name}`);
        }
      }
    }

    console.log(`[Fix Placeholders API] Successfully updated ${updatedCount} templates`);
    return NextResponse.json({ 
      message: `Successfully updated ${updatedCount} templates`,
      updatedCount,
      totalFound: templates.length
    });

  } catch (error) {
    console.error('[Fix Placeholders API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 