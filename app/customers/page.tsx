"use client";

import { CustomersView } from "@/components/customers";
import { SidebarDemo } from "@/components/ui/code.demo";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Plus, Trash2, Mail, Copy } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import FortnoxSyncButton from '@/app/components/FortnoxSyncButton';
import { getActiveWorkspaceId } from '@/lib/permission';

export default function CustomersPage() {
  const { data: session } = useSession();
  const [isCheckingFortnox, setIsCheckingFortnox] = useState(false);
  const [isDeletingCustomers, setIsDeletingCustomers] = useState(false);
  const [isSyncingEmails, setIsSyncingEmails] = useState(false);
  const [isRemovingNoEmails, setIsRemovingNoEmails] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string>('');
  
  // Fetch the active workspace ID when the component mounts
  useEffect(() => {
    if (session?.user?.id) {
      // For client-side, we can use localStorage to get active workspace
      const storedWorkspaceId = typeof window !== 'undefined' 
        ? localStorage.getItem(`workspace_${session.user.id}`) 
        : null;
      
      if (storedWorkspaceId) {
        setWorkspaceId(storedWorkspaceId);
      }
    }
  }, [session?.user?.id]);
  
  const fetchAllFortnoxCustomers = async () => {
    if (!session?.user?.id) return;
    if (!workspaceId) {
      toast.error('No workspace found. Please reload the page and try again.');
      return;
    }
    
    try {
      setIsCheckingFortnox(true);
      const response = await fetch('/api/fortnox/customers/all', {
        headers: {
          'user-id': session.user.id,
          'workspace-id': workspaceId
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch customers from Fortnox');
      }
      
      const data = await response.json();
      toast.success(`Synced ${data.success} customers from Fortnox`);
      
      // Force a refresh of the page to reload customers
      window.location.reload();
    } catch (error) {
      console.error('Error fetching Fortnox customers:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to check for new customers');
    } finally {
      setIsCheckingFortnox(false);
    }
  };

  const syncCustomerEmails = async () => {
    if (!session?.user?.id) return;
    if (!workspaceId) {
      toast.error('No workspace found. Please reload the page and try again.');
      return;
    }
    
    try {
      setIsSyncingEmails(true);
      const response = await fetch('/api/fortnox/customers/sync-emails', {
        method: 'POST',
        headers: {
          'user-id': session.user.id,
          'workspace-id': workspaceId
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync customer emails');
      }
      
      const data = await response.json();
      toast.success(`Synced ${data.success} customers (${data.updated} updated, ${data.inserted} inserted) from Fortnox`);
      
      // Force a refresh of the page to reload customers
      window.location.reload();
    } catch (error) {
      console.error('Error syncing customer emails:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync emails');
    } finally {
      setIsSyncingEmails(false);
    }
  };

  const deleteAllCustomers = async () => {
    if (!session?.user?.id) return;
    if (!workspaceId) {
      toast.error('No workspace found. Please reload the page and try again.');
      return;
    }
    
    // Ask for confirmation before proceeding
    const confirmed = window.confirm('Are you sure you want to delete ALL customers? This action cannot be undone.');
    if (!confirmed) return;
    
    try {
      setIsDeletingCustomers(true);
      const response = await fetch('/api/customers/delete-all', {
        method: 'DELETE',
        headers: {
          'user-id': session.user.id,
          'workspace-id': workspaceId
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete customers');
      }
      
      toast.success('All customers have been deleted');
      
      // Force a refresh of the page
      window.location.reload();
    } catch (error) {
      console.error('Error deleting customers:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete customers');
    } finally {
      setIsDeletingCustomers(false);
    }
  };

  const removeCustomersWithoutEmails = async () => {
    if (!session?.user?.id) return;
    if (!workspaceId) {
      toast.error('No workspace found. Please reload the page and try again.');
      return;
    }
    
    try {
      setIsRemovingNoEmails(true);
      const response = await fetch('/api/customers/delete-blank-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': session.user.id,
          'workspace-id': workspaceId
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove customers without emails');
      }
      
      const data = await response.json();
      if (data.customers_removed > 0) {
        toast.success(`Removed ${data.customers_removed} customers without email addresses`);
        // Force a refresh of the page
        window.location.reload();
      } else {
        toast.info('No customers without emails found');
      }
    } catch (error) {
      console.error('Error removing customers without emails:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove customers without emails');
    } finally {
      setIsRemovingNoEmails(false);
    }
  };

  return (
    <SidebarDemo>
      <div className="p-6 flex-1 overflow-auto bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Customers</h1>
              <p className="text-muted-foreground mt-1">Manage your customers</p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={deleteAllCustomers}
                disabled={isDeletingCustomers || !workspaceId}
                className="bg-red-800 hover:bg-red-700 border-red-700 text-foreground"
              >
                {isDeletingCustomers ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete All Customers
                  </>
                )}
              </Button>
              <Button 
                onClick={removeCustomersWithoutEmails}
                disabled={isRemovingNoEmails || !workspaceId}
                className="bg-amber-800 hover:bg-amber-700 border-amber-700 text-foreground"
              >
                {isRemovingNoEmails ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Delete No-Email Customers 
                  </>
                )}
              </Button>
              <Button 
                onClick={syncCustomerEmails}
                disabled={isSyncingEmails || !workspaceId}
                className="bg-blue-800 hover:bg-blue-700 border-blue-700 text-foreground"
              >
                {isSyncingEmails ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing Emails...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Sync Emails
                  </>
                )}
              </Button>
              <Button 
                onClick={fetchAllFortnoxCustomers}
                disabled={isCheckingFortnox || !workspaceId}
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
                    Refresh from Fortnox
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-neutral-950 via-neutral-900 to-neutral-950 opacity-50"></div>
            
            <div className="relative z-10">
              <CustomersView />
            </div>
          </div>
        </div>
      </div>
    </SidebarDemo>
  );
} 