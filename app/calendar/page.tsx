'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { RefreshCw, Trash2, Edit2, Grid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { CalendarErrorBoundary } from '@/components/ui/calendar-error-boundary';
import {
  CalendarBody,
  CalendarDate,
  CalendarDatePagination,
  CalendarDatePicker,
  CalendarHeader,
  CalendarMonthPicker,
  CalendarYearPicker,
  type Feature,
  type Status,
} from '@/components/ui/calendar';

interface Event {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isSynced?: boolean;
}

interface CachedData {
  timestamp: number;
  data: Event[];
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Get active workspace with better fallbacks
const getUserActiveWorkspace = async () => {
  // First try localStorage dashboardSettings
  const dashboardSettings = localStorage.getItem('dashboardSettings');
  if (dashboardSettings) {
    try {
      const settings = JSON.parse(dashboardSettings);
      if (settings.activeWorkspace) {
        console.log('Found active workspace in dashboardSettings:', settings.activeWorkspace);
        return settings.activeWorkspace;
      }
    } catch (e) {
      console.error('Error parsing dashboard settings:', e);
    }
  }
  
  // Then try localStorage user-specific preference
  const userData = localStorage.getItem('supabase.auth.token');
  let userId = null;
  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      userId = parsed?.currentSession?.user?.id;
      
      if (userId) {
        const workspaceKey = `workspace_${userId}`;
        const storedWorkspace = localStorage.getItem(workspaceKey);
        if (storedWorkspace) {
          console.log('Found active workspace in localStorage:', storedWorkspace);
          return storedWorkspace;
        }
      }
    } catch (e) {
      console.error('Error getting user ID from localStorage:', e);
    }
  }
  
  // Last resort: Ask API to determine workspace
  try {
    const response = await fetch('/api/user/active-workspace', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.workspaceId) {
        console.log('Found active workspace from API:', data.workspaceId);
        // Save this for future use
        if (userId) {
          localStorage.setItem(`workspace_${userId}`, data.workspaceId);
        }
        return data.workspaceId;
      }
    }
  } catch (e) {
    console.error('Error fetching workspace from API:', e);
  }
  
  return null;
};

