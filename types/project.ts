export interface ChecklistItem {
  id: number;
  text: string;
  done: boolean;
  deadline?: string;
}

export interface Task {
  id: string;
  title: string;
  deadline?: string;
  progress: number;
  checklist: ChecklistItem[];
  project_id?: string;
  user_id?: string;
  assigned_to?: string;
}

export interface Project {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
  status: 'active' | 'completed' | 'on-hold';
  startDate: string;
  endDate?: string;
  description: string;
  tasks: Task[];
  assigned_to?: string;
} 