"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Plus, Clock, Users, CheckCircle, AlertCircle, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from '@/lib/supabase';
import { Tables } from '@/lib/database.types';

type Project = Tables<'projects'> & {
  tasks?: Tables<'project_tasks'>[];
};

interface ProjectSidebarProps {
  workspaceId?: string;
  currentUserId?: string;
  isMainView?: boolean;
  className?: string;
}

export function ProjectSidebar({ workspaceId, currentUserId, isMainView = false, className }: ProjectSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    dueDate: '',
    color: 'blue'
  });

  // Fetch projects from Supabase
  useEffect(() => {
    if (workspaceId) {
      fetchProjects();
    }
  }, [workspaceId]);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      
      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', workspaceId)
        .neq('status', 'completed')
        .order('created_at', { ascending: false });

      if (projectsError) {
        console.error('Error fetching projects:', projectsError);
        return;
      }

      // Fetch tasks for each project
      const projectsWithTasks = await Promise.all(
        (projectsData || []).map(async (project) => {
          const { data: tasksData } = await supabase
            .from('project_tasks')
            .select('*')
            .eq('project_id', project.id)
            .order('created_at', { ascending: true });

          return {
            ...project,
            tasks: tasksData || []
          };
        })
      );

      setProjects(projectsWithTasks);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const activeProjects = projects.filter(p => p.status !== 'completed');
  const displayProjects = isMainView ? activeProjects : activeProjects.slice(0, 3);

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.dueDate || !workspaceId || !currentUserId) return;

    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          name: newProject.name,
          description: newProject.description,
          end_date: newProject.dueDate,
          status: 'planning',
          user_id: currentUserId,
          workspace_id: workspaceId
        });

      if (error) {
        console.error('Error creating project:', error);
        return;
      }

      // Refresh projects
      await fetchProjects();
      setNewProject({ name: '', description: '', dueDate: '', color: 'blue' });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const toggleTask = async (projectId: string, taskId: string) => {
    try {
      // Find the current task
      const project = projects.find(p => p.id === projectId);
      const task = project?.tasks?.find(t => t.id === taskId);
      
      if (!task) return;

      // Toggle task completion
      const { error } = await supabase
        .from('project_tasks')
        .update({ 
          completion_percentage: task.completion_percentage === 100 ? 0 : 100 
        })
        .eq('id', taskId);

      if (error) {
        console.error('Error updating task:', error);
        return;
      }

      // Refresh projects to update progress
      await fetchProjects();
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'planning': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-300';
      case 'in-progress': return 'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300';
      case 'review': return 'bg-purple-100 text-purple-700 dark:bg-purple-950/20 dark:text-purple-300';
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-300';
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const calculateProgress = (tasks: Tables<'project_tasks'>[] = []) => {
    if (tasks.length === 0) return 0;
    const totalCompletion = tasks.reduce((sum, task) => sum + (task.completion_percentage || 0), 0);
    return Math.round(totalCompletion / tasks.length);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className={`${isMainView ? 'p-6' : 'space-y-3'} ${className}`}>
        <div className="text-center py-4 text-muted-foreground">
          <div className="animate-spin h-6 w-6 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isMainView ? 'p-6' : 'space-y-3'} ${className}`}>
      {isMainView && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-green-500" />
            <h2 className="text-xl font-semibold text-foreground">Projects</h2>
          </div>
          <Button
            onClick={() => setShowCreateForm(true)}
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      )}

      {!isMainView && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">Active Projects</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateForm(true)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Create Project Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground">New Project</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  ×
                </Button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input
                    id="projectName"
                    value={newProject.name}
                    onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter project name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newProject.description}
                    onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Project description"
                  />
                </div>
                
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={newProject.dueDate}
                    onChange={(e) => setNewProject(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
                
                <Button onClick={handleCreateProject} className="w-full">
                  Create Project
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Projects List */}
      <div className="space-y-3">
        {displayProjects.map((project) => {
          const progress = calculateProgress(project.tasks);
          return (
            <Card key={project.id} className="p-4">
              <div className="space-y-3">
                {/* Project Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="text-sm font-medium text-foreground">{project.name}</h5>
                      <Badge className={getStatusColor(project.status)}>
                        {project.status || 'planning'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{project.description}</p>
                    
                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  </div>
                </div>

                {/* Project Details */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Due {formatDate(project.end_date)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>{project.tasks?.length || 0} tasks</span>
                  </div>
                </div>

                {/* Tasks Preview */}
                {isMainView && project.tasks && project.tasks.length > 0 && (
                  <div className="space-y-2">
                    <h6 className="text-xs font-medium text-foreground">Tasks</h6>
                    {project.tasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="flex items-center gap-2 text-xs">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleTask(project.id, task.id)}
                          className="h-auto p-0"
                        >
                          {(task.completion_percentage || 0) === 100 ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                          )}
                        </Button>
                        <span className={`flex-1 ${(task.completion_percentage || 0) === 100 ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {task.title}
                        </span>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority || 'medium'}
                        </Badge>
                      </div>
                    ))}
                    {project.tasks.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{project.tasks.length - 3} more tasks
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
        
        {displayProjects.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active projects</p>
          </div>
        )}
      </div>
    </div>
  );
} 