"use client";

import { useEffect, useState } from "react";
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Edit2, Trash2, AlertOctagon, Loader2 } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from '@/lib/auth-client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface CustomerDetails {
  id: string;
  CustomerNumber: string;
  CustomerName: string;
  Email?: string;
  Phone?: string;
  Address?: string;
  Address2?: string;
  City?: string;
  ZipCode?: string;
  ContactPerson?: string;
  OrganizationNumber?: string;
  Country?: string;
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
  const router = useRouter();
  const { user, session } = useAuth();
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isFindingByName, setIsFindingByName] = useState(false);

  // Define fetchCustomerDetails at component scope so it can be accessed by other functions
  const fetchCustomerDetails = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      // Fetch customer data from our database
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', params.id)
        .single();

      if (customerError) throw customerError;
      if (!customerData) throw new Error('Customer not found');

      // Fetch invoices for this customer
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*, currencies(*)')
        .eq('customer_id', params.id);

      if (invoicesError) throw invoicesError;

      // Calculate total revenue
      const total = invoicesData.reduce((acc, invoice) => {
        return acc + (invoice.total || 0);
      }, 0);

      const lastInvoice = invoicesData.sort((a, b) => 
        new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
      )[0];

      // Transform the data to match the expected format
      const customerDetails: CustomerDetails = {
        id: customerData.id,
        CustomerNumber: customerData.customer_number || customerData.id,
        CustomerName: customerData.name,
        Email: customerData.email || '',
        Phone: customerData.phone || '',
        Address: customerData.address || '',
        Address2: customerData.address2 || '',
        City: customerData.city || '',
        ZipCode: customerData.zip_code || '',
        ContactPerson: customerData.contact_person || '',
        OrganizationNumber: customerData.organization_number || '',
        Country: customerData.country || '',
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
  };

  useEffect(() => {
    if (user?.id) {
      fetchCustomerDetails();
    }
  }, [params.id, user?.id]);

  const handleEdit = () => {
    setEditForm({
      name: customer?.CustomerName || ''
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!user?.id || !customer) return;

    try {
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          name: editForm.name
        })
        .eq('id', customer.id)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Update local state
      setCustomer({
        ...customer,
        CustomerName: editForm.name
      });

      setIsEditing(false);
      toast.success('Customer details updated successfully');
    } catch (err) {
      console.error('Error updating customer:', err);
      toast.error('Failed to update customer details');
    }
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!user?.id || !customer || !session?.access_token) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/customers/delete?id=${customer.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete customer');
      }

      toast.success(`Successfully deleted customer: ${customer.CustomerName}`);
      // Redirect back to customers list
      router.push('/customers');
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete customer');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  // Add function to fetch email from Fortnox
  const fetchEmailFromFortnox = async () => {
    if (!customer?.CustomerNumber || !user?.id || !session?.access_token) return;
    
    try {
      setIsUpdatingEmail(true);
      const response = await fetch(`/api/fortnox/customers/${customer.CustomerNumber}`, {
        headers: {
          'user-id': user.id,
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch customer data from Fortnox');
      }
      
      const data = await response.json();
      
      if (data.Customer && data.Customer.Email) {
        // Update customer with email
        toast.success('Customer email updated from Fortnox');
        
        // Refresh customer details
        fetchCustomerDetails();
      } else {
        toast.error('No email found in Fortnox for this customer');
      }
    } catch (error) {
      console.error('Error fetching email:', error);
      toast.error('Failed to fetch email from Fortnox');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // Add function to search by name and update the mapping
  const findCustomerByName = async () => {
    if (!customer?.CustomerName || !user?.id || !session?.access_token) return;
    
    try {
      setIsFindingByName(true);
      const encodedName = encodeURIComponent(customer.CustomerName);
      const response = await fetch(`/api/fortnox/customers/search?name=${encodedName}&id=${params.id}`, {
        headers: {
          'user-id': user.id,
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to search for customer in Fortnox');
      }
      
      const data = await response.json();
      
      if (data.total > 0) {
        toast.success(`Found ${data.total} matching customer(s) in Fortnox. Database updated.`);
        // Refresh customer details to show the updated mapping
        fetchCustomerDetails();
      } else {
        toast.error('No matching customers found in Fortnox');
      }
    } catch (error) {
      console.error('Error searching customer by name:', error);
      toast.error('Failed to search for customer in Fortnox');
    } finally {
      setIsFindingByName(false);
    }
  };

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/customers"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
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
          <div className="text-center py-8 text-muted-foreground">
            Failed to load customer details. Please try again later.
          </div>
        ) : customer ? (
          <>
            <Card className="bg-background border-border dark:border-border p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{customer.CustomerName}</h1>
                  <p className="text-muted-foreground mt-1">
                    Customer #{customer.CustomerNumber}
                    {!customer.CustomerNumber.includes('-') ? null : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={findCustomerByName}
                        disabled={isFindingByName}
                        className="ml-2 h-7 px-2 bg-transparent border-gray-400 dark:border-border text-amber-400 hover:bg-gray-200 dark:bg-muted"
                      >
                        {isFindingByName ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Find in Fortnox'
                        )}
                      </Button>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEdit}
                    className="bg-transparent border-gray-400 dark:border-border text-foreground dark:text-neutral-300 hover:bg-gray-200 dark:bg-muted"
                  >
                    <Edit2 className="h-4 w-4 mr-2" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="bg-transparent border-gray-400 dark:border-border text-red-400 hover:bg-red-900/30 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </Button>
                </div>
              </div>

              <div className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground mb-4">Customer Information</h2>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-foreground">{customer.Email || 'No email on record'}</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={fetchEmailFromFortnox}
                            disabled={isUpdatingEmail}
                            className="ml-2 h-7 px-2 bg-transparent border-gray-400 dark:border-border text-foreground dark:text-neutral-300 hover:bg-gray-200 dark:bg-muted"
                          >
                            {isUpdatingEmail ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Update from Fortnox'
                            )}
                          </Button>
                        </div>
                      </div>

                      {customer.Phone && (
                        <div>
                          <p className="text-sm text-muted-foreground">Phone</p>
                          <p className="text-foreground">{customer.Phone}</p>
                        </div>
                      )}

                      {(customer.Address || customer.Address2 || customer.City || customer.ZipCode || customer.Country) && (
                        <div>
                          <p className="text-sm text-muted-foreground">Address</p>
                          <div className="text-foreground">
                            {customer.Address && <p>{customer.Address}</p>}
                            {customer.Address2 && <p>{customer.Address2}</p>}
                            {(customer.ZipCode || customer.City) && (
                              <p>{customer.ZipCode} {customer.City}</p>
                            )}
                            {customer.Country && <p>{customer.Country}</p>}
                          </div>
                        </div>
                      )}

                      {customer.ContactPerson && (
                        <div>
                          <p className="text-sm text-muted-foreground">Contact Person</p>
                          <p className="text-foreground">{customer.ContactPerson}</p>
                        </div>
                      )}

                      {customer.OrganizationNumber && (
                        <div>
                          <p className="text-sm text-muted-foreground">Organization Number</p>
                          <p className="text-foreground">{customer.OrganizationNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-gray-200 dark:bg-muted border-gray-400 dark:border-border p-4">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-xl font-semibold text-foreground mt-1">
                    {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                      .format(customer.Total)}
                  </p>
                </Card>
                <Card className="bg-gray-200 dark:bg-muted border-gray-400 dark:border-border p-4">
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                  <p className="text-xl font-semibold text-foreground mt-1">{customer.InvoiceCount}</p>
                </Card>
              </div>
            </Card>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Invoice History</h2>
              <Card className="bg-background border-border dark:border-border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border dark:border-border">
                        <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Invoice Number</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Due Date</th>
                        <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">Amount</th>
                        <th className="text-right py-4 px-6 text-sm font-medium text-muted-foreground">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-700">
                      {customer.Invoices.map((invoice) => (
                        <tr key={invoice.DocumentNumber} className="hover:bg-neutral-750 transition-colors">
                          <td className="py-4 px-6 text-sm text-foreground">{invoice.DocumentNumber}</td>
                          <td className="py-4 px-6 text-sm text-muted-foreground">
                            {new Date(invoice.InvoiceDate).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-sm text-muted-foreground">
                            {new Date(invoice.DueDate).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-sm text-right text-foreground">
                            {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: invoice.Currency })
                              .format(invoice.Total)}
                          </td>
                          <td className="py-4 px-6 text-sm text-right text-foreground">
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[425px] bg-background border-border dark:border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete {customer?.CustomerName}? This action cannot be undone.
              {customer && customer.Total > 0 && (
                <div className="mt-2 bg-destructive/10 p-3 rounded-md text-destructive border border-destructive">
                  <AlertOctagon className="inline-block mr-2" size={16} />
                  Warning: This customer has invoices with a total value of {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(customer.Total)}.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              onClick={() => setDeleteConfirmOpen(false)}
              className="bg-gray-200 dark:bg-muted hover:bg-gray-300 dark:hover:bg-neutral-600 border-gray-400 dark:border-border"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-900/80 hover:bg-red-900 text-foreground"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={16} className="inline-block mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Customer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarDemo>
  );
} 