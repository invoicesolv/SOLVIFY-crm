'use client';

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface CalendarErrorBoundaryProps {
  children: React.ReactNode;
}

export function CalendarErrorBoundary({ children }: CalendarErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string; timestamp: number } | null>(null);
  
  // Check for stored errors on component mount
  useEffect(() => {
    const storedError = localStorage.getItem('calendar_error');
    if (storedError) {
      try {
        const { message, timestamp } = JSON.parse(storedError);
        // Only show errors from the last 5 minutes
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setErrorInfo({ message, timestamp });
          setHasError(true);
        } else {
          // Clear old errors
          localStorage.removeItem('calendar_error');
        }
      } catch (e) {
        // Invalid error format
        localStorage.removeItem('calendar_error');
      }
    }
    
    // Set up global error handler for fetch errors
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
      try {
        const response = await originalFetch(input, init);
        
        // Check if the request was for a calendar endpoint
        if (typeof input === 'string' && 
            (input.includes('/api/calendar') || 
             input.includes('/api/user/active-workspace'))) {
          if (!response.ok) {
            const statusText = `${response.status}: ${response.statusText}`;
            console.error(`Calendar API error: ${statusText} for ${input}`);
            
            // Store the error for future component loads
            localStorage.setItem('calendar_error', JSON.stringify({
              message: `Failed to load calendar data (${statusText})`,
              timestamp: Date.now()
            }));
            
            // Don't set error state here to avoid interrupting ongoing requests
          }
        }
        
        return response;
      } catch (error: any) {
        // Handle network errors
        if (typeof input === 'string' && 
            (input.includes('/api/calendar') || 
             input.includes('/api/user/active-workspace'))) {
          console.error(`Calendar network error:`, error);
          
          // Store the error for future component loads
          localStorage.setItem('calendar_error', JSON.stringify({
            message: `Network error: ${error.message || 'Could not connect to server'}`,
            timestamp: Date.now()
          }));
          
          // Don't set error state here to avoid interrupting ongoing requests
        }
        
        throw error;
      }
    };
    
    // Cleanup
    return () => {
      window.fetch = originalFetch;
    };
  }, []);
  
  const handleRetry = () => {
    // Clear the error
    setHasError(false);
    setErrorInfo(null);
    localStorage.removeItem('calendar_error');
    
    // Clear calendar cache to force fresh data
    localStorage.removeItem('calendarEvents');
    
    // Reload the page to retry all requests
    window.location.reload();
  };
  
  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] p-4">
        <div className="w-full max-w-md p-6 bg-neutral-800 border border-amber-900/30 rounded-lg shadow-lg text-center">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Calendar Error</h2>
          <p className="text-neutral-400 mb-6">
            {errorInfo?.message || 'There was a problem loading your calendar data.'}
          </p>
          <Button
            onClick={handleRetry}
            className="bg-amber-600 hover:bg-amber-500 flex items-center gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
} 