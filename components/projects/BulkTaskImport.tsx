"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Task, ChecklistItem } from "@/types/project";
import { useAuth } from '@/lib/auth-client';
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface BulkTaskImportProps {
  projectId: string;
  projectDeadline: string;
  onTasksAdded: (tasks: Task[]) => void;
  onClose: () => void;
}

export function BulkTaskImport({
  projectId,
  projectDeadline,
  onTasksAdded,
  onClose,
}: BulkTaskImportProps) {
  const { user } = useAuth();
  const [bulkText, setBulkText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    tasksAdded: number;
    subtasksAdded: number;
  } | null>(null);

  const processImport = async () => {
    if (!bulkText.trim() || !user?.id) {
      toast.error('Please enter some tasks');
      return;
    }

    setIsProcessing(true);
    
    try {
      const lines = bulkText.split('\n');
      if (lines.length === 0) {
        toast.error('No valid tasks found');
        setIsProcessing(false);
        return;
      }

      const tasks: Task[] = [];
      let currentTask: Task | null = null;
      let subtasksAdded = 0;

      for (const line of lines) {
        // Check if line starts with spaces or tab
        const isSubtask = /^[\t ]/.test(line);
        const trimmedLine = line.trim();
        
        if (!trimmedLine) continue; // Skip empty lines

        if (!isSubtask) {
          // This is a main task
          if (currentTask) {
            tasks.push(currentTask);
          }
          currentTask = {
            id: crypto.randomUUID(),
            title: trimmedLine,
            deadline: projectDeadline,
            progress: 0,
            checklist: [],
            project_id: projectId,
            user_id: user.id,
          };
        } else if (currentTask) {
          // This is a subtask
            currentTask.checklist.push({
              id: currentTask.checklist.length + 1,
            text: trimmedLine,
              done: false,
              deadline: projectDeadline,
            });
            subtasksAdded++;
        }
      }

      // Don't forget to add the last task
      if (currentTask) {
        tasks.push(currentTask);
      }

      if (tasks.length === 0) {
        toast.error('No valid tasks found');
        setIsProcessing(false);
        return;
      }

      console.log('Adding tasks:', tasks); // Debug log

      const { error } = await supabase.from('project_tasks').insert(tasks);
      if (error) throw error;

      setImportSummary({ tasksAdded: tasks.length, subtasksAdded });
      onTasksAdded(tasks);
      toast.success(`Added ${tasks.length} tasks with ${subtasksAdded} subtasks`);
    } catch (error) {
      console.error('Error adding tasks:', error);
      toast.error('Failed to add tasks');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-6 bg-background border-border max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-medium text-foreground">Bulk Import Tasks</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {importSummary ? (
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-green-600 dark:text-green-400 font-medium">Import Successful</h3>
              <p className="text-foreground dark:text-neutral-300">
                Added {importSummary.tasksAdded} tasks with {importSummary.subtasksAdded} subtasks to your project.
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} className="bg-background hover:bg-gray-200 dark:bg-muted text-foreground">
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-blue-600 dark:text-blue-400 font-medium">Format Instructions</h3>
              <p className="text-foreground dark:text-neutral-300">
                Enter one task per line. For subtasks, indent with spaces or a tab at the beginning of the line.
              </p>
              <div className="mt-2 p-2 bg-background rounded text-sm text-foreground dark:text-neutral-300 font-mono">
                <div>Task 1</div>
                <div className="pl-4">Subtask 1.1</div>
                <div className="pl-4">Subtask 1.2</div>
                <div>Task 2</div>
                <div className="pl-4">Subtask 2.1</div>
              </div>
            </div>
          </div>

          <Textarea
            placeholder="Enter your tasks here..."
            className="min-h-[200px] bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-gray-400"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground border-border hover:bg-background"
            >
              Cancel
            </Button>
            <Button
              onClick={processImport}
              disabled={isProcessing || !bulkText.trim()}
              className="bg-gray-200 dark:bg-muted hover:bg-gray-300 dark:hover:bg-neutral-600 text-foreground"
            >
              {isProcessing ? "Processing..." : "Import Tasks"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
} 