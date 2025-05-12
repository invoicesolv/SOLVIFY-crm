"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Check, RefreshCw } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

export default function FortnoxSyncButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [syncStats, setSyncStats] = useState<{
    processed: number;
    total: number;
    success: number;
    currentPage: number;
    totalPages: number;
    customersWithoutEmail: number;
  }>({
    processed: 0,
    total: 0,
    success: 0,
    currentPage: 0,
    totalPages: 0,
    customersWithoutEmail: 0
  });

  // Function to reset state
  const resetState = () => {
    setError(null);
    setProgress(0);
    setSyncStats({
      processed: 0,
      total: 0,
      success: 0,
      currentPage: 0,
      totalPages: 0,
      customersWithoutEmail: 0
    });
  };

  // Function to fetch one page of customers
  const fetchCustomerPage = async (page: number) => {
    try {
      // Call our optimized API endpoint with pagination
      const response = await fetch(`/api/fortnox/customers/all?page=${page}&pageSize=5`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching customer page:', error);
      throw error;
    }
  };

  // Main sync function that handles pagination
  const syncCustomers = async () => {
    try {
      setIsLoading(true);
      resetState();
      
      // Start with page 1
      let currentPage = 1;
      let hasMore = true;
      let totalProcessed = 0;
      let totalSuccess = 0;
      let totalCustomers = 0;
      let totalPages = 1;
      let totalWithoutEmail = 0;
      
      // Fetch pages until no more pages or error
      while (hasMore) {
        const data = await fetchCustomerPage(currentPage);
        
        // Update counters
        totalProcessed += data.processed || 0;
        totalSuccess += data.success || 0;
        totalWithoutEmail += data.customersWithoutEmail || 0;
        
        // Update pagination info
        if (data.pagination) {
          totalCustomers = data.pagination.totalCustomers;
          totalPages = data.pagination.totalPages;
          hasMore = data.pagination.hasMore;
        } else {
          hasMore = false;
        }
        
        // Update UI state
        setSyncStats({
          processed: totalProcessed,
          total: totalCustomers,
          success: totalSuccess,
          currentPage,
          totalPages,
          customersWithoutEmail: totalWithoutEmail
        });
        
        // Calculate progress percentage
        const progressPercentage = Math.min(
          Math.round((currentPage / Math.max(totalPages, 1)) * 100),
          100
        );
        setProgress(progressPercentage);
        
        // Move to next page
        currentPage++;
        
        // Small delay between page requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Final update to ensure 100% progress
      setProgress(100);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
      console.error('Error syncing customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={syncCustomers}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Syncing Fortnox Customers...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Fortnox Customers
          </>
        )}
      </Button>
      
      {isLoading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground">
            Processing page {syncStats.currentPage} of {syncStats.totalPages || '?'}
            {syncStats.total > 0 && ` - ${syncStats.processed} of ${syncStats.total} customers`}
          </p>
        </div>
      )}
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {!isLoading && syncStats.processed > 0 && (
        <Alert variant="default" className="bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle>Sync Completed</AlertTitle>
          <AlertDescription>
            Successfully synced {syncStats.success} of {syncStats.processed} customers
            {syncStats.customersWithoutEmail > 0 && (
              <p className="text-amber-600 mt-1">
                Note: {syncStats.customersWithoutEmail} customers are missing email addresses in Fortnox
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
} 