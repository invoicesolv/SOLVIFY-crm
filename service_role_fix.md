# Service Role Key Security Fix

This file contains the implementation to fix the service role key exposure issue in the CRM system. The main approach is to move all service role operations to server-side API routes and remove any client-side usage of the service role key.

## 1. Create Server-Side API Route for Customer Data

```typescript
// File: /app/api/customers/route.ts

import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";

// Create a server-side Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Note: Not using NEXT_PUBLIC_ prefix
  {
    auth: {
      persistSession: false
    }
  }
);

export async function GET(req: Request) {
  try {
    // Get the session to check if the user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's workspaces
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
      return NextResponse.json({ error: 'Failed to load workspace access' }, { status: 500 });
    }

    if (!teamMemberships?.length) {
      return NextResponse.json({ customers: [] });
    }

    const workspaceIds = teamMemberships.map(tm => tm.workspace_id);

    // Fetch customers for these workspaces
    const { data: customersData, error: customersError } = await supabaseAdmin
      .from('customers')
      .select('*')
      .in('workspace_id', workspaceIds);

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }

    // Fetch invoices to calculate totals
    const { data: invoicesData, error: invoicesError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .in('workspace_id', workspaceIds);

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }

    // Process customers and their invoices
    const processedCustomers = (customersData || []).map(customer => {
      const customerInvoices = (invoicesData || []).filter(invoice => invoice.customer_id === customer.id);
      const total = customerInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
      const lastInvoice = customerInvoices.sort((a, b) => 
        new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
      )[0];

      return {
        ...customer,
        total,
        invoice_count: customerInvoices.length,
        last_invoice_date: lastInvoice ? lastInvoice.invoice_date : customer.created_at,
      };
    });

    return NextResponse.json({ customers: processedCustomers });
  } catch (error) {
    console.error('Error in customers API:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch customer data', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
```

## 2. Update useCustomers Hook to Use the New API Route

```typescript
// File: /hooks/useCustomers.ts (Updated)

"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface Customer {
  id: string;
  customer_number: string;
  name: string;
  total: number;
  invoice_count: number;
  last_invoice_date: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export function useCustomers() {
  const { data: session } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchCustomers() {
      if (!session?.user?.id) {
        console.log('No session found, skipping customer fetch');
        setIsLoading(false);
        return;
      }

      try {
        // Use the new server-side API route instead of direct Supabase admin access
        const response = await fetch('/api/customers');
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch customers');
        }
        
        const data = await response.json();
        setCustomers(data.customers || []);
      } catch (err) {
        console.error('Customer fetch error:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch customers'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchCustomers();
  }, [session?.user?.id]);

  return { customers, isLoading, error };
}
```

## 3. Create Environment Variable Update Instructions

To properly secure the service role key, we need to update the environment variables in the project:

1. Rename `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` to `SUPABASE_SERVICE_ROLE_KEY` (removing the NEXT_PUBLIC_ prefix)
2. Update all server-side code to use the new variable name
3. Ensure the .env file and deployment environment are updated with this change

## 4. Create a Secure Admin Client Factory

```typescript
// File: /lib/admin-client.ts

import { createClient } from '@supabase/supabase-js';

// This function should ONLY be used in server-side code (API routes, Server Components, etc.)
export function createAdminClient() {
  // Verify we're on the server
  if (typeof window !== 'undefined') {
    throw new Error('Admin client can only be created on the server');
  }
  
  // Create and return the admin client
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}
```

## 5. Update Other Files Using Service Role Key

Any other files using the service role key directly should be updated to use either:
1. The new API routes for client-side code
2. The `createAdminClient()` function for server-side code

This approach ensures that the service role key is never exposed to the client, significantly improving the security of the application.
