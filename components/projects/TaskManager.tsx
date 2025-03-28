"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, Edit2, Calendar, Trash2, Star, StarOff, CheckCircle, Clock } from "lucide-react";
import type { Task, ChecklistItem } from "@/types/project";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { TaskCard } from "@/components/ui/task-card";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface TaskManagerProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onChecklistItemUpdate: (taskId: string, itemId: number, isDone: boolean) => void;
  projectDeadline: string;
  projectName: string;
  projectDescription: string;
  projectId: string;
}

export function TaskManager({
  tasks: initialTasks,
  onTasksChange,
  onTaskUpdate,
  onChecklistItemUpdate,
  projectDeadline,
  projectName,
  projectDescription,
  projectId,
}: TaskManagerProps) {
  const { data: session } = useSession();
  const [importantTasks, setImportantTasks] = useState<string[]>([]);

  // Convert projectName to a valid storage key
  const storageKey = `${projectName.toLowerCase().replace(/\s+/g, "-")}-tasks`;

  // Initialize tasks from Supabase or use initial tasks
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window !== "undefined") {
      const savedTasks = localStorage.getItem(storageKey);
      return savedTasks ? JSON.parse(savedTasks) : initialTasks;
    }
    return initialTasks;
  });

  // Fetch important tasks on component mount
  useEffect(() => {
    const fetchImportantTasks = async () => {
      if (!session?.user?.id) return;

      try {
        const { data, error } = await supabase
          .from('important_tasks')
          .select('task_id')
          .eq('user_id', session.user.id);

        if (error) throw error;

        setImportantTasks(data.map(item => item.task_id));
      } catch (error) {
        console.error('Error fetching important tasks:', error);
      }
    };

    fetchImportantTasks();
  }, [session?.user?.id]);

  // Initialize tasks from Supabase or use initial tasks
  useEffect(() => {
    const fetchTasks = async () => {
      if (!session?.user?.id || !projectId) return;

      try {
        const { data, error } = await supabase
          .from('project_tasks')
          .select('*')
          .eq('project_id', projectId);

        if (error) throw error;

        if (data) {
          setTasks(data);
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
        toast.error('Failed to fetch tasks');
      }
    };

    fetchTasks();
  }, [session?.user?.id, projectId]);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(tasks));
      // Only notify parent if tasks are different from initialTasks
      if (JSON.stringify(tasks) !== JSON.stringify(initialTasks)) {
        onTasksChange(tasks);
      }
    }
  }, [tasks, storageKey, onTasksChange, initialTasks]);

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newSubtaskText, setNewSubtaskText] = useState("");

  const toggleImportant = async (taskId: string) => {
    if (!session?.user?.id) {
      toast.error('Please sign in to mark tasks as important');
      return;
    }

    const isCurrentlyImportant = importantTasks.includes(taskId);

    try {
      if (isCurrentlyImportant) {
        // Remove from important tasks
        const { error } = await supabase
          .from('important_tasks')
          .delete()
          .eq('task_id', taskId)
          .eq('user_id', session.user.id);

        if (error) throw error;

        setImportantTasks(prev => prev.filter(id => id !== taskId));
        toast.success('Removed from Today\'s Agenda');
      } else {
        // Add to important tasks
        const { error } = await supabase
          .from('important_tasks')
          .insert([{
            task_id: taskId,
            user_id: session.user.id
          }]);

        if (error) throw error;

        setImportantTasks(prev => [...prev, taskId]);
        toast.success('Added to Today\'s Agenda');
      }
    } catch (error) {
      console.error('Error toggling important task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !session?.user?.id) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: newTaskTitle,
      deadline: projectDeadline,
      progress: 0,
      checklist: [],
      project_id: projectId,
      user_id: session.user.id
    };

    try {
      const { error } = await supabase
        .from('project_tasks')
        .insert([newTask]);

      if (error) throw error;

      setTasks([...tasks, newTask]);
      setNewTaskTitle("");
      setIsAddingTask(false);
      toast.success('Task added successfully');
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task');
    }
  };

  const handleAddSubtask = async (taskId: string) => {
    if (!newSubtaskText.trim() || !session?.user?.id) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newItem: ChecklistItem = {
      id: Math.max(0, ...task.checklist.map((item) => item.id)) + 1,
      text: newSubtaskText,
      deadline: projectDeadline,
      done: false,
    };

    const updatedChecklist = [...task.checklist, newItem];

    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({ checklist: updatedChecklist })
        .eq('id', taskId);

      if (error) throw error;

      const updatedTasks = tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            checklist: updatedChecklist,
          };
        }
        return t;
      });

      setTasks(updatedTasks);
      setNewSubtaskText("");
      setSelectedTaskId(null);
      toast.success('Subtask added successfully');
    } catch (error) {
      console.error('Error adding subtask:', error);
      toast.error('Failed to add subtask');
    }
  };

  const handleCheckboxChange = async (taskId: string, itemId: number) => {
    if (!session?.user?.id) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedChecklist = task.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );

    // Calculate progress as an integer
    const completedItems = updatedChecklist.filter((item) => item.done).length;
    const totalItems = updatedChecklist.length;
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({ 
          checklist: updatedChecklist,
          progress: progress
        })
        .eq('id', taskId);

      if (error) throw error;

      const updatedTasks = tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            checklist: updatedChecklist,
            progress: progress,
          };
        }
        return t;
      });

      setTasks(updatedTasks);
      onChecklistItemUpdate(taskId, itemId, !task.checklist.find(i => i.id === itemId)?.done);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!session?.user?.id) return;

    try {
      const { error } = await supabase
        .from('project_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.filter((task) => task.id !== taskId));
      toast.success('Task deleted successfully');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const handleDeleteSubtask = async (taskId: string, itemId: number) => {
    if (!session?.user?.id) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedChecklist = task.checklist.filter(
      (item) => item.id !== itemId
    );

    // Calculate progress as an integer
    const completedItems = updatedChecklist.filter((item) => item.done).length;
    const totalItems = updatedChecklist.length;
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    try {
      const { error } = await supabase
        .from('project_tasks')
        .update({ 
          checklist: updatedChecklist,
          progress: progress
        })
        .eq('id', taskId);

      if (error) throw error;

      const updatedTasks = tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            checklist: updatedChecklist,
            progress: progress,
          };
        }
        return t;
      });

      setTasks(updatedTasks);
      toast.success('Subtask deleted successfully');
    } catch (error) {
      console.error('Error deleting subtask:', error);
      toast.error('Failed to delete subtask');
    }
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    if (!session?.user?.id) return;

    try {
      const { error } = await supabase
        .from('project_tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      const updatedTasks = tasks.map(task =>
        task.id === taskId
          ? { ...task, ...updates }
          : task
      );

      setTasks(updatedTasks);
      onTasksChange(updatedTasks);
      toast.success('Task updated successfully');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.reduce((count, task) => {
    // Count completed subtasks
    const completedSubtasks = task.checklist.filter(item => item.done).length;
    const totalSubtasks = task.checklist.length;
    
    // If all subtasks are done, count this task as completed
    return count + (totalSubtasks > 0 && completedSubtasks === totalSubtasks ? 1 : 0);
  }, 0);

  // Calculate overall progress including partial completion
  const overallProgress = tasks.reduce((total, task) => {
    if (task.checklist.length === 0) return total;
    const taskProgress = task.checklist.filter(item => item.done).length / task.checklist.length;
    return total + taskProgress;
  }, 0);

  const progressPercentage = tasks.length > 0 ? Math.round((overallProgress / tasks.length) * 100) : 0;

  return (
    <div className="w-full">
      <div className="flex gap-6">
        <motion.div layout className="flex-1 space-y-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {tasks
              .sort((a, b) => {
                // Calculate completion percentage for each task
                const aCompleted = a.checklist.length > 0 
                  ? a.checklist.filter(item => item.done).length / a.checklist.length 
                  : 0;
                const bCompleted = b.checklist.length > 0 
                  ? b.checklist.filter(item => item.done).length / b.checklist.length 
                  : 0;
                
                // Sort by completion (incomplete first)
                if (aCompleted === 1 && bCompleted !== 1) return 1;
                if (bCompleted === 1 && aCompleted !== 1) return -1;
                
                // If both have same completion status, sort by progress
                if (aCompleted === bCompleted) {
                  return a.progress - b.progress;
                }
                
                return 0;
              })
              .map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  layoutId={`task-container-${task.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{
                    layout: {
                      type: "spring",
                      bounce: 0.2,
                      duration: 0.6
                    },
                    opacity: { duration: 0.3 }
                  }}
                  style={{ position: "relative" }}
                >
                  <TaskCard
                    task={task}
                    onUpdate={handleTaskUpdate}
                    onDelete={handleDeleteTask}
                  />
                </motion.div>
              ))}
          </AnimatePresence>

          {/* Add Task Form */}
          <AnimatePresence mode="wait">
            {isAddingTask ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="p-4 bg-neutral-900 border-neutral-800">
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Task title"
                      className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAddingTask(false)}
                        className="text-neutral-400 hover:text-white border-neutral-700 hover:bg-neutral-800"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddTask}
                        className="bg-neutral-700 hover:bg-neutral-600 text-white"
                      >
                        Add Task
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setIsAddingTask(true)}
                className="w-full p-4 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all duration-200 text-neutral-400 hover:text-neutral-300 flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Task
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          layout
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-80 flex flex-col p-4 rounded-lg bg-neutral-900 border border-neutral-800 sticky top-4 h-fit"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-neutral-400" />
            <h2 className="text-sm font-medium text-white">
              Progress
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Completed</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">
                  {tasks.reduce((count, task) => count + task.checklist.filter(item => item.done).length, 0)} / {tasks.reduce((count, task) => count + task.checklist.length, 0)}
                </span>
                <span className="text-neutral-500">
                  ({Math.round((tasks.reduce((count, task) => count + task.checklist.filter(item => item.done).length, 0) / Math.max(1, tasks.reduce((count, task) => count + task.checklist.length, 0))) * 100)}%)
                </span>
              </div>
            </div>

            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-green-600"
                initial={{ width: 0 }}
                animate={{ 
                  width: `${Math.round((tasks.reduce((count, task) => count + task.checklist.filter(item => item.done).length, 0) / Math.max(1, tasks.reduce((count, task) => count + task.checklist.length, 0))) * 100)}%` 
                }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <Clock className="w-4 h-4" />
              <span>Deadline: {new Date(projectDeadline).toLocaleDateString()}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
} 