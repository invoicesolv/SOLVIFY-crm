"use client";

import { Card } from "@/components/ui/card";
import { AnimatedBorderCard } from "@/components/ui/animated-border-card";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Plus, Search, Trash2, X, Mail, Settings2, LinkIcon, Users, User, UserPlus, AlertCircle, FileText, Link2, CheckCircle, XCircle, Clock, ArrowRightLeft, Folder, Globe, CheckSquare, Square, Minus } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { TaskExpanded } from "./TaskExpanded";
import { TaskForm } from "./TaskForm";
import { ReportButtons } from "./ReportButtons";
// Removed direct supabase imports - using API endpoints instead
import { toast } from "sonner";
import React from "react";
import { useAuth } from '@/lib/auth-client';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from "@/components/ui/dialog"
import { TaskManager } from "@/components/projects/TaskManager";
import { Switch } from "@/components/ui/switch";
import { EmailSettings } from "./EmailSettings";
import { Squares } from "@/components/ui/squares-background";
import { Loader2 } from "lucide-react";
import { AlertOctagon } from "lucide-react";
import { checkPermission, getActiveWorkspaceId } from '@/lib/permission';
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useProjectAssignments } from "@/hooks/useProjectAssignments";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { TimeTrackingSummary } from "./TimeTrackingSummary";
import { ProjectFolderSidebar } from "./ProjectFolderSidebar";
import { ProjectFolderManagementDialog } from "./ProjectFolderManagementDialog";
import { TaskMoveDialog } from "./TaskMoveDialog";
import { SubtaskMoveDialog } from "./SubtaskMoveDialog";
import type { Tables } from "@/lib/database.types";
import type { ChecklistItem, Task } from "@/types/project";

// Map of technical names to display names
const PROJECT_DISPLAY_NAMES: { [key: string]: string } = {
  'drsannas': 'Dr. Sannas',
  'elkontakten': 'Elkontakten',
  'nicotine-pouches': 'Nicotine Pouches',
  'nosium': 'Nosium',
  'polarlotto': 'PolarLotto',
  'solvify-internal': 'Solvify',
  'teamhub': 'TeamHub',
  'templar': 'Templar'
};

interface Project {
  id?: string;
  name: string;
  status: 'active' | 'completed' | 'on-hold';
  startDate?: string;
  endDate?: string;
  description?: string;
  tasks: Task[];
  customer_name?: string;
  assigned_to?: string | null;
  folder_id?: string | null;
}

interface Customer {
  id: string;
  name: string;
  workspace_id: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  total_amount: number;
  status: string;
  due_date: string;
  created_at: string;
  linked_to_project?: boolean;
}

interface Domain {
  id: string;
  domain: string;
  display_domain?: string;
  domain_rating?: number;
  traffic_value?: number;
  organic_traffic?: number;
  referring_domains?: number;
  organic_keywords?: number;
  source: 'ahrefs' | 'Loopia';
  last_updated: string;
  workspace_id?: string;
  expiry_date?: string;
  status?: string;
  linked_to_project?: boolean;
}

interface ProjectsViewProps {
  className?: string;
}

