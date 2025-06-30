"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-client';

// Define the Session user type with expected properties
interface SessionUser {
  id?: string;
  name?: string;
  email?: string;
  image?: string;
}

// Define Session type for Supabase authentication
interface Session {
  user: SessionUser;
  access_token: string;
  refresh_token: string;
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
  const { user, session } = useAuth();
  const [customers, setCustomers] = useState<EnhancedCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!user?.id || !session) {
      console.log('[useCustomers] Missing user or session:', { 
        hasUser: !!user?.id, 
        hasSession: !!session,
        sessionKeys: session ? Object.keys(session) : []
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[useCustomers] Fetching customers via API...', {
        userId: user.id,
        userEmail: user.email,
        sessionKeys: Object.keys(session)
      });
      
      // Use API endpoint with NextAuth session - no authorization header needed
      // The withAuth wrapper will handle authentication on the server side
      const response = await fetch('/api/customers', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for NextAuth session
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      const customersData = data.customers || [];
      
      console.log('[useCustomers] Received customers:', customersData.length);

      // Process customers data to add computed fields
      const processedCustomers = customersData.map((customer: any) => {
        const customerInvoices = customer.invoices || [];
        const total = customerInvoices.reduce((sum: number, invoice: any) => sum + (parseFloat(invoice.total) || 0), 0);
        const lastInvoice = customerInvoices.sort((a: any, b: any) => 
          new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
        )[0];

        const formattedInvoices = customerInvoices.map((invoice: any) => {
          let status: 'paid' | 'unpaid' | 'partial' | 'overdue' = 'paid';
          const balance = parseFloat(invoice.balance) || 0;
          const dueDate = new Date(invoice.due_date);
          const today = new Date();
          
          if (balance > 0) {
            if (dueDate < today) status = 'overdue';
            else if (balance < parseFloat(invoice.total)) status = 'partial';
            else status = 'unpaid';
          }
          
          return { ...invoice, status };
        });

        const sortedInvoices = formattedInvoices.sort((a: any, b: any) => 
          new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
        );

        return {
          ...customer,
          total,
          invoice_count: customerInvoices.length,
          last_invoice_date: lastInvoice?.invoice_date || '',
          invoices: sortedInvoices,
          linked_projects: customer.projects || [],
          completed_tasks: [], // Task logic can be added here if needed
        };
      });

      setCustomers(processedCustomers);

    } catch (err) {
      console.error('[useCustomers] Customer fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch customers'));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, session]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Refetch function to allow manual refresh
  const refetch = () => {
    fetchCustomers();
  };

  return { customers, isLoading, error, refetch };
} 