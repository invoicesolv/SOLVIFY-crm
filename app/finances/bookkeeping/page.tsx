'use client';

import { useEffect, useState } from 'react';
import { SidebarDemo } from '@/components/ui/code.demo';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  FileText, 
  Receipt, 
  TrendingDown, 
  TrendingUp,
  Download,
  RefreshCw,
  ArrowLeft,
  Eye,
  ExternalLink,
  BarChart3,
  PieChart
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';
import { useAuth } from '@/lib/auth-client';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BookkeepingDocument {
  id: string;
  type: 'invoice' | 'expense' | 'receipt' | 'voucher' | 'supplier_invoice' | 'payment';
  documentNumber: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  status: 'pending' | 'approved' | 'processed' | 'paid' | 'overdue' | 'completed';
  supplier?: string;
  customer?: string;
  category?: string;
  reference?: string;
  fiscalYear?: string;
}

interface YearlyFinancials {
  year: string;
  revenue: number; // From customer invoices
  expenses: number; // From supplier invoices and vouchers
  profit: number; // Revenue - Expenses
  invoiceCount: number;
  supplierInvoiceCount: number;
  voucherCount: number;
  totalDocuments: number;
}

// Calculate yearly financial analysis from documents
function calculateYearlyFinancials(documents: BookkeepingDocument[]): YearlyFinancials[] {
  const yearlyData: { [year: string]: YearlyFinancials } = {};

  documents.forEach(doc => {
    const year = doc.fiscalYear || new Date(doc.date).getFullYear().toString();
    
    if (!yearlyData[year]) {
      yearlyData[year] = {
        year,
        revenue: 0,
        expenses: 0,
        profit: 0,
        invoiceCount: 0,
        supplierInvoiceCount: 0,
        voucherCount: 0,
        totalDocuments: 0
      };
    }

    yearlyData[year].totalDocuments++;

    switch (doc.type) {
      case 'invoice':
        yearlyData[year].revenue += doc.amount;
        yearlyData[year].invoiceCount++;
        break;
      case 'supplier_invoice':
        yearlyData[year].expenses += doc.amount;
        yearlyData[year].supplierInvoiceCount++;
        break;
      case 'payment':
        // Supplier invoice payments represent expenses
        yearlyData[year].expenses += doc.amount;
        yearlyData[year].supplierInvoiceCount++;
        break;
      case 'voucher':
        // Vouchers can represent various types of expenses
        yearlyData[year].expenses += doc.amount;
        yearlyData[year].voucherCount++;
        break;
      case 'expense':
      case 'receipt':
        yearlyData[year].expenses += doc.amount;
        break;
    }
  });

  // Calculate profit for each year
  Object.values(yearlyData).forEach(yearData => {
    yearData.profit = yearData.revenue - yearData.expenses;
  });

  // Sort by year (newest first)
  return Object.values(yearlyData).sort((a, b) => parseInt(b.year) - parseInt(a.year));
}

// Prepare chart data for revenue vs expenses
function prepareChartData(yearlyFinancials: YearlyFinancials[]) {
  return yearlyFinancials
    .sort((a, b) => parseInt(a.year) - parseInt(b.year)) // Sort chronologically for charts
    .map(data => ({
      year: data.year,
      revenue: Math.round(data.revenue),
      expenses: Math.round(data.expenses),
      profit: Math.round(data.profit),
      revenueFormatted: formatCurrencyValue(data.revenue),
      expensesFormatted: formatCurrencyValue(data.expenses),
      profitFormatted: formatCurrencyValue(data.profit)
    }));
}

// Prepare pie chart data for current year expense breakdown
function prepareExpenseBreakdownData(documents: BookkeepingDocument[]) {
  const currentYear = new Date().getFullYear().toString();
  const currentYearDocs = documents.filter(doc => 
    (doc.fiscalYear || new Date(doc.date).getFullYear().toString()) === currentYear
  );

  const breakdown = {
    supplierInvoices: 0,
    vouchers: 0,
    payments: 0,
    other: 0
  };

  currentYearDocs.forEach(doc => {
    switch (doc.type) {
      case 'supplier_invoice':
        breakdown.supplierInvoices += doc.amount;
        break;
      case 'payment':
        breakdown.payments += doc.amount;
        break;
      case 'voucher':
        breakdown.vouchers += doc.amount;
        break;
      case 'expense':
      case 'receipt':
        breakdown.other += doc.amount;
        break;
    }
  });

  return [
    { name: 'Supplier Invoices', value: Math.round(breakdown.supplierInvoices), color: '#8b5cf6' },
    { name: 'Supplier Payments', value: Math.round(breakdown.payments), color: '#10b981' },
    { name: 'Vouchers', value: Math.round(breakdown.vouchers), color: '#f97316' },
    { name: 'Other Expenses', value: Math.round(breakdown.other), color: '#6b7280' }
  ].filter(item => item.value > 0);
}

