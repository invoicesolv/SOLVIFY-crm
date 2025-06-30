'use client';

import React, { useState, useEffect } from 'react';
import { X, User, CheckCheck, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface NotificationPopupProps {
  className?: string;
}

export function NotificationPopup({ className }: NotificationPopupProps) {
  const { notifications } = useNotifications();
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([]);
  const [lastNotificationCount, setLastNotificationCount] = useState(0);

  // Check for new notifications and show popup
  useEffect(() => {
    const currentCount = notifications.length;
    
    if (currentCount > lastNotificationCount && lastNotificationCount > 0) {
      // Get the new notifications (assuming they're at the beginning of the array)
      const newNotifications = notifications.slice(0, currentCount - lastNotificationCount);
      
      // Only show task assignment notifications as popups
      const taskAssignmentNotifications = newNotifications.filter(
        n => n.type === 'task_assignment' && !n.read
      );
      
      if (taskAssignmentNotifications.length > 0) {
        setVisibleNotifications(prev => [...taskAssignmentNotifications, ...prev]);
        
        // Auto-hide after 8 seconds
        taskAssignmentNotifications.forEach(notification => {
          setTimeout(() => {
            setVisibleNotifications(prev => 
              prev.filter(n => n.id !== notification.id)
            );
          }, 8000);
        });
      }
    }
    
    setLastNotificationCount(currentCount);
  }, [notifications, lastNotificationCount]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'task_assignment':
        return <User className="h-5 w-5 text-blue-500" />;
      case 'task_completion':
        return <CheckCheck className="h-5 w-5 text-green-500" />;
      case 'project_update':
        return <Calendar className="h-5 w-5 text-purple-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const dismissNotification = (notificationId: string) => {
    setVisibleNotifications(prev => 
      prev.filter(n => n.id !== notificationId)
    );
  };

  const handleNotificationClick = (notification: Notification) => {
    // Navigate to the relevant page
    if (notification.task_id && notification.project_id) {
      window.location.href = `/projects/${notification.project_id}`;
    } else if (notification.project_id) {
      window.location.href = `/projects/${notification.project_id}`;
    }
    
    // Dismiss the popup
    dismissNotification(notification.id);
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'just now';
    }
  };

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className={cn("fixed top-4 right-4 z-50 space-y-3", className)}>
      {visibleNotifications.map((notification) => (
        <Card
          key={notification.id}
          className="w-80 shadow-lg border-l-4 border-l-blue-500 bg-white dark:bg-gray-900 animate-in slide-in-from-right-full duration-300"
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getNotificationIcon(notification.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {notification.title}
                  </h4>
                  <Badge variant="secondary" className="text-xs">
                    New
                  </Badge>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                  {notification.message}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimeAgo(notification.created_at)}
                  </span>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleNotificationClick(notification)}
                      className="h-7 px-3 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950"
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissNotification(notification.id)}
                      className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 