"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from 'next-auth/react';

// Define the Session user type with expected properties
interface SessionUser {
  id?: string;
  name?: string;
  email?: string;
  image?: string;
}

// Extend the Session type to have our custom user property
declare module "next-auth" {
  interface Session {
    user: SessionUser;
    access_token: string;
    refresh_token: string;
  }
}

// Define Customer type locally to avoid import error
interface Customer {
  id: string;
  customer_number?: string;
  name: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
}

// Add task interface
interface ProjectTask {
  id: string;
  title: string;
  project_id: string;
  project_name?: string;
  progress: number;
  updated_at?: string;
  created_at: string;
  checklist?: Array<{id: number; text: string; done: boolean}>;
}

// Add completed task interface
interface CompletedTask {
  id: string;
  title: string;
  project_name: string;
  completed_at: string;
  checklist: Array<{id: number; text: string; done: boolean}>;
}

export interface EnhancedCustomer extends Customer {
  total: number;
  invoice_count: number;
  last_invoice_date: string;
  completed_tasks: CompletedTask[];
  linked_projects: Array<{
    id: string;
    name: string;
    status: string;
    task_count: number;
    progress: number;
  }>;
  invoices: Array<{
    id: string;
    document_number: string;
    invoice_date: string;
    due_date: string;
    total: number;
    balance: number;
    status: 'paid' | 'unpaid' | 'partial' | 'overdue';
  }>;
}

/**
 * Hook to fetch and manage customers
 * @returns Object containing customers, loading state, and any error
 */
export function useCustomers() {
  const { data: session } = useSession();
  const [customers, setCustomers] = useState<EnhancedCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const fetchCustomers = async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[Customers] Fetching customers for user ID:', session.user.id, 'Email:', session.user.email);
      
      // Use the same API endpoint as other components for consistency
      const response = await fetch('/api/workspace/leave');
      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }
      const data = await response.json();
            
      if (!data.success || !data.workspaces || data.workspaces.length === 0) {
        console.log('[Customers] No workspaces found for user');
          setCustomers([]);
        setIsLoading(false);
        return;
      }

      console.log('[Customers] Found workspaces:', data.workspaces);
      
      // Get workspace IDs
      const workspaceIds = data.workspaces.map((w: any) => w.id);
      console.log('[Customers] Workspace IDs:', workspaceIds);
      
      await fetchCustomersForWorkspaces(workspaceIds);
    } catch (err) {
      console.error('[Customers] Customer fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch customers'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, [session?.user?.id, session?.user?.email]);

  // Helper function to fetch customers for a set of workspace IDs
  async function fetchCustomersForWorkspaces(workspaceIds: string[]) {
    try {
      if (!workspaceIds || workspaceIds.length === 0) {
        console.log('[Customers] No workspace IDs provided');
        setCustomers([]);
        return;
      }

      // Fetch customers directly using the regular supabase client
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .in('workspace_id', workspaceIds);

      if (customersError) {
        console.error('[Customers] Error fetching customers:', customersError);
        throw customersError;
      }

      console.log('[Customers] Fetched customers:', customersData?.length || 0);

      // Fetch invoices to calculate totals
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .in('workspace_id', workspaceIds);

      if (invoicesError) {
        console.error('[Customers] Error fetching invoices:', invoicesError);
        throw invoicesError;
      }

      console.log('[Customers] Fetched invoices:', invoicesData?.length || 0);

      // Fetch all projects in these workspaces to link customers to projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .in('workspace_id', workspaceIds);

      if (projectsError) {
        console.error('[Customers] Error fetching projects:', projectsError);
        throw projectsError;
      }

      console.log('[Customers] Fetched projects:', projectsData?.length || 0);

      // Fetch all completed tasks from these projects
      const projectIds = projectsData?.map(project => project.id) || [];
      
      const { data: tasksData, error: tasksError } = await supabase
        .from('project_tasks')
        .select('*')
        .in('project_id', projectIds)
        .eq('progress', 100); // Only get completed tasks (progress = 100%)

      if (tasksError) {
        console.error('[Customers] Error fetching completed tasks:', tasksError);
        throw tasksError;
      }

      console.log('[Customers] Fetched completed tasks:', tasksData?.length || 0);

      // Process customers and their invoices and tasks
      const processedCustomers = (customersData || []).map(customer => {
        // Get invoices for this customer
        const customerInvoices = (invoicesData || []).filter(invoice => invoice.customer_id === customer.id);
        const total = customerInvoices.reduce((sum, invoice) => sum + (parseFloat(invoice.total) || 0), 0);
        const lastInvoice = customerInvoices.sort((a, b) => 
          new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
        )[0];

        // Format invoices with status
        const formattedInvoices = customerInvoices.map(invoice => {
          // Determine invoice status
          let status: 'paid' | 'unpaid' | 'partial' | 'overdue' = 'paid';
          const balance = parseFloat(invoice.balance) || 0;
          const dueDate = new Date(invoice.due_date);
          const today = new Date();
          
          if (balance > 0) {
            if (dueDate < today) {
              status = 'overdue';
            } else if (balance < parseFloat(invoice.total)) {
              status = 'partial';
            } else {
              status = 'unpaid';
            }
          }
          
          return {
            id: invoice.id,
            document_number: invoice.document_number,
            invoice_date: invoice.invoice_date,
            due_date: invoice.due_date,
            total: parseFloat(invoice.total) || 0,
            balance: parseFloat(invoice.balance) || 0,
            status
          };
        });
        
        // Sort invoices by date (most recent first)
        const sortedInvoices = formattedInvoices.sort((a, b) => 
          new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
        );

        // Get projects associated with this customer
        const customerProjects = (projectsData || []).filter(project => 
          project.customer_name === customer.name || project.customer_id === customer.id
        );
        
        // Get completed tasks for this customer's projects
        const customerTasks: CompletedTask[] = [];

        for (const project of customerProjects) {
          const projectTasks = (tasksData || [])
            .filter(task => task.project_id === project.id)
            .map(task => ({
              id: task.id,
              title: task.title,
              project_name: project.name,
              completed_at: task.updated_at || task.created_at,
              checklist: task.checklist || []
            }));
          
          customerTasks.push(...projectTasks);
        }

        // Sort tasks by completion date (newest first)
        const sortedTasks = customerTasks.sort((a, b) => 
          new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
        );

        // Format project information
        const linkedProjects = customerProjects.map(project => {
          // Calculate project progress
          const projectTasks = (tasksData || []).filter(task => task.project_id === project.id);
          let progress = 0;
          
          if (projectTasks.length > 0) {
            const totalProgress = projectTasks.reduce((sum, task) => sum + (task.progress || 0), 0);
            progress = Math.round(totalProgress / projectTasks.length);
          }
          
          return {
            id: project.id,
            name: project.name,
            status: project.status || 'active',
            task_count: projectTasks.length,
            progress
          };
        });

        return {
          ...customer,
          total,
          invoice_count: customerInvoices.length,
          last_invoice_date: lastInvoice ? lastInvoice.invoice_date : customer.created_at,
          completed_tasks: sortedTasks,
          linked_projects: linkedProjects,
          invoices: sortedInvoices
        };
      });

      setCustomers(processedCustomers);
    } catch (err) {
      console.error('[Customers] Customer fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch customers'));
    }
  }

  // Include a refetch function that can be called to refresh the data
  const refetch = () => {
    fetchCustomers();
  };

  return { customers, isLoading, error, permissionDenied, refetch };
} 