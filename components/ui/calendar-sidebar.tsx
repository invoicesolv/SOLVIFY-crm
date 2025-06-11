"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, Plus, ExternalLink, Users, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from '@/lib/supabase';
import { Tables } from '@/lib/database.types';

type CalendarEvent = Tables<'calendar_events'>;

interface CalendarSidebarProps {
  workspaceId?: string;
  currentUserId?: string;
  isMainView?: boolean;
  className?: string;
}

export function CalendarSidebar({ workspaceId, currentUserId, isMainView = false, className }: CalendarSidebarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '',
    duration: 30,
    type: 'meeting' as 'meeting' | 'deadline' | 'reminder'
  });

  // Fetch events from Supabase
  useEffect(() => {
    if (workspaceId) {
      fetchEvents();
    }
  }, [workspaceId]);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('workspace_id', workspaceId)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        return;
      }

      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const upcomingEvents = events.slice(0, isMainView ? 10 : 3);

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time || !workspaceId || !currentUserId) return;

    try {
      const startDateTime = new Date(`${newEvent.date}T${newEvent.time}`);
      const endDateTime = new Date(startDateTime.getTime() + newEvent.duration * 60000);

      const { error } = await supabase
        .from('calendar_events')
        .insert({
          title: newEvent.title,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          event_type: newEvent.type,
          user_id: currentUserId,
          workspace_id: workspaceId,
          color: newEvent.type === 'meeting' ? '#3b82f6' : newEvent.type === 'deadline' ? '#ef4444' : '#f59e0b'
        });

      if (error) {
        console.error('Error creating event:', error);
        return;
      }

      // Refresh events
      await fetchEvents();
      setNewEvent({ title: '', date: '', time: '', duration: 30, type: 'meeting' });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const formatDate = (dateString: string) => {
    // Use consistent formatting to avoid hydration issues
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (isLoading) {
    return (
      <div className={`${isMainView ? 'p-6' : 'space-y-3'} ${className}`}>
        <div className="text-center py-4 text-muted-foreground">
          <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isMainView ? 'p-6' : 'space-y-3'} ${className}`}>
      {isMainView && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-foreground">Calendar</h2>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEvents}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              onClick={() => setShowCreateForm(true)}
              size="sm"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Event
            </Button>
          </div>
        </div>
      )}

      {!isMainView && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">Upcoming</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateForm(true)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Create Event Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground">New Event</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  ×
                </Button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Event title"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="type">Type</Label>
                  <select
                    id="type"
                    value={newEvent.type}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                  >
                    <option value="meeting">Meeting</option>
                    <option value="deadline">Deadline</option>
                    <option value="reminder">Reminder</option>
                  </select>
                </div>
                
                <Button onClick={handleCreateEvent} className="w-full">
                  Create Event
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Events List */}
      <div className="space-y-2">
        {upcomingEvents.map((event) => (
          <Card key={event.id} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="text-sm font-medium text-foreground">{event.title}</h5>
                  {event.external_sync_status === 'synced' && (
                    <div className="h-2 w-2 rounded-full bg-green-500" title="Synced" />
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(event.start_time)} at {formatTime(event.start_time)}</span>
                </div>
                
                {event.attendees && Array.isArray(event.attendees) && event.attendees.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {event.attendees.length} attendees
                    </span>
                  </div>
                )}
                
                {event.location && (
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{event.location}</span>
                  </div>
                )}
              </div>
              
              <div className={`px-2 py-1 rounded-full text-xs ${
                event.event_type === 'meeting' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300' :
                event.event_type === 'deadline' ? 'bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-300' :
                'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-300'
              }`}>
                {event.event_type || 'event'}
              </div>
            </div>
          </Card>
        ))}
        
        {upcomingEvents.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming events</p>
          </div>
        )}
      </div>
    </div>
  );
} 