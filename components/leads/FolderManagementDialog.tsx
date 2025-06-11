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

interface Folder {
  id: string;
  name: string;
  workspace_id: string;
  user_id: string | null;
  created_at: string;
}

interface FolderManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
  onFoldersChanged: () => void;
}

export function FolderManagementDialog({
  open,
  onOpenChange,
  workspaceId,
  userId,
  onFoldersChanged,
}: FolderManagementDialogProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{ id: string, name: string } | null>(null);

  const fetchFolders = async () => {
    if (!workspaceId) return;
    
    try {
      setLoading(true);
      
      // Use our new API endpoint instead of direct Supabase call
      const response = await fetch(`/api/lead-folders?workspace_id=${workspaceId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch folders');
      }
      
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (error) {
      console.error("Error fetching folders:", error);
      toast.error("Failed to load folders");
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
        .from("lead_folders")
        .insert([
          {
            name: newFolderName,
            workspace_id: workspaceId,
            user_id: userId,
          },
        ])
        .select();

      if (error) throw error;

      toast.success("Folder created successfully");
      setNewFolderName("");
      fetchFolders();
      onFoldersChanged();
    } catch (error) {
      console.error("Error creating folder:", error);
      toast.error("Failed to create folder");
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
        .from("lead_folders")
        .update({ name: editingFolder.name })
        .eq("id", editingFolder.id);

      if (error) throw error;

      toast.success("Folder updated successfully");
      setEditingFolder(null);
      fetchFolders();
      onFoldersChanged();
    } catch (error) {
      console.error("Error updating folder:", error);
      toast.error("Failed to update folder");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      // First, update any leads with this folder to have null folder_id
      const { error: updateError } = await supabase
        .from("leads")
        .update({ folder_id: null })
        .eq("folder_id", folderId);

      if (updateError) throw updateError;

      // Then delete the folder
      const { error } = await supabase
        .from("lead_folders")
        .delete()
        .eq("id", folderId);

      if (error) throw error;

      toast.success("Folder deleted successfully");
      fetchFolders();
      onFoldersChanged();
    } catch (error) {
      console.error("Error deleting folder:", error);
      toast.error("Failed to delete folder");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Manage Folders</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create and manage folders to organize your leads.
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
              Your Folders
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto mb-2" />
                  Loading folders...
                </div>
              ) : folders.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No folders created yet
                </div>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {folders.map((folder) => (
                    <div key={folder.id} className="p-3 flex items-center justify-between">
                      {editingFolder?.id === folder.id ? (
                        <div className="flex-1 flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-blue-400 flex-shrink-0" />
                          <Input
                            value={editingFolder.name}
                            onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                            className="bg-background border-border dark:border-border text-foreground"
                            autoFocus
                          />
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={handleUpdateFolder}
                            className="ml-2 bg-background hover:bg-gray-200 dark:bg-muted border-border dark:border-border"
                          >
                            <Check className="h-4 w-4 text-green-400" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-blue-400 flex-shrink-0" />
                            <span className="text-foreground">{folder.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingFolder({ id: folder.id, name: folder.name })}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-background"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteFolder(folder.id)}
                              className="h-8 w-8 p-0 text-red-600 dark:text-red-400 hover:text-red-400 hover:bg-background"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={() => onOpenChange(false)}
            className="bg-background hover:bg-gray-200 dark:bg-muted border-border dark:border-border"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 