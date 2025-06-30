"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-client';

export interface WorkspaceMember {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  email: string;
  is_admin: boolean;
  role: string;
  permissions: any;
}

/**
 * Hook to fetch workspace members
 * @returns Object containing workspace members, loading state, and error
 */
export function useWorkspaceMembers() {
  const { user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkspaceMembers = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: teamMembers, error: membersError } = await supabase
        .from('team_members')
        .select('*');

      if (membersError) {
        throw membersError;
      }

      setMembers(teamMembers || []);
    } catch (err) {
      console.error('[Workspace] Error fetching members:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch workspace members'));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWorkspaceMembers();
  }, [fetchWorkspaceMembers]);

  return { members, isLoading, error };
} 