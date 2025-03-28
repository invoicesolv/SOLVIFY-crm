'use client';

import React, { useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format } from 'date-fns';
import { parse } from 'date-fns';
import { startOfWeek } from 'date-fns';
import { getDay } from 'date-fns';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from 'next-auth/react';

const locales = {
  'en-US': require('date-fns/locale/en-US'),
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
}

interface CachedData {
  events: Event[];
  timestamp: number;
  expiresAt: number;
  user_id: string;
}

const CACHE_KEY_PREFIX = 'calendar_events_cache_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export default function CalendarPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      loadEvents();
    }
  }, [session]);

  const getCacheKey = () => {
    return `${CACHE_KEY_PREFIX}${session?.user?.id || 'anonymous'}`;
  };

  const loadEvents = async (forceRefresh = false) => {
    if (!session?.user?.id) {
      console.error('No user session found for calendar');
      setError('User authentication required');
      setLoading(false);
      return;
    }

    if (!forceRefresh) {
      // Try to load from cache first
      const cachedData = getCachedEvents();
      if (cachedData && cachedData.user_id === session.user.id) {
        setEvents(cachedData.events.map(event => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end)
        })));
        setLoading(false);
        return;
      }
    }

    // If no cache or force refresh, fetch from API
    await fetchEvents();
  };

  const getCachedEvents = (): CachedData | null => {
    try {
      const cached = localStorage.getItem(getCacheKey());
      if (!cached) return null;

      const cachedData: CachedData = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now > cachedData.expiresAt) {
        localStorage.removeItem(getCacheKey());
        return null;
      }

      return cachedData;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  };

  const setCachedEvents = (events: Event[]) => {
    if (!session?.user?.id) return;
    
    try {
      const cacheData: CachedData = {
        events,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_DURATION,
        user_id: session.user.id
      };
      localStorage.setItem(getCacheKey(), JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  };

  const fetchEvents = async () => {
    if (!session?.user?.id) {
      console.error('No user session found for fetching calendar events');
      setError('User authentication required');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/calendar');
      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401) {
          // Clear cache on authentication error
          localStorage.removeItem(getCacheKey());
          setError('Please authenticate with Google Calendar in Settings');
          toast.error('Please authenticate with Google Calendar in Settings');
        } else {
          throw new Error(data.error || 'Failed to fetch calendar events');
        }
        return;
      }

      const data = await response.json();
      const formattedEvents = data.items.map((event: any) => ({
        id: event.id,
        title: event.summary,
        start: new Date(event.start.dateTime || event.start.date),
        end: new Date(event.end.dateTime || event.end.date),
        description: event.description,
        location: event.location,
      }));

      setEvents(formattedEvents);
      setCachedEvents(formattedEvents);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      setError('Failed to load calendar events');
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadEvents(true);
  };

  const handleSelectSlot = async ({ start, end }: { start: Date; end: Date }) => {
    if (!session?.user?.id) {
      console.error('No user session found for creating calendar event');
      toast.error('User authentication required');
      return;
    }

    const title = window.prompt('Enter event title:');
    if (!title) return;

    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: title,
          start: {
            dateTime: start.toISOString(),
          },
          end: {
            dateTime: end.toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      const newEvent = await response.json();
      const updatedEvents = [...events, {
        id: newEvent.id,
        title: newEvent.summary,
        start: new Date(newEvent.start.dateTime || newEvent.start.date),
        end: new Date(newEvent.end.dateTime || newEvent.end.date),
        description: newEvent.description,
        location: newEvent.location,
      }];
      
      setEvents(updatedEvents);
      setCachedEvents(updatedEvents);
      toast.success('Event created successfully');
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    }
  };

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white">Calendar</h1>
            <p className="text-sm text-neutral-400">
              View and manage your schedule
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
            className="text-neutral-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <Card className="bg-neutral-800 border-neutral-700 p-6">
          {error ? (
            <div className="flex flex-col items-center justify-center h-[700px] text-neutral-400">
              <p>{error}</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center items-center h-[700px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          ) : (
            <>
              <style jsx global>{`
                .rbc-calendar {
                  background: transparent;
                  color: #fff;
                }
                .rbc-toolbar button {
                  color: #fff;
                  background-color: #262626;
                  border-color: #404040;
                }
                .rbc-toolbar button:hover {
                  background-color: #404040;
                }
                .rbc-toolbar button.rbc-active {
                  background-color: #525252;
                }
                .rbc-header {
                  background-color: #262626;
                  color: #fff;
                  border-bottom: 1px solid #404040;
                  padding: 8px;
                }
                .rbc-today {
                  background-color: rgba(64, 64, 64, 0.3);
                }
                .rbc-off-range-bg {
                  background-color: #1f1f1f;
                }
                .rbc-event {
                  background-color: #2563eb;
                  border: none;
                }
                .rbc-event.rbc-selected {
                  background-color: #1d4ed8;
                }
                .rbc-day-bg + .rbc-day-bg,
                .rbc-month-row + .rbc-month-row,
                .rbc-header + .rbc-header,
                .rbc-time-header-content,
                .rbc-time-content,
                .rbc-time-header.rbc-overflowing,
                .rbc-month-view,
                .rbc-time-view,
                .rbc-agenda-view {
                  border-color: #404040;
                }
                .rbc-time-view {
                  background-color: #262626;
                }
                .rbc-time-content {
                  background-color: #262626;
                }
                .rbc-time-slot {
                  color: #a3a3a3;
                }
                .rbc-current-time-indicator {
                  background-color: #2563eb;
                }
              `}</style>
              <div className="h-[700px]">
                <BigCalendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: '100%' }}
                  selectable
                  onSelectSlot={handleSelectSlot}
                  tooltipAccessor={event => `${event.title}${event.description ? `\n${event.description}` : ''}${event.location ? `\nLocation: ${event.location}` : ''}`}
                />
              </div>
            </>
          )}
        </Card>
      </div>
    </SidebarDemo>
  );
} 