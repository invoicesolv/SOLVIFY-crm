import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient as supabase } from '@/lib/supabase-client';

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
}

// Execute automation actions for existing leads
async function executeAutomationForExistingLead(
  automation: AutomationRule, 
  leadId: string, 
  leadData: any, 
  workspaceId: string, 
  userId: string
) {
  console.log(`Executing automation: ${automation.name} for existing lead ${leadId}`);
  
  try {
    switch (automation.id) {
      case 'auto-assign':
        // Auto-assign to sales rep (assign to the user who triggered the automation)
        await supabase
          .from('leads')
          .update({ 
            assigned_to: userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', leadId);
        break;

      case 'welcome-email':
        // Schedule welcome email (create task)
        await supabase
          .from('tasks')
          .insert({
            title: `Send welcome email to ${leadData.lead_name}`,
            description: `Send personalized welcome email to existing lead: ${leadData.email}`,
            type: 'email',
            priority: 'medium',
            status: 'pending',
            assigned_to: userId,
            workspace_id: workspaceId,
            lead_id: leadId,
            due_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
          });
        break;

      case 'schedule-followup':
        // Schedule follow-up task
        const followupDate = leadData.next_followup 
          ? new Date(leadData.next_followup)
          : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now if no existing followup

        await supabase
          .from('tasks')
          .insert({
            title: `Follow up with ${leadData.lead_name}`,
            description: `Follow up on existing lead: ${leadData.email}`,
            type: 'call',
            priority: 'high',
            status: 'pending',
            assigned_to: userId,
            workspace_id: workspaceId,
            lead_id: leadId,
            due_date: followupDate.toISOString(),
          });
        break;

      case 'update-status':
        // Update lead status to active
        await supabase
          .from('leads')
          .update({ 
            status: 'active',
            stage: 'contacted',
            updated_at: new Date().toISOString(),
            last_contacted: new Date().toISOString()
          })
          .eq('id', leadId);
        break;

      case 'qualification-call':
        // Schedule qualification call for high-scoring leads
        if ((leadData.qualification_score || 0) >= 70) {
          await supabase
            .from('tasks')
            .insert({
              title: `Qualification call with ${leadData.lead_name}`,
              description: `Schedule qualification call for high-scoring lead (${leadData.qualification_score}%)`,
              type: 'call',
              priority: 'high',
              status: 'pending',
              assigned_to: userId,
              workspace_id: workspaceId,
              lead_id: leadId,
              due_date: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
            });
        }
        break;

      case 'nurture-sequence':
        // Start nurture sequence for cold leads
        if ((leadData.qualification_score || 0) < 50) {
          await supabase
            .from('tasks')
            .insert({
              title: `Add ${leadData.lead_name} to nurture sequence`,
              description: `Add cold lead to email nurture campaign for long-term engagement`,
              type: 'email',
              priority: 'low',
              status: 'pending',
              assigned_to: userId,
              workspace_id: workspaceId,
              lead_id: leadId,
              due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
            });
        }
        break;

      default:
        console.log(`Unknown automation: ${automation.id}`);
    }
  } catch (error) {
    console.error(`Error executing automation ${automation.name}:`, error);
    // Don't throw - continue with other automations
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use user.id instead of session?.user?.id
    const userId = user.id;

    const { workspaceId, leadIds, automations } = await request.json();

    if (!workspaceId || !leadIds || !Array.isArray(leadIds) || !automations) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    let processedCount = 0;
    const processedLeadIds: string[] = [];

    // Process each lead
    for (const leadId of leadIds) {
      try {
        // Get the lead data
        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .eq('workspace_id', workspaceId)
          .single();

        if (leadError || !lead) {
          console.log(`Lead not found or access denied: ${leadId}`);
          continue;
        }

        // Execute automations for this lead
        for (const automation of automations) {
          if (automation.enabled) {
            await executeAutomationForExistingLead(automation, lead.id, lead, workspaceId, userId);
          }
        }

        processedLeadIds.push(lead.id);
        processedCount++;

        // Add a small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error('Error processing individual lead:', error);
        // Continue with next lead
      }
    }

    // Create a summary task for the automation application
    try {
      await supabase
        .from('tasks')
        .insert({
          title: `Automation Applied: ${processedCount} leads processed`,
          description: `Successfully applied ${automations.filter((a: any) => a.enabled).length} automations to ${processedCount} existing leads.`,
          type: 'notification',
          priority: 'low',
          status: 'completed',
          assigned_to: userId,
          workspace_id: workspaceId,
          due_date: new Date().toISOString(),
        });
    } catch (taskError) {
      console.error('Error creating summary task:', taskError);
    }

    // Update the last_contacted date for all processed leads
    if (processedLeadIds.length > 0) {
      await supabase
        .from('leads')
        .update({ 
          last_contacted: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', processedLeadIds);
    }

    return NextResponse.json({ 
      success: true,
      processed: processedCount,
      total: leadIds.length,
      leadIds: processedLeadIds,
      automationsApplied: automations.filter((a: any) => a.enabled).length
    });

  } catch (error) {
    console.error('Error in apply automations:', error);
    return NextResponse.json({ 
      error: 'Failed to apply automations' 
    }, { status: 500 });
  }
} 