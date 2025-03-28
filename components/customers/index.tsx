"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCustomers } from "@/hooks/useCustomers";
import { Upload, Search, Save, RefreshCw } from "lucide-react";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

interface CustomersViewProps {
  className?: string;
}

interface Customer {
  id: string;
  customer_number: string;
  name: string;
  email?: string;
  phone?: string;
  birthday?: string;
  address?: string;
  total: number;
  invoice_count: number;
  last_invoice_date: string;
  workspace_id: string;
  user_id: string;
}

interface FortnoxCustomer {
  CustomerNumber: string;
  Name: string;
}

export function CustomersView({ className }: CustomersViewProps) {
  const { data: session } = useSession();
  const { customers, isLoading, error } = useCustomers();
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveAll = async () => {
    if (!session?.user?.id) {
      toast.error('Please sign in to save customers');
      return;
    }

    setIsSaving(true);
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

      // Get user's default workspace
      const { data: workspace, error: workspaceError } = await supabaseAdmin
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .single();

      if (workspaceError) {
        console.error('Error fetching workspace:', workspaceError);
        toast.error('Failed to save customers: No workspace found');
        return;
      }

      const customersToSave = customers.map(customer => ({
        ...customer,
        workspace_id: workspace.workspace_id,
        user_id: session.user.id
      }));

      const { error } = await supabaseAdmin
        .from('customers')
        .upsert(customersToSave, {
          onConflict: 'customer_number,workspace_id'
        });

      if (error) throw error;
      
      toast.success(`Successfully saved ${customers.length} customers`);
    } catch (error) {
      console.error('Error saving customers:', error);
      toast.error('Failed to save customers');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!session?.user?.id) {
      toast.error('Please sign in to import customers');
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['text/csv', 'application/vnd.ms-excel'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a CSV file');
      return;
    }

    if (file.size > maxSize) {
      toast.error('File size should be less than 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

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

      // Get user's default workspace
      const { data: workspace, error: workspaceError } = await supabaseAdmin
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .single();

      if (workspaceError) {
        toast.error('No workspace found. Please create a workspace first.');
        return;
      }

      // Add workspace information to the form data
      formData.append('workspace_id', workspace.workspace_id);
      formData.append('user_id', session.user.id);

      const response = await fetch('/api/customers/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to import customers');
      toast.success('Customers imported successfully');
      window.location.reload();
    } catch (error) {
      console.error('Error importing customers:', error);
      toast.error('Failed to import customers');
    }
  };

  const checkForNewData = async () => {
    if (!session?.user?.id) {
      toast.error('Please sign in to check for new customers');
      return;
    }

    setIsRefreshing(true);
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

      // Get user's workspace
      const { data: workspace, error: workspaceError } = await supabaseAdmin
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .single();

      if (workspaceError) {
        toast.error('No workspace found. Please create a workspace first.');
        return;
      }

      // Fetch current data from Fortnox
      const response = await fetch('/api/fortnox/customers', {
        headers: {
          'workspace-id': workspace.workspace_id,
          'user-id': session.user.id
        }
      });

      if (!response.ok) throw new Error('Failed to fetch Fortnox customers');
      const fortnoxData = await response.json();
      const fortnoxCustomers = (fortnoxData.Customers || []) as FortnoxCustomer[];

      // Get current customers for this workspace
      const { data: currentCustomers, error: customersError } = await supabaseAdmin
        .from('customers')
        .select('name, customer_number')
        .eq('workspace_id', workspace.workspace_id);

      if (customersError) throw new Error('Failed to fetch current customers');

      // Compare customer names
      const currentCustomerNames = new Set(currentCustomers?.map(cust => cust.name) || []);
      const newCustomers = fortnoxCustomers.filter(cust => !currentCustomerNames.has(cust.Name));

      if (newCustomers.length > 0) {
        // Show confirmation dialog
        const shouldUpdate = window.confirm(
          `Found ${newCustomers.length} new customer${newCustomers.length === 1 ? '' : 's'}. Would you like to save ${newCustomers.length === 1 ? 'it' : 'them'}?`
        );

        if (shouldUpdate) {
          const customersToSave = newCustomers.map(customer => ({
            name: customer.Name,
            customer_number: customer.CustomerNumber,
            workspace_id: workspace.workspace_id,
            user_id: session.user.id
          }));

          const { error: saveError } = await supabaseAdmin
            .from('customers')
            .upsert(customersToSave, {
              onConflict: 'customer_number,workspace_id'
            });

          if (saveError) throw saveError;

          toast.success(`Successfully saved ${newCustomers.length} new customer${newCustomers.length === 1 ? '' : 's'}`);
          window.location.reload();
        }
      } else {
        toast.info('No new customers found');
      }
    } catch (error) {
      console.error('Error checking for new data:', error);
      toast.error('Failed to check for new customers');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-neutral-900 text-neutral-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-neutral-900 text-neutral-400">
        <p>Failed to load customers. Please try again later.</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-neutral-900 text-neutral-400">
        <p>Please sign in to view customers.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Customers</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
            />
          </div>
          <button
            onClick={checkForNewData}
            disabled={isRefreshing || isLoading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-sm text-white transition-colors",
              (isRefreshing || isLoading) && "opacity-50 cursor-not-allowed"
            )}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? "Checking..." : "Check New"}
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isSaving || isLoading || customers.length === 0}
            className={cn(
              "flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-sm text-white transition-colors",
              (isSaving || isLoading || customers.length === 0) && "opacity-50 cursor-not-allowed"
            )}
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save All"}
          </button>
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-sm text-white cursor-pointer transition-colors"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </label>
          </div>
        </div>
      </div>

      <Card className="bg-neutral-800 border-neutral-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-700">
                <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Customer Name</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Customer Number</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Total Revenue</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Invoices</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Last Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-700">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-neutral-400">
                    {search ? "No customers found matching your search." : "No customers found. Import customers to get started."}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-neutral-750 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/customers/${customer.id}`}
                  >
                    <td className="py-4 px-6 text-sm text-white">{customer.name}</td>
                    <td className="py-4 px-6 text-sm text-white">{customer.customer_number}</td>
                    <td className="py-4 px-6 text-sm text-white">
                      {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                        .format(customer.total)}
                    </td>
                    <td className="py-4 px-6 text-sm text-white">{customer.invoice_count}</td>
                    <td className="py-4 px-6 text-sm text-neutral-400">
                      {new Date(customer.last_invoice_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-sm text-neutral-400">
        CSV Import Requirements:
        <ul className="list-disc ml-5 mt-2">
          <li>File format: CSV</li>
          <li>Maximum file size: 5MB</li>
          <li>Required columns: name, customer_number</li>
          <li>Optional columns: email, phone, birthday (YYYY-MM-DD), address</li>
          <li>First row should be column headers</li>
          <li>Text should be UTF-8 encoded</li>
        </ul>
      </div>
    </div>
  );
} 