'use client';

import { useEffect, useState } from 'react';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowUpDown, Mail, Save, RefreshCw, Loader2, AlertOctagon } from 'lucide-react';
import Link from 'next/link';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { checkPermission } from '@/lib/permission';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { DollarSign, BarChart, CalendarCheck } from 'lucide-react';
import { FortnoxDateFetcher } from '@/components/ui/fortnox-date-fetcher';

interface Invoice {
  DocumentNumber: string;
  InvoiceDate: string;
  CustomerName: string;
  Total: number;
  Balance: number;
  DueDate: string;
  Currency: string;
  InvoiceType: string;
  PaymentWay: string;
  ExternalInvoiceReference1: string;
}

interface InvoiceStats {
  totalAmount: number;
  totalCount: number;
  paidCount: number;
  unpaidCount: number;
  overdueCount: number;
}

interface FortnoxInvoice {
  DocumentNumber: string;
  CustomerName: string;
  InvoiceDate: string;
  Total: string;
  Balance: string;
  DueDate: string;
  ExternalInvoiceReference1: string;
}

// Add type interfaces for the team members
interface TeamMembership {
  workspace_id: string;
  is_admin: boolean;
  permissions?: {
    view_invoices?: boolean;
    admin?: boolean;
    [key: string]: boolean | undefined;
  };
}

