'use client';

import { useEffect, useState } from 'react';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowUpDown, Mail, Save, RefreshCw, Loader2, AlertOctagon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { DollarSign, BarChart, CalendarCheck } from 'lucide-react';
import { FortnoxDateFetcher } from '@/components/ui/fortnox-date-fetcher';
import { useInvoices } from '@/hooks/useInvoices';

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
  const { user, session } = useAuth();
  const [search, setSearch] = useState('');
  const [showFortnoxTester, setShowFortnoxTester] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Invoice;
    direction: 'asc' | 'desc';
  }>({ key: 'InvoiceDate', direction: 'desc' });
  const [filters, setFilters] = useState({
    status: 'all' as 'all' | 'paid' | 'unpaid' | 'overdue',
    type: 'all',
    dateRange: 'all' as 'all' | 'thisMonth' | 'lastMonth' | 'thisYear'
  });
  const router = useRouter();
  
  // Use the new useInvoices hook following the documented pattern
  const { 
    invoices, 
    stats, 
    pagination, 
    isLoading: loading, 
    error, 
    refetch 
  } = useInvoices({
    search: search || undefined,
    status: filters.status,
    dateRange: filters.dateRange,
    orderBy: sortConfig.key === 'InvoiceDate' ? 'invoice_date' : 
             sortConfig.key === 'Total' ? 'total' : 
             sortConfig.key === 'Balance' ? 'balance' : 
             sortConfig.key === 'DueDate' ? 'due_date' : 
             sortConfig.key === 'DocumentNumber' ? 'document_number' : 
             sortConfig.key === 'CustomerName' ? 'customer_name' : 'invoice_date',
    orderDir: sortConfig.direction
  });
  
  // Apply client-side filtering for fields not handled by the API
  const filteredInvoices = invoices.filter(invoice => {
    // Type filter (if needed for client-side filtering)
    if (filters.type !== 'all' && invoice.InvoiceType !== filters.type) {
      return false;
    }
    return true;
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Remove the old useEffect that called fetchInvoices
  // The useInvoices hook handles this automatically

  // Remove the old filtering/sorting useEffect as this is now handled by the API
  // The API handles search, status filter, date range filter, and sorting

  // Remove the old fetchInvoices function as this is now handled by the useInvoices hook

  // Remove the old fetchInvoicesForWorkspaces function

  // Remove the old calculateStats function as stats are now provided by the API

  const handleSort = (key: keyof Invoice) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      if (!user?.id) {
        toast.error('Please sign in to save invoices');
        return;
      }
      
      // Transform invoices data to match expected API format
      const invoicesToSave = invoices.map(invoice => ({
        document_number: invoice.DocumentNumber,
        customer_name: invoice.CustomerName,
        invoice_date: invoice.InvoiceDate,
        total: invoice.Total,
        balance: invoice.Balance,
        due_date: invoice.DueDate,
        external_reference: invoice.ExternalInvoiceReference1,
        user_id: user.id
      }));

      // Use fetch with API instead of direct Supabase client for proper auth handling
      const response = await fetch('/api/invoices/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include NextAuth cookies
        body: JSON.stringify({
          invoices: invoicesToSave
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save invoices');
      }
      
      toast.success(`Successfully saved ${invoicesToSave.length} invoices`);
      refetch(); // Refresh the data
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
      // Simply refresh the data using the hook
      refetch();
      toast.success('Refreshed invoice data');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh invoices');
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
              {showFortnoxTester && user?.id && (
                <div className="mb-6">
                  <FortnoxDateFetcher 
                    userId={user.id} 
                    onFetchComplete={(fetchedInvoices) => {
                      // Simply refresh the data instead of manually updating state
                      if (fetchedInvoices && fetchedInvoices.length > 0) {
                        console.log(`[InvoicesPage] Fetched ${fetchedInvoices.length} invoices from Fortnox`);
                        refetch(); // Use the hook's refetch function
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
                  ) : error ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <AlertOctagon className="h-8 w-8 text-red-500 mx-auto" />
                          <p className="mt-2 text-muted-foreground">Error loading invoices: {error.message}</p>
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