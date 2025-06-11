'use client';

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Folder, FolderOpen, Plus, Trash2, Edit, Check } from "lucide-react";

interface ProjectFolder {
  id: string;
  name: string;
  workspace_id: string;
  user_id: string | null;
  created_at: string;
}

interface ProjectFolderManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
  onFoldersChanged: () => void;
}

export function ProjectFolderManagementDialog({
  open,
  onOpenChange,
  workspaceId,
  userId,
  onFoldersChanged,
}: ProjectFolderManagementDialogProps) {
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{ id: string, name: string } | null>(null);

  const fetchFolders = async () => {
    if (!workspaceId) return;
    
    try {
      setLoading(true);
      
      // Use our new API endpoint instead of direct Supabase call
      const response = await fetch(`/api/project-folders?workspace_id=${workspaceId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch project folders');
      }
      
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (error) {
      console.error("Error fetching project folders:", error);
      toast.error("Failed to load project folders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchFolders();
    }
  }, [open, workspaceId]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Folder name cannot be empty");
      return;
    }

    try {
      setCreating(true);
      const { data, error } = await supabase
        .from("project_folders")
        .insert([
          {
            name: newFolderName,
            workspace_id: workspaceId,
            user_id: userId,
          },
        ])
        .select();

      if (error) throw error;

      toast.success("Project folder created successfully");
      setNewFolderName("");
      fetchFolders();
      onFoldersChanged();
    } catch (error) {
      console.error("Error creating project folder:", error);
      toast.error("Failed to create project folder");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !editingFolder.name.trim()) {
      toast.error("Folder name cannot be empty");
      return;
    }

    try {
      const { error } = await supabase
        .from("project_folders")
        .update({ name: editingFolder.name })
        .eq("id", editingFolder.id);

      if (error) throw error;

      toast.success("Project folder updated successfully");
      setEditingFolder(null);
      fetchFolders();
      onFoldersChanged();
    } catch (error) {
      console.error("Error updating project folder:", error);
      toast.error("Failed to update project folder");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      // First, update any projects with this folder to have null folder_id
      const { error: updateError } = await supabase
        .from("projects")
        .update({ folder_id: null })
        .eq("folder_id", folderId);

      if (updateError) throw updateError;

      // Then delete the folder
      const { error } = await supabase
        .from("project_folders")
        .delete()
        .eq("id", folderId);

      if (error) throw error;

      toast.success("Project folder deleted successfully");
      fetchFolders();
      onFoldersChanged();
    } catch (error) {
      console.error("Error deleting project folder:", error);
      toast.error("Failed to delete project folder");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Manage Project Folders</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create and manage folders to organize your projects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <Input
              placeholder="New folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="bg-background border-border dark:border-border text-foreground placeholder:text-foreground0"
            />
            <Button 
              onClick={handleCreateFolder} 
              disabled={creating || !newFolderName.trim()}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </div>

          <div className="border rounded-md border-border overflow-hidden">
            <div className="p-3 bg-background text-foreground font-medium border-b border-border dark:border-border">
              Your Project Folders
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto mb-2" />
                  Loading folders...
                </div>
              ) : folders.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No project folders yet. Create your first folder above.
                </div>
              ) : (
                <div className="divide-y divide-border dark:divide-border">
                  {folders.map((folder) => (
                    <div key={folder.id} className="p-3 flex items-center justify-between hover:bg-background/50">
                      <div className="flex items-center space-x-2">
                        <Folder className="h-4 w-4 text-blue-400" />
                        {editingFolder?.id === folder.id ? (
                          <Input
                            value={editingFolder.name}
                            onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                            className="h-8 text-sm bg-background border-border dark:border-border text-foreground"
                            autoFocus
                          />
                        ) : (
                          <span className="text-foreground">{folder.name}</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        {editingFolder?.id === folder.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleUpdateFolder}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingFolder(null)}
                              className="h-8 w-8 p-0"
                            >
                              ×
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingFolder({ id: folder.id, name: folder.name })}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteFolder(folder.id)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 