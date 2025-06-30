// Utility script to bypass RLS issues when creating workspaces and team members
// Run with: node scripts/fix-team-members-rls.js [user_email]

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase connection
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseClient;supabaseUrl, supabaseServiceKey);

async function fixUserWorkspace(userEmail) {
  try {
    console.log(`Looking up user with email: ${userEmail}...`);
    
    // Get the auth user
    const { data: authUser, error: authError } = await supabase
      .from('auth.users')
      .select('id, email')
      .eq('email', userEmail)
      .single();
      
    if (authError) {
      throw new Error(`Could not find auth user: ${authError.message}`);
    }
    
    console.log(`Found auth user: ${authUser.id}`);
    
    // Get the profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', userEmail)
      .single();
      
    if (profileError && profileError.code !== 'PGRST116') {
      throw new Error(`Error fetching profile: ${profileError.message}`);
    }
    
    if (!profile) {
      console.log(`No profile found for ${userEmail}, creating one...`);
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,  // Using auth ID as profile ID for simplicity
          user_id: authUser.id,
          email: userEmail,
          name: userEmail.split('@')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (createError) {
        throw new Error(`Error creating profile: ${createError.message}`);
      }
      
      console.log(`Created new profile with ID: ${newProfile.id}`);
    } else {
      console.log(`Found profile: ${profile.id}`);
      
      // Check if profile.user_id matches auth.id
      if (profile.user_id !== authUser.id) {
        console.log(`Profile user_id (${profile.user_id}) doesn't match auth.id (${authUser.id}), updating...`);
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ user_id: authUser.id })
          .eq('id', profile.id);
          
        if (updateError) {
          throw new Error(`Error updating profile user_id: ${updateError.message}`);
        }
        
        console.log('Updated profile user_id to match auth.id');
      }
    }
    
    // Check if user has a workspace
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('owner_id', authUser.id);
      
    if (workspaceError) {
      throw new Error(`Error checking workspaces: ${workspaceError.message}`);
    }
    
    let workspaceId;
    
    if (workspaces.length === 0) {
      console.log('No workspaces found, creating default workspace...');
      const { data: newWorkspace, error: createError } = await supabase
        .from('workspaces')
        .insert({
          name: `${userEmail.split('@')[0]}'s Workspace`,
          owner_id: authUser.id,
          created_at: new Date().toISOString(),
          is_personal: true
        })
        .select()
        .single();
        
      if (createError) {
        throw new Error(`Error creating workspace: ${createError.message}`);
      }
      
      console.log(`Created workspace: ${newWorkspace.id}`);
      workspaceId = newWorkspace.id;
    } else {
      console.log(`Found ${workspaces.length} workspace(s) for user`);
      workspaceId = workspaces[0].id;
    }
    
    // Check if user is in team_members for this workspace
    const { data: teamMembers, error: teamError } = await supabase
      .from('team_members')
      .select('id, workspace_id')
      .eq('user_id', authUser.id)
      .eq('workspace_id', workspaceId);
      
    if (teamError) {
      throw new Error(`Error checking team members: ${teamError.message}`);
    }
    
    if (teamMembers.length === 0) {
      console.log('No team membership found, creating...');
      
      // Use direct function to bypass RLS
      const { data: result, error: funcError } = await supabase.rpc(
        'add_team_member_directly',
        {
          user_id_param: authUser.id,
          workspace_id_param: workspaceId,
          name_param: userEmail.split('@')[0],
          email_param: userEmail,
          is_admin_param: true,
          permissions_param: { read: true, write: true, admin: true }
        }
      );
      
      if (funcError) {
        throw new Error(`Error creating team member: ${funcError.message}`);
      }
      
      console.log(`Added user to team with ID: ${result}`);
    } else {
      console.log(`User is already a member of workspace ${workspaceId}`);
    }
    
    // Update profile workspace_id if needed
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ workspace_id: workspaceId })
      .eq('email', userEmail)
      .is('workspace_id', null);
      
    if (updateError) {
      throw new Error(`Error updating profile workspace_id: ${updateError.message}`);
    }
    
    console.log('Operation completed successfully!');
    console.log(`User ${userEmail} is now set up with workspace ${workspaceId}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Get email from command line arg
const userEmail = process.argv[2];

if (!userEmail) {
  console.error('Usage: node scripts/fix-team-members-rls.js user@example.com');
  process.exit(1);
}

fixUserWorkspace(userEmail); 