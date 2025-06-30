'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarDemo } from "@/components/ui/code.demo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-client';
import { Users, UserPlus, Building, Plus, Trash2, MailPlus, ShieldCheck, Shield, LogOut, AlertTriangle, Edit } from "lucide-react";
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
import type { PermissionKey } from '@/lib/permission';

type Role = 'admin' | 'editor' | 'reader';

interface RoleDefinition {
  label: string;
  description: string;
  permissions: Record<PermissionKey, boolean>;
}

const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  admin: {
    label: 'Administrator',
    description: 'Full access to all features and settings',
    permissions: {
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
    },
  },
  editor: {
    label: 'Editor',
    description: 'Can view and edit content, but cannot manage team or settings',
    permissions: {
      // Dashboard
      view_dashboard: true,
      view_dashboard_analytics: false,
      
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
      edit_gmail_hub: false,
      
      // Finance
      view_invoices: true,
      edit_invoices: false,
      view_recurring_invoices: true,
      edit_recurring_invoices: false,
      view_invoice_reminders: true,
      edit_invoice_reminders: false,
      
      // Marketing
      view_marketing: true,
      edit_marketing: false,
      view_email_marketing: true,
      edit_email_marketing: true,
      view_social_media: true,
      edit_social_media: true,
      view_analytics: false,
      view_search_console: false,
      edit_search_console: false,
      view_domains: true,
      edit_domains: false,
      view_content_generator: true,
      edit_content_generator: true,
      
      // Calendar & Communication
      view_calendar: true,
      edit_calendar: true,
      view_notifications: true,
      edit_notifications: false,
      view_chat: true,
      edit_chat: true,
      use_chatbot: true,
      
      // Automation
      view_automation: false,
      edit_automation: false,
      view_scheduled_tasks: false,
      edit_scheduled_tasks: false,
      
      // Profile & Settings
      view_profile: true,
      edit_profile: true,
      view_settings: false,
      edit_settings: false,
      
      // Administration
      admin: false,
      canInviteUsers: false,
      canManageWorkspace: false
    },
  },
  reader: {
    label: 'Reader',
    description: 'Can only view content, no editing permissions',
    permissions: {
      // Dashboard
      view_dashboard: true,
      view_dashboard_analytics: false,
      
      // Projects & Tasks
      view_projects: true,
      edit_projects: false,
      view_tasks: true,
      edit_tasks: false,
      
      // CRM
      view_customers: true,
      edit_customers: false,
      view_leads: true,
      edit_leads: false,
      view_sales: true,
      edit_sales: false,
      view_gmail_hub: true,
      edit_gmail_hub: false,
      
      // Finance
      view_invoices: true,
      edit_invoices: false,
      view_recurring_invoices: true,
      edit_recurring_invoices: false,
      view_invoice_reminders: true,
      edit_invoice_reminders: false,
      
      // Marketing
      view_marketing: true,
      edit_marketing: false,
      view_email_marketing: true,
      edit_email_marketing: false,
      view_social_media: true,
      edit_social_media: false,
      view_analytics: false,
      view_search_console: false,
      edit_search_console: false,
      view_domains: false,
      edit_domains: false,
      view_content_generator: true,
      edit_content_generator: false,
      
      // Calendar & Communication
      view_calendar: true,
      edit_calendar: false,
      view_notifications: true,
      edit_notifications: false,
      view_chat: true,
      edit_chat: false,
      use_chatbot: false,
      
      // Automation
      view_automation: false,
      edit_automation: false,
      view_scheduled_tasks: false,
      edit_scheduled_tasks: false,
      
      // Profile & Settings
      view_profile: true,
      edit_profile: true,
      view_settings: false,
      edit_settings: false,
      
      // Administration
      admin: false,
      canInviteUsers: false,
      canManageWorkspace: false
    },
  },
};

