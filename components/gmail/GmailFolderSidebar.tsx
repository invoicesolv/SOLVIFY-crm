'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { 
  FolderPlus, 
  Folder, 
  Inbox, 
  Trash2, 
  Edit2,
  MoreVertical 
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface GmailFolder {
  id: string;
  name: string;
  query: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
}

interface GmailFolderSidebarProps {
  workspaceId: string;
  userId: string;
  activeFolder: string | null;
  onFolderChange: (folderId: string | null) => void;
}

export function GmailFolderSidebar({ 
  workspaceId, 
  userId, 
  activeFolder,
  onFolderChange 
}: GmailFolderSidebarProps) {
  const [folders, setFolders] = useState<GmailFolder[]>([]);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderQuery, setNewFolderQuery] = useState('');
  const [editingFolder, setEditingFolder] = useState<GmailFolder | null>(null);

  useEffect(() => {
    loadFolders();
  }, [workspaceId]);

  const loadFolders = async () => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase
        .from('gmail_folders')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      console.error('Error loading folders:', error);
      toast.error('Failed to load folders');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !workspaceId || !userId) return;

    try {
      const { error } = await supabase
        .from('gmail_folders')
        .insert([{
          name: newFolderName.trim(),
          query: newFolderQuery.trim(),
          workspace_id: workspaceId,
          user_id: userId
        }]);

      if (error) throw error;

      toast.success('Folder created successfully');
      setNewFolderName('');
      setNewFolderQuery('');
      setIsNewFolderDialogOpen(false);
      loadFolders();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    }
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !editingFolder.name.trim()) return;

    try {
      const { error } = await supabase
        .from('gmail_folders')
        .update({
          name: editingFolder.name.trim(),
          query: editingFolder.query.trim()
        })
        .eq('id', editingFolder.id);

      if (error) throw error;

      toast.success('Folder updated successfully');
      setEditingFolder(null);
      loadFolders();
    } catch (error) {
      console.error('Error updating folder:', error);
      toast.error('Failed to update folder');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      const { error } = await supabase
        .from('gmail_folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;

      toast.success('Folder deleted successfully');
      if (activeFolder === folderId) {
        onFolderChange(null);
      }
      loadFolders();
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete folder');
    }
  };

  return (
    <div className="w-64 bg-background/50 backdrop-blur-sm border-r border-border h-full">
      <div className="p-4 border-b border-border">
        <Button
          onClick={() => setIsNewFolderDialogOpen(true)}
          className="w-full flex items-center gap-2"
          variant="outline"
        >
          <FolderPlus className="h-4 w-4" />
          New Folder
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-10rem)]">
        <div className="space-y-1 p-2">
          {/* Default Inbox */}
          <Button
            variant={activeFolder === null ? "default" : "ghost"}
            className="w-full justify-start gap-2"
            onClick={() => onFolderChange(null)}
          >
            <Inbox className="h-4 w-4" />
            Inbox
          </Button>

          {/* Custom Folders */}
          {folders.map((folder) => (
            <div key={folder.id} className="flex items-center group">
              <Button
                variant={activeFolder === folder.id ? "default" : "ghost"}
                className="w-full justify-start gap-2"
                onClick={() => onFolderChange(folder.id)}
              >
                <Folder className="h-4 w-4" />
                {folder.name}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem
                    onClick={() => setEditingFolder(folder)}
                    className="flex items-center gap-2"
                  >
                    <Edit2 className="h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDeleteFolder(folder.id)}
                    className="flex items-center gap-2 text-red-600 dark:text-red-400 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* New Folder Dialog */}
      <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Folder Name
              </label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g., High Priority"
                className="bg-background border-border dark:border-border"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Search Query
              </label>
              <Input
                value={newFolderQuery}
                onChange={(e) => setNewFolderQuery(e.target.value)}
                placeholder="e.g., subject:(urgent OR priority)"
                className="bg-background border-border dark:border-border"
              />
              <p className="text-xs text-foreground0">
                Use Gmail search operators to filter emails
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsNewFolderDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateFolder}>
                Create Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={!!editingFolder} onOpenChange={(open) => !open && setEditingFolder(null)}>
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Edit Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Folder Name
              </label>
              <Input
                value={editingFolder?.name || ''}
                onChange={(e) => setEditingFolder(f => f ? {...f, name: e.target.value} : null)}
                placeholder="e.g., High Priority"
                className="bg-background border-border dark:border-border"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Search Query
              </label>
              <Input
                value={editingFolder?.query || ''}
                onChange={(e) => setEditingFolder(f => f ? {...f, query: e.target.value} : null)}
                placeholder="e.g., subject:(urgent OR priority)"
                className="bg-background border-border dark:border-border"
              />
              <p className="text-xs text-foreground0">
                Use Gmail search operators to filter emails
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingFolder(null)}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateFolder}>
                Update Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 