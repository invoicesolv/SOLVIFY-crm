'use client';

import { useEffect, useState } from 'react';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowUpDown, Mail, Save, RefreshCw, Loader2, AlertOctagon } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { checkPermission, getActiveWorkspaceId } from '@/lib/permission';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { DollarSign, BarChart } from 'lucide-react';

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
      
      // Get workspaces directly from team_members table
      const { data: teamMemberships, error: teamError } = await supabase
        .from('team_members')
        .select('workspace_id, is_admin, permissions')
        .eq('user_id', session.user.id);

      if (teamError) {
        console.error('[Invoices] Error fetching team memberships:', teamError);
        toast.error('Failed to load team memberships');
        setLoading(false);
        return;
      }

      // Handle case where user has no memberships
      if (!teamMemberships || teamMemberships.length === 0) {
        console.log('[Invoices] No workspaces found for user by ID, trying email fallback');
        
        // Try email-based lookup as fallback (especially for kevin@amptron.com)
        if (session.user.email) {
          const { data: emailTeamMemberships, error: emailTeamError } = await supabase
            .from('team_members')
            .select('workspace_id, is_admin, permissions')
            .eq('email', session.user.email);
            
          if (emailTeamError) {
            console.error('[Invoices] Error fetching team memberships by email:', emailTeamError);
            toast.error('Failed to load team memberships');
            setLoading(false);
            return;
          }
          
          if (!emailTeamMemberships || emailTeamMemberships.length === 0) {
            console.log('[Invoices] No workspaces found for user by email either');
            setInvoices([]);
            setLoading(false);
            return;
          }
          
          console.log('[Invoices] Found workspaces by email:', emailTeamMemberships);
          
          // Check if user has permission to view invoices using email-based team memberships
          const hasPermission = emailTeamMemberships.some(membership => 
            membership.is_admin || 
            (membership.permissions && 
              (membership.permissions.view_invoices || 
              membership.permissions.admin))
          );
          
          if (!hasPermission) {
            console.log('[Invoices] User does not have permission to view invoices (via email check)');
            setPermissionDenied(true);
            setLoading(false);
            return;
          }
          
          // Use email-based workspace IDs to fetch invoices
          const workspaceIds = emailTeamMemberships.map(tm => tm.workspace_id);
          console.log('[Invoices] Workspace IDs from email lookup:', workspaceIds);
          
          // Continue with fetching invoices using these workspace IDs
          await fetchInvoicesForWorkspaces(workspaceIds);
          return;
        } else {
          console.log('[Invoices] No workspaces found and no email available for fallback');
          setInvoices([]);
          setLoading(false);
          return;
        }
      }

      // Check if user has permission to view invoices
      const hasPermission = teamMemberships.some(membership => 
        membership.is_admin || 
        (membership.permissions && 
          (membership.permissions.view_invoices || 
          membership.permissions.admin))
      );

      if (!hasPermission) {
        console.log('[Invoices] User does not have permission to view invoices');
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      const workspaceIds = teamMemberships.map(tm => tm.workspace_id);
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
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (name),
          currencies (code),
          invoice_types (name)
        `)
        .in('workspace_id', workspaceIds);

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
      const processedInvoices = invoicesData.map(invoice => ({
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

      setInvoices(processedInvoices);
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

      const customerMap = new Map(customers.map(c => [c.name, c.id]));

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

      const { data, error } = await supabase
        .from('invoices')
        .upsert(invoicesToSave, {
          onConflict: 'document_number',
          ignoreDuplicates: true
        })
        .select();

      if (error) throw error;

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
      
      // Get the active workspace ID
      const { data: teamMemberships, error: teamError } = await supabase
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (teamError || !teamMemberships || teamMemberships.length === 0) {
        console.error('Error getting workspace ID:', teamError);
        toast.error('Failed to check for new invoices: Cannot determine workspace');
        setIsRefreshing(false);
        return;
      }
      
      const workspaceId = teamMemberships[0].workspace_id;
      
      // Fetch current data from Fortnox
      const response = await fetch('http://localhost:5001/fortnox/invoices');
      if (!response.ok) throw new Error('Failed to fetch Fortnox invoices');
      const fortnoxData = await response.json();
      const fortnoxInvoices = (fortnoxData.Invoices || []) as FortnoxInvoice[];

      // Get current Supabase data for comparison
      const { data: supabaseInvoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('document_number');

      if (invoicesError) throw invoicesError;

      // Compare document numbers
      const supabaseDocNumbers = new Set(supabaseInvoices.map(inv => inv.document_number));
      const newInvoices = fortnoxInvoices.filter(inv => !supabaseDocNumbers.has(inv.DocumentNumber));

      if (newInvoices.length > 0) {
        // Show confirmation dialog
        const shouldUpdate = window.confirm(
          `Found ${newInvoices.length} new invoice${newInvoices.length === 1 ? '' : 's'}. Would you like to save ${newInvoices.length === 1 ? 'it' : 'them'} to the database?`
        );

        if (shouldUpdate) {
          // First ensure we have all customers
          const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('id, name');

          if (customerError) throw customerError;

          const customerMap = new Map(customers.map(c => [c.name, c.id]));

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
            workspace_id: workspaceId  // Add workspace_id
          }));

          // Save new invoices
          const { error: saveError } = await supabase
            .from('invoices')
            .upsert(invoicesToSave, {
              onConflict: 'document_number',
              ignoreDuplicates: true
            });

          if (saveError) throw saveError;

          toast.success(`Successfully saved ${newInvoices.length} new invoice${newInvoices.length === 1 ? '' : 's'}`);
          // Refresh the display
          fetchInvoices();
        }
      } else {
        toast.info('No new invoices found');
      }
    } catch (error) {
      console.error('Error checking for new data:', error);
      toast.error('Failed to check for new invoices');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <SidebarDemo>
      <div className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-white">Invoices</h1>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
              </div>
              <button
                onClick={checkForNewData}
                disabled={isRefreshing}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-sm text-white transition-colors",
                  isRefreshing && "opacity-50 cursor-not-allowed"
                )}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? "Checking..." : "Check New"}
              </button>
              <button
                onClick={handleSaveAll}
                disabled={isSaving || invoices.length === 0}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-sm text-white transition-colors",
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
            <Card className="bg-neutral-800 border-neutral-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-400">Total Revenue</p>
                  <h3 className="text-2xl font-semibold text-white mt-1">
                    {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(stats.totalAmount)}
                  </h3>
                </div>
                <div className="h-10 w-10 rounded-md bg-neutral-700 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
              </div>
            </Card>
            <Card className="bg-neutral-800 border-neutral-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-400">Total Invoices</p>
                  <h3 className="text-2xl font-semibold text-white mt-1">{stats.totalCount}</h3>
                </div>
                <div className="h-10 w-10 rounded-md bg-neutral-700 flex items-center justify-center">
                  <BarChart className="h-5 w-5 text-white" />
                </div>
              </div>
            </Card>
            <Card className="bg-neutral-800 border-neutral-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-400">Paid Invoices</p>
                  <h3 className="text-2xl font-semibold text-white mt-1">{stats.paidCount}</h3>
                </div>
                <div className="h-10 w-10 rounded-md bg-neutral-700 flex items-center justify-center">
                  <BarChart className="h-5 w-5 text-white" />
                </div>
              </div>
            </Card>
            <Card className="bg-neutral-800 border-neutral-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-400">Overdue Invoices</p>
                  <h3 className="text-2xl font-semibold text-white mt-1">{stats.overdueCount}</h3>
                </div>
                <div className="h-10 w-10 rounded-md bg-neutral-700 flex items-center justify-center">
                  <BarChart className="h-5 w-5 text-white" />
                </div>
              </div>
            </Card>
          </div>

          {/* Table */}
          <Card className="bg-neutral-800 border-neutral-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-700">
                    <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">
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
                    <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">
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
                    <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">
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
                    <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">
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
                    <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">
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
                    <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">
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
                    <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-400">
                        <div className="flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-neutral-400 mx-auto" />
                          <span className="ml-2">Loading invoices...</span>
                        </div>
                      </td>
                    </tr>
                  ) : permissionDenied ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <AlertOctagon className="h-8 w-8 text-amber-500 mx-auto" />
                          <p className="mt-2 text-neutral-400">You don't have permission to view invoices.</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-400">
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
                          <td className="py-4 px-6 text-sm text-white">{invoice.DocumentNumber}</td>
                          <td className="py-4 px-6 text-sm text-white">{invoice.CustomerName}</td>
                          <td className="py-4 px-6 text-sm text-neutral-400">
                            {new Date(invoice.InvoiceDate).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-sm text-white">
                            {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: invoice.Currency }).format(invoice.Total)}
                          </td>
                          <td className="py-4 px-6 text-sm text-white">
                            {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: invoice.Currency }).format(invoice.Balance)}
                          </td>
                          <td className="py-4 px-6 text-sm text-neutral-400">
                            {new Date(invoice.DueDate).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6">
                            <span className={cn(
                              "px-2 py-1 text-xs font-medium rounded-full",
                              isPaid ? "bg-green-500/10 text-green-500" : 
                              isOverdue ? "bg-red-500/10 text-red-500" : 
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