export function ProjectsView({ className }: ProjectsViewProps) {
  const [search, setSearch] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isAddingTask, setIsAddingTask] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<{ projectName: string; taskId: string } | null>(null);
  const [isBulkAdding, setIsBulkAdding] = useState<string | null>(null);
  const [bulkTaskInput, setBulkTaskInput] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [showEmailSettings, setShowEmailSettings] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [linkedInvoiceIds, setLinkedInvoiceIds] = useState<string[]>([]);
  const [showInvoiceSection, setShowInvoiceSection] = useState(false);
  const { members } = useWorkspaceMembers();
  const { assignProject, getMemberByUserId } = useProjectAssignments();
  const [showTimeTrackingForProject, setShowTimeTrackingForProject] = useState<string | null>(null);
  
  // Folder-related state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showFolderManagement, setShowFolderManagement] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  
  // Folder assignment dialog state
  const [folderAssignmentDialog, setFolderAssignmentDialog] = useState(false);
  const [projectToAssignFolder, setProjectToAssignFolder] = useState<Project | null>(null);
  const [selectedProjectFolderId, setSelectedProjectFolderId] = useState<string>('');
  const [availableFolders, setAvailableFolders] = useState<{id: string, name: string}[]>([]);
  
  // Task move dialog state - using types that match TaskMoveDialog component
  const [taskMoveDialog, setTaskMoveDialog] = useState<{
    open: boolean;
    task: { id: string; title: string; project_id: string } | null;
    currentProject: { id: string; name: string; folder_id: string | null; workspace_id: string } | null;
  }>({
    open: false,
    task: null,
    currentProject: null,
  });

  // Subtask move dialog state
  const [subtaskMoveDialog, setSubtaskMoveDialog] = useState<{
    open: boolean;
    task: { id: string; title: string; project_id?: string } | null;
    subtask: { id: number; text: string; done: boolean; assigned_to?: string } | null;
    currentProject: { id: string; name: string; folder_id: string | null; workspace_id: string } | null;
  }>({
    open: false,
    task: null,
    subtask: null,
    currentProject: null,
  });

  // Domain-related state
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [linkedDomainIds, setLinkedDomainIds] = useState<string[]>([]);
  const [showDomainSection, setShowDomainSection] = useState(false);
  const [domainSearch, setDomainSearch] = useState('');
  const [domainPage, setDomainPage] = useState(1);
  const [totalDomains, setTotalDomains] = useState(0);
  const [expandedBacklinks, setExpandedBacklinks] = useState(false);
  const DOMAINS_PER_PAGE = 20;

  // Bulk project selection state
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [showBulkFolderDialog, setShowBulkFolderDialog] = useState(false);
  const [bulkFolderSelection, setBulkFolderSelection] = useState<string>('');
  
  // Function to get member name by ID
  const getAssignedMemberName = (userId?: string) => {
    if (!userId) return null;
    console.log('[Projects] Getting member name for userId:', userId);
    console.log('[Projects] Direct members array:', members.length, members.map(m => ({ id: m.user_id, name: m.name })));
    const member = getMemberByUserId(userId);
    console.log('[Projects] Found member:', member);
    return member ? member.name : null;
  };

  // Function to handle assigning a project
  const handleAssignProject = async (projectId?: string, userId?: string) => {
    if (!projectId) return;
    
    try {
      await assignProject(projectId, userId || '');
      // Refresh projects to show updated assignment
      fetchProjects();
      toast.success('Project assignment updated');
    } catch (error) {
      console.error('[Projects] Error assigning project:', error);
      toast.error('Failed to update project assignment');
    }
  };

  // Helper function to create authenticated fetch requests
  // Uses cookie-based NextAuth authentication (no need for explicit Authorization header)
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for NextAuth
    });
  };

  // Calculate progress for a task
  const calculateTaskProgress = (task: Task): Task => {
    const completedItems = task.checklist.filter(item => item.done).length;
    const totalItems = task.checklist.length;
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    return {
      ...task,
      progress
    };
  };

  // Calculate progress for all tasks in a project
  const calculateProjectProgress = (project: Project): Project => {
    const tasks = project.tasks || [];
    const totalTasks = tasks.length;
    
    if (totalTasks === 0) {
      return project;
    }
    
    // Calculate progress based on task completion percentage
    const totalProgress = tasks.reduce((acc, task) => acc + task.progress, 0);
    const overallProgress = Math.round(totalProgress / totalTasks);
    
    const updatedProject = { ...project };

    // Update project status based on progress
    if (overallProgress === 100 && project.status !== 'completed') {
      updatedProject.status = 'completed';
      if (updatedProject.id) {
        updateProjectStatusInDatabase(updatedProject.id, 'completed');
      }
    } else if (overallProgress < 100 && project.status === 'completed') {
      updatedProject.status = 'active';
      if (updatedProject.id) {
        updateProjectStatusInDatabase(updatedProject.id, 'active');
      }
    }

    // REMOVED: Hardcoded automation triggers
    // These should only work when explicitly configured in the automation builder
    
    return updatedProject;
  };

  // Helper function to update project status in database
  const updateProjectStatusInDatabase = async (projectId: string, status: 'active' | 'completed' | 'on-hold') => {
    try {
      const response = await authenticatedFetch(`/api/projects?id=${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update project status: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to update project status');
      }
      
      console.log(`Project ${projectId} status updated to: ${status}`);
    } catch (error) {
      console.error('Error updating project status:', error);
    }
  };

  // Initialize workspace ID using proper workspace selection logic
  useEffect(() => {
    const initializeWorkspace = async () => {
      if (user?.id) {
        try {
          console.log('[Projects] Initializing workspace for user:', user.id);
          
          // Use the same API endpoint as the permission check
          const response = await authenticatedFetch('/api/workspace/leave');
          if (!response.ok) {
            throw new Error('Failed to fetch workspaces');
          }
          const data = await response.json();
          
          console.log('[Projects] API response data:', data);
          
          // The API response structure based on server logs shows:
          // data.workspaces = [{ id: '...', name: '...', owner_id: '...', role: 'admin', created_at: '...' }]
          if (data.workspaces && data.workspaces.length > 0) {
            // Use proper workspace selection logic: prioritize admin workspaces first
            const adminWorkspace = data.workspaces.find((w: any) => w.role === 'admin');
            const selectedWorkspace = adminWorkspace || data.workspaces[0];
            const workspaceId = selectedWorkspace.id;
            console.log('[Projects] Selected workspace using priority logic:', {
              totalWorkspaces: data.workspaces.length,
              hasAdminWorkspace: !!adminWorkspace,
              selectedWorkspaceId: workspaceId,
              selectedWorkspaceRole: selectedWorkspace.role,
              allWorkspaces: data.workspaces.map((w: any) => ({ id: w.id, role: w.role, name: w.name }))
            });
            setWorkspaceId(workspaceId);
          } else {
            console.log('[Projects] No workspaces found for user, data:', data);
          }
        } catch (error) {
          console.error('[Projects] Error getting workspace ID:', error);
        }
      }
    };
    
    initializeWorkspace();
  }, [user?.id]);

  // Load available folders when workspace is set
  useEffect(() => {
    if (workspaceId) {
      fetchAvailableFolders();
    }
  }, [workspaceId]);

  // Force refresh when available folders change
  useEffect(() => {
    // Trigger refresh to update folder counts in sidebar
    setRefreshTrigger(prev => prev + 1);
  }, [availableFolders]);

  // Initial fetch of projects
  useEffect(() => {
    if (user?.id) {
      // Check if user has permission to view projects using the workspace API
      const checkProjectPermission = async () => {
        try {
          console.log('[Projects] Checking permission for user:', user.email);
          
          // Use the same API endpoint as dashboard and team page
          const response = await authenticatedFetch('/api/workspace/leave');
          if (!response.ok) {
            throw new Error('Failed to fetch workspaces');
          }
          const data = await response.json();
          
          if (!data.success || !data.workspaces || data.workspaces.length === 0) {
            console.log('[Projects] No workspaces found for user');
            setPermissionDenied(true);
            setLoading(false);
            return;
          }
          
          console.log('[Projects] Found workspaces:', data.workspaces);
          
          // Since we have workspaces, the user has access - skip RLS permission checks
          // Admin bypass handles all authentication through API endpoints
          console.log('[Projects] User has workspace access, proceeding with projects fetch');
          
          // User has permission, fetch projects using API endpoint
          fetchProjects();
          
          // fetchCustomers(); // Disabled - uses direct Supabase calls
          
        } catch (error) {
          console.error('[Projects] Error checking permissions:', error);
          setPermissionDenied(true);
          setLoading(false);
        }
      };
      
      checkProjectPermission();
    }
  }, [user?.id]);

  // New helper function to fetch projects with known team memberships
  const fetchProjectsWithMemberships = async (teamMemberships: any[]) => {
    try {
      // Get workspace IDs for this user
      const workspaceIds = teamMemberships.map(tm => tm.workspace_id);
      console.log('[Projects] Workspace IDs:', workspaceIds);

      // DISABLED: This function uses old supabase client causing tasks to disappear
      // Use the main fetchProjects function instead which uses API endpoints
      console.warn('[Projects] fetchProjectsWithMemberships is disabled - use fetchProjects() instead');
      return;
    } catch (error) {
      console.error('[Projects] Error in fetchProjects:', error);
      toast.error('Failed to load projects');
      setLoading(false);
    }
  };

  // Fetch projects from Supabase
  const fetchProjects = async () => {
    try {
      console.log('[Projects] Session check:', {
        hasSession: !!user,
        hasUser: !!user,
        hasUserId: !!user?.id,
        userEmail: user?.email,
        userId: user?.id
      });
      
      // Use API endpoint instead of direct Supabase calls to avoid auth issues
      console.log('[Projects] Using API endpoint to fetch projects');
      
      const response = await authenticatedFetch('/api/projects');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch projects');
      }
      
      console.log('[Projects] API response:', data.projects?.length || 0, 'projects');
      
      if (!data.projects || data.projects.length === 0) {
        console.log('[Projects] No projects found for user');
        setProjects([]);
        setLoading(false);
        return;
      }

      // Process the projects data
      const projectsWithTasks = data.projects.map((project: any) => ({
        ...project,
        tasks: project.tasks || [],
        status: (project.status?.toLowerCase() || 'active') as 'active' | 'completed' | 'on-hold',
        assigned_to: project.assigned_to || undefined
      }));

      console.log('[Projects] Formatted projects:', projectsWithTasks.length, 'projects');
      console.log('[Projects] Raw projects data:', projectsWithTasks);
      setProjects(projectsWithTasks.map(calculateProjectProgress));
      console.log('[Projects] Projects set in state, loading:', false);
      setLoading(false);
    } catch (error) {
      console.error('[Projects] Error in fetchProjects:', error);
      toast.error('Failed to load projects');
      setLoading(false);
    }
  };

  // Update task via API endpoint
  const updateTaskInSupabase = async (projectId: string, taskId: string, updates: any) => {
    try {
      const response = await authenticatedFetch(`/api/project-tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update task: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to update task');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
      throw error;
    }
  };

  // Add task via API endpoint
  const addTaskToSupabase = async (projectId: string, taskData: Omit<Task, 'id' | 'progress'>) => {
    try {
      if (!user?.id) {
        toast.error('You must be logged in to add tasks');
        return null;
      }

      // Create task with API endpoint
      const task = {
        ...taskData,
        project_id: projectId,
        progress: 0,
        user_id: user.id
      };

      const response = await authenticatedFetch('/api/project-tasks', {
        method: 'POST',
        body: JSON.stringify(task),
      });

      if (!response.ok) {
        throw new Error(`Failed to add task: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to add task');
      }

      return result.task;
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task');
      throw error;
    }
  };

  // Delete task via API endpoint
  const deleteTaskFromSupabase = async (projectId: string, taskId: string) => {
    try {
      const response = await authenticatedFetch(`/api/project-tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete task: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
      throw error;
    }
  };

  const handleChecklistItemToggle = async (taskId: string, itemId: number, isDone: boolean) => {
    try {
      const project = selectedProject;
      if (!project || !project.id) {
        toast.error('Project not found');
        return;
      }

      const task = project.tasks.find(t => t.id === taskId);
      if (!task) return;

      const updatedChecklist = task.checklist.map(item =>
        item.id === itemId ? { ...item, done: isDone } : item
      );

      // Calculate progress as an integer
      const completedItems = updatedChecklist.filter(item => item.done).length;
      const totalItems = updatedChecklist.length;
      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      // Update local state first
      setProjects(prevProjects => prevProjects.map(p => {
        if (p.id === project.id) {
          const updatedProject = {
            ...p,
            tasks: p.tasks.map(t =>
              t.id === taskId
                ? { ...t, checklist: updatedChecklist, progress }
                : t
            )
          };
          // Recalculate project progress and status
          return calculateProjectProgress(updatedProject);
        }
        return p;
      }));

      // Then update via API endpoint
      await updateTaskInSupabase(project.id, taskId, {
        checklist: updatedChecklist,
        progress
      });
    } catch (error) {
      console.error('Error updating checklist item:', error);
      toast.error('Failed to update checklist item');
    }
  };

  const handleAddTask = async (projectName: string, task: Omit<Task, 'id' | 'progress'>) => {
    try {
      const project = projects.find(p => p.name === projectName);
      if (!project || !project.id) {
        toast.error('Project not found');
        return;
      }

      const newTask = await addTaskToSupabase(project.id, task);

      setProjects(prevProjects =>
        prevProjects.map(p =>
          p.name === projectName
            ? {
                ...p,
                tasks: [...p.tasks, { ...newTask, project_id: project.id }] // Ensure project_id is set
              }
            : p
        )
      );

      setIsAddingTask(null);
      toast.success('Task added successfully');
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task');
    }
  };

  const handleEditTask = async (projectName: string, taskId: string, updates: Omit<Task, 'id' | 'progress'>) => {
    try {
      const project = projects.find(p => p.name === projectName);
      if (!project || !project.id) {
        toast.error('Project not found');
        return;
      }

      await updateTaskInSupabase(project.id, taskId, updates);

      setProjects(prevProjects =>
        prevProjects.map(p =>
          p.name === projectName
            ? {
                ...p,
                tasks: p.tasks.map(t =>
                  t.id === taskId
                    ? { ...t, ...updates }
                    : t
                )
              }
            : p
        )
      );

      setEditingTask(null);
      toast.success('Task updated successfully');
    } catch (error) {
      console.error('Error editing task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (projectName: string, taskId: string) => {
    try {
      const project = projects.find(p => p.name === projectName);
      if (!project || !project.id) {
        toast.error('Project not found');
        return;
      }

      await deleteTaskFromSupabase(project.id, taskId);

      setProjects(prevProjects =>
        prevProjects.map(p =>
          p.name === projectName
            ? {
                ...p,
                tasks: p.tasks.filter(t => t.id !== taskId)
              }
            : p
        )
      );

      setEditingTask(null);
      toast.success('Task deleted successfully');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const handleBulkAddTasks = async (projectName: string) => {
    try {
      const project = projects.find(p => p.name === projectName);
      if (!project || !project.id) {
        toast.error('Project not found');
        return;
      }

      if (!user?.id) {
        toast.error('You must be logged in to add tasks');
        return;
      }

      // No need to get workspace_id manually - API will handle it

      // Split input into tasks and their subtasks
      const lines = bulkTaskInput.trim().split('\n');
      const tasks: { title: string; subtasks: string[] }[] = [];
      let currentTask: { title: string; subtasks: string[] } | null = null;

      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        if (!line.startsWith('  ') && !line.startsWith('\t')) {
          // This is a main task
          if (currentTask) {
            tasks.push(currentTask);
          }
          currentTask = { title: trimmedLine, subtasks: [] };
        } else if (currentTask) {
          // This is a subtask
          currentTask.subtasks.push(trimmedLine.trim());
        }
      });

      // Add the last task if exists
      if (currentTask) {
        tasks.push(currentTask);
      }

      // Create tasks in Supabase
      for (const task of tasks) {
        const newTask = {
          title: task.title,
          project_id: project.id,
          user_id: user.id,
          progress: 0,
          checklist: task.subtasks.map((text, index) => ({
            id: index + 1,
            text,
            done: false
          }))
        };

        // Use API endpoint instead of direct Supabase call
        const data = await addTaskToSupabase(project.id, newTask);
        
        if (!data) {
          toast.error(`Failed to add task: ${task.title}`);
          continue;
        }

        setProjects(prevProjects =>
          prevProjects.map(p =>
            p.name === projectName
              ? {
                  ...p,
                  tasks: [...p.tasks, { ...data, project_id: project.id }] // Ensure project_id is set
                }
              : p
          )
        );
      }

      setBulkTaskInput("");
      setIsBulkAdding(null);
      toast.success('Tasks added successfully');
    } catch (error) {
      console.error('Error adding tasks:', error);
      toast.error('Failed to add tasks');
    }
  };

  // Delete project using API endpoint
  const deleteProject = async (projectId: string | undefined) => {
    if (!projectId) {
      toast.error('Cannot delete project: Invalid project ID');
      return;
    }

    if (!user?.id) {
      toast.error('You must be logged in to delete projects');
      return;
    }

    try {
      console.log('[Frontend] Deleting project:', projectId);
      
      const response = await authenticatedFetch(`/api/projects?id=${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete project');
      }

      const result = await response.json();
      console.log('[Frontend] Project deleted successfully:', result);

      // Update local state
      setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId));
      toast.success(result.message || 'Project deleted successfully');
    } catch (error) {
      console.error('[Frontend] Error deleting project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete project');
    }
  };

  const handleTasksChange = async (projectName: string, updatedTasks: Task[]) => {
    if (!selectedProject?.id) return;
    
    try {
      // Find tasks that actually changed to minimize PATCH requests
      const changedTasks = updatedTasks.filter(newTask => {
        const oldTask = selectedProject.tasks.find(t => t.id === newTask.id);
        return !oldTask || JSON.stringify(oldTask) !== JSON.stringify(newTask);
      });

      if (changedTasks.length === 0) return;

      // Only update changed tasks
      for (const task of changedTasks) {
        await updateTaskInSupabase(selectedProject.id, task.id, task);
      }

      // Update both states in one go
      const updatedProject = { ...selectedProject, tasks: updatedTasks };
      setSelectedProject(updatedProject);
      setProjects(prevProjects => 
        prevProjects.map(p => p.id === selectedProject.id ? updatedProject : p)
      );
    } catch (error) {
      console.error('Error updating tasks:', error);
      toast.error('Failed to update tasks');
    }
  };

  const handleTaskUpdate = async (projectName: string, taskId: string, updates: Partial<Task>) => {
    if (!selectedProject?.id) return;

    try {
      await updateTaskInSupabase(selectedProject.id, taskId, updates);

      // Update both states in one go
      const updatedTasks = selectedProject.tasks.map(t => 
        t.id === taskId ? { ...t, ...updates } : t
      );
      const updatedProject = calculateProjectProgress({ ...selectedProject, tasks: updatedTasks });
      
      setSelectedProject(updatedProject);
      setProjects(prevProjects => 
        prevProjects.map(p => p.id === selectedProject.id ? updatedProject : p)
      );
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleChecklistItemUpdate = async (taskId: string, itemId: number, isDone: boolean) => {
    if (!selectedProject?.id) return;

    try {
      const task = selectedProject.tasks.find(t => t.id === taskId);
      if (!task) return;

      const updatedChecklist = task.checklist.map(item =>
        item.id === itemId ? { ...item, done: isDone } : item
      );

      const progress = Math.round((updatedChecklist.filter(item => item.done).length / updatedChecklist.length) * 100);

      const updates = {
        checklist: updatedChecklist,
        progress
      };

      await updateTaskInSupabase(selectedProject.id, taskId, updates);

      // Update both states in one go
      const updatedTasks = selectedProject.tasks.map(t => 
        t.id === taskId ? { ...t, ...updates } : t
      );
      const updatedProject = calculateProjectProgress({ ...selectedProject, tasks: updatedTasks });
      
      setSelectedProject(updatedProject);
      setProjects(prevProjects => 
        prevProjects.map(p => p.id === selectedProject.id ? updatedProject : p)
      );
    } catch (error) {
      console.error('Error updating checklist item:', error);
      toast.error('Failed to update checklist item');
    }
  };

  const filteredProjects = projects.filter(project => {
    const displayName = PROJECT_DISPLAY_NAMES[project.name] || project.name;
    const matchesSearch = displayName.toLowerCase().includes(search.toLowerCase());
    
    // Apply folder filtering
    if (selectedFolderId === null) {
      // Show all projects when "All Projects" is selected
      return matchesSearch;
    } else if (selectedFolderId === "unassigned") {
      // Show only projects without a folder
      return matchesSearch && (project.folder_id === null || project.folder_id === undefined);
    } else {
      // Show only projects in the selected folder
      return matchesSearch && project.folder_id === selectedFolderId;
    }
  });

  // New function to fetch customers
  const fetchCustomers = async () => {
    if (!user?.id) return;
    
    setLoadingCustomers(true);
    try {
      // Get the active workspace ID
      const workspaceId = await getActiveWorkspaceId(user.id);
      
      if (!workspaceId) {
        console.log('[Projects] No active workspace found');
        setLoadingCustomers(false);
        return;
      }
      
      // DISABLED: Function uses direct Supabase calls which cause authentication issues
      console.warn('[Projects] fetchCustomers is disabled - uses direct Supabase calls');
      setCustomers([]);
      setLoadingCustomers(false);
      return;
    } catch (error) {
      console.error('[Projects] Error in fetchCustomers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  // Open the customer assignment dialog
  const openCustomerDialog = (project: Project) => {
    setProjectToEdit(project);
    setSelectedCustomerId('');
    setCustomerSearch('');
    
    // Find the customer ID if this project already has a customer_name
    if (project.customer_name) {
      const customer = customers.find(c => c.name === project.customer_name);
      if (customer) {
        setSelectedCustomerId(customer.id);
      }
    }
    
    setCustomerDialogOpen(true);
  };

  // Update the project's customer association
  const updateProjectCustomer = async () => {
    if (!projectToEdit || !selectedCustomerId) return;
    
    try {
      // Find the selected customer
      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
      if (!selectedCustomer) {
        toast.error('Selected customer not found');
        return;
      }
      
      // Update the project via API endpoint
      const response = await authenticatedFetch(`/api/projects?id=${projectToEdit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          customer_name: selectedCustomer.name
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update project customer: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to update project customer');
      }
      
      // Update local state
      setProjects(projects.map(p => 
        p.id === projectToEdit.id 
          ? { ...p, customer_name: selectedCustomer.name } 
          : p
      ));
      
      toast.success(`Project linked to ${selectedCustomer.name}`);
      setCustomerDialogOpen(false);
    } catch (error) {
      console.error('[Projects] Error in updateProjectCustomer:', error);
      toast.error('Failed to update project customer');
    }
  };

  // Filter customers by search term
  const filteredCustomers = customers.filter(customer => 
    customer.name && customer.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Folder assignment functions
  const fetchAvailableFolders = async () => {
    if (!workspaceId) return;
    
    try {
      const response = await authenticatedFetch(`/api/project-folders?workspace_id=${workspaceId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch folders: ${response.status}`);
      }
      
      const data = await response.json();
      setAvailableFolders(data.folders || []);
    } catch (error) {
      console.error('Error fetching folders:', error);
      toast.error('Failed to load folders');
    }
  };

  // Open the folder assignment dialog
  const openFolderAssignmentDialog = (project: Project) => {
    console.log('Opening folder assignment dialog for project:', project.name);
    setProjectToAssignFolder(project);
    setSelectedProjectFolderId(project.folder_id || '');
    fetchAvailableFolders();
    setFolderAssignmentDialog(true);
  };

  // Update the project's folder assignment using API endpoint
  const updateProjectFolder = async () => {
    if (!projectToAssignFolder) return;
    
    try {
      const folderId = selectedProjectFolderId === '' ? null : selectedProjectFolderId;
      
      console.log('[Frontend] Updating project folder:', projectToAssignFolder.id, 'to folder:', folderId);
      
      const response = await fetch(`/api/projects?id=${projectToAssignFolder.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folder_id: folderId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update project folder');
      }

      const result = await response.json();
      console.log('[Frontend] Project folder updated successfully:', result);
      
      // Update local state
      setProjects(projects.map(p => 
        p.id === projectToAssignFolder.id 
          ? { ...p, folder_id: folderId } 
          : p
      ));
      
      const folderName = folderId ? availableFolders.find(f => f.id === folderId)?.name : 'Unassigned';
      toast.success(`Project moved to ${folderName}`);
      setFolderAssignmentDialog(false);
      
      // Refresh folder counts
      handleFoldersChanged();
    } catch (error) {
      console.error('[Frontend] Error updating project folder:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update project folder');
    }
  };

  // Fetch invoices for a customer
  const fetchInvoicesByCustomer = async (customerId: string, projectId?: string) => {
    if (!customerId) return;
    
    setLoadingInvoices(true);
    try {
      // DISABLED: Function uses direct Supabase calls which cause authentication issues
      console.warn('[Projects] fetchInvoicesByCustomer is disabled - uses direct Supabase calls');
      setInvoices([]);
      setLinkedInvoiceIds([]);
      setLoadingInvoices(false);
    } catch (error) {
      console.error('[Projects] Error in fetchInvoicesByCustomer:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Link/unlink an invoice to a project
  const toggleInvoiceLink = async (invoiceId: string, projectId?: string) => {
    if (!projectId || !invoiceId) {
      console.error('Missing project ID or invoice ID');
      toast.error('Failed to update invoice link: Missing required data');
      return;
    }
    
    const isCurrentlyLinked = linkedInvoiceIds.includes(invoiceId);
    
    try {
      console.log(`Attempting to ${isCurrentlyLinked ? 'unlink' : 'link'} invoice ${invoiceId} with project ${projectId}`);
      
      if (isCurrentlyLinked) {
        // DISABLED: Direct Supabase calls cause authentication issues
        console.warn('[Projects] toggleInvoiceLink unlink disabled - uses direct Supabase calls');
        throw new Error('Invoice unlinking disabled - uses direct Supabase calls');
        
        // Update local state
        setLinkedInvoiceIds(prev => prev.filter(id => id !== invoiceId));
        setInvoices(prev => prev.map(invoice => 
          invoice.id === invoiceId ? { ...invoice, linked_to_project: false } : invoice
        ));
        
        toast.success('Invoice unlinked from project');
      } else {
        // DISABLED: Direct Supabase calls cause authentication issues
        console.warn('[Projects] toggleInvoiceLink link disabled - uses direct Supabase calls');
        throw new Error('Invoice linking disabled - uses direct Supabase calls');
        
        // Update local state
        setLinkedInvoiceIds(prev => [...prev, invoiceId]);
        setInvoices(prev => prev.map(invoice => 
          invoice.id === invoiceId ? { ...invoice, linked_to_project: true } : invoice
        ));
        
        toast.success('Invoice linked to project');
      }
    } catch (error) {
      console.error('Error toggling invoice link:', error);
      toast.error('Failed to update invoice link');
    }
  };

  // Fetch invoices when a project is selected
  useEffect(() => {
    if (selectedProject && selectedProject.customer_name) {
      // First find the customer ID for this customer name
      const customer = customers.find(c => c.name === selectedProject.customer_name);
      if (customer) {
        fetchInvoicesByCustomer(customer.id, selectedProject.id);
      }
    } else {
      // Clear invoices if no project is selected
      setInvoices([]);
      setLinkedInvoiceIds([]);
    }
  }, [selectedProject, customers]);

  // Fetch domains for the workspace when a project is selected
  useEffect(() => {
    if (selectedProject && workspaceId) {
      // Always fetch domains when project is selected to populate backlinks progress
      fetchDomainsByWorkspace(workspaceId, selectedProject.id, '', 1);
    } else {
      // Clear domains if no project is selected
      setDomains([]);
      setLinkedDomainIds([]);
      setTotalDomains(0);
    }
  }, [selectedProject, workspaceId]);

  // Handle domain search and pagination when domain section is open
  useEffect(() => {
    if (selectedProject && workspaceId && showDomainSection && (domainSearch || domainPage > 1)) {
      // Only re-fetch when searching or changing pages, and domain section is open
      fetchDomainsByWorkspace(workspaceId, selectedProject.id, domainSearch, domainPage);
    }
  }, [domainSearch, domainPage, showDomainSection]);

  // Fetch domains for a workspace
  const fetchDomainsByWorkspace = async (workspaceId: string, projectId?: string, search: string = '', page: number = 1) => {
    if (!workspaceId) return;
    
    setLoadingDomains(true);
    try {
      // If we have a project ID, first fetch all linked domains for the backlinks progress
      let linkedIds: string[] = [];
      let allLinkedDomains: Domain[] = [];
      
      if (projectId) {
        // DISABLED: Direct Supabase calls cause authentication issues
        console.warn('[Projects] fetchDomainsByWorkspace domain links disabled - uses direct Supabase calls');
        linkedIds = [];
        allLinkedDomains = [];
        setLinkedDomainIds([]);
      }
      
      // DISABLED: Direct Supabase calls cause authentication issues
      console.warn('[Projects] fetchDomainsByWorkspace main query disabled - uses direct Supabase calls');
      setTotalDomains(0);
      setDomains([]);
    } catch (error) {
      console.error('[Projects] Error in fetchDomainsByWorkspace:', error);
      toast.error('Failed to load domains');
    } finally {
      setLoadingDomains(false);
    }
  };

  // Link/unlink a domain to a project
  const toggleDomainLink = async (domainId: string, projectId?: string) => {
    if (!projectId || !domainId) {
      console.error('Missing project ID or domain ID');
      toast.error('Failed to update domain link: Missing required data');
      return;
    }
    
    const isCurrentlyLinked = linkedDomainIds.includes(domainId);
    
    try {
      console.log(`Attempting to ${isCurrentlyLinked ? 'unlink' : 'link'} domain ${domainId} with project ${projectId}`);
      
      if (isCurrentlyLinked) {
        // DISABLED: Direct Supabase calls cause authentication issues
        console.warn('[Projects] toggleDomainLink unlink disabled - uses direct Supabase calls');
        throw new Error('Domain unlinking disabled - uses direct Supabase calls');
        
        // Update local state
        setLinkedDomainIds(prev => prev.filter(id => id !== domainId));
        setDomains(prev => prev.map(domain => 
          domain.id === domainId ? { ...domain, linked_to_project: false } : domain
        ));
        
        toast.success('Domain unlinked from project');
      } else {
        // DISABLED: Direct Supabase calls cause authentication issues
        console.warn('[Projects] toggleDomainLink link disabled - uses direct Supabase calls');
        const error = new Error('Domain linking disabled - uses direct Supabase calls');
        
        if (error) {
          // Handle duplicate key error specifically
          if ((error as any).code === '23505') {
            console.log('Domain already linked, updating frontend state');
            // Update local state to reflect that it's already linked
            setLinkedDomainIds(prev => prev.includes(domainId) ? prev : [...prev, domainId]);
            setDomains(prev => prev.map(domain => 
              domain.id === domainId ? { ...domain, linked_to_project: true } : domain
            ));
            toast.success('Domain was already linked to project');
            return;
          }
          throw error;
        }
        
        // Update local state
        setLinkedDomainIds(prev => [...prev, domainId]);
        setDomains(prev => prev.map(domain => 
          domain.id === domainId ? { ...domain, linked_to_project: true } : domain
        ));
        
        toast.success('Domain linked to project');
      }
    } catch (error: any) {
      console.error('Error toggling domain link:', error);
      
      // Handle specific error cases
      if (error.code === '23505') {
        toast.error('Domain is already linked to this project');
      } else {
        toast.error('Failed to update domain link');
      }
    }
  };

  // Function to handle task assignment
  const handleAssignTask = async (projectId: string, taskId: string, userId?: string) => {
    console.log('[ASSIGN TASK DEBUG] handleAssignTask called:', { projectId, taskId, userId, workspaceId });
    try {
      // Use API endpoint instead of direct Supabase call
      await updateTaskInSupabase(projectId, taskId, { assigned_to: userId || null });
      
      // Send email notification if assigning (not unassigning)
      if (userId) {
        // Get task and project details for notifications
        const task = projects.find(p => p.id === projectId)?.tasks.find(t => t.id === taskId);
        const project = projects.find(p => p.id === projectId);
        
        try {
          await fetch('/api/task-notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'assignment',
              taskId: taskId,
              assignedToId: userId
            }),
          });
          console.log('Task assignment email notification sent');
        } catch (emailError) {
          console.error('Error sending assignment notification:', emailError);
          // Don't fail the assignment if email fails
        }

        // Create in-app notification
        console.log('[ASSIGN TASK DEBUG] Creating notification for user:', userId);
        try {
          const notificationResponse = await fetch('/api/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'task_assignment',
              title: 'New Task Assignment',
              message: `You've been assigned to task "${task?.title || 'Unknown Task'}" in project "${project?.name || 'Unknown Project'}" by ${user?.user_metadata?.name || user?.email?.split('@')[0] || 'a team member'}`,
              user_id: userId,
              workspace_id: workspaceId,
              task_id: taskId,
              project_id: projectId,
              metadata: {
                task_title: task?.title,
                project_name: project?.name,
                assigned_by: user?.user_metadata?.name || user?.email?.split('@')[0]
              }
            }),
          });
          const notificationResult = await notificationResponse.json();
          console.log('[ASSIGN TASK DEBUG] Notification API response:', notificationResult);
          console.log('Task assignment in-app notification created');
        } catch (notificationError) {
          console.error('Error creating in-app notification:', notificationError);
          // Don't fail the assignment if notification fails
        }
      }
      
      setProjects(prevProjects => prevProjects.map(project => {
        if (project.id === projectId) {
          return {
            ...project,
            tasks: project.tasks.map(task => 
              task.id === taskId ? { ...task, assigned_to: userId || undefined } : task
            )
          };
        }
        return project;
      }));
      toast.success(userId ? 'Task assigned successfully and notification sent' : 'Task unassigned');
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error('Failed to assign task');
    }
  };

  // Function to handle subtask assignment
  const handleAssignSubtask = async (projectId: string, taskId: string, itemId: number, userId?: string) => {
    try {
      // Note: There's no specific API for task_checklist_items, so we update the task's checklist
      // First, get the current task to update the checklist item
      const project = projects.find(p => p.id === projectId);
      const task = project?.tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('Task not found');
      }
      
      // Update the checklist item assignment
      const updatedChecklist = task.checklist.map(item =>
        item.id === itemId ? { ...item, assigned_to: userId || undefined } : item
      );
      
      // Update the task via API endpoint
      await updateTaskInSupabase(projectId, taskId, { checklist: updatedChecklist });
      
      // Send email notification if assigning (not unassigning)
      if (userId) {
        // Get task, subtask and project details for notifications
        const project = projects.find(p => p.id === projectId);
        const task = project?.tasks.find(t => t.id === taskId);
        const subtask = task?.checklist.find(item => item.id === itemId);
        
        try {
          await fetch('/api/task-notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'assignment',
              taskId: taskId,
              assignedToId: userId
            }),
          });
          console.log('Subtask assignment email notification sent');
        } catch (emailError) {
          console.error('Error sending subtask assignment notification:', emailError);
          // Don't fail the assignment if email fails
        }

        // Create in-app notification
        try {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'task_assignment',
              title: 'New Subtask Assignment',
              message: `You've been assigned to subtask "${subtask?.text || 'Unknown Subtask'}" in task "${task?.title || 'Unknown Task'}" (project "${project?.name || 'Unknown Project'}") by ${user?.user_metadata?.name || user?.email?.split('@')[0] || 'a team member'}`,
              user_id: userId,
              workspace_id: workspaceId,
              task_id: taskId,
              project_id: projectId,
              metadata: {
                subtask_text: subtask?.text,
                task_title: task?.title,
                project_name: project?.name,
                assigned_by: user?.user_metadata?.name || user?.email?.split('@')[0],
                is_subtask: true
              }
            }),
          });
          console.log('Subtask assignment in-app notification created');
        } catch (notificationError) {
          console.error('Error creating in-app notification:', notificationError);
          // Don't fail the assignment if notification fails
        }
      }
      
      setProjects(prevProjects => prevProjects.map(project => {
        if (project.id === projectId) {
          return {
            ...project,
            tasks: project.tasks.map(task => {
              if (task.id === taskId) {
                return {
                  ...task,
                  checklist: task.checklist.map(item =>
                    item.id === itemId ? { ...item, assigned_to: userId || undefined } : item
                  )
                };
              }
              return task;
            })
          };
        }
        return project;
      }));
      toast.success(userId ? 'Subtask assigned successfully and notification sent' : 'Subtask unassigned');
    } catch (error) {
      console.error('Error assigning subtask:', error);
      toast.error('Failed to assign subtask');
    }
  };

  // Format currency to SEK
  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} SEK`;
  };

  // Get status display for invoices
  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { text: string, className: string }> = {
      "ongoing": { text: "Pågående", className: "bg-blue-100 dark:bg-blue-900/20 text-blue-400" },
      "draft": { text: "Utkast", className: "bg-background text-muted-foreground" },
      "completed": { text: "Färdig", className: "bg-green-100 dark:bg-green-900/20 text-green-400" },
      "paid": { text: "Betald", className: "bg-green-100 dark:bg-green-900/20 text-green-400" },
      "pending": { text: "Pågående", className: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-400" },
      "unpaid": { text: "Obetald", className: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-400" },
      "overdue": { text: "Försenad", className: "bg-red-100 dark:bg-red-900/20 text-red-400" }
    };

    const defaultStatus = { text: "Pågående", className: "bg-blue-100 dark:bg-blue-900/20 text-blue-400" };
    return statusMap[status?.toLowerCase()] || defaultStatus;
  };

  // Folder management functions
  const handleFolderSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
  };

  const handleFoldersChanged = () => {
    // Refresh projects to update folder counts
    if (user?.id) {
      fetchProjects();
      // Also refresh available folders for labels
      fetchAvailableFolders();
      // Force refresh the sidebar
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleTaskMoved = () => {
    // Refresh projects after task is moved
    if (user?.id) {
      fetchProjects();
    }
    setTaskMoveDialog({ open: false, task: null, currentProject: null });
  };

  // Bulk project selection functions
  const handleProjectSelect = (projectId: string, checked: boolean) => {
    if (checked) {
      setSelectedProjects(prev => [...prev, projectId]);
    } else {
      setSelectedProjects(prev => prev.filter(id => id !== projectId));
    }
  };

  const handleSelectAllProjects = (checked: boolean) => {
    if (checked) {
      const allProjectIds = filteredProjects.map(p => p.id).filter(Boolean) as string[];
      setSelectedProjects(allProjectIds);
    } else {
      setSelectedProjects([]);
    }
  };

  const handleBulkFolderAssignment = async () => {
    if (selectedProjects.length === 0) {
      toast.error('No projects selected');
      return;
    }

    try {
      const folderId = bulkFolderSelection === '' ? null : bulkFolderSelection;
      
      console.log('[Frontend] Bulk updating project folders:', selectedProjects, 'to folder:', folderId);
      
      // Update all selected projects using the API endpoint
      const updatePromises = selectedProjects.map(projectId => 
        fetch(`/api/projects?id=${projectId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            folder_id: folderId
          }),
        })
      );
      
      const responses = await Promise.all(updatePromises);
      
      // Check if all updates were successful
      const failedUpdates = responses.filter(response => !response.ok);
      if (failedUpdates.length > 0) {
        throw new Error(`Failed to update ${failedUpdates.length} project(s)`);
      }
      
      console.log('[Frontend] Bulk project folder update successful');
      
      // Update local state
      setProjects(projects.map(p => 
        selectedProjects.includes(p.id!) 
          ? { ...p, folder_id: folderId } 
          : p
      ));
      
      const folderName = folderId ? availableFolders.find(f => f.id === folderId)?.name : 'Unassigned';
      toast.success(`${selectedProjects.length} projects moved to ${folderName}`);
      
      // Reset selections and close dialog
      setSelectedProjects([]);
      setShowBulkFolderDialog(false);
      setBulkFolderSelection('');
      
      // Refresh folder counts
      handleFoldersChanged();
    } catch (error) {
      console.error('[Frontend] Error in bulk folder assignment:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update project folders');
    }
  };

  const openTaskMoveDialog = (task: Task, currentProject: Project) => {
    // Convert our Task and Project types to match TaskMoveDialog's expected types
    const taskForDialog = {
      id: task.id,
      title: task.title,
      project_id: task.project_id || currentProject.id || '',
    };
    
    const projectForDialog = {
      id: currentProject.id || '',
      name: currentProject.name,
      folder_id: currentProject.folder_id || null,
      workspace_id: workspaceId || '',
    };
    
    setTaskMoveDialog({
      open: true,
      task: taskForDialog,
      currentProject: projectForDialog,
    });
  };

  const openSubtaskMoveDialog = (task: Task, subtask: ChecklistItem, currentProject: Project) => {
    // Convert our types to match SubtaskMoveDialog's expected types
    const taskForDialog = {
      id: task.id,
      title: task.title,
      project_id: task.project_id || currentProject.id || '',
    };
    
    const subtaskForDialog = {
      id: subtask.id,
      text: subtask.text,
      done: subtask.done,
      assigned_to: subtask.assigned_to || undefined,
    };
    
    const projectForDialog = {
      id: currentProject.id || '',
      name: currentProject.name,
      folder_id: currentProject.folder_id || null,
      workspace_id: workspaceId || '',
    };
    
    setSubtaskMoveDialog({
      open: true,
      task: taskForDialog,
      subtask: subtaskForDialog,
      currentProject: projectForDialog,
    });
  };

  const handleSubtaskMoved = () => {
    // Refresh projects after subtask is moved
    if (user?.id) {
      fetchProjects();
    }
    setSubtaskMoveDialog({ open: false, task: null, subtask: null, currentProject: null });
  };

  // Handle domain search
  const handleDomainSearch = (search: string) => {
    setDomainSearch(search);
    setDomainPage(1); // Reset to first page when searching
  };

  // Handle domain page change
  const handleDomainPageChange = (page: number) => {
    setDomainPage(page);
  };

  return (
    <div className={cn("relative min-h-screen", className)}>
      <div className="absolute inset-0 bg-background" />
      <div className="relative p-8 space-y-6">
        <div className="flex items-center justify-between relative">
          <div className="relative">
            <h1 className="text-2xl font-semibold text-foreground relative">Projects</h1>
          </div>
          
          <div className="flex items-center gap-4 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            {/* New Project button with animated gradient */}
            <div className="group relative overflow-hidden rounded-lg">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
              
              <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
            <Link
              href="/projects/new"
                  className="flex items-center gap-2 px-4 py-2 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedProjects.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-background border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {selectedProjects.length} project{selectedProjects.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetchAvailableFolders(); // Now uses API endpoint
                    setShowBulkFolderDialog(true);
                  }}
                  className="flex items-center gap-2"
                >
                  <Folder className="h-4 w-4" />
                  Assign to Folder
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProjects([])}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Clear Selection
                </Button>
              </div>
            </div>
          </div>
        )}

        <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
          <div className="relative">
            <div className="relative z-10 flex">
              {/* Folder Sidebar */}
              {workspaceId ? (
                <ProjectFolderSidebar
                  key={`${workspaceId}-${projects.length}-${projects.filter(p => p.folder_id).length}`}
                  workspaceId={workspaceId}
                  selectedFolderId={selectedFolderId}
                  onFolderSelect={handleFolderSelect}
                  onManageFolders={() => setShowFolderManagement(true)}
                  refreshTrigger={refreshTrigger}
                  displayedProjects={projects}
                />
              ) : (
                <div className="w-56 border-r border-border p-3">
                  <p className="text-sm text-muted-foreground">Loading folders...</p>
                  <p className="text-xs text-muted-foreground mt-1">User: {user?.id ? 'Yes' : 'No'}</p>
                  <p className="text-xs text-muted-foreground">WorkspaceId: {workspaceId || 'null'}</p>
                </div>
              )}
              
              {/* Main Content */}
              <div className="flex-1">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
              <p className="mt-4 text-muted-foreground">Loading projects...</p>
            </div>
          ) : permissionDenied ? (
            <div className="py-12 text-center">
              <AlertOctagon className="h-8 w-8 text-red-600 dark:text-red-400 mx-auto" />
              <p className="mt-4 text-muted-foreground">You don't have permission to view projects.</p>
              <p className="text-sm text-muted-foreground">Please contact your workspace administrator.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border dark:border-border">
                    <th className="w-8 py-4 px-4">
                      <button
                        onClick={() => handleSelectAllProjects(!(selectedProjects.length === filteredProjects.length && filteredProjects.length > 0))}
                        className="flex items-center justify-center transition-colors"
                      >
                        {selectedProjects.length === filteredProjects.length && filteredProjects.length > 0 ? (
                          <CheckSquare className="h-5 w-5 text-blue-400" />
                        ) : selectedProjects.length > 0 ? (
                          <Minus className="h-5 w-5 text-blue-400" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                        )}
                      </button>
                    </th>
                    <th className="w-8 py-4 px-4"></th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Company</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Tasks</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                  {filteredProjects.length === 0 ? (
                    <tr key="no-projects">
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        {search ? "No projects found matching your search." : "No projects found. Create your first project to get started."}
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project) => {
                      const totalTasks = project.tasks.length;
                      const completedTasks = project.tasks.reduce((acc, task) => {
                        const completedItems = task.checklist.filter(item => item.done).length;
                        const totalItems = task.checklist.length;
                        return acc + (totalItems > 0 ? completedItems / totalItems : 0);
                      }, 0);
                      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                      const isExpanded = expandedProjects.includes(project.name);

                      return (
                        <React.Fragment key={project.id || project.name}>
                          <tr
                            className={cn(
                              "transition-colors cursor-pointer",
                              isExpanded ? "bg-muted" : "hover:bg-muted"
                            )}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const clickedProject = project;
                              setSelectedProject(clickedProject);
                            }}
                          >
                            <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleProjectSelect(project.id!, !selectedProjects.includes(project.id!))}
                                className="flex items-center justify-center transition-colors"
                              >
                                {selectedProjects.includes(project.id!) ? (
                                  <CheckSquare className="h-5 w-5 text-blue-400" />
                                ) : (
                                  <Square className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                                )}
                              </button>
                            </td>
                            <td className="py-4 px-4">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </td>
                            <td className="py-4 px-6 text-sm text-foreground">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span>{PROJECT_DISPLAY_NAMES[project.name] || project.name}</span>
                                  {project.assigned_to && (
                                    <div className="flex items-center gap-1 bg-blue-500/10 rounded-full px-2 py-0.5">
                                      <User className="h-3 w-3 text-blue-400" />
                                      <span className="text-xs text-blue-400">{getAssignedMemberName(project.assigned_to)}</span>
                                    </div>
                                  )}
                                  {/* Folder Label */}
                                  {project.folder_id && availableFolders.find(f => f.id === project.folder_id) && (
                                    <div className="flex items-center gap-1 bg-purple-500/10 rounded-full px-2 py-0.5">
                                      <Folder className="h-3 w-3 text-purple-400" />
                                      <span className="text-xs text-purple-400">
                                        {availableFolders.find(f => f.id === project.folder_id)?.name}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {project.customer_name && (
                                  <span className="text-xs text-muted-foreground mt-1 flex items-center">
                                    <Users className="h-3 w-3 mr-1" />
                                    {project.customer_name}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-sm">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "px-2 py-1 rounded-full text-xs font-medium",
                                  {
                                    "bg-green-100 dark:bg-green-900/20 text-green-400": project.status.toLowerCase() === "active",
                                    "bg-background/20 text-muted-foreground": project.status.toLowerCase() === "completed",
                                    "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-400": project.status.toLowerCase() === "on-hold"
                                  }
                                )}>
                                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                                </span>
                                <div className="flex items-center">
                                  <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <button 
                                        className="flex items-center gap-1.5 p-1.5 text-muted-foreground hover:text-blue-400 transition-colors rounded-md hover:bg-gray-200 dark:bg-muted/50"
                                        title={project.assigned_to ? "Reassign project" : "Assign project"}
                                      >
                                        {project.assigned_to ? (
                                          <>
                                            <User className="h-4 w-4" />
                                            <span className="text-xs">{getAssignedMemberName(project.assigned_to)?.split(' ')[0] || 'Assigned'}</span>
                                          </>
                                        ) : (
                                          <>
                                          <UserPlus className="h-4 w-4" />
                                            <span className="text-xs">Assign</span>
                                          </>
                                        )}
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent 
                                      className="bg-background border-border dark:border-border w-56" 
                                      align="end"
                                      onFocus={(e) => console.log('[Dialog AssignUser Dropdown] Content focused. Target:', e.target, 'Active Element:', document.activeElement)}
                                      onBlur={(e) => console.log('[Dialog AssignUser Dropdown] Content blurred. Target:', e.target, 'Active Element:', document.activeElement)}
                                    >
                                      {members.length === 0 ? (
                                        <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                                          No team members found
                                        </div>
                                      ) : (
                                        <>
                                          <div className="py-1 px-2 text-xs text-muted-foreground border-b border-border">
                                            Assign to user
                                          </div>
                                      {members.map(member => (
                                        <DropdownMenuItem 
                                          key={member.id}
                                          className={cn(
                                                "text-sm text-foreground flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:bg-muted",
                                            project.assigned_to === member.user_id && "bg-blue-100 dark:bg-blue-900/20"
                                          )}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                                void handleAssignProject(project.id, member.user_id);
                                          }}
                                        >
                                              <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                          {member.name}
                                              {project.assigned_to === member.user_id && (
                                                <span className="ml-auto text-xs bg-blue-200 dark:bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">
                                                  Current
                                                </span>
                                              )}
                                        </DropdownMenuItem>
                                      ))}
                                          <DropdownMenuItem 
                                            className="text-sm text-foreground flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:bg-muted border-t border-border"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void handleAssignProject(project.id, undefined);
                                            }}
                                          >
                                            <X className="h-4 w-4 mr-2 text-muted-foreground" />
                                            Unassign
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  
                                  {/* FOLDER ASSIGNMENT BUTTON - CLEARLY VISIBLE */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openFolderAssignmentDialog(project);
                                    }}
                                    className="flex items-center gap-1.5 p-1.5 text-muted-foreground hover:text-purple-400 transition-colors rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
                                    title="Assign to folder"
                                  >
                                    <Folder className="h-4 w-4" />
                                    <span className="text-xs">Folder</span>
                                  </button>
                                  {project.customer_name ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openCustomerDialog(project);
                                      }}
                                      className="p-1.5 text-muted-foreground hover:text-blue-400 transition-colors rounded-md hover:bg-gray-200 dark:bg-muted/50"
                                      title="Change customer"
                                    >
                                      <LinkIcon className="h-4 w-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openCustomerDialog(project);
                                      }}
                                      className="p-1.5 text-muted-foreground hover:text-blue-400 transition-colors rounded-md hover:bg-gray-200 dark:bg-muted/50"
                                      title="Link to customer"
                                    >
                                      <LinkIcon className="h-4 w-4" />
                                    </button>
                                  )}
                                  {project.id && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
                                          deleteProject(project.id);
                                        }
                                      }}
                                      className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors rounded-md hover:bg-gray-200 dark:bg-muted/50"
                                      title="Delete project"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-sm text-foreground">{totalTasks} tasks</td>
                            <td className="py-4 px-6 text-sm text-foreground">
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-gray-200 dark:bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-500 rounded-full"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{progress}%</span>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={5} className="p-0">
                                <div className="p-6 bg-background/50 space-y-4">
                                  <div className="flex items-center gap-4">
                                        <div className="group relative overflow-hidden rounded-lg">
                                          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                                          
                                          <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsAddingTask(project.name);
                                      }}
                                              className="flex items-center gap-2 px-4 py-2 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
                                    >
                                      <Plus className="h-4 w-4" />
                                      Add Task
                                    </button>
                                          </div>
                                        </div>
                                        
                                        <div className="group relative overflow-hidden rounded-lg">
                                          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                                          
                                          <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsBulkAdding(project.name);
                                      }}
                                              className="flex items-center gap-2 px-4 py-2 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
                                    >
                                      <Plus className="h-4 w-4" />
                                      Bulk Add Checklist
                                    </button>
                                          </div>
                                        </div>
                                        
                                        {/* Test Folder Assignment Button */}
                                        <div className="group relative overflow-hidden rounded-lg">
                                          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-purple-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                                          
                                          <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openFolderAssignmentDialog(project);
                                      }}
                                              className="flex items-center gap-2 px-4 py-2 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
                                    >
                                      <Folder className="h-4 w-4" />
                                      Assign Folder
                                    </button>
                                          </div>
                                        </div>
                                  </div>

                                  {isAddingTask === project.name && (
                                    <TaskForm
                                      onSubmit={(task) => handleAddTask(project.name, task)}
                                      onCancel={() => setIsAddingTask(null)}
                                    />
                                  )}

                                  {isBulkAdding === project.name && (
                                    <div className="space-y-4 bg-gray-200 dark:bg-muted dark:bg-neutral-850 rounded-lg p-6 z-30 relative">
                                      <div className="mb-4">
                                        <textarea
                                          value={bulkTaskInput}
                                          onChange={(e) => setBulkTaskInput(e.target.value)}
                                          placeholder={`Enter tasks and subtasks (indent subtasks with spaces or tab):

Task 1
  Subtask 1.1
  Subtask 1.2
Task 2
  Subtask 2.1
  Subtask 2.2
  Subtask 2.3`}
                                          className="w-full h-40 px-3 py-2 bg-background border border-border dark:border-border rounded text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                                          autoFocus
                                        />
                                      </div>
                                      <div className="flex justify-end gap-3 sticky bottom-0 pt-2 pb-1 bg-gray-200 dark:bg-muted dark:bg-neutral-850">
                                            <Button
                                          onClick={() => {
                                            setIsBulkAdding(null);
                                            setBulkTaskInput("");
                                          }}
                                              variant="outline"
                                              className="bg-background hover:bg-gray-200 dark:bg-muted border-border dark:border-border"
                                        >
                                          Cancel
                                            </Button>
                                            
                                            <Button
                                          onClick={() => handleBulkAddTasks(project.name)}
                                              className="bg-blue-600 hover:bg-blue-700 text-foreground"
                                        >
                                          Add Tasks
                                            </Button>
                                      </div>
                                    </div>
                                  )}

                                  <div className="grid gap-4">
                                    {project.tasks.length === 0 ? (
                                      <div className="text-center py-8">
                                        <p className="text-muted-foreground mb-4">No tasks yet</p>
                                            <div className="group relative overflow-hidden rounded-lg mx-auto">
                                              <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                                              
                                              <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setIsAddingTask(project.name);
                                          }}
                                                  className="flex items-center gap-2 px-4 py-2 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
                                        >
                                          <Plus className="h-4 w-4" />
                                          Add Your First Task
                                        </button>
                                              </div>
                                            </div>
                                      </div>
                                    ) : (
                                      project.tasks.map((task) => (
                                        editingTask?.projectName === project.name && editingTask?.taskId === task.id ? (
                                          <TaskForm
                                            key={task.id}
                                            task={task}
                                            onSubmit={(updates) => handleEditTask(project.name, task.id, updates)}
                                            onCancel={() => setEditingTask(null)}
                                            onDelete={() => handleDeleteTask(project.name, task.id)}
                                          />
                                        ) : (
                                          <div
                                            key={task.id}
                                            className="group relative"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <div className="absolute right-4 top-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <div className="group relative overflow-hidden rounded-lg">
                                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                                                    
                                                    <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                                              <button
                                                onClick={() => setEditingTask({ projectName: project.name, taskId: task.id })}
                                                        className="px-3 py-1.5 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground text-sm"
                                              >
                                                Edit
                                              </button>
                                                    </div>
                                                  </div>
                                                  
                                                  <div className="group relative overflow-hidden rounded-lg">
                                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                                                    
                                                    <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                                              <button
                                                onClick={() => handleDeleteTask(project.name, task.id)}
                                                        className="p-1.5 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground flex items-center justify-center"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </button>
                                                    </div>
                                                  </div>
                                            </div>
                                            <TaskExpanded
                                              task={task}
                                              onChecklistItemToggle={(taskId, itemId, done) => 
                                                handleChecklistItemToggle(taskId, itemId, done)
                                              }
                                              onAssignTask={(taskId, userId) => handleAssignTask(project.id!, taskId, userId)}
                                              onAssignSubtask={(taskId, itemId, userId) => handleAssignSubtask(project.id!, taskId, itemId, userId)}
                                              onMoveTask={(task) => openTaskMoveDialog(task, project)}
                                              onMoveSubtask={(task, subtask) => openSubtaskMoveDialog(task, subtask, project)}
                                              className="overflow-hidden relative"
                                              wrapperClassName="relative"
                                              borderGradient={true}
                                            />
                                          </div>
                                        )
                                      ))
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
              </div>
            </div>
          </div>
        </AnimatedBorderCard>
      </div>

      <Dialog 
        open={!!selectedProject} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProject(null);
          }
        }}
        modal={true}
      >
        <DialogContent 
          className="max-w-4xl max-h-[90vh] bg-background border-border p-0 overflow-visible"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
            {selectedProject && (
              <div className="relative overflow-y-auto max-h-[80vh]">
                <div className="p-6 relative z-10">
                  <DialogTitle className="text-2xl font-semibold text-foreground">
                    {PROJECT_DISPLAY_NAMES[selectedProject.name] || selectedProject.name}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Manage project details and tasks
                    {selectedProject.folder_id && availableFolders.find(f => f.id === selectedProject.folder_id) && (
                      <span className="inline-flex items-center gap-1 ml-2 bg-purple-500/10 rounded-full px-2 py-0.5">
                        <Folder className="h-3 w-3 text-purple-400" />
                        <span className="text-xs text-purple-400">
                          {availableFolders.find(f => f.id === selectedProject.folder_id)?.name}
                        </span>
                      </span>
                    )}
                  </DialogDescription>

                  <div className="space-y-6 mt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">Status: 
                          <span className={cn(
                            "ml-2 px-2 py-1 rounded-full text-xs font-medium",
                            {
                              "bg-green-100 dark:bg-green-900/20 text-green-400": selectedProject.status === "active",
                              "bg-background/20 text-muted-foreground": selectedProject.status === "completed",
                              "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-400": selectedProject.status === "on-hold"
                            }
                          )}>
                            {selectedProject.status.charAt(0).toUpperCase() + selectedProject.status.slice(1)}
                          </span>
                        </p>
                        
                        {/* Add Assignment Dropdown */}
                        <div className="flex items-center mt-3">
                          <span className="text-muted-foreground mr-2">Assigned to:</span>
                          <DropdownMenu modal={false} onOpenChange={(open) => {
                            console.log('[Dialog AssignUser Dropdown] openChange:', open, 'Active Element:', document.activeElement);
                          }}>
                            <DropdownMenuTrigger asChild>
                              <button 
                                className="flex items-center gap-2 px-3 py-1.5 bg-background hover:bg-gray-200 dark:bg-muted border border-border dark:border-border rounded-md text-sm"
                                onClick={() => console.log('[Dialog AssignUser Dropdown] Trigger clicked. Active Element:', document.activeElement)}
                              >
                                {selectedProject.assigned_to ? (
                                  <>
                                    <User className="h-4 w-4 text-blue-400" />
                                    <span className="text-foreground">{getAssignedMemberName(selectedProject.assigned_to) || "Unknown"}</span>
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">Assign User</span>
                                  </>
                                )}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent 
                              className="bg-background border-border dark:border-border w-56" 
                              align="end"
                              onFocus={(e) => console.log('[Dialog AssignUser Dropdown] Content focused. Target:', e.target, 'Active Element:', document.activeElement)}
                              onBlur={(e) => console.log('[Dialog AssignUser Dropdown] Content blurred. Target:', e.target, 'Active Element:', document.activeElement)}
                            >
                              {members.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                  No team members available
                                </div>
                              ) : (
                                <>
                                  {members.map((member) => (
                                    <DropdownMenuItem 
                                      key={member.id}
                                      className={cn(
                                        "text-sm text-foreground flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:bg-muted", // Ensured text-foreground
                                        selectedProject.assigned_to === member.user_id ? "bg-blue-100 dark:bg-blue-900/20" : ""
                                      )}
                                      onClick={() => {
                                        console.log('[Dialog AssignUser Dropdown] Item clicked - User:', member.name, 'Active Element:', document.activeElement);
                                        void handleAssignProject(selectedProject.id, member.user_id);
                                        console.log('[Dialog AssignUser Dropdown] After handleAssignProject. Active Element:', document.activeElement);
                                      }}
                                    >
                                      <User className="h-4 w-4 text-muted-foreground" />
                                      {member.name}
                                      {selectedProject.assigned_to === member.user_id && (
                                        <span className="ml-auto text-xs bg-blue-200 dark:bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">
                                          Current
                                        </span>
                                      )}
                                    </DropdownMenuItem>
                                  ))}
                                  
                                  {selectedProject.assigned_to && (
                                    <>
                                      <div className="h-px bg-gray-200 dark:bg-muted my-1 mx-1"></div>
                                      <DropdownMenuItem 
                                        className="text-sm text-red-400 flex items-center gap-2 cursor-pointer hover:bg-gray-200 dark:bg-muted" // Ensured hover style
                                        onClick={() => {
                                          console.log('[Dialog AssignUser Dropdown] Unassign clicked. Active Element:', document.activeElement);
                                          void handleAssignProject(selectedProject.id); // Unassign
                                          console.log('[Dialog AssignUser Dropdown] After handleAssignProject (unassign). Active Element:', document.activeElement);
                                        }}
                                      >
                                        <AlertCircle className="h-4 w-4" />
                                        Unassign
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <ReportButtons 
                        projectName={selectedProject.name}
                        tasks={selectedProject.tasks}
                      />
                        
                      {/* Button group for project actions */}
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                        {/* Quick Folder Assignment Button */}
                        <div className="group relative overflow-hidden rounded-lg">
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-purple-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                          
                          <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                            <button
                              onClick={() => openFolderAssignmentDialog(selectedProject)}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground w-full justify-center"
                            >
                              <Folder className="h-4 w-4 text-purple-400" />
                              {selectedProject.folder_id ? 'Change Folder' : 'Assign Folder'}
                            </button>
                          </div>
                        </div>
                        
                        {/* Link to Invoice button with animated gradient */}
                        <div className="group relative overflow-hidden rounded-lg">
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-blue-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                          
                          <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                            <button
                              onClick={() => setShowInvoiceSection(!showInvoiceSection)}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground w-full justify-center"
                            >
                              <FileText className="h-4 w-4 text-blue-400" />
                              {linkedInvoiceIds.length > 0 ? `Invoices (${linkedInvoiceIds.length})` : "Link Invoice"}
                            </button>
                          </div>
                        </div>
                        
                        {/* Link to Domains button with animated gradient */}
                        <div className="group relative overflow-hidden rounded-lg">
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-green-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                          
                          <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                            <button
                              onClick={() => setShowDomainSection(!showDomainSection)}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground w-full justify-center"
                            >
                              <Globe className="h-4 w-4 text-green-400" />
                              {linkedDomainIds.length > 0 ? `Domains (${linkedDomainIds.length})` : "Link Domains"}
                            </button>
                          </div>
                        </div>
                        
                        {/* Email Settings button with animated gradient */}
                        <div className="group relative overflow-hidden rounded-lg">
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                          
                          <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                            <button
                              onClick={() => setShowEmailSettings(true)}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground w-full justify-center"
                            >
                              <Settings2 className="h-4 w-4" />
                              Email Settings
                            </button>
                          </div>
                        </div>
                        
                        {/* Time Tracking button */}
                        <div className="group relative overflow-hidden rounded-lg">
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                          
                          <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                            <button
                              onClick={() => selectedProject?.id && setShowTimeTrackingForProject(selectedProject.id)}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground w-full justify-center"
                            >
                              <Clock className="h-4 w-4" />
                              Time
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {showEmailSettings && selectedProject?.id && (
                      <EmailSettings
                        projectId={selectedProject.id}
                        onClose={() => setShowEmailSettings(false)}
                      />
                    )}

                    {/* Add the Linked Invoices section */}
                    {showInvoiceSection && (
                      <div className="mt-6 bg-gray-200 dark:bg-muted dark:bg-neutral-850 border border-border dark:border-border rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-border dark:border-border flex justify-between items-center">
                          <h3 className="text-lg font-medium text-foreground">Linked Invoices</h3>
                          {!selectedProject.customer_name && (
                            <div className="text-sm text-yellow-400 flex items-center gap-1.5">
                              <AlertCircle className="h-4 w-4" />
                              <span>Link a customer first to see invoices</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="p-4">
                          {loadingInvoices ? (
                            <div className="py-8 flex justify-center">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : !selectedProject.customer_name ? (
                            <div className="py-6 text-center">
                              <div className="mx-auto w-12 h-12 rounded-full bg-background flex items-center justify-center mb-3">
                                <Link2 className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <p className="text-muted-foreground">No customer linked to this project</p>
                              <p className="text-sm text-muted-foreground mt-1">Link a customer to see available invoices</p>
                              <button
                                onClick={() => openCustomerDialog(selectedProject)}
                                className="mt-4 px-4 py-2 bg-background hover:bg-gray-200 dark:bg-muted text-sm rounded-md text-foreground dark:text-neutral-300"
                              >
                                Link Customer
                              </button>
                            </div>
                          ) : invoices.length === 0 ? (
                            <div className="py-6 text-center">
                              <div className="mx-auto w-12 h-12 rounded-full bg-background flex items-center justify-center mb-3">
                                <FileText className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <p className="text-muted-foreground">No invoices found for {selectedProject.customer_name}</p>
                              <p className="text-sm text-muted-foreground mt-1">Create invoices for this customer first</p>
                              <Link
                                href="/invoices/new"
                                className="inline-block mt-4 px-4 py-2 bg-background hover:bg-gray-200 dark:bg-muted text-sm rounded-md text-foreground dark:text-neutral-300"
                              >
                                Create Invoice
                              </Link>
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                              {invoices.map(invoice => (
                                <div 
                                  key={invoice.id}
                                  className={cn(
                                    "p-3 rounded-md border transition-all",
                                    invoice.linked_to_project 
                                      ? "bg-blue-50 dark:bg-blue-900/10 border-blue-900/30" 
                                      : "bg-background border-border hover:border-gray-400"
                                  )}
                                >
                                  <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                      <span className="font-medium text-foreground">{invoice.invoice_number}</span>
                                      <span className="text-xs text-muted-foreground mt-1">
                                        {new Date(invoice.created_at).toLocaleDateString()} • 
                                        {formatCurrency(invoice.total_amount)}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => toggleInvoiceLink(invoice.id, selectedProject.id)}
                                      className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm",
                                        invoice.linked_to_project
                                          ? "bg-blue-100 dark:bg-blue-900/20 text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30"
                                          : "bg-gray-200 dark:bg-muted text-foreground dark:text-neutral-300 hover:bg-gray-300 dark:hover:bg-neutral-600"
                                      )}
                                    >
                                      {invoice.linked_to_project ? (
                                        <>
                                          <CheckCircle className="h-4 w-4" />
                                          <span>Linked</span>
                                        </>
                                      ) : (
                                        <>
                                          <Link2 className="h-4 w-4" />
                                          <span>Link</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <div className="mt-2 flex items-center">
                                    <div className={cn(
                                      "px-2 py-0.5 rounded text-xs font-medium",
                                      getStatusDisplay(invoice.status || "ongoing").className
                                    )}>
                                      {getStatusDisplay(invoice.status || "ongoing").text}
                                    </div>
                                    {invoice.due_date && (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        Due: {new Date(invoice.due_date).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Add the Linked Domains section */}
                    {showDomainSection && (
                      <div className="mt-6 bg-gray-200 dark:bg-muted dark:bg-neutral-850 border border-border dark:border-border rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-border dark:border-border flex justify-between items-center">
                          <h3 className="text-lg font-medium text-foreground">Linked Domains & Backlinks</h3>
                          <div className="text-sm text-green-400 flex items-center gap-1.5">
                            <Globe className="h-4 w-4" />
                            <span>SEO Assets</span>
                          </div>
                        </div>
                        
                        <div className="p-4">
                          {loadingDomains ? (
                            <div className="py-8 flex justify-center">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : totalDomains === 0 && !domainSearch ? (
                            <div className="py-6 text-center">
                              <div className="mx-auto w-12 h-12 rounded-full bg-background flex items-center justify-center mb-3">
                                <Globe className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <p className="text-muted-foreground">No domains found in workspace</p>
                              <p className="text-sm text-muted-foreground mt-1">Upload domains to the domains page first</p>
                              <Link
                                href="/domains"
                                className="inline-block mt-4 px-4 py-2 bg-background hover:bg-gray-200 dark:bg-muted text-sm rounded-md text-foreground dark:text-neutral-300"
                              >
                                Manage Domains
                              </Link>
                            </div>
                          ) : (
                            <div>
                              {/* Domain Search */}
                              <div className="mb-4">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <input
                                    type="text"
                                    placeholder="Search domains..."
                                    value={domainSearch}
                                    onChange={(e) => handleDomainSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">
                                  Showing {domains.length} of {totalDomains.toLocaleString()} domains
                                </div>
                              </div>
                              
                              {domains.length === 0 ? (
                                <div className="py-6 text-center">
                                  <div className="mx-auto w-12 h-12 rounded-full bg-background flex items-center justify-center mb-3">
                                    <Globe className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                  <p className="text-muted-foreground">No domains match your search</p>
                                  <p className="text-sm text-muted-foreground mt-1">Try a different search term</p>
                                </div>
                              ) : (
                                <>
                                  <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {domains.map(domain => (
                                      <div 
                                        key={domain.id}
                                        className={cn(
                                          "p-3 rounded-md border transition-all",
                                          domain.linked_to_project 
                                            ? "bg-green-50 dark:bg-green-900/10 border-green-900/30" 
                                            : "bg-background border-border hover:border-gray-400"
                                        )}
                                      >
                                        <div className="flex justify-between items-start">
                                          <div className="flex flex-col flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-foreground">
                                                {domain.display_domain || domain.domain}
                                              </span>
                                              {domain.domain_rating && (
                                                <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-400 px-2 py-0.5 rounded">
                                                  DR {domain.domain_rating}
                                                </span>
                                              )}
                                              <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                                                {domain.source}
                                              </span>
                                            </div>
                                            
                                            <div className="mt-2 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                                              {domain.organic_traffic && (
                                                <div>
                                                  <span className="font-medium">Traffic:</span> {domain.organic_traffic.toLocaleString()}
                                                </div>
                                              )}
                                              {domain.referring_domains && (
                                                <div>
                                                  <span className="font-medium">Ref Domains:</span> {domain.referring_domains.toLocaleString()}
                                                </div>
                                              )}
                                              {domain.organic_keywords && (
                                                <div>
                                                  <span className="font-medium">Keywords:</span> {domain.organic_keywords.toLocaleString()}
                                                </div>
                                              )}
                                              {domain.traffic_value && (
                                                <div>
                                                  <span className="font-medium">Value:</span> ${domain.traffic_value.toLocaleString()}
                                                </div>
                                              )}
                                            </div>
                                            
                                            {domain.expiry_date && (
                                              <div className="mt-1 text-xs text-muted-foreground">
                                                <span className="font-medium">Expires:</span> {new Date(domain.expiry_date).toLocaleDateString()}
                                              </div>
                                            )}
                                          </div>
                                          
                                          <button
                                            onClick={() => toggleDomainLink(domain.id, selectedProject.id)}
                                            className={cn(
                                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm ml-3",
                                              domain.linked_to_project
                                                ? "bg-green-100 dark:bg-green-900/20 text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30"
                                                : "bg-gray-200 dark:bg-muted text-foreground dark:text-neutral-300 hover:bg-gray-300 dark:hover:bg-neutral-600"
                                            )}
                                          >
                                            {domain.linked_to_project ? (
                                              <>
                                                <CheckCircle className="h-4 w-4" />
                                                <span>Linked</span>
                                              </>
                                            ) : (
                                              <>
                                                <Link2 className="h-4 w-4" />
                                                <span>Link</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  
                                  {/* Pagination */}
                                  {totalDomains > DOMAINS_PER_PAGE && (
                                    <div className="mt-4 flex items-center justify-between">
                                      <div className="text-sm text-muted-foreground">
                                        Page {domainPage} of {Math.ceil(totalDomains / DOMAINS_PER_PAGE)}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleDomainPageChange(domainPage - 1)}
                                          disabled={domainPage === 1}
                                          className="px-3 py-1 text-sm bg-background border border-border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800"
                                        >
                                          Previous
                                        </button>
                                        <button
                                          onClick={() => handleDomainPageChange(domainPage + 1)}
                                          disabled={domainPage >= Math.ceil(totalDomains / DOMAINS_PER_PAGE)}
                                          className="px-3 py-1 text-sm bg-background border border-border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800"
                                        >
                                          Next
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 text-sm">
                      <p className="text-muted-foreground">Start Date: <span className="text-foreground">{new Date(selectedProject.startDate || '').toLocaleDateString()}</span></p>
                      {selectedProject.endDate && (
                        <p className="text-muted-foreground">End Date: <span className="text-foreground">{new Date(selectedProject.endDate).toLocaleDateString()}</span></p>
                      )}
                      
                      {/* Backlinks Progress Section */}
                      {linkedDomainIds.length > 0 && (
                        <div className="mt-4 p-3 border border-border rounded-lg bg-green-50 dark:bg-green-900/10">
                          <div 
                            className="flex items-center justify-between mb-2 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/20 p-1 rounded transition-colors"
                            onClick={() => setExpandedBacklinks(!expandedBacklinks)}
                          >
                            <span className="text-sm font-medium text-foreground">Backlinks Progress</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-green-600 dark:text-green-400">
                                {expandedBacklinks ? 'Click to collapse' : 'Click to view domains'}
                              </span>
                              {expandedBacklinks ? (
                                <ChevronDown className="h-4 w-4 text-green-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Total Referring Domains:</span>
                              <span className="font-bold text-green-600 dark:text-green-400">
                                {(() => {
                                  const linkedDomains = domains.filter(d => linkedDomainIds.includes(d.domain));
                                  console.log('Linked domains for calculation:', linkedDomains.map(d => ({ domain: d.domain, referring_domains: d.referring_domains })));
                                  return linkedDomains.reduce((sum, d) => sum + (d.referring_domains || 0), 0).toLocaleString();
                                })()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Linked Domains:</span>
                              <span className="text-foreground">{linkedDomainIds.length}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Average DR:</span>
                              <span className="text-foreground">
                                {(() => {
                                  const linkedDomains = domains.filter(d => linkedDomainIds.includes(d.domain));
                                  const validDomains = linkedDomains.filter(d => d.domain_rating && d.domain_rating > 0);
                                  if (validDomains.length === 0) return "N/A";
                                  const avgDR = Math.round(validDomains.reduce((sum, d) => sum + (d.domain_rating || 0), 0) / validDomains.length);
                                  return avgDR;
                                })()}
                              </span>
                            </div>
                          </div>
                          
                          {/* Expanded domain list */}
                          {expandedBacklinks && (
                            <div className="mt-4 border-t border-green-200 dark:border-green-800 pt-3">
                              <h4 className="text-sm font-medium text-foreground mb-3">Linked Domains:</h4>
                              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                {domains.filter(d => linkedDomainIds.includes(d.domain)).length === 0 ? (
                                  <div className="text-center py-2 text-muted-foreground text-sm">
                                    No domain data loaded yet. Try opening the "Link Domains" section first.
                                  </div>
                                ) : (
                                  domains.filter(d => linkedDomainIds.includes(d.domain)).map(domain => (
                                    <div key={domain.id} className="flex items-center justify-between p-2 bg-background rounded border border-border">
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium text-foreground">
                                          {domain.display_domain || domain.domain}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {domain.source}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 text-xs">
                                        <div className="text-center">
                                          <div className="font-medium text-foreground">
                                            {(domain.referring_domains || 0).toLocaleString()}
                                          </div>
                                          <div className="text-muted-foreground">Ref Domains</div>
                                        </div>
                                        <div className="text-center">
                                          <div className="font-medium text-foreground">
                                            {domain.domain_rating || 'N/A'}
                                          </div>
                                          <div className="text-muted-foreground">DR</div>
                                        </div>
                                        {domain.organic_traffic && (
                                          <div className="text-center">
                                            <div className="font-medium text-foreground">
                                              {domain.organic_traffic.toLocaleString()}
                                            </div>
                                            <div className="text-muted-foreground">Traffic</div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h2 className="text-lg font-semibold text-foreground">Description</h2>
                        <p className="text-muted-foreground whitespace-pre-wrap">{selectedProject.description || "No description provided."}</p>
                      </div>

                      <div className="space-y-4">
                        <TaskManager
                          tasks={selectedProject.tasks}
                          onTasksChange={(updatedTasks) => handleTasksChange(selectedProject.name, updatedTasks)}
                          onTaskUpdate={(taskId, updates) => handleTaskUpdate(selectedProject.name, taskId, updates)}
                          onChecklistItemUpdate={handleChecklistItemToggle}
                          projectDeadline={selectedProject.endDate || selectedProject.startDate || new Date().toISOString()}
                          projectName={selectedProject.name}
                          projectDescription={selectedProject.description || ''}
                          projectId={selectedProject.id || ''}
                          workspaceId={workspaceId || ''}
                          onMoveTask={(task) => openTaskMoveDialog(task, selectedProject)}
                          onMoveSubtask={(task, subtask) => openSubtaskMoveDialog(task, subtask, selectedProject)}
                          showMonthlyGrouping={true}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
      </Dialog>

      {/* Customer assignment dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="bg-background border-border text-foreground p-0 overflow-hidden max-w-md">
            <div className="relative">
              <div className="p-6 relative z-10">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">
                    Link Project to Customer
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Select a customer to associate with the project "{projectToEdit?.name || ''}"
                  </DialogDescription>
                </DialogHeader>
                
                <div className="py-4">
                  {loadingCustomers ? (
                    <div className="py-4 flex justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : customers.length === 0 ? (
                    <div className="py-4 text-center text-muted-foreground">
                      <p>No customers found</p>
                      <p className="text-sm text-muted-foreground mt-1">Create customers first</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search customers..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-gray-200 dark:bg-muted border border-gray-400 dark:border-border rounded-md text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500"
                        />
                      </div>
                      
                      <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar">
                        {filteredCustomers.length === 0 ? (
                          <div className="text-center py-3 text-muted-foreground">
                            No customers matching "{customerSearch}"
                          </div>
                        ) : (
                          filteredCustomers.map(customer => (
                            <div 
                              key={customer.id}
                              className={cn(
                                "p-3 border rounded-md cursor-pointer transition-colors",
                                selectedCustomerId === customer.id 
                                  ? "bg-blue-100 dark:bg-blue-900/20 border-blue-600" 
                                  : "bg-gray-200 dark:bg-muted border-gray-400 dark:border-border hover:bg-gray-300 dark:hover:bg-gray-300 dark:bg-neutral-650"
                              )}
                              onClick={() => setSelectedCustomerId(customer.id)}
                            >
                              <div className="font-medium">{customer.name}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <DialogFooter className="flex justify-end gap-3 mt-6">                  {/* Cancel button with animated gradient */}
                  <div className="group relative overflow-hidden rounded-lg">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                    
                    <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                      <button
                        type="button"
                        onClick={() => setCustomerDialogOpen(false)}
                        className="px-4 py-2 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  
                  {/* Save button with animated gradient */}
                  <div className="group relative overflow-hidden rounded-lg">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-green-900/30 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                    
                    <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                      <button
                        type="button"
                        onClick={updateProjectCustomer}
                        className="px-4 py-2 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
                      >
                        Link Customer
                      </button>
                    </div>
                  </div>
                </DialogFooter>
              </div>
            </div>
          </DialogContent>
      </Dialog>

      {/* Folder assignment dialog */}
      <Dialog open={folderAssignmentDialog} onOpenChange={setFolderAssignmentDialog}>
        <DialogContent className="bg-background border-border text-foreground p-0 overflow-hidden max-w-md">
          <div className="relative">
            <div className="p-6 relative z-10">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">
                  Assign Project to Folder
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Select a folder for the project "{projectToAssignFolder?.name || ''}"
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Folder</label>
                    <select
                      value={selectedProjectFolderId}
                      onChange={(e) => setSelectedProjectFolderId(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-200 dark:bg-muted border border-gray-400 dark:border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-neutral-500"
                    >
                      <option value="">Unassigned</option>
                      {availableFolders.map(folder => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {availableFolders.length === 0 && (
                    <div className="text-center py-3 text-muted-foreground">
                      <p>No folders available</p>
                      <p className="text-sm text-muted-foreground mt-1">Create folders first using "Manage Folders"</p>
                    </div>
                  )}
                </div>
              </div>
              
              <DialogFooter className="flex justify-end gap-3 mt-6">
                {/* Cancel button */}
                <div className="group relative overflow-hidden rounded-lg">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                  
                  <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                    <button
                      type="button"
                      onClick={() => setFolderAssignmentDialog(false)}
                      className="px-4 py-2 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                
                {/* Save button */}
                <div className="group relative overflow-hidden rounded-lg">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-purple-900/30 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                  
                  <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                    <button
                      type="button"
                      onClick={updateProjectFolder}
                      className="px-4 py-2 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
                    >
                      Assign Folder
                    </button>
                  </div>
                </div>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Time Tracking Summary Dialog */}
      <Dialog open={!!showTimeTrackingForProject} onOpenChange={() => setShowTimeTrackingForProject(null)}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Project Time Tracking</DialogTitle>
            <DialogDescription>
              View and manage time spent on this project and its tasks
            </DialogDescription>
          </DialogHeader>
          
          {showTimeTrackingForProject && (
            <TimeTrackingSummary 
              projectId={showTimeTrackingForProject} 
              className="mt-4"
            />
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowTimeTrackingForProject(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Folder Management Dialog */}
      {workspaceId && user?.id && (
        <ProjectFolderManagementDialog
          open={showFolderManagement}
          onOpenChange={setShowFolderManagement}
          workspaceId={workspaceId}
          userId={user.id}
          onFoldersChanged={handleFoldersChanged}
        />
      )}

      {/* Task Move Dialog */}
      {workspaceId && (
        <TaskMoveDialog
          open={taskMoveDialog.open}
          onOpenChange={(open) => setTaskMoveDialog(prev => ({ ...prev, open }))}
          task={taskMoveDialog.task}
          currentProject={taskMoveDialog.currentProject}
          workspaceId={workspaceId}
          onTaskMoved={handleTaskMoved}
        />
      )}

      {/* Subtask Move Dialog */}
      {workspaceId && (
        <SubtaskMoveDialog
          open={subtaskMoveDialog.open}
          onOpenChange={(open) => setSubtaskMoveDialog(prev => ({ ...prev, open }))}
          task={subtaskMoveDialog.task}
          subtask={subtaskMoveDialog.subtask}
          currentProject={subtaskMoveDialog.currentProject}
          workspaceId={workspaceId}
          onSubtaskMoved={handleSubtaskMoved}
        />
      )}

      {/* Bulk Folder Assignment Dialog */}
      <Dialog open={showBulkFolderDialog} onOpenChange={setShowBulkFolderDialog}>
        <DialogContent className="bg-background border-border text-foreground p-0 overflow-hidden max-w-md">
          <div className="relative">
            <div className="p-6 relative z-10">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">
                  Bulk Assign Projects to Folder
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Select a folder for {selectedProjects.length} selected project{selectedProjects.length !== 1 ? 's' : ''}
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Folder</label>
                    <select
                      value={bulkFolderSelection}
                      onChange={(e) => setBulkFolderSelection(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-200 dark:bg-muted border border-gray-400 dark:border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-neutral-500"
                    >
                      <option value="">Unassigned</option>
                      {availableFolders.map(folder => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {availableFolders.length === 0 && (
                    <div className="text-center py-3 text-muted-foreground">
                      <p>No folders available</p>
                      <p className="text-sm text-muted-foreground mt-1">Create folders first using "Manage Folders"</p>
                    </div>
                  )}

                  {/* Show selected projects */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Selected Projects:</label>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {selectedProjects.map(projectId => {
                        const project = projects.find(p => p.id === projectId);
                        return (
                          <div key={projectId} className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            {project?.name || projectId}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              
              <DialogFooter className="flex justify-end gap-3 mt-6">
                {/* Cancel button */}
                <div className="group relative overflow-hidden rounded-lg">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                  
                  <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                    <button
                      type="button"
                      onClick={() => setShowBulkFolderDialog(false)}
                      className="px-4 py-2 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                
                {/* Assign button */}
                <div className="group relative overflow-hidden rounded-lg">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-purple-900/30 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                  
                  <div className="relative m-[1px] bg-background rounded-lg hover:bg-muted transition-colors duration-300">
                    <button
                      type="button"
                      onClick={handleBulkFolderAssignment}
                      className="px-4 py-2 border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
                    >
                      Assign to Folder
                    </button>
                  </div>
                </div>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 