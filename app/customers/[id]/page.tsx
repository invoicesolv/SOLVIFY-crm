"use client";

import { useEffect, useState } from "react";
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2 } from "lucide-react";
import { toast } from "sonner";

interface CustomerDetails {
  id: string;
  CustomerNumber: string;
  CustomerName: string;
  Email?: string;
  Phone?: string;
  Birthday?: string;
  Address?: string;
  ContactPerson?: string;
  Position?: string;
  Total: number;
  InvoiceCount: number;
  LastInvoiceDate: string;
  Invoices: Array<{
    DocumentNumber: string;
    InvoiceDate: string;
    Total: number;
    Currency: string;
    DueDate: string;
    Balance: number;
  }>;
}

export default function CustomerPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    email: string;
    phone: string;
    birthday: string;
    address: string;
    contactPerson: string;
    position: string;
  }>({
    name: '',
    email: '',
    phone: '',
    birthday: '',
    address: '',
    contactPerson: '',
    position: ''
  });

  useEffect(() => {
    async function fetchCustomerDetails() {
      if (!session?.user?.id) return;
      
      try {
        // Log the user ID for debugging
        console.log('Fetching customer details for user ID:', session.user.id);
        console.log('Customer ID:', params.id);
        
        // Fetch customer from Supabase
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', params.id)
          .eq('user_id', session.user.id)
          .single();

        if (customerError) {
          console.error('Error fetching customer:', customerError);
          throw customerError;
        }

        console.log('Fetched customer data:', customerData);

        // Fetch customer's invoices
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('invoices')
          .select(`
            *,
            currencies(code)
          `)
          .eq('customer_id', params.id)
          .eq('user_id', session.user.id);

        if (invoicesError) {
          console.error('Error fetching customer invoices:', invoicesError);
          throw invoicesError;
        }

        console.log('Fetched customer invoices:', invoicesData?.length || 0);

        // Calculate totals and process data
        const total = invoicesData.reduce((sum, invoice) => sum + invoice.total, 0);
        const lastInvoice = invoicesData.sort((a, b) => 
          new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
        )[0];

        // Transform the data to match the expected format
        const customerDetails: CustomerDetails = {
          id: customerData.id,
          CustomerNumber: customerData.id,
          CustomerName: customerData.name,
          Email: customerData.email,
          Phone: customerData.phone,
          Birthday: customerData.birthday,
          Address: customerData.address,
          ContactPerson: customerData.contact_person,
          Position: customerData.position,
          Total: total,
          InvoiceCount: invoicesData.length,
          LastInvoiceDate: lastInvoice ? lastInvoice.invoice_date : customerData.created_at,
          Invoices: invoicesData.map(invoice => ({
            DocumentNumber: invoice.document_number,
            InvoiceDate: invoice.invoice_date,
            Total: invoice.total,
            Currency: invoice.currencies?.code || 'SEK',
            DueDate: invoice.due_date,
            Balance: invoice.balance
          }))
        };

        setCustomer(customerDetails);
      } catch (err) {
        console.error('Error in fetchCustomerDetails:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch customer details'));
      } finally {
        setLoading(false);
      }
    }

    fetchCustomerDetails();
  }, [params.id, session]);

  const handleEdit = () => {
    setEditForm({
      name: customer?.CustomerName || '',
      email: customer?.Email || '',
      phone: customer?.Phone || '',
      birthday: customer?.Birthday || '',
      address: customer?.Address || '',
      contactPerson: customer?.ContactPerson || '',
      position: customer?.Position || ''
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!session?.user?.id || !customer) return;

    try {
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone,
          birthday: editForm.birthday,
          address: editForm.address,
          contact_person: editForm.contactPerson,
          position: editForm.position
        })
        .eq('id', customer.id)
        .eq('user_id', session.user.id);

      if (updateError) throw updateError;

      // Update local state
      setCustomer({
        ...customer,
        CustomerName: editForm.name,
        Email: editForm.email,
        Phone: editForm.phone,
        Birthday: editForm.birthday,
        Address: editForm.address,
        ContactPerson: editForm.contactPerson,
        Position: editForm.position
      });

      setIsEditing(false);
      toast.success('Customer details updated successfully');
    } catch (err) {
      console.error('Error updating customer:', err);
      toast.error('Failed to update customer details');
    }
  };

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/customers"
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Customers
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-400"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-neutral-400">
            Failed to load customer details. Please try again later.
          </div>
        ) : customer ? (
          <>
            <Card className="bg-neutral-800 border-neutral-700 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-semibold text-white">{customer.CustomerName}</h1>
                    <Button
                      onClick={handleEdit}
                      className="flex items-center gap-2 px-3 py-2 bg-neutral-700 hover:bg-neutral-600"
                      disabled={isEditing}
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-neutral-300">Name</label>
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="mt-1 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 focus:border-neutral-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-neutral-300">Contact Person</label>
                        <Input
                          value={editForm.contactPerson}
                          onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                          className="mt-1 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 focus:border-neutral-500"
                          placeholder="Primary contact person"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-neutral-300">Position</label>
                        <Input
                          value={editForm.position}
                          onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                          className="mt-1 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 focus:border-neutral-500"
                          placeholder="Contact person's position"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-neutral-300">Email</label>
                        <Input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="mt-1 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 focus:border-neutral-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-neutral-300">Phone</label>
                        <Input
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="mt-1 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 focus:border-neutral-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-neutral-300">Birthday</label>
                        <Input
                          type="date"
                          value={editForm.birthday}
                          onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                          className="mt-1 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 focus:border-neutral-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-neutral-300">Address</label>
                        <Input
                          value={editForm.address}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          className="mt-1 bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 focus:border-neutral-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSave}
                          className="bg-blue-600 hover:bg-blue-500"
                        >
                          Save Changes
                        </Button>
                        <Button
                          onClick={() => setIsEditing(false)}
                          className="bg-neutral-700 hover:bg-neutral-600"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <p className="text-neutral-400">Customer Number: <span className="text-white">{customer.CustomerNumber}</span></p>
                      {customer.ContactPerson && <p className="text-neutral-400">Contact Person: <span className="text-white">{customer.ContactPerson}</span></p>}
                      {customer.Position && <p className="text-neutral-400">Position: <span className="text-white">{customer.Position}</span></p>}
                      {customer.Email && <p className="text-neutral-400">Email: <span className="text-white">{customer.Email}</span></p>}
                      {customer.Phone && <p className="text-neutral-400">Phone: <span className="text-white">{customer.Phone}</span></p>}
                      {customer.Birthday && <p className="text-neutral-400">Birthday: <span className="text-white">{new Date(customer.Birthday).toLocaleDateString()}</span></p>}
                      {customer.Address && <p className="text-neutral-400">Address: <span className="text-white">{customer.Address}</span></p>}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-neutral-700 border-neutral-600 p-4">
                    <p className="text-sm text-neutral-400">Total Revenue</p>
                    <p className="text-xl font-semibold text-white mt-1">
                      {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                        .format(customer.Total)}
                    </p>
                  </Card>
                  <Card className="bg-neutral-700 border-neutral-600 p-4">
                    <p className="text-sm text-neutral-400">Total Invoices</p>
                    <p className="text-xl font-semibold text-white mt-1">{customer.InvoiceCount}</p>
                  </Card>
                </div>
              </div>
            </Card>

            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Invoice History</h2>
              <Card className="bg-neutral-800 border-neutral-700">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-700">
                        <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Invoice Number</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Date</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-neutral-400">Due Date</th>
                        <th className="text-right py-4 px-6 text-sm font-medium text-neutral-400">Amount</th>
                        <th className="text-right py-4 px-6 text-sm font-medium text-neutral-400">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-700">
                      {customer.Invoices.map((invoice) => (
                        <tr key={invoice.DocumentNumber} className="hover:bg-neutral-750 transition-colors">
                          <td className="py-4 px-6 text-sm text-white">{invoice.DocumentNumber}</td>
                          <td className="py-4 px-6 text-sm text-neutral-400">
                            {new Date(invoice.InvoiceDate).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-sm text-neutral-400">
                            {new Date(invoice.DueDate).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-sm text-right text-white">
                            {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: invoice.Currency })
                              .format(invoice.Total)}
                          </td>
                          <td className="py-4 px-6 text-sm text-right text-white">
                            {invoice.Balance}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </SidebarDemo>
  );
} 