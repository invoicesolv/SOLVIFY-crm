import { CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: number;
  text: string;
  done: boolean;
  deadline?: string;
}

interface Task {
  id: string;
  title: string;
  deadline?: string;
  progress: number;
  checklist: ChecklistItem[];
}

interface TaskExpandedProps {
  task: Task;
  onChecklistItemToggle: (taskId: string, itemId: number, done: boolean) => void;
}

export function TaskExpanded({ task, onChecklistItemToggle }: TaskExpandedProps) {
  const isCompleted = task.checklist.length > 0 && task.checklist.every(item => item.done);

  return (
    <div className={cn(
      "py-4 px-6 rounded-lg transition-colors",
      isCompleted ? "bg-green-900/20" : "bg-neutral-850"
    )}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={cn(
          "text-lg font-medium",
          isCompleted ? "text-green-400" : "text-white"
        )}>{task.title}</h3>
        {task.deadline && (
          <span className="text-sm text-neutral-400">
            Due: {new Date(task.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {task.checklist.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 group"
            onClick={() => onChecklistItemToggle(task.id, item.id, !item.done)}
          >
            <button className={cn(
              "mt-0.5 transition-colors",
              item.done ? "text-green-400" : "text-neutral-400 hover:text-white"
            )}>
              {item.done ? (
                <CheckSquare className="h-5 w-5" />
              ) : (
                <Square className="h-5 w-5" />
              )}
            </button>
            <div className="flex-1">
              <p className={cn(
                "text-sm transition-colors",
                item.done ? "text-green-400 line-through" : "text-white"
              )}>
                {item.text}
              </p>
              {item.deadline && (
                <span className="text-xs text-neutral-500">
                  Due: {new Date(item.deadline).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 