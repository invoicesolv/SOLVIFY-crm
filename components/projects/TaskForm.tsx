import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface TaskFormProps {
  task?: Task;
  onSubmit: (task: Omit<Task, 'id' | 'progress'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function TaskForm({ task, onSubmit, onCancel, onDelete }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title || '');
  const [deadline, setDeadline] = useState(task?.deadline || '');
  const [checklist, setChecklist] = useState<Omit<ChecklistItem, 'id'>[]>(
    task?.checklist.map(item => ({
      text: item.text,
      done: item.done,
      deadline: item.deadline
    })) || []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      deadline,
      checklist: checklist.map((item, index) => ({
        ...item,
        id: task?.checklist[index]?.id || index + 1
      }))
    });
  };

  const addChecklistItem = () => {
    setChecklist([...checklist, { text: '', done: false }]);
  };

  const removeChecklistItem = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  const updateChecklistItem = (index: number, updates: Partial<Omit<ChecklistItem, 'id'>>) => {
    setChecklist(checklist.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-gray-200 dark:bg-neutral-850 rounded-lg p-6 relative overflow-hidden">
      <div className="relative">
        <div className="relative z-10">
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="text-lg font-medium text-foreground bg-transparent border-none focus:outline-none focus:ring-0 placeholder-neutral-500 w-full"
          required
        />
        <div className="flex items-center gap-2">
          {onDelete && (
                <div className="group relative overflow-hidden rounded-full">
                  <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-red-900/30 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-full"></div>
                  
                  <div className="relative z-10 m-[1px] bg-background rounded-full hover:bg-neutral-750 transition-colors duration-300">
            <button
              type="button"
              onClick={onDelete}
                      className="p-2 border-0 bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <Trash2 className="h-5 w-5" />
            </button>
                  </div>
                </div>
          )}
              <div className="group relative overflow-hidden rounded-full">
                <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-full"></div>
                
                <div className="relative z-10 m-[1px] bg-background rounded-full hover:bg-neutral-750 transition-colors duration-300">
          <button
            type="button"
            onClick={onCancel}
                    className="p-2 border-0 bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
                </div>
              </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="px-3 py-1.5 bg-background border border-border dark:border-border rounded text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
        />
      </div>

      <div className="space-y-3">
        {checklist.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={item.text}
                onChange={(e) => updateChecklistItem(index, { text: e.target.value })}
                placeholder="Checklist item"
                className="w-full px-3 py-1.5 bg-background border border-border dark:border-border rounded text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                required
              />
              <input
                type="date"
                value={item.deadline || ''}
                onChange={(e) => updateChecklistItem(index, { deadline: e.target.value })}
                className="px-3 py-1.5 bg-background border border-border dark:border-border rounded text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
                <div className="group relative overflow-hidden rounded-full">
                  <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-red-900/30 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-full"></div>
                  
                  <div className="relative z-10 m-[1px] bg-background rounded-full hover:bg-neutral-750 transition-colors duration-300">
            <button
              type="button"
              onClick={() => removeChecklistItem(index)}
                      className="p-2 border-0 bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </button>
                  </div>
                </div>
          </div>
        ))}
            <div className="group relative overflow-hidden rounded-lg inline-block">
              <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-blue-900/30 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
              
              <div className="relative z-10 m-[1px] bg-background rounded-lg hover:bg-neutral-750 transition-colors duration-300">
        <button
          type="button"
          onClick={addChecklistItem}
                  className="flex items-center gap-2 px-3 py-1 text-sm border-0 bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Add checklist item
        </button>
              </div>
            </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
            <div className="group relative overflow-hidden rounded-lg">
              <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
              
              <div className="relative z-10 m-[1px] bg-background rounded-lg hover:bg-neutral-750 transition-colors duration-300">
        <button
          type="button"
          onClick={onCancel}
                  className="px-4 py-2 text-sm border-0 bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          Cancel
        </button>
              </div>
            </div>
            
            <div className="group relative overflow-hidden rounded-lg">
              <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-neutral-800 via-green-900/30 to-neutral-800 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
              
              <div className="relative z-10 m-[1px] bg-background rounded-lg hover:bg-neutral-750 transition-colors duration-300">
        <button
          type="submit"
                  className="px-4 py-2 text-sm border-0 bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          {task ? 'Save changes' : 'Create task'}
        </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
} 