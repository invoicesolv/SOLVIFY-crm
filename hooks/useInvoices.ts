"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-client';

// Define Invoice type to match the API response
interface Invoice {
  id: string;
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
  Status: string;
  _original?: any; // Original invoice data from database
}

interface InvoiceStats {
  totalAmount: number;
  totalCount: number;
  paidCount: number;
  unpaidCount: number;
  overdueCount: number;
}

interface InvoicePagination {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  hasMore: boolean;
}

interface UseInvoicesOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
  status?: 'all' | 'paid' | 'unpaid' | 'overdue';
  dateRange?: 'all' | 'thisMonth' | 'lastMonth' | 'thisYear';
}

/**
 * Hook to fetch and manage invoices following the documented pattern
 * @param options - Filtering and pagination options
 * @returns Object containing invoices, stats, loading state, and any error
 */
export function useInvoices(options: UseInvoicesOptions = {}) {
  const { user, session } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats>({
    totalAmount: 0,
    totalCount: 0,
    paidCount: 0,
    unpaidCount: 0,
    overdueCount: 0
  });
  const [pagination, setPagination] = useState<InvoicePagination>({
    page: 1,
    pageSize: 50,
    totalPages: 0,
    totalCount: 0,
    hasMore: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!user?.id || !session) {
      console.log('[useInvoices] Missing user or session:', { 
        hasUser: !!user?.id, 
        hasSession: !!session,
        sessionKeys: session ? Object.keys(session) : []
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[useInvoices] Fetching invoices via API...', {
        userId: user.id,
        userEmail: user.email,
        options
      });
      
      // Build query parameters
      const searchParams = new URLSearchParams();
      if (options.page) searchParams.set('page', options.page.toString());
      if (options.pageSize) searchParams.set('pageSize', options.pageSize.toString());
      if (options.search) searchParams.set('search', options.search);
      if (options.orderBy) searchParams.set('orderBy', options.orderBy);
      if (options.orderDir) searchParams.set('orderDir', options.orderDir);
      if (options.status && options.status !== 'all') searchParams.set('status', options.status);
      if (options.dateRange && options.dateRange !== 'all') searchParams.set('dateRange', options.dateRange);
      
      // Use API endpoint with NextAuth session - no authorization header needed
      // The withAuth wrapper will handle authentication on the server side
      const response = await fetch(`/api/invoices?${searchParams.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include NextAuth cookies
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('[useInvoices] Received invoices:', data.invoices?.length || 0);
      console.log('[useInvoices] Stats:', data.stats);

      setInvoices(data.invoices || []);
      setStats(data.stats || {
        totalAmount: 0,
        totalCount: 0,
        paidCount: 0,
        unpaidCount: 0,
        overdueCount: 0
      });
      setPagination(data.pagination || {
        page: 1,
        pageSize: 50,
        totalPages: 0,
        totalCount: 0,
        hasMore: false
      });

    } catch (err) {
      console.error('[useInvoices] Invoice fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch invoices'));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, session, JSON.stringify(options)]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Refetch function to allow manual refresh
  const refetch = () => {
    fetchInvoices();
  };

  return { 
    invoices, 
    stats, 
    pagination, 
    isLoading, 
    error, 
    refetch 
  };
}
