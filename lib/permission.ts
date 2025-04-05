import { supabase } from './supabase';

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

// Permission keys type
export type PermissionKey = 
  | 'view_projects' 
  | 'edit_projects' 
  | 'view_customers' 
  | 'edit_customers' 
  | 'view_invoices' 
  | 'view_calendar' 
  | 'view_analytics'
  | 'view_domains'
  | 'edit_domains'
  | 'admin'
  | 'canInviteUsers'
  | 'canManageWorkspace';

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
    // First check if user is a workspace owner (owners have all permissions)
    const { data: workspace, error: workspaceError } = await supabase
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
      // Cache owner permissions
      const ownerPermissions = {
        view_projects: true,
        edit_projects: true,
        view_customers: true,
        edit_customers: true,
        view_invoices: true,
        view_calendar: true,
        view_analytics: true,
        view_domains: true,
        edit_domains: true,
        admin: true,
        canInviteUsers: true,
        canManageWorkspace: true
      };
      
      permissionCache.set(cacheKey, {
        permissions: ownerPermissions,
        timestamp: now
      });
      
      return true;
    }
    
    // Get the user's email for additional lookup
    const { data: authUser } = await supabase.auth.getUser();
    const userEmail = authUser?.user?.email;
    
    // First try direct team membership lookup by user ID
    const { data: teamMember, error: memberError } = await supabase
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
        const adminPermissions = {
          view_projects: true,
          edit_projects: true,
          view_customers: true,
          edit_customers: true,
          view_invoices: true,
          view_calendar: true,
          view_analytics: true,
          view_domains: true,
          edit_domains: true,
          admin: true,
          canInviteUsers: true,
          canManageWorkspace: true
        };
        
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
      const { data: emailMember, error: emailError } = await supabase
        .from('team_members')
        .select('permissions, is_admin, email')
        .eq('email', userEmail)
        .eq('workspace_id', workspaceId)
        .single();
        
      if (!emailError && emailMember) {
        // If user is admin, they have all permissions
        if (emailMember.is_admin) {
          // Cache admin permissions
          const adminPermissions = {
            view_projects: true,
            edit_projects: true,
            view_customers: true,
            edit_customers: true,
            view_invoices: true,
            view_calendar: true,
            view_analytics: true,
            view_domains: true,
            edit_domains: true,
            admin: true,
            canInviteUsers: true,
            canManageWorkspace: true
          };
          
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
  if (!userId || !workspaceId) {
    return {
      view_projects: false,
      edit_projects: false,
      view_customers: false,
      edit_customers: false,
      view_invoices: false,
      view_calendar: false,
      view_analytics: false,
      view_domains: false,
      edit_domains: false,
      admin: false,
      canInviteUsers: false,
      canManageWorkspace: false
    };
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
    // First check if user is a workspace owner
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();
      
    if (workspace?.owner_id === userId) {
      // Owners have all permissions
      const ownerPermissions = {
        view_projects: true,
        edit_projects: true,
        view_customers: true,
        edit_customers: true,
        view_invoices: true,
        view_calendar: true,
        view_analytics: true,
        view_domains: true,
        edit_domains: true,
        admin: true,
        canInviteUsers: true,
        canManageWorkspace: true
      };
      
      permissionCache.set(cacheKey, {
        permissions: ownerPermissions,
        timestamp: now
      });
      
      return ownerPermissions;
    }
    
    // Check team membership and permissions
    const { data: teamMember, error: memberError } = await supabase
      .from('team_members')
      .select('permissions, is_admin')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();
      
    if (memberError) {
      // Return no permissions
      const noPermissions = {
        view_projects: false,
        edit_projects: false,
        view_customers: false,
        edit_customers: false,
        view_invoices: false,
        view_calendar: false,
        view_analytics: false,
        view_domains: false,
        edit_domains: false,
        admin: false,
        canInviteUsers: false,
        canManageWorkspace: false
      };
      
      permissionCache.set(cacheKey, {
        permissions: noPermissions,
        timestamp: now
      });
      
      return noPermissions;
    }
    
    // If user is admin, they have all permissions
    if (teamMember?.is_admin) {
      const adminPermissions = {
        view_projects: true,
        edit_projects: true,
        view_customers: true,
        edit_customers: true,
        view_invoices: true,
        view_calendar: true,
        view_analytics: true,
        view_domains: true,
        edit_domains: true,
        admin: true,
        canInviteUsers: true,
        canManageWorkspace: true
      };
      
      permissionCache.set(cacheKey, {
        permissions: adminPermissions,
        timestamp: now
      });
      
      return adminPermissions;
    }
    
    // Use team member permissions, defaulting to false for any missing permissions
    const defaultPermissions = {
      view_projects: false,
      edit_projects: false,
      view_customers: false,
      edit_customers: false,
      view_invoices: false,
      view_calendar: false,
      view_analytics: false,
      view_domains: false,
      edit_domains: false,
      admin: false,
      canInviteUsers: false,
      canManageWorkspace: false
    };
    
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
      view_projects: false,
      edit_projects: false,
      view_customers: false,
      edit_customers: false,
      view_invoices: false,
      view_calendar: false,
      view_analytics: false,
      view_domains: false,
      edit_domains: false,
      admin: false,
      canInviteUsers: false,
      canManageWorkspace: false
    };
  }
}

/**
 * Get the active workspace ID for a user
 */
export async function getActiveWorkspaceId(userId: string): Promise<string | null> {
  if (!userId) {
    return null;
  }
  
  try {
    // Get user's most recently used workspace or default
    const { data: teamMembership, error } = await supabase
      .from('team_members')
      .select('workspace_id, is_admin')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (error) {
      // Fallback: try to get any workspace where user is an admin
      const { data: adminMembership, error: adminError } = await supabase
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .eq('is_admin', true)
        .limit(1);
        
      if (!adminError && adminMembership && adminMembership.length > 0) {
        return adminMembership[0].workspace_id;
      }
      
      return null;
    }
    
    // If no team membership found, return null
    if (!teamMembership || teamMembership.length === 0) {
      // Fallback: try to find any workspace for this user
      const { data: anyMembership, error: anyError } = await supabase
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .limit(1);
        
      if (!anyError && anyMembership && anyMembership.length > 0) {
        return anyMembership[0].workspace_id;
      }
      
      return null;
    }
    
    return teamMembership[0]?.workspace_id || null;
    
  } catch (error) {
    return null;
  }
} 