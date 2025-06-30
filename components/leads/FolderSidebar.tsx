'use client';

import { useState, useEffect } from "react";
import { Folder, FolderOpen, Plus, Tag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from '@/lib/auth-client';
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Folder {
  id: string;
  name: string;
  workspace_id: string;
  count?: number;
}

interface FolderSidebarProps {
  workspaceId: string;
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onManageFolders: () => void;
}

export function FolderSidebar({
  workspaceId,
  selectedFolderId,
  onFolderSelect,
  onManageFolders,
}: FolderSidebarProps) {
  const { session } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [unassignedCount, setUnassignedCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);

  const loadFolders = async () => {
    if (!workspaceId || !session?.access_token) return;
    
    try {
      setLoading(true);
      
      // Use API endpoint instead of direct Supabase query
      const response = await fetch(`/api/lead-folders?workspace_id=${workspaceId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch folders');
      }

      const data = await response.json();
      setFolders(data.folders || []);
      
      // Get all leads for this workspace to calculate counts manually
      const { data: workspaceLeads, error: countsError } = await supabase
        .from('leads')
        .select('folder_id')
        .eq('workspace_id', workspaceId);
      
      if (countsError) throw countsError;
      
      // Calculate counts manually from the results
      const countMap: Record<string, number> = {};
      let totalLeads = workspaceLeads?.length || 0;
      let nullCount = 0;
      
      // Count leads by folder
      workspaceLeads?.forEach(lead => {
        if (lead.folder_id === null) {
          nullCount++;
        } else {
          countMap[lead.folder_id] = (countMap[lead.folder_id] || 0) + 1;
        }
      });
      
      // We already calculated nullCount and totalLeads in the earlier section
      // No need for additional queries since we have the complete dataset already
      
      setFolderCounts(countMap);
      setUnassignedCount(nullCount);
      setTotalCount(totalLeads);
      
    } catch (error) {
      console.error("Error loading folders:", error);
      toast.error("Failed to load folders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      loadFolders();
    }
  }, [workspaceId, session?.access_token]);

  return (
    <div className="w-56 border-r border-border">
      <div className="p-3">
        <h3 className="font-medium text-foreground mb-3">Folders</h3>
        
        <div className="space-y-1">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-left font-normal",
              selectedFolderId === null && selectedFolderId !== "unassigned" 
                ? "bg-background/60 text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onFolderSelect(null)}
          >
            <Tag className="h-4 w-4 mr-2" />
            <span>All Leads</span>
            <Badge className="ml-auto bg-background text-foreground dark:text-neutral-300" variant="outline">
              {totalCount}
            </Badge>
          </Button>
          
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-left font-normal",
              selectedFolderId === "unassigned" 
                ? "bg-background/60 text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onFolderSelect("unassigned")}
          >
            <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>Unassigned</span>
            <Badge className="ml-auto bg-background text-foreground dark:text-neutral-300" variant="outline">
              {unassignedCount}
            </Badge>
          </Button>
          
          {loading ? (
            <div className="py-2 px-3 text-sm text-muted-foreground">
              <div className="animate-pulse h-4 w-full bg-background rounded"></div>
            </div>
          ) : folders.length === 0 ? (
            <div className="py-2 px-3 text-sm text-muted-foreground">
              No folders yet
            </div>
          ) : (
            folders.map((folder) => (
              <Button
                key={folder.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  selectedFolderId === folder.id 
                    ? "bg-background/60 text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => onFolderSelect(folder.id)}
              >
                {selectedFolderId === folder.id ? (
                  <FolderOpen className="h-4 w-4 mr-2 text-blue-400" />
                ) : (
                  <Folder className="h-4 w-4 mr-2 text-blue-400" />
                )}
                <span className="truncate">{folder.name}</span>
                <Badge className="ml-auto bg-background text-foreground dark:text-neutral-300" variant="outline">
                  {folderCounts[folder.id] || 0}
                </Badge>
              </Button>
            ))
          )}
        </div>
      </div>
      
      <div className="p-3 pt-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full bg-background hover:bg-gray-200 dark:bg-muted border-border dark:border-border mt-4"
          onClick={onManageFolders}
        >
          <Plus className="h-4 w-4 mr-2" />
          Manage Folders
        </Button>
      </div>
    </div>
  );
} 