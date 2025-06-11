import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
}

interface PotentialLead {
  id: string;
  from: string;
  from_email: string;
  subject: string;
  snippet: string;
  date: string;
  aiScore: number;
  suggestedStage: string;
  suggestedCategory: string;
  extractedData: {
    company?: string;
    phone?: string;
    website?: string;
    serviceInterest?: string;
  };
}

// Execute automation actions
async function executeAutomation(
  automation: AutomationRule, 
  leadId: string, 
  leadData: any, 
  workspaceId: string, 
  userId: string
) {
  console.log(`Executing automation: ${automation.name} for lead ${leadId}`);
  
  try {
    switch (automation.id) {
      case 'auto-assign':
        // Auto-assign to sales rep (for now, assign to the user who imported)
        await supabase
          .from('leads')
          .update({ assigned_to: userId })
          .eq('id', leadId);
        break;

      case 'welcome-email':
        // Schedule welcome email (create task)
        await supabase
          .from('tasks')
          .insert({
            title: `Send welcome email to ${leadData.lead_name}`,
            description: `Send personalized welcome email to new lead from Gmail import`,
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
        // Schedule follow-up task for 24 hours
        await supabase
          .from('tasks')
          .insert({
            title: `Follow up with ${leadData.lead_name}`,
            description: `Follow up on lead imported from Gmail: ${leadData.email}`,
            type: 'call',
            priority: 'high',
            status: 'pending',
            assigned_to: userId,
            workspace_id: workspaceId,
            lead_id: leadId,
            due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
          });
        break;

      case 'slack-notification':
        // For now, create a notification task (would integrate with Slack later)
        await supabase
          .from('tasks')
          .insert({
            title: `High-score lead alert: ${leadData.lead_name}`,
            description: `New high-scoring lead (${leadData.qualification_score}%) needs immediate attention`,
            type: 'notification',
            priority: 'urgent',
            status: 'pending',
            assigned_to: userId,
            workspace_id: workspaceId,
            lead_id: leadId,
            due_date: new Date().toISOString(),
          });
        break;

      case 'qualification-reminder':
        // Set up future qualification reminder (7 days)
        await supabase
          .from('tasks')
          .insert({
            title: `Qualification reminder for ${leadData.lead_name}`,
            description: `If no response received, send qualification follow-up sequence`,
            type: 'email',
            priority: 'medium',
            status: 'scheduled',
            assigned_to: userId,
            workspace_id: workspaceId,
            lead_id: leadId,
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
          });
        break;

      case 'lead-scoring-update':
        // Update lead score based on automation
        const updatedScore = Math.min(100, leadData.qualification_score + 5);
        await supabase
          .from('leads')
          .update({ qualification_score: updatedScore })
          .eq('id', leadId);
        break;

      default:
        console.log(`Unknown automation: ${automation.id}`);
    }
  } catch (error) {
    console.error(`Error executing automation ${automation.name}:`, error);
    // Don't throw - continue with other automations
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, userId, leads, automations } = await request.json();

    if (!workspaceId || !leads || !Array.isArray(leads)) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    let importedCount = 0;
    const importedLeadIds: string[] = [];

    // Import each lead
    for (const potentialLead of leads) {
      try {
        // Check if lead already exists by email
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('email', potentialLead.from_email)
          .eq('workspace_id', workspaceId)
          .single();

        if (existingLead) {
          console.log(`Lead already exists for email: ${potentialLead.from_email}`);
          continue;
        }

        // Parse and clean lead name
        let leadName = potentialLead.from;
        if (leadName.includes('<')) {
          leadName = leadName.split('<')[0].trim();
        }

        // Create lead record
        const leadData = {
          lead_name: leadName || 'Unknown',
          company: potentialLead.extractedData?.company || '',
          email: potentialLead.from_email,
          phone: potentialLead.extractedData?.phone || '',
          source: 'gmail_import',
          service_category: potentialLead.suggestedCategory,
          website_url: potentialLead.extractedData?.website || '',
          monthly_traffic: 0,
          current_rank: '',
          target_keywords: [],
          qualification_score: potentialLead.aiScore,
          notes: `Imported from Gmail\n\nOriginal Subject: ${potentialLead.subject}\n\nSnippet: ${potentialLead.snippet}`,
          status: 'new',
          stage: potentialLead.suggestedStage,
          workspace_id: workspaceId,
          created_by: userId,
          last_contacted: null,
          next_followup: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        };

        const { data: newLead, error: leadError } = await supabase
          .from('leads')
          .insert(leadData)
          .select()
          .single();

        if (leadError) {
          console.error('Error creating lead:', leadError);
          continue;
        }

        importedLeadIds.push(newLead.id);
        importedCount++;

        // Execute automations for this lead
        if (automations && Array.isArray(automations)) {
          for (const automation of automations) {
            if (automation.enabled) {
              await executeAutomation(automation, newLead.id, newLead, workspaceId, userId);
            }
          }
        }

        // Add a small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error('Error importing individual lead:', error);
        // Continue with next lead
      }
    }

    // Create a summary task for the import
    try {
      await supabase
        .from('tasks')
        .insert({
          title: `Lead Import Complete: ${importedCount} leads imported`,
          description: `Successfully imported ${importedCount} leads from Gmail with ${automations?.filter((a: any) => a.enabled).length || 0} automations enabled.`,
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

    return NextResponse.json({ 
      success: true,
      imported: importedCount,
      total: leads.length,
      leadIds: importedLeadIds,
      automationsExecuted: automations?.filter((a: any) => a.enabled).length || 0
    });

  } catch (error) {
    console.error('Error in bulk import:', error);
    return NextResponse.json({ 
      error: 'Failed to import leads' 
    }, { status: 500 });
  }
} 