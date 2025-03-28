"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Plus, Search, Trash2, X, Mail, Settings2 } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { TaskExpanded } from "./TaskExpanded";
import { TaskForm } from "./TaskForm";
import { ReportButtons } from "./ReportButtons";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import React from "react";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { TaskManager } from "@/components/projects/TaskManager";
import { Switch } from "@/components/ui/switch";
import { EmailSettings } from "./EmailSettings";
import { Squares } from "@/components/ui/squares-background";

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
}

interface Project {
  id?: string;
  name: string;
  status: 'active' | 'completed' | 'on-hold';
  startDate?: string;
  endDate?: string;
  description?: string;
  tasks: Task[];
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

  // Initialize with empty projects array
  const [projects, setProjects] = useState<Project[]>([]);

  // Fetch projects from Supabase
  const fetchProjects = async () => {
    try {
      if (!session?.user?.id) {
        console.log('[Projects] No user session found, cannot fetch projects');
        return;
      }

      console.log('[Projects] Starting fetch for user:', session.user.email);

      // First get the user's workspaces
      const { data: teamMemberships, error: teamError } = await supabase
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', session.user.id);

      if (teamError) {
        console.error('[Projects] Error fetching team memberships:', teamError);
        toast.error('Failed to load team memberships');
        return;
      }

      console.log('[Projects] Team memberships:', teamMemberships);

      if (!teamMemberships?.length) {
        console.log('[Projects] No workspaces found for user');
        setProjects([]);
        setLoading(false);
        return;
      }

      const workspaceIds = teamMemberships.map(tm => tm.workspace_id);
      console.log('[Projects] Workspace IDs:', workspaceIds);

      const { data: projectsData, error } = await supabase
        .from('projects')
        .select(`
          *,
          tasks:project_tasks(*)
        `)
        .in('workspace_id', workspaceIds);

      if (error) {
        console.error('[Projects] Error fetching projects:', error);
        toast.error('Failed to load projects');
        return;
      }

      console.log('[Projects] Raw projects data:', projectsData);

      if (projectsData) {
        const formattedProjects = projectsData.map(project => {
          console.log('[Projects] Formatting project:', project.name, 'Tasks:', project.tasks?.length || 0);
          return {
            ...project,
            tasks: project.tasks || [],
            status: (project.status?.toLowerCase() || 'active') as 'active' | 'completed' | 'on-hold'
          };
        });

        console.log('[Projects] Formatted projects:', formattedProjects.length, 'projects');
        setProjects(formattedProjects.map(calculateProjectProgress));
      }
      setLoading(false);
    } catch (error) {
      console.error('[Projects] Error in fetchProjects:', error);
      toast.error('Failed to load projects');
      setLoading(false);
    }
  };

  // Initial fetch of projects
  useEffect(() => {
    if (session?.user?.id) {
      fetchProjects();
    }
  }, [session?.user?.id]);

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
        .eq('project_id', projectId)
        .eq('user_id', session.user.id);

      if (tasksError) {
        console.error('Error deleting project tasks:', tasksError);
        throw tasksError;
      }

      // Then delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', session.user.id);

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

  return (
    <div className={cn("relative min-h-screen", className)}>
      <div className="absolute inset-0 -z-10 bg-[#0A0A0A]" />
      <div className="relative z-10 p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Projects</h1>
          <div className="flex items-center gap-4">
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
            <Link
              href="/projects/new"
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800/90 backdrop-blur-sm hover:bg-neutral-700 border border-neutral-700 rounded-md text-sm text-white transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </div>
        </div>

        <Card className="bg-neutral-800/90 backdrop-blur-sm border-neutral-700">
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
                            {PROJECT_DISPLAY_NAMES[project.name] || project.name}
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
                              {project.id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
                                      deleteProject(project.id);
                                    }
                                  }}
                                  className="p-1.5 text-neutral-400 hover:text-red-400 transition-colors rounded-md hover:bg-neutral-700/50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
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
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsAddingTask(project.name);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm transition-colors"
                                  >
                                    <Plus className="h-4 w-4" />
                                    Add Task
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsBulkAdding(project.name);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-md text-sm transition-colors"
                                  >
                                    <Plus className="h-4 w-4" />
                                    Bulk Add Checklist
                                  </button>
                                </div>

                                {isAddingTask === project.name && (
                                  <TaskForm
                                    onSubmit={(task) => handleAddTask(project.name, task)}
                                    onCancel={() => setIsAddingTask(null)}
                                  />
                                )}

                                {isBulkAdding === project.name && (
                                  <div className="space-y-4 bg-neutral-850 rounded-lg p-6">
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
                                    <div className="flex justify-end gap-3">
                                      <button
                                        onClick={() => {
                                          setIsBulkAdding(null);
                                          setBulkTaskInput("");
                                        }}
                                        className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleBulkAddTasks(project.name)}
                                        className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-md text-sm transition-colors"
                                      >
                                        Add Tasks
                                      </button>
                                    </div>
                                  </div>
                                )}

                                <div className="grid gap-4">
                                  {project.tasks.length === 0 ? (
                                    <div className="text-center py-8">
                                      <p className="text-neutral-400 mb-4">No tasks yet</p>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setIsAddingTask(project.name);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md text-sm transition-colors mx-auto"
                                      >
                                        <Plus className="h-4 w-4" />
                                        Add Your First Task
                                      </button>
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
                                            <button
                                              onClick={() => setEditingTask({ projectName: project.name, taskId: task.id })}
                                              className="p-1.5 text-neutral-400 hover:text-white transition-colors rounded-md hover:bg-neutral-700/50"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              onClick={() => handleDeleteTask(project.name, task.id)}
                                              className="p-1.5 text-neutral-400 hover:text-red-400 transition-colors rounded-md hover:bg-neutral-700/50"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </button>
                                          </div>
                                          <TaskExpanded
                                            task={task}
                                            onChecklistItemToggle={(taskId, itemId, done) => 
                                              handleChecklistItemToggle(taskId, itemId, done)
                                            }
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
        </Card>
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
          className="max-w-4xl max-h-[90vh] overflow-y-auto bg-neutral-900"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {selectedProject && (
            <>
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
                  </div>
                  <ReportButtons 
                    projectName={selectedProject.name}
                    tasks={selectedProject.tasks}
                  />
                  <button
                    onClick={() => setShowEmailSettings(true)}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                      "bg-neutral-800 text-white hover:bg-neutral-700 transition-colors"
                    )}
                  >
                    <Settings2 className="h-4 w-4" />
                    Email Settings
                  </button>
                </div>

                {showEmailSettings && selectedProject?.id && (
                  <EmailSettings
                    projectId={selectedProject.id}
                    onClose={() => setShowEmailSettings(false)}
                  />
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 