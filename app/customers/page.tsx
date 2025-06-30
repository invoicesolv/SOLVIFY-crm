"use client";

import { CustomersView } from "@/components/customers";
import { SidebarDemo } from "@/components/ui/code.demo";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Plus, Trash2, Mail, Copy } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from '@/lib/auth-client';
import FortnoxSyncButton from '@/app/components/FortnoxSyncButton';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function CustomersPage() {
  const { user, session } = useAuth();
  const { activeWorkspaceId, isLoading: workspaceLoading, error: workspaceError } = useWorkspace();
  const [isCheckingFortnox, setIsCheckingFortnox] = useState(false);
  const [isDeletingCustomers, setIsDeletingCustomers] = useState(false);
  const [isSyncingEmails, setIsSyncingEmails] = useState(false);
  const [isRemovingNoEmails, setIsRemovingNoEmails] = useState(false);
  
  // Show workspace error if any
  useEffect(() => {
    if (workspaceError) {
      toast.error(`Workspace error: ${workspaceError}`);
    }
  }, [workspaceError]);
  
  const fetchAllFortnoxCustomers = async () => {
    if (!user?.id || !session?.access_token) return;
    if (!activeWorkspaceId) {
      toast.error('No workspace found. Please ensure you have access to a workspace.');
      return;
    }
    
    try {
      setIsCheckingFortnox(true);
      const response = await fetch('/api/fortnox/customers/all', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'user-id': user.id,
          'workspace-id': activeWorkspaceId
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
    if (!user?.id || !session?.access_token) return;
    if (!activeWorkspaceId) {
      toast.error('No workspace found. Please ensure you have access to a workspace.');
      return;
    }
    
    try {
      setIsSyncingEmails(true);
      const response = await fetch('/api/fortnox/customers/sync-emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'user-id': user.id,
          'workspace-id': activeWorkspaceId
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
    if (!user?.id || !session?.access_token) return;
    if (!activeWorkspaceId) {
      toast.error('No workspace found. Please ensure you have access to a workspace.');
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
          'Authorization': `Bearer ${session.access_token}`,
          'user-id': user.id,
          'workspace-id': activeWorkspaceId
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
    if (!user?.id || !session?.access_token) return;
    if (!activeWorkspaceId) {
      toast.error('No workspace found. Please ensure you have access to a workspace.');
      return;
    }
    
    try {
      setIsRemovingNoEmails(true);
      const response = await fetch('/api/customers/delete-blank-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'user-id': user.id,
          'workspace-id': activeWorkspaceId
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

  // Show loading state if workspace is still being fetched
  if (workspaceLoading) {
    return (
      <SidebarDemo>
        <div className="p-6 flex-1 overflow-auto bg-background">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading workspace...</span>
            </div>
          </div>
        </div>
      </SidebarDemo>
    );
  }

  return (
    <SidebarDemo>
      <div className="p-6 flex-1 overflow-auto bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Customers</h1>
              <p className="text-muted-foreground mt-1">Manage your customers</p>
              {activeWorkspaceId && (
                <p className="text-xs text-muted-foreground mt-1">Workspace: {activeWorkspaceId}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={deleteAllCustomers}
                disabled={isDeletingCustomers || !activeWorkspaceId}
                className="bg-red-800 hover:bg-red-700 border-red-700 text-foreground"
              >
                {isDeletingCustomers ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All
                  </>
                )}
              </Button>
              
              <Button 
                onClick={removeCustomersWithoutEmails}
                disabled={isRemovingNoEmails || !activeWorkspaceId}
                variant="outline"
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
              >
                {isRemovingNoEmails ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Remove No Email
                  </>
                )}
              </Button>
              
              <Button 
                onClick={syncCustomerEmails}
                disabled={isSyncingEmails || !activeWorkspaceId}
                variant="outline"
              >
                {isSyncingEmails ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Emails
                  </>
                )}
              </Button>

              <Button 
                onClick={fetchAllFortnoxCustomers}
                disabled={isCheckingFortnox || !activeWorkspaceId}
                variant="outline"
              >
                {isCheckingFortnox ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Fetch All
                  </>
                )}
              </Button>
              
              <FortnoxSyncButton />
            </div>
          </div>
          
          <CustomersView />
        </div>
      </div>
    </SidebarDemo>
  );
} 