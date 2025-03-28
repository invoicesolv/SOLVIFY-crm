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
    <form onSubmit={handleSubmit} className="space-y-4 bg-neutral-850 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="text-lg font-medium text-white bg-transparent border-none focus:outline-none focus:ring-0 placeholder-neutral-500 w-full"
          required
        />
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-2 text-neutral-400 hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
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
                className="w-full px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                required
              />
              <input
                type="date"
                value={item.deadline || ''}
                onChange={(e) => updateChecklistItem(index, { deadline: e.target.value })}
                className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
            <button
              type="button"
              onClick={() => removeChecklistItem(index)}
              className="p-2 text-neutral-400 hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addChecklistItem}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add checklist item
        </button>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-md text-sm transition-colors"
        >
          {task ? 'Save changes' : 'Create task'}
        </button>
      </div>
    </form>
  );
} 