async function loadEvents(currentWorkspace: string | null): Promise<Event[]> {
  const cachedData = localStorage.getItem('calendarEvents');
  if (cachedData) {
    const { timestamp, data }: CachedData = JSON.parse(cachedData);
    if (Date.now() - timestamp < CACHE_DURATION) {
      console.log('Using cached calendar events');
      return data.map(event => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end)
      }));
    }
  }

  // Use provided workspace ID
  let activeWorkspace = currentWorkspace;
  if (!activeWorkspace) {
    console.log('No active workspace provided to loadEvents, will try to load events without workspace context');
  }
  
  let events: any[] = [];
  
  // Track retries
  let mainApiSuccess = false;
  let fallbackApiSuccess = false;
  let workspaceApiSuccess = false;
  let retryCount = 0;
  const maxRetries = 2;
  
  // Try the main calendar API first
  while (retryCount <= maxRetries && !mainApiSuccess && !fallbackApiSuccess) {
  try {
    // Create a controller to handle timeouts
    const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Reduced from 15s to 8s
    
      console.log(`Fetching events from main calendar API (attempt ${retryCount + 1}/${maxRetries + 1})...`);
    const response = await fetch('/api/calendar', {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
        try {
      const data = await response.json();
      events = data.items || data;
      console.log(`Successfully fetched ${events.length} events from main API`);
          mainApiSuccess = true;
        } catch (parseError) {
          console.error('Error parsing main API response:', parseError);
          throw new Error('Invalid response from main API');
        }
    } else {
      // If the main API fails, fall back to the events API
      console.log(`Main API failed with status ${response.status}, falling back to events API`);
      
        try {
      // Create a new controller for the fallback request
      const fallbackController = new AbortController();
          const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 6000); // 6 second timeout
      
      const fallbackResponse = await fetch('/api/calendar/events', {
        signal: fallbackController.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(fallbackTimeoutId);
      
          if (fallbackResponse.ok) {
            try {
      events = await fallbackResponse.json();
      console.log(`Successfully fetched ${events.length} events from fallback API`);
              fallbackApiSuccess = true;
            } catch (parseError) {
              console.error('Error parsing fallback API response:', parseError);
              throw new Error('Invalid response from fallback API');
            }
          } else {
            throw new Error(`Fallback API returned ${fallbackResponse.status}`);
          }
        } catch (fallbackError) {
          console.error('Error with fallback API:', fallbackError);
          
          // If this was the last retry and we still have cached data, use it
          if (retryCount === maxRetries && cachedData) {
            console.log('Using expired cached data due to API failures');
            const { data }: CachedData = JSON.parse(cachedData);
            return data.map(event => ({
              ...event,
              start: new Date(event.start),
              end: new Date(event.end)
            }));
          }
          
          // Otherwise retry if we haven't exceeded max retries
          retryCount++;
          if (retryCount <= maxRetries) {
            console.log(`Retrying API calls (attempt ${retryCount + 1}/${maxRetries + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
            continue;
          } else {
            throw fallbackError; // Re-throw to be caught by outer catch
          }
        }
      }
      
      // Break the loop if we successfully got events from either API
      if (mainApiSuccess || fallbackApiSuccess) break;
  } catch (error: any) {
    // Handle abort errors differently
    if (error.name === 'AbortError') {
        console.error('Calendar API request timed out.');
        retryCount++;
        
        // If this was the last retry and we still have cached data, use it
        if (retryCount > maxRetries && cachedData) {
          console.log('Using expired cached data due to timeout');
          const { data }: CachedData = JSON.parse(cachedData);
          return data.map(event => ({
            ...event,
            start: new Date(event.start),
            end: new Date(event.end)
          }));
        }
        
        // Wait before retrying
        if (retryCount <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
      
      // Non-abort errors or exceeded retries
      console.error('Error loading events:', error);
      
      // Try to use cached data if available, even if expired
      if (cachedData) {
        const { data }: CachedData = JSON.parse(cachedData);
        console.log('Returning expired cached data due to API errors');
        return data.map(event => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end)
        }));
      }
      
      // If no cached data, return empty array
    return [];
  }
  }
  
  // Now also try to fetch workspace shared events if we have an active workspace
  if (activeWorkspace) {
    try {
      console.log(`Fetching shared calendar events for workspace: ${activeWorkspace}`);
      const workspaceEventsController = new AbortController();
      const workspaceTimeoutId = setTimeout(() => workspaceEventsController.abort(), 6000); // Reduced from 10s to 6s
      
      const workspaceEventsResponse = await fetch(`/api/calendar/workspace-events?workspaceId=${activeWorkspace}`, {
        signal: workspaceEventsController.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(workspaceTimeoutId);
      
      if (workspaceEventsResponse.ok) {
        try {
          const workspaceEvents = await workspaceEventsResponse.json();
          console.log(`Successfully fetched ${workspaceEvents.length} shared events from workspace`);
          workspaceApiSuccess = true;
          
          // Merge events, avoiding duplicates by checking IDs
          const existingIds = new Set(events.map((e: any) => e.id));
          const newWorkspaceEvents = workspaceEvents.filter((e: {id: string}) => !existingIds.has(e.id));
          
          console.log(`Adding ${newWorkspaceEvents.length} unique workspace events to calendar`);
          events = [...events, ...newWorkspaceEvents] as any[];
        } catch (parseError) {
          console.error('Error parsing workspace events response:', parseError);
        }
      } else {
        console.warn(`Failed to fetch workspace events: ${workspaceEventsResponse.status}`);
      }
    } catch (wsError) {
      console.error('Error fetching workspace events:', wsError);
      // Continue with personal events only
    }
  }
  
  // Format and cache the events we have
  const formattedEvents = events.map((event: any) => ({
    id: event.id,
    title: event.title || event.summary,
    start: new Date(event.start_time || event.start?.dateTime || event.start),
    end: new Date(event.end_time || event.end?.dateTime || event.end),
    isSynced: event.is_synced !== undefined ? event.is_synced : (event.google_calendar_id ? true : false)
  }));

  // Only cache if we got successful responses
  if (mainApiSuccess || fallbackApiSuccess || workspaceApiSuccess) {
    localStorage.setItem('calendarEvents', JSON.stringify({
      timestamp: Date.now(),
      data: formattedEvents
    }));
  }

  return formattedEvents;
}

function clearCache(): void {
  localStorage.removeItem('calendarEvents');
}

function CalendarPageContent() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [noWorkspace, setNoWorkspace] = useState(false);
  
  // Load workspaces
  useEffect(() => {
    const loadWorkspaces = async () => {
      if (!session?.user?.id) return;
      
      try {
        // First check if we have a stored workspace preference
        if (typeof window !== 'undefined') {
          const storedWorkspace = localStorage.getItem(`workspace_${session.user.id}`);
          if (storedWorkspace) {
            setActiveWorkspace(storedWorkspace);
            console.log('Loaded active workspace from localStorage:', storedWorkspace);
          }
        }
        
        // Load available workspaces
        const { data: memberships, error: membershipError } = await supabase
          .from("team_members")
          .select("workspace_id, workspaces(id, name)")
          .eq("user_id", session.user.id);
          
        if (membershipError) {
          console.error("Error loading workspaces:", membershipError);
          return;
        }
        
        const workspaceData = (memberships as any[] | null)
          ?.filter(m => m.workspaces) // Filter out any null workspaces
          .map((m) => ({
            id: m.workspaces.id,
            name: m.workspaces.name,
          })) || [];
          
        setWorkspaces(workspaceData);
        
        // If we have workspaces but no active workspace set yet, use the first one
        if (workspaceData?.length > 0 && !activeWorkspace) {
          setActiveWorkspace(workspaceData[0].id);
          
          // Store this selection
          if (typeof window !== 'undefined') {
            localStorage.setItem(`workspace_${session.user.id}`, workspaceData[0].id);
          }
        } else if (workspaceData.length === 0) {
          setNoWorkspace(true);
        }
      } catch (error) {
        console.error("Error in loadWorkspaces:", error);
      }
    };
    
    loadWorkspaces();
  }, [session?.user?.id, activeWorkspace]);
  
  // Handle workspace selection
  const handleWorkspaceChange = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
    
    // Store the selection in localStorage
    if (session?.user?.id && typeof window !== 'undefined') {
      localStorage.setItem(`workspace_${session.user.id}`, workspaceId);
    }
    
    // Clear the error state
    setError(null);
    setNoWorkspace(false);
    
    // Refresh data with the new workspace
    clearCache();
    fetchEvents();
  };

  // Conditionally render a workspace selector if needed
  const renderWorkspaceSelector = () => {
    if (workspaces.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[80vh]">
          <div className="w-full max-w-md p-6 bg-background border border-border dark:border-border rounded-lg shadow-lg text-center">
            <Grid className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">No Workspaces Found</h2>
            <p className="text-muted-foreground mb-6">
              You don't have access to any workspaces yet. Please create a workspace or ask your administrator to invite you.
            </p>
            <Button
              onClick={() => window.location.href = '/settings/team'}
              className="bg-blue-600 hover:bg-blue-500"
            >
              Go to Team Settings
            </Button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <div className="w-full max-w-md p-6 bg-background border border-border dark:border-border rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-foreground mb-4 text-center">Select a Workspace</h2>
          <p className="text-muted-foreground mb-6 text-center">
            You need to select a workspace to view your calendar
          </p>
          
          <div className="space-y-4">
            {workspaces.map(workspace => (
              <button
                key={workspace.id}
                onClick={() => handleWorkspaceChange(workspace.id)}
                className="w-full p-4 bg-gray-200 dark:bg-muted hover:bg-gray-300 dark:hover:bg-neutral-600 rounded-lg flex items-center transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-4">
                  <Grid className="h-5 w-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">{workspace.name}</p>
                  <p className="text-xs text-muted-foreground">Tap to select this workspace</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedEvents = await loadEvents(activeWorkspace);
      setEvents(loadedEvents);
    } catch (err) {
      setError('Failed to load events');
      console.error('Error fetching events:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleRefresh = useCallback(() => {
    clearCache();
    fetchEvents();
  }, [fetchEvents]);

  const handleCreateEvent = useCallback(async (date: Date) => {
    const title = prompt('Enter event title:');
    if (!title) return;

    const start = date;
    const end = new Date(date);
    end.setHours(end.getHours() + 1); // Default 1 hour duration

    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          start,
          end,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      toast.success('Event created successfully');
      clearCache();
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    }
  }, [fetchEvents]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      // Add cache busting parameter to avoid cached responses
      const response = await fetch(`/api/calendar?id=${eventId}&t=${Date.now()}`, {
        method: 'DELETE',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Delete error details:', errorData);
        throw new Error(`Failed to delete event: ${errorData.error || response.statusText}`);
      }

      toast.success('Event deleted successfully');
      clearCache();
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete event');
    }
  }, [fetchEvents]);

  const handleEditEvent = useCallback(async (eventId: string, currentTitle: string) => {
    const newTitle = prompt('Update event title:', currentTitle);
    if (!newTitle || newTitle === currentTitle) return;

    try {
      const event = events.find(e => e.id === eventId);
      if (!event) return;

      const response = await fetch('/api/calendar', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: eventId,
          title: newTitle,
          start: event.start,
          end: event.end,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update event');
      }

      toast.success('Event updated successfully');
      clearCache();
      fetchEvents();
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event');
    }
  }, [events, fetchEvents]);

  // Add handler for saving events to database for workspace sharing
  const handleSaveEventsToDatabase = useCallback(async () => {
    try {
      // Use the active workspace from state
      if (!activeWorkspace) {
        toast.error('No active workspace found. Please select a workspace first.');
        return;
      }
      
      setIsLoading(true);
      
      let retryCount = 0;
      const maxRetries = 2;
      let success = false;
      
      while (retryCount <= maxRetries && !success) {
        try {
          console.log(`Attempting to save events to database (attempt ${retryCount + 1}/${maxRetries + 1})...`);
          
          // Set a timeout to handle unresponsive API
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const response = await fetch('/api/calendar/save-to-database', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
            body: JSON.stringify({
              workspaceId: activeWorkspace,
            }),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          // If we get a response, process it
          if (response) {
            // Try to parse the response data
            let result;
            
            if (response.ok) {
              try {
                result = await response.json();
                success = true;
                
                if (result.stats.eventsSaved > 0) {
                  toast.success(`Saved ${result.stats.eventsSaved} events to database for workspace sharing`);
                } else {
                  toast.info('No new events to save to workspace');
                }
                
                if (result.stats.isPartialSync) {
                  toast.info(`Note: Only processed ${result.stats.eventsProcessed} of ${result.stats.eventsFound} events to avoid timeout.`);
                }
                
                break; // Exit the retry loop
              } catch (parseError) {
                console.error('Error parsing response:', parseError);
                retryCount++;
              }
            } else {
              // Try to get error details if available
              try {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save events to database');
              } catch (parseError) {
                // If we can't parse the error, use the status text
                throw new Error(`Failed with status: ${response.status} ${response.statusText}`);
              }
            }
          }
        } catch (fetchError: any) {
          if (fetchError.name === 'AbortError') {
            console.warn('Request timed out, retrying...');
          } else {
            console.error('Error in save attempt:', fetchError);
          }
          
          retryCount++;
          
          // Only retry timeouts or network errors, not auth/permission issues
          if (retryCount <= maxRetries && (fetchError.name === 'AbortError' || !fetchError.message.includes('401') && !fetchError.message.includes('403'))) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw fetchError; // Re-throw to be caught by outer catch
          }
        }
      }
      
      // Refresh the events list if successful
      if (success) {
        clearCache();
        fetchEvents();
      } else if (retryCount > maxRetries) {
        toast.error('Failed to save events after multiple attempts. Please try again later.');
      }
    } catch (error) {
      console.error('Error saving events to database:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save events to database');
    } finally {
      setIsLoading(false);
    }
  }, [fetchEvents, activeWorkspace]);

  // Convert events to features for the calendar
  const features: Feature[] = events.map(event => ({
    id: event.id,
    name: event.title,
    startAt: event.start,
    endAt: event.end,
    status: {
      id: event.isSynced ? 'synced' : 'unsynced',
      name: event.isSynced ? 'Synced' : 'Not Synced',
      color: event.isSynced ? 'green' : 'blue'
    } as Status
  }));

  return (
    <SidebarDemo>
      {(!activeWorkspace || noWorkspace) ? (
        renderWorkspaceSelector()
      ) : (
      <div className="h-screen p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
            <p className="text-sm text-muted-foreground">
              View and manage your schedule
            </p>
          </div>
          <div className="flex gap-2">
              {/* Workspace Selector Dropdown */}
              {workspaces.length > 1 && (
                <select
                  value={activeWorkspace}
                  onChange={(e) => handleWorkspaceChange(e.target.value)}
                  className="bg-background border border-border dark:border-border rounded-md px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id} className="text-foreground bg-background">
                      {ws.name}
                    </option>
                  ))}
                </select>
              )}
              
              <Button
                variant="outline"
                onClick={handleSaveEventsToDatabase}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-foreground border-0"
              >
                Save to Database
              </Button>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
            {session && (
              <div className="text-sm text-muted-foreground">
                {session.user?.email}
              </div>
            )}
          </div>
        </div>

        <Card className="bg-background border-border h-[calc(100vh-8rem)]">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p>{error}</p>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-400"></div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <CalendarDate>
                <CalendarDatePicker>
                  <CalendarMonthPicker className="bg-background border-border text-foreground hover:bg-muted hover:text-foreground" />
                  <CalendarYearPicker 
                    start={2020} 
                    end={2030}
                    className="bg-background border-border text-foreground hover:bg-muted hover:text-foreground" 
                  />
                </CalendarDatePicker>
                <CalendarDatePagination />
              </CalendarDate>
              <div className="flex-1 overflow-hidden flex flex-col">
                <CalendarHeader />
                <div className="flex-1">
                  <CalendarBody 
                    features={features}
                    onDateClick={handleCreateEvent}
                  >
                    {({ feature }) => (
                      <div className="relative">
                      <div
                        key={feature.id}
                        className={`text-xs p-1 rounded ${
                          feature.status.id === 'synced' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                          } text-foreground truncate cursor-pointer group`}
                      >
                        {feature.name}
                          <div className="absolute right-0 top-0 flex opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditEvent(feature.id, feature.name);
                              }}
                              className="p-0.5 bg-blue-500 hover:bg-blue-600 rounded mr-1"
                            >
                              <Edit2 className="h-3 w-3 text-foreground" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEvent(feature.id);
                              }}
                              className="p-0.5 bg-red-500 hover:bg-red-600 rounded"
                            >
                              <Trash2 className="h-3 w-3 text-foreground" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CalendarBody>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
      )}
    </SidebarDemo>
  );
}

export default function CalendarPage() {
  return (
    <CalendarErrorBoundary>
      <CalendarPageContent />
    </CalendarErrorBoundary>
  );
} 