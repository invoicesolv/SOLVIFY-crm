'use client';

import { useEffect, useState } from 'react';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Filter, ArrowUpDown, Mail, Save, RefreshCw, Copy, Send, TestTube } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-client';
import { createClient } from '@supabase/supabase-js';

interface RecurringInvoice {
  id: string;
  original_invoice_id: string;
  customer_id: string;
  customer_name: string;
  next_invoice_date: string;
  total: number;
  currency_id: string | null;
  invoice_type_id: string | null;
  payment_method_id: string | null;
  status: 'draft' | 'pending' | 'sent_to_finance' | 'test_sent';
}

export default function RecurringInvoicesPage() {
  const { user, session } = useAuth();
  const router = useRouter();
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([]);
  const [originalInvoices, setOriginalInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create authenticated Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      },
    }
  );

  useEffect(() => {
    if (user?.id && session?.access_token) {
      fetchRecurringInvoices();
      fetchOriginalInvoices();
    }
  }, [user?.id, session?.access_token]);

  const fetchRecurringInvoices = async () => {
    try {
      if (!user?.id || !session?.access_token) {
        toast.error('Please sign in to view recurring invoices');
        return;
      }

      // Get the recurring invoices with customer data - RLS will automatically filter by workspace
      const { data: recurringData, error: recurringError } = await supabase
        .from('recurring_invoices')
        .select(`
          *,
          customers (
            id,
            name
          )
        `);

      if (recurringError) throw recurringError;

      const formattedData = recurringData.map(invoice => ({
        ...invoice,
        customer_name: invoice.customers?.name || 'Unknown Customer'
      }));

      setRecurringInvoices(formattedData);
    } catch (error) {
      console.error('Error fetching recurring invoices:', error);
      toast.error('Failed to fetch recurring invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchOriginalInvoices = async () => {
    try {
      if (!user?.id || !session?.access_token) {
        toast.error('Please sign in to view invoices');
        return;
      }

      // Get invoices with customer data - RLS will automatically filter by workspace
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (
            id,
            name
          )
        `);

      if (invoicesError) throw invoicesError;

      setOriginalInvoices(invoicesData);
    } catch (error) {
      console.error('Error fetching original invoices:', error);
      toast.error('Failed to fetch original invoices');
    }
  };

  const copyToRecurring = async (invoice: any) => {
    try {
      if (!user?.id || !session?.access_token) {
        toast.error('Please sign in to copy invoices');
        return;
      }

      // Get the customer ID from the customers object
      const customerId = invoice.customers?.id || invoice.customer_id;
      
      if (!customerId) {
        toast.error('No customer found for this invoice');
        return;
      }

      // First check if a recurring invoice already exists for this original invoice
      const { data: existingInvoice, error: checkError } = await supabase
        .from('recurring_invoices')
        .select('id')
        .eq('original_invoice_id', invoice.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing invoice:', checkError);
        toast.error('Failed to check existing recurring invoice');
        return;
      }

      if (existingInvoice) {
        toast.error('A recurring invoice already exists for this invoice');
        return;
      }

      // Create the recurring invoice
      const { data, error } = await supabase
        .from('recurring_invoices')
        .insert([{
          original_invoice_id: invoice.id,
          customer_id: customerId,
          next_invoice_date: new Date().toISOString().split('T')[0],
          total: invoice.total,
          currency_id: invoice.currency_id,
          invoice_type_id: invoice.invoice_type_id,
          payment_method_id: invoice.payment_method_id,
          status: 'draft'
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating recurring invoice:', error);
        if (error.code === '42501') {
          toast.error('Permission denied. Please check if you are properly authenticated.');
        } else {
          toast.error('Failed to create recurring invoice');
        }
        return;
      }

      toast.success('Invoice copied to recurring invoices');
      fetchRecurringInvoices();
    } catch (error) {
      console.error('Error copying invoice:', error);
      toast.error('Failed to copy invoice');
    }
  };

  const sendToFinance = async (invoice: RecurringInvoice) => {
    try {
      const { error } = await supabase
        .from('recurring_invoices')
        .update({ status: 'sent_to_finance' })
        .eq('id', invoice.id);

      if (error) throw error;
      toast.success('Invoice sent to finance');
      fetchRecurringInvoices();
    } catch (error) {
      console.error('Error sending to finance:', error);
      toast.error('Failed to send to finance');
    }
  };

  const sendTestInvoice = async (invoice: RecurringInvoice) => {
    try {
      if (!user?.id || !session?.access_token) {
        toast.error('Please sign in to send test invoice');
        return;
      }

      // Get the user's default workspace
      const { data: teamMemberships, error: teamError } = await supabase
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1);

      if (teamError) throw teamError;
      if (!teamMemberships?.length) {
        toast.error('No workspace found. Please create or join a workspace first.');
        return;
      }

      const workspaceId = teamMemberships[0].workspace_id;

      const { error } = await supabase
        .from('recurring_invoices')
        .update({ status: 'test_sent' })
        .eq('id', invoice.id)
        .eq('workspace_id', workspaceId);

      if (error) throw error;
      toast.success('Test invoice sent');
      fetchRecurringInvoices();
    } catch (error) {
      console.error('Error sending test invoice:', error);
      toast.error('Failed to send test invoice');
    }
  };

  if (loading) {
    return (
      <SidebarDemo>
        <div className="p-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-400"></div>
          </div>
        </div>
      </SidebarDemo>
    );
  }

  const filteredOriginalInvoices = originalInvoices.filter(invoice => 
    search === '' || 
    (invoice.document_number && invoice.document_number.toLowerCase().includes(search.toLowerCase())) ||
    (invoice.customer_name && invoice.customer_name.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredRecurringInvoices = recurringInvoices.filter(invoice =>
    search === '' ||
    (invoice.customer_name && invoice.customer_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Recurring Invoices</h1>
            <p className="text-sm text-muted-foreground">
              Manage your recurring invoice templates
            </p>
          </div>
          <Link href="/invoices">
            <Button variant="outline" className="flex items-center gap-2">
              Back to Invoices
            </Button>
          </Link>
        </div>

        {/* Search */}
        <Card className="bg-background border-border dark:border-border">
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground0" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border dark:border-border rounded-md text-sm text-foreground placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              />
            </div>
          </div>
        </Card>

        {/* Original Invoices */}
        <Card className="bg-background border-border dark:border-border">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Original Invoices</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border dark:border-border">
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Invoice Number</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Customer</th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">Total</th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-700">
                  {filteredOriginalInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-neutral-750 transition-colors">
                      <td className="py-4 px-6 text-sm text-foreground">{invoice.document_number}</td>
                      <td className="py-4 px-6 text-sm text-foreground">{invoice.customer_name || 'Unknown'}</td>
                      <td className="py-4 px-6 text-sm text-right text-foreground">
                        {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                          .format(invoice.total)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToRecurring(invoice)}
                          className="bg-background hover:bg-background"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy to Recurring
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Recurring Invoices */}
        <Card className="bg-background border-border dark:border-border">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">Recurring Invoices</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border dark:border-border">
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Customer</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Next Invoice Date</th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">Total</th>
                    <th className="text-center py-4 px-6 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-700">
                  {filteredRecurringInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-neutral-750 transition-colors">
                      <td className="py-4 px-6 text-sm text-foreground">{invoice.customer_name}</td>
                      <td className="py-4 px-6 text-sm text-muted-foreground">
                        {new Date(invoice.next_invoice_date).toLocaleDateString('sv-SE')}
                      </td>
                      <td className="py-4 px-6 text-sm text-right text-foreground">
                        {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                          .format(invoice.total)}
                      </td>
                      <td className="py-4 px-6 text-sm text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          invoice.status === 'draft' ? 'bg-gray-200 dark:bg-muted text-gray-800 dark:text-foreground' :
                          invoice.status === 'pending' ? 'bg-yellow-900 text-yellow-200' :
                          invoice.status === 'sent_to_finance' ? 'bg-green-900 text-green-200' :
                          'bg-blue-900 text-blue-200'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendToFinance(invoice)}
                          disabled={invoice.status === 'sent_to_finance'}
                          className="bg-background hover:bg-background"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Send to Finance
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendTestInvoice(invoice)}
                          disabled={invoice.status === 'test_sent'}
                          className="bg-background hover:bg-background"
                        >
                          <TestTube className="h-4 w-4 mr-2" />
                          Test Send
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </SidebarDemo>
  );
} 