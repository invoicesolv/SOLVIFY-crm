"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useCustomers, EnhancedCustomer } from "@/hooks/useCustomers";
import { Upload, Search, Save, RefreshCw, CheckSquare, Loader2, AlertOctagon, ChevronRight, ListTodo, Folder, BarChart3, ArrowUpRight, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

interface CustomersViewProps {
  className?: string;
}

// Define the Fortnox customer interface
interface FortnoxCustomer {
  CustomerNumber: string;
  Name: string;
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

export function CustomersView({ className }: CustomersViewProps) {
  const { data: session } = useSession();
  // Use any type to avoid type checking issues
  const { customers, isLoading, error }: { customers: any[], isLoading: boolean, error: any } = useCustomers() as any;
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<EnhancedCustomer | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("invoices");

  // Debug useEffect for selectedCustomer and invoices
  useEffect(() => {
    if (selectedCustomer) {
      console.log('[Debug] Selected customer in useEffect:', selectedCustomer);
      console.log('[Debug] Customer invoices in useEffect:', selectedCustomer.invoices);
    }
  }, [selectedCustomer]);

  // Debug output for user ID
  useEffect(() => {
    if (session?.user) {
      console.log('[Debug] Customers view rendered for user:', {
        id: session.user.id,
        email: session.user.email 
      });
    }
  }, [session?.user]);

  const filteredCustomers = Array.isArray(customers) ? customers.filter((customer: EnhancedCustomer) => 
    customer && customer.name && customer.name.toLowerCase().includes(search.toLowerCase())
  ) : [];

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

      const customersToSave = Array.isArray(customers) ? customers.map(customer => ({
        ...customer,
        workspace_id: workspace.workspace_id,
        user_id: session.user.id
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

  // Handle opening the task dialog
  const handleOpenTaskDialog = (customer: EnhancedCustomer) => {
    console.log('[Debug] Selected customer:', customer);
    console.log('[Debug] Customer invoices:', customer.invoices);
    setSelectedCustomer(customer);
    setTaskDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-neutral-900 text-neutral-400">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400 mx-auto" />
        <p className="mt-4 text-neutral-400">Loading customers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-neutral-900 text-neutral-400">
        <AlertOctagon className="h-8 w-8 text-red-500 mx-auto" />
        <p className="mt-4 text-neutral-400">Failed to load customers. Please try again later.</p>
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
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #262626;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #404040;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #525252;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>
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
            disabled={isSaving || isLoading || !Array.isArray(customers) || customers.length === 0}
            className={cn(
              "flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-sm text-white transition-colors",
              (isSaving || isLoading || !Array.isArray(customers) || customers.length === 0) && "opacity-50 cursor-not-allowed"
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
                <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Projects & Tasks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-700">
              {!Array.isArray(customers) || filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-neutral-400">
                    {search ? "No customers found matching your search." : "No customers found. Import customers to get started."}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer: EnhancedCustomer) => (
                  <tr
                    key={customer.id || Math.random().toString()}
                    className="hover:bg-neutral-750 transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      handleOpenTaskDialog(customer);
                    }}
                  >
                    <td className="py-4 px-6 text-sm text-white">{customer.name || ''}</td>
                    <td className="py-4 px-6 text-sm text-white">{customer.customer_number || ''}</td>
                    <td className="py-4 px-6 text-sm text-white">
                      {typeof customer.total === 'number' ? 
                        new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                          .format(customer.total) : '0 SEK'}
                    </td>
                    <td className="py-4 px-6 text-sm text-white">{customer.invoice_count || 0}</td>
                    <td className="py-4 px-6 text-sm text-neutral-400">
                      {customer.last_invoice_date ? new Date(customer.last_invoice_date).toLocaleDateString() : 'No invoices'}
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {(customer.completed_tasks?.length > 0 || customer.linked_projects?.length > 0) ? (
                        <button 
                          className="flex items-center gap-1 text-neutral-400 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTaskDialog(customer);
                          }}
                        >
                          <ListTodo className="h-4 w-4 text-blue-400" />
                          <span>{customer.completed_tasks?.length || 0} tasks</span>
                          <span className="text-neutral-500 mx-1">|</span>
                          <Folder className="h-4 w-4 text-yellow-400" />
                          <span>{customer.linked_projects?.length || 0} projects</span>
                        </button>
                      ) : (
                        <span className="text-neutral-500">None</span>
                      )}
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

      {/* Dialog for displaying customer details, tasks and projects */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-[800px] bg-neutral-800 border-neutral-700 p-0 text-white">
          <DialogHeader className="border-b border-neutral-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-400" />
                  {selectedCustomer?.name}
                  {selectedCustomer?.customer_number && (
                    <span className="text-sm text-neutral-400 ml-2">
                      #{selectedCustomer.customer_number}
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-neutral-400 mt-1">
                  Customer information, projects and tasks
                </DialogDescription>
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
            <div className="border-b border-neutral-700">
              <TabsList className="bg-transparent p-0 h-auto w-full rounded-none">
                <div className="flex w-full">
                  <TabsTrigger 
                    value="invoices" 
                    className={cn(
                      "flex-1 rounded-none border-b-2 py-3 border-transparent data-[state=active]:border-purple-500",
                      "hover:bg-neutral-700/20 data-[state=active]:bg-neutral-700/20"
                    )}
                  >
                    <BarChart3 className="h-4 w-4 mr-2 text-purple-400" />
                    Revenue & Invoices
                  </TabsTrigger>
                  <TabsTrigger 
                    value="tasks" 
                    className={cn(
                      "flex-1 rounded-none border-b-2 py-3 border-transparent data-[state=active]:border-blue-500",
                      "hover:bg-neutral-700/20 data-[state=active]:bg-neutral-700/20"
                    )}
                  >
                    <CheckSquare className="h-4 w-4 mr-2 text-green-500" />
                    Completed Tasks ({selectedCustomer?.completed_tasks?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="projects" 
                    className={cn(
                      "flex-1 rounded-none border-b-2 py-3 border-transparent data-[state=active]:border-yellow-500",
                      "hover:bg-neutral-700/20 data-[state=active]:bg-neutral-700/20"
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
              <div className="mb-8 bg-neutral-900 rounded-lg p-6 border border-neutral-700">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Revenue Summary</h2>
                    <p className="text-sm text-neutral-400 mt-1">Financial overview for {selectedCustomer?.name}</p>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {typeof selectedCustomer?.total === 'number' ? 
                      new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                        .format(selectedCustomer.total) : '0 SEK'}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
                  <div className="bg-neutral-800 rounded-md p-4">
                    <div className="text-sm text-neutral-400 mb-1">Total Invoices</div>
                    <div className="text-xl font-semibold text-white">{selectedCustomer?.invoice_count || 0}</div>
                  </div>
                  <div className="bg-neutral-800 rounded-md p-4">
                    <div className="text-sm text-neutral-400 mb-1">Customer Since</div>
                    <div className="text-xl font-semibold text-white">
                      {selectedCustomer?.created_at ? 
                        new Date(selectedCustomer.created_at).toLocaleDateString() : 'Unknown'}
                    </div>
                  </div>
                  <div className="bg-neutral-800 rounded-md p-4">
                    <div className="text-sm text-neutral-400 mb-1">Last Invoice</div>
                    <div className="text-xl font-semibold text-white">
                      {selectedCustomer?.last_invoice_date ? 
                        new Date(selectedCustomer.last_invoice_date).toLocaleDateString() : 'No invoices'}
                    </div>
                  </div>
                </div>
                
                {selectedCustomer?.email && (
                  <div className="flex items-center gap-2 text-sm text-neutral-400 mt-4">
                    <span className="font-medium">Email:</span>
                    <span>{selectedCustomer.email}</span>
                  </div>
                )}
                
                {selectedCustomer?.phone && (
                  <div className="flex items-center gap-2 text-sm text-neutral-400 mt-2">
                    <span className="font-medium">Phone:</span>
                    <span>{selectedCustomer.phone}</span>
                  </div>
                )}
              </div>
              
              <div className="mb-2">
                <h3 className="text-lg font-medium text-white mb-4">Invoices</h3>
                {!selectedCustomer?.invoices?.length ? (
                  <div className="text-center py-8 bg-neutral-900 rounded-lg border border-neutral-700">
                    <p className="text-neutral-400">No invoices found for this customer</p>
                  </div>
                ) : (
                  <div className="border border-neutral-700 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-neutral-900">
                          <tr className="border-b border-neutral-700">
                            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400">Invoice #</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400">Date</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400">Due Date</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-neutral-400">Amount</th>
                            <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-700 bg-neutral-900">
                          {selectedCustomer.invoices.map(invoice => (
                            <tr key={invoice.id} className="hover:bg-neutral-800 transition-colors">
                              <td className="py-3 px-4 text-sm text-white">{invoice.document_number}</td>
                              <td className="py-3 px-4 text-sm text-white">{new Date(invoice.invoice_date).toLocaleDateString()}</td>
                              <td className="py-3 px-4 text-sm text-white">{new Date(invoice.due_date).toLocaleDateString()}</td>
                              <td className="py-3 px-4 text-sm text-white text-right">
                                {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(invoice.total)}
                              </td>
                              <td className="py-3 px-4 text-sm">
                                <span className={cn(
                                  "px-2 py-1 rounded-full text-xs font-medium",
                                  {
                                    "bg-green-900/20 text-green-400": invoice.status === "paid",
                                    "bg-yellow-900/20 text-yellow-400": invoice.status === "partial",
                                    "bg-red-900/20 text-red-400": invoice.status === "overdue",
                                    "bg-neutral-700/20 text-neutral-400": invoice.status === "unpaid"
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
                <div className="py-8 text-center text-neutral-400">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 text-neutral-600" />
                  <p>No completed tasks found for this customer.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedCustomer?.completed_tasks?.map((task: CompletedTask) => (
                    <div key={task.id} className="bg-neutral-900 rounded-md p-4 border border-neutral-700 hover:border-neutral-600 transition-colors">
                      <div className="flex justify-between mb-2">
                        <h3 className="text-md font-medium text-white">{task.title}</h3>
                        <span className="text-sm text-neutral-500">
                          {new Date(task.completed_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mb-4">
                        <div className="text-sm text-neutral-400 flex gap-1">
                          <span className="font-medium">Project:</span>
                          <span>{task.project_name}</span>
                        </div>
                      </div>
                      {task.checklist && task.checklist.length > 0 && (
                        <div className="border-t border-neutral-700 pt-3 mt-3">
                          <h4 className="text-sm font-medium text-neutral-300 mb-2">Completed Items:</h4>
                          <div className="space-y-2">
                            {task.checklist.filter((item: ChecklistItem) => item.done).map((item: ChecklistItem) => (
                              <div key={item.id} className="flex items-start gap-2">
                                <CheckSquare size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-neutral-300">{item.text}</span>
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
                <div className="py-8 text-center text-neutral-400">
                  <Folder className="h-12 w-12 mx-auto mb-4 text-neutral-600" />
                  <p>No projects linked to this customer.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedCustomer?.linked_projects?.map((project) => (
                    <div key={project.id} className="bg-neutral-900 rounded-md overflow-hidden border border-neutral-700 hover:border-neutral-600 transition-colors">
                      <div className="flex justify-between items-center p-4">
                        <div>
                          <h3 className="text-md font-medium text-white flex items-center">
                            {project.name}
                            <span className={cn(
                              "ml-3 px-2 py-0.5 rounded-full text-xs font-medium",
                              {
                                "bg-green-900/20 text-green-400": project.status.toLowerCase() === "active",
                                "bg-neutral-900/20 text-neutral-400": project.status.toLowerCase() === "completed",
                                "bg-yellow-900/20 text-yellow-400": project.status.toLowerCase() === "on-hold"
                              }
                            )}>
                              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                            </span>
                          </h3>
                          <p className="text-sm text-neutral-400 mt-1">
                            {project.task_count} tasks
                          </p>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-24 h-2 bg-neutral-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${project.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-neutral-400">{project.progress}%</span>
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
          
          <div className="border-t border-neutral-700 p-4 flex justify-end">
            <button 
              className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-sm"
              onClick={() => setTaskDialogOpen(false)}
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 