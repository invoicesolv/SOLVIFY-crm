"use client";

import { Card } from "@/components/ui/card";
import { AnimatedBorderCard } from "@/components/ui/animated-border-card";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { cn } from "@/lib/utils";
import { useCustomers, EnhancedCustomer } from "@/hooks/useCustomers";
import { Upload, Search, Save, RefreshCw, CheckSquare, Loader2, AlertOctagon, ChevronRight, ListTodo, Folder, BarChart3, ArrowUpRight, Users, PlusCircle, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useAuth } from '@/lib/auth-client';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { CreateCustomerDialog } from "./CreateCustomerDialog";

interface CustomersViewProps {
  className?: string;
}

// Define the Fortnox customer interface
interface FortnoxCustomer {
  CustomerNumber: string;
  Name: string;
  Email: string;
}

// Define task and checklist item interfaces
interface CompletedTask {
  id: string;
  title: string;
  project_name: string;
  completed_at: string;
  checklist: Array<ChecklistItem>;
}

interface ChecklistItem {
  id: number;
  text: string;
  done: boolean;
}

// Fix the interface to handle optional values correctly
interface ExtendedCustomer {
  id: string;
  customer_number?: string;
  name: string;
  email?: string;
  phone?: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
  total?: number;
  invoice_count?: number;
  last_invoice_date?: string;
  invoices?: any[];
  total_revenue?: number;
  task_count?: number;
  project_count?: number;
  completed_tasks?: any[];
  linked_projects?: any[];
}

