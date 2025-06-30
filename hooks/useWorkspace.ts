import { useState, useEffect, useCallback } from 'react';
import { fetchWorkspaceData, getActiveWorkspaceFromAPI, Workspace } from '@/lib/workspace-utils';
import { useAuth } from '@/lib/auth-client';

interface UseWorkspaceResult {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setActiveWorkspace: (workspaceId: string) => void;
}

/**
 * React hook for managing workspace data
 * This replaces direct Supabase queries and localStorage access
 */
export function useWorkspace(): UseWorkspaceResult {
  const { session } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!session?.user) {
      console.log('[useWorkspace] No session or user available');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('[useWorkspace] Fetching workspaces with NextAuth session');

      // Call workspaces API endpoint - NextAuth session will be handled by server
      const response = await fetch('/api/workspaces', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for NextAuth session
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.statusText}`);
      }

      const workspacesData = await response.json();
      console.log('[useWorkspace] Fetched workspaces:', workspacesData.length);
      setWorkspaces(workspacesData);
      
      // Set the first workspace as active if any exist
      if (workspacesData.length > 0) {
        const adminWorkspace = workspacesData.find((w: Workspace) => w.role === 'admin');
        const activeId = adminWorkspace?.id || workspacesData[0].id;
        setActiveWorkspaceIdState(activeId);
        console.log('[useWorkspace] Set active workspace:', activeId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch workspace data';
      setError(errorMessage);
      console.error('[useWorkspace] Error fetching workspace data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setActiveWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceIdState(workspaceId);
    // The actual persistence is handled by the API
  }, []);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || null;

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    isLoading,
    error,
    refetch: fetchData,
    setActiveWorkspace
  };
} 