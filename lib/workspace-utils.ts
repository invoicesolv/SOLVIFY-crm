import { getActiveWorkspaceId } from '@/lib/permission';
import { getUserFromToken } from '@/lib/auth-utils';
import { NextRequest } from 'next/server';

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  role: 'admin' | 'member';
}

/**
 * Utility function to fetch workspace data from the standardized API
 * This should be used instead of direct Supabase queries
 */
export async function fetchWorkspaceData(): Promise<Workspace[]> {
  const response = await fetch('/api/workspaces', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workspaces: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Utility function to get the user's active workspace ID from the API
 * This replaces direct database queries and localStorage access
 */
export async function getActiveWorkspaceFromAPI(): Promise<string | null> {
  try {
    const workspaces = await fetchWorkspaceData();
    
    if (workspaces.length === 0) {
      return null;
    }

    // Prioritize admin workspaces, then most recent
    const adminWorkspace = workspaces.find(w => w.role === 'admin');
    if (adminWorkspace) {
      return adminWorkspace.id;
    }

    // Return the first workspace if no admin workspace found
    return workspaces[0].id;
  } catch (error) {
    console.error('Error fetching active workspace from API:', error);
    return null;
  }
}

/**
 * Server-side utility to get user ID and workspace ID for API routes
 * This standardizes the pattern used across API endpoints
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const user = await getUserFromToken(request);
  return user?.id || null;
}

/**
 * Server-side utility to get active workspace ID for API routes
 * This uses the centralized getActiveWorkspaceId function
 */
export async function getActiveWorkspaceIdForAPI(request: NextRequest): Promise<string | null> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return null;
  }
  
  return getActiveWorkspaceId(userId);
}

/**
 * Client-side hook-like utility for components that need workspace data
 * This provides a standardized way to access workspace information
 */
export async function useWorkspaceData() {
  try {
    const workspaces = await fetchWorkspaceData();
    const activeWorkspaceId = await getActiveWorkspaceFromAPI();
    
    return {
      workspaces,
      activeWorkspaceId,
      activeWorkspace: workspaces.find(w => w.id === activeWorkspaceId) || null,
      isLoading: false,
      error: null
    };
  } catch (error) {
    return {
      workspaces: [],
      activeWorkspaceId: null,
      activeWorkspace: null,
      isLoading: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create a new workspace using the standardized API
 */
export async function createWorkspace(name: string, ownerId: string): Promise<Workspace> {
  const response = await fetch('/api/workspaces', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      owner_id: ownerId
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create workspace: ${response.statusText}`);
  }

  const result = await response.json();
  return result.workspace;
} 