interface TeamMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: Role;
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
  const { user, session } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isCreateWorkspaceDialogOpen, setIsCreateWorkspaceDialogOpen] = useState(false);
  const [isLeaveWorkspaceDialogOpen, setIsLeaveWorkspaceDialogOpen] = useState(false);
  const [isDeleteWorkspaceDialogOpen, setIsDeleteWorkspaceDialogOpen] = useState(false);
  const [isEditMemberDialogOpen, setIsEditMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>('reader');
  const [activeTab, setActiveTab] = useState("members");
  const [customPermissions, setCustomPermissions] = useState<Record<PermissionKey, boolean>>({} as Record<PermissionKey, boolean>);

  // Extract primitive values to prevent object recreation
  const userId = user?.id;
  const accessToken = session?.access_token;

  const loadTeamMembers = useCallback(async (workspaceId: string) => {
    if (!accessToken) return;
    
    try {
      const response = await fetch('/api/team-members', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch team members: ${response.status}`);
      }

      const data = await response.json();
      // Filter members for the specific workspace
      const workspaceMembers = (data.members || []).filter((member: TeamMember) => member.workspace_id === workspaceId);
      setTeamMembers(workspaceMembers);
    } catch (err) {
      console.error('Error loading team members:', err);
      toast.error('Failed to load team members');
    }
  }, [accessToken]);

  const loadData = useCallback(async () => {
    if (!userId || !accessToken) return;
    setIsLoading(true);
    try {
      // Use API route instead of direct Supabase calls
      const response = await fetch('/api/workspace/leave', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.status}`);
      }

      const data = await response.json();
      // Handle the API response format { success: true, workspaces: [...] }
      const userWorkspaces = Array.isArray(data.workspaces) ? data.workspaces : [];
      setWorkspaces(userWorkspaces);

      let currentWorkspaceId = localStorage.getItem('activeWorkspaceId');
      const activeWs = userWorkspaces.find((ws: Workspace) => ws.id === currentWorkspaceId) || userWorkspaces[0];
      
      if (activeWs) {
        setActiveWorkspace(activeWs);
        // Load team members for the active workspace
        await loadTeamMembers(activeWs.id);
      } else {
        setActiveWorkspace(null);
        setTeamMembers([]);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error(err instanceof Error ? err.message : "Failed to load data.");
      // Set empty arrays on error to prevent runtime errors
      setWorkspaces([]);
      setTeamMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, accessToken, loadTeamMembers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleWorkspaceChange = async (workspaceId: string) => {
    const newActiveWorkspace = workspaces.find(ws => ws.id === workspaceId);
    if (newActiveWorkspace) {
      setIsLoadingMembers(true);
      setActiveWorkspace(newActiveWorkspace);
      localStorage.setItem('activeWorkspaceId', workspaceId);
      try {
        await loadTeamMembers(newActiveWorkspace.id);
      } catch (err) {
        toast.error("Failed to load team members for the selected workspace.");
      } finally {
        setIsLoadingMembers(false);
      }
    }
  };
  
  const handleCreateWorkspace = async () => {
    if (!userId || !newWorkspaceName.trim() || !accessToken) return;
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newWorkspaceName.trim(),
          owner_id: userId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create workspace: ${response.status}`);
      }

      toast.success("Workspace created!");
      setNewWorkspaceName('');
      setIsCreateWorkspaceDialogOpen(false);
      loadData();
    } catch (err) {
      console.error('Error creating workspace:', err);
      toast.error(err instanceof Error ? err.message : "Failed to create workspace.");
    }
  };

  const handleSendInvitation = async () => {
    if (!activeWorkspace || !userId || !inviteEmail || !accessToken) return;
    try {
      // Create invitation via API
      const inviteResponse = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          email: inviteEmail,
          role: inviteRole,
          invited_by: userId,
        })
      });

      if (!inviteResponse.ok) {
        throw new Error(`Failed to create invitation: ${inviteResponse.status}`);
      }
      
      // Send invitation email
      await fetch('/api/send-invitation', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email: inviteEmail, workspaceName: activeWorkspace.name }),
      });

      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setIsInviteDialogOpen(false);
    } catch (err) {
      console.error('Error sending invitation:', err);
      toast.error(err instanceof Error ? err.message : "Failed to send invitation.");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeWorkspace || !accessToken) return;
    try {
      const response = await fetch(`/api/team-members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspace_id: activeWorkspace.id })
      });

      if (!response.ok) {
        throw new Error(`Failed to remove member: ${response.status}`);
      }

      toast.success("Team member removed.");
      await loadTeamMembers(activeWorkspace.id);
    } catch (err) {
      console.error('Error removing member:', err);
      toast.error(err instanceof Error ? err.message : "Failed to remove member.");
    }
  };
  
  const handleToggleAdmin = async (member: TeamMember) => {
    if (!activeWorkspace || !accessToken) return;
    const newRole = member.role === 'admin' ? 'editor' : 'admin';
    try {
      const response = await fetch(`/api/team-members/${member.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          role: newRole,
          is_admin: newRole === 'admin',
          permissions: ROLE_DEFINITIONS[newRole].permissions
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update member role: ${response.status}`);
      }

      toast.success(`Member role updated to ${newRole}.`);
      await loadTeamMembers(activeWorkspace.id);
    } catch (err) {
      console.error('Error updating member role:', err);
      toast.error(err instanceof Error ? err.message : "Failed to update member role.");
    }
  };
  
  const handleUpdatePermissions = async () => {
    if (!editingMember || !activeWorkspace || !accessToken) return;
    try {
      const response = await fetch(`/api/team-members/${editingMember.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          permissions: customPermissions
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update permissions: ${response.status}`);
      }

      toast.success("Permissions updated successfully.");
      setIsEditMemberDialogOpen(false);
      setEditingMember(null);
      await loadTeamMembers(activeWorkspace.id);
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error("Failed to update permissions.");
    }
  };

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member);
    
    // Use member's custom permissions or fall back to role-based permissions
    let permissions: Record<PermissionKey, boolean> = member.permissions && Object.keys(member.permissions).length > 0 
      ? member.permissions 
      : {} as Record<PermissionKey, boolean>;
    
    // If no custom permissions, use role-based defaults
    if (Object.keys(permissions).length === 0) {
      // Map database roles to our role definitions
      const roleMap: Record<string, Role> = {
        'admin': 'admin',
        'editor': 'editor', 
        'reader': 'reader',
        'member': 'editor', // Default members to editor role
      };
      
      const mappedRole = roleMap[member.role] || 'reader';
      permissions = ROLE_DEFINITIONS[mappedRole].permissions;
    }
    
    setCustomPermissions(permissions);
    setIsEditMemberDialogOpen(true);
  };

  const isWorkspaceOwner = () => {
    if (!user || !activeWorkspace) return false;
    return activeWorkspace.owner_id === user.id;
  };
  
  const getActiveWorkspaceName = () => activeWorkspace?.name || 'Select a Workspace';

  const getPermissionDescription = (permission: PermissionKey): string => {
    const descriptions: Record<PermissionKey, string> = {
      // Dashboard
      view_dashboard: 'Access to main dashboard',
      view_dashboard_analytics: 'View analytics on dashboard',
      
      // Projects & Tasks
      view_projects: 'View project listings',
      edit_projects: 'Create and modify projects',
      view_tasks: 'View task listings',
      edit_tasks: 'Create and modify tasks',
      
      // CRM
      view_customers: 'View customer information',
      edit_customers: 'Create and modify customers',
      view_leads: 'View lead information',
      edit_leads: 'Create and modify leads',
      view_sales: 'View sales information',
      edit_sales: 'Create and modify sales',
      view_gmail_hub: 'Access Gmail integration',
      edit_gmail_hub: 'Configure Gmail settings',
      
      // Finance
      view_invoices: 'View invoice information',
      edit_invoices: 'Create and modify invoices',
      view_recurring_invoices: 'View recurring invoices',
      edit_recurring_invoices: 'Create and modify recurring invoices',
      view_invoice_reminders: 'View invoice reminders',
      edit_invoice_reminders: 'Create and modify invoice reminders',
      
      // Marketing
      view_marketing: 'Access marketing tools',
      edit_marketing: 'Configure marketing settings',
      view_email_marketing: 'View email campaigns',
      edit_email_marketing: 'Create and modify email campaigns',
      view_social_media: 'View social media tools',
      edit_social_media: 'Manage social media posts',
      view_analytics: 'View analytics reports',
      view_search_console: 'View search console data',
      edit_search_console: 'Configure search console',
      view_domains: 'View domain information',
      edit_domains: 'Manage domains',
      view_content_generator: 'Access content generator',
      edit_content_generator: 'Use content generation tools',
      
      // Calendar & Communication
      view_calendar: 'View calendar events',
      edit_calendar: 'Create and modify calendar events',
      view_notifications: 'View notifications',
      edit_notifications: 'Configure notification settings',
      view_chat: 'Access chat features',
      edit_chat: 'Send messages and configure chat',
      use_chatbot: 'Use AI chatbot features',
      
      // Automation
      view_automation: 'View automation workflows',
      edit_automation: 'Create and modify automations',
      view_scheduled_tasks: 'View scheduled tasks',
      edit_scheduled_tasks: 'Create and modify scheduled tasks',
      
      // Profile & Settings
      view_profile: 'View user profile',
      edit_profile: 'Modify user profile',
      view_settings: 'View system settings',
      edit_settings: 'Modify system settings',
      
      // Administration
      admin: 'Full administrative access',
      canInviteUsers: 'Invite new team members',
      canManageWorkspace: 'Manage workspace settings'
    };
    
    return descriptions[permission] || 'Permission description not available';
  };

  const handleLeaveWorkspace = async () => {
    if (!activeWorkspace || !user || !session?.access_token) {
      toast.error("Unable to leave workspace - missing required data");
      return;
    }

    try {
      console.log('[Team Page] Leaving workspace:', activeWorkspace.id);
      
      const response = await fetch('/api/workspace/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        // Handle specific error cases
        if (result.isLastAdmin) {
          toast.error(result.error || "You are the last admin. Please transfer admin role first or delete the workspace.");
        } else {
          toast.error(result.error || "Failed to leave workspace");
        }
        return;
      }

      toast.success(result.message || "Successfully left workspace");
      setIsLeaveWorkspaceDialogOpen(false);
      
      // Refresh workspaces and reset active workspace
      await loadData();
      setActiveWorkspace(null);
      setTeamMembers([]);
      
    } catch (error) {
      console.error('Error leaving workspace:', error);
      toast.error("Failed to leave workspace");
    }
  };

  return (
    <SidebarDemo>
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
        {isLoading ? (
          <div className="p-6">Loading...</div>
        ) : (
          <div className="p-4 sm:p-6">
            <h1 className="text-3xl font-bold mb-4">Team &amp; Workspaces</h1>
            <div className="flex justify-between items-center mb-4">
                    <select
                value={activeWorkspace?.id || ''}
                      onChange={(e) => handleWorkspaceChange(e.target.value)}
                className="p-2 border rounded bg-background text-foreground"
              >
                <option value="" disabled>Select a workspace</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                      ))}
                    </select>
              <Button onClick={() => setIsCreateWorkspaceDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Workspace
                    </Button>
                </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList>
                <TabsTrigger value="members">
                  <Users className="w-4 h-4 mr-2" />
                  Members
                      </TabsTrigger>
                <TabsTrigger value="workspaces">
                  <Building className="w-4 h-4 mr-2" />
                  Workspaces
                      </TabsTrigger>
                    </TabsList>
              <TabsContent value="members">
                <Card>
                  <div className="p-4 flex justify-between items-center">
                    <Button onClick={() => setIsInviteDialogOpen(true)}>
                        <MailPlus className="w-4 h-4 mr-2" />
                        Invite Member
                    </Button>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsLeaveWorkspaceDialogOpen(true)} 
                        disabled={isWorkspaceOwner()}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Leave Workspace
                      </Button>
                    </div>
                  </div>
                                <Table>
                                  <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                      {isLoadingMembers ? (
                        <TableRow><TableCell colSpan={4}>Loading members...</TableCell></TableRow>
                      ) : (
                        teamMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell>{member.name}</TableCell>
                            <TableCell>{member.email}</TableCell>
                            <TableCell>{member.role}</TableCell>
                            <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => handleEditMember(member)}><Edit className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.id)} disabled={member.user_id === user?.id}><Trash2 className="w-4 h-4" /></Button>
                                        </TableCell>
                                      </TableRow>
                        ))
                      )}
                                  </TableBody>
                                </Table>
                      </Card>
                    </TabsContent>
              <TabsContent value="workspaces">
                  <Card className="p-4">
                      <h2 className="text-xl font-semibold">{getActiveWorkspaceName()}</h2>
                      <div className="mt-4 flex gap-2">
                          {/* Leave Workspace - available for all members but disabled for owners */}
                          <Button 
                            variant="outline" 
                            onClick={() => setIsLeaveWorkspaceDialogOpen(true)} 
                            disabled={isWorkspaceOwner()}
                          >
                              <LogOut className="w-4 h-4 mr-2" />
                              Leave Workspace
                          </Button>
                          
                          {/* Delete Workspace - only for owners */}
                          {isWorkspaceOwner() && (
                              <Button variant="destructive" onClick={() => setIsDeleteWorkspaceDialogOpen(true)}>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Workspace
                              </Button>
                          )}
                      </div>
                      </Card>
                    </TabsContent>
                  </Tabs>
              </div>
        )}
        </div>

      {/* Dialogs */}
      <Dialog open={isCreateWorkspaceDialogOpen} onOpenChange={setIsCreateWorkspaceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
                <DialogDescription>
                    Enter a name for your new workspace.
            </DialogDescription>
          </DialogHeader>
            <Input
                placeholder="Workspace Name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
              />
          <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCreateWorkspaceDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateWorkspace}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
          <DialogContent>
          <DialogHeader>
                  <DialogTitle>Invite a Team Member</DialogTitle>
                  <DialogDescription>
                      Enter the email and select a role for the new member.
            </DialogDescription>
          </DialogHeader>
              <Input
                  placeholder="member@example.com"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
              />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)} className="p-2 border rounded w-full bg-background text-foreground">
                  {Object.keys(ROLE_DEFINITIONS).map(role => (
                      <option key={role} value={role}>{ROLE_DEFINITIONS[role as Role].label}</option>
                  ))}
              </select>
          <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsInviteDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSendInvitation}>Send Invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditMemberDialogOpen} onOpenChange={setIsEditMemberDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
                <DialogTitle>Edit Permissions for {editingMember?.name}</DialogTitle>
          </DialogHeader>
            <div className="grid grid-cols-1 gap-4 py-4 max-h-96 overflow-y-auto">
                {Object.keys(customPermissions).length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    No permissions to display. Please try refreshing the page.
                  </div>
                ) : (
                  Object.keys(customPermissions).map((key) => (
                    <div key={key} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex flex-col">
                          <label htmlFor={key} className="font-medium capitalize">
                            {key.replace(/_/g, ' ')}
                          </label>
                          <span className="text-sm text-muted-foreground">
                            {getPermissionDescription(key as PermissionKey)}
                          </span>
                        </div>
                        <Switch
                            id={key}
                            checked={customPermissions[key as PermissionKey]}
                            onCheckedChange={(checked) => {
                                setCustomPermissions(prev => ({...prev, [key]: checked}))
                            }}
                        />
                    </div>
                  ))
                )}
            </div>
          <DialogFooter>
                <Button variant="ghost" onClick={() => setIsEditMemberDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdatePermissions}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Workspace Dialog */}
      <Dialog open={isLeaveWorkspaceDialogOpen} onOpenChange={setIsLeaveWorkspaceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave this workspace? You will lose access to all workspace data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsLeaveWorkspaceDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleLeaveWorkspace}>
              Leave Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Workspace Dialog */}
      <Dialog open={isDeleteWorkspaceDialogOpen} onOpenChange={setIsDeleteWorkspaceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workspace</DialogTitle>
            <DialogDescription>
              <AlertTriangle className="w-4 h-4 inline mr-2 text-red-500" />
              This action cannot be undone. This will permanently delete the workspace and all its data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteWorkspaceDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              // Handle delete workspace logic here
              toast.info("Delete workspace functionality to be implemented");
              setIsDeleteWorkspaceDialogOpen(false);
            }}>
              Delete Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarDemo>
  );
} 