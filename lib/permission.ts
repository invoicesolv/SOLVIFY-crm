import { supabase, supabaseAdmin, getConsistentUserId } from '@/lib/supabase';

// Cache permissions for 5 minutes to avoid excessive DB queries
const permissionCache = new Map<string, {
  permissions: Record<string, boolean>;
  timestamp: number;
}>();

// Clear cache periodically to ensure fresh permission checks
// This helps prevent stale permissions causing access issues
setInterval(() => {
  permissionCache.clear();
}, 5 * 60 * 1000); // Clear every 5 minutes

// Complete permissions object for reference
const ALL_PERMISSIONS: Record<string, boolean> = {
  // Dashboard
  view_dashboard: true,
  view_dashboard_analytics: true,
  
  // Projects & Tasks
  view_projects: true,
  edit_projects: true,
  view_tasks: true,
  edit_tasks: true,
  
  // CRM
  view_customers: true,
  edit_customers: true,
  view_leads: true,
  edit_leads: true,
  view_sales: true,
  edit_sales: true,
  view_gmail_hub: true,
  edit_gmail_hub: true,
  
  // Finance
  view_invoices: true,
  edit_invoices: true,
  view_recurring_invoices: true,
  edit_recurring_invoices: true,
  view_invoice_reminders: true,
  edit_invoice_reminders: true,
  
  // Marketing
  view_marketing: true,
  edit_marketing: true,
  view_email_marketing: true,
  edit_email_marketing: true,
  view_social_media: true,
  edit_social_media: true,
  view_analytics: true,
  view_search_console: true,
  edit_search_console: true,
  view_domains: true,
  edit_domains: true,
  view_content_generator: true,
  edit_content_generator: true,
  
  // Calendar & Communication
  view_calendar: true,
  edit_calendar: true,
  view_notifications: true,
  edit_notifications: true,
  view_chat: true,
  edit_chat: true,
  use_chatbot: true,
  
  // Automation
  view_automation: true,
  edit_automation: true,
  view_scheduled_tasks: true,
  edit_scheduled_tasks: true,
  
  // Profile & Settings
  view_profile: true,
  edit_profile: true,
  view_settings: true,
  edit_settings: true,
  
  // Administration
  admin: true,
  canInviteUsers: true,
  canManageWorkspace: true
};

// Permission keys type
export type PermissionKey = 
  // Dashboard
  | 'view_dashboard'
  | 'view_dashboard_analytics'
  
  // Projects & Tasks
  | 'view_projects' 
  | 'edit_projects' 
  | 'view_tasks'
  | 'edit_tasks'
  
  // CRM
  | 'view_customers' 
  | 'edit_customers' 
  | 'view_leads'
  | 'edit_leads'
  | 'view_sales'
  | 'edit_sales'
  | 'view_gmail_hub'
  | 'edit_gmail_hub'
  
  // Finance
  | 'view_invoices' 
  | 'edit_invoices'
  | 'view_recurring_invoices'
  | 'edit_recurring_invoices'
  | 'view_invoice_reminders'
  | 'edit_invoice_reminders'
  
  // Marketing
  | 'view_marketing'
  | 'edit_marketing'
  | 'view_email_marketing'
  | 'edit_email_marketing'
  | 'view_social_media'
  | 'edit_social_media'
  | 'view_analytics'
  | 'view_search_console'
  | 'edit_search_console'
  | 'view_domains'
  | 'edit_domains'
  | 'view_content_generator'
  | 'edit_content_generator'
  
  // Calendar & Communication
  | 'view_calendar' 
  | 'edit_calendar'
  | 'view_notifications'
  | 'edit_notifications'
  | 'view_chat'
  | 'edit_chat'
  | 'use_chatbot'
  
  // Automation
  | 'view_automation'
  | 'edit_automation'
  | 'view_scheduled_tasks'
  | 'edit_scheduled_tasks'
  
  // Profile & Settings
  | 'view_profile'
  | 'edit_profile'
  | 'view_settings'
  | 'edit_settings'
  
  // Administration
  | 'admin'
  | 'canInviteUsers'
  | 'canManageWorkspace';

