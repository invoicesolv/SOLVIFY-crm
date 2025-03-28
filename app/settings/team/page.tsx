'use client';

import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarDemo } from "@/components/ui/code.demo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from '@/lib/supabase';
import { useSession } from "next-auth/react";
import { Users, UserPlus, Building, Plus, Trash2, MailPlus, ShieldCheck, Shield } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// Add type for permission keys
type PermissionKey = 'view_projects' | 'edit_projects' | 'view_customers' | 'edit_customers' | 'view_invoices' | 'view_calendar' | 'view_analytics';

// Add role types at the top with other types
type Role = 'admin' | 'editor' | 'reader';

interface RoleDefinition {
  label: string;
  description: string;
  permissions: Record<PermissionKey, boolean>;
}

// Add role definitions
const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  admin: {
    label: 'Administrator',
    description: 'Full access to all features and settings',
    permissions: {
      view_projects: true,
      edit_projects: true,
      view_customers: true,
      edit_customers: true,
      view_invoices: true,
      view_calendar: true,
      view_analytics: true
    }
  },
  editor: {
    label: 'Editor',
    description: 'Can view and edit content, but cannot manage team or settings',
    permissions: {
      view_projects: true,
      edit_projects: true,
      view_customers: true,
      edit_customers: true,
      view_invoices: true,
      view_calendar: true,
      view_analytics: false
    }
  },
  reader: {
    label: 'Reader',
    description: 'Can only view content, no editing permissions',
    permissions: {
      view_projects: true,
      edit_projects: false,
      view_customers: true,
      edit_customers: false,
      view_invoices: true,
      view_calendar: true,
      view_analytics: false
    }
  }
};

