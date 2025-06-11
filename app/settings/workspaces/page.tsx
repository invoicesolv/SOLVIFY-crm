'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, ArrowLeft, Loader2, Globe, Users, Calendar } from 'lucide-react';
import { SidebarDemo } from '@/components/ui/code.demo';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useConsistentUserId } from '@/hooks/useConsistentUserId';

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  is_default?: boolean;
  memberCount?: number;
}

export default function WorkspacesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { consistentId, isLoading: isLoadingUserId } = useConsistentUserId();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  
  // Load workspaces
  useEffect(() => {
    const loadWorkspaces = async () => {
      if (!consistentId) {
        if (!isLoadingUserId) {
          toast.error('User ID not found');
          router.push('/');
        }
        return;
      }
      
      setIsLoading(true);
      try {
        // Get all workspaces where the user is a member
        const { data: memberships, error: membershipError } = await supabase
          .from("team_members")
          .select("workspace_id, workspaces(id, name, owner_id, created_at)")
          .eq("user_id", consistentId);
          
        if (membershipError) {
          throw membershipError;
        }
        
        let uniqueWorkspaces = new Map();
        
        // Process memberships and add workspaces to the map, using id as the key to avoid duplicates
        (memberships as any[] || []).forEach(m => {
          if (m.workspaces) {
            uniqueWorkspaces.set(m.workspaces.id, {
              ...m.workspaces,
              is_default: false
            });
          }
        });
        
        // Get member counts for each workspace
        const workspaceIds = Array.from(uniqueWorkspaces.keys());
        
        if (workspaceIds.length > 0) {
          // Get member counts
          for (const id of workspaceIds) {
            const { count, error } = await supabase
              .from("team_members")
              .select("*", { count: 'exact', head: true })
              .eq("workspace_id", id);
              
            if (!error && count !== null) {
              const workspace = uniqueWorkspaces.get(id);
              uniqueWorkspaces.set(id, {
                ...workspace,
                memberCount: count
              });
            }
          }
        }
        
        // Convert map to array and sort by creation date (newest first)
        const workspaceList = Array.from(uniqueWorkspaces.values()).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        setWorkspaces(workspaceList);
      } catch (error) {
        console.error('Error loading workspaces:', error);
        toast.error('Failed to load workspaces');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadWorkspaces();
  }, [consistentId, isLoadingUserId, router]);
  
  // Create new workspace
  const createWorkspace = async () => {
    if (!consistentId) {
      toast.error('User ID not found');
      return;
    }
    
    if (!newWorkspaceName.trim()) {
      toast.error('Please enter a workspace name');
      return;
    }
    
    setIsCreating(true);
    try {
      // Create the workspace
      const { data: workspace, error: createError } = await supabase
        .from('workspaces')
        .insert([{
          name: newWorkspaceName.trim(),
          owner_id: consistentId,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
        
      if (createError) {
        throw createError;
      }
      
      if (!workspace) {
        throw new Error('No workspace returned after creation');
      }
      
      // Add the user as a member and admin
      const { error: memberError } = await supabase
        .from('team_members')
        .insert([{
          user_id: consistentId,
          workspace_id: workspace.id,
          role: 'admin',
          is_admin: true,
          created_at: new Date().toISOString()
        }]);
        
      if (memberError) {
        throw memberError;
      }
      
      toast.success('Workspace created successfully');
      
      // Add the new workspace to the list
      setWorkspaces(prev => [
        {
          ...workspace,
          memberCount: 1,
          is_default: false
        },
        ...prev
      ]);
      
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
    if (!workspaceToDelete || !consistentId) {
      toast.error('Missing workspace or user ID');
      return;
    }
    
    setIsDeleting(workspaceToDelete.id);
    try {
      // Check if user is the owner
      if (workspaceToDelete.owner_id !== consistentId) {
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
      
      // Remove from the list
      setWorkspaces(prev => prev.filter(w => w.id !== workspaceToDelete.id));
      
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
  
  // Switch to a different workspace
  const selectWorkspace = (workspaceId: string) => {
    if (!consistentId) return;
    
    // Store the selection in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(`workspace_${consistentId}`, workspaceId);
    }
    
    // Redirect to dashboard
    router.push('/');
    
    toast.success('Workspace selected');
  };
  
  return (
    <SidebarDemo>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Button 
              variant="ghost" 
              className="mb-2" 
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Workspace Management</h1>
            <p className="text-muted-foreground">Manage your workspaces and team access</p>
          </div>
          
          <Button 
            onClick={() => setCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Workspace
          </Button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : workspaces.length === 0 ? (
          <Card className="p-6 text-center bg-background border-border dark:border-border">
            <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No Workspaces Found</h2>
            <p className="text-muted-foreground mb-6">
              You don't have any workspaces yet. Create one to get started.
            </p>
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Workspace
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map(workspace => (
              <Card 
                key={workspace.id} 
                className="p-6 bg-background border-border dark:border-border hover:bg-neutral-750 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">{workspace.name}</h2>
                    <p className="text-xs text-muted-foreground">Created: {new Date(workspace.created_at).toLocaleDateString()}</p>
                  </div>
                  {workspace.owner_id === consistentId && (
                                                              <Button 
                       variant="outline" 
                       size="icon"
                       className="border-red-800 bg-red-100 dark:bg-red-900/20 hover:bg-red-900/30 text-red-400 h-8 w-8"
                      onClick={() => confirmDeleteWorkspace(workspace)}
                      disabled={isDeleting === workspace.id}
                    >
                      {isDeleting === workspace.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-sm flex items-center">
                      <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                      Members
                    </span>
                    <span className="text-sm font-medium">{workspace.memberCount || 0}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      Created
                    </span>
                    <span className="text-sm font-medium">{new Date(workspace.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                    onClick={() => selectWorkspace(workspace.id)}
                  >
                    Select Workspace
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Create Workspace Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-background border-border dark:border-border">
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Workspaces help you organize your projects, teams, and data.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace Name</Label>
              <Input
                id="name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Enter workspace name"
                className="bg-background border-border dark:border-border"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCreateDialogOpen(false)}
              className="bg-background hover:bg-gray-200 dark:bg-muted border-border dark:border-border"
            >
              Cancel
            </Button>
            <Button 
              onClick={createWorkspace}
              disabled={isCreating || !newWorkspaceName.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Workspace'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-background border-border dark:border-border">
          <DialogHeader>
            <DialogTitle>Delete Workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this workspace? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {workspaceToDelete && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-2">You are about to delete:</p>
              <div className="bg-background rounded-md p-3 border border-border dark:border-border">
                <p className="font-medium">{workspaceToDelete.name}</p>
                <p className="text-xs text-muted-foreground">Created: {new Date(workspaceToDelete.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              className="bg-background hover:bg-gray-200 dark:bg-muted border-border dark:border-border"
            >
              Cancel
            </Button>
                         <Button 
               variant="outline"
               className="border-red-800 bg-red-100 dark:bg-red-900/20 hover:bg-red-900/30 text-red-400"
               onClick={deleteWorkspace}
               disabled={isDeleting !== null}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Workspace'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarDemo>
  );
} 