/**
 * NOTE: Uses supabaseAdmin client to bypass RLS for internal checks.
 */

/**
 * Check if a user has a specific permission in their workspace
 */
export async function checkPermission(
  userId: string,
  workspaceId: string,
  permission: PermissionKey
): Promise<boolean> {
  if (!userId || !workspaceId) {
    return false;
  }
  
  // Check cache first
  const cacheKey = `${userId}:${workspaceId}`;
  const cacheEntry = permissionCache.get(cacheKey);
  const now = Date.now();
  
  // If cache entry exists and is less than 5 minutes old
  if (cacheEntry && (now - cacheEntry.timestamp < 5 * 60 * 1000)) {
    return !!cacheEntry.permissions[permission];
  }
  
  try {
    // First check if user is a workspace owner (owners have all permissions) - Use admin client
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();
      
    if (workspaceError) {
      // Clear cache on error to force fresh check next time
      permissionCache.delete(cacheKey);
      return false;
    }
    
    if (workspace?.owner_id === userId) {
      // Cache owner permissions - owners have all permissions
      const ownerPermissions = ALL_PERMISSIONS as Record<PermissionKey, boolean>;
      
      permissionCache.set(cacheKey, {
        permissions: ownerPermissions,
        timestamp: now
      });
      
      return true;
    }
    
    // Getting the user's email might still need the context of the original request's auth?
    // Let's assume this part is okay for now, but might need review depending on auth flow.
    // If using admin client for auth, it might not represent the calling user.
    // Sticking with the default client *just* for getUser might be safer if needed.
    const { data: authUser } = await supabase.auth.getUser(); // Keep default client for user context?
    const userEmail = authUser?.user?.email;
    
    // First try direct team membership lookup by user ID - Use admin client
    const { data: teamMember, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('permissions, is_admin, email')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();
    
    // If we find a direct match, use it
    if (!memberError && teamMember) {
      // If user is admin, they have all permissions
      if (teamMember?.is_admin) {
        // Cache admin permissions
        const adminPermissions = ALL_PERMISSIONS as Record<PermissionKey, boolean>;
        
        permissionCache.set(cacheKey, {
          permissions: adminPermissions,
          timestamp: now
        });
        
        return true;
      }
      
      // Cache user permissions
      permissionCache.set(cacheKey, {
        permissions: teamMember?.permissions || {},
        timestamp: now
      });
      
      const hasPermission = !!teamMember?.permissions?.[permission];
      
      // Check specific permission
      return hasPermission;
    }
    
    // If we didn't find a direct match and we have an email, try by email
    if (userEmail) {
      const { data: emailMember, error: emailError } = await supabaseAdmin // Use admin client
        .from('team_members')
        .select('permissions, is_admin, email')
        .eq('email', userEmail)
        .eq('workspace_id', workspaceId)
        .single();
        
      if (!emailError && emailMember) {
        // If user is admin, they have all permissions
        if (emailMember.is_admin) {
          // Cache admin permissions
          const adminPermissions = ALL_PERMISSIONS as Record<PermissionKey, boolean>;
          
          permissionCache.set(cacheKey, {
            permissions: adminPermissions,
            timestamp: now
          });
          
          return true;
        }
        
        // Cache user permissions
        permissionCache.set(cacheKey, {
          permissions: emailMember?.permissions || {},
          timestamp: now
        });
        
        const hasPermission = !!emailMember?.permissions?.[permission];
        
        return hasPermission;
      }
    }
    
    // If we get here, no team membership was found by either ID or email
    permissionCache.set(cacheKey, {
      permissions: {},
      timestamp: now
    });
    return false;
  } catch (error) {
    // Clear cache on error
    permissionCache.delete(cacheKey);
    return false;
  }
}

/**
 * Get all permissions for a user in a workspace
 */
export async function getUserPermissions(
  userId: string,
  workspaceId: string
): Promise<Record<PermissionKey, boolean>> {
  // Define default permissions at the function scope
  const defaultPermissions: Record<PermissionKey, boolean> = {
    // Dashboard
    view_dashboard: false,
    view_dashboard_analytics: false,
    
    // Projects & Tasks
    view_projects: false,
    edit_projects: false,
    view_tasks: false,
    edit_tasks: false,
    
    // CRM
    view_customers: false,
    edit_customers: false,
    view_leads: false,
    edit_leads: false,
    view_sales: false,
    edit_sales: false,
    view_gmail_hub: false,
    edit_gmail_hub: false,
    
    // Finance
    view_invoices: false,
    edit_invoices: false,
    view_recurring_invoices: false,
    edit_recurring_invoices: false,
    view_invoice_reminders: false,
    edit_invoice_reminders: false,
    
    // Marketing
    view_marketing: false,
    edit_marketing: false,
    view_email_marketing: false,
    edit_email_marketing: false,
    view_social_media: false,
    edit_social_media: false,
    view_analytics: false,
    view_search_console: false,
    edit_search_console: false,
    view_domains: false,
    edit_domains: false,
    view_content_generator: false,
    edit_content_generator: false,
    
    // Calendar & Communication
    view_calendar: false,
    edit_calendar: false,
    view_notifications: false,
    edit_notifications: false,
    view_chat: false,
    edit_chat: false,
    use_chatbot: false,
    
    // Automation
    view_automation: false,
    edit_automation: false,
    view_scheduled_tasks: false,
    edit_scheduled_tasks: false,
    
    // Profile & Settings
    view_profile: false,
    edit_profile: false,
    view_settings: false,
    edit_settings: false,
    
    // Administration
    admin: false,
    canInviteUsers: false,
    canManageWorkspace: false
  };

  if (!userId || !workspaceId) {
    return defaultPermissions;
  }
  
  // Check cache first
  const cacheKey = `${userId}:${workspaceId}`;
  const cacheEntry = permissionCache.get(cacheKey);
  const now = Date.now();
  
  // If cache entry exists and is less than 5 minutes old
  if (cacheEntry && (now - cacheEntry.timestamp < 5 * 60 * 1000)) {
    return cacheEntry.permissions as Record<PermissionKey, boolean>;
  }
  
  try {
    // First check if user is a workspace owner - Use admin client
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();
      
    if (workspace?.owner_id === userId) {
      // Owners have all permissions
      const ownerPermissions = Object.fromEntries(
        Object.keys(defaultPermissions).map(key => [key, true])
      ) as Record<PermissionKey, boolean>;
      
      permissionCache.set(cacheKey, {
        permissions: ownerPermissions,
        timestamp: now
      });
      
      return ownerPermissions;
    }
    
    // Check team membership and permissions
    const { data: teamMember, error: memberError } = await supabaseAdmin // Use admin client
      .from('team_members')
      .select('permissions, is_admin')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();
      
    if (memberError) {
      // Return no permissions
      permissionCache.set(cacheKey, {
        permissions: defaultPermissions,
        timestamp: now
      });
      
      return defaultPermissions;
    }
    
    // If user is admin, they have all permissions
    if (teamMember?.is_admin) {
      const adminPermissions = Object.fromEntries(
        Object.keys(defaultPermissions).map(key => [key, true])
      ) as Record<PermissionKey, boolean>;
      
      permissionCache.set(cacheKey, {
        permissions: adminPermissions,
        timestamp: now
      });
      
      return adminPermissions;
    }
    
    // Use team member permissions, defaulting to false for any missing permissions
    const permissions = {
      ...defaultPermissions,
      ...(teamMember?.permissions || {})
    };
    
    permissionCache.set(cacheKey, {
      permissions,
      timestamp: now
    });
    
    return permissions;
    
  } catch (error) {
    // Return no permissions on error
    return {
      ...defaultPermissions
    };
  }
}

/**
 * NOTE: Added extensive logging to debug workspace resolution issues.
 */

/**
 * Get the active workspace ID for a user
 */
export async function getActiveWorkspaceId(userId: string): Promise<string | null> {
  console.log(`[getActiveWorkspaceId] Called for userId: ${userId}`);
  if (!userId) {
    console.log(`[getActiveWorkspaceId] No userId provided, returning null.`);
    return null;
  }
  
  try {
    // First, ensure we have a valid UUID
    const validUserId = await getConsistentUserId(userId);
    
    if (!validUserId) {
      console.log(`[getActiveWorkspaceId] Could not get valid UUID for userId: ${userId}, returning null.`);
      return null;
    }
    
    console.log(`[getActiveWorkspaceId] Using validated UUID: ${validUserId}`);
    
    // Prioritize admin workspaces first, then most recent membership
    console.log(`[getActiveWorkspaceId] Trying to fetch admin workspace for userId: ${validUserId}`);
    const { data: adminMembership, error: adminError } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id, is_admin, created_at')
      .eq('user_id', validUserId)
      .eq('is_admin', true)
      .order('created_at', { ascending: false })
      .limit(1);
      
    console.log(`[getActiveWorkspaceId] Admin membership query result:`, { data: adminMembership, error: adminError?.message });
    
    if (!adminError && adminMembership && adminMembership.length > 0) {
      console.log(`[getActiveWorkspaceId] Found admin workspace, returning workspace ID: ${adminMembership[0].workspace_id}`);
      return adminMembership[0].workspace_id;
    }
    
    // If no admin workspace, get user's most recently used workspace
    console.log(`[getActiveWorkspaceId] No admin workspace found, trying to fetch most recent team membership for userId: ${validUserId}`);
    const { data: teamMembership, error } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id, is_admin')
      .eq('user_id', validUserId)
      .order('created_at', { ascending: false })
      .limit(1);
      
    console.log(`[getActiveWorkspaceId] Recent membership query result:`, { data: teamMembership, error: error?.message });
      
    if (error) {
      console.log(`[getActiveWorkspaceId] Error in recent membership query. Returning null.`);
      return null;
    }
    
    // If no team membership found, return null
    if (!teamMembership || teamMembership.length === 0) {
      console.log(`[getActiveWorkspaceId] No membership found at all for user. Returning null.`);
      return null;
    }
    
    console.log(`[getActiveWorkspaceId] Found recent membership, returning workspace ID: ${teamMembership[0]?.workspace_id}`);
    return teamMembership[0]?.workspace_id || null;
    
  } catch (error) {
    console.error(`[getActiveWorkspaceId] Uncaught error for userId ${userId}:`, error);
    return null;
  }
} 

/**
 * Set the active workspace ID for a user
 * This persists the selection to localStorage for future sessions
 */
export function setActiveWorkspaceId(userId: string, workspaceId: string): boolean {
  console.log(`[setActiveWorkspaceId] Setting active workspace for userId: ${userId} to: ${workspaceId}`);
  
  if (!userId || !workspaceId) {
    console.log(`[setActiveWorkspaceId] Missing parameters, cannot set active workspace.`);
    return false;
  }
  
  try {
    // Store in localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem(`workspace_${userId}`, workspaceId);
      console.log(`[setActiveWorkspaceId] Successfully set active workspace ID in localStorage.`);
      return true;
    } else {
      console.log(`[setActiveWorkspaceId] Window not defined, cannot access localStorage.`);
      return false;
    }
  } catch (error) {
    console.error(`[setActiveWorkspaceId] Error setting active workspace:`, error);
    return false;
  }
} 