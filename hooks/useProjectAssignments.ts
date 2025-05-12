"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useWorkspaceMembers, WorkspaceMember } from './useWorkspaceMembers';
import { checkPermission, getActiveWorkspaceId } from '@/lib/permission';

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
  const { data: session } = useSession();
  const { members } = useWorkspaceMembers();
  const [taskAssignments, setTaskAssignments] = useState<TaskAssignment[]>([]);
  const [checklistAssignments, setChecklistAssignments] = useState<ChecklistAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch all assignments
  useEffect(() => {
    async function fetchAssignments() {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Get all checklist assignments
        const { data: checklistData, error: checklistError } = await supabase
          .from('task_checklist_assignments')
          .select('*');

        if (checklistError) {
          console.error('[Assignments] Error fetching checklist assignments:', checklistError);
          throw checklistError;
        }

        setChecklistAssignments(checklistData || []);
        
        console.log('[Assignments] Fetched checklist assignments:', checklistData?.length || 0);
      } catch (err) {
        console.error('[Assignments] Error:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch assignments'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchAssignments();
  }, [session?.user?.id]);

  // Get member details by user ID
  const getMemberByUserId = (userId: string): WorkspaceMember | undefined => {
    return members.find(member => member.user_id === userId);
  };

  // Assign a project to a user
  const assignProject = async (projectId: string, userId: string) => {
    if (!session?.user?.id) {
      toast.error('You must be signed in to assign projects');
      return false;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .update({ assigned_to: userId })
        .eq('id', projectId);

      if (error) {
        console.error('[Assignments] Error assigning project:', error);
        throw error;
      }

      toast.success('Project assigned successfully');
      return true;
    } catch (err) {
      console.error('[Assignments] Error:', err);
      toast.error('Failed to assign project');
      return false;
    }
  };

  // Assign a task to a user
  async function assignTask(taskId: string, userId: string) {
    if (!session?.user?.id) {
      console.log('User not signed in, aborting assignment');
      toast.error('You must be signed in to assign tasks');
      return false;
    }
    const workspaceId = await getActiveWorkspaceId(session.user.id);
    if (!workspaceId) {
      console.log('No active workspace found, aborting assignment');
      toast.error('No active workspace found');
      return false;
      }
    const isUserAdmin = await checkPermission(session.user.id, workspaceId, 'edit_projects');
    console.log(`Permission check result for user ${session.user.id} on workspace ${workspaceId}:`, isUserAdmin);
    if (!isUserAdmin) {
      console.log('User does not have permission, aborting assignment');
      toast.error('You do not have permission to assign tasks');
      return false;
    }
    try {
      const { error, data } = await supabase.from('project_tasks').update({ assigned_to: userId }).eq('id', taskId).select();
      if (error || !data || data.length === 0) {
        console.error('Assignment failed: Task not found or update error', error);
        toast.error('Failed to assign task; please verify task exists');
        return false;
      }
      console.log('Task assigned successfully:', data);
      toast.success('Task assigned successfully');
      return true;
    } catch (err) {
      console.error('[Assignments] Error assigning task:', err);
      toast.error('Failed to assign task due to an unexpected error');
      return false;
    }
  }

  // Assign a checklist item to a user
  const assignChecklistItem = async (taskId: string, checklistItemIndex: number, userId: string) => {
    if (!session?.user?.id) {
      console.log('User not signed in, aborting checklist assignment');
      toast.error('You must be signed in to assign checklist items');
      return false;
    }
    const workspaceId = await getActiveWorkspaceId(session.user.id);
    if (!workspaceId) {
      console.log('No active workspace found, aborting checklist assignment');
      toast.error('No active workspace found');
      return false;
    }
    const isUserAdmin = await checkPermission(session.user.id, workspaceId, 'edit_projects');
    console.log(`Permission check result for user ${session.user.id} on workspace ${workspaceId}:`, isUserAdmin);
    if (!isUserAdmin) {
      console.log('User does not have permission, aborting checklist assignment');
      toast.error('You do not have permission to assign checklist items');
      return false;
    }
    try {
      const { data: existingAssignment, error: queryError } = await supabase
        .from('task_checklist_assignments')
        .select('*')
        .eq('task_id', taskId)
        .eq('checklist_item_index', checklistItemIndex)
        .single();

      if (queryError && queryError.code !== 'PGRST116') throw queryError;

      let result;
      if (existingAssignment) {
        result = await supabase
          .from('task_checklist_assignments')
          .update({ assigned_to: userId })
          .eq('id', existingAssignment.id);
      } else {
        result = await supabase
          .from('task_checklist_assignments')
          .insert({ task_id: taskId, checklist_item_index: checklistItemIndex, assigned_to: userId });
      }

      if (result.error) {
        console.error('[Assignments] Error assigning checklist item:', result.error);
        toast.error('Failed to assign checklist item');
        return false;
      }

      toast.success('Checklist item assigned successfully');
      return true;
    } catch (err) {
      console.error('[Assignments] Error:', err);
      toast.error('Failed to assign checklist item');
      return false;
    }
  };

  // Remove assignment
  const removeAssignment = async (type: AssignmentType, id: string, checklistItemIndex?: number) => {
    if (!session?.user?.id) {
      toast.error('You must be signed in to remove assignments');
      return false;
    }

    try {
      switch (type) {
        case 'project':
          const { error: projectError } = await supabase
            .from('projects')
            .update({ assigned_to: null })
            .eq('id', id);

          if (projectError) throw projectError;
          break;

        case 'task':
          const { error: taskError } = await supabase
            .from('project_tasks')
            .update({ assigned_to: null })
            .eq('id', id);

          if (taskError) throw taskError;
          break;

        case 'checklist':
          if (checklistItemIndex === undefined) {
            throw new Error('Checklist item index is required for checklist assignments');
          }

          const { error: checklistError } = await supabase
            .from('task_checklist_assignments')
            .delete()
            .eq('task_id', id)
            .eq('checklist_item_index', checklistItemIndex);

          if (checklistError) throw checklistError;

          // Refresh assignments
          const { data: refreshData, error: refreshError } = await supabase
            .from('task_checklist_assignments')
            .select('*');

          if (refreshError) {
            console.error('[Assignments] Error refreshing assignments:', refreshError);
          } else {
            setChecklistAssignments(refreshData || []);
          }
          break;
      }

      toast.success('Assignment removed successfully');
      return true;
    } catch (err) {
      console.error('[Assignments] Error removing assignment:', err);
      toast.error('Failed to remove assignment');
      return false;
    }
  };

  // Get checklist assignments for a specific task
  const getChecklistAssignmentsForTask = (taskId: string): ChecklistAssignment[] => {
    return checklistAssignments.filter(assignment => assignment.task_id === taskId);
  };

  // Get assigned member for a checklist item
  const getAssignedMemberForChecklistItem = (taskId: string, itemIndex: number): WorkspaceMember | undefined => {
    const assignment = checklistAssignments.find(
      a => a.task_id === taskId && a.checklist_item_index === itemIndex
    );
    
    if (!assignment) return undefined;
    
    return getMemberByUserId(assignment.assigned_to);
  };

  return {
    isLoading,
    error,
    taskAssignments,
    checklistAssignments,
    getMemberByUserId,
    assignProject,
    assignTask,
    assignChecklistItem,
    removeAssignment,
    getChecklistAssignmentsForTask,
    getAssignedMemberForChecklistItem
  };
} 