interface TeamMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  name: string;
  email: string;
  is_admin: boolean;
  permissions: Record<PermissionKey, boolean>;
}

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export default function TeamPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("members");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>('reader');
  const [customPermissions, setCustomPermissions] = useState<Record<string, boolean>>({});
  const [inviteLoading, setInviteLoading] = useState(false);
  
  // Workspace form state
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  // Update the initialPermissions state with proper typing
  const [initialPermissions, setInitialPermissions] = useState<Record<PermissionKey, boolean>>({
    view_projects: true,
    edit_projects: false,
    view_customers: true,
    edit_customers: false,
    view_invoices: false,
    view_calendar: true,
    view_analytics: false
  });

  useEffect(() => {
    console.log('Session status:', status);
    console.log('Session data:', session);
    
    if (status === "loading") return;
    
    if (!session?.user?.id) {
      toast.error('Please sign in to access this page');
      return;
    }
    
    checkDatabaseStructure();
    loadWorkspaces();
  }, [session, status]);

  const checkDatabaseStructure = async () => {
    console.log('Checking database structure...');
    console.log('Session user:', {
      id: session?.user?.id,
      email: session?.user?.email,
      name: session?.user?.name
    });

    try {
      // Check team_members table
      const { data: teamMembersInfo, error: teamMembersError } = await supabase
        .from('team_members')
        .select('*')
        .limit(1);

      console.log('Team members table check:', {
        hasData: !!teamMembersInfo,
        error: teamMembersError?.message,
        errorCode: teamMembersError?.code
      });

      // Check workspaces table
      const { data: workspacesInfo, error: workspacesError } = await supabase
        .from('workspaces')
        .select('*')
        .limit(1);

      console.log('Workspaces table check:', {
        hasData: !!workspacesInfo,
        error: workspacesError?.message,
        errorCode: workspacesError?.code
      });

    } catch (error) {
      console.error('Error checking database structure:', error);
    }
  };

  // Load the user's workspaces
  const loadWorkspaces = async () => {
    try {
      console.log('Loading workspaces for user:', session?.user?.id);
      console.log('Full session object:', session);

      // Set the Supabase auth session
      if (session?.access_token) {
        const { error: authError } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token || '',
        });
        if (authError) {
          console.error('Error setting Supabase auth session:', authError);
          toast.error('Failed to authenticate with Supabase');
          return;
        }
      } else {
        console.warn('No access token found in session');
      }

      // Verify the Supabase auth user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('Supabase auth user:', user);
      if (authError) {
        console.error('Supabase auth error:', authError);
      }

      // First, get user's workspace memberships without joining workspaces
      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select(`
          id,
          workspace_id,
          user_id,
          role,
          name,
          email,
          is_admin,
          permissions
        `)
        .eq('user_id', session?.user?.id)
        .returns<TeamMember[]>();

      console.log('Team memberships query result:', {
        memberships,
        error: membershipError?.message,
        errorCode: membershipError?.code
      });

      if (membershipError) {
        console.error('Error fetching team memberships:', membershipError);
        return;
      }

      if (!memberships?.length) {
        console.log('No team memberships found for user');
        // Create a default workspace for the user
        const { data: newWorkspace, error: createError } = await supabase
          .from('workspaces')
          .insert([
            { 
              name: 'My Workspace',
              owner_id: session?.user?.id
            }
          ])
          .select()
          .single();

        console.log('Created default workspace:', {
          workspace: newWorkspace,
          error: createError?.message
        });

        if (newWorkspace) {
          // Add user as admin of the new workspace
          const { error: memberError } = await supabase
            .from('team_members')
            .insert([
              {
                user_id: session?.user?.id,
                workspace_id: newWorkspace.id,
                role: 'admin',
                name: session?.user?.name || 'Admin User',
                email: session?.user?.email || '',
                is_admin: true,
                permissions: ROLE_DEFINITIONS.admin.permissions
              }
            ]);

          console.log('Added user to workspace:', {
            error: memberError?.message
          });

          if (!memberError) {
            setWorkspaces([newWorkspace]);
          }
        }
        return;
      }

      // Fetch workspaces separately with a direct HTTP request
      const workspaceIds = memberships.map(m => m.workspace_id);
      console.log('Workspace IDs to fetch:', workspaceIds);
      console.log('First membership for reference:', memberships[0]);

      let workspacesData = [];
      let workspacesError = null;
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Attempt ${attempt} to fetch workspaces via direct HTTP...`);
          const workspaceId = workspaceIds[0]; // We know there's only one ID
          
          if (!session?.access_token) {
            throw new Error('No access token available');
          }

          const headers: HeadersInit = {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Content-Type': 'application/json',
          };

          const response = await fetch(
            `https://jbspiufukrifntnwlrts.supabase.co/rest/v1/workspaces?select=id,name,created_at,owner_id&id=eq.${workspaceId}`,
            {
              method: 'GET',
              headers,
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          const data = await response.json();
          console.log('Fetched workspaces via direct HTTP:', {
            workspacesData: data,
            status: response.status,
            query: `SELECT id, name, created_at, owner_id FROM workspaces WHERE id = '${workspaceId}'`
          });

          workspacesData = data;
          workspacesError = null;
          break; // Success, exit the retry loop
        } catch (error) {
          console.error(`Attempt ${attempt} failed:`, error);
          workspacesError = error;
          if (attempt === maxRetries) {
            console.error('Max retries reached. Final error:', {
              error,
              message: error instanceof Error ? error.message : String(error)
            });
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }

      if (workspacesError) {
        console.error('Error fetching workspaces after retries:', workspacesError);

        // Fallback query: fetch all workspaces to debug
        if (!session?.access_token) {
          throw new Error('No access token available');
        }

        const headers: HeadersInit = {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Content-Type': 'application/json',
        };

        const response = await fetch(
          `https://jbspiufukrifntnwlrts.supabase.co/rest/v1/workspaces?select=id,name,created_at,owner_id`,
          {
            method: 'GET',
            headers,
          }
        );

        const allWorkspaces = await response.json();
        console.log('Fallback query - all workspaces (direct HTTP):', {
          allWorkspaces,
          status: response.status
        });

        return;
      }

      console.log('Processed workspaces:', workspacesData);
      setWorkspaces(workspacesData || []);

      if (workspacesData.length !== workspaceIds.length) {
        console.log('Some workspace IDs were not found:', {
          missing: workspaceIds.filter(id => !workspacesData.some((w: Workspace) => w.id === id)),
          found: workspacesData.map((w: Workspace) => w.id)
        });
      }
    } catch (error) {
      console.error('Error in loadWorkspaces:', error);
      toast.error('An unexpected error occurred while loading workspaces');
    } finally {
      setLoading(false);
    }
  };

  // Load team members for a specific workspace
  const loadTeamMembers = async (workspaceId: string) => {
    if (!session?.user?.id) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      // Ensure each team member has properly initialized permissions
      const membersWithDefaultPermissions = (data || []).map(member => ({
        ...member,
        permissions: {
          view_projects: true,
          edit_projects: false,
          view_customers: true,
          edit_customers: false,
          view_invoices: false,
          view_calendar: true,
          view_analytics: false,
          ...member.permissions
        }
      }));
      
      setTeamMembers(membersWithDefaultPermissions);
      
      // Check if user is admin or workspace owner
      const workspace = workspaces.find(w => w.id === workspaceId);
      const isOwner = workspace?.owner_id === session.user.id;
      const currentMember = membersWithDefaultPermissions?.find(member => member.user_id === session.user.id);
      
      console.log('Admin check:', {
        isOwner,
        currentMember,
        isAdmin: isOwner || currentMember?.is_admin === true
      });
      
      setIsAdmin(isOwner || currentMember?.is_admin === true);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading team members:', error);
      toast.error('Failed to load team members');
      setLoading(false);
    }
  };

  // Add this useEffect to handle workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      loadTeamMembers(activeWorkspace);
    } else {
      setTeamMembers([]);
      setIsAdmin(false); // Reset admin status when no workspace is active
    }
  }, [activeWorkspace, session?.user?.id]);

  // Handle changing the active workspace
  const handleWorkspaceChange = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
  };

  // Handle creating a new workspace
  const handleCreateWorkspace = async () => {
    if (!session?.user?.id) {
      toast.error('Please sign in to create a workspace');
      return;
    }
    
    if (!newWorkspaceName.trim()) {
      toast.error('Please enter a workspace name');
      return;
    }
    
    try {
      setWorkspaceLoading(true);
      
      // Create the workspace directly using Supabase
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          name: newWorkspaceName.trim(),
          owner_id: session.user.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (workspaceError) {
        console.error('Error creating workspace:', workspaceError);
        throw workspaceError;
      }
      
      // Add the current user as an admin in the team_members table
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          user_id: session.user.id,
          name: session.user.name || 'Admin User',
          email: session.user.email || '',
          workspace_id: workspace.id,
          is_admin: true,
          created_at: new Date().toISOString()
        });
        
      if (memberError) {
        console.error('Error adding team member:', memberError);
        throw memberError;
      }
      
      toast.success('Workspace created successfully');
      setIsWorkspaceDialogOpen(false);
      setNewWorkspaceName('');
      
      // Reload workspaces and set the new one as active
      await loadWorkspaces();
      setActiveWorkspace(workspace.id);
      loadTeamMembers(workspace.id);
      
      setWorkspaceLoading(false);
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast.error('Failed to create workspace: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setWorkspaceLoading(false);
    }
  };

  // Handle sending an invitation
  const handleSendInvitation = async () => {
    if (!session?.user?.id) {
      toast.error('Please sign in to send invitations');
      return;
    }
    
    if (!activeWorkspace) {
      toast.error('Please select a workspace first');
      return;
    }
    
    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }
    
    try {
      setInviteLoading(true);
      
      const workspace = workspaces.find(w => w.id === activeWorkspace);
      if (!workspace) {
        toast.error('Invalid workspace selected');
        setInviteLoading(false);
        return;
      }
      
      // Send the invitation via API
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          workspaceId: activeWorkspace,
          workspaceName: workspace.name,
          role: selectedRole,
          permissions: customPermissions
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }
      
      toast.success('Invitation sent successfully');
      setIsInviteDialogOpen(false);
      setInviteEmail('');
      setInviteName('');
      setSelectedRole('reader');
      setCustomPermissions(ROLE_DEFINITIONS.reader.permissions);
      
      setInviteLoading(false);
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send invitation');
      setInviteLoading(false);
    }
  };

  // Handle removing a team member
  const handleRemoveMember = async (memberId: string) => {
    if (!session?.user?.id || !isAdmin) {
      toast.error('You do not have permission to remove team members');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);
        
      if (error) throw error;
      
      toast.success('Team member removed successfully');
      
      // Reload team members
      if (activeWorkspace) {
        loadTeamMembers(activeWorkspace);
      }
    } catch (error) {
      console.error('Error removing team member:', error);
      toast.error('Failed to remove team member');
    }
  };

  // Handle toggling admin status
  const handleToggleAdmin = async (memberId: string, currentStatus: boolean) => {
    if (!session?.user?.id || !isAdmin) {
      toast.error('You do not have permission to change admin status');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ is_admin: !currentStatus })
        .eq('id', memberId);
        
      if (error) throw error;
      
      toast.success(`Admin status ${!currentStatus ? 'granted' : 'revoked'} successfully`);
      
      // Reload team members
      if (activeWorkspace) {
        loadTeamMembers(activeWorkspace);
      }
    } catch (error) {
      console.error('Error toggling admin status:', error);
      toast.error('Failed to update admin status');
    }
  };

  // Update handleUpdatePermissions function
  const handleUpdatePermissions = async (memberId: string, permissions: any) => {
    if (!session?.user?.id) {
      toast.error('Please sign in to update permissions');
      return;
    }

    if (!isAdmin) {
      toast.error('You do not have permission to update permissions');
      return;
    }

    // Find the member being updated
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) {
      toast.error('Member not found');
      return;
    }

    // Don't allow updating admin permissions
    if (member.is_admin) {
      toast.error('Cannot modify admin permissions');
      return;
    }

    try {
      console.log('Updating permissions:', {
        memberId,
        permissions,
        isAdmin
      });

      const { error } = await supabase
        .from('team_members')
        .update({ permissions })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Permissions updated successfully');
      
      // Reload team members to refresh the UI
      if (activeWorkspace) {
        await loadTeamMembers(activeWorkspace);
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
    }
  };

  const getActiveWorkspaceName = () => {
    const workspace = workspaces.find(w => w.id === activeWorkspace);
    return workspace?.name || 'Select a Workspace';
  };

  // Check if the current user is the owner of the active workspace
  const isWorkspaceOwner = () => {
    const workspace = workspaces.find(w => w.id === activeWorkspace);
    return workspace?.owner_id === session?.user?.id;
  };

  // Check if the active workspace exists
  const hasActiveWorkspace = () => {
    return !!activeWorkspace && workspaces.some(w => w.id === activeWorkspace);
  };

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white">Team Management</h1>
            <p className="text-sm text-neutral-400">
              Manage your workspaces and team members
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center my-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-400 border-t-white"></div>
          </div>
        ) : (
          <>
            {workspaces.length === 0 ? (
              <Card className="bg-neutral-900 border-neutral-800 p-8 flex flex-col items-center justify-center">
                <Building className="h-12 w-12 text-neutral-400 mb-4" />
                <h2 className="text-xl font-medium text-white mb-2">No Workspaces Yet</h2>
                <p className="text-neutral-400 text-center mb-6">
                  Create your first workspace to start collaborating with your team
                </p>
                <Button 
                  onClick={() => setIsWorkspaceDialogOpen(true)}
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Workspace
                </Button>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="relative">
                    <select
                      value={activeWorkspace || ''}
                      onChange={(e) => handleWorkspaceChange(e.target.value)}
                      className="appearance-none bg-neutral-800 border border-neutral-700 rounded-md px-4 py-2 pr-8 text-white focus:outline-none focus:ring-2 focus:ring-neutral-600 min-w-64"
                    >
                      <option value="" disabled>Select Workspace</option>
                      {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <Button
                      onClick={() => setIsWorkspaceDialogOpen(true)}
                      variant="outline"
                      className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Workspace
                    </Button>
                    
                    {hasActiveWorkspace() && (
                      <Button
                        onClick={() => setIsInviteDialogOpen(true)}
                        className="bg-blue-600 hover:bg-blue-500"
                        disabled={!isAdmin && !isWorkspaceOwner()}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Member
                      </Button>
                    )}
                  </div>
                </div>

                {hasActiveWorkspace() && (
                  <Tabs defaultValue="members" value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="bg-neutral-800">
                      <TabsTrigger value="members" className="data-[state=active]:bg-neutral-700">
                        <Users className="h-4 w-4 mr-2" />
                        Team Members
                      </TabsTrigger>
                      <TabsTrigger value="permissions" className="data-[state=active]:bg-neutral-700">
                        <Shield className="h-4 w-4 mr-2" />
                        Permissions
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="members" className="mt-4">
                      <Card className="bg-neutral-900 border-neutral-800">
                        <div className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Users className="h-5 w-5 text-neutral-400" />
                            <h2 className="text-lg font-medium text-white">Team Members</h2>
                          </div>
                          
                          {teamMembers.length === 0 ? (
                            <div className="py-8 text-center">
                              <p className="text-neutral-400">No team members yet</p>
                              <Button
                                onClick={() => setIsInviteDialogOpen(true)}
                                className="mt-4 bg-blue-600 hover:bg-blue-500"
                                disabled={!isAdmin && !isWorkspaceOwner()}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Invite Members
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {teamMembers.map((member) => (
                                <div
                                  key={member.id}
                                  className="p-4 rounded-lg bg-neutral-800/50 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                                      {((member.name || member.email || 'U').charAt(0) || 'U').toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{member.name || 'Unknown User'}</span>
                                        {member.is_admin && (
                                          <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">Admin</span>
                                        )}
                                      </div>
                                      <div className="text-sm text-gray-500">{member.email || 'No email'}</div>
                                    </div>
                                  </div>
                                  
                                  {(isAdmin || isWorkspaceOwner()) && member.user_id !== session?.user?.id && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        onClick={() => handleToggleAdmin(member.id, member.is_admin)}
                                        variant="outline"
                                        size="sm"
                                        className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
                                      >
                                        {member.is_admin ? (
                                          <>
                                            <Shield className="h-4 w-4 mr-1" />
                                            Remove Admin
                                          </>
                                        ) : (
                                          <>
                                            <ShieldCheck className="h-4 w-4 mr-1" />
                                            Make Admin
                                          </>
                                        )}
                                      </Button>
                                      
                                      <Button
                                        onClick={() => handleRemoveMember(member.id)}
                                        variant="outline"
                                        size="sm"
                                        className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </Card>
                    </TabsContent>
                    
                    <TabsContent value="permissions" className="mt-4">
                      <Card className="bg-neutral-900 border-neutral-800">
                        <div className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Shield className="h-5 w-5 text-neutral-400" />
                            <h2 className="text-lg font-medium text-white">Team Permissions</h2>
                          </div>
                          
                          <p className="text-neutral-400 mb-6">
                            Configure permissions for each team member
                          </p>
                          
                          <div className="space-y-6">
                            {teamMembers.map((member) => (
                              <div key={member.id} className="p-4 rounded-lg bg-neutral-800/50">
                                <div className="flex items-center justify-between mb-4">
                                  <div>
                                    <h3 className="text-white font-medium">{member.name || 'Unknown User'}</h3>
                                    <p className="text-sm text-neutral-400">{member.email || 'No email'}</p>
                                  </div>
                                  {member.is_admin && (
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-400">
                                      Admin
                                    </span>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  {(Object.entries({
                                    view_projects: 'View Projects',
                                    edit_projects: 'Edit Projects',
                                    view_customers: 'View Customers',
                                    edit_customers: 'Edit Customers',
                                    view_invoices: 'View Invoices',
                                    view_calendar: 'View Calendar',
                                    view_analytics: 'View Analytics'
                                  }) as [PermissionKey, string][]).map(([key, label]) => (
                                    <div key={key} className="flex items-center justify-between p-3 rounded-md bg-neutral-800 border border-neutral-700">
                                      <div className="flex items-center space-x-3">
                                        <Checkbox
                                          id={`${member.id}-${key}`}
                                          checked={member.permissions?.[key] ?? false}
                                          onCheckedChange={(checked) => {
                                            if (!isAdmin) {
                                              toast.error('You must be an admin to update permissions');
                                              return;
                                            }
                                            console.log('Updating permission:', {
                                              memberId: member.id,
                                              key,
                                              currentValue: member.permissions?.[key],
                                              newValue: checked,
                                              isAdmin
                                            });
                                            const updatedPermissions = {
                                              ...member.permissions,
                                              [key]: checked
                                            };
                                            handleUpdatePermissions(member.id, updatedPermissions);
                                          }}
                                          disabled={!isAdmin}
                                        />
                                        <label 
                                          htmlFor={`${member.id}-${key}`}
                                          className="text-sm text-neutral-300 select-none cursor-pointer"
                                        >
                                          {label}
                                        </label>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Send an invitation to join {getActiveWorkspaceName()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-200">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-200">Name (Optional)</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
            
            <div className="space-y-4">
              <label className="text-sm font-medium text-neutral-200">Role</label>
              <div className="grid grid-cols-3 gap-4">
                {(Object.entries(ROLE_DEFINITIONS) as [Role, RoleDefinition][]).map(([role, definition]) => (
                  <div
                    key={role}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedRole === role
                        ? 'bg-blue-500/10 border-blue-500/50'
                        : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
                    }`}
                    onClick={() => {
                      setSelectedRole(role);
                      setCustomPermissions(definition.permissions);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        selectedRole === role ? 'bg-blue-500' : 'bg-neutral-600'
                      }`} />
                      <h3 className="font-medium text-white">{definition.label}</h3>
                    </div>
                    <p className="mt-2 text-sm text-neutral-400">{definition.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 border border-neutral-700 rounded-md p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-neutral-200">Page Access</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setCustomPermissions(ROLE_DEFINITIONS[selectedRole].permissions)}
                >
                  Reset to {ROLE_DEFINITIONS[selectedRole].label} Defaults
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 p-3 rounded-md bg-neutral-800/50">
                  <h4 className="text-sm font-medium text-white mb-3">Projects</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="view_projects"
                        checked={customPermissions.view_projects}
                        onCheckedChange={(checked) => {
                          setCustomPermissions(prev => ({
                            ...prev,
                            view_projects: checked === true
                          }));
                        }}
                      />
                      <label htmlFor="view_projects" className="text-sm text-neutral-300">View Projects</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit_projects"
                        checked={customPermissions.edit_projects}
                        onCheckedChange={(checked) => {
                          setCustomPermissions(prev => ({
                            ...prev,
                            edit_projects: checked === true
                          }));
                        }}
                        disabled={!customPermissions.view_projects}
                      />
                      <label htmlFor="edit_projects" className="text-sm text-neutral-300">Edit Projects</label>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 p-3 rounded-md bg-neutral-800/50">
                  <h4 className="text-sm font-medium text-white mb-3">Customers</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="view_customers"
                        checked={customPermissions.view_customers}
                        onCheckedChange={(checked) => {
                          setCustomPermissions(prev => ({
                            ...prev,
                            view_customers: checked === true
                          }));
                        }}
                      />
                      <label htmlFor="view_customers" className="text-sm text-neutral-300">View Customers</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit_customers"
                        checked={customPermissions.edit_customers}
                        onCheckedChange={(checked) => {
                          setCustomPermissions(prev => ({
                            ...prev,
                            edit_customers: checked === true
                          }));
                        }}
                        disabled={!customPermissions.view_customers}
                      />
                      <label htmlFor="edit_customers" className="text-sm text-neutral-300">Edit Customers</label>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-neutral-800/50">
                  <h4 className="text-sm font-medium text-white mb-3">Calendar</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="view_calendar"
                      checked={customPermissions.view_calendar}
                      onCheckedChange={(checked) => {
                        setCustomPermissions(prev => ({
                          ...prev,
                          view_calendar: checked === true
                        }));
                      }}
                    />
                    <label htmlFor="view_calendar" className="text-sm text-neutral-300">View Calendar</label>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-neutral-800/50">
                  <h4 className="text-sm font-medium text-white mb-3">Analytics</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="view_analytics"
                      checked={customPermissions.view_analytics}
                      onCheckedChange={(checked) => {
                        setCustomPermissions(prev => ({
                          ...prev,
                          view_analytics: checked === true
                        }));
                      }}
                    />
                    <label htmlFor="view_analytics" className="text-sm text-neutral-300">View Analytics</label>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-neutral-800/50">
                  <h4 className="text-sm font-medium text-white mb-3">Invoices</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="view_invoices"
                      checked={customPermissions.view_invoices}
                      onCheckedChange={(checked) => {
                        setCustomPermissions(prev => ({
                          ...prev,
                          view_invoices: checked === true
                        }));
                      }}
                    />
                    <label htmlFor="view_invoices" className="text-sm text-neutral-300">View Invoices</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsInviteDialogOpen(false)}
              className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendInvitation}
              className="bg-blue-600 hover:bg-blue-500"
              disabled={inviteLoading || !inviteEmail}
            >
              {inviteLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-400 border-t-white" />
                  Sending...
                </div>
              ) : (
                <>
                  <MailPlus className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Workspace Dialog */}
      <Dialog open={isWorkspaceDialogOpen} onOpenChange={setIsWorkspaceDialogOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white">
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Create a new workspace to collaborate with your team
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-200">Workspace Name</label>
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="My Team"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsWorkspaceDialogOpen(false)}
              className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkspace}
              className="bg-blue-600 hover:bg-blue-500"
              disabled={workspaceLoading || !newWorkspaceName}
            >
              {workspaceLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-400 border-t-white" />
                  Creating...
                </div>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Workspace
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarDemo>
  );
} 