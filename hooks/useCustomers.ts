"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useSession } from 'next-auth/react';

interface Customer {
  id: string;
  customer_number: string;
  name: string;
  total: number;
  invoice_count: number;
  last_invoice_date: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export function useCustomers() {
  const { data: session } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchCustomers() {
      if (!session?.user?.id) {
        console.log('No session found, skipping customer fetch');
        setIsLoading(false);
        return;
      }

      try {
        console.log('Session:', {
          user: session.user,
          accessToken: session.accessToken,
          hasRefreshToken: !!session.accessToken
        });
        
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: {
              persistSession: false
            }
          }
        );

        // First get user's workspaces
        const { data: teamMemberships, error: teamError } = await supabaseAdmin
          .from('team_members')
          .select(`
            workspace_id,
            workspaces (
              id,
              name
            )
          `)
          .eq('user_id', session.user.id);

        if (teamError) {
          console.error('Error fetching team memberships:', teamError);
          throw new Error('Failed to load workspace access');
        }

        if (!teamMemberships?.length) {
          console.log('No workspaces found for user');
          setCustomers([]);
          setIsLoading(false);
          return;
        }

        const workspaceIds = teamMemberships.map(tm => tm.workspace_id);
        console.log('Found workspaces:', workspaceIds);

        // Fetch customers for these workspaces
        const { data: customersData, error: customersError } = await supabaseAdmin
          .from('customers')
          .select('*')
          .in('workspace_id', workspaceIds);

        if (customersError) {
          console.error('Error fetching customers:', customersError);
          throw customersError;
        }

        console.log('Fetched customers:', customersData?.length || 0);

        // Fetch invoices to calculate totals
        const { data: invoicesData, error: invoicesError } = await supabaseAdmin
          .from('invoices')
          .select('*')
          .in('workspace_id', workspaceIds);

        if (invoicesError) {
          console.error('Error fetching invoices:', invoicesError);
          throw invoicesError;
        }

        console.log('Fetched invoices:', invoicesData?.length || 0);

        // Process customers and their invoices
        const processedCustomers = (customersData || []).map(customer => {
          const customerInvoices = (invoicesData || []).filter(invoice => invoice.customer_id === customer.id);
          const total = customerInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
          const lastInvoice = customerInvoices.sort((a, b) => 
            new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
          )[0];

          return {
            ...customer,
            total,
            invoice_count: customerInvoices.length,
            last_invoice_date: lastInvoice ? lastInvoice.invoice_date : customer.created_at,
          };
        });

        setCustomers(processedCustomers);
      } catch (err) {
        console.error('Customer fetch error:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch customers'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchCustomers();
  }, [session?.user?.id]);

  return { customers, isLoading, error };
} 