export function CustomersView({ className }: CustomersViewProps) {
  const { user, session } = useAuth();
  // Use any type to avoid type checking issues
  const { customers, isLoading, error, refetch }: { customers: any[], isLoading: boolean, error: any, refetch: () => void } = useCustomers() as any;
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<ExtendedCustomer | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("invoices");
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<ExtendedCustomer | null>(null);
  const [isSyncingEmails, setIsSyncingEmails] = useState(false);

  // Debug useEffect for selectedCustomer and invoices
  useEffect(() => {
    if (selectedCustomer) {
      console.log('[Debug] Selected customer in useEffect:', selectedCustomer);
      console.log('[Debug] Customer invoices in useEffect:', selectedCustomer.invoices);
    }
  }, [selectedCustomer]);

  // Debug output for user ID
  useEffect(() => {
    if (user) {
      console.log('[Debug] Customers view rendered for user:', {
        id: user.id,
        email: user.email 
      });
    }
  }, [user]);

  const filteredCustomers = Array.isArray(customers) ? customers.filter((customer: ExtendedCustomer) => 
    customer && customer.name && customer.name.toLowerCase().includes(search.toLowerCase())
  ) : [];

  const handleSaveAll = async () => {
    if (!user?.id) {
      toast.error('Please sign in to save customers');
      return;
    }

    setIsSaving(true);
    try {
      console.log('Session details:', {
        user: user,
        accessToken: session?.access_token,
        hasRefreshToken: !!session?.access_token
      });

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            persistSession: false
          }
        }
      );

      if (!session?.access_token) {
        toast.error('Authentication session required');
        return;
      }

      // Get user's default workspace
      const { data: workspace, error: workspaceError } = await supabaseAdmin
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single();

      if (workspaceError) {
        console.error('Error fetching workspace:', workspaceError);
        toast.error('Failed to save customers: No workspace found');
        return;
      }

      const customersToSave = Array.isArray(customers) ? customers.map(customer => ({
        ...customer,
        workspace_id: workspace.workspace_id,
        user_id: user.id
      })) : [];

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
    if (!user?.id) {
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
      if (!session?.access_token) {
        toast.error('Authentication session required');
        return;
      }

      console.log('Session details:', {
        user: user,
        accessToken: session.access_token,
        hasRefreshToken: !!session.access_token
      });

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
        .eq('user_id', user.id)
        .single();

      if (workspaceError) {
        toast.error('No workspace found. Please create a workspace first.');
        return;
      }

      // Add workspace information to the form data
      formData.append('workspace_id', workspace.workspace_id);
      formData.append('user_id', user.id);

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
    if (!user?.id) {
      toast.error('Please sign in to check for new customers');
      return;
    }

    setIsRefreshing(true);
    try {
      if (!session?.access_token) {
        toast.error('Authentication session required');
        return;
      }

      console.log('Session details:', {
        user: user,
        accessToken: session.access_token,
        hasRefreshToken: !!session.access_token
      });

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
        .eq('user_id', user.id)
        .single();

      if (workspaceError) {
        toast.error('No workspace found. Please create a workspace first.');
        return;
      }

      // Fetch current data from Fortnox
      const response = await fetch('/api/fortnox/customers', {
        headers: {
          'workspace-id': workspace.workspace_id,
          'user-id': user.id
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
      const currentCustomerNames = new Set(currentCustomers?.map((cust: any) => cust.name) || []);
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
            email: customer.Email,
            workspace_id: workspace.workspace_id,
            user_id: user.id
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

  // Handle opening the task dialog
  const handleOpenTaskDialog = (customer: ExtendedCustomer) => {
    console.log('[Debug] Selected customer:', customer);
    console.log('[Debug] Customer invoices:', customer.invoices);
    setSelectedCustomer(customer);
    setTaskDialogOpen(true);
  };

  // Check to see if customers list should refresh after creating a new customer
  const handleCustomerCreated = () => {
    if (refetch) {
      refetch();
    } else {
      // If refetch isn't available, reload the page as a fallback
      window.location.reload();
    }
  };

  const handleDeleteCustomer = async (customer: ExtendedCustomer) => {
    setCustomerToDelete(customer);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete || !user?.id) return;
    
    setDeletingCustomerId(customerToDelete.id);
    try {
      const response = await fetch(`/api/customers/delete?id=${customerToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete customer');
      }

      toast.success(`Successfully deleted customer: ${customerToDelete.name}`);
      refetch(); // Refresh the customer list
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete customer');
    } finally {
      setDeletingCustomerId(null);
      setDeleteConfirmOpen(false);
      setCustomerToDelete(null);
    }
  };

  // Add function to sync customer emails from Fortnox
  const syncCustomerEmails = async () => {
    if (!user?.id) {
      toast.error('Please sign in to sync customer emails');
      return;
    }

    if (!session?.access_token) {
      toast.error('Authentication session required');
      return;
    }

    setIsSyncingEmails(true);
    try {
      const response = await fetch('/api/fortnox/customers/sync-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync customer emails');
      }

      const data = await response.json();
      
      toast.success(`Successfully synced ${data.stored_emails} customer emails from Fortnox`);
      
      // Refresh the customer list
      if (refetch) {
        refetch();
      }
    } catch (error) {
      console.error('Error syncing customer emails:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync customer emails');
    } finally {
      setIsSyncingEmails(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        <p className="mt-4 text-muted-foreground">Loading customers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-background text-muted-foreground">
        <AlertOctagon className="h-8 w-8 text-red-600 dark:text-red-400 mx-auto" />
        <p className="mt-4 text-muted-foreground">Failed to load customers. Please try again later.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-background text-muted-foreground">
        <p>Please sign in to view customers.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 pl-4 py-4 pr-4", className)}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-foreground">Customers</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground0" />
            <input
              type="text"
              placeholder="Search customers..."
              className="pl-10 pr-4 py-2 bg-background border border-border dark:border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-[250px] text-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="group relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
            
            <div className="relative z-10 m-[1px] bg-background rounded-lg hover:bg-neutral-750 transition-colors duration-300">
              <button
                onClick={syncCustomerEmails}
                disabled={isSyncingEmails}
                className="flex items-center gap-1.5 px-3 py-2 border-0 bg-transparent text-gray-800 dark:text-foreground hover:bg-transparent hover:text-foreground"
              >
                {isSyncingEmails ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync Emails
              </button>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
            
            <div className="relative z-10 m-[1px] bg-background rounded-lg hover:bg-neutral-750 transition-colors duration-300">
              <button
                onClick={() => setCreateCustomerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 border-0 bg-transparent text-gray-800 dark:text-foreground hover:bg-transparent hover:text-foreground"
              >
                <PlusCircle className="h-4 w-4" />
                Create Customer
              </button>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-green-500 via-blue-500 to-green-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
            
            <div className="relative z-10 m-[1px] bg-background rounded-lg hover:bg-neutral-750 transition-colors duration-300">
              <button
                onClick={checkForNewData}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-2 border-0 bg-transparent text-gray-800 dark:text-foreground hover:bg-transparent hover:text-foreground"
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </button>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-green-500 via-blue-500 to-green-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
            
            <div className="relative z-10 m-[1px] bg-background rounded-lg hover:bg-neutral-750 transition-colors duration-300">
              <button
                onClick={handleSaveAll}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 border-0 bg-transparent text-gray-800 dark:text-foreground hover:bg-transparent hover:text-foreground"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save All
              </button>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-green-500 via-blue-500 to-green-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
            
            <div className="relative z-10 m-[1px] bg-background rounded-lg hover:bg-neutral-750 transition-colors duration-300">
              <label
                className="flex items-center gap-1.5 px-3 py-2 cursor-pointer border-0 bg-transparent text-gray-800 dark:text-foreground hover:text-foreground"
              >
                <Upload className="h-4 w-4" />
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12 text-red-600 dark:text-red-400">
          <AlertOctagon className="w-6 h-6 mr-2" />
          <span>{error.message || "Failed to load customers"}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatedBorderCard className="overflow-hidden bg-background border-0">
            <div className="relative">
              <GlowingEffect 
                spread={30} 
                glow={true} 
                disabled={false} 
                proximity={60} 
                inactiveZone={0.01}
                borderWidth={1.5}
                movementDuration={1.5}
                variant="default"
              />
              <div className="p-0 relative z-10">
                <div className="rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="text-sm font-medium bg-background text-foreground dark:text-neutral-300">
                        <th className="text-left px-4 py-3">Customer Name</th>
                        <th className="text-left px-4 py-3">Customer Number</th>
                        <th className="text-left px-4 py-3">Email</th>
                        <th className="text-left px-4 py-3">Total Revenue</th>
                        <th className="text-left px-4 py-3">Invoices</th>
                        <th className="text-left px-4 py-3">Last Invoice</th>
                        <th className="text-center px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    {filteredCustomers.length > 0 ? (
                      <tbody className="divide-y divide-neutral-800">
                        {filteredCustomers.map((customer: ExtendedCustomer) => (
                          <tr key={customer.id || customer.customer_number} className="hover:bg-background/50 transition-colors">
                            <td className="px-4 py-3">
                              <Link href={`/customers/${customer.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                                {customer.name}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{customer.customer_number}</td>
                            <td className="px-4 py-3 text-muted-foreground">{customer.email || '-'}</td>
                            <td className="px-4 py-3 text-foreground">
                              {customer.total ? `${customer.total.toLocaleString()} kr` : '0 kr'}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {customer.invoice_count || 0}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {customer.last_invoice_date ? new Date(customer.last_invoice_date).toLocaleDateString('sv-SE') : 'Never'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => handleOpenTaskDialog(customer)}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  title="View Tasks"
                                >
                                  <ListTodo size={18} />
                                </button>
                                <Link
                                  href={`/customers/${customer.id}`}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  title="View Details"
                                >
                                  <ChevronRight size={18} />
                                </Link>
                                <button
                                  onClick={() => handleDeleteCustomer(customer)}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                  title="Delete Customer"
                                  disabled={deletingCustomerId === customer.id}
                                >
                                  {deletingCustomerId === customer.id ? (
                                    <Loader2 size={18} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={18} />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    ) : (
                      <tbody>
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-foreground0">
                            No customers found. Try updating your search or importing customers.
                          </td>
                        </tr>
                      </tbody>
                    )}
                  </table>
                </div>
              </div>
            </div>
          </AnimatedBorderCard>
        </div>
      )}

      {/* Dialog for displaying customer details, tasks and projects */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-[800px] bg-background border-border dark:border-border p-0 text-foreground">
          <DialogHeader className="border-b border-border dark:border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-400" />
                  {selectedCustomer?.name}
                  {selectedCustomer?.customer_number && (
                    <span className="text-sm text-muted-foreground ml-2">
                      #{selectedCustomer.customer_number}
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground mt-1">
                  Customer information, projects and tasks
                </DialogDescription>
                {selectedCustomer?.email && (
                  <div className="mt-2 text-sm text-blue-400">
                    {selectedCustomer.email}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                <Link 
                  href={`/customers/${selectedCustomer?.id}`}
                  className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  View full page <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </DialogHeader>
          
          <Tabs defaultValue="invoices" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-border dark:border-border">
              <TabsList className="bg-transparent p-0 h-auto w-full rounded-none">
                <div className="flex w-full">
                  <TabsTrigger 
                    value="invoices" 
                    className={cn(
                      "flex-1 rounded-none border-b-2 py-3 border-transparent data-[state=active]:border-purple-500",
                      "hover:bg-gray-200 data-[state=active]:bg-gray-200 dark:bg-muted/20"
                    )}
                  >
                    <BarChart3 className="h-4 w-4 mr-2 text-purple-400" />
                    Revenue & Invoices
                  </TabsTrigger>
                  <TabsTrigger 
                    value="tasks" 
                    className={cn(
                      "flex-1 rounded-none border-b-2 py-3 border-transparent data-[state=active]:border-blue-500",
                      "hover:bg-gray-200 data-[state=active]:bg-gray-200 dark:bg-muted/20"
                    )}
                  >
                    <CheckSquare className="h-4 w-4 mr-2 text-green-600 dark:text-green-400" />
                    Completed Tasks ({selectedCustomer?.completed_tasks?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="projects" 
                    className={cn(
                      "flex-1 rounded-none border-b-2 py-3 border-transparent data-[state=active]:border-yellow-500",
                      "hover:bg-gray-200 data-[state=active]:bg-gray-200 dark:bg-muted/20"
                    )}
                  >
                    <Folder className="h-4 w-4 mr-2 text-yellow-400" />
                    Projects ({selectedCustomer?.linked_projects?.length || 0})
                  </TabsTrigger>
                </div>
              </TabsList>
            </div>
            
            <TabsContent value="invoices" className="max-h-[60vh] overflow-y-auto p-6 custom-scrollbar">
              {/* Debug logs moved to useEffect */}
              <div className="mb-8 bg-background rounded-lg p-6 border border-border dark:border-border">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Revenue Summary</h2>
                    <p className="text-sm text-muted-foreground mt-1">Financial overview for {selectedCustomer?.name}</p>
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {typeof selectedCustomer?.total === 'number' ? 
                      new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                        .format(selectedCustomer.total) : '0 SEK'}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
                  <div className="bg-background rounded-md p-4">
                    <div className="text-sm text-muted-foreground mb-1">Total Invoices</div>
                    <div className="text-xl font-semibold text-foreground">{selectedCustomer?.invoice_count || 0}</div>
                  </div>
                  <div className="bg-background rounded-md p-4">
                    <div className="text-sm text-muted-foreground mb-1">Customer Since</div>
                    <div className="text-xl font-semibold text-foreground">
                      {selectedCustomer?.created_at ? 
                        new Date(selectedCustomer.created_at).toLocaleDateString() : 'Unknown'}
                    </div>
                  </div>
                  <div className="bg-background rounded-md p-4">
                    <div className="text-sm text-muted-foreground mb-1">Last Invoice</div>
                    <div className="text-xl font-semibold text-foreground">
                      {selectedCustomer?.last_invoice_date ? 
                        new Date(selectedCustomer.last_invoice_date).toLocaleDateString() : 'No invoices'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mb-2">
                <h3 className="text-lg font-medium text-foreground mb-4">Invoices</h3>
                {!selectedCustomer?.invoices?.length ? (
                  <div className="text-center py-8 bg-background rounded-lg border border-border dark:border-border">
                    <p className="text-muted-foreground">No invoices found for this customer</p>
                  </div>
                ) : (
                  <div className="border border-border dark:border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-background">
                          <tr className="border-b border-border dark:border-border">
                            <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Invoice #</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Date</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Due Date</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">Amount</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-700 bg-background">
                          {selectedCustomer.invoices.map(invoice => (
                            <tr key={invoice.id} className="hover:bg-background transition-colors">
                              <td className="py-3 px-4 text-sm text-foreground">{invoice.document_number}</td>
                              <td className="py-3 px-4 text-sm text-foreground">{new Date(invoice.invoice_date).toLocaleDateString()}</td>
                              <td className="py-3 px-4 text-sm text-foreground">{new Date(invoice.due_date).toLocaleDateString()}</td>
                              <td className="py-3 px-4 text-sm text-foreground text-right">
                                {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(invoice.total)}
                              </td>
                              <td className="py-3 px-4 text-sm">
                                <span className={cn(
                                  "px-2 py-1 rounded-full text-xs font-medium",
                                  {
                                    "bg-green-100 dark:bg-green-900/20 text-green-400": invoice.status === "paid",
                                    "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-400": invoice.status === "partial",
                                    "bg-red-100 dark:bg-red-900/20 text-red-400": invoice.status === "overdue",
                                    "bg-gray-200 dark:bg-muted/20 text-muted-foreground": invoice.status === "unpaid"
                                  }
                                )}>
                                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="tasks" className="max-h-[60vh] overflow-y-auto p-6 custom-scrollbar">
              {!selectedCustomer?.completed_tasks?.length ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 text-neutral-600" />
                  <p>No completed tasks found for this customer.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedCustomer?.completed_tasks?.map((task: CompletedTask) => (
                    <div key={task.id} className="bg-background rounded-md p-4 border border-border hover:border-gray-400 dark:border-border transition-colors">
                      <div className="flex justify-between mb-2">
                        <h3 className="text-md font-medium text-foreground">{task.title}</h3>
                        <span className="text-sm text-foreground0">
                          {new Date(task.completed_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mb-4">
                        <div className="text-sm text-muted-foreground flex gap-1">
                          <span className="font-medium">Project:</span>
                          <span>{task.project_name}</span>
                        </div>
                      </div>
                      {task.checklist && task.checklist.length > 0 && (
                        <div className="border-t border-border dark:border-border pt-3 mt-3">
                          <h4 className="text-sm font-medium text-foreground dark:text-neutral-300 mb-2">Completed Items:</h4>
                          <div className="space-y-2">
                            {task.checklist.filter((item: ChecklistItem) => item.done).map((item: ChecklistItem) => (
                              <div key={item.id} className="flex items-start gap-2">
                                <CheckSquare size={14} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-foreground dark:text-neutral-300">{item.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="projects" className="max-h-[60vh] overflow-y-auto p-6 custom-scrollbar">
              {!selectedCustomer?.linked_projects?.length ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Folder className="h-12 w-12 mx-auto mb-4 text-neutral-600" />
                  <p>No projects linked to this customer.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedCustomer?.linked_projects?.map((project) => (
                    <div key={project.id} className="bg-background rounded-md overflow-hidden border border-border hover:border-gray-400 dark:border-border transition-colors">
                      <div className="flex justify-between items-center p-4">
                        <div>
                          <h3 className="text-md font-medium text-foreground flex items-center">
                            {project.name}
                            <span className={cn(
                              "ml-3 px-2 py-0.5 rounded-full text-xs font-medium",
                              {
                                "bg-green-100 dark:bg-green-900/20 text-green-400": project.status.toLowerCase() === "active",
                                "bg-background/20 text-muted-foreground": project.status.toLowerCase() === "completed",
                                "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-400": project.status.toLowerCase() === "on-hold"
                              }
                            )}>
                              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                            </span>
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {project.task_count} tasks
                          </p>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-24 h-2 bg-gray-200 dark:bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${project.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{project.progress}%</span>
                          </div>
                          <Link
                            href={`/projects?id=${project.id}`}
                            className="flex items-center text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View project <ArrowUpRight className="h-3 w-3 ml-1" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          <div className="border-t border-border dark:border-border p-4 flex justify-end">
            <div className="group relative overflow-hidden rounded-lg">
              <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
              
              <div className="relative z-10 m-[1px] bg-background rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                <button 
                  className="px-4 py-2 border-0 bg-transparent text-gray-800 dark:text-foreground hover:bg-transparent hover:text-foreground"
                  onClick={() => setTaskDialogOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <CreateCustomerDialog
        open={createCustomerOpen}
        onOpenChange={setCreateCustomerOpen}
        onCustomerCreated={refetch}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {customerToDelete?.name}? This action cannot be undone.
              {customerToDelete?.total && customerToDelete.total > 0 && (
                <div className="mt-2 bg-destructive/10 p-3 rounded-md text-destructive border border-destructive">
                  <AlertOctagon className="inline-block mr-2" size={16} />
                  Warning: This customer has invoices with a total value of {customerToDelete.total.toLocaleString()} kr.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteConfirmOpen(false)}
              className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              disabled={deletingCustomerId !== null}
            >
              {deletingCustomerId ? (
                <>
                  <Loader2 size={16} className="inline-block mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Customer'
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 