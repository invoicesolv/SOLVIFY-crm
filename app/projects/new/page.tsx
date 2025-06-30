"use client";

import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from '@/lib/auth-client';
import { getActiveWorkspaceId } from "@/lib/permission";

interface Customer {
  id: string;
  name: string;
}

interface ProjectData {
  name: string;
  customer_name: string;
  status: 'active' | 'on-hold' | 'completed';
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  user_id: string;
  workspace_id: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user, session } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();

  useEffect(() => {
    if (session?.user?.id) {
      fetchWorkspaceId();
    }
  }, [session?.user?.id]);

  // Fetch customers when user session and workspace are available
  useEffect(() => {
    if (session?.user?.id && workspaceId) {
      fetchCustomers();
    }
  }, [session?.user?.id, workspaceId]);

  const fetchWorkspaceId = async () => {
    if (!session?.user?.id) return;
    
    try {
      const wsId = await getActiveWorkspaceId(session.user.id);
      console.log('Active workspace ID:', wsId);
      setWorkspaceId(wsId);
    } catch (error) {
      console.error('Error fetching workspace ID:', error);
      setError('Failed to fetch workspace ID');
    }
  };

  const fetchCustomers = async () => {
    if (!session?.user?.id || !workspaceId) {
      console.log('Cannot fetch customers: missing session or workspace');
      return;
    }

    try {
      console.log('Fetching customers for workspace:', workspaceId);
      
      // Use the API endpoint to fetch workspace-filtered customers
      const response = await fetch('/api/customers', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'user-id': session.user.id,
          'workspace-id': workspaceId
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error fetching customers:', errorData);
        setError('Failed to fetch customers');
        return;
      }

      const data = await response.json();
      const allCustomers = data.customers || [];

      console.log(`Fetched ${allCustomers.length} workspace customers`);
      
      // Filter out customers with empty names and provide fallbacks for the rest
      const customersWithNames = allCustomers
        .filter((customer: any) => customer.name && customer.name.trim() !== '')
        .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

      console.log(`Filtered to ${customersWithNames.length} customers with valid names`);
      
      setCustomers(customersWithNames);
    } catch (error) {
      console.error('Error in fetchCustomers:', error);
      setError('Failed to fetch customers');
    }
  };

  const fixCustomerWorkspaces = async () => {
    if (!session?.user?.id) {
      toast.error('Please sign in to fix customer data');
      return;
    }

    try {
      toast.info('Fixing customer data issues...');
      
      const response = await fetch('/api/customers/fix-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message || 'Customer data fixed successfully');
        // Refresh customers after fixing
        if (result.fixed_count > 0) {
          await fetchCustomers();
        }
      } else {
        toast.error(result.error || 'Failed to fix customer data');
      }
    } catch (error) {
      console.error('Error fixing customer data:', error);
      toast.error('Failed to fix customer data');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    if (!session?.user?.id) {
      toast.error('Please sign in to create a project');
      setLoading(false);
      return;
    }

    if (!workspaceId) {
      toast.error('No active workspace found. Please ensure you belong to a workspace.');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData(e.currentTarget);
      const customerId = formData.get('customer_id') as string;
      const selectedCustomer = customers.find(c => c.id === customerId);

      const projectData: ProjectData = {
        name: formData.get('name') as string,
        customer_name: selectedCustomer?.name || '',
        status: (formData.get('status') as 'active' | 'on-hold' | 'completed') || 'active',
        start_date: startDate ? startDate.toISOString().split('T')[0] : null,
        end_date: endDate ? endDate.toISOString().split('T')[0] : null,
        description: formData.get('description') as string || null,
        user_id: session.user.id,
        workspace_id: workspaceId
      };

      console.log('Creating project via API:', {
        name: projectData.name,
        workspace_id: workspaceId,
        customer: selectedCustomer?.name
      });
      
      // Use the API endpoint instead of direct database access
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(projectData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error creating project:', errorData);
        setError(errorData.error || 'Failed to create project');
        setLoading(false);
        return;
      }

      const result = await response.json();
      const data = result.project;
      
      console.log('Project created successfully:', data.id);
      
      // Create a calendar event for this project
      if (data.id && (data.start_date || data.end_date)) {
        try {
          const calendarEvent = {
            title: `Project: ${data.name}`,
            start_time: data.start_date,
            end_time: data.end_date || data.start_date, // Use start date as fallback if no end date
            user_id: session.user.id,
            project_id: data.id,
            is_synced: true
          };
          
          const { error: calendarError } = await supabase
            .from('calendar_events')
            .insert([calendarEvent]);
            
          if (calendarError) {
            console.error('Error creating calendar event for project:', calendarError);
            // Don't block project creation if calendar sync fails
          } else {
            console.log('Calendar event created for project:', data.id);
          }
        } catch (calendarErr) {
          console.error('Exception creating calendar event:', calendarErr);
        }
      }
            
      toast.success('Project created successfully');
      router.push('/projects');
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      toast.error(`Failed to create project: ${error.message || 'Please try again'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/projects"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>
        </div>

        <Card className="bg-background border-border dark:border-border p-6">
          <h1 className="text-2xl font-semibold text-foreground mb-6">New Project</h1>
          {error && (
            <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 text-red-200 rounded-md">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium text-muted-foreground">
                  Project Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full px-4 py-2 bg-background border border-border dark:border-border rounded-md text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="customer_id" className="block text-sm font-medium text-muted-foreground">
                  Customer (Optional)
                </label>
                <div className="space-y-2">
                  <select
                    id="customer_id"
                    name="customer_id"
                    className="w-full px-4 py-2 bg-background border border-border dark:border-border rounded-md text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                  >
                    <option value="">Select a customer (optional)</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                  {customers.length === 0 && (
                    <button
                      type="button"
                      onClick={fixCustomerWorkspaces}
                      className="text-sm text-blue-600 hover:text-blue-400 underline"
                    >
                      Fix customer workspace assignments
                    </button>
                  )}
                  {customers.length > 0 && customers.some(c => !c.name || c.name.trim() === '') && (
                    <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                      <p className="text-sm text-yellow-400 mb-2">⚠️ Some customers have empty names</p>
                      <button
                        type="button"
                        onClick={fixCustomerWorkspaces}
                        className="text-sm text-blue-600 hover:text-blue-400 underline"
                      >
                        Fix customer data issues
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="status" className="block text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  required
                  defaultValue="active"
                  className="w-full px-4 py-2 bg-background border border-border dark:border-border rounded-md text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                >
                  <option value="active">Active</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="start_date" className="block text-sm font-medium text-muted-foreground">
                  Start Date
                </label>
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Select start date"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="end_date" className="block text-sm font-medium text-muted-foreground">
                  End Date
                </label>
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="Select end date (optional)"
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="block text-sm font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                className="w-full px-4 py-2 bg-background border border-border dark:border-border rounded-md text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !workspaceId}
                className="px-4 py-2 bg-gray-200 dark:bg-muted hover:bg-gray-300 dark:hover:bg-neutral-600 disabled:bg-muted dark:disabled:bg-neutral-800 disabled:cursor-not-allowed border border-gray-400 dark:border-border rounded-md text-sm text-foreground transition-colors"
              >
                {loading ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </SidebarDemo>
  );
} 