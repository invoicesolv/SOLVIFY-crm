'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarIcon, RefreshCw, ChevronDown, Plus, Trash } from 'lucide-react';

type InvoiceAccrualRow = {
  Account: number;
  Credit: number;
  Debit: number;
  Description?: string;
};

type InvoiceAccrual = {
  '@url'?: string;
  AccrualAccount: number;
  Description: string;
  EndDate: string;
  InvoiceAccrualRows?: InvoiceAccrualRow[];
  InvoiceNumber: number;
  Period: "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "ANNUALLY";
  RevenueAccount: number;
  StartDate: string;
  Times: number;
  Total: number;
  VATIncluded: boolean;
};

export function FortnoxInvoiceAccruals({ userId }: { userId: string }) {
  // Get workspace ID from local storage if not provided
  const [workspaceId, setWorkspaceId] = useState<string>('');
  
  useEffect(() => {
    // Try to get workspace ID from local storage
    try {
      const storedWorkspaceId = localStorage.getItem('activeWorkspace');
      if (storedWorkspaceId) {
        console.log('Found workspace ID in localStorage:', storedWorkspaceId);
        setWorkspaceId(storedWorkspaceId);
      } else {
        console.log('No workspace ID found in localStorage');
      }
    } catch (e) {
      console.error('Error getting workspace ID from local storage:', e);
    }
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [accruals, setAccruals] = useState<InvoiceAccrual[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<string>('');
  
  // New accrual form state
  const [newAccrual, setNewAccrual] = useState<Partial<InvoiceAccrual>>({
    Period: "MONTHLY",
    VATIncluded: true,
    Times: 12
  });

  // Fetch all invoice accruals
  const fetchAccruals = async () => {
    if (!userId) {
      setErrorMessage("User ID is required. Please make sure you're logged in.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const url = `/api/fortnox/invoiceaccruals`;
      const headers: Record<string, string> = {
        'user-id': userId
      };
      
      // Only add workspace-id if it exists
      if (workspaceId) {
        headers['workspace-id'] = workspaceId;
      }
      
      console.log(`Sending request to ${url} with headers:`, headers);
      
      const response = await fetch(url, {
        headers
      });

      const responseText = await response.text();
      console.log(`Raw response: ${responseText}`);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      if (!response.ok) {
        console.error(`Error fetching invoice accruals: Status ${response.status}`, data);
        throw new Error(`API error (${response.status}): ${data.error || 'Unknown error'}`);
      }

      setAccruals(data.invoiceAccruals || []);
    } catch (error) {
      console.error("Error in fetch:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch a specific invoice accrual
  const fetchAccrual = async (invoiceNumber: string) => {
    if (!userId || !invoiceNumber) {
      setErrorMessage("User ID and Invoice Number are required");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const url = `/api/fortnox/invoiceaccruals?invoiceNumber=${invoiceNumber}`;
      const headers: Record<string, string> = {
        'user-id': userId
      };
      
      if (workspaceId) {
        headers['workspace-id'] = workspaceId;
      }
      
      const response = await fetch(url, {
        headers
      });

      const responseText = await response.text();
      console.log(`Raw response: ${responseText}`);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      if (!response.ok) {
        console.error(`Error fetching invoice accrual: Status ${response.status}`, data);
        throw new Error(`API error (${response.status}): ${data.error || 'Unknown error'}`);
      }

      // If found, add it to our list (if not already there)
      if (data.invoiceAccrual) {
        const found = accruals.some(a => a.InvoiceNumber.toString() === invoiceNumber);
        if (!found) {
          setAccruals([...accruals, data.invoiceAccrual]);
        }
      }
    } catch (error) {
      console.error("Error in fetch:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new invoice accrual
  const createAccrual = async () => {
    if (!userId) {
      setErrorMessage("User ID is required. Please make sure you're logged in.");
      return;
    }

    // Validate required fields
    if (!newAccrual.InvoiceNumber || !newAccrual.Description || 
        !newAccrual.StartDate || !newAccrual.EndDate || 
        !newAccrual.AccrualAccount || !newAccrual.RevenueAccount || 
        !newAccrual.Total) {
      setErrorMessage("Please fill all required fields");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const url = `/api/fortnox/invoiceaccruals`;
      const headers: Record<string, string> = {
        'user-id': userId,
        'Content-Type': 'application/json'
      };
      
      if (workspaceId) {
        headers['workspace-id'] = workspaceId;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ invoiceAccrual: newAccrual })
      });

      const responseText = await response.text();
      console.log(`Raw response: ${responseText}`);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      if (!response.ok) {
        console.error(`Error creating invoice accrual: Status ${response.status}`, data);
        throw new Error(`API error (${response.status}): ${data.error || 'Unknown error'}`);
      }

      // If created successfully, add to our list and reset form
      if (data.invoiceAccrual) {
        setAccruals([...accruals, data.invoiceAccrual]);
        setNewAccrual({
          Period: "MONTHLY",
          VATIncluded: true,
          Times: 12
        });
        setShowForm(false);
      }
    } catch (error) {
      console.error("Error in create:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete an invoice accrual
  const deleteAccrual = async (invoiceNumber: string) => {
    if (!userId || !invoiceNumber) {
      setErrorMessage("User ID and Invoice Number are required");
      return;
    }

    if (!confirm(`Are you sure you want to delete the accrual for invoice ${invoiceNumber}?`)) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const url = `/api/fortnox/invoiceaccruals?invoiceNumber=${invoiceNumber}`;
      const headers: Record<string, string> = {
        'user-id': userId
      };
      
      if (workspaceId) {
        headers['workspace-id'] = workspaceId;
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (response.status !== 204) {
        // Try to get error details
        const responseText = await response.text();
        console.log(`Raw response: ${responseText}`);
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          // If not valid JSON, use the raw text
          throw new Error(`Error deleting accrual: ${responseText}`);
        }

        console.error(`Error deleting invoice accrual: Status ${response.status}`, data);
        throw new Error(`API error (${response.status}): ${data.error || 'Unknown error'}`);
      }

      // If deleted successfully, remove from our list
      setAccruals(accruals.filter(a => a.InvoiceNumber.toString() !== invoiceNumber));
    } catch (error) {
      console.error("Error in delete:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form input changes
  const handleInputChange = (field: keyof InvoiceAccrual, value: any) => {
    setNewAccrual({
      ...newAccrual,
      [field]: value
    });
  };

  // Format currency values
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', { 
      style: 'currency', 
      currency: 'SEK',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="w-full border rounded-lg shadow-sm bg-white dark:bg-gray-800 p-4">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold mb-1">Fortnox Invoice Accruals</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage invoice accruals in your Fortnox account
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={fetchAccruals} disabled={isLoading} variant="outline">
            {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Fetch All
          </Button>
          <Button onClick={() => setShowForm(!showForm)} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            {showForm ? 'Cancel' : 'New Accrual'}
          </Button>
        </div>
      </div>

      {/* Fetch single accrual */}
      <div className="mb-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-700">
        <h4 className="text-md font-medium mb-2">Fetch Specific Invoice Accrual</h4>
        <div className="flex items-end space-x-2">
          <div className="flex-grow">
            <Label htmlFor="invoiceNumber" className="mb-1 block">Invoice Number</Label>
            <Input
              id="invoiceNumber"
              type="text"
              value={selectedInvoiceNumber}
              onChange={e => setSelectedInvoiceNumber(e.target.value)}
              placeholder="Enter invoice number"
            />
          </div>
          <Button 
            onClick={() => fetchAccrual(selectedInvoiceNumber)} 
            disabled={isLoading || !selectedInvoiceNumber}
          >
            Fetch
          </Button>
        </div>
      </div>

      {/* Error messages */}
      {errorMessage && (
        <div className="my-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {/* Create new accrual form */}
      {showForm && (
        <div className="mb-6 p-4 border rounded-md">
          <h4 className="text-md font-medium mb-3">Create New Invoice Accrual</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="invoiceNumber" className="mb-1 block">Invoice Number *</Label>
              <Input
                id="invoiceNumber"
                type="number"
                value={newAccrual.InvoiceNumber || ''}
                onChange={e => handleInputChange('InvoiceNumber', parseInt(e.target.value))}
                placeholder="Invoice number"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="description" className="mb-1 block">Description *</Label>
              <Input
                id="description"
                type="text"
                value={newAccrual.Description || ''}
                onChange={e => handleInputChange('Description', e.target.value)}
                placeholder="Description"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="startDate" className="mb-1 block">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={newAccrual.StartDate || ''}
                onChange={e => handleInputChange('StartDate', e.target.value)}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="endDate" className="mb-1 block">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={newAccrual.EndDate || ''}
                onChange={e => handleInputChange('EndDate', e.target.value)}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="accrualAccount" className="mb-1 block">Accrual Account *</Label>
              <Input
                id="accrualAccount"
                type="number"
                value={newAccrual.AccrualAccount || ''}
                onChange={e => handleInputChange('AccrualAccount', parseInt(e.target.value))}
                placeholder="e.g. 1790"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="revenueAccount" className="mb-1 block">Revenue Account *</Label>
              <Input
                id="revenueAccount"
                type="number"
                value={newAccrual.RevenueAccount || ''}
                onChange={e => handleInputChange('RevenueAccount', parseInt(e.target.value))}
                placeholder="e.g. 3000"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="total" className="mb-1 block">Total Amount *</Label>
              <Input
                id="total"
                type="number"
                step="0.01"
                value={newAccrual.Total || ''}
                onChange={e => handleInputChange('Total', parseFloat(e.target.value))}
                placeholder="Total amount"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="times" className="mb-1 block">Number of Times *</Label>
              <Input
                id="times"
                type="number"
                value={newAccrual.Times || ''}
                onChange={e => handleInputChange('Times', parseInt(e.target.value))}
                placeholder="Number of periods"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="period" className="mb-1 block">Period *</Label>
              <select 
                id="period"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={newAccrual.Period || 'MONTHLY'}
                onChange={e => handleInputChange('Period', e.target.value as any)}
                required
              >
                <option value="MONTHLY">Monthly</option>
                <option value="BIMONTHLY">Bimonthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="SEMIANNUALLY">Semi-annually</option>
                <option value="ANNUALLY">Annually</option>
              </select>
            </div>
            
            <div className="flex items-center mt-6">
              <input
                id="vatIncluded"
                type="checkbox"
                className="mr-2"
                checked={newAccrual.VATIncluded}
                onChange={e => handleInputChange('VATIncluded', e.target.checked)}
              />
              <Label htmlFor="vatIncluded">VAT Included</Label>
            </div>
          </div>
          
          <Button 
            onClick={createAccrual} 
            disabled={isLoading}
            className="w-full md:w-auto"
          >
            {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Invoice Accrual
          </Button>
        </div>
      )}

      {/* List of accruals */}
      <div className="mt-4">
        <h4 className="text-md font-medium mb-2">Invoice Accruals</h4>
        
        {accruals.length === 0 ? (
          <p className="text-gray-500 italic">No invoice accruals found. Click "Fetch All" to load accruals.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invoice #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Dates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Times</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200">
                {accruals.map((accrual) => (
                  <tr key={accrual.InvoiceNumber}>
                    <td className="px-6 py-4 whitespace-nowrap">{accrual.InvoiceNumber}</td>
                    <td className="px-6 py-4">{accrual.Description}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {accrual.StartDate} to {accrual.EndDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatCurrency(accrual.Total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{accrual.Period}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{accrual.Times}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Button 
                        variant="ghost" 
                        onClick={() => deleteAccrual(accrual.InvoiceNumber.toString())}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-800 hover:bg-red-100"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 