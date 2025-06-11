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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

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
  | 'canManageWorkspace'
  | 'view_sales'
  | 'edit_sales'
  | 'view_leads'
  | 'edit_leads'
  | 'edit_calendar'
  | 'use_chatbot';

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
      view_analytics: true,
      view_domains: true,
      edit_domains: true,
      admin: true,
      canInviteUsers: true,
      canManageWorkspace: true,
      view_sales: true,
      edit_sales: true,
      view_leads: true,
      edit_leads: true,
      edit_calendar: true,
      use_chatbot: true
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
      view_analytics: false,
      view_domains: true,
      edit_domains: false,
      admin: false,
      canInviteUsers: false,
      canManageWorkspace: false,
      view_sales: false,
      edit_sales: false,
      view_leads: false,
      edit_leads: false,
      edit_calendar: false,
      use_chatbot: false
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
      view_analytics: false,
      view_domains: false,
      edit_domains: false,
      admin: false,
      canInviteUsers: false,
      canManageWorkspace: false,
      view_sales: false,
      edit_sales: false,
      view_leads: false,
      edit_leads: false,
      edit_calendar: false,
      use_chatbot: false
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

// Define the structure for permission groups
const permissionGroups = [
  {
    title: 'Projects',
    permissions: [
      { key: 'view_projects', label: 'View Projects' },
      { key: 'edit_projects', label: 'Edit Projects' },
    ]
  },
  {
    title: 'Customers',
    permissions: [
      { key: 'view_customers', label: 'View Customers' },
      { key: 'edit_customers', label: 'Edit Customers' },
    ]
  },
  {
    title: 'Invoices',
    permissions: [
      { key: 'view_invoices', label: 'View Invoices' },
      // Assuming no 'edit_invoices' currently
    ]
  },
  {
    title: 'Calendar',
    permissions: [
      { key: 'view_calendar', label: 'View Calendar' },
      { key: 'edit_calendar', label: 'Edit Calendar' }, // Added
    ]
  },
  {
    title: 'Analytics',
    permissions: [
      { key: 'view_analytics', label: 'View Analytics' },
    ]
  },
  {
    title: 'Domains',
    permissions: [
      { key: 'view_domains', label: 'View Domains' },
      { key: 'edit_domains', label: 'Edit Domains' },
    ]
  },
  { // Added Sales Group
    title: 'Sales',
    permissions: [
      { key: 'view_sales', label: 'View Sales' },
      { key: 'edit_sales', label: 'Edit Sales' },
    ]
  },
  { // Added Leads Group
    title: 'Leads',
    permissions: [
      { key: 'view_leads', label: 'View Leads' },
      { key: 'edit_leads', label: 'Edit Leads' },
    ]
  },
   { // Added Chatbot Group
    title: 'Chatbot',
    permissions: [
      { key: 'use_chatbot', label: 'Use Chatbot' },
    ]
  },
  {
    title: 'Management',
    permissions: [
      { key: 'canInviteUsers', label: 'Invite Users' },
      { key: 'canManageWorkspace', label: 'Manage Workspace' },
    ]
  }
];

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
    view_analytics: false,
    view_domains: false,
    edit_domains: false,
    admin: false,
    canInviteUsers: false,
    canManageWorkspace: false,
    view_sales: false,
    edit_sales: false,
    view_leads: false,
    edit_leads: false,
    edit_calendar: false,
    use_chatbot: false
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
      console.log('Full session object:', {
        id: session?.user?.id,
        email: session?.user?.email,
        hasAccessToken: !!session?.access_token,
        status
      });

      // Don't try to set Supabase session with Google OAuth token
      // Instead skip authentication and rely on RLS policies
      const isGoogleAuth = !!session?.access_token && !(session as any).supabaseAccessToken;
      
      if (isGoogleAuth) {
        console.log('[Team Page] Using RLS policies for Google OAuth without anonymous auth');
        // Skip authentication - no anonymous auth
      } 
      else if ((session as any)?.supabaseAccessToken) {
        console.log('[Team Page] Using Supabase token from session');
        try {
        const { error: authError } = await supabase.auth.setSession({
            access_token: (session as any).supabaseAccessToken,
            refresh_token: '',
        });
          
        if (authError) {
            console.error('[Team Page] Error setting Supabase session:', authError);
            // Don't fall back to anonymous auth
      } else {
            console.log('[Team Page] Successfully set Supabase session');
          }
        } catch (err) {
          console.error('[Team Page] Exception setting Supabase session:', err);
          // Don't fall back to anonymous auth
        }
      } 
      else {
        console.log('[Team Page] No valid tokens. Skipping authentication (no anonymous auth)');
      }

      // First, get user's workspace memberships without joining workspaces
      console.log('Fetching team memberships for user:', session?.user?.id);
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
        .eq('user_id', session?.user?.id);

      console.log('Team memberships query result:', {
        membershipCount: memberships?.length,
        hasData: !!memberships?.length,
        error: membershipError?.message,
        errorCode: membershipError?.code
      });

      if (membershipError) {
        console.error('Error fetching team memberships:', membershipError);
        toast.error('Error loading team memberships');
        return;
      }

      // Cast the result to the expected type after fetching
      const typedMemberships = memberships as TeamMember[] | null;
      
      if (!typedMemberships?.length) {
        console.log('No team memberships found for user, creating default workspace');
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

        if (createError) {
          console.error('Error creating default workspace:', createError);
          toast.error('Failed to create default workspace');
          return;
        }

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

          if (memberError) {
            console.error('Error adding user to workspace:', memberError);
            toast.error('Failed to add you to workspace');
            return;
          }

          setWorkspaces([newWorkspace]);
          setActiveWorkspace(newWorkspace.id);
        }
        return;
      }

      // Get workspace IDs from memberships
      const workspaceIds: string[] = typedMemberships.map(m => m.workspace_id);
      console.log('Workspace IDs to fetch:', workspaceIds);

      // Fetch workspaces directly using the Supabase client with in operator
      const { data: workspacesData, error: workspacesError } = await supabase
        .from('workspaces')
        .select('id, name, created_at, owner_id')
        .in('id', workspaceIds);
        
      if (workspacesError) {
        console.error('Error fetching workspaces:', workspacesError);
        toast.error('Failed to load workspaces');
        return;
      }

      console.log('Fetched workspaces:', {
        count: workspacesData?.length,
        workspaces: workspacesData
      });
      
      // Set workspaces
      setWorkspaces(workspacesData || []);
      
      // Check for stored workspace preference in localStorage
      let storedWorkspaceId = null;
      if (typeof window !== 'undefined' && session?.user?.id) {
        storedWorkspaceId = localStorage.getItem(`workspace_${session.user.id}`);
        console.log(`[Workspace] Found stored workspace preference: ${storedWorkspaceId}`);
        
        // Verify the stored workspace is in the list of accessible workspaces
        if (storedWorkspaceId && workspacesData?.some(w => w.id === storedWorkspaceId)) {
          console.log(`[Workspace] Using stored workspace preference: ${storedWorkspaceId}`);
          setActiveWorkspace(storedWorkspaceId);
        } else if (workspacesData?.length > 0 && !activeWorkspace) {
          // Fall back to first workspace if no valid stored preference
          console.log(`[Workspace] No valid stored preference, using first workspace: ${workspacesData[0].id}`);
          setActiveWorkspace(workspacesData[0].id);
          
          // Store this preference for future use
          if (session?.user?.id) {
            localStorage.setItem(`workspace_${session.user.id}`, workspacesData[0].id);
          }
        }
      } else if (workspacesData?.length > 0 && !activeWorkspace) {
        // Fall back to first workspace if localStorage not available
        setActiveWorkspace(workspacesData[0].id);
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
      
      // Deduplicate team members by user_id to handle duplicate records
      const deduplicatedMembers = membersWithDefaultPermissions.reduce((acc, member) => {
        const existingIndex = acc.findIndex(m => m.user_id === member.user_id);
        if (existingIndex === -1) {
          acc.push(member);
        } else {
          // Keep the one that's an admin, or just keep the first one
          const existing = acc[existingIndex];
          if (member.is_admin && !existing.is_admin) {
            acc[existingIndex] = member;
          }
          // Otherwise keep the existing one (first found)
        }
        return acc;
      }, [] as typeof membersWithDefaultPermissions);
      
      setTeamMembers(deduplicatedMembers);
      
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
            <h1 className="text-2xl font-semibold text-foreground">Team Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage your workspaces and team members
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center my-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-400 border-t-gray-900 dark:border-t-white"></div>
          </div>
        ) : (
          <>
            {workspaces.length === 0 ? (
              <Card className="bg-background border-border p-8 flex flex-col items-center justify-center">
                <Building className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-medium text-foreground mb-2">No Workspaces Yet</h2>
                <p className="text-muted-foreground text-center mb-6">
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
                      className="appearance-none bg-background border border-border dark:border-border rounded-md px-4 py-2 pr-8 text-foreground focus:outline-none focus:ring-2 focus:ring-neutral-600 min-w-64"
                    >
                      <option value="" disabled>Select Workspace</option>
                      {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <Button
                      onClick={() => setIsWorkspaceDialogOpen(true)}
                      variant="outline"
                      className="bg-background border-border dark:border-border text-foreground hover:bg-gray-200 dark:bg-muted"
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
                    <TabsList className="bg-background">
                      <TabsTrigger value="members" className="data-[state=active]:bg-gray-200 dark:bg-muted">
                        <Users className="h-4 w-4 mr-2" />
                        Team Members
                      </TabsTrigger>
                      <TabsTrigger value="permissions" className="data-[state=active]:bg-gray-200 dark:bg-muted">
                        <Shield className="h-4 w-4 mr-2" />
                        Permissions
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="members" className="mt-4">
                      <Card className="bg-background border-border text-foreground">
                        <div className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Users className="h-5 w-5 text-muted-foreground" />
                            <h2 className="text-lg font-medium text-foreground">Team Members</h2>
                          </div>
                          
                          {teamMembers.length === 0 ? (
                            <div className="py-8 text-center">
                              <p className="text-muted-foreground">No team members yet</p>
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
                            <div className="relative">
                              <div className="flex items-center py-4">
                                <Input
                                  placeholder="Filter members..."
                                  className="max-w-sm bg-background border-border dark:border-border text-foreground"
                                />
                              </div>
                              <div className="rounded-md border border-border">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="hover:bg-background/50 border-border">
                                      <TableHead className="text-muted-foreground">Status</TableHead>
                                      <TableHead className="text-muted-foreground">Email</TableHead>
                                      <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                                      <TableHead className="text-muted-foreground"></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {teamMembers.map((member) => (
                                      <TableRow key={member.id} className="hover:bg-background/50 border-border">
                                        <TableCell className="font-medium text-foreground">
                                          {member.is_admin ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                              Admin
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                                              Member
                                            </span>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-foreground dark:text-neutral-300">{member.email}</TableCell>
                                        <TableCell className="text-right text-foreground dark:text-neutral-300">
                                          {/* Add any relevant member data here */}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {(isAdmin || isWorkspaceOwner()) && member.user_id !== session?.user?.id && (
                                            <div className="flex items-center justify-end gap-2">
                                              <Button
                                                onClick={() => handleToggleAdmin(member.id, member.is_admin)}
                                                variant="outline"
                                                size="sm"
                                                className="bg-background border-border dark:border-border text-foreground hover:bg-gray-200 dark:bg-muted"
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
                                                className="bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border-red-500/20"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              <div className="flex items-center justify-between py-4">
                                <p className="text-sm text-muted-foreground">
                                  {teamMembers.length} member{teamMembers.length === 1 ? '' : 's'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    </TabsContent>
                    
                    <TabsContent value="permissions" className="mt-4">
                      <Card className="bg-background border-border text-foreground">
                        <div className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Shield className="h-5 w-5 text-muted-foreground" />
                            <h2 className="text-lg font-medium text-foreground">Team Permissions</h2>
                          </div>
                          
                          <p className="text-muted-foreground mb-6">
                            Configure permissions for each team member
                          </p>
                          
                          <div className="space-y-6">
                            {teamMembers.map((member) => {
                              const effectiveIsAdmin = member.is_admin || (workspaces.find(w => w.id === activeWorkspace)?.owner_id === member.user_id);
                              return (
                              <div key={member.id} className="p-4 rounded-lg bg-background/50">
                                <div className="flex items-center justify-between mb-4">
                                  <div>
                                    <h3 className="text-foreground font-medium">{member.name || 'Unknown User'}</h3>
                                    <p className="text-sm text-muted-foreground">{member.email || 'No email'}</p>
                                  </div>
                                    <div className="flex items-center space-x-2">
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${effectiveIsAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                        {effectiveIsAdmin ? 'Admin' : 'Member'}
                                    </span>
                                      {/* Optional: Add admin toggle switch here if needed, similar to previous logic */} 
                                    </div>
                                </div>
                                
                                  {/* Use permissionGroups for rendering */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                                    {permissionGroups.map((group) => (
                                      <div key={group.title} className="space-y-3">
                                        <h5 className="text-sm font-semibold text-muted-foreground mb-2">{group.title}</h5>
                                        {group.permissions.map((perm) => (
                                          <div key={perm.key} className="flex items-center space-x-2">
                                        <Checkbox
                                              id={`${member.id}-${perm.key}`}
                                              checked={effectiveIsAdmin || !!member.permissions?.[perm.key as PermissionKey]}
                                          onCheckedChange={async (checked) => {
                                                if (!isAdmin && !isWorkspaceOwner()) { // Check both admin prop and owner status
                                                  toast.error('You must be an admin or owner to update permissions');
                                              return;
                                            }
                                            
                                            toast.promise(
                                              (async () => {
                                                const updatedPermissions = {
                                                  ...member.permissions,
                                                      [perm.key]: checked,
                                                    };
                                                    await handleUpdatePermissions(member.id, updatedPermissions);
                                                    return 'Permissions updated'; // Return value needed for promise
                                              })(),
                                              {
                                                loading: 'Updating permission...',
                                                success: 'Permission updated successfully',
                                                error: 'Failed to update permission'
                                              }
                                            );
                                          }}
                                              disabled={effectiveIsAdmin} // Disable for admins/owners
                                              aria-label={`Toggle ${perm.label} for ${member.email}`}
                                        />
                                        <label 
                                              htmlFor={`${member.id}-${perm.key}`}
                                              className="text-sm font-medium leading-none text-foreground dark:text-neutral-300 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                              {perm.label}
                                        </label>
                                      </div>
                                        ))}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              );
                            })}
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
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Send an invitation to join {getActiveWorkspaceName()}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800 dark:text-foreground">Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full px-3 py-2 bg-background border border-border dark:border-border rounded-md text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800 dark:text-foreground">Name (Optional)</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-3 py-2 bg-background border border-border dark:border-border rounded-md text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
            
            <div className="space-y-4">
              <label className="text-sm font-medium text-gray-800 dark:text-foreground">Role</label>
              <div className="grid grid-cols-3 gap-4">
                {(Object.entries(ROLE_DEFINITIONS) as [Role, RoleDefinition][]).map(([role, definition]) => (
                  <div
                    key={role}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedRole === role
                        ? 'bg-blue-500/10 border-blue-500/50'
                        : 'bg-background border-border hover:border-gray-400'
                    }`}
                    onClick={() => {
                      setSelectedRole(role);
                      setCustomPermissions(definition.permissions);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        selectedRole === role ? 'bg-blue-500' : 'bg-gray-300 dark:bg-muted-foreground'
                      }`} />
                      <h3 className="font-medium text-foreground">{definition.label}</h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{definition.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 border border-border rounded-md p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800 dark:text-foreground">Page Access</p>
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
                <div className="col-span-2 p-3 rounded-md bg-background/50">
                  <h4 className="text-sm font-medium text-foreground mb-3">Projects</h4>
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
                      <label htmlFor="view_projects" className="text-sm text-foreground dark:text-neutral-300">View Projects</label>
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
                      <label htmlFor="edit_projects" className="text-sm text-foreground dark:text-neutral-300">Edit Projects</label>
                    </div>
                  </div>
                </div>

                <div className="col-span-2 p-3 rounded-md bg-background/50">
                  <h4 className="text-sm font-medium text-foreground mb-3">Customers</h4>
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
                      <label htmlFor="view_customers" className="text-sm text-foreground dark:text-neutral-300">View Customers</label>
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
                      <label htmlFor="edit_customers" className="text-sm text-foreground dark:text-neutral-300">Edit Customers</label>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-background/50">
                  <h4 className="text-sm font-medium text-foreground mb-3">Calendar</h4>
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
                    <label htmlFor="view_calendar" className="text-sm text-foreground dark:text-neutral-300">View Calendar</label>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-background/50">
                  <h4 className="text-sm font-medium text-foreground mb-3">Analytics</h4>
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
                    <label htmlFor="view_analytics" className="text-sm text-foreground dark:text-neutral-300">View Analytics</label>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-background/50">
                  <h4 className="text-sm font-medium text-foreground mb-3">Invoices</h4>
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
                    <label htmlFor="view_invoices" className="text-sm text-foreground dark:text-neutral-300">View Invoices</label>
                  </div>
                </div>

                <div className="p-3 rounded-md bg-background/50">
                  <h4 className="text-sm font-medium text-foreground mb-3">Domains</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="view_domains"
                        checked={customPermissions.view_domains}
                        onCheckedChange={(checked) => {
                          setCustomPermissions(prev => ({
                            ...prev,
                            view_domains: checked === true
                          }));
                        }}
                      />
                      <label htmlFor="view_domains" className="text-sm text-foreground dark:text-neutral-300">View Domains</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit_domains"
                        checked={customPermissions.edit_domains}
                        onCheckedChange={(checked) => {
                          setCustomPermissions(prev => ({
                            ...prev,
                            edit_domains: checked === true
                          }));
                        }}
                        disabled={!customPermissions.view_domains}
                      />
                      <label htmlFor="edit_domains" className="text-sm text-foreground dark:text-neutral-300">Edit Domains</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsInviteDialogOpen(false)}
              className="bg-background border-border text-foreground hover:bg-gray-200 dark:bg-muted"
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
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-400 border-t-gray-900 dark:border-t-white" />
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
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a new workspace to collaborate with your team
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800 dark:text-foreground">Workspace Name</label>
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="My Team"
                className="w-full px-3 py-2 bg-background border border-border dark:border-border rounded-md text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsWorkspaceDialogOpen(false)}
              className="bg-background border-border dark:border-border text-foreground hover:bg-gray-200 dark:bg-muted"
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
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-400 border-t-gray-900 dark:border-t-white" />
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