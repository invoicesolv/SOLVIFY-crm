'use client';

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Search, Filter, RefreshCw, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";

// Lead sources and service categories for importing customers
const LEAD_SOURCES = [
  { id: "past_customer", name: "Past Customer" },
  { id: "reactivation", name: "Reactivation Campaign" },
  { id: "referral", name: "Referral" },
  { id: "other", name: "Other" }
];

const SERVICE_CATEGORIES = [
  { id: "technical_seo", name: "Technical SEO" },
  { id: "content_seo", name: "Content SEO" },
  { id: "local_seo", name: "Local SEO" },
  { id: "ecommerce_seo", name: "E-commerce SEO" },
  { id: "international_seo", name: "International SEO" },
  { id: "link_building", name: "Link Building" }
];

interface Customer {
  id: string;
  name: string;
  created_at: string;
  invoice_count?: number;
  last_invoice_date?: string;
}

interface ImportCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
  onSuccess: () => void;
}

export function ImportCustomersDialog({
  open,
  onOpenChange,
  workspaceId,
  userId,
  onSuccess,
}: ImportCustomersDialogProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  
  // Import settings
  const [leadSource, setLeadSource] = useState("past_customer");
  const [serviceCategory, setServiceCategory] = useState("technical_seo");
  const [qualificationScore, setQualificationScore] = useState(5);

  // Load customers when the dialog opens
  useEffect(() => {
    if (open) {
      fetchCustomers();
    } else {
      // Reset state when dialog closes
      setSelectedCustomers([]);
      setSearchQuery("");
    }
  }, [open, workspaceId]);

  // Filter customers based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = customers.filter(
      (customer) => customer.name && customer.name.toLowerCase().includes(query)
    );
    setFilteredCustomers(filtered);
  }, [searchQuery, customers]);

  const fetchCustomers = async () => {
    if (!workspaceId) return;

    try {
      setLoadingCustomers(true);
      
      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, name, created_at")
        .eq("workspace_id", workspaceId);

      if (customersError) throw customersError;

      // Try to enhance with invoice data (optional)
      try {
        // Get invoice counts per customer
        const { data: invoiceData, error: invoiceError } = await supabase
          .from("invoices")
          .select("customer_id, invoice_date")
          .eq("workspace_id", workspaceId);

        if (!invoiceError && invoiceData) {
          // Calculate invoice count and last invoice date per customer
          const customerInvoices = invoiceData.reduce((acc, invoice) => {
            if (!invoice.customer_id) return acc;
            
            if (!acc[invoice.customer_id]) {
              acc[invoice.customer_id] = {
                count: 0,
                dates: []
              };
            }
            
            acc[invoice.customer_id].count++;
            if (invoice.invoice_date) {
              acc[invoice.customer_id].dates.push(new Date(invoice.invoice_date));
            }
            
            return acc;
          }, {} as Record<string, { count: number, dates: Date[] }>);

          // Enhance customer data with invoice information
          const enhancedCustomers = customersData?.map(customer => ({
            ...customer,
            invoice_count: customerInvoices[customer.id]?.count || 0,
            last_invoice_date: customerInvoices[customer.id]?.dates.length 
              ? new Date(Math.max(...customerInvoices[customer.id].dates.map(d => d.getTime()))).toISOString() 
              : undefined
          })) || [];
          
          setCustomers(enhancedCustomers);
          setFilteredCustomers(enhancedCustomers);
        } else {
          setCustomers(customersData || []);
          setFilteredCustomers(customersData || []);
        }
      } catch (err) {
        console.error("Error fetching invoice data:", err);
        setCustomers(customersData || []);
        setFilteredCustomers(customersData || []);
      }
    } catch (error) {
      console.error("Error loading customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setLoadingCustomers(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map((c) => c.id));
    }
  };

  const toggleCustomer = (customerId: string) => {
    if (selectedCustomers.includes(customerId)) {
      setSelectedCustomers(selectedCustomers.filter((id) => id !== customerId));
    } else {
      setSelectedCustomers([...selectedCustomers, customerId]);
    }
  };

  const handleImport = async () => {
    if (selectedCustomers.length === 0) {
      toast.error("Please select at least one customer to import");
      return;
    }

    try {
      setImporting(true);
      
      // Get selected customer data
      const customersToImport = customers.filter(c => 
        selectedCustomers.includes(c.id)
      );
      
      // Create lead records for each selected customer
      const leadsToInsert = customersToImport.map(customer => ({
        lead_name: customer.name,
        company: customer.name, // Using customer name as company name
        email: "", // Default to empty string
        phone: "", // Default to empty string
        source: leadSource,
        service_category: serviceCategory,
        qualification_score: qualificationScore,
        notes: `Imported from customer database. Customer ID: ${customer.id}. Last active: ${
          customer.last_invoice_date 
            ? new Date(customer.last_invoice_date).toLocaleDateString() 
            : 'Unknown'
        }. Customer since: ${
          new Date(customer.created_at).toLocaleDateString()
        }`,
        workspace_id: workspaceId,
        user_id: userId
      }));
      
      const { data, error } = await supabase
        .from("leads")
        .insert(leadsToInsert);
        
      if (error) throw error;
      
      toast.success(`Successfully imported ${selectedCustomers.length} customer${selectedCustomers.length > 1 ? 's' : ''} as leads`);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error importing customers as leads:", error);
      toast.error("Failed to import customers as leads");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px] bg-background border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Import Customers as Leads
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Select customers to import into your leads database for re-marketing campaigns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <Search className="text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background border-border dark:border-border text-foreground"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={fetchCustomers}
              disabled={loadingCustomers}
              className="bg-background border-border dark:border-border text-foreground"
            >
              <RefreshCw className={`h-4 w-4 ${loadingCustomers ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Lead Source</div>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className="bg-background border border-border dark:border-border text-foreground rounded-md text-sm p-1"
              >
                {LEAD_SOURCES.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Service Category</div>
              <select
                value={serviceCategory}
                onChange={(e) => setServiceCategory(e.target.value)}
                className="bg-background border border-border dark:border-border text-foreground rounded-md text-sm p-1"
              >
                {SERVICE_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Qualification Score (1-10)</div>
              <input
                type="number"
                min="1"
                max="10"
                value={qualificationScore}
                onChange={(e) => setQualificationScore(Number(e.target.value))}
                className="bg-background border border-border dark:border-border text-foreground rounded-md text-sm p-1 w-16"
              />
            </div>
          </div>

          <div className="border-t border-border pt-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={
                    filteredCustomers.length > 0 &&
                    selectedCustomers.length === filteredCustomers.length
                  }
                  onCheckedChange={toggleSelectAll}
                  className="data-[state=checked]:bg-blue-600"
                />
                <label
                  htmlFor="select-all"
                  className="text-sm font-medium leading-none cursor-pointer text-foreground"
                >
                  Select All
                </label>
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedCustomers.length} of {filteredCustomers.length} selected
              </div>
            </div>

            <ScrollArea className="h-[250px] pr-4 -mr-4">
              {loadingCustomers ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No customers found
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center gap-3 p-2 hover:bg-background rounded-md"
                    >
                      <Checkbox
                        id={`customer-${customer.id}`}
                        checked={selectedCustomers.includes(customer.id)}
                        onCheckedChange={() => toggleCustomer(customer.id)}
                        className="data-[state=checked]:bg-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={`customer-${customer.id}`}
                            className="font-medium cursor-pointer text-foreground truncate"
                          >
                            {customer.name}
                          </label>
                          {customer.invoice_count !== undefined && customer.invoice_count > 0 && (
                            <Badge variant="outline" className="bg-background text-foreground dark:text-neutral-300 text-xs">
                              {customer.invoice_count} invoice{customer.invoice_count !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          Customer since: {
                            new Date(customer.created_at).toLocaleDateString()
                          } • Last invoice: {
                            customer.last_invoice_date 
                              ? new Date(customer.last_invoice_date).toLocaleDateString() 
                              : 'Never'
                          }
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-background border-border dark:border-border text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedCustomers.length === 0 || importing}
            className="bg-blue-600 hover:bg-blue-700 text-foreground"
          >
            {importing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Import {selectedCustomers.length} Customer{selectedCustomers.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 