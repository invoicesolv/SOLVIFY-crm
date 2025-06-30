'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card-content';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import SupplierInvoiceForm from '@/components/fortnox/SupplierInvoiceForm';

// For demonstration - we would typically have a proper component for this
const CustomerInvoiceButton = () => {
  return (
    <Button className="w-full" onClick={() => window.location.href = '/invoices/create'}>
      Create Customer Invoice
    </Button>
  );
};

export default function ManageInvoicesPage() {
  const { user, session } = useAuth();
  const [activeTab, setActiveTab] = useState('create');

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Please sign in to access this page.</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Invoice Management</h1>
      
      <Tabs defaultValue="create" onValueChange={setActiveTab} className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="list">List Invoices</TabsTrigger>
        </TabsList>
        
        <TabsContent value="create">
          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Customer Invoices</CardTitle>
                <CardDescription>
                  Create invoices for your customers (outgoing invoices)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-gray-600">
                  Invoices you send to your customers for products or services you provide.
                </p>
                <CustomerInvoiceButton />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Supplier Invoices</CardTitle>
                <CardDescription>
                  Record invoices from your suppliers (incoming invoices)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-gray-600">
                  Invoices you receive from your suppliers for products or services they provide.
                </p>
                <SupplierInvoiceForm />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>All Invoices</CardTitle>
              <CardDescription>
                View and manage all your invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-600">
                  Invoice list feature is under development.
                </p>
                <p className="text-sm text-foreground0 mt-2">
                  You can view invoices in your Fortnox account for now.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Separator className="my-8" />
      
      <div className="text-sm text-foreground0">
        <h3 className="font-medium text-foreground mb-2">About Invoicing</h3>
        <p className="mb-2">
          This page allows you to create both outgoing (customer) invoices and record incoming 
          (supplier) invoices in your Fortnox account.
        </p>
        <p>
          All invoices are synchronized with Fortnox automatically. For detailed invoice 
          management, please use your Fortnox account directly.
        </p>
      </div>
    </div>
  );
} 