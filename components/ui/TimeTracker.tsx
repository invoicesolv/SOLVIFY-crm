import React, { useState, useEffect } from 'react';
import { Clock, Play, Square, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-client';
import { getActiveWorkspaceId } from '@/lib/permission';
import { toast } from 'sonner';

interface TimeTrackerProps {
  projectId: string;
  taskId: string;
  subtaskId?: number;
  subtaskLabel?: string;
  className?: string;
}

export function TimeTracker({ 
  projectId,
  taskId,
  subtaskId,
  subtaskLabel,
  className 
}: TimeTrackerProps) {
  const { user } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0); // in seconds
  const [activeTrackingId, setActiveTrackingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [todayTotal, setTodayTotal] = useState(0); // in seconds
  const [hovering, setHovering] = useState(false);

  // Define fetchTodayTotal function before it's used in useEffect
  const fetchTodayTotal = async () => {
    if (!user?.id || !taskId) return 0;
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const query = supabase
        .from('time_tracking')
        .select('duration_minutes')
        .eq('user_id', user.id)
        .eq('task_id', taskId);
      
      if (subtaskId !== undefined) {
        query.eq('subtask_index', subtaskId);
      } else {
        query.is('subtask_index', null);
      }
      
      query.gte('start_time', today.toISOString());
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const totalMinutes = data.reduce((acc, curr) => {
        return acc + (curr.duration_minutes || 0);
      }, 0);
      
      setTodayTotal(totalMinutes * 60); // Convert to seconds
      return totalMinutes;
    } catch (error) {
      console.error('Error fetching today total:', error);
      return 0;
    }
  };

  // Check if there's an active tracking session when component mounts
  useEffect(() => {
    const checkActiveTracking = async () => {
      if (!user?.id || !taskId) return false;
      
      try {
        const { data, error } = await supabase
          .from('time_tracking')
          .select('*')
          .eq('user_id', user.id)
          .eq('task_id', taskId)
          .is('end_time', null)
          .maybeSingle();
        
        if (error) throw error;
        
        if (data && subtaskId !== undefined) {
          // Only apply if subtask IDs match
          if (data.subtask_index === subtaskId) {
            setIsTracking(true);
            setStartTime(new Date(data.start_time));
            setActiveTrackingId(data.id);
          }
        } else if (data && subtaskId === undefined) {
          // This is for task-level tracking with no subtask
          if (!data.subtask_index) {
            setIsTracking(true);
            setStartTime(new Date(data.start_time));
            setActiveTrackingId(data.id);
          }
        }

        // Get today's total
        await fetchTodayTotal();
        return true;
      } catch (err: any) {
        console.error('Error checking active tracking:', err);
        return false;
      }
    };

    checkActiveTracking();
  }, [user, taskId, subtaskId]);

  // Update elapsed time while tracking
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isTracking && startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const seconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedTime(seconds);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    
    return () => clearInterval(interval);
  }, [isTracking, startTime]);

  const startTracking = async () => {
    if (!user?.id || !taskId || isTracking) return;
    
    setIsLoading(true);
    try {
      const workspaceId = await getActiveWorkspaceId(user.id);
      if (!workspaceId) {
        toast.error('No active workspace found');
        return;
      }
      
      const now = new Date();
      setStartTime(now);
      
      const { data, error } = await supabase
        .from('time_tracking')
        .insert({
          project_id: projectId,
          task_id: taskId,
          subtask_index: subtaskId,
          description: subtaskLabel || 'Time tracking', 
          user_id: user.id,
          workspace_id: workspaceId,
          start_time: now.toISOString(),
          is_billable: true
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setActiveTrackingId(data.id);
      setIsTracking(true);
      toast.success('Timer started');
    } catch (error) {
      console.error('Error starting time tracking:', error);
      toast.error('Failed to start timer');
    } finally {
      setIsLoading(false);
    }
  };

  const stopTracking = async () => {
    if (!activeTrackingId || !isTracking) return;
    
    setIsLoading(true);
    try {
      const now = new Date();
      const startTimeObj = startTime || new Date();
      const durationMinutes = Math.round((now.getTime() - startTimeObj.getTime()) / 60000);
      
      const { error } = await supabase
        .from('time_tracking')
        .update({
          end_time: now.toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('id', activeTrackingId);
      
      if (error) throw error;
      
      setIsTracking(false);
      setActiveTrackingId(null);
      setStartTime(null);
      
      // Update today's total
      await fetchTodayTotal();
      
      toast.success(`Timer stopped: ${formatTime(durationMinutes * 60)} tracked`);
    } catch (error) {
      console.error('Error stopping time tracking:', error);
      toast.error('Failed to stop timer');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const totalTimeDisplay = () => {
    const total = todayTotal + (isTracking ? elapsedTime : 0);
    return formatTime(total);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  return (
    <div 
      className={cn(
        "flex items-center gap-2 text-sm font-medium z-50 pointer-events-auto w-full", 
        isTracking ? "text-green-600 dark:text-green-400" : "text-blue-400",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <Clock 
        className="h-4 w-4 cursor-pointer" 
        onClick={handleClick} 
      />
      
      {isTracking ? (
        <>
          <span className="flex-grow cursor-pointer" onClick={handleClick}>
            {formatTime(elapsedTime)}
          </span>
          <button 
            type="button"
            className="h-7 w-7 p-0 bg-gray-200 dark:bg-muted text-red-400 hover:text-red-300 hover:bg-gray-300 dark:hover:bg-neutral-600 rounded-md flex items-center justify-center relative z-50"
            onClick={handleClick}
            disabled={isLoading}
          >
            <Square className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <span className="flex-grow cursor-pointer" onClick={handleClick}>
            {totalTimeDisplay()}
          </span>
          <button 
            type="button"
            className="h-7 w-7 p-0 bg-gray-200 dark:bg-muted text-green-600 dark:text-green-400 hover:text-green-400 hover:bg-gray-300 dark:hover:bg-neutral-600 rounded-md flex items-center justify-center relative z-50"
            onClick={handleClick}
            disabled={isLoading}
          >
            <Play className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
} 