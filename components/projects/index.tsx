"use client";

import { Card } from "@/components/ui/card";
import { AnimatedBorderCard } from "@/components/ui/animated-border-card";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Plus, Search, Trash2, X, Mail, Settings2, LinkIcon, Users, User, UserPlus, AlertCircle, FileText, Link2, CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { TaskExpanded } from "./TaskExpanded";
import { TaskForm } from "./TaskForm";
import { ReportButtons } from "./ReportButtons";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import React from "react";
import { useSession } from "next-auth/react";
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

interface ChecklistItem {
  id: number;
  text: string;
  done: boolean;
  deadline?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  checklist: Array<{ id: number; text: string; done: boolean }>;
  progress: number;
  assigned_to?: string;
}

interface Project {
  id?: string;
  name: string;
  status: 'active' | 'completed' | 'on-hold';
  startDate?: string;
  endDate?: string;
  description?: string;
  tasks: Task[];
  customer_name?: string;
  assigned_to?: string;
}

interface ProjectsViewProps {
  className?: string;
}

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

export function ProjectsView({ className }: ProjectsViewProps) {
  const [search, setSearch] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isAddingTask, setIsAddingTask] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<{ projectName: string; taskId: string } | null>(null);
  const [isBulkAdding, setIsBulkAdding] = useState<string | null>(null);
  const [bulkTaskInput, setBulkTaskInput] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const { data: session } = useSession();
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

  // Function to get member name by ID
  const getAssignedMemberName = (userId?: string) => {
    if (!userId) return null;
    const member = getMemberByUserId(userId);
    return member ? member.name : null;
  };

  // Function to handle assigning a project
  const handleAssignProject = async (projectId?: string, userId?: string) => {
    if (!projectId) return;
    
    try {
      await assignProject(projectId, userId || '');
      
      // Update local state for the main projects list
      setProjects(prevProjects => 
        prevProjects.map(project => {
          if (project.id === projectId) {
            return {
              ...project,
              assigned_to: userId || undefined
            };
          }
          return project;
        })
      );

      // If the selected project (in the dialog) is the one being modified, update it too
      if (selectedProject && selectedProject.id === projectId) {
        setSelectedProject(prevSelectedProject => {
          if (!prevSelectedProject) return null;
          return {
            ...prevSelectedProject,
            assigned_to: userId || undefined
          };
        });
      }
      
      toast.success(userId ? 'Project assigned successfully' : 'Project unassigned');
    } catch (error) {
      console.error('Error assigning project:', error);
      toast.error('Failed to assign project');
    }
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
    return {
      ...project,
      tasks: project.tasks.map(calculateTaskProgress)
    };
  };

  // Initial fetch of projects
  useEffect(() => {
    if (session?.user?.id) {
      // Check if user has permission to view projects
      const checkProjectPermission = async () => {
        try {
          console.log('[Projects] Checking permission for user:', session.user.email);
          
          // Get team memberships by user ID first
          const { data: teamMemberships, error: teamError } = await supabase
            .from('team_members')
            .select('workspace_id, is_admin, permissions')
            .eq('user_id', session.user.id);
            
          if (teamError) {
            console.error('[Projects] Error fetching team memberships:', teamError);
            // Don't fail immediately, try by email as fallback
          }
          
          // If we didn't find memberships by user ID, try by email (especially for kevin@amptron.com)
          if (!teamMemberships || teamMemberships.length === 0) {
            console.log('[Projects] No workspaces found by user_id, trying email fallback');
            
            if (session.user?.email) {
              // Try to fetch by email instead (to handle ID mismatches)
              const { data: emailMemberships, error: emailError } = await supabase
                .from('team_members')
                .select('workspace_id, is_admin, permissions, user_id')
                .eq('email', session.user.email);
                
              if (emailError) {
                console.error('[Projects] Error fetching team memberships by email:', emailError);
                setPermissionDenied(true);
                setLoading(false);
                return;
              }
              
              if (!emailMemberships || emailMemberships.length === 0) {
                console.log('[Projects] No workspaces found by email either');
                setPermissionDenied(true);
                setLoading(false);
                return;
              }
              
              console.log('[Projects] Found workspace by email:', emailMemberships);
              
              // Use these memberships instead
              // Check if user has permission to view projects
              const hasPermission = emailMemberships.some(membership => 
                membership.is_admin || 
                (membership.permissions && 
                  (membership.permissions.view_projects || 
                  membership.permissions.admin))
              );
              
              if (!hasPermission) {
                console.log('[Projects] User does not have view_projects permission (via email check)');
                setPermissionDenied(true);
                setLoading(false);
                return;
              }
              
              // User has permission via email check, call fetchProjects with the email-based memberships
              fetchProjectsWithMemberships(emailMemberships);
              
              // Also fetch customers
              fetchCustomers();
              
              return;
            } else {
              // No email to try with, so just deny permission
              setPermissionDenied(true);
              setLoading(false);
              return;
            }
          }
          
          // If we get here, we found memberships by user_id
          // Check if user has permission to view projects
          const hasPermission = teamMemberships.some(membership => 
            membership.is_admin || 
            (membership.permissions && 
              (membership.permissions.view_projects || 
              membership.permissions.admin))
          );
          
          if (!hasPermission) {
            console.log('[Projects] User does not have view_projects permission');
            setPermissionDenied(true);
            setLoading(false);
            return;
          }
          
          // User has permission, fetch projects
          fetchProjectsWithMemberships(teamMemberships);
          
          // Also fetch customers
          fetchCustomers();
          
        } catch (error) {
          console.error('[Projects] Error checking permissions:', error);
          setPermissionDenied(true);
          setLoading(false);
        }
      };
      
      checkProjectPermission();
    }
  }, [session?.user?.id]);

  // New helper function to fetch projects with known team memberships
  const fetchProjectsWithMemberships = async (teamMemberships: any[]) => {
    try {
      // Get workspace IDs for this user
      const workspaceIds = teamMemberships.map(tm => tm.workspace_id);
      console.log('[Projects] Workspace IDs:', workspaceIds);

      // Fetch projects first (no nested query)
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*, assigned_to')
        .in('workspace_id', workspaceIds);

      if (error) {
        console.error('[Projects] Error fetching projects:', error);
        toast.error('Failed to load projects');
        setLoading(false);
        return;
      }

      if (!projectsData || projectsData.length === 0) {
        console.log('[Projects] No projects found for user workspaces');
        setProjects([]);
        setLoading(false);
        return;
      }

      // Get all project IDs for a second query
      const projectIds = projectsData.map(project => project.id);
      
      // Fetch tasks separately
      const { data: tasksData, error: tasksError } = await supabase
        .from('project_tasks')
        .select('*, assigned_to')
        .in('project_id', projectIds);
        
      if (tasksError) {
        console.error('[Projects] Error fetching project tasks:', tasksError);
        toast.error('Failed to load project tasks');
      }
      
      // Associate tasks with their projects manually
      const projectsWithTasks = projectsData.map(project => {
        const projectTasks = tasksData ? tasksData.filter(task => task.project_id === project.id) : [];
        return {
          ...project,
          tasks: projectTasks || [],
          status: (project.status?.toLowerCase() || 'active') as 'active' | 'completed' | 'on-hold',
          assigned_to: project.assigned_to || undefined
        };
      });

      console.log('[Projects] Formatted projects:', projectsWithTasks.length, 'projects');
      setProjects(projectsWithTasks.map(calculateProjectProgress));
      setLoading(false);
    } catch (error) {
      console.error('[Projects] Error in fetchProjects:', error);
      toast.error('Failed to load projects');
      setLoading(false);
    }
  };

  // Fetch projects from Supabase
  const fetchProjects = async () => {
    try {
      if (!session?.user?.id) {
        console.log('[Projects] No user session found, cannot fetch projects');
        setLoading(false);
        return;
      }

      console.log('[Projects] Starting fetch for user:', session.user.email);
      
      // Get team memberships to find workspaces
      const { data: teamMemberships, error: teamError } = await supabase
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', session.user.id);

      if (teamError) {
        console.error('[Projects] Error fetching team memberships:', teamError);
        toast.error('Failed to load team memberships');
        setLoading(false);
        return;
      }

      // Handle case where user has no memberships
      if (!teamMemberships || teamMemberships.length === 0) {
        console.log('[Projects] No workspaces found for user');
        
        // Try by email as fallback
        if (session.user?.email) {
          console.log('[Projects] Trying to fetch by email:', session.user.email);
          const { data: emailMemberships, error: emailError } = await supabase
            .from('team_members')
            .select('workspace_id')
            .eq('email', session.user.email);
            
          if (!emailError && emailMemberships && emailMemberships.length > 0) {
            // Continue with email-based memberships
            return fetchProjectsWithMemberships(emailMemberships);
          }
        }
        
        setProjects([]);
        setLoading(false);
        return;
      }

      // Continue with standard fetch using the memberships
      fetchProjectsWithMemberships(teamMemberships);
    } catch (error) {
      console.error('[Projects] Error in fetchProjects:', error);
      toast.error('Failed to load projects');
      setLoading(false);
    }
  };

  // Update task in Supabase
  const updateTaskInSupabase = async (projectId: string, taskId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('project_tasks')
        .update(updates)
        .eq('project_id', projectId)
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
      throw error;
    }
  };

  // Add task to Supabase
  const addTaskToSupabase = async (projectId: string, taskData: Omit<Task, 'id' | 'progress'>) => {
    try {
      if (!session?.user?.id) {
        toast.error('You must be logged in to add tasks');
        return null;
      }

      // Get the workspace_id from the project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('workspace_id')
        .eq('id', projectId)
        .single();

      if (projectError) {
        console.error('Error fetching project:', projectError);
        toast.error('Failed to add task');
        return null;
      }

      // Create task with correct workspace_id and user_id
      const task = {
        ...taskData,
        project_id: projectId,
        progress: 0,
        user_id: session.user.id,
        workspace_id: projectData.workspace_id
      };

      const { data, error } = await supabase
        .from('project_tasks')
        .insert([task])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task');
      throw error;
    }
  };

  // Delete task from Supabase
  const deleteTaskFromSupabase = async (projectId: string, taskId: string) => {
    try {
      const { error } = await supabase
        .from('project_tasks')
        .delete()
        .eq('project_id', projectId)
        .eq('id', taskId);

      if (error) throw error;
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
      setProjects(prevProjects => prevProjects.map(p =>
        p.id === project.id
          ? {
              ...p,
              tasks: p.tasks.map(t =>
                t.id === taskId
                  ? { ...t, checklist: updatedChecklist, progress }
                  : t
              )
            }
          : p
      ));

      // Then update in Supabase
      const { error } = await supabase
        .from('project_tasks')
        .update({
          checklist: updatedChecklist,
          progress
        })
        .eq('project_id', project.id)
        .eq('id', taskId);

      if (error) throw error;
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
                tasks: [...p.tasks, newTask]
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

      if (!session?.user?.id) {
        toast.error('You must be logged in to add tasks');
        return;
      }

      // Get the workspace_id from the project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('workspace_id')
        .eq('id', project.id)
        .single();

      if (projectError) {
        console.error('Error fetching project:', projectError);
        toast.error('Failed to add tasks');
        return;
      }

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
          workspace_id: projectData.workspace_id,
          user_id: session.user.id,
          progress: 0,
          checklist: task.subtasks.map((text, index) => ({
            id: index + 1,
            text,
            done: false
          }))
        };

        const { data, error } = await supabase
          .from('project_tasks')
          .insert([newTask])
          .select()
          .single();

        if (error) {
          console.error('Error adding task:', error);
          toast.error(`Failed to add task: ${task.title}`);
          continue;
        }

        setProjects(prevProjects =>
          prevProjects.map(p =>
            p.name === projectName
              ? {
                  ...p,
                  tasks: [...p.tasks, data]
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

  // Delete project from Supabase
  const deleteProject = async (projectId: string | undefined) => {
    if (!projectId) {
      toast.error('Cannot delete project: Invalid project ID');
      return;
    }

    if (!session?.user?.id) {
      toast.error('You must be logged in to delete projects');
      return;
    }

    try {
      // First delete all tasks associated with this project
      const { error: tasksError } = await supabase
        .from('project_tasks')
        .delete()
        .eq('project_id', projectId);

      if (tasksError) {
        console.error('Error deleting project tasks:', tasksError);
        throw tasksError;
      }
      
      // Delete any calendar events associated with this project
      const { error: calendarError } = await supabase
        .from('calendar_events')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', session.user.id);

      if (calendarError) {
        console.error('Error deleting project calendar events:', calendarError);
        // Don't stop the deletion process if calendar sync fails
      }

      // Then delete the project - no need to filter by user_id since RLS will handle permissions
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId));
      toast.success('Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
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
      const updatedProject = { ...selectedProject, tasks: updatedTasks };
      
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
      const updatedProject = { ...selectedProject, tasks: updatedTasks };
      
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
    return displayName.toLowerCase().includes(search.toLowerCase());
  });

  // New function to fetch customers
  const fetchCustomers = async () => {
    if (!session?.user?.id) return;
    
    setLoadingCustomers(true);
    try {
      // Get the active workspace ID
      const workspaceId = await getActiveWorkspaceId(session.user.id);
      
      if (!workspaceId) {
        console.log('[Projects] No active workspace found');
        setLoadingCustomers(false);
        return;
      }
      
      // Fetch customers for this workspace
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, workspace_id')
        .eq('workspace_id', workspaceId)
        .order('name');
      
      if (error) {
        console.error('[Projects] Error fetching customers:', error);
        setLoadingCustomers(false);
        return;
      }
      
      console.log(`[Projects] Fetched ${data?.length || 0} customers`);
      setCustomers(data || []);
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
      
      // Update the project
      const { error } = await supabase
        .from('projects')
        .update({
          customer_name: selectedCustomer.name
        })
        .eq('id', projectToEdit.id);
      
      if (error) {
        console.error('[Projects] Error updating project customer:', error);
        toast.error('Failed to update project customer');
        return;
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
    customer.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Fetch invoices for a customer
  const fetchInvoicesByCustomer = async (customerId: string, projectId?: string) => {
    if (!customerId) return;
    
    setLoadingInvoices(true);
    try {
      // First get all invoices for this customer
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      
      if (invoiceError) {
        console.error('[Projects] Error fetching invoices:', invoiceError);
        toast.error('Failed to load invoices');
        setLoadingInvoices(false);
        return;
      }
      
      // If we have a project ID, fetch project-invoice links
      let linkedIds: string[] = [];
      if (projectId) {
        const { data: linkData, error: linkError } = await supabase
          .from('project_invoice_links')
          .select('invoice_id')
          .eq('project_id', projectId);
        
        if (!linkError && linkData) {
          linkedIds = linkData.map(link => link.invoice_id);
          setLinkedInvoiceIds(linkedIds);
        }
      }
      
      // Mark invoices that are linked to this project
      const formattedInvoices = invoiceData?.map(invoice => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number || invoice.document_number || `Invoice-${invoice.id.substring(0, 8)}`,
        customer_id: invoice.customer_id,
        total_amount: invoice.total ? parseFloat(invoice.total) : 0,
        status: invoice.status || 'pending',
        due_date: invoice.due_date || new Date().toISOString(),
        created_at: invoice.created_at || new Date().toISOString(),
        linked_to_project: linkedIds.includes(invoice.id)
      })) || [];
      
      setInvoices(formattedInvoices);
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
        // Unlink the invoice
        const { error } = await supabase
          .from('project_invoice_links')
          .delete()
          .eq('project_id', projectId)
          .eq('invoice_id', invoiceId);
        
        if (error) throw error;
        
        // Update local state
        setLinkedInvoiceIds(prev => prev.filter(id => id !== invoiceId));
        setInvoices(prev => prev.map(invoice => 
          invoice.id === invoiceId ? { ...invoice, linked_to_project: false } : invoice
        ));
        
        toast.success('Invoice unlinked from project');
      } else {
        // Link the invoice
        const { error } = await supabase
          .from('project_invoice_links')
          .insert({
            project_id: projectId,
            invoice_id: invoiceId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (error) throw error;
        
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

  // Function to handle task assignment
  async function handleAssignTask(projectId: string, taskId: string, userId?: string) {
    try {
      await supabase.from('project_tasks').update({ assigned_to: userId || null }).eq('id', taskId).eq('project_id', projectId);
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
      toast.success(userId ? 'Task assigned successfully' : 'Task unassigned');
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error('Failed to assign task');
    }
  }

  // Function to handle subtask assignment
  async function handleAssignSubtask(projectId: string, taskId: string, itemId: number, userId?: string) {
    try {
      await supabase.from('task_checklist_items').update({ assigned_to: userId || null }).eq('id', itemId).eq('task_id', taskId);
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
      toast.success(userId ? 'Subtask assigned successfully' : 'Subtask unassigned');
    } catch (error) {
      console.error('Error assigning subtask:', error);
      toast.error('Failed to assign subtask');
    }
  }

  // Format currency to SEK
  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} SEK`;
  };

  // Get status display for invoices
  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { text: string, className: string }> = {
      "ongoing": { text: "Pågående", className: "bg-blue-900/20 text-blue-400" },
      "draft": { text: "Utkast", className: "bg-neutral-800 text-neutral-400" },
      "completed": { text: "Färdig", className: "bg-green-900/20 text-green-400" },
      "paid": { text: "Betald", className: "bg-green-900/20 text-green-400" },
      "pending": { text: "Pågående", className: "bg-yellow-900/20 text-yellow-400" },
      "unpaid": { text: "Obetald", className: "bg-yellow-900/20 text-yellow-400" },
      "overdue": { text: "Försenad", className: "bg-red-900/20 text-red-400" }
    };

    const defaultStatus = { text: "Pågående", className: "bg-blue-900/20 text-blue-400" };
    return statusMap[status?.toLowerCase()] || defaultStatus;
  };

  return (
    <div className={cn("relative min-h-screen", className)}>
      <div className="absolute inset-0 bg-[#0A0A0A]" />
      <div className="relative p-8 space-y-6">
        <div className="flex items-center justify-between relative">
          <div className="relative">
            <h1 className="text-2xl font-semibold text-white relative">Projects</h1>
          </div>
          
          <div className="flex items-center gap-4 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-neutral-800/90 backdrop-blur-sm border border-neutral-700 rounded-md text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
            
            {/* New Project button with animated gradient */}
            <div className="group relative overflow-hidden rounded-lg">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
              
              <div className="relative m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
            <Link
              href="/projects/new"
                  className="flex items-center gap-2 px-4 py-2 border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Link>
              </div>
            </div>
          </div>
        </div>

        <AnimatedBorderCard className="bg-neutral-800/50 backdrop-blur-sm border-0">
          <div className="relative">
            <div className="relative z-10">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-400 mx-auto" />
              <p className="mt-4 text-neutral-400">Loading projects...</p>
            </div>
          ) : permissionDenied ? (
            <div className="py-12 text-center">
              <AlertOctagon className="h-8 w-8 text-red-500 mx-auto" />
              <p className="mt-4 text-neutral-400">You don't have permission to view projects.</p>
              <p className="text-sm text-neutral-500">Please contact your workspace administrator.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-700">
                    <th className="w-8 py-4 px-4"></th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Company</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Status</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Tasks</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-700">
                  {filteredProjects.length === 0 ? (
                    <tr key="no-projects">
                      <td colSpan={5} className="py-8 text-center text-neutral-400">
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
                              isExpanded ? "bg-neutral-750" : "hover:bg-neutral-750"
                            )}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const clickedProject = project;
                              setSelectedProject(clickedProject);
                            }}
                          >
                            <td className="py-4 px-4">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-neutral-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-neutral-400" />
                              )}
                            </td>
                            <td className="py-4 px-6 text-sm text-white">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span>{PROJECT_DISPLAY_NAMES[project.name] || project.name}</span>
                                  {project.assigned_to && (
                                    <div className="flex items-center gap-1 bg-blue-500/10 rounded-full px-2 py-0.5">
                                      <User className="h-3 w-3 text-blue-400" />
                                      <span className="text-xs text-blue-400">{getAssignedMemberName(project.assigned_to)}</span>
                                    </div>
                                  )}
                                </div>
                                {project.customer_name && (
                                  <span className="text-xs text-neutral-400 mt-1 flex items-center">
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
                                    "bg-green-900/20 text-green-400": project.status.toLowerCase() === "active",
                                    "bg-neutral-900/20 text-neutral-400": project.status.toLowerCase() === "completed",
                                    "bg-yellow-900/20 text-yellow-400": project.status.toLowerCase() === "on-hold"
                                  }
                                )}>
                                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                                </span>
                                <div className="flex items-center">
                                  <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <button 
                                        className="flex items-center gap-1.5 p-1.5 text-neutral-400 hover:text-blue-400 transition-colors rounded-md hover:bg-neutral-700/50"
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
                                      className="bg-neutral-800 border-neutral-700 w-56" 
                                      align="end"
                                      onFocus={(e) => console.log('[Dialog AssignUser Dropdown] Content focused. Target:', e.target, 'Active Element:', document.activeElement)}
                                      onBlur={(e) => console.log('[Dialog AssignUser Dropdown] Content blurred. Target:', e.target, 'Active Element:', document.activeElement)}
                                    >
                                      {members.length === 0 ? (
                                        <div className="px-2 py-4 text-sm text-center text-neutral-400">
                                          No team members found
                                        </div>
                                      ) : (
                                        <>
                                          <div className="py-1 px-2 text-xs text-neutral-500 border-b border-neutral-700">
                                            Assign to user
                                          </div>
                                      {members.map(member => (
                                        <DropdownMenuItem 
                                          key={member.id}
                                          className={cn(
                                                "text-sm text-white flex items-center gap-2 cursor-pointer hover:bg-neutral-700",
                                            project.assigned_to === member.user_id && "bg-blue-900/20"
                                          )}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                                void handleAssignProject(project.id, member.user_id);
                                          }}
                                        >
                                              <User className="h-4 w-4 mr-2 text-neutral-400" />
                                          {member.name}
                                              {project.assigned_to === member.user_id && (
                                                <span className="ml-auto text-xs bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">
                                                  Current
                                                </span>
                                              )}
                                        </DropdownMenuItem>
                                      ))}
                                          
                                          {project.assigned_to && (
                                            <>
                                              <div className="h-px bg-neutral-700 my-1 mx-2" />
                                              <DropdownMenuItem 
                                                className="text-sm text-red-400 flex items-center gap-2 cursor-pointer hover:bg-neutral-700"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  void handleAssignProject(project.id);
                                                }}
                                              >
                                                <AlertCircle className="h-4 w-4 mr-2" />
                                                Unassign
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  
                                  {project.customer_name ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openCustomerDialog(project);
                                      }}
                                      className="p-1.5 text-neutral-400 hover:text-blue-400 transition-colors rounded-md hover:bg-neutral-700/50"
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
                                      className="p-1.5 text-neutral-400 hover:text-blue-400 transition-colors rounded-md hover:bg-neutral-700/50"
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
                                      className="p-1.5 text-neutral-400 hover:text-red-400 transition-colors rounded-md hover:bg-neutral-700/50"
                                      title="Delete project"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-sm text-white">{totalTasks} tasks</td>
                            <td className="py-4 px-6 text-sm text-white">
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-neutral-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-500 rounded-full"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-neutral-400">{progress}%</span>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={5} className="p-0">
                                <div className="p-6 bg-neutral-800/50 space-y-4">
                                  <div className="flex items-center gap-4">
                                        <div className="group relative overflow-hidden rounded-lg">
                                          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                                          
                                          <div className="relative m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsAddingTask(project.name);
                                      }}
                                              className="flex items-center gap-2 px-4 py-2 border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white"
                                    >
                                      <Plus className="h-4 w-4" />
                                      Add Task
                                    </button>
                                          </div>
                                        </div>
                                        
                                        <div className="group relative overflow-hidden rounded-lg">
                                          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                                          
                                          <div className="relative m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIsBulkAdding(project.name);
                                      }}
                                              className="flex items-center gap-2 px-4 py-2 border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white"
                                    >
                                      <Plus className="h-4 w-4" />
                                      Bulk Add Checklist
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
                                    <div className="space-y-4 bg-neutral-850 rounded-lg p-6 z-30 relative">
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
                                          className="w-full h-40 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                                          autoFocus
                                        />
                                      </div>
                                      <div className="flex justify-end gap-3 sticky bottom-0 pt-2 pb-1 bg-neutral-850">
                                            <Button
                                          onClick={() => {
                                            setIsBulkAdding(null);
                                            setBulkTaskInput("");
                                          }}
                                              variant="outline"
                                              className="bg-neutral-800 hover:bg-neutral-700 border-neutral-700"
                                        >
                                          Cancel
                                            </Button>
                                            
                                            <Button
                                          onClick={() => handleBulkAddTasks(project.name)}
                                              className="bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                          Add Tasks
                                            </Button>
                                      </div>
                                    </div>
                                  )}

                                  <div className="grid gap-4">
                                    {project.tasks.length === 0 ? (
                                      <div className="text-center py-8">
                                        <p className="text-neutral-400 mb-4">No tasks yet</p>
                                            <div className="group relative overflow-hidden rounded-lg mx-auto">
                                              <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                                              
                                              <div className="relative m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setIsAddingTask(project.name);
                                          }}
                                                  className="flex items-center gap-2 px-4 py-2 border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white"
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
                                                    
                                                    <div className="relative m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                                              <button
                                                onClick={() => setEditingTask({ projectName: project.name, taskId: task.id })}
                                                        className="px-3 py-1.5 border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white text-sm"
                                              >
                                                Edit
                                              </button>
                                                    </div>
                                                  </div>
                                                  
                                                  <div className="group relative overflow-hidden rounded-lg">
                                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                                                    
                                                    <div className="relative m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                                              <button
                                                onClick={() => handleDeleteTask(project.name, task.id)}
                                                        className="p-1.5 border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white flex items-center justify-center"
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
        <AnimatedBorderCard className="w-full max-w-4xl mx-auto relative">
          <DialogContent 
            className="max-w-4xl max-h-[90vh] bg-neutral-900 border-transparent p-0 overflow-visible"
            // Restore these handlers
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            {selectedProject && (
              <div className="relative overflow-y-auto max-h-[80vh]">
                <div className="p-6 relative z-10">
                  <DialogTitle className="text-2xl font-semibold text-white">
                    {PROJECT_DISPLAY_NAMES[selectedProject.name] || selectedProject.name}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-neutral-400">
                    Manage project details and tasks
                  </DialogDescription>

                  <div className="space-y-6 mt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2 text-sm">
                        <p className="text-neutral-400">Status: 
                          <span className={cn(
                            "ml-2 px-2 py-1 rounded-full text-xs font-medium",
                            {
                              "bg-green-900/20 text-green-400": selectedProject.status === "active",
                              "bg-neutral-900/20 text-neutral-400": selectedProject.status === "completed",
                              "bg-yellow-900/20 text-yellow-400": selectedProject.status === "on-hold"
                            }
                          )}>
                            {selectedProject.status.charAt(0).toUpperCase() + selectedProject.status.slice(1)}
                          </span>
                        </p>
                        
                        {/* Add Assignment Dropdown */}
                        <div className="flex items-center mt-3">
                          <span className="text-neutral-400 mr-2">Assigned to:</span>
                          <DropdownMenu modal={false} onOpenChange={(open) => {
                            console.log('[Dialog AssignUser Dropdown] openChange:', open, 'Active Element:', document.activeElement);
                          }}>
                            <DropdownMenuTrigger asChild>
                              <button 
                                className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-sm"
                                onClick={() => console.log('[Dialog AssignUser Dropdown] Trigger clicked. Active Element:', document.activeElement)}
                              >
                                {selectedProject.assigned_to ? (
                                  <>
                                    <User className="h-4 w-4 text-blue-400" />
                                    <span className="text-white">{getAssignedMemberName(selectedProject.assigned_to) || "Unknown"}</span>
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="h-4 w-4 text-neutral-400" />
                                    <span className="text-neutral-400">Assign User</span>
                                  </>
                                )}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent 
                              className="bg-neutral-800 border-neutral-700 w-56" 
                              align="end"
                              onFocus={(e) => console.log('[Dialog AssignUser Dropdown] Content focused. Target:', e.target, 'Active Element:', document.activeElement)}
                              onBlur={(e) => console.log('[Dialog AssignUser Dropdown] Content blurred. Target:', e.target, 'Active Element:', document.activeElement)}
                            >
                              {members.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-neutral-400">
                                  No team members available
                                </div>
                              ) : (
                                <>
                                  {members.map((member) => (
                                    <DropdownMenuItem 
                                      key={member.id}
                                      className={cn(
                                        "text-sm text-white flex items-center gap-2 cursor-pointer hover:bg-neutral-700", // Ensured text-white
                                        selectedProject.assigned_to === member.user_id ? "bg-blue-900/20" : ""
                                      )}
                                      onClick={() => {
                                        console.log('[Dialog AssignUser Dropdown] Item clicked - User:', member.name, 'Active Element:', document.activeElement);
                                        void handleAssignProject(selectedProject.id, member.user_id);
                                        console.log('[Dialog AssignUser Dropdown] After handleAssignProject. Active Element:', document.activeElement);
                                      }}
                                    >
                                      <User className="h-4 w-4 text-neutral-400" />
                                      {member.name}
                                      {selectedProject.assigned_to === member.user_id && (
                                        <span className="ml-auto text-xs bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">
                                          Current
                                        </span>
                                      )}
                                    </DropdownMenuItem>
                                  ))}
                                  
                                  {selectedProject.assigned_to && (
                                    <>
                                      <div className="h-px bg-neutral-700 my-1 mx-1"></div>
                                      <DropdownMenuItem 
                                        className="text-sm text-red-400 flex items-center gap-2 cursor-pointer hover:bg-neutral-700" // Ensured hover style
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
                      <div className="flex items-center gap-3">
                        {/* Link to Invoice button with animated gradient */}
                        <div className="group relative overflow-hidden rounded-lg">
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-blue-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                          
                          <div className="relative m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                            <button
                              onClick={() => setShowInvoiceSection(!showInvoiceSection)}
                              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white"
                            >
                              <FileText className="h-4 w-4 text-blue-400" />
                              {linkedInvoiceIds.length > 0 ? `Linked Invoices (${linkedInvoiceIds.length})` : "Link Invoice"}
                            </button>
                          </div>
                        </div>
                        
                      {/* Email Settings button with animated gradient */}
                      <div className="group relative overflow-hidden rounded-lg">
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                        
                        <div className="relative m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                          <button
                            onClick={() => setShowEmailSettings(true)}
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white"
                          >
                            <Settings2 className="h-4 w-4" />
                            Email Settings
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
                      <div className="mt-6 bg-neutral-850 border border-neutral-700 rounded-lg overflow-hidden">
                        <div className="p-4 border-b border-neutral-700 flex justify-between items-center">
                          <h3 className="text-lg font-medium text-white">Linked Invoices</h3>
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
                              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                            </div>
                          ) : !selectedProject.customer_name ? (
                            <div className="py-6 text-center">
                              <div className="mx-auto w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-3">
                                <Link2 className="h-6 w-6 text-neutral-500" />
                              </div>
                              <p className="text-neutral-400">No customer linked to this project</p>
                              <p className="text-sm text-neutral-500 mt-1">Link a customer to see available invoices</p>
                              <button
                                onClick={() => openCustomerDialog(selectedProject)}
                                className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-sm rounded-md text-neutral-300"
                              >
                                Link Customer
                              </button>
                            </div>
                          ) : invoices.length === 0 ? (
                            <div className="py-6 text-center">
                              <div className="mx-auto w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-3">
                                <FileText className="h-6 w-6 text-neutral-500" />
                              </div>
                              <p className="text-neutral-400">No invoices found for {selectedProject.customer_name}</p>
                              <p className="text-sm text-neutral-500 mt-1">Create invoices for this customer first</p>
                              <Link
                                href="/invoices/new"
                                className="inline-block mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-sm rounded-md text-neutral-300"
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
                                      ? "bg-blue-900/10 border-blue-900/30" 
                                      : "bg-neutral-800 border-neutral-700 hover:border-neutral-600"
                                  )}
                                >
                                  <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                      <span className="font-medium text-white">{invoice.invoice_number}</span>
                                      <span className="text-xs text-neutral-400 mt-1">
                                        {new Date(invoice.created_at).toLocaleDateString()} • 
                                        {formatCurrency(invoice.total_amount)}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => toggleInvoiceLink(invoice.id, selectedProject.id)}
                                      className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm",
                                        invoice.linked_to_project
                                          ? "bg-blue-900/20 text-blue-400 hover:bg-blue-900/30"
                                          : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
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
                                      <span className="text-xs text-neutral-500 ml-2">
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

                    <div className="space-y-2 text-sm">
                      <p className="text-neutral-400">Start Date: <span className="text-white">{new Date(selectedProject.startDate || '').toLocaleDateString()}</span></p>
                      {selectedProject.endDate && (
                        <p className="text-neutral-400">End Date: <span className="text-white">{new Date(selectedProject.endDate).toLocaleDateString()}</span></p>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h2 className="text-lg font-semibold text-white">Description</h2>
                        <p className="text-neutral-400 whitespace-pre-wrap">{selectedProject.description || "No description provided."}</p>
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
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </AnimatedBorderCard>
      </Dialog>

      {/* Customer assignment dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <AnimatedBorderCard className="w-full max-w-md mx-auto relative">
          <DialogContent className="bg-neutral-800 border-transparent text-white p-0 overflow-hidden">
            <div className="relative">
              <div className="p-6 relative z-10">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">
                    Link Project to Customer
                  </DialogTitle>
                  <DialogDescription className="text-neutral-400">
                    Select a customer to associate with the project "{projectToEdit?.name}"
                  </DialogDescription>
                </DialogHeader>
                
                <div className="py-4">
                  {loadingCustomers ? (
                    <div className="py-4 flex justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                    </div>
                  ) : customers.length === 0 ? (
                    <div className="py-4 text-center text-neutral-400">
                      <p>No customers found</p>
                      <p className="text-sm text-neutral-500 mt-1">Create customers first</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                        <input
                          type="text"
                          placeholder="Search customers..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500"
                        />
                      </div>
                      
                      <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar">
                        {filteredCustomers.length === 0 ? (
                          <div className="text-center py-3 text-neutral-400">
                            No customers matching "{customerSearch}"
                          </div>
                        ) : (
                          filteredCustomers.map(customer => (
                            <div 
                              key={customer.id}
                              className={cn(
                                "p-3 border rounded-md cursor-pointer transition-colors",
                                selectedCustomerId === customer.id 
                                  ? "bg-blue-900/20 border-blue-600" 
                                  : "bg-neutral-700 border-neutral-600 hover:bg-neutral-650"
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
                    
                    <div className="relative m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                      <button
                        type="button"
                        onClick={() => setCustomerDialogOpen(false)}
                        className="px-4 py-2 border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  
                  {/* Save button with animated gradient */}
                  <div className="group relative overflow-hidden rounded-lg">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-green-900/30 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
                    
                    <div className="relative m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                      <button
                        type="button"
                        onClick={updateProjectCustomer}
                        className="px-4 py-2 border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white"
                      >
                        Link Customer
                      </button>
                    </div>
                  </div>
                </DialogFooter>
              </div>
            </div>
          </DialogContent>
        </AnimatedBorderCard>
      </Dialog>
    </div>
  );
} 