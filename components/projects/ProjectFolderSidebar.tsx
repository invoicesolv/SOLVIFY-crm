'use client';

import { useState, useEffect } from "react";
import { Folder, FolderOpen, Plus, Tag } from "lucide-react";
// Removed direct supabase import - using API endpoints instead
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProjectFolder {
  id: string;
  name: string;
  workspace_id: string;
  count?: number;
}

interface ProjectFolderSidebarProps {
  workspaceId: string;
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onManageFolders: () => void;
  refreshTrigger?: number;
  displayedProjects?: Array<{
    id?: string;
    name: string;
    folder_id?: string | null;
  }>;
}

export function ProjectFolderSidebar({
  workspaceId,
  selectedFolderId,
  onFolderSelect,
  onManageFolders,
  refreshTrigger,
  displayedProjects,
}: ProjectFolderSidebarProps) {
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [unassignedCount, setUnassignedCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);

  const loadFolders = async () => {
    if (!workspaceId) return;
    
    try {
      setLoading(true);
      
      // Use API endpoint instead of direct Supabase call
      const response = await fetch(`/api/project-folders?workspace_id=${workspaceId}`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch project folders');
      }
      
      const data = await response.json();
      setFolders(data.folders || []);
      
      // If we have displayedProjects, use them for counting (more accurate)
      if (displayedProjects && displayedProjects.length > 0) {
        const countMap: Record<string, number> = {};
        let totalProjects = displayedProjects.length;
        let nullCount = 0;
        
        // Count projects by folder from displayed projects
        displayedProjects.forEach(project => {
          if (project.folder_id === null || project.folder_id === undefined) {
            nullCount++;
          } else {
            countMap[project.folder_id] = (countMap[project.folder_id] || 0) + 1;
          }
        });
        
        console.log('[ProjectFolderSidebar] Project counts (from displayed projects):', {
          totalProjects,
          nullCount,
          countMap,
          displayedProjects
        });
        
        setFolderCounts(countMap);
        setUnassignedCount(nullCount);
        setTotalCount(totalProjects);
        return;
      }
      
      // Fallback to API endpoint query if no displayedProjects provided
      console.log('[ProjectFolderSidebar] No displayedProjects provided, fetching project counts via API');
      
      try {
        // Use the projects API endpoint to get all projects with folder information
        const projectsResponse = await fetch('/api/projects', {
          method: 'GET',
          credentials: 'include',
        });
        
        if (!projectsResponse.ok) {
          throw new Error('Failed to fetch projects for counting');
        }
        
        const projectsData = await projectsResponse.json();
        
        if (!projectsData.success || !projectsData.projects) {
          throw new Error('Invalid projects response');
        }
        
        // Calculate counts manually from the API results
        const countMap: Record<string, number> = {};
        let totalProjects = projectsData.projects.length;
        let nullCount = 0;
        
        // Count projects by folder
        projectsData.projects.forEach((project: any) => {
          if (project.folder_id === null || project.folder_id === undefined) {
            nullCount++;
          } else {
            countMap[project.folder_id] = (countMap[project.folder_id] || 0) + 1;
          }
        });
        
        console.log('[ProjectFolderSidebar] Project counts (from API):', {
          totalProjects,
          nullCount,
          countMap,
          projectsCount: projectsData.projects.length
        });
        
        setFolderCounts(countMap);
        setUnassignedCount(nullCount);
        setTotalCount(totalProjects);
        
      } catch (apiError) {
        console.error('[ProjectFolderSidebar] Failed to fetch project counts via API:', apiError);
        // Set empty counts if API fails
        setFolderCounts({});
        setUnassignedCount(0);
        setTotalCount(0);
      }
      
    } catch (error) {
      console.error("Error loading project folders:", error);
      toast.error("Failed to load project folders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolders();
  }, [workspaceId, refreshTrigger]);

  return (
    <div className="w-56 border-r border-border">
      <div className="p-3">
        <h3 className="font-medium text-foreground mb-3">Project Folders</h3>
        
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
            <span>All Projects</span>
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