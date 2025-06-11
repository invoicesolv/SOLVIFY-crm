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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ArrowRight, Folder, FolderOpen } from "lucide-react";

interface Project {
  id: string;
  name: string;
  folder_id: string | null;
  workspace_id: string;
}

interface ProjectFolder {
  id: string;
  name: string;
}

interface Task {
  id: string;
  title: string;
  project_id?: string;
}

interface ChecklistItem {
  id: number;
  text: string;
  done: boolean;
  assigned_to?: string;
}

interface SubtaskMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  subtask: ChecklistItem | null;
  currentProject: Project | null;
  workspaceId: string;
  onSubtaskMoved: () => void;
}

export function SubtaskMoveDialog({
  open,
  onOpenChange,
  task,
  subtask,
  currentProject,
  workspaceId,
  onSubtaskMoved,
}: SubtaskMoveDialogProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);

  const fetchProjectsAndFolders = async () => {
    if (!workspaceId) return;
    
    try {
      setLoading(true);
      
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, name, folder_id, workspace_id")
        .eq("workspace_id", workspaceId)
        .neq("status", "completed")
        .order("name", { ascending: true });

      if (projectsError) throw projectsError;
      
      // Fetch folders
      const { data: foldersData, error: foldersError } = await supabase
        .from("project_folders")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true });

      if (foldersError) {
        console.warn("Project folders table might not exist yet:", foldersError);
        setFolders([]);
      } else {
        setFolders(foldersData || []);
      }
      
      // Filter out the current project
      const availableProjects = (projectsData || []).filter(p => p.id !== currentProject?.id);
      setProjects(availableProjects);
      
    } catch (error) {
      console.error("Error fetching projects and folders:", error);
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchProjectsAndFolders();
      setSelectedProjectId("");
    }
  }, [open, workspaceId, currentProject?.id]);

  const handleMoveSubtask = async () => {
    if (!task || !subtask || !selectedProjectId) {
      toast.error("Please select a project");
      return;
    }

    try {
      setMoving(true);
      
      // First, get the current task data
      const { data: currentTaskData, error: fetchError } = await supabase
        .from("project_tasks")
        .select("checklist")
        .eq("id", task.id)
        .single();

      if (fetchError) throw fetchError;

      // Remove the subtask from the current task
      const updatedCurrentChecklist = (currentTaskData.checklist || []).filter(
        (item: ChecklistItem) => item.id !== subtask.id
      );

      // Update the current task
      const { error: updateCurrentError } = await supabase
        .from("project_tasks")
        .update({ checklist: updatedCurrentChecklist })
        .eq("id", task.id);

      if (updateCurrentError) throw updateCurrentError;

      // Get the target project's workspace info
      const { data: targetProjectData, error: targetProjectError } = await supabase
        .from("projects")
        .select("workspace_id")
        .eq("id", selectedProjectId)
        .single();

      if (targetProjectError) throw targetProjectError;

      // Create a new task in the target project with just this subtask
      const newTask = {
        title: subtask.text,
        project_id: selectedProjectId,
        workspace_id: targetProjectData.workspace_id,
        user_id: currentProject?.workspace_id, // This should be the actual user_id
        progress: subtask.done ? 100 : 0,
        checklist: [{
          id: 1,
          text: subtask.text,
          done: subtask.done,
          assigned_to: subtask.assigned_to
        }],
        assigned_to: subtask.assigned_to
      };

      const { error: createError } = await supabase
        .from("project_tasks")
        .insert([newTask]);

      if (createError) throw createError;

      const targetProject = projects.find(p => p.id === selectedProjectId);
      toast.success(`Subtask moved to ${targetProject?.name || 'selected project'} as a new task`);
      
      onSubtaskMoved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error moving subtask:", error);
      toast.error("Failed to move subtask");
    } finally {
      setMoving(false);
    }
  };

  const getFolderName = (folderId: string | null) => {
    if (!folderId) return "Unassigned";
    const folder = folders.find(f => f.id === folderId);
    return folder?.name || "Unknown Folder";
  };

  const groupedProjects = projects.reduce((acc, project) => {
    const folderKey = project.folder_id || "unassigned";
    if (!acc[folderKey]) {
      acc[folderKey] = [];
    }
    acc[folderKey].push(project);
    return acc;
  }, {} as Record<string, Project[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Move Subtask</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Move "{subtask?.text}" to a different project as a new task.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>From:</span>
            <div className="flex items-center space-x-1">
              <Folder className="h-4 w-4" />
              <span>{currentProject?.name} → {task?.title}</span>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">To:</label>
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto mb-2" />
                Loading projects...
              </div>
            ) : (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  {Object.entries(groupedProjects).map(([folderKey, folderProjects]) => (
                    <div key={folderKey}>
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center space-x-1">
                        {folderKey === "unassigned" ? (
                          <Folder className="h-3 w-3" />
                        ) : (
                          <FolderOpen className="h-3 w-3" />
                        )}
                        <span>{getFolderName(folderKey === "unassigned" ? null : folderKey)}</span>
                      </div>
                      {folderProjects.map((project) => (
                        <SelectItem 
                          key={project.id} 
                          value={project.id}
                          className="pl-6 text-foreground hover:bg-background/50"
                        >
                          {project.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <div className="p-4 text-center text-muted-foreground">
                      No other projects available
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
            <strong>Note:</strong> This subtask will be moved to the selected project as a new task.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleMoveSubtask} 
            disabled={!selectedProjectId || moving}
            className="flex items-center gap-2"
          >
            {moving ? "Moving..." : "Move Subtask"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 