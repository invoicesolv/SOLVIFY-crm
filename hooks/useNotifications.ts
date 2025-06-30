'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-client';
import { toast } from 'sonner';

export interface Notification {
  id: string;
  user_id: string;
  workspace_id: string;
  title: string;
  message: string;
  notification_type: 'task' | 'project' | 'calendar' | 'chat' | 'system';
  entity_id?: string;
  entity_type?: string;
  read_at?: string | null;
  created_at: string;
  // Computed properties for backwards compatibility
  type: 'task_assignment' | 'task_completion' | 'project_update' | 'general';
  read: boolean;
  task_id?: string;
  project_id?: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transform database notification to component-friendly format
  const transformNotification = (dbNotification: any): Notification => {
    // Map notification_type to component type
    let type: Notification['type'] = 'general';
    if (dbNotification.notification_type === 'task') {
      type = 'task_assignment';
    } else if (dbNotification.notification_type === 'project') {
      type = 'project_update';
    }

    return {
      ...dbNotification,
      type,
      read: !!dbNotification.read_at,
      task_id: dbNotification.entity_type === 'task' ? dbNotification.entity_id : undefined,
      project_id: dbNotification.entity_type === 'project' ? dbNotification.entity_id : undefined,
    };
  };

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      // RLS ensures we only get notifications for the logged-in user.
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const transformedNotifications = (data || []).map(transformNotification);
      setNotifications(transformedNotifications);
      setUnreadCount(transformedNotifications.filter((n: Notification) => !n.read).length);
      setError(null);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Create a new notification
  const createNotification = useCallback(async (notification: {
    type: string;
    title: string;
    message: string;
    user_id: string;
    workspace_id?: string;
    task_id?: string;
    project_id?: string;
    metadata?: any;
  }) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create notification');
      }

      // Refresh notifications to include the new one
      await fetchNotifications();
      
      return data.notification;
    } catch (err) {
      console.error('Error creating notification:', err);
      throw err;
    }
  }, [fetchNotifications]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user?.id) return;
    try {
      // RLS will prevent updating other users' notifications
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);
      
      if (updateError) throw updateError;

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
      toast.error('Failed to mark notification as read');
    }
  }, [user?.id]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .in('id', unreadIds);

      if (updateError) throw updateError;

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true, read_at: new Date().toISOString() })));
      setUnreadCount(0);
      
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      toast.error('Failed to mark all notifications as read');
    }
  }, [user?.id, notifications]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [user?.id, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    createNotification,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
} 