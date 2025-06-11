"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";
import { useSession } from "next-auth/react";
import FortnoxRefreshButton from "@/components/FortnoxRefreshButton";

export default function FortnoxNotification() {
  const { data: session } = useSession();
  const [showNotification, setShowNotification] = useState(false);
  const [customerCount, setCustomerCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Check for new customers when component mounts
    if (session?.user?.id) {
      checkForNewCustomers();
    }
    
    // Set up periodic check (every 30 minutes)
    const interval = setInterval(() => {
      if (session?.user?.id) {
        checkForNewCustomers();
      }
    }, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [session?.user?.id]);
  
  const checkForNewCustomers = async () => {
    if (!session?.user?.id) return;
    
    try {
      setIsLoading(true);
      const response = await fetch('/api/fortnox/customers/check', {
        headers: {
          'user-id': session.user.id
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to check for new customers');
      }
      
      const data = await response.json();
      
      if (data.newCustomerCount > 0) {
        setCustomerCount(data.newCustomerCount);
        setShowNotification(true);
      } else {
        setShowNotification(false);
      }
    } catch (error) {
      console.error('Error checking for new customers:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!showNotification) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <div className="bg-background border border-border dark:border-border rounded-lg shadow-lg p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
            <span className="font-medium text-foreground">New Fortnox Customers Available</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-gray-200 dark:bg-muted"
            onClick={() => setShowNotification(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-foreground dark:text-neutral-300 mb-3">
          We found {customerCount} new customer(s) in Fortnox that are not in your local database.
          Would you like to sync them now?
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button 
            variant="ghost"
            size="sm"
            onClick={() => setShowNotification(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </Button>
          <FortnoxRefreshButton />
        </div>
      </div>
    </div>
  );
} 