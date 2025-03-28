"use client";

import { useEffect, useState } from "react";
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TaskManager } from "@/components/projects/TaskManager";
import type { Project, Task } from "@/types/project";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export default function ProjectPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    async function fetchProjectDetails() {
      if (!session?.user?.id) {
        console.log('No user session found, cannot fetch project details');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching project details for user ID:', session.user.id, 'project ID:', params.id);
        
        // Fetch project from Supabase
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', params.id)
          .eq('user_id', session.user.id)
          .single();

        if (projectError) {
          console.error('Error fetching project:', projectError);
          throw projectError;
        }

        // Fetch project tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from('project_tasks')
          .select('*')
          .eq('project_id', params.id)
          .eq('user_id', session.user.id);

        if (tasksError) {
          console.error('Error fetching project tasks:', tasksError);
          throw tasksError;
        }

        // Format the project data
        const formattedProject = {
          ...projectData,
          tasks: tasksData || [],
          status: (projectData.status?.toLowerCase() || 'active') as 'active' | 'completed' | 'on-hold',
          startDate: projectData.start_date,
          endDate: projectData.end_date,
          customerName: projectData.customer_name || 'Unknown Customer',
          customerId: projectData.customer_id
        };

        console.log('Fetched project:', formattedProject.name, 'with', formattedProject.tasks.length, 'tasks');
        setProject(formattedProject);
      } catch (err) {
        console.error('Error in fetchProjectDetails:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch project details'));
      } finally {
        setLoading(false);
      }
    }

    fetchProjectDetails();
  }, [params.id, session?.user?.id]);

  const handleTasksChange = async (tasks: Task[]) => {
    if (!project || !session?.user?.id) return;

    try {
      // Update tasks in Supabase
      for (const task of tasks) {
        const { error } = await supabase
          .from('project_tasks')
          .upsert({
            ...task,
            project_id: project.id,
            user_id: session.user.id
          });

        if (error) throw error;
      }
      
      setProject({ ...project, tasks });
      toast.success('Tasks updated successfully');
    } catch (error) {
      console.error('Error updating tasks:', error);
      toast.error('Failed to update tasks');
    }
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    if (!project || !session?.user?.id) return;

    try {
      // Update task in Supabase
      const { error } = await supabase
        .from('project_tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      const updatedTasks = project.tasks.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      );

      setProject({ ...project, tasks: updatedTasks });
      toast.success('Task updated successfully');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleChecklistItemUpdate = async (taskId: string, itemId: number, isDone: boolean) => {
    if (!project || !session?.user?.id) return;

    const updatedTasks = project.tasks.map(task => {
      if (task.id === taskId) {
        const updatedChecklist = task.checklist.map(item =>
          item.id === itemId ? { ...item, done: isDone } : item
        );
        return {
          ...task,
          checklist: updatedChecklist,
          progress: Math.round((updatedChecklist.filter(item => item.done).length / updatedChecklist.length) * 100)
        };
      }
      return task;
    });

    try {
      // Get the updated task
      const updatedTask = updatedTasks.find(task => task.id === taskId);
      if (!updatedTask) return;

      // Update task in Supabase
      const { error } = await supabase
        .from('project_tasks')
        .update({
          checklist: updatedTask.checklist,
          progress: updatedTask.progress
        })
        .eq('id', taskId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      setProject({ ...project, tasks: updatedTasks });
    } catch (error) {
      console.error('Error updating checklist item:', error);
      toast.error('Failed to update checklist item');
    }
  };

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/projects"
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-400"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-neutral-400">
            Failed to load project details. Please try again later.
          </div>
        ) : project ? (
          <>
            <Card className="bg-neutral-800 border-neutral-700 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h1 className="text-2xl font-semibold text-white mb-4">{project.name}</h1>
                  <div className="space-y-2 text-sm">
                    <p className="text-neutral-400">Customer: <Link href={`/customers/${project.customerId}`} className="text-white hover:underline">{project.customerName}</Link></p>
                    <p className="text-neutral-400">Status: 
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                        project.status === "active" ? "bg-green-900/20 text-green-400" :
                        project.status === "completed" ? "bg-neutral-900/20 text-neutral-400" :
                        "bg-yellow-900/20 text-yellow-400"
                      }`}>
                        {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                      </span>
                    </p>
                    <p className="text-neutral-400">Start Date: <span className="text-white">{new Date(project.startDate).toLocaleDateString()}</span></p>
                    {project.endDate && (
                      <p className="text-neutral-400">End Date: <span className="text-white">{new Date(project.endDate).toLocaleDateString()}</span></p>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-neutral-800 border-neutral-700 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Description</h2>
              <p className="text-neutral-400 whitespace-pre-wrap">{project.description || "No description provided."}</p>
            </Card>

            <Card className="bg-neutral-800 border-neutral-700 p-6">
              <TaskManager
                tasks={project.tasks}
                onTasksChange={handleTasksChange}
                onTaskUpdate={handleTaskUpdate}
                onChecklistItemUpdate={handleChecklistItemUpdate}
                projectDeadline={project.endDate || project.startDate}
                projectName={project.name}
                projectDescription={project.description}
                projectId={project.id || params.id}
              />
            </Card>
          </>
        ) : null}
      </div>
    </SidebarDemo>
  );
} 