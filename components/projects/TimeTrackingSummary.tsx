import React, { useState, useEffect } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { Clock, Calendar, User, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TimeTrackingRecord {
  id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  description: string;
  user_id: string;
  project_id: string;
  task_id: string;
  subtask_index?: number;
  user_name?: string;
  task_title?: string;
  subtask_text?: string;
  project_name?: string;
}

interface TimeTrackingSummaryProps {
  projectId: string;
  className?: string;
}

export function TimeTrackingSummary({ projectId, className }: TimeTrackingSummaryProps) {
  const [records, setRecords] = useState<TimeTrackingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'today'|'week'|'month'|'all'>('week');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [users, setUsers] = useState<{id: string, name: string}[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  
  useEffect(() => {
    if (projectId) {
      fetchTimeRecords();
      fetchProjectUsers();
    }
  }, [projectId, timeFilter, userFilter]);
  
  const fetchProjectUsers = async () => {
    try {
      // Get all users who tracked time for this project
      const { data, error } = await supabase
        .from('time_tracking')
        .select('user_id')
        .eq('project_id', projectId)
        .distinct();
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const userIds = data.map(item => item.user_id);
        
        // Get user profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
          
        if (profilesError) throw profilesError;
        
        setUsers(profiles || []);
        return profiles || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching project users:', error);
      return [];
    }
  };
  
  const fetchTimeRecords = async () => {
    try {
      setLoading(true);
      
      // Fetch project information first
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();
      
      if (projectError) throw projectError;
      const projectName = projectData?.name || 'Unknown Project';
      
      let query = supabase
        .from('time_tracking')
        .select(`
          *,
          profiles(name),
          projects(name),
          project_tasks(id, title, checklist)
        `)
        .eq('project_id', projectId)
        .not('end_time', 'is', null);
      
      // Apply time filter
      if (timeFilter !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        if (timeFilter === 'today') {
          startDate.setHours(0, 0, 0, 0);
        } else if (timeFilter === 'week') {
          startDate.setDate(now.getDate() - 7);
        } else if (timeFilter === 'month') {
          startDate.setMonth(now.getMonth() - 1);
        }
        
        query = query.gte('start_time', startDate.toISOString());
      }
      
      // Apply user filter
      if (userFilter !== 'all') {
        query = query.eq('user_id', userFilter);
      }
      
      // Order by most recent first
      query = query.order('start_time', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      if (data) {
        // Calculate total duration
        const totalMinutes = data.reduce((sum, record) => sum + (record.duration_minutes || 0), 0);
        setTotalDuration(totalMinutes);
        
        // Map to full records with task and user details
        const fullRecords = data.map(record => {
          const task = record.project_tasks;
          let subtaskText = '';
          
          if (task && record.subtask_index !== null && record.subtask_index !== undefined) {
            const subtask = task.checklist?.find(item => item.id === record.subtask_index);
            if (subtask) {
              subtaskText = subtask.text;
            }
          }
          
          return {
            ...record,
            user_name: record.profiles?.name || 'Unknown User',
            task_title: task?.title || 'Unknown Task',
            subtask_text: subtaskText,
            project_name: projectName
          };
        });
        
        setRecords(fullRecords);
      }
    } catch (error) {
      console.error('Error fetching time records:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours} hr`;
    }
    
    return `${hours} hr ${remainingMinutes} min`;
  };
  
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Tracking
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Time period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last week</SelectItem>
                <SelectItem value="month">Last month</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="pb-4 mb-4 border-b border-border">
          <div className="text-2xl font-semibold">
            {formatDuration(totalDuration)}
          </div>
          <div className="text-sm text-muted-foreground">
            Total time tracked
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-8 w-8 border-t-2 border-blue-500 rounded-full" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No time records found for the selected filters
          </div>
        ) : (
          <div className="space-y-3">
            {records.map(record => (
              <div 
                key={record.id} 
                className="p-3 rounded-md border border-border bg-background flex justify-between items-start"
              >
                <div className="flex-1">
                  <div className="font-medium">
                    <span className="text-blue-600 dark:text-blue-400">
                      {record.project_name || 'Unknown Project'}
                    </span>
                    <span className="text-muted-foreground mx-2">›</span>
                    {record.task_title}
                    {record.subtask_text && (
                      <>
                        <span className="text-muted-foreground mx-2">›</span>
                        <span className="text-green-600 dark:text-green-400">{record.subtask_text}</span>
                      </>
                    )}
                  </div>
                  {record.description && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {record.description}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(record.start_time), 'MMM d, h:mm a')}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {record.user_name}
                    </span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="font-medium text-lg">
                    {formatDuration(record.duration_minutes)}
                  </div>
                  {record.end_time && (
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(record.end_time), 'h:mm a')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 