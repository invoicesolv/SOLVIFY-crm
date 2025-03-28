'use client';

import { useEffect, useState } from 'react';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowUpDown, Mail, Save, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

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
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Invoice;
    direction: 'asc' | 'desc';
  }>({ key: 'InvoiceDate', direction: 'desc' });
  const [filters, setFilters] = useState({
    status: 'all', // all, paid, unpaid, overdue
    type: 'all',
    dateRange: 'all' // all, thisMonth, lastMonth, thisYear
  });

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
      console.log('Fetching invoices for user ID:', session.user.id);

      // Fetch invoices with customer names and currency codes
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (name),
          currencies (code),
          invoice_types (name)
        `)
        .eq('user_id', session.user.id);

      if (invoicesError) {
        console.error('Error fetching invoices:', invoicesError);
        throw invoicesError;
      }

      console.log('Fetched invoices count:', invoicesData?.length || 0);

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
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
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
        user_id: session?.user?.id
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
            user_id: session?.user?.id
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
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white">CRM Invoices</h1>
            <p className="text-sm text-neutral-400">
              Manage and track your customer invoices
            </p>
          </div>
          <div className="space-x-4">
            <Link href="/invoices/recurring">
              <Button variant="outline" className="bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800">
                <RefreshCw className="h-4 w-4 mr-2" />
                Recurring Invoices
              </Button>
            </Link>
            <Button 
              variant="outline" 
              onClick={handleSaveAll}
              className="bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800"
            >
              <Save className="h-4 w-4 mr-2" />
              Save All
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-neutral-800 border-neutral-700 p-4">
            <p className="text-sm text-neutral-400">Total Amount</p>
            <p className="text-xl font-semibold text-white mt-1">
              {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                .format(stats.totalAmount)}
            </p>
          </Card>
          <Card className="bg-neutral-800 border-neutral-700 p-4">
            <p className="text-sm text-neutral-400">Total Invoices</p>
            <p className="text-xl font-semibold text-white mt-1">{stats.totalCount}</p>
          </Card>
          <Card className="bg-neutral-800 border-neutral-700 p-4">
            <p className="text-sm text-neutral-400">Paid</p>
            <p className="text-xl font-semibold text-emerald-400 mt-1">{stats.paidCount}</p>
          </Card>
          <Card className="bg-neutral-800 border-neutral-700 p-4">
            <p className="text-sm text-neutral-400">Unpaid</p>
            <p className="text-xl font-semibold text-yellow-400 mt-1">{stats.unpaidCount}</p>
          </Card>
          <Card className="bg-neutral-800 border-neutral-700 p-4">
            <p className="text-sm text-neutral-400">Overdue</p>
            <p className="text-xl font-semibold text-red-400 mt-1">{stats.overdueCount}</p>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="bg-neutral-800 border-neutral-700">
          <div className="p-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
              </div>
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
              className="px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
            >
              <option value="all">All Time</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="thisYear">This Year</option>
            </select>
          </div>
        </Card>

        {/* Invoices Table */}
        <Card className="bg-neutral-800 border-neutral-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-700">
                  <th 
                    className="text-left py-4 px-6 text-sm font-medium text-neutral-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('DocumentNumber')}
                  >
                    <div className="flex items-center gap-2">
                      Invoice Number
                      {sortConfig.key === 'DocumentNumber' && (
                        <ArrowUpDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-left py-4 px-6 text-sm font-medium text-neutral-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('CustomerName')}
                  >
                    <div className="flex items-center gap-2">
                      Customer
                      {sortConfig.key === 'CustomerName' && (
                        <ArrowUpDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-left py-4 px-6 text-sm font-medium text-neutral-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('InvoiceDate')}
                  >
                    <div className="flex items-center gap-2">
                      Date
                      {sortConfig.key === 'InvoiceDate' && (
                        <ArrowUpDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-left py-4 px-6 text-sm font-medium text-neutral-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('DueDate')}
                  >
                    <div className="flex items-center gap-2">
                      Due Date
                      {sortConfig.key === 'DueDate' && (
                        <ArrowUpDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-right py-4 px-6 text-sm font-medium text-neutral-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('Total')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Amount
                      {sortConfig.key === 'Total' && (
                        <ArrowUpDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-right py-4 px-6 text-sm font-medium text-neutral-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort('Balance')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      Balance
                      {sortConfig.key === 'Balance' && (
                        <ArrowUpDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-400"></div>
                      </div>
                    </td>
                  </tr>
                ) : filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.DocumentNumber}
                    className="hover:bg-neutral-750 transition-colors"
                  >
                    <td className="py-4 px-6 text-sm text-white">
                      {invoice.DocumentNumber}
                    </td>
                    <td className="py-4 px-6 text-sm text-white">
                      {invoice.CustomerName}
                    </td>
                    <td className="py-4 px-6 text-sm text-neutral-400">
                      {new Date(invoice.InvoiceDate).toLocaleDateString('sv-SE')}
                    </td>
                    <td className="py-4 px-6 text-sm text-neutral-400">
                      {new Date(invoice.DueDate).toLocaleDateString('sv-SE')}
                    </td>
                    <td className="py-4 px-6 text-sm text-right text-white">
                      {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: invoice.Currency })
                        .format(invoice.Total)}
                    </td>
                    <td className="py-4 px-6 text-sm text-right">
                      <span className={`font-medium ${
                        invoice.Balance === 0
                          ? 'text-emerald-400'
                          : new Date(invoice.DueDate) < new Date()
                          ? 'text-red-400'
                          : 'text-yellow-400'
                      }`}>
                        {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: invoice.Currency })
                          .format(invoice.Balance)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </SidebarDemo>
  );
} 