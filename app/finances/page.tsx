'use client';

import { useEffect, useState, useCallback } from 'react';
import { SidebarDemo } from '@/components/ui/code.demo';
import { PageTitle } from '@/components/ui/page-title';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  Receipt, 
  AlertCircle, 
  Calendar, 
  ArrowRight,
  RefreshCw,
  Download,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/lib/auth-client';
import { toast } from 'sonner';
import Link from 'next/link';

interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  outstandingInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  averageInvoiceValue: number;
}

interface BookkeepingDocument {
  id: string;
  type: 'invoice' | 'expense' | 'receipt' | 'voucher';
  documentNumber: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  status: 'pending' | 'approved' | 'processed';
  supplier?: string;
  customer?: string;
}

export default function FinancesPage() {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    outstandingInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
    averageInvoiceValue: 0
  });
  const [recentDocuments, setRecentDocuments] = useState<BookkeepingDocument[]>([]);
  const [fortnoxConnected, setFortnoxConnected] = useState(false);

  const fetchFinancialData = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      setLoading(true);
      const headers = {
        'Authorization': `Bearer ${session.access_token}`
      };

      // Check Fortnox connection status
      const fortnoxResponse = await fetch('/api/fortnox/status', { headers });
      
      if (fortnoxResponse.ok) {
        const fortnoxData = await fortnoxResponse.json();
        setFortnoxConnected(fortnoxData.connected);
      }

      // Fetch financial summary from invoices
      const invoicesResponse = await fetch('/api/fortnox/invoices', { headers });
      
      // Fetch supplier payments
      const paymentsResponse = await fetch('/api/fortnox/supplierinvoicepayments', { headers });

      let allDocuments: BookkeepingDocument[] = [];
      let totalRevenue = 0;
      let outstandingAmount = 0;
      let paidCount = 0;
      let overdueCount = 0;
      let totalExpenses = 0;

      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json();
        const invoices = invoicesData.Invoices || [];
        
        totalRevenue = invoices.reduce((sum: number, inv: any) => sum + (inv.Total || 0), 0);
        outstandingAmount = invoices.reduce((sum: number, inv: any) => sum + (inv.Balance || 0), 0);
        paidCount = invoices.filter((inv: any) => inv.Balance === 0).length;
        overdueCount = invoices.filter((inv: any) => {
          const dueDate = new Date(inv.DueDate);
          return inv.Balance > 0 && dueDate < new Date();
        }).length;

        const recentInvoices = invoices.map((inv: any) => ({
          id: inv.DocumentNumber,
          type: 'invoice' as const,
          documentNumber: inv.DocumentNumber,
          date: inv.InvoiceDate,
          amount: inv.Total,
          currency: inv.Currency || 'SEK',
          description: `Invoice to ${inv.CustomerName}`,
          status: inv.Balance === 0 ? 'processed' : 'pending',
          customer: inv.CustomerName
        }));
        allDocuments.push(...recentInvoices);
      }

      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        const payments = paymentsData.SupplierInvoicePayments || [];
        totalExpenses = payments.reduce((sum: number, p: any) => sum + p.Amount, 0);

        const recentPayments = payments.map((p: any) => ({
          id: p.Number,
          type: 'expense' as const,
          documentNumber: p.Number,
          date: p.PaymentDate,
          amount: p.Amount,
          currency: p.Currency || 'SEK',
          description: `Payment for invoice ${p.InvoiceNumber}`,
          status: 'processed' as const,
          supplier: p.SupplierName // Assuming SupplierName is available
        }));
        allDocuments.push(...recentPayments);
      }
      
      // Sort all documents by date, descending
      allDocuments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setSummary({
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue + totalExpenses, // Expenses are negative
        outstandingInvoices: outstandingAmount,
        paidInvoices: paidCount,
        overdueInvoices: overdueCount,
        averageInvoiceValue: totalRevenue > 0 && paidCount > 0 ? totalRevenue / paidCount : 0
      });

      setRecentDocuments(allDocuments.slice(0, 5));

    } catch (error) {
      console.error('Error fetching financial data:', error);
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (user) {
      fetchFinancialData();
    }
  }, [user, fetchFinancialData]);

  const refreshFortnoxData = async () => {
    if (!session?.access_token) return;
    setRefreshing(true);
    try {
      const response = await fetch('/api/fortnox/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        toast.success('Fortnox data synced successfully');
        await fetchFinancialData();
      } else {
        toast.error('Failed to sync Fortnox data');
      }
    } catch (error) {
      toast.error('Error syncing Fortnox data');
    } finally {
      setRefreshing(false);
    }
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
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'approved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return <Receipt className="h-4 w-4" />;
      case 'expense':
        return <TrendingDown className="h-4 w-4" />;
      case 'receipt':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
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
          <PageTitle 
            title="Finance Dashboard" 
            subtitle="Manage your bookkeeping, invoices, and financial data" 
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={refreshFortnoxData}
              disabled={refreshing || !fortnoxConnected}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Sync Fortnox
            </Button>
            {!fortnoxConnected && (
              <Link href="/integrations/fortnox">
                <Button size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect Fortnox
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Financial Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <h3 className="text-2xl font-bold mt-2">{formatCurrency(summary.totalRevenue)}</h3>
              </div>
              <div className="p-3 bg-green-500/10 rounded-full">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
                <h3 className="text-2xl font-bold mt-2">{formatCurrency(summary.outstandingInvoices)}</h3>
              </div>
              <div className="p-3 bg-yellow-500/10 rounded-full">
                <DollarSign className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paid Invoices</p>
                <h3 className="text-2xl font-bold mt-2">{summary.paidInvoices}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Receipt className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <h3 className="text-2xl font-bold mt-2 text-red-600">{summary.overdueInvoices}</h3>
              </div>
              <div className="p-3 bg-red-500/10 rounded-full">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="documents">Recent Documents</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quick Actions */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Link href="/invoices" className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <Receipt className="h-5 w-5 text-blue-500" />
                      <span>Manage Invoices</span>
                    </div>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  

                  

                </div>
              </Card>

              {/* Connection Status */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Integration Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${fortnoxConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span>Fortnox</span>
                    </div>
                    <Badge variant={fortnoxConnected ? 'default' : 'destructive'}>
                      {fortnoxConnected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                  
                  {!fortnoxConnected && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            Fortnox Not Connected
                          </p>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            Connect your Fortnox account to automatically sync bookkeeping documents and invoices.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Recent Documents</h3>
                <Link href="/finances/bookkeeping">
                  <Button variant="outline" size="sm">
                    View All
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
              
              <div className="space-y-3">
                {recentDocuments.length > 0 ? (
                  recentDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded-full">
                          {getDocumentIcon(doc.type)}
                        </div>
                        <div>
                          <p className="font-medium">{doc.documentNumber}</p>
                          <p className="text-sm text-muted-foreground">{doc.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(doc.date).toLocaleDateString()}
        </p>
      </div>
    </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(doc.amount, doc.currency)}</p>
                        <Badge className={`text-xs ${getStatusColor(doc.status)}`}>
                          {doc.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No recent documents found</p>
                    <p className="text-sm mt-1">Connect Fortnox to automatically sync your bookkeeping documents</p>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Financial Reports</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="p-6 h-auto flex flex-col items-start">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Profit & Loss</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">
                    View your revenue, expenses, and net income over time
                  </p>
                </Button>
                
                <Button variant="outline" className="p-6 h-auto flex flex-col items-start">
                  <div className="flex items-center gap-3 mb-2">
                    <Receipt className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Invoice Report</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">
                    Detailed analysis of your invoicing patterns and payment status
                  </p>
                </Button>
                
                <Button variant="outline" className="p-6 h-auto flex flex-col items-start">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">Cash Flow</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">
                    Track money coming in and going out of your business
                  </p>
                </Button>
                
                <Button variant="outline" className="p-6 h-auto flex flex-col items-start">
                  <div className="flex items-center gap-3 mb-2">
                    <Download className="h-5 w-5 text-orange-500" />
                    <span className="font-medium">Export Data</span>
                  </div>
                  <p className="text-sm text-muted-foreground text-left">
                    Download your financial data for external analysis
                  </p>
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarDemo>
  );
} 