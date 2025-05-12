import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

type DashboardStats = {
  invoices: {
    totalCount: number;
    totalAmount: number;
    averageAmount: number;
    paidCount: number;
    unpaidCount: number;
    overdueCount: number;
  };
  timestamp: string;
  source?: 'cache' | 'realtime' | 'fallback' | 'error-fallback';
};

export function useDashboardStats(workspaceId?: string) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Function to fetch dashboard stats
  const fetchStats = async (showToast = false) => {
    if (!workspaceId) {
      console.log('[useDashboardStats] No workspaceId provided, skipping fetch');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[useDashboardStats] Fetching stats for workspace:', workspaceId);
      const url = `/api/dashboard/stats?workspaceId=${workspaceId}`;
      
      const response = await fetch(url);
      
      // Check for non-200 responses
      if (!response.ok) {
        // Check if the response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          // Try to parse JSON error
          const errorData = await response.json();
          throw new Error(errorData.error || `Server error: ${response.status}`);
        } else {
          // Handle HTML or other non-JSON responses
          const errorText = await response.text();
          if (errorText.includes('<!DOCTYPE html>')) {
            // This is likely a Next.js 404 page
            throw new Error(`API endpoint not found (404). Check if the server is running properly.`);
          } else {
            throw new Error(`API error: Status ${response.status}`);
          }
        }
      }

      // Try to parse the JSON response
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('[useDashboardStats] Failed to parse JSON response:', parseError);
        throw new Error('Invalid response format from API');
      }

      console.log('[useDashboardStats] Received dashboard stats:', data);
      
      // Validate the response data structure
      if (!data.invoices) {
        console.warn('[useDashboardStats] Response missing invoices data:', data);
        
        // Use empty data as fallback
        data = {
          invoices: {
            totalCount: 0,
            totalAmount: 0,
            averageAmount: 0,
            paidCount: 0,
            unpaidCount: 0,
            overdueCount: 0
          },
          timestamp: new Date().toISOString(),
          source: 'fallback'
        };
      }
      
      setStats(data);
      
      if (showToast) {
        toast({
          title: "Dashboard refreshed",
          description: `Stats updated at ${new Date().toLocaleTimeString()}`,
          variant: "default"
        });
      }
      
      return data;
    } catch (err) {
      console.error('[useDashboardStats] Error fetching dashboard stats:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      
      // Show error toast only if requested
      if (showToast) {
        toast({
          title: "Refresh failed",
          description: errorMessage,
          variant: "destructive"
        });
      }
      
      // Provide empty stats as fallback to prevent rendering errors
      setStats({
        invoices: {
          totalCount: 0,
          totalAmount: 0,
          averageAmount: 0,
          paidCount: 0,
          unpaidCount: 0,
          overdueCount: 0
        },
        timestamp: new Date().toISOString(),
        source: 'error-fallback'
      });
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats when the component mounts or when workspaceId changes
  useEffect(() => {
    if (workspaceId) {
      fetchStats();
    }
  }, [workspaceId]);

  // Set up auto-refresh (every 5 minutes)
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (workspaceId) {
        fetchStats();
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, [workspaceId]);

  return {
    stats,
    loading,
    error,
    refreshStats: (showToast = true) => fetchStats(showToast)
  };
} 