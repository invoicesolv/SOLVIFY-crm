'use client';

import { useEffect, useState } from 'react';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Mail, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useSession } from 'next-auth/react';
import { createClient } from '@supabase/supabase-js';

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
  CustomerEmail?: string;
}

interface ReminderTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: true,
    }
  }
);

export default function InvoiceRemindersPage() {
  const { data: session } = useSession()
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([
    {
      id: 'default',
      name: 'Default Reminder',
      subject: 'Invoice Payment Reminder',
      body: `Dear {customerName},

We hope this email finds you well. This is a friendly reminder that invoice {invoiceNumber} for {amount} {currency} is currently overdue.

Due Date: {dueDate}

Please process the payment at your earliest convenience. If you have already made the payment, please disregard this reminder.

Best regards,
Your Company Name`
    },
    {
      id: 'final',
      name: 'Final Notice',
      subject: 'Final Payment Notice - Invoice {invoiceNumber}',
      body: `Dear {customerName},

This is a final notice regarding the outstanding payment for invoice {invoiceNumber} for {amount} {currency}, which was due on {dueDate}.

Please arrange for immediate payment to avoid any further action.

Best regards,
Your Company Name`
    }
  ]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReminderTemplate['id']>('default');
  const [customMessage, setCustomMessage] = useState<string>('');

  useEffect(() => {
    fetchUnpaidInvoices();
  }, []);

  const fetchUnpaidInvoices = async () => {
    try {
      if (!session?.user?.id) {
        toast.error('Please sign in to view unpaid invoices');
        return;
      }

      // Log session details for debugging
      console.log('Session details:', {
        user: session.user,
        hasAccessToken: !!session.access_token
      });

      // First get the user's workspaces
      const { data: teamMemberships, error: teamError } = await supabaseAdmin
        .from('team_members')
        .select(`
          workspace_id,
          workspaces (
            id,
            name
          )
        `)
        .eq('user_id', session.user.id);

      if (teamError) {
        console.error('Error fetching team memberships:', teamError);
        throw new Error('Failed to load workspace access');
      }

      if (!teamMemberships?.length) {
        console.log('No workspaces found for user');
        setUnpaidInvoices([]);
        setLoading(false);
        return;
      }

      const workspaceIds = teamMemberships.map(tm => tm.workspace_id);
      console.log('Found workspaces:', workspaceIds);
      
      // Fetch unpaid invoices with customer names and currency codes
      const { data: invoicesData, error: invoicesError } = await supabaseAdmin
        .from('invoices')
        .select(`
          *,
          customers (name, email),
          currencies (code),
          invoice_types (name)
        `)
        .eq('user_id', session.user.id)
        .in('workspace_id', workspaceIds)
        .gt('balance', 0); // Only get invoices with balance > 0

      if (invoicesError) {
        console.error('Error fetching unpaid invoices:', invoicesError);
        throw invoicesError;
      }

      console.log('Fetched unpaid invoices count:', invoicesData?.length || 0);

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
        ExternalInvoiceReference1: invoice.external_reference || '',
        CustomerEmail: invoice.customers?.email || ''
      }));

      setUnpaidInvoices(processedInvoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load unpaid invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedInvoices(checked ? unpaidInvoices.map(inv => inv.DocumentNumber) : []);
  };

  const handleSelectInvoice = (documentNumber: string, checked: boolean) => {
    setSelectedInvoices(prev => 
      checked 
        ? [...prev, documentNumber]
        : prev.filter(num => num !== documentNumber)
    );
  };

  const sendReminders = async () => {
    if (selectedInvoices.length === 0) {
      toast.error('Please select at least one invoice');
      return;
    }

    if (!session?.user?.id) {
      toast.error('Please sign in to send reminders');
      return;
    }

    setSending(true);
    try {
      // Get the user's default workspace
      const { data: teamMemberships, error: teamError } = await supabaseAdmin
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', session.user.id)
        .limit(1);

      if (teamError) throw teamError;
      if (!teamMemberships?.length) {
        toast.error('No workspace found. Please create or join a workspace first.');
        return;
      }

      const workspaceId = teamMemberships[0].workspace_id;

      const selectedTemplateId = selectedTemplate;
      const template = templates.find(t => t.id === selectedTemplateId);
      const messageToSend = customMessage || template?.body || '';

      const response = await fetch('http://localhost:5001/send-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoices: selectedInvoices,
          message: messageToSend,
          template: selectedTemplateId,
          workspaceId: workspaceId
        }),
      });

      if (!response.ok) throw new Error('Failed to send reminders');
      
      toast.success('Reminders sent successfully');
      setSelectedInvoices([]);
    } catch (error) {
      console.error('Error sending reminders:', error);
      toast.error('Failed to send reminders');
    } finally {
      setSending(false);
    }
  };

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/invoices"
              className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Invoices
            </Link>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-white">Invoice Reminders</h1>
              <p className="text-sm text-neutral-400">
                Send payment reminders for unpaid invoices
              </p>
            </div>
          </div>
        </div>

        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedInvoices.length === unpaidInvoices.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-neutral-400">
                  Select All ({unpaidInvoices.length} unpaid invoices)
                </span>
              </div>
              <Button
                onClick={sendReminders}
                disabled={selectedInvoices.length === 0 || sending}
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                {sending ? 'Sending...' : 'Send Reminders'}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-400">
                  Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-white"
                >
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-400">
                  Custom Message (Optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Enter a custom message or leave blank to use the template..."
                  className="w-full h-40 px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
              </div>
            </div>

            <div className="border-t border-neutral-700 pt-4">
              <div className="space-y-4">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-400"></div>
                  </div>
                ) : unpaidInvoices.length === 0 ? (
                  <div className="text-center py-8 text-neutral-400">
                    No unpaid invoices found
                  </div>
                ) : (
                  unpaidInvoices.map((invoice) => (
                    <div
                      key={invoice.DocumentNumber}
                      className="flex items-center justify-between p-4 bg-neutral-900 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={selectedInvoices.includes(invoice.DocumentNumber)}
                          onCheckedChange={(checked) => 
                            handleSelectInvoice(invoice.DocumentNumber, checked as boolean)
                          }
                        />
                        <div>
                          <p className="text-white font-medium">
                            {invoice.CustomerName}
                          </p>
                          <p className="text-sm text-neutral-400">
                            Invoice #{invoice.DocumentNumber} - Due: {new Date(invoice.DueDate).toLocaleDateString('sv-SE')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-medium">
                          {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: invoice.Currency })
                            .format(invoice.Balance)}
                        </p>
                        <p className="text-sm text-neutral-400">
                          {new Date(invoice.DueDate) < new Date() ? 'Overdue' : 'Due soon'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </SidebarDemo>
  );
} 