// Helper function for currency formatting in charts
function formatCurrencyValue(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export default function BookkeepingPage() {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState<BookkeepingDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<BookkeepingDocument[]>([]);
  const [yearlyFinancials, setYearlyFinancials] = useState<YearlyFinancials[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'documents' | 'analysis'>('documents');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (user?.id) {
      // Set default date range to last year
      const today = new Date();
      const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      
      const formattedToday = today.toISOString().split('T')[0];
      const formattedOneYearAgo = oneYearAgo.toISOString().split('T')[0];
      
      setStartDate(formattedOneYearAgo);
      setEndDate(formattedToday);
      
      fetchBookkeepingDocuments(formattedOneYearAgo, formattedToday);
    }
  }, [user?.id]);

  useEffect(() => {
    // Apply filters
    let filtered = documents;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.documentNumber.toLowerCase().includes(searchLower) ||
        doc.description.toLowerCase().includes(searchLower) ||
        doc.supplier?.toLowerCase().includes(searchLower) ||
        doc.customer?.toLowerCase().includes(searchLower)
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(doc => doc.type === typeFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    setFilteredDocuments(filtered);
  }, [documents, search, typeFilter, statusFilter]);

  const fetchBookkeepingDocuments = async (fromDate?: string, toDate?: string) => {
    try {
      setLoading(true);

      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }

      let allDocuments: BookkeepingDocument[] = [];

      // Fetch invoices from Fortnox
      const invoicesParams = new URLSearchParams();
      if (fromDate) invoicesParams.append('from_date', fromDate);
      if (toDate) invoicesParams.append('to_date', toDate);
      
      const invoicesResponse = await fetch(`/api/fortnox/invoices?${invoicesParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json();
        const invoices = invoicesData.Invoices || [];
        
        // Transform invoices to bookkeeping documents
        const invoiceDocuments: BookkeepingDocument[] = invoices.map((inv: any) => ({
          id: `invoice-${inv.DocumentNumber}`,
          type: 'invoice' as const,
          documentNumber: inv.DocumentNumber,
          date: inv.InvoiceDate,
          amount: parseFloat(inv.Total || 0),
          currency: inv.Currency || 'SEK',
          description: `Invoice to ${inv.CustomerName}`,
          status: inv.Balance === 0 ? 'paid' : (new Date(inv.DueDate) < new Date() && inv.Balance > 0 ? 'overdue' : 'pending'),
          customer: inv.CustomerName,
          reference: inv.ExternalInvoiceReference1,
          fiscalYear: new Date(inv.InvoiceDate).getFullYear().toString()
        }));

        allDocuments = [...allDocuments, ...invoiceDocuments];
      }

      // Fetch supplier invoice payments from Fortnox (this endpoint works!)
      try {
        const supplierPaymentsParams = new URLSearchParams();
        if (fromDate) supplierPaymentsParams.append('from_date', fromDate);
        if (toDate) supplierPaymentsParams.append('to_date', toDate);
        
        const supplierPaymentsResponse = await fetch(`/api/fortnox/supplierinvoicepayments?${supplierPaymentsParams.toString()}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (supplierPaymentsResponse.ok) {
          const supplierPaymentsData = await supplierPaymentsResponse.json();
          const supplierPayments = supplierPaymentsData.SupplierInvoicePayments || [];
          
          console.log('Supplier payments data received:', supplierPaymentsData);
          console.log('First supplier payment:', supplierPayments[0]);
          
          // Transform supplier invoice payments to bookkeeping documents
          const supplierPaymentDocuments: BookkeepingDocument[] = supplierPayments.map((payment: any) => ({
            id: `supplier-payment-${payment.Number}`,
            type: 'payment' as const,
            documentNumber: payment.Number.toString(),
            date: payment.PaymentDate,
            amount: parseFloat(payment.Amount || 0),
            currency: payment.Currency || 'SEK',
            description: `Payment for Invoice ${payment.InvoiceNumber}`,
            status: payment.Booked ? 'completed' : 'pending',
            supplier: 'Supplier Payment',
            reference: payment.InvoiceNumber,
            fiscalYear: new Date(payment.PaymentDate).getFullYear().toString()
          }));

          allDocuments = [...allDocuments, ...supplierPaymentDocuments];
        }
      } catch (error) {
        console.error('Error fetching supplier invoice payments:', error);
        // Don't show error toast for supplier payments as it's not critical
      }

      // Fetch vouchers from Fortnox (all years for analysis)
      try {
        const vouchersParams = new URLSearchParams();
        if (fromDate) vouchersParams.append('from_date', fromDate);
        if (toDate) vouchersParams.append('to_date', toDate);
        
        const vouchersResponse = await fetch(`/api/fortnox/vouchers?${vouchersParams.toString()}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (vouchersResponse.ok) {
          const vouchersData = await vouchersResponse.json();
          const vouchers = vouchersData.Vouchers || [];
          
          console.log('Vouchers data received:', vouchersData);
          console.log('First voucher:', vouchers[0]);
          
          // Transform vouchers to bookkeeping documents
          const voucherDocuments: BookkeepingDocument[] = vouchers.map((voucher: any) => {
            // For basic voucher data, we might not have VoucherRows
            // Let's use the available fields and set amount based on what's available
            let totalAmount = 0;
            
            // Try different possible amount fields from the Fortnox API
            if (voucher.Total) {
              totalAmount = parseFloat(voucher.Total.toString()) || 0;
            } else if (voucher.Amount) {
              totalAmount = parseFloat(voucher.Amount.toString()) || 0;
            } else if (voucher.VoucherRows && Array.isArray(voucher.VoucherRows)) {
              // Sum all debit amounts (or credit amounts - they should be equal)
              totalAmount = voucher.VoucherRows.reduce((sum: number, row: any) => {
                const debit = parseFloat(row.Debit || 0);
                return sum + debit;
              }, 0);
            } else {
              // If no amount is available, set to 0 for now
              totalAmount = 0;
            }

            return {
              id: `voucher-${voucher.VoucherSeries}-${voucher.VoucherNumber}`,
              type: 'voucher' as const,
              documentNumber: `${voucher.VoucherSeries}${voucher.VoucherNumber}`,
              date: voucher.TransactionDate || voucher.VoucherDate,
              amount: totalAmount,
              currency: 'SEK',
              description: voucher.Description || `Voucher ${voucher.VoucherSeries}${voucher.VoucherNumber}`,
              status: 'processed',
              reference: voucher.ReferenceNumber || voucher.ExternalReference,
              fiscalYear: voucher.FiscalYear || new Date(voucher.TransactionDate || voucher.VoucherDate).getFullYear().toString()
            };
          });

          allDocuments = [...allDocuments, ...voucherDocuments];
        }
      } catch (error) {
        console.error('Error fetching vouchers:', error);
        // Don't show error toast for vouchers as it's not critical
      }

      // Sort by date (newest first)
      allDocuments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Calculate yearly financial analysis
      const financialAnalysis = calculateYearlyFinancials(allDocuments);
      setYearlyFinancials(financialAnalysis);

      setDocuments(allDocuments);

      if (allDocuments.length === 0) {
        toast.error('No documents found. Please check your Fortnox connection.');
      }

    } catch (error) {
      console.error('Error fetching bookkeeping documents:', error);
      toast.error('Failed to load bookkeeping documents');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    try {
      await fetchBookkeepingDocuments(startDate, endDate);
      toast.success('Data refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const exportData = () => {
    const csvContent = [
      ['Type', 'Document Number', 'Date', 'Amount', 'Currency', 'Description', 'Status', 'Customer/Supplier'],
      ...filteredDocuments.map(doc => [
        doc.type,
        doc.documentNumber,
        doc.date,
        doc.amount.toString(),
        doc.currency,
        doc.description,
        doc.status,
        doc.customer || doc.supplier || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookkeeping-documents-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number, currency: string = 'SEK') => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
      case 'paid':
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'approved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return <Receipt className="h-4 w-4 text-blue-500" />;
      case 'supplier_invoice':
        return <Receipt className="h-4 w-4 text-purple-500" />;
      case 'payment':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      case 'expense':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'receipt':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'voucher':
        return <FileText className="h-4 w-4 text-orange-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'invoice':
        return 'Invoice';
      case 'supplier_invoice':
        return 'Supplier Invoice';
      case 'payment':
        return 'Supplier Payment';
      case 'expense':
        return 'Expense';
      case 'receipt':
        return 'Receipt';
      case 'voucher':
        return 'Voucher';
      default:
        return 'Document';
    }
  };

  if (loading) {
    return (
      <SidebarDemo>
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </SidebarDemo>
    );
  }

  return (
    <SidebarDemo>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/finances"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Finance
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Bookkeeping Documents</h1>
              <p className="text-muted-foreground">All financial documents from Fortnox</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-4">
              <Button
                onClick={() => setViewMode('documents')}
                variant={viewMode === 'documents' ? 'default' : 'outline'}
                size="sm"
              >
                <FileText className="h-4 w-4 mr-2" />
                Documents
              </Button>
              <Button
                onClick={() => setViewMode('analysis')}
                variant={viewMode === 'analysis' ? 'default' : 'outline'}
                size="sm"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Analysis
              </Button>
            </div>
            <Button
              onClick={exportData}
              variant="outline"
              size="sm"
              disabled={filteredDocuments.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              onClick={refreshData}
              disabled={refreshing}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Sync Data
            </Button>
          </div>
        </div>

        {viewMode === 'documents' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Documents</p>
                    <p className="text-2xl font-bold">{documents.length}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Receipt className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Invoices</p>
                    <p className="text-2xl font-bold">
                      {documents.filter(d => d.type === 'invoice').length}
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <TrendingDown className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Supplier Invoices</p>
                    <p className="text-2xl font-bold">
                      {documents.filter(d => d.type === 'supplier_invoice').length}
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <TrendingDown className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Payments</p>
                    <p className="text-2xl font-bold">
                      {documents.filter(d => d.type === 'payment').length}
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Vouchers</p>
                    <p className="text-2xl font-bold">
                      {documents.filter(d => d.type === 'voucher').length}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}

        {viewMode === 'analysis' && (
          <>
            {/* Financial Analysis */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-6">Year-over-Year Financial Analysis</h2>
              
              {/* Charts Section */}
              {yearlyFinancials.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* Revenue vs Expenses Bar Chart */}
                  <Card className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="h-5 w-5 text-blue-500" />
                      <h3 className="text-lg font-semibold">Money In vs Money Out</h3>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={prepareChartData(yearlyFinancials)}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis 
                            dataKey="year" 
                            tick={{ fontSize: 12 }}
                            className="text-muted-foreground"
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }}
                            className="text-muted-foreground"
                            tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                          />
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              formatCurrencyValue(value),
                              name === 'revenue' ? 'Revenue (Money In)' : 
                              name === 'expenses' ? 'Expenses (Money Out)' : 'Net Profit'
                            ]}
                            labelFormatter={(label) => `Year ${label}`}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '6px'
                            }}
                          />
                          <Legend 
                            formatter={(value) => 
                              value === 'revenue' ? 'Money In (Revenue)' : 
                              value === 'expenses' ? 'Money Out (Expenses)' : 'Net Profit'
                            }
                          />
                          <Bar dataKey="revenue" fill="#22c55e" name="revenue" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="expenses" fill="#ef4444" name="expenses" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* Profit Trend Line Chart */}
                  <Card className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      <h3 className="text-lg font-semibold">Profit Trend</h3>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={prepareChartData(yearlyFinancials)}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis 
                            dataKey="year" 
                            tick={{ fontSize: 12 }}
                            className="text-muted-foreground"
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }}
                            className="text-muted-foreground"
                            tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                          />
                          <Tooltip 
                            formatter={(value: number) => [formatCurrencyValue(value), 'Net Profit']}
                            labelFormatter={(label) => `Year ${label}`}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '6px'
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="profit" 
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* Current Year Expense Breakdown */}
                  <Card className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <PieChart className="h-5 w-5 text-purple-500" />
                      <h3 className="text-lg font-semibold">Current Year Expenses Breakdown</h3>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Tooltip 
                            formatter={(value: number, name: string) => [formatCurrencyValue(value), name]}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '6px'
                            }}
                          />
                          <Legend />
                          <Pie
                            data={prepareExpenseBreakdownData(documents)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={120}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {prepareExpenseBreakdownData(documents).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* Financial Summary Cards */}
                  <Card className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-5 w-5 text-blue-500" />
                      <h3 className="text-lg font-semibold">Financial Summary</h3>
                    </div>
                    <div className="space-y-4">
                      {(() => {
                        const currentYear = new Date().getFullYear().toString();
                        const currentYearData = yearlyFinancials.find(y => y.year === currentYear);
                        const previousYearData = yearlyFinancials.find(y => y.year === (parseInt(currentYear) - 1).toString());
                        
                        if (!currentYearData) return <p className="text-muted-foreground">No data for current year</p>;
                        
                        const revenueGrowth = previousYearData && previousYearData.revenue > 0 
                          ? ((currentYearData.revenue - previousYearData.revenue) / previousYearData.revenue) * 100 
                          : 0;
                        const expenseGrowth = previousYearData && previousYearData.expenses > 0 
                          ? ((currentYearData.expenses - previousYearData.expenses) / previousYearData.expenses) * 100 
                          : 0;
                        
                        return (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Current Year Revenue</span>
                              <div className="text-right">
                                <span className="font-medium text-green-600">{formatCurrency(currentYearData.revenue)}</span>
                                {revenueGrowth !== 0 && (
                                  <div className={`text-xs ${revenueGrowth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {revenueGrowth > 0 ? '↗' : '↘'} {Math.abs(revenueGrowth).toFixed(1)}%
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Current Year Expenses</span>
                              <div className="text-right">
                                <span className="font-medium text-red-600">{formatCurrency(currentYearData.expenses)}</span>
                                {expenseGrowth !== 0 && (
                                  <div className={`text-xs ${expenseGrowth > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {expenseGrowth > 0 ? '↗' : '↘'} {Math.abs(expenseGrowth).toFixed(1)}%
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t">
                              <span className="text-sm font-medium">Net Profit</span>
                              <span className={`font-bold ${currentYearData.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(currentYearData.profit)}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </Card>
                </div>
              )}
              
              {/* Yearly Financial Summary */}
              <div className="grid gap-6">
                {yearlyFinancials.map((yearData) => (
                  <Card key={yearData.year} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">{yearData.year}</h3>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        yearData.profit >= 0 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {yearData.profit >= 0 ? 'Profit' : 'Loss'}: {formatCurrency(Math.abs(yearData.profit))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Revenue */}
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-green-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Revenue</p>
                          <p className="text-xl font-bold text-green-600">{formatCurrency(yearData.revenue)}</p>
                          <p className="text-xs text-muted-foreground">{yearData.invoiceCount} invoices</p>
                        </div>
                      </div>
                      
                      {/* Expenses */}
                      <div className="flex items-center gap-3">
                        <TrendingDown className="h-8 w-8 text-red-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Expenses</p>
                          <p className="text-xl font-bold text-red-600">{formatCurrency(yearData.expenses)}</p>
                          <p className="text-xs text-muted-foreground">
                            {yearData.supplierInvoiceCount} supplier invoices, {yearData.voucherCount} vouchers
                          </p>
                        </div>
                      </div>
                      
                      {/* Documents */}
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Total Documents</p>
                          <p className="text-xl font-bold">{yearData.totalDocuments}</p>
                          <p className="text-xs text-muted-foreground">All document types</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Profit Margin */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Profit Margin</span>
                        <span className={`font-medium ${
                          yearData.revenue > 0 && (yearData.profit / yearData.revenue) >= 0.1
                            ? 'text-green-600'
                            : yearData.revenue > 0 && (yearData.profit / yearData.revenue) >= 0
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}>
                          {yearData.revenue > 0 ? `${((yearData.profit / yearData.revenue) * 100).toFixed(1)}%` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
                
                {yearlyFinancials.length === 0 && (
                  <Card className="p-8 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Financial Data</h3>
                    <p className="text-muted-foreground">
                      No documents found for financial analysis. Please sync your Fortnox data.
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}

        {viewMode === 'documents' && (
          <>
            {/* Filters */}
            <Card className="p-6 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search documents..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Document Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="invoice">Invoices</SelectItem>
                    <SelectItem value="supplier_invoice">Supplier Invoices</SelectItem>
                    <SelectItem value="payment">Supplier Payments</SelectItem>
                    <SelectItem value="expense">Expenses</SelectItem>
                    <SelectItem value="receipt">Receipts</SelectItem>
                    <SelectItem value="voucher">Vouchers</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-[140px]"
                    placeholder="From date"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-[140px]"
                    placeholder="To date"
                  />
                  <Button 
                    onClick={() => fetchBookkeepingDocuments(startDate, endDate)} 
                    disabled={loading}
                    size="sm"
                  >
                    {loading ? 'Fetching...' : 'Fetch'}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Documents Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Document Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Customer/Supplier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.length > 0 ? (
                    filteredDocuments.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(doc.type)}
                            <span className="text-sm font-medium">
                              {getTypeLabel(doc.type)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {doc.documentNumber}
                        </TableCell>
                        <TableCell>
                          {new Date(doc.date).toLocaleDateString('sv-SE')}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {doc.description}
                        </TableCell>
                        <TableCell>
                          {doc.customer || doc.supplier || '-'}
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency(doc.amount, doc.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(doc.status)}>
                            {doc.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {doc.type === 'invoice' && (
                              <Link href={`/invoices?search=${doc.documentNumber}`}>
                                <Button size="sm" variant="ghost">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No documents found</p>
                        <p className="text-sm mt-1">
                          {documents.length === 0 
                            ? "Connect Fortnox to sync your bookkeeping documents"
                            : "Try adjusting your search filters"
                          }
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </SidebarDemo>
  );
} 