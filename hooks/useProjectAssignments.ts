"use client";

import { useState, useEffect, useCallback } from 'react';
// Removed direct supabase import - using API endpoints instead
import { useAuth } from '@/lib/auth-client';
import { toast } from 'sonner';
import { useWorkspaceMembers, WorkspaceMember } from './useWorkspaceMembers';

export interface TaskAssignment {
  id: string;
  task_id: string;
  assigned_to: string;
  created_at: string;
}

export interface ChecklistAssignment {
  id: string;
  task_id: string;
  checklist_item_index: number;
  assigned_to: string;
  created_at: string;
}

export type AssignmentType = 'project' | 'task' | 'checklist';

/**
 * Hook to manage project, task and checklist assignments
 */
export function useProjectAssignments() {
  const { user } = useAuth();
  const { members } = useWorkspaceMembers();
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignment[]>([]);
  const [checklistAssignments, setChecklistAssignments] = useState<ChecklistAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch all assignments - note: this hook now primarily manages project assignments via API
  // Task and checklist assignments still use direct Supabase calls temporarily
  const fetchAssignments = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // TODO: Create API endpoint for task checklist assignments to maintain consistency
      // For now, keeping direct calls until all assignment endpoints are created
      console.warn('[Assignments] Still using direct Supabase calls for checklist assignments - should be migrated to API endpoints');
      
      // Note: This is a temporary direct call - should be replaced with API endpoint
      // const { data: checklistData, error: checklistError } = await supabase
      //   .from('task_checklist_assignments')
      //   .select('*');
      // if (checklistError) throw checklistError;
      // setChecklistAssignments(checklistData || []);
      
      // For now, set empty array to avoid auth issues
      setChecklistAssignments([]);

    } catch (err) {
      console.error('[Assignments] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch assignments'));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Get member details by user ID
  const getMemberByUserId = (userId: string): WorkspaceMember | undefined => {
    return members.find(member => member.user_id === userId);
  };

  // Assign a project to a user using API endpoint
  const assignProject = async (projectId: string, userId?: string) => {
    if (!user) {
      toast.error('You must be signed in to assign projects');
      return false;
    }

    try {
      const response = await fetch('/api/project-assignments', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include NextAuth cookies
        body: JSON.stringify({
          project_id: projectId,
          assigned_to: userId || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign project');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to assign project');
      }

      toast.success(result.message || (userId ? 'Project assigned successfully' : 'Project unassigned'));
      return true;
    } catch (err) {
      console.error('[Assignments] Error assigning project:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to assign project');
      return false;
    }
  };

  // DISABLED: Direct Supabase calls cause authentication issues
  // TODO: Create API endpoint for task assignments to maintain consistency with project assignments
  async function assignTask(taskId: string, userId: string) {
    console.warn('[Assignments] assignTask is disabled - uses direct Supabase calls that conflict with NextAuth');
    toast.error('Task assignment is temporarily disabled. Please use the task assignment UI in the projects page.');
    return false;
  }

  // DISABLED: Direct Supabase calls cause authentication issues
  // TODO: Create API endpoint for checklist assignments to maintain consistency
  const assignChecklistItem = async (taskId: string, checklistItemIndex: number, userId: string) => {
    console.warn('[Assignments] assignChecklistItem is disabled - uses direct Supabase calls that conflict with NextAuth');
    toast.error('Checklist assignment is temporarily disabled. Please use the checklist assignment UI in the projects page.');
    return false;
  };

  // DISABLED: Direct Supabase calls cause authentication issues
  // TODO: Create API endpoint for removing assignments to maintain consistency
  const removeAssignment = async (type: AssignmentType, id: string, checklistItemIndex?: number) => {
    console.warn('[Assignments] removeAssignment is disabled - uses direct Supabase calls that conflict with NextAuth');
    toast.error('Assignment removal is temporarily disabled. Please use the assignment UI in the projects page.');
    return false;
  };

  // Get all checklist assignments for a specific task
  const getChecklistAssignmentsForTask = (taskId: string): ChecklistAssignment[] => {
    return checklistAssignments.filter(a => a.task_id === taskId);
  };

  // Get the assigned member for a specific checklist item
  const getAssignedMemberForChecklistItem = (taskId: string, itemIndex: number): WorkspaceMember | undefined => {
    const assignment = checklistAssignments.find(
      a => a.task_id === taskId && a.checklist_item_index === itemIndex
    );
    return assignment ? getMemberByUserId(assignment.assigned_to) : undefined;
  };

  return {
    taskAssignments,
    checklistAssignments,
    isLoading,
    error,
    assignProject,
    assignTask,
    assignChecklistItem,
    removeAssignment,
    getChecklistAssignmentsForTask,
    getAssignedMemberForChecklistItem,
    getMemberByUserId,
  };
} 