'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { useToast } from '../ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface SupplierInvoiceFormProps {
  projectId?: string;
  projectNumber?: string;
}

interface InvoiceRow {
  description: string;
  accountNumber: string;
  quantity: number;
  price: number;
  total: number;
  vat: number;
}

interface Supplier {
  id: string;
  name: string;
  supplier_number: string;
}

export default function SupplierInvoiceForm({ projectId, projectNumber }: SupplierInvoiceFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const supabase = createClientComponentClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [externalInvoiceNumber, setExternalInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [comments, setComments] = useState('');
  const [currency, setCurrency] = useState('SEK');
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([
    {
      description: '',
      accountNumber: '4010', // Default account for purchases
      quantity: 1,
      price: 0,
      total: 0,
      vat: 25
    }
  ]);
  const [ourReference, setOurReference] = useState('');
  const [yourReference, setYourReference] = useState('');

  // Fetch suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, supplier_number')
        .order('name');

      if (error) {
        console.error('Error fetching suppliers:', error);
        toast({
          title: 'Error',
          description: 'Failed to load suppliers',
          variant: 'destructive'
        });
      } else if (data) {
        setSuppliers(data);
      }
    };

    if (isOpen) {
      fetchSuppliers();
    }
  }, [isOpen, supabase, toast]);

  // Handle invoice row changes
  const handleRowChange = (index: number, field: keyof InvoiceRow, value: string | number) => {
    const newRows = [...invoiceRows];
    
    // Convert string values to number for numeric fields
    if (field === 'quantity' || field === 'price' || field === 'vat') {
      newRows[index][field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
    } else if (field === 'description' || field === 'accountNumber') {
      newRows[index][field] = value as string;
    }
    
    // Calculate total
    if (field === 'quantity' || field === 'price') {
      newRows[index].total = newRows[index].quantity * newRows[index].price;
    }
    
    setInvoiceRows(newRows);
  };

  // Add a new invoice row
  const addInvoiceRow = () => {
    setInvoiceRows([
      ...invoiceRows,
      {
        description: '',
        accountNumber: '4010',
        quantity: 1,
        price: 0,
        total: 0,
        vat: 25
      }
    ]);
  };

  // Remove an invoice row
  const removeInvoiceRow = (index: number) => {
    if (invoiceRows.length > 1) {
      const newRows = [...invoiceRows];
      newRows.splice(index, 1);
      setInvoiceRows(newRows);
    }
  };

  // Calculate invoice totals
  const calculateTotals = () => {
    const subtotal = invoiceRows.reduce((sum, row) => sum + row.total, 0);
    const vat = invoiceRows.reduce((sum, row) => sum + (row.total * row.vat / 100), 0);
    const total = subtotal + vat;
    
    return { subtotal, vat, total };
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedSupplier) {
      toast({
        title: 'Error',
        description: 'Please select a supplier',
        variant: 'destructive'
      });
      return;
    }

    if (invoiceRows.some(row => !row.description || row.price <= 0)) {
      toast({
        title: 'Error',
        description: 'All invoice rows must have a description and a price greater than zero',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedSupplierData = suppliers.find(s => s.id === selectedSupplier);
      
      if (!selectedSupplierData) {
        throw new Error('Selected supplier not found');
      }

      const payload = {
        supplierNumber: selectedSupplierData.supplier_number,
        supplierName: selectedSupplierData.name,
        externalInvoiceNumber,
        invoiceDate,
        dueDate,
        comments,
        currency,
        invoiceRows: invoiceRows.map(row => ({
          description: row.description,
          accountNumber: row.accountNumber,
          quantity: row.quantity,
          price: row.price,
          vat: row.vat
        })),
        ourReference,
        yourReference,
        ...(projectNumber ? { project: projectNumber } : {})
      };

      const response = await fetch('/api/fortnox/supplierinvoices/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': user?.id || ''
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Supplier invoice created successfully`
        });
        setIsOpen(false);
        // Reset form
        setExternalInvoiceNumber('');
        setComments('');
        setSelectedSupplier('');
        setInvoiceRows([
          {
            description: '',
            accountNumber: '4010',
            quantity: 1,
            price: 0,
            total: 0,
            vat: 25
          }
        ]);
      } else {
        console.error('Failed to create supplier invoice:', data);
        toast({
          title: 'Error',
          description: `Failed to create supplier invoice: ${data.error || 'Unknown error'}. ${data.details || ''}`,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error creating supplier invoice:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const { subtotal, vat, total } = calculateTotals();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Create Supplier Invoice</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create Supplier Invoice</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="col-span-2">
            <Label htmlFor="supplier">Supplier</Label>
            <select
              id="supplier"
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">Select a supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} ({supplier.supplier_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="externalInvoiceNumber">External Invoice Number</Label>
            <Input
              id="externalInvoiceNumber"
              value={externalInvoiceNumber}
              onChange={(e) => setExternalInvoiceNumber(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="invoiceDate">Invoice Date</Label>
            <Input
              id="invoiceDate"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="ourReference">Our Reference</Label>
            <Input
              id="ourReference"
              value={ourReference}
              onChange={(e) => setOurReference(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="yourReference">Your Reference</Label>
            <Input
              id="yourReference"
              value={yourReference}
              onChange={(e) => setYourReference(e.target.value)}
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="comments">Comments</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="border p-4 rounded-md">
          <h3 className="font-medium mb-2">Invoice Rows</h3>
          
          {invoiceRows.map((row, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 mb-4">
              <div className="col-span-5">
                <Label htmlFor={`description-${index}`}>Description</Label>
                <Input
                  id={`description-${index}`}
                  value={row.description}
                  onChange={(e) => handleRowChange(index, 'description', e.target.value)}
                />
              </div>
              
              <div className="col-span-2">
                <Label htmlFor={`account-${index}`}>Account</Label>
                <Input
                  id={`account-${index}`}
                  value={row.accountNumber}
                  onChange={(e) => handleRowChange(index, 'accountNumber', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                <Input
                  id={`quantity-${index}`}
                  type="number"
                  min="0"
                  step="1"
                  value={row.quantity}
                  onChange={(e) => handleRowChange(index, 'quantity', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor={`price-${index}`}>Price</Label>
                <Input
                  id={`price-${index}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.price}
                  onChange={(e) => handleRowChange(index, 'price', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor={`vat-${index}`}>VAT %</Label>
                <Input
                  id={`vat-${index}`}
                  type="number"
                  min="0"
                  max="25"
                  value={row.vat}
                  onChange={(e) => handleRowChange(index, 'vat', e.target.value)}
                />
              </div>
              
              <div className="flex items-end">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  onClick={() => removeInvoiceRow(index)}
                  disabled={invoiceRows.length <= 1}
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
          
          <Button type="button" variant="outline" size="sm" onClick={addInvoiceRow}>
            Add Row
          </Button>
        </div>

        <div className="flex justify-between mt-4">
          <div>
            <p>Subtotal: {subtotal.toFixed(2)} {currency}</p>
            <p>VAT: {vat.toFixed(2)} {currency}</p>
            <p className="font-bold">Total: {total.toFixed(2)} {currency}</p>
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Invoice'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 