export default function InvoicesPage() {
  const { data: session } = useSession()
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats>({
    totalAmount: 0,
    totalCount: 0,
    paidCount: 0,
    unpaidCount: 0,
    overdueCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showFortnoxTester, setShowFortnoxTester] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Invoice;
    direction: 'asc' | 'desc';
  }>({ key: 'InvoiceDate', direction: 'desc' });
  const [filters, setFilters] = useState({
    status: 'all', // all, paid, unpaid, overdue
    type: 'all',
    dateRange: 'all' // all, thisMonth, lastMonth, thisYear
  });
  const router = useRouter();

  useEffect(() => {
    if (session?.user?.id) {
      fetchInvoices();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    // Apply filters and search
    let result = [...invoices];

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(invoice => 
        invoice.CustomerName.toLowerCase().includes(searchLower) ||
        invoice.DocumentNumber.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      const now = new Date();
      result = result.filter(invoice => {
        const dueDate = new Date(invoice.DueDate);
        
        switch (filters.status) {
          case 'paid':
            return invoice.Balance === 0;
          case 'unpaid':
            return invoice.Balance > 0;
          case 'overdue':
            return invoice.Balance > 0 && dueDate < now;
          default:
            return true;
        }
      });
    }

    // Apply type filter
    if (filters.type !== 'all') {
      result = result.filter(invoice => invoice.InvoiceType === filters.type);
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      result = result.filter(invoice => {
        const invoiceDate = new Date(invoice.InvoiceDate);
        switch (filters.dateRange) {
          case 'thisMonth':
            return invoiceDate >= startOfMonth;
          case 'lastMonth':
            return invoiceDate >= startOfLastMonth && invoiceDate < startOfMonth;
          case 'thisYear':
            return invoiceDate >= startOfYear;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Convert to dates for date fields
      if (['InvoiceDate', 'DueDate'].includes(sortConfig.key)) {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredInvoices(result);
    calculateStats(result);
  }, [invoices, search, filters, sortConfig]);

  const fetchInvoices = async () => {
    try {
      if (!session?.user?.id) {
        toast.error('Please sign in to view invoices');
        return;
      }

      // Log the user ID for debugging
      console.log('[Invoices] Fetching invoices for user ID:', session.user.id, 'Email:', session.user.email);
      
      // Try fetching invoices directly from Fortnox first
      try {
        setLoading(true);
        console.log('[Invoices] Trying to fetch invoices directly from Fortnox...');
        
        const response = await fetch(`/api/fortnox/invoices`, {
          headers: {
            'Content-Type': 'application/json',
            'user-id': session.user.id
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[Invoices] Successfully fetched ${data.count || 0} invoices directly from Fortnox`);
          
          if (data.Invoices && data.Invoices.length > 0) {
            // Transform invoice format if needed
            const processedInvoices = data.Invoices.map((invoice: any) => ({
              DocumentNumber: invoice.DocumentNumber,
              InvoiceDate: invoice.InvoiceDate,
              CustomerName: invoice.CustomerName,
              Total: typeof invoice.Total === 'string' ? parseFloat(invoice.Total) : invoice.Total,
              Balance: typeof invoice.Balance === 'string' ? parseFloat(invoice.Balance) : invoice.Balance,
              DueDate: invoice.DueDate,
              Currency: invoice.Currency || 'SEK',
              InvoiceType: invoice.InvoiceType || 'Standard',
              PaymentWay: invoice.PaymentWay || 'Bank Transfer',
              ExternalInvoiceReference1: invoice.ExternalInvoiceReference1 || ''
            }));
            
            setInvoices(processedInvoices);
            
            // Update the dashboard stats immediately after setting invoices
            const totalStats = {
              totalAmount: 0,
              totalCount: processedInvoices.length,
              paidCount: 0,
              unpaidCount: 0,
              overdueCount: 0
            };
            
            // Calculate stats for the fetched invoices
            const now = new Date();
            processedInvoices.forEach(invoice => {
              totalStats.totalAmount += typeof invoice.Total === 'string' ? parseFloat(invoice.Total) : invoice.Total;
              
              if (invoice.Balance === 0) {
                totalStats.paidCount++;
              } else {
                totalStats.unpaidCount++;
                const dueDate = new Date(invoice.DueDate);
                if (dueDate < now) {
                  totalStats.overdueCount++;
                }
              }
            });
            
            // Update stats state
            setStats(totalStats);
            setLoading(false);
            return;
          }
        } else {
          console.error('[Invoices] Failed to fetch directly from Fortnox, falling back to database');
        }
      } catch (error) {
        console.error('[Invoices] Error fetching directly from Fortnox:', error);
        console.log('[Invoices] Falling back to database...');
      }
      
      // Get workspaces using API endpoint
      const workspaceResponse = await fetch('/api/workspace/leave');
      if (!workspaceResponse.ok) {
        throw new Error('Failed to fetch workspaces');
      }
      
      const workspaceData = await workspaceResponse.json();
      const workspaces = workspaceData.workspaces || [];
      
      if (workspaces.length === 0) {
        console.log('[Invoices] No workspaces found for user');
        setLoading(false);
        return;
      }

      const workspaceIds = workspaces.map((w: any) => w.id);
      console.log('[Invoices] Workspace IDs:', workspaceIds);

      // Continue with the existing workflow using the workspaceIds
      await fetchInvoicesForWorkspaces(workspaceIds);
    } catch (error) {
      console.error('[Invoices] Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to fetch invoices for a set of workspace IDs
  const fetchInvoicesForWorkspaces = async (workspaceIds: string[]) => {
    try {
      // Fetch invoices with customer names and currency codes
      console.log('[Invoices] Fetching ALL invoices for workspaces:', workspaceIds);
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (name),
          currencies (code),
          invoice_types (name)
        `)
        .in('workspace_id', workspaceIds)
        .order('invoice_date', { ascending: false }); // Order by date, most recent first

      if (invoicesError) {
        console.error('[Invoices] Error fetching invoices:', invoicesError);
        toast.error('Failed to load invoices');
        setLoading(false);
        return;
      }

      console.log('[Invoices] Fetched invoices count:', invoicesData?.length || 0);

      if (!invoicesData || invoicesData.length === 0) {
        console.log('[Invoices] No invoices found for user workspaces');
        setInvoices([]);
        setLoading(false);
        return;
      }

      // Transform the data to match the expected format
      const processedInvoices = invoicesData.map((invoice: any) => ({
        DocumentNumber: invoice.document_number,
        InvoiceDate: invoice.invoice_date,
        CustomerName: invoice.customers?.name || 'Unknown Customer',
        Total: invoice.total,
        Balance: invoice.balance,
        DueDate: invoice.due_date,
        Currency: invoice.currencies?.code || 'SEK',
        InvoiceType: invoice.invoice_types?.name || 'Standard',
        PaymentWay: 'Bank Transfer',
        ExternalInvoiceReference1: invoice.external_reference || ''
      }));

      // Update the invoices state
      setInvoices(processedInvoices);
      
      // Calculate statistics for these invoices to update the dashboard
      const now = new Date();
      const totalStats = {
        totalAmount: 0,
        totalCount: processedInvoices.length,
        paidCount: 0,
        unpaidCount: 0,
        overdueCount: 0
      };
      
      processedInvoices.forEach(invoice => {
        totalStats.totalAmount += typeof invoice.Total === 'string' ? parseFloat(invoice.Total) : invoice.Total;
        
        if (invoice.Balance === 0) {
          totalStats.paidCount++;
        } else {
          totalStats.unpaidCount++;
          const dueDate = new Date(invoice.DueDate);
          if (dueDate < now) {
            totalStats.overdueCount++;
          }
        }
      });
      
      // Update stats in UI
      setStats(totalStats);
      console.log('[Invoices] Updated dashboard stats with', totalStats);
    } catch (error) {
      console.error('[Invoices] Error processing invoices:', error);
      toast.error('Failed to process invoices data');
    }
  };

  const calculateStats = (invoices: Invoice[]) => {
    const now = new Date();
    const stats = invoices.reduce((acc, invoice) => {
      const dueDate = new Date(invoice.DueDate);

      acc.totalAmount += invoice.Total;
      acc.totalCount++;
      
      if (invoice.Balance === 0) acc.paidCount++;
      else {
        acc.unpaidCount++;
        if (dueDate < now) acc.overdueCount++;
      }

      return acc;
    }, {
      totalAmount: 0,
      totalCount: 0,
      paidCount: 0,
      unpaidCount: 0,
      overdueCount: 0
    });

    setStats(stats);
  };

  const handleSort = (key: keyof Invoice) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      if (!session?.user?.id) {
        toast.error('Please sign in to save invoices');
        return;
      }
      
      // Get the active workspace ID
      const { data: teamMemberships, error: teamError } = await supabase
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (teamError || !teamMemberships || teamMemberships.length === 0) {
        console.error('Error getting workspace ID:', teamError);
        toast.error('Failed to save invoices: Cannot determine workspace');
        setIsSaving(false);
        return;
      }
      
      const workspaceId = teamMemberships[0].workspace_id;
      
      // First, get all customers to map their names to IDs
      const { data: customers, error: customerError } = await supabase
        .from('customers')
        .select('id, name');

      if (customerError) throw customerError;

      const customerMap = new Map(customers.map((c: { name: string, id: string }) => [c.name, c.id]));

      // Transform invoices data to match Supabase schema
      const invoicesToSave = invoices.map(invoice => ({
        document_number: invoice.DocumentNumber,
        customer_id: customerMap.get(invoice.CustomerName) || null,
        invoice_date: invoice.InvoiceDate,
        total: invoice.Total,
        balance: invoice.Balance,
        due_date: invoice.DueDate,
        external_reference: invoice.ExternalInvoiceReference1,
        user_id: session.user.id,
        workspace_id: workspaceId  // Add workspace_id
      }));

      // Use fetch with API instead of direct Supabase client for proper auth handling
      const response = await fetch('/api/invoices/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoices: invoicesToSave,
          workspaceId: workspaceId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save invoices');
      }
      
      const data = await response.json();

      toast.success(`Successfully saved ${invoicesToSave.length} invoices`);
    } catch (error) {
      console.error('Error saving invoices:', error);
      toast.error('Failed to save invoices');
    } finally {
      setIsSaving(false);
    }
  };

  const checkForNewData = async () => {
    setIsRefreshing(true);
    try {
      if (!session?.user?.id) {
        toast.error('Please sign in to check for new invoices');
        return;
      }
      
      console.log('[Invoices] Checking for new Fortnox invoices...');
      
      // Get the user's workspace ID
      const { data: teamMemberships, error: teamError } = await supabase
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (teamError || !teamMemberships || teamMemberships.length === 0) {
        console.error('Error getting workspace ID:', teamError);
        toast.error('Failed to check for new invoices: Cannot determine workspace');
        return;
      }
      
      const workspaceId = teamMemberships[0].workspace_id;
      console.log(`[Invoices] Using workspace ID: ${workspaceId}`);
      
      // Fetch current data from Fortnox using Next.js API route
      console.log('[Invoices] Fetching invoices from Fortnox API...');
      const response = await fetch(`/api/fortnox/invoices`, {
        headers: {
          'Content-Type': 'application/json',
          'user-id': session.user.id,
          // Only include workspace-id if it exists
          ...(workspaceId ? { 'workspace-id': workspaceId } : {})
        }
      });
      
      if (!response.ok) {
        console.error(`[Invoices] Fortnox API error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(`[Invoices] Error details: ${errorText}`);
        throw new Error('Failed to fetch Fortnox invoices');
      }
      
      const fortnoxData = await response.json();
      const fortnoxInvoices = (fortnoxData.Invoices || []) as FortnoxInvoice[];
      console.log(`[Invoices] Fetched ${fortnoxInvoices.length} invoices from Fortnox`);
      
      try {
        // Process the Fortnox invoices directly
        const processedInvoices = fortnoxInvoices.map((invoice: any) => ({
          DocumentNumber: invoice.DocumentNumber,
          InvoiceDate: invoice.InvoiceDate,
          CustomerName: invoice.CustomerName,
          Total: typeof invoice.Total === 'string' ? parseFloat(invoice.Total) : invoice.Total,
          Balance: typeof invoice.Balance === 'string' ? parseFloat(invoice.Balance) : invoice.Balance,
          DueDate: invoice.DueDate,
          Currency: invoice.Currency || 'SEK',
          InvoiceType: invoice.InvoiceType || 'Standard',
          PaymentWay: invoice.PaymentWay || 'Bank Transfer',
          ExternalInvoiceReference1: invoice.ExternalInvoiceReference1 || ''
        }));
        
        // Update the state with the new invoices
        setInvoices(processedInvoices);
        toast.success(`Successfully fetched ${processedInvoices.length} invoices from Fortnox`);
        setIsRefreshing(false);
        
        // If we don't have a workspace ID, we're done
        if (!workspaceId) {
          return;
        }
      } catch (error) {
        console.error('[Invoices] Error processing Fortnox invoices:', error);
        toast.error('Error processing Fortnox invoices');
        setIsRefreshing(false);
        return;
      }
      
      // If we have a workspace ID, also try to save these invoices
      // Get current Supabase data for comparison for this specific workspace
      console.log(`[Invoices] Fetching existing invoices from database for workspace ${workspaceId}...`);
      const { data: supabaseInvoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('document_number')
        .eq('workspace_id', workspaceId);

      if (invoicesError) {
        console.error('[Invoices] Error fetching existing invoices:', invoicesError);
        throw invoicesError;
      }

      console.log(`[Invoices] Found ${supabaseInvoices.length} existing invoices in database`);

      // Compare document numbers
      const supabaseDocNumbers = new Set(supabaseInvoices.map((inv: { document_number: string }) => inv.document_number));
      const newInvoices = fortnoxInvoices.filter(inv => !supabaseDocNumbers.has(inv.DocumentNumber));
      console.log(`[Invoices] Found ${newInvoices.length} new invoices to add`);

      if (newInvoices.length > 0) {
        // Show confirmation dialog
        const shouldUpdate = window.confirm(
          `Found ${newInvoices.length} new invoice${newInvoices.length === 1 ? '' : 's'} from Fortnox. Would you like to save ${newInvoices.length === 1 ? 'it' : 'them'} to the database?`
        );

        if (shouldUpdate) {
          console.log('[Invoices] User confirmed saving new invoices');
          // First ensure we have all customers
          const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('id, name');

          if (customerError) {
            console.error('[Invoices] Error fetching customers:', customerError);
            throw customerError;
          }

          const customerMap = new Map(customers.map((c: { name: string, id: string }) => [c.name, c.id]));
          console.log(`[Invoices] Loaded ${customers.length} customers for matching`);

          // Prepare new invoices for Supabase format
          const invoicesToSave = newInvoices.map(invoice => ({
            document_number: invoice.DocumentNumber,
            customer_id: customerMap.get(invoice.CustomerName) || null,
            invoice_date: invoice.InvoiceDate,
            total: parseFloat(invoice.Total),
            balance: parseFloat(invoice.Balance),
            due_date: invoice.DueDate,
            external_reference: invoice.ExternalInvoiceReference1,
            user_id: session.user.id,
            workspace_id: workspaceId
          }));

          console.log(`[Invoices] Saving ${invoicesToSave.length} new invoices to database...`);
          // Save new invoices
          // Use fetch with API instead of direct Supabase client
          const response = await fetch('/api/invoices/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              invoices: invoicesToSave,
              workspaceId: workspaceId
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('[Invoices] Error saving invoices:', errorData);
            throw new Error(errorData.error || 'Failed to save invoices');
          }

          console.log('[Invoices] Successfully saved new invoices');
          toast.success(`Successfully saved ${newInvoices.length} new invoice${newInvoices.length === 1 ? '' : 's'}`);
          // Refresh the display
          fetchInvoices();
        } else {
          console.log('[Invoices] User declined to save new invoices');
          toast.info('No invoices were saved');
        }
      } else {
        console.log('[Invoices] No new invoices found');
        toast.info('No new invoices found in Fortnox');
      }
    } catch (error) {
      console.error('Error checking for new data:', error);
      toast.error('Failed to check for new invoices: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <SidebarDemo>
      <div className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground0" />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-background border border-border dark:border-border rounded-md text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
              </div>
              <button
                onClick={checkForNewData}
                disabled={isRefreshing}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 bg-background hover:bg-gray-200 dark:bg-muted border border-border dark:border-border rounded-md text-sm text-foreground transition-colors",
                  isRefreshing && "opacity-50 cursor-not-allowed"
                )}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? "Checking..." : "Check New"}
              </button>
              <button
                onClick={() => setShowFortnoxTester(!showFortnoxTester)}
                className="flex items-center gap-2 px-4 py-2 bg-background hover:bg-gray-200 dark:bg-muted border border-border dark:border-border rounded-md text-sm text-foreground transition-colors"
              >
                <CalendarCheck className="h-4 w-4" />
                Date Tester
              </button>
              <button
                onClick={handleSaveAll}
                disabled={isSaving || invoices.length === 0}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 bg-background hover:bg-gray-200 dark:bg-muted border border-border dark:border-border rounded-md text-sm text-foreground transition-colors",
                  (isSaving || invoices.length === 0) && "opacity-50 cursor-not-allowed"
                )}
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save All"}
              </button>
              <Button
                onClick={() => router.push('/invoices/import')}
                variant="default"
                className="gap-2"
              >
                <Mail className="h-4 w-4" /> Send Invoices
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-background border-border dark:border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <h3 className="text-2xl font-semibold text-foreground mt-1">
                    {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(stats.totalAmount)}
                  </h3>
                </div>
                <div className="h-10 w-10 rounded-md bg-gray-200 dark:bg-muted flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-foreground" />
                </div>
              </div>
            </Card>
            <Card className="bg-background border-border dark:border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                  <h3 className="text-2xl font-semibold text-foreground mt-1">{stats.totalCount}</h3>
                </div>
                <div className="h-10 w-10 rounded-md bg-gray-200 dark:bg-muted flex items-center justify-center">
                  <BarChart className="h-5 w-5 text-foreground" />
                </div>
              </div>
            </Card>
            <Card className="bg-background border-border dark:border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paid Invoices</p>
                  <h3 className="text-2xl font-semibold text-foreground mt-1">{stats.paidCount}</h3>
                </div>
                <div className="h-10 w-10 rounded-md bg-gray-200 dark:bg-muted flex items-center justify-center">
                  <BarChart className="h-5 w-5 text-foreground" />
                </div>
              </div>
            </Card>
            <Card className="bg-background border-border dark:border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue Invoices</p>
                  <h3 className="text-2xl font-semibold text-foreground mt-1">{stats.overdueCount}</h3>
                </div>
                <div className="h-10 w-10 rounded-md bg-gray-200 dark:bg-muted flex items-center justify-center">
                  <BarChart className="h-5 w-5 text-foreground" />
                </div>
              </div>
            </Card>
          </div>

          {/* Fortnox Date Tester */}
          {showFortnoxTester && session?.user?.id && (
            <div className="mb-6">
              <FortnoxDateFetcher 
                userId={session.user.id} 
                onFetchComplete={(fetchedInvoices) => {
                  // Update invoices state with the fetched invoices
                  if (fetchedInvoices && fetchedInvoices.length > 0) {
                    const processedInvoices = fetchedInvoices.map((invoice: any) => ({
                      DocumentNumber: invoice.DocumentNumber,
                      InvoiceDate: invoice.InvoiceDate,
                      CustomerName: invoice.CustomerName,
                      Total: typeof invoice.Total === 'string' ? parseFloat(invoice.Total) : invoice.Total,
                      Balance: typeof invoice.Balance === 'string' ? parseFloat(invoice.Balance) : invoice.Balance,
                      DueDate: invoice.DueDate,
                      Currency: invoice.Currency || 'SEK',
                      InvoiceType: invoice.InvoiceType || 'Standard',
                      PaymentWay: invoice.PaymentWay || 'Bank Transfer',
                      ExternalInvoiceReference1: invoice.ExternalInvoiceReference1 || ''
                    }));
                    setInvoices(processedInvoices);
                    console.log(`[InvoicesPage] Updated invoices list with ${processedInvoices.length} fetched invoices`);
                    // We also need to update the dashboard stats counts
                    const totalStats = {
                      totalAmount: 0,
                      totalCount: processedInvoices.length,
                      paidCount: 0,
                      unpaidCount: 0,
                      overdueCount: 0
                    };
                    
                    // Recalculate stats
                    const now = new Date();
                    processedInvoices.forEach(invoice => {
                      totalStats.totalAmount += invoice.Total;
                      
                      if (invoice.Balance === 0) {
                        totalStats.paidCount++;
                      } else {
                        totalStats.unpaidCount++;
                        const dueDate = new Date(invoice.DueDate);
                        if (dueDate < now) {
                          totalStats.overdueCount++;
                        }
                      }
                    });
                    
                    // Update stats state
                    setStats(totalStats);
                  }
                }} 
              />
            </div>
          )}

          {/* Table */}
          <Card className="bg-background border-border dark:border-border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border dark:border-border">
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                      <button
                        className="flex items-center gap-1"
                        onClick={() => handleSort('DocumentNumber')}
                      >
                        Invoice #
                        {sortConfig.key === 'DocumentNumber' && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                      <button
                        className="flex items-center gap-1"
                        onClick={() => handleSort('CustomerName')}
                      >
                        Customer
                        {sortConfig.key === 'CustomerName' && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                      <button
                        className="flex items-center gap-1"
                        onClick={() => handleSort('InvoiceDate')}
                      >
                        Date
                        {sortConfig.key === 'InvoiceDate' && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                      <button
                        className="flex items-center gap-1"
                        onClick={() => handleSort('Total')}
                      >
                        Total
                        {sortConfig.key === 'Total' && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                      <button
                        className="flex items-center gap-1"
                        onClick={() => handleSort('Balance')}
                      >
                        Balance
                        {sortConfig.key === 'Balance' && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">
                      <button
                        className="flex items-center gap-1"
                        onClick={() => handleSort('DueDate')}
                      >
                        Due Date
                        {sortConfig.key === 'DueDate' && (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        <div className="flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                          <span className="ml-2">Loading invoices...</span>
                        </div>
                      </td>
                    </tr>
                  ) : permissionDenied ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <AlertOctagon className="h-8 w-8 text-amber-500 mx-auto" />
                          <p className="mt-2 text-muted-foreground">You don't have permission to view invoices.</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        {search || Object.values(filters).some(val => val !== 'all') 
                          ? "No invoices found matching your filters." 
                          : "No invoices found. Import invoices or check from Fortnox to get started."}
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((invoice) => {
                      const isPaid = invoice.Balance === 0;
                      const isOverdue = !isPaid && new Date(invoice.DueDate) < new Date();
                      
                      return (
                        <tr
                          key={invoice.DocumentNumber}
                          className="hover:bg-neutral-750 transition-colors cursor-pointer"
                          onClick={() => router.push(`/invoices/${invoice.DocumentNumber}`)}
                        >
                          <td className="py-4 px-6 text-sm text-foreground">{invoice.DocumentNumber}</td>
                          <td className="py-4 px-6 text-sm text-foreground">{invoice.CustomerName}</td>
                          <td className="py-4 px-6 text-sm text-muted-foreground">
                            {new Date(invoice.InvoiceDate).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-sm text-foreground">
                            {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: invoice.Currency }).format(invoice.Total)}
                          </td>
                          <td className="py-4 px-6 text-sm text-foreground">
                            {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: invoice.Currency }).format(invoice.Balance)}
                          </td>
                          <td className="py-4 px-6 text-sm text-muted-foreground">
                            {new Date(invoice.DueDate).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6">
                            <span className={cn(
                              "px-2 py-1 text-xs font-medium rounded-full",
                              isPaid ? "bg-green-500/10 text-green-600 dark:text-green-400" : 
                              isOverdue ? "bg-red-500/10 text-red-600 dark:text-red-400" : 
                              "bg-amber-500/10 text-amber-500"
                            )}>
                              {isPaid ? "Paid" : isOverdue ? "Overdue" : "Unpaid"}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </SidebarDemo>
  );
} 