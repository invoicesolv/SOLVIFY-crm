export interface Customer {
  id: string;
  customer_number?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  birthday?: string;
  contact_person?: string;
  position?: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
}

export interface CustomerDetails extends Customer {
  CustomerNumber: string;
  CustomerName: string;
  Email: string;
  Phone: string;
  Birthday: string;
  Address: string;
  ContactPerson: string;
  Position: string;
  Total: number;
  InvoiceCount: number;
  LastInvoiceDate: string;
  Invoices: CustomerInvoice[];
}

export interface CustomerInvoice {
  DocumentNumber: string;
  InvoiceDate: string;
  Total: number;
  Currency: string;
  DueDate: string;
  Balance: number;
} 