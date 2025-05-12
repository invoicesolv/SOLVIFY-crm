import { supabase, supabaseAdmin } from '@/lib/supabase';

/**
 * Safely creates a workspace and adds the user as an admin, bypassing RLS issues
 * 
 * @param userId The auth user ID
 * @param name The workspace name
 * @param email User's email address
 * @param userName User's name
 * @returns The created workspace ID or null if failed
 */
export async function createWorkspaceBypass(
  userId: string, 
  name: string, 
  email: string,
  userName: string = email.split('@')[0]
): Promise<string | null> {
  try {
    console.log('Creating workspace using bypass method:', { userId, name });
    
    // First, try direct admin client to bypass RLS
    const { data: workspace, error: createError } = await supabaseAdmin
      .from('workspaces')
      .insert({
        name,
        owner_id: userId,
        created_at: new Date().toISOString(),
        is_personal: true
      })
      .select()
      .single();
      
    if (createError) {
      console.error('Error creating workspace:', createError);
      return null;
    }
    
    console.log('Created workspace:', workspace.id);
    
    // Next, add the user as a team member
    const { error: memberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        user_id: userId,
        workspace_id: workspace.id,
        name: userName,
        email,
        is_admin: true,
        permissions: { read: true, write: true, admin: true },
        created_at: new Date().toISOString()
      });
      
    if (memberError) {
      console.error('Error adding team member:', memberError);
    } else {
      console.log('Successfully added user to workspace team');
    }
    
    return workspace.id;
  } catch (error) {
    console.error('Unexpected error creating workspace:', error);
    return null;
  }
}

/**
 * Get the user's active workspace or create one if none exists
 * 
 * @param userId The auth user ID
 * @param userEmail User's email
 * @param userName User's name
 * @returns The workspace ID or null if failed
 */
export async function getOrCreateWorkspace(
  userId: string,
  userEmail: string,
  userName?: string
): Promise<string | null> {
  try {
    console.log('Getting workspace for user:', userId);
    
    // Try to get existing workspace from memberships
    const { data: memberships, error: memberError } = await supabase
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', userId);
      
    if (memberError) {
      console.error('Error fetching memberships:', memberError);
    } else if (memberships && memberships.length > 0) {
      console.log('Found existing workspaces:', memberships.length);
      return memberships[0].workspace_id;
    }
    
    // Try to get workspace by ownership
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', userId);
      
    if (workspaceError) {
      console.error('Error fetching workspaces:', workspaceError);
    } else if (workspaces && workspaces.length > 0) {
      console.log('Found workspace by ownership:', workspaces[0].id);
      return workspaces[0].id;
    }
    
    // No workspace found, returning null instead of auto-creating
    console.log('No workspace found for user, returning null');
    return null;
  } catch (error) {
    console.error('Error in getOrCreateWorkspace:', error);
    return null;
  }
}

/**
 * Get or create a workspace specifically for API routes
 * This is a more robust version that tries multiple approaches
 * 
 * @param userId The user ID
 * @param email The user's email
 * @param name The user's name (optional)
 */
export async function getOrCreateWorkspaceForAPI(
  userId: string,
  email: string,
  name?: string
): Promise<string | null> {
  console.log('[getOrCreateWorkspaceForAPI] Starting for user:', userId);
  
  try {
    // First try: Get workspace where user is a team member (by ID)
    const { data: teamMemberships, error: teamError } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1);
      
    if (!teamError && teamMemberships && teamMemberships.length > 0) {
      console.log('[getOrCreateWorkspaceForAPI] Found workspace by team membership (ID):', teamMemberships[0].workspace_id);
      return teamMemberships[0].workspace_id;
    }
    
    // Second try: Get workspace where user is a team member (by email)
    if (email) {
      const { data: emailMemberships, error: emailError } = await supabaseAdmin
        .from('team_members')
        .select('workspace_id')
        .eq('email', email)
        .limit(1);
        
      if (!emailError && emailMemberships && emailMemberships.length > 0) {
        console.log('[getOrCreateWorkspaceForAPI] Found workspace by team membership (email):', emailMemberships[0].workspace_id);
        return emailMemberships[0].workspace_id;
      }
    }
    
    // Third try: Get workspace owned by the user
    const { data: ownedWorkspaces, error: ownedError } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('owner_id', userId)
      .limit(1);
      
    if (!ownedError && ownedWorkspaces && ownedWorkspaces.length > 0) {
      console.log('[getOrCreateWorkspaceForAPI] Found workspace by ownership:', ownedWorkspaces[0].id);
      return ownedWorkspaces[0].id;
    }
    
    // No workspace found, but we no longer auto-create one
    console.log('[getOrCreateWorkspaceForAPI] No workspace found, returning null');
      return null;
  } catch (error) {
    console.error('[getOrCreateWorkspaceForAPI] Unexpected error:', error);
    return null;
  }
} 