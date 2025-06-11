"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, Edit2, Calendar, Trash2, Star, StarOff, CheckCircle, Clock, FileText, Check, CheckSquare, ChevronDown, ChevronRight, CircleEllipsis, Square, User, Link, FileUp } from "lucide-react";
import type { Task, ChecklistItem } from "@/types/project";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { TaskCard } from "@/components/ui/task-card";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BulkTaskImport } from "./BulkTaskImport";
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface TaskManagerProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onChecklistItemUpdate: (taskId: string, itemId: number, isDone: boolean) => void;
  projectDeadline: string;
  projectName: string;
  projectDescription: string;
  projectId: string;
  onMoveTask?: (task: Task) => void;
  onMoveSubtask?: (task: Task, subtask: ChecklistItem) => void;
  showMonthlyGrouping?: boolean;
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
  onMoveTask,
  onMoveSubtask,
  showMonthlyGrouping,
}: TaskManagerProps) {
  const { data: session } = useSession();
  const [isImportingTasks, setIsImportingTasks] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoiceDescription, setInvoiceDescription] = useState<string>("");
  const [invoicePrice, setInvoicePrice] = useState<number>(1000);
  const [invoiceType, setInvoiceType] = useState<string>("INVOICE");
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [existingInvoices, setExistingInvoices] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<string>("");
  const [isLinkingInvoice, setIsLinkingInvoice] = useState(false);
  const { members } = useWorkspaceMembers();
  const [hasFortnoxProjectNumber, setHasFortnoxProjectNumber] = useState<boolean | null>(null);
  const [invoiceQuantity, setInvoiceQuantity] = useState<number>(1);
  const [invoiceUnit, setInvoiceUnit] = useState<string>("h");
  const [invoiceVat, setInvoiceVat] = useState<number>(25);
  const [invoiceAccountNumber, setInvoiceAccountNumber] = useState<string>("");

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

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !session?.user?.id) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: newTaskTitle,
      deadline: projectDeadline,
      progress: 0,
      checklist: [],
      project_id: projectId,
      user_id: session.user.id,
      assigned_to: undefined // Default to unassigned
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

      // Update local state
      const updatedTasks = tasks.map(task => {
        if (task.id === taskId) {
          return {
            ...task,
            ...updates,
            // If updating checklist, recalculate progress
            ...(updates.checklist ? {
              progress: calculateProgress(updates.checklist)
            } : {})
          };
        }
        return task;
      });

      setTasks(updatedTasks);
      
      // Notify parent component
      if (onTaskUpdate) {
        onTaskUpdate(taskId, updates);
      }
      
      toast.success('Task updated successfully');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  // Helper function to calculate progress
  const calculateProgress = (checklist: ChecklistItem[]) => {
    const completedItems = checklist.filter(item => item.done).length;
    const totalItems = checklist.length;
    return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
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

  const handleBulkTasksAdded = (newTasks: Task[]) => {
    setTasks([...tasks, ...newTasks]);
    setIsImportingTasks(false);
  };

  useEffect(() => {
    if (projectName && selectedTasks.length > 0) {
      const selectedTaskTitles = tasks
        .filter(task => selectedTasks.includes(task.id))
        .map(task => task.title)
        .join(', ');
      
      setInvoiceDescription(`Services for project ${projectName} - ${selectedTaskTitles}`);
    } else if (projectName) {
      setInvoiceDescription(`Services for project ${projectName}`);
    }
  }, [selectedTasks, projectName, tasks]);

  // Fetch existing invoices when the dialog opens
  useEffect(() => {
    if (showInvoiceDialog && projectId) {
      fetchExistingInvoices();
    }
  }, [showInvoiceDialog, projectId]);

  const fetchExistingInvoices = async () => {
    if (!projectId) return;
    
    try {
      // Try to get Fortnox project number if available
      let fortnoxProjectId: string | null = null;
      let shouldUseProjectId = false;
      
      // Check if projectId is an internal ID and not a Fortnox number
      if (!projectId.match(/^\d+$/)) {
        const { data: projectData, error } = await supabase
          .from('projects')
          .select('fortnox_project_number')
          .eq('id', projectId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching Fortnox project number:', error);
        } else if (projectData?.fortnox_project_number) {
          fortnoxProjectId = projectData.fortnox_project_number;
          shouldUseProjectId = true;
        }
      } else {
        // If the projectId is numeric, it might already be a Fortnox project number
        fortnoxProjectId = projectId;
        shouldUseProjectId = true;
      }
      
      // If we have a Fortnox project ID, fetch invoices associated with this project
      let invoicesResponse;
      
      if (shouldUseProjectId && fortnoxProjectId) {
        // Fetch invoices for specific project
        invoicesResponse = await fetch(`/api/fortnox/projects/${fortnoxProjectId}/invoices`, {
          headers: {
            'user-id': session?.user?.id || ''
          }
        });
      } else {
        // Fallback to fetching recent invoices not linked to any project
        invoicesResponse = await fetch(`/api/fortnox/invoices/recent`, {
          headers: {
            'user-id': session?.user?.id || ''
          }
        });
      }
      
      let formattedInvoices = [];
      
      if (invoicesResponse && invoicesResponse.ok) {
        const data = await invoicesResponse.json();
        
        // Format the invoice data for the dropdown
        formattedInvoices = (data.Invoices || []).map((invoice: any) => ({
          id: invoice.DocumentNumber,
          invoice_number: `${invoice.DocumentNumber} - ${new Date(invoice.InvoiceDate).toLocaleDateString()} (${invoice.Total} SEK)`
        }));
      } else {
        console.warn('Could not fetch invoices for project, falling back to general invoice search');
        
        // Fallback to search for the project name in invoice comments
        const fallbackResponse = await fetch(`/api/fortnox/invoices?limit=20`, {
          headers: {
            'user-id': session?.user?.id || ''
          }
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          
          formattedInvoices = (fallbackData.Invoices || []).map((invoice: any) => ({
            id: invoice.DocumentNumber,
            invoice_number: `${invoice.DocumentNumber} - ${new Date(invoice.InvoiceDate).toLocaleDateString()} (${invoice.Total} SEK)`
          }));
        }
      }
      
      setExistingInvoices(formattedInvoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setExistingInvoices([]);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId) 
        : [...prev, taskId]
    );
  };

  const toggleSelectAllTasks = () => {
    if (selectedTasks.length === tasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(tasks.map(task => task.id));
    }
  };

  const handleCreateInvoice = async () => {
    if (!projectId || selectedTasks.length === 0) {
      toast.error('Please select at least one task');
      return;
    }
    
    setIsCreatingInvoice(true);
    console.log('========== INVOICE CREATION DEBUGGING ==========');
    console.log('Creating invoice for project ID:', projectId);
    console.log('Selected tasks:', selectedTasks);
    
    try {
      // First get the project details including customer_id
      const { data: projectDetails, error: projectError } = await supabase
          .from('projects')
        .select('fortnox_project_number, customer_id, customer_name')
          .eq('id', projectId)
          .maybeSingle();
        
      console.log('Project details from database:', projectDetails);
      console.log('Project fetch error:', projectError);

      if (projectError) {
        console.error('Error fetching project details:', projectError);
        toast.error('Error fetching project details');
        setIsCreatingInvoice(false);
        return;
      }

      if (!projectDetails?.customer_id) {
        console.error('No customer linked to this project');
        toast.error('This project has no customer linked to it. Please link a customer first.');
        setIsCreatingInvoice(false);
        return;
      }

      // Try to get Fortnox project number if available, but don't require it
      let fortnoxProjectId: string | null = projectDetails?.fortnox_project_number || null;
      console.log('Fortnox project number:', fortnoxProjectId);
      
      // Generate description from selected tasks, including subtasks
      const selectedTasksWithDetails = tasks
        .filter(task => selectedTasks.includes(task.id))
        .map(task => {
          // Include subtasks if they exist
          const subtasksList = task.checklist && task.checklist.length > 0
            ? `\n  - ${task.checklist.map(item => item.text).join('\n  - ')}`
            : '';
          
          return `${task.title}${subtasksList}`;
        });
      
      const taskDetailsForInvoice = selectedTasksWithDetails.join('\n\n');
      const selectedTaskTitles = tasks
        .filter(task => selectedTasks.includes(task.id))
        .map(task => task.title)
        .join(', ');
      
      // Use a more descriptive invoice description
      const fullInvoiceDescription = invoiceDescription || `Services for project ${projectName}`;
      
      // Fetch customer email from our database
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('email, customer_number, name')
        .eq('id', projectDetails.customer_id)
        .single();
      
      console.log('Customer data from database:', customerData);
      console.log('Customer fetch error:', customerError);
      
      if (customerError) {
        console.error('Error fetching customer details:', customerError);
      }
      
      const customerEmail = customerData?.email;
      const customerNumber = customerData?.customer_number;
      const customerName = customerData?.name || projectDetails.customer_name || projectName;
      
      console.log('Creating invoice with tasks:', selectedTaskTitles);
      console.log('Customer ID:', projectDetails.customer_id);
      console.log('Customer number:', customerNumber);
      console.log('Customer email:', customerEmail);
      console.log('Customer name:', customerName);
      
      // Prepare the request payload and log it for debugging
      const requestPayload = {
          // Only include projectNumber if we have one
          ...(fortnoxProjectId ? { projectNumber: fortnoxProjectId } : {}),
          taskIds: selectedTasks,
          taskDetails: taskDetailsForInvoice,
        customerName: customerName, 
        customerNumber: customerNumber, // Include customer number if available
          ...(customerEmail ? { customerEmail } : {}), // Include customer email if we have it
        customer_id: projectDetails.customer_id, // Add the customer ID for our database
          invoiceDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          currency: "SEK",
          comments: taskDetailsForInvoice, // Include full task details with subtasks in comments
          invoiceType: invoiceType, // Add the selected invoice type
          invoiceRows: [
            {
              description: fullInvoiceDescription,
            quantity: invoiceQuantity,
              price: invoicePrice,
            unit: invoiceUnit,
            vat: invoiceVat,
            ...(invoiceAccountNumber ? { accountNumber: invoiceAccountNumber } : {})
            }
          ]
      };
      
      console.log('Full request payload:', JSON.stringify(requestPayload, null, 2));
      
      const response = await fetch('/api/fortnox/invoices/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': session?.user?.id || ''
        },
        body: JSON.stringify(requestPayload)
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      let data;
      
      try {
        data = await response.json();
        console.log('Response data:', data);
      } catch (jsonError) {
        console.error('Error parsing response JSON:', jsonError);
        toast.error('Failed to parse API response');
        setIsCreatingInvoice(false);
        return;
      }
      
      if (response.ok) {
        toast.success(`Invoice ${data.Invoice?.DocumentNumber} created successfully`);
        setSelectedTasks([]);
        setShowInvoiceDialog(false);
      } else {
        console.error('Failed to create invoice:', data);
        
        // Improved error handling with specific messages
        if (data.code === 2000357 || (data.details && data.details.includes('email'))) {
          toast.error(
            'Invalid email address detected. The invoice was created as a draft instead.',
            { duration: 6000 }
          );
          // Refresh invoices to show the newly created draft
          fetchExistingInvoices();
          setSelectedTasks([]);
          setShowInvoiceDialog(false);
        } else {
          toast.error(`Failed to create invoice: ${data.error || 'Unknown error'}. ${data.details || ''}`);
        }
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice - please check console for details');
    } finally {
      console.log('========== END INVOICE CREATION DEBUGGING ==========');
      setIsCreatingInvoice(false);
    }
  };

  const handleLinkToExistingInvoice = async () => {
    if (!projectId || selectedTasks.length === 0 || !selectedInvoice) {
      toast.error('Please select tasks and an invoice');
      return;
    }
    
    setIsLinkingInvoice(true);
    
    try {
      // Try to get Fortnox project number if available
      let fortnoxProjectId: string | null = null;
      
      if (!projectId.match(/^\d+$/)) {
        const { data: projectData, error } = await supabase
          .from('projects')
          .select('fortnox_project_number')
          .eq('id', projectId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching Fortnox project number:', error);
        } else if (projectData?.fortnox_project_number) {
          fortnoxProjectId = projectData.fortnox_project_number;
        }
        // Continue without a project number if not found
      } else {
        // If projectId is numeric, use it as is
        fortnoxProjectId = projectId;
      }
      
      // Generate task details from selected tasks, including subtasks
      const selectedTasksWithDetails = tasks
        .filter(task => selectedTasks.includes(task.id))
        .map(task => {
          // Include subtasks if they exist
          const subtasksList = task.checklist && task.checklist.length > 0
            ? `\n  - ${task.checklist.map(item => item.text).join('\n  - ')}`
            : '';
          
          return `${task.title}${subtasksList}`;
        });
      
      const taskDetailsForInvoice = selectedTasksWithDetails.join('\n\n');
      const selectedTaskTitles = tasks
        .filter(task => selectedTasks.includes(task.id))
        .map(task => task.title)
        .join(', ');
        
      console.log('Linking tasks to invoice:', selectedInvoice);
      console.log('User ID:', session?.user?.id);
      
      const response = await fetch('/api/fortnox/invoices/link-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': session?.user?.id || ''
        },
        body: JSON.stringify({
          invoiceId: selectedInvoice,
          projectId: projectId, // Always send the internal project ID
          taskIds: selectedTasks,
          taskDetails: taskDetailsForInvoice,
          // Only include if we have one
          ...(fortnoxProjectId ? { fortnoxProjectNumber: fortnoxProjectId } : {})
        })
      });
      
      let data;
      
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Error parsing response JSON:', jsonError);
        toast.error('Failed to parse API response');
        setIsLinkingInvoice(false);
        return;
      }
      
      if (response.ok) {
        toast.success('Tasks linked to invoice successfully');
        setSelectedTasks([]);
        setShowInvoiceDialog(false);
      } else {
        console.error('Failed to link tasks:', data);
        toast.error(`Failed to link tasks: ${data.error || 'Unknown error'}. ${data.details || ''}`);
      }
    } catch (error) {
      console.error('Error linking tasks to invoice:', error);
      toast.error('Failed to link tasks to invoice - please check console for details');
    } finally {
      setIsLinkingInvoice(false);
    }
  };

  const hasBulkSelection = selectedTasks.length > 0;

  // Check if project has a Fortnox project number when the invoice dialog opens
  useEffect(() => {
    if (showInvoiceDialog && projectId) {
      checkFortnoxProjectNumber();
    }
  }, [showInvoiceDialog, projectId]);

  // Check if the project has a Fortnox project number
  const checkFortnoxProjectNumber = async () => {
    if (!projectId) return;
    
    try {
      // If it's a numeric project ID, assume it's already a Fortnox number
      if (projectId.match(/^\d+$/)) {
        setHasFortnoxProjectNumber(true);
        return;
      }
      
      // Otherwise, check the database
      const { data: projectData, error } = await supabase
        .from('projects')
        .select('fortnox_project_number')
        .eq('id', projectId)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking Fortnox project number:', error);
        setHasFortnoxProjectNumber(false);
      } else {
        setHasFortnoxProjectNumber(!!projectData?.fortnox_project_number);
      }
    } catch (error) {
      console.error('Error checking Fortnox project number:', error);
      setHasFortnoxProjectNumber(false);
    }
  };

  return (
    <div className="w-full relative">
      {/* Bulk action floating button - Shown when tasks are selected */}
      {hasBulkSelection && (
        <div className="fixed bottom-6 right-6 z-30">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Button
              size="lg"
              onClick={() => setShowInvoiceDialog(true)}
              className="relative rounded-full h-14 px-6 bg-blue-600 hover:bg-blue-700"
            >
              <FileUp className="mr-2 h-5 w-5" />
              Invoice {selectedTasks.length} {selectedTasks.length === 1 ? 'Task' : 'Tasks'}
            </Button>
          </motion.div>
        </div>
      )}

      {isImportingTasks && (
        <div className="fixed inset-0 bg-gray-900/60 dark:bg-black/60 z-50 flex items-center justify-center p-4">
          <BulkTaskImport
            projectId={projectId}
            projectDeadline={projectDeadline}
            onTasksAdded={handleBulkTasksAdded}
            onClose={() => setIsImportingTasks(false)}
          />
        </div>
      )}
      
      <div className="flex gap-6">
        <motion.div layout className="flex-1 space-y-3">
          {/* Bulk selection header */}
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold text-foreground">Task List</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox 
                  id="select-all-tasks"
                  checked={tasks.length > 0 && selectedTasks.length === tasks.length}
                  onCheckedChange={toggleSelectAllTasks}
                  className="h-4 w-4 rounded-sm border-neutral-500"
                />
                <Label htmlFor="select-all-tasks" className="cursor-pointer">
                  {selectedTasks.length === 0 
                    ? 'Select All' 
                    : selectedTasks.length === tasks.length 
                      ? 'Deselect All' 
                      : `${selectedTasks.length} Selected`}
                </Label>
              </div>
            </div>
          </div>

          <AnimatePresence mode="popLayout" initial={false}>
            {showMonthlyGrouping ? (
              // Group tasks by month
              (() => {
                // Group tasks by creation month
                const tasksByMonth = tasks.reduce((groups, task) => {
                  // Use created_at if available, otherwise use current date
                  const taskDate = (task as any).created_at ? new Date((task as any).created_at) : new Date();
                  const monthKey = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, '0')}`;
                  const monthName = taskDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                  
                  if (!groups[monthKey]) {
                    groups[monthKey] = {
                      monthName,
                      tasks: []
                    };
                  }
                  groups[monthKey].tasks.push(task);
                  return groups;
                }, {} as Record<string, { monthName: string; tasks: Task[] }>);

                // Sort months in descending order (newest first)
                const sortedMonths = Object.entries(tasksByMonth).sort(([a], [b]) => b.localeCompare(a));

                return sortedMonths.map(([monthKey, { monthName, tasks: monthTasks }]) => (
                  <div key={monthKey} className="space-y-3">
                    {/* Month Header */}
                    <div className="flex items-center gap-3 py-2 px-3 bg-muted/50 rounded-lg border border-border/50">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium text-foreground">{monthName}</h3>
                      <span className="text-xs text-muted-foreground">({monthTasks.length} tasks)</span>
                    </div>
                    
                    {/* Tasks for this month */}
                    {monthTasks
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
                          className="flex gap-2 items-start ml-6"
                        >
                          {/* Task selection checkbox */}
                          <div className="pt-4">
                            <Checkbox 
                              id={`select-task-${task.id}`}
                              checked={selectedTasks.includes(task.id)}
                              onCheckedChange={() => toggleTaskSelection(task.id)}
                              className="h-4 w-4 rounded-sm border-neutral-500"
                            />
                          </div>
                          <div className="flex-1">
                            <TaskCard
                              task={task}
                              onUpdate={handleTaskUpdate}
                              onDelete={handleDeleteTask}
                              onMoveTask={onMoveTask}
                              onMoveSubtask={onMoveSubtask}
                              projectName={projectName}
                            />
                          </div>
                        </motion.div>
                      ))}
                  </div>
                ));
              })()
            ) : (
              // Regular task list without grouping
              tasks
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
                    className="flex gap-2 items-start"
                  >
                    {/* Task selection checkbox */}
                    <div className="pt-4">
                      <Checkbox 
                        id={`select-task-${task.id}`}
                        checked={selectedTasks.includes(task.id)}
                        onCheckedChange={() => toggleTaskSelection(task.id)}
                        className="h-4 w-4 rounded-sm border-neutral-500"
                      />
                    </div>
                    <div className="flex-1">
                      <TaskCard
                        task={task}
                        onUpdate={handleTaskUpdate}
                        onDelete={handleDeleteTask}
                        onMoveTask={onMoveTask}
                        onMoveSubtask={onMoveSubtask}
                        projectName={projectName}
                      />
                    </div>
                  </motion.div>
                ))
            )}
          </AnimatePresence>

          {/* Add Task Form */}
          <AnimatePresence mode="wait">
            {isAddingTask ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="p-4 bg-background border-border relative overflow-hidden">
                  <div className="space-y-4 relative z-10">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Task title"
                      className="w-full px-4 py-2 bg-background border border-border dark:border-border rounded-md text-foreground placeholder:text-foreground0 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsAddingTask(false)}
                        className="text-muted-foreground hover:text-foreground border-border dark:border-border hover:bg-background"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddTask}
                        className="bg-gray-200 dark:bg-muted hover:bg-gray-300 dark:hover:bg-neutral-600 text-foreground"
                      >
                        Add Task
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : (
              <div className="flex gap-2">
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setIsAddingTask(true)}
                className="flex-1 p-4 rounded-lg bg-background border border-border hover:border-border dark:border-border transition-all duration-200 text-muted-foreground hover:text-foreground dark:text-neutral-300 flex items-center justify-center gap-2 relative overflow-hidden"
              >
                <div className="relative z-10 flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Task
                </div>
              </motion.button>
                
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setIsImportingTasks(true)}
                  className="p-4 rounded-lg bg-background border border-border hover:border-border dark:border-border transition-all duration-200 text-muted-foreground hover:text-foreground dark:text-neutral-300 flex items-center justify-center gap-2 relative overflow-hidden"
                >
                  <div className="relative z-10 flex items-center justify-center gap-2">
                    <FileText className="h-4 w-4" />
                    Bulk Import
                  </div>
                </motion.button>
              </div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          layout
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-80 flex flex-col p-4 rounded-lg bg-background border border-border sticky top-4 h-fit overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium text-foreground">
                Progress
              </h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completed</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {tasks.reduce((count, task) => count + task.checklist.filter(item => item.done).length, 0)} / {tasks.reduce((count, task) => count + task.checklist.length, 0)}
                  </span>
                  <span className="text-foreground0">
                    ({Math.round((tasks.reduce((count, task) => count + task.checklist.filter(item => item.done).length, 0) / Math.max(1, tasks.reduce((count, task) => count + task.checklist.length, 0))) * 100)}%)
                  </span>
                </div>
              </div>

              <div className="h-2 bg-background rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-green-600"
                  initial={{ width: 0 }}
                  animate={{ 
                    width: `${Math.round((tasks.reduce((count, task) => count + task.checklist.filter(item => item.done).length, 0) / Math.max(1, tasks.reduce((count, task) => count + task.checklist.length, 0))) * 100)}%` 
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Deadline: {new Date(projectDeadline).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Invoice Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="bg-background border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Create Invoice for Selected Tasks</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedTasks.length} tasks selected for invoicing
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 my-4">
            {/* Display selected tasks */}
            {selectedTasks.length > 0 && (
              <div className="mb-4 space-y-2">
                <Label className="text-sm font-medium">Selected Tasks</Label>
                <div className="max-h-32 overflow-y-auto rounded-md bg-background p-2 border border-border dark:border-border">
                  {tasks
                    .filter(task => selectedTasks.includes(task.id))
                    .map(task => (
                      <div 
                        key={task.id} 
                        className="flex items-center py-1.5 px-2 text-sm text-foreground dark:text-neutral-300 rounded-sm hover:bg-gray-200 dark:bg-muted"
                      >
                        <Check className="h-3.5 w-3.5 mr-2 text-green-600 dark:text-green-400" />
                        {task.title}
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Invoice Description</Label>
              <Textarea
                value={invoiceDescription}
                onChange={(e) => setInvoiceDescription(e.target.value)}
                placeholder="Services for project..."
                className="bg-background border-border dark:border-border"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price (SEK)</Label>
              <Input
                type="number"
                value={invoicePrice}
                onChange={(e) => setInvoicePrice(Number(e.target.value))}
                className="bg-background border-border dark:border-border"
              />
              </div>
              
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  defaultValue={1}
                  onChange={(e) => setInvoiceQuantity(Number(e.target.value))}
                  className="bg-background border-border dark:border-border"
                  min={1}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  defaultValue="h"
                  onValueChange={setInvoiceUnit}
                >
                  <SelectTrigger className="bg-background border-border dark:border-border">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border dark:border-border">
                    <SelectItem value="h">Hours (h)</SelectItem>
                    <SelectItem value="st">Pieces (st)</SelectItem>
                    <SelectItem value="tim">Hours (tim)</SelectItem>
                    <SelectItem value="mån">Months (mån)</SelectItem>
                    <SelectItem value="dag">Days (dag)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>VAT (%)</Label>
                <Select
                  defaultValue="25"
                  onValueChange={(value) => setInvoiceVat(Number(value))}
                >
                  <SelectTrigger className="bg-background border-border dark:border-border">
                    <SelectValue placeholder="Select VAT rate" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border dark:border-border">
                    <SelectItem value="25">25%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="6">6%</SelectItem>
                    <SelectItem value="0">0%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Account Number (Optional)</Label>
              <Input
                type="text"
                placeholder="e.g. 3011"
                onChange={(e) => setInvoiceAccountNumber(e.target.value)}
                className="bg-background border-border dark:border-border"
              />
              <p className="text-xs text-foreground0">
                Leave empty to use Fortnox default account
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Invoice Type</Label>
              <Select
                value={invoiceType}
                onValueChange={setInvoiceType}
              >
                <SelectTrigger className="bg-background border-border dark:border-border">
                  <SelectValue placeholder="Select invoice type" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border dark:border-border">
                  <SelectItem value="INVOICE">Send Invoice</SelectItem>
                  <SelectItem value="OFFER">Create Draft (Offer)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-foreground0">
                {invoiceType === "OFFER" ? 
                  "Creates a draft invoice (offer) - won't be sent to customer" : 
                  "Creates a normal invoice that will be processed"
                }
              </p>
            </div>
            
            {/* Info box for projects without Fortnox number */}
            {hasFortnoxProjectNumber === false && (
              <div className="rounded-md bg-blue-100 dark:bg-blue-950 p-3 border border-blue-800 text-sm">
                <div className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-blue-300">
                    <p className="font-medium mb-1">No Fortnox project number found</p>
                    <p>An invoice will be created without being linked to a Fortnox project. The invoice will still include all selected task details.</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Invoice Preview */}
            <div className="rounded-md bg-background p-3 border border-border dark:border-border text-sm mt-4">
              <h3 className="font-medium text-foreground mb-2">Invoice Preview</h3>
              <div className="space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Description:</span>
                  <span className="text-foreground">{invoiceDescription || `Services for project ${projectName}`}</span>
                </div>
                <div className="flex justify-between">
                  <span>Quantity:</span>
                  <span className="text-foreground">{invoiceQuantity} {invoiceUnit}</span>
                </div>
                <div className="flex justify-between">
                  <span>Price:</span>
                  <span className="text-foreground">{invoicePrice.toLocaleString()} SEK</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT:</span>
                  <span className="text-foreground">{invoiceVat}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="text-foreground">{(invoicePrice * invoiceQuantity).toLocaleString()} SEK</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount incl. VAT:</span>
                  <span className="text-foreground">
                    {(invoicePrice * invoiceQuantity * (1 + invoiceVat/100)).toLocaleString()} SEK
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="text-foreground">{invoiceType === "OFFER" ? "Draft (Offer)" : "Invoice"}</span>
                </div>
                {invoiceAccountNumber && (
                  <div className="flex justify-between">
                    <span>Account:</span>
                    <span className="text-foreground">{invoiceAccountNumber}</span>
                  </div>
                )}
              </div>
            </div>
            
            {existingInvoices.length > 0 && (
              <div className="space-y-2 mt-6">
                <div className="text-sm font-medium mb-1">Or link to existing invoice:</div>
                <Select
                  value={selectedInvoice}
                  onValueChange={setSelectedInvoice}
                >
                  <SelectTrigger className="bg-background border-border dark:border-border">
                    <SelectValue placeholder="Select an invoice" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border dark:border-border">
                    {existingInvoices.map(invoice => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  className="w-full mt-2"
                  onClick={handleLinkToExistingInvoice}
                  disabled={isLinkingInvoice || !selectedInvoice}
                >
                  {isLinkingInvoice ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Linking...
                    </>
                  ) : (
                    <>
                      <Link className="mr-2 h-4 w-4" />
                      Link to Selected Invoice
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInvoiceDialog(false)}
              className="border-border dark:border-border"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateInvoice}
              disabled={isCreatingInvoice}
            >
              {isCreatingInvoice ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Create Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 