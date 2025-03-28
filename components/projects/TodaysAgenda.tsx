import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Star, StarOff, Calendar } from "lucide-react";
import { supabase, syncSupabaseSession } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  deadline?: string;
  progress: number;
  project_id: string;
  project_name: string;
  checklist: Array<{
    id: number;
    text: string;
    done: boolean;
  }>;
}

interface Project {
  name: string;
  workspace_id: string;
}

interface ProjectTask {
  id: string;
  title: string;
  deadline?: string;
  progress: number;
  project_id: string;
  checklist: Array<{
    id: number;
    text: string;
    done: boolean;
  }>;
  projects: Project;
}

interface ImportantTask {
  task_id: string;
  project_tasks: ProjectTask;
}

interface SupabaseResponse {
  task_id: string;
  project_tasks: {
    id: string;
    title: string;
    deadline?: string;
    progress: number;
    project_id: string;
    checklist: Array<{
      id: number;
      text: string;
      done: boolean;
    }>;
    projects: Project;
  };
}

export function TodaysAgenda() {
  const [importantTasks, setImportantTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();

  // Sync Supabase session when NextAuth session changes
  useEffect(() => {
    const syncSession = async () => {
      if (session?.accessToken) {
        await syncSupabaseSession(session.accessToken);
      }
    };
    
    syncSession();
  }, [session?.accessToken]);

  // Fetch important tasks
  useEffect(() => {
    const fetchImportantTasks = async () => {
      if (!session?.user?.id) {
        toast.error('Please sign in to view your agenda');
        setLoading(false);
        return;
      }

      try {
        // Log session details for debugging
        console.log('Session details:', {
          user: session.user,
          hasAccessToken: !!session.accessToken
        });

        // First get the user's workspaces
        const { data: teamMemberships, error: teamError } = await supabase
          .from('team_members')
          .select(`
            workspace_id,
            workspaces (
              id,
              name
            )
          `)
          .eq('user_id', session.user.id);

        if (teamError) {
          console.error('Error fetching team memberships:', teamError);
          throw new Error('Failed to load workspace access');
        }

        if (!teamMemberships?.length) {
          console.log('No workspaces found for user');
          setImportantTasks([]);
          setLoading(false);
          return;
        }

        const workspaceIds = teamMemberships.map(tm => tm.workspace_id);
        console.log('Found workspaces:', workspaceIds);

        // Fetch important tasks with workspace validation
        const { data: tasks, error } = await supabase
          .from('important_tasks')
          .select(`
            task_id,
            project_tasks (
              id,
              title,
              deadline,
              progress,
              project_id,
              checklist,
              projects (
                name,
                workspace_id
              )
            )
          `)
          .eq('user_id', session.user.id);

        if (error) throw error;

        // Filter tasks by workspace
        const formattedTasks = ((tasks || []) as unknown as SupabaseResponse[])
          .filter(item => workspaceIds.includes(item.project_tasks.projects.workspace_id))
          .map(item => ({
            id: item.project_tasks.id,
            title: item.project_tasks.title,
            deadline: item.project_tasks.deadline,
            progress: item.project_tasks.progress,
            project_id: item.project_tasks.project_id,
            project_name: item.project_tasks.projects.name,
            checklist: item.project_tasks.checklist
          }))
          .sort((a, b) => {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          });

        setImportantTasks(formattedTasks);
      } catch (error) {
        console.error('Error fetching important tasks:', error);
        toast.error('Failed to fetch important tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchImportantTasks();
  }, [session?.user?.id]);

  const toggleImportant = async (taskId: string, isCurrentlyImportant: boolean) => {
    if (!session?.user?.id) {
      toast.error('Please sign in to update tasks');
      return;
    }

    try {
      // Get the user's default workspace
      const { data: teamMemberships, error: teamError } = await supabase
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .limit(1);

      if (teamError) throw teamError;
      if (!teamMemberships?.length) {
        toast.error('No workspace found. Please create or join a workspace first.');
        return;
      }

      const workspaceId = teamMemberships[0].workspace_id;

      if (isCurrentlyImportant) {
        // Remove from important tasks
        const { error } = await supabase
          .from('important_tasks')
          .delete()
          .eq('task_id', taskId)
          .eq('user_id', session.user.id);

        if (error) throw error;

        setImportantTasks(prev => prev.filter(task => task.id !== taskId));
        toast.success('Removed from Today\'s Agenda');
      } else {
        // Verify task belongs to user's workspace
        const { data: taskData, error: taskError } = await supabase
          .from('project_tasks')
          .select(`
            id,
            projects (
              workspace_id
            )
          `)
          .eq('id', taskId)
          .single();

        if (taskError) throw taskError;

        const projectData = (taskData.projects as any) as Project;
        if (projectData.workspace_id !== workspaceId) {
          toast.error('You do not have permission to modify this task');
          return;
        }

        // Add to important tasks
        const { error } = await supabase
          .from('important_tasks')
          .insert([{
            task_id: taskId,
            user_id: session.user.id
          }]);

        if (error) throw error;

        // Fetch the task details to add to the list
        const { data: newTaskData, error: newTaskError } = await supabase
          .from('project_tasks')
          .select(`
            id,
            title,
            deadline,
            progress,
            project_id,
            checklist,
            projects (
              name,
              workspace_id
            )
          `)
          .eq('id', taskId)
          .single();

        if (newTaskError) throw newTaskError;

        const newTask: Task = {
          id: newTaskData.id,
          title: newTaskData.title,
          deadline: newTaskData.deadline,
          progress: newTaskData.progress,
          project_id: newTaskData.project_id,
          project_name: ((newTaskData.projects as any) as Project).name,
          checklist: newTaskData.checklist
        };

        setImportantTasks(prev => [...prev, newTask].sort((a, b) => {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }));

        toast.success('Added to Today\'s Agenda');
      }
    } catch (error) {
      console.error('Error toggling important task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleChecklistItemToggle = async (taskId: string, itemId: number, isDone: boolean) => {
    if (!session?.user?.id) {
      toast.error('Please sign in to update tasks');
      return;
    }

    try {
      // Get the user's default workspace
      const { data: teamMemberships, error: teamError } = await supabase
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .limit(1);

      if (teamError) throw teamError;
      if (!teamMemberships?.length) {
        toast.error('No workspace found. Please create or join a workspace first.');
        return;
      }

      const workspaceId = teamMemberships[0].workspace_id;

      // Verify task belongs to user's workspace
      const { data: taskData, error: taskError } = await supabase
        .from('project_tasks')
        .select(`
          id,
          checklist,
          projects (
            workspace_id
          )
        `)
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;

      const projectData = (taskData.projects as any) as Project;
      if (projectData.workspace_id !== workspaceId) {
        toast.error('You do not have permission to modify this task');
        return;
      }

      const task = importantTasks.find(t => t.id === taskId);
      if (!task) return;

      const updatedChecklist = task.checklist.map(item =>
        item.id === itemId ? { ...item, done: isDone } : item
      );

      // Calculate progress as an integer
      const completedItems = updatedChecklist.filter(item => item.done).length;
      const totalItems = updatedChecklist.length;
      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      // Update in Supabase
      const { error } = await supabase
        .from('project_tasks')
        .update({
          checklist: updatedChecklist,
          progress: progress
        })
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      setImportantTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, checklist: updatedChecklist, progress }
          : t
      ));

      toast.success('Task updated');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  if (loading) {
    return (
      <Card className="bg-neutral-800 border-neutral-700 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-neutral-700 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-neutral-700 rounded w-3/4"></div>
            <div className="h-4 bg-neutral-700 rounded w-2/3"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-neutral-800 border-neutral-700 p-4">
      <h2 className="text-lg font-semibold text-white mb-4">nda</h2>
      {importantTasks.length === 0 ? (
        <p className="text-neutral-400 text-sm">No tasks marked as important yet.</p>
      ) : (
        <div className="space-y-3">
          {importantTasks.map(task => (
            <div
              key={task.id}
              className="flex flex-col gap-4 p-3 bg-neutral-850 rounded-lg border border-neutral-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-white truncate">{task.title}</h3>
                    <span className="text-xs text-neutral-500">({task.project_name})</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {task.deadline && (
                      <div className="flex items-center gap-1 text-xs text-neutral-400">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.deadline).toLocaleDateString()}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-24 bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-neutral-400"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-neutral-400">{task.progress}%</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleImportant(task.id, true)}
                  className="p-1 text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  <Star className="h-4 w-4" />
                </button>
              </div>

              {/* Subtasks */}
              <div className="pl-4 space-y-2">
                {task.checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 group"
                  >
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => handleChecklistItemToggle(task.id, item.id, !item.done)}
                      className="rounded border-neutral-700 bg-neutral-900 text-neutral-400 focus:ring-neutral-600"
                    />
                    <span
                      className={cn("text-sm transition-colors", {
                        "text-neutral-400 line-through": item.done,
                        "text-white": !item.done,
                      })}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
} 