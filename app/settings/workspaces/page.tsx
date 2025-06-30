"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarDemo } from '@/components/ui/code.demo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-client';
import { supabaseClient } from '@/lib/supabase-client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { createWorkspace } from '@/lib/workspace-utils';

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  is_default?: boolean;
  memberCount?: number;
  role?: 'admin' | 'member';
}

export default function WorkspacesPage() {
  const { user, session } = useAuth();
  const router = useRouter();
  const { workspaces, activeWorkspaceId, isLoading, error, refetch, setActiveWorkspace } = useWorkspace();
  const [workspacesWithCounts, setWorkspacesWithCounts] = useState<Workspace[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

  // Create authenticated Supabase client
  const supabase = supabaseClient;
  
  // Show error if workspace loading fails
  useEffect(() => {
    if (error) {
      toast.error(`Failed to load workspaces: ${error}`);
    }
  }, [error]);

  // Enhance workspaces data with member counts
  useEffect(() => {
    const loadMemberCounts = async () => {
      if (!workspaces.length) {
        setWorkspacesWithCounts([]);
        return;
      }

      try {
        const enhancedWorkspaces = await Promise.all(
          workspaces.map(async (workspace) => {
            const { count, error } = await supabase
              .from("team_members")
              .select("*", { count: 'exact', head: true })
              .eq("workspace_id", workspace.id);
              
            return {
              ...workspace,
              memberCount: error ? 0 : (count || 0)
            };
          })
        );

        setWorkspacesWithCounts(enhancedWorkspaces);
      } catch (error) {
        console.error('Error loading member counts:', error);
        // Fallback to workspaces without counts
        setWorkspacesWithCounts(workspaces.map(w => ({ ...w, memberCount: 0 })));
      }
    };

    loadMemberCounts();
  }, [workspaces, supabase]);
  
  // Create new workspace using the standardized API
  const handleCreateWorkspace = async () => {
    if (!user?.id || !session?.access_token) {
      toast.error('User ID not found');
      return;
    }
    
    if (!newWorkspaceName.trim()) {
      toast.error('Please enter a workspace name');
      return;
    }
    
    setIsCreating(true);
    try {
      await createWorkspace(newWorkspaceName.trim(), user.id);
      toast.success('Workspace created successfully');
      
      // Refresh the workspace data
      await refetch();
      
      // Clear the input and close the dialog
      setNewWorkspaceName('');
      setCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast.error('Failed to create workspace');
    } finally {
      setIsCreating(false);
    }
  };
  
  // Confirm deletion of a workspace
  const confirmDeleteWorkspace = (workspace: Workspace) => {
    setWorkspaceToDelete(workspace);
    setDeleteDialogOpen(true);
  };
  
  // Delete a workspace
  const deleteWorkspace = async () => {
    if (!workspaceToDelete || !user?.id) {
      toast.error('Missing workspace or user ID');
      return;
    }
    
    setIsDeleting(workspaceToDelete.id);
    try {
      // Check if user is the owner
      if (workspaceToDelete.owner_id !== user.id) {
        toast.error('You can only delete workspaces you own');
        return;
      }
      
      // Delete members first (to handle foreign key constraints)
      const { error: memberError } = await supabase
        .from('team_members')
        .delete()
        .eq('workspace_id', workspaceToDelete.id);
        
      if (memberError) {
        throw memberError;
      }
      
      // Delete the workspace
      const { error: deleteError } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceToDelete.id);
        
      if (deleteError) {
        throw deleteError;
      }
      
      toast.success('Workspace deleted successfully');
      
      // Refresh the workspace data
      await refetch();
      
      // Close the dialog
      setDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast.error('Failed to delete workspace');
    } finally {
      setIsDeleting(null);
    }
  };
  
  const selectWorkspace = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
    // Store in localStorage for persistence
    if (user?.id) {
      localStorage.setItem(`workspace_${user.id}`, workspaceId);
    }
    toast.success('Workspace selected');
  };

  if (isLoading) {
    return (
      <SidebarDemo>
        <div className="p-6 flex-1 overflow-auto bg-background">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading workspaces...</span>
            </div>
          </div>
        </div>
      </SidebarDemo>
    );
  }

  return (
    <SidebarDemo>
      <div className="p-6 flex-1 overflow-auto bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Workspaces</h1>
              <p className="text-muted-foreground mt-1">Manage your workspaces and team access</p>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workspace
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Workspace</DialogTitle>
                  <DialogDescription>
                    Create a new workspace to organize your team and projects.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      className="col-span-3"
                      placeholder="Enter workspace name"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    type="submit" 
                    onClick={handleCreateWorkspace}
                    disabled={isCreating || !newWorkspaceName.trim()}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Workspace'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {workspacesWithCounts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="text-center">
                    <h3 className="text-lg font-medium mb-2">No workspaces found</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first workspace to get started.
                    </p>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Workspace
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              workspacesWithCounts.map((workspace) => (
                <Card key={workspace.id} className={`transition-all hover:shadow-md ${activeWorkspaceId === workspace.id ? 'ring-2 ring-primary' : ''}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg">{workspace.name}</CardTitle>
                          {activeWorkspaceId === workspace.id && (
                            <Badge variant="default">Active</Badge>
                          )}
                          {workspace.owner_id === user?.id && (
                            <Badge variant="secondary">Owner</Badge>
                          )}
                          {workspace.role === 'admin' && workspace.owner_id !== user?.id && (
                            <Badge variant="outline">Admin</Badge>
                          )}
                        </div>
                        <CardDescription>
                          Created {new Date(workspace.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeWorkspaceId !== workspace.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectWorkspace(workspace.id)}
                          >
                            Select
                          </Button>
                        )}
                        {workspace.owner_id === user?.id && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => confirmDeleteWorkspace(workspace)}
                            disabled={isDeleting === workspace.id}
                          >
                            {isDeleting === workspace.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{workspace.memberCount || 0} member{(workspace.memberCount || 0) !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Created {new Date(workspace.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Workspace</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete "{workspaceToDelete?.name}"? This action cannot be undone.
                  All data associated with this workspace will be permanently deleted.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={deleteWorkspace}
                  disabled={isDeleting !== null}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Workspace'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </SidebarDemo>
  );
} 