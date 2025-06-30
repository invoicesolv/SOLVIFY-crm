"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-client';

// Define Project type to match the API response
interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  customer_name?: string;
  start_date?: string;
  end_date?: string;
  user_id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  project_tasks?: ProjectTask[];
}

interface ProjectTask {
  id: string;
  title: string;
  status: string;
  due_date?: string;
  deadline?: string;
  priority?: string;
  checklist?: any;
  progress: number;
  assigned_to?: string;
  created_at: string;
  tags?: any;
  estimated_hours?: number;
  actual_hours?: number;
  completion_percentage?: number;
  dependencies?: any;
  attachments?: any;
}

interface ProjectStats {
  totalCount: number;
  activeCount: number;
  completedCount: number;
  onHoldCount: number;
}

interface ProjectPagination {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  hasMore: boolean;
}

interface UseProjectsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
  status?: 'all' | 'active' | 'on-hold' | 'completed';
}

/**
 * Hook to fetch and manage projects following the documented pattern
 * @param options - Filtering and pagination options
 * @returns Object containing projects, stats, loading state, and any error
 */
export function useProjects(options: UseProjectsOptions = {}) {
  const { user, session } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    totalCount: 0,
    activeCount: 0,
    completedCount: 0,
    onHoldCount: 0
  });
  const [pagination, setPagination] = useState<ProjectPagination>({
    page: 1,
    pageSize: 1000,
    totalPages: 0,
    totalCount: 0,
    hasMore: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!user?.id || !session) {
      console.log('[useProjects] Missing user or session:', { 
        hasUser: !!user?.id, 
        hasSession: !!session,
        sessionKeys: session ? Object.keys(session) : []
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[useProjects] Fetching projects via API...', {
        userId: user.id,
        userEmail: user.email,
        options
      });
      
      // Build query parameters
      const searchParams = new URLSearchParams();
      if (options.page) searchParams.set('page', options.page.toString());
      if (options.pageSize) searchParams.set('pageSize', options.pageSize.toString());
      if (options.search) searchParams.set('search', options.search);
      if (options.orderBy) searchParams.set('orderBy', options.orderBy);
      if (options.orderDir) searchParams.set('orderDir', options.orderDir);
      if (options.status && options.status !== 'all') searchParams.set('status', options.status);
      
      // Use API endpoint with NextAuth session - no authorization header needed
      // The withAuth wrapper will handle authentication on the server side
      const response = await fetch(`/api/projects?${searchParams.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include NextAuth cookies
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('[useProjects] Received projects:', data.projects?.length || 0);
      
      // Calculate statistics from projects
      const projectStats = (data.projects || []).reduce((acc: ProjectStats, project: Project) => {
        acc.totalCount++;
        switch (project.status) {
          case 'active':
            acc.activeCount++;
            break;
          case 'completed':
            acc.completedCount++;
            break;
          case 'on-hold':
            acc.onHoldCount++;
            break;
        }
        return acc;
      }, {
        totalCount: 0,
        activeCount: 0,
        completedCount: 0,
        onHoldCount: 0
      });

      setProjects(data.projects || []);
      setStats(projectStats);
      setPagination(data.pagination || {
        page: 1,
        pageSize: 1000,
        totalPages: 0,
        totalCount: 0,
        hasMore: false
      });

    } catch (err) {
      console.error('[useProjects] Project fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch projects'));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, session, JSON.stringify(options)]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Refetch function to allow manual refresh
  const refetch = () => {
    fetchProjects();
  };

  return { 
    projects, 
    stats, 
    pagination, 
    isLoading, 
    error, 
    refetch 
  };
}
