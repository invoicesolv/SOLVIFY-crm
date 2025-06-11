"use client";

import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

export default function FortnoxRefreshButton() {
  const { data: session } = useSession();
  const [isCheckingFortnox, setIsCheckingFortnox] = useState(false);
  
  const fetchAllFortnoxCustomers = async () => {
    if (!session?.user?.id) {
      toast.error("You must be logged in to refresh customers");
      return;
    }
    
    try {
      setIsCheckingFortnox(true);
      const response = await fetch('/api/fortnox/customers/all', {
        headers: {
          'user-id': session.user.id
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch customers from Fortnox');
      }
      
      const data = await response.json();
      toast.success(`Successfully synced ${data.success} customers from Fortnox`);
      
      // Force a refresh of the page to reload customers
      window.location.reload();
    } catch (error) {
      console.error('Error fetching Fortnox customers:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to check for new customers');
    } finally {
      setIsCheckingFortnox(false);
    }
  };

  return (
    <Button 
      onClick={fetchAllFortnoxCustomers}
      disabled={isCheckingFortnox}
      className="bg-gray-200 dark:bg-muted hover:bg-gray-300 dark:hover:bg-neutral-600 border-gray-400 dark:border-border"
    >
      {isCheckingFortnox ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Checking Fortnox...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Customers
        </>
      )}
    </Button>
  );
} 