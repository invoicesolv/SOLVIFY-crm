'use client';

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  customer_number: string | null;
  address: string | null;
  address2: string | null;
  city: string | null;
  zip_code: string | null;
  phone: string | null;
  organization_number: string | null;
  country: string | null;
  contact_person: string | null;
  created_at: string;
  updated_at: string;
  email_metadata?: any;
}

interface CustomerContextType {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  refreshCustomers: () => Promise<void>;
  lastRefreshed: Date | null;
}

const CustomerContext = createContext<CustomerContextType>({
  customers: [],
  loading: false,
  error: null,
  refreshCustomers: async () => {},
  lastRefreshed: null,
});

interface CustomerProviderProps {
  children: ReactNode;
}

export function CustomerProvider({ children }: CustomerProviderProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/customers');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      setCustomers(data.customers || []);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError(error instanceof Error ? error.message : 'An error occurred fetching customers');
    } finally {
      setLoading(false);
    }
  };

  // Load customers on initial mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  return (
    <CustomerContext.Provider
      value={{
        customers,
        loading,
        error,
        refreshCustomers: fetchCustomers,
        lastRefreshed,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
}

export const useCustomers = () => useContext(CustomerContext); 