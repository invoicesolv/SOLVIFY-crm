"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from 'next-auth/react';

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
  const { data: session } = useSession();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchWorkspaceMembers() {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        console.log('[Workspace] Fetching workspaces for user ID:', session.user.id);
        
        // Get user's workspaces
        const { data: userWorkspaces, error: workspacesError } = await supabase
          .from('team_members')
          .select('workspace_id')
          .eq('user_id', session.user.id);

        if (workspacesError) {
          console.error('[Workspace] Error fetching user workspaces:', workspacesError);
          throw workspacesError;
        }

        if (!userWorkspaces || userWorkspaces.length === 0) {
          console.log('[Workspace] No workspaces found for user');
          setMembers([]);
          setIsLoading(false);
          return;
        }

        const workspaceIds = userWorkspaces.map(w => w.workspace_id);
        console.log('[Workspace] Found workspaces:', workspaceIds);

        // Get all members from user's workspaces
        const { data: teamMembers, error: membersError } = await supabase
          .from('team_members')
          .select('*')
          .in('workspace_id', workspaceIds);

        if (membersError) {
          console.error('[Workspace] Error fetching team members:', membersError);
          throw membersError;
        }

        console.log('[Workspace] Fetched team members:', teamMembers?.length || 0);
        setMembers(teamMembers || []);
      } catch (err) {
        console.error('[Workspace] Error:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch workspace members'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchWorkspaceMembers();
  }, [session?.user?.id]);

  return { members, isLoading, error };
} 