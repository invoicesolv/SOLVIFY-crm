import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { BarChart, Users, DollarSign, ArrowUpRight, ArrowDownRight, Calendar, Clock, AlertCircle, Settings, X, Eye, EyeOff, Globe, Grid, TrendingUp, Inbox, LineChart, RefreshCw, CheckCircle, Square, CheckSquare, CreditCard, PieChart, Crown, HelpCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from "next/navigation";
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { handleFetchError } from '@/lib/fetch-util'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { AnimatedBorderCard } from '@/components/ui/animated-border-card'
import { Glow } from "@/components/ui/glow";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { RecentLeads } from "@/components/leads/RecentLeads";
import { format, addDays, isToday, parseISO, differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';

interface Invoice {
  document_number: string
  invoice_date: string
  total: number
  balance: number
  due_date: string
  customers: {
    name: string
  }
  currencies: {
    code: string
  }
}

interface Task {
  id: string
  title: string
  deadline: string
  project_id: string
  progress: number
  status: string
  checklist?: Array<{
    id: number;
    text: string;
    done: boolean;
  }>;
}

interface Meeting {
  id: string
  title: string
  start_time: string
  end_time: string
  description: string
}

interface DashboardStats {
  totalRevenue: number
  invoiceCount: number
  averageInvoiceValue: number
  revenueGrowth: number
}

interface Domain {
  id: string
  name: string
  expiry_date: string
  status: string
}

interface Lead {
  id: string
  name: string
  company: string
  email: string
  status: string
  created_at: string
  title?: string
  value?: number
}

interface Sale {
  id: string
  lead_name: string
  company: string
  value: number
  stage: string
  created_at: string
  updated_at: string
}

interface EmailThread {
  id: string
  subject: string
  from: string
  date: string
  unread: boolean
}

interface AnalyticsData {
  pageviews: number
  visitors: number
  bounce_rate: number
  avg_session_duration: number
}

interface SearchConsoleData {
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface CronJob {
  id: string;
  name: string;
  job_type: string;
  schedule: string;
  settings: {
    frequency: string;
    send_day: string;
    send_time: string;
  };
  last_run: string;
  next_run: string;
  status: string;
  execution_status: string;
  error_message?: string;
  property_id?: string;
}

export function Dashboard() {
  const { data: session } = useSession()
  const router = useRouter();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [emails, setEmails] = useState<EmailThread[]>([])
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [searchConsoleData, setSearchConsoleData] = useState<SearchConsoleData | null>(null)
  const [cronJobs, setCronJobs] = useState<CronJob[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    invoiceCount: 0,
    averageInvoiceValue: 0,
    revenueGrowth: 0
  })
  
  // We will initialize the hook after activeWorkspace is defined
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [debugInfo, setDebugInfo] = useState<{message: string, type: 'error' | 'warning' | 'info'} | null>(null)
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([])

  // Dashboard customization state
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [visibleWidgets, setVisibleWidgets] = useState({
    revenueStats: true,
    invoiceStats: true,
    averageInvoice: true,
    recentInvoices: true,
    invoiceTypes: true,
    upcomingEvents: true,
    upcomingDeadlines: true,
    urgentTasks: true,
    domains: true,
    leads: true,
    sales: true,
    gmailHub: true,
    analyticsData: true,
    searchConsole: true,
    cronJobs: true,
    invoiceSummary: true,
    salesMetrics: true,
    taskOverview: true,
    recentMeetings: true
  })
  
  // Use our dashboard stats hook after activeWorkspace is set
  const { 
    stats: apiStats, 
    loading: statsLoading, 
    error: statsError, 
    refreshStats 
  } = useDashboardStats(activeWorkspace || undefined);
  
  // Update our local stats state when API stats change
  useEffect(() => {
    if (apiStats?.invoices) {
      setStats({
        totalRevenue: apiStats.invoices.totalAmount || 0,
        invoiceCount: apiStats.invoices.totalCount || 0,
        averageInvoiceValue: apiStats.invoices.averageAmount || 0,
        revenueGrowth: 0 // Calculate this separately if needed
      });
      console.log('[Dashboard] Updated stats from API:', apiStats);
    }
  }, [apiStats]);
  
  // Load available workspaces
  useEffect(() => {
    async function loadWorkspaces() {
      if (!session?.user?.id) return;

      try {
        // First try to get active workspace from localStorage
        if (typeof window !== 'undefined') {
          const storedWorkspace = localStorage.getItem(`workspace_${session.user.id}`);
          if (storedWorkspace) {
            setActiveWorkspace(storedWorkspace);
            console.log('Loaded active workspace from localStorage:', storedWorkspace);
          }
        }

        const { data: memberships, error: membershipError } = await supabase
          .from("team_members")
          .select("workspace_id, workspaces(id, name)")
          .eq("user_id", session.user.id);

        if (membershipError) throw membershipError;

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
        }
      } catch (error) {
        console.error("Error loading workspaces:", error);
      }
    }

    loadWorkspaces();
  }, [session?.user?.id, activeWorkspace]);

  // Handle workspace selection
  const handleWorkspaceChange = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
    
    // Store the selection in localStorage
    if (session?.user?.id && typeof window !== 'undefined') {
      localStorage.setItem(`workspace_${session.user.id}`, workspaceId);
    }
    
    // Refresh data with the new workspace
    fetchData();
  };

  // Function to reload the page
  const reloadPage = () => {
    router.refresh();
  };

  // Save dashboard preferences - completely rewritten
  const saveDashboardPreferences = useCallback(async () => {
      if (!session?.user?.id) {
      console.error('Cannot save preferences: No user ID');
        return;
      }
      
    try {
      console.log('Saving dashboard preferences for user:', session.user.id);
      console.log('Preferences data to save:', visibleWidgets);
      
      let savedSuccessfully = false;
      
      // First check if we can access the user_preferences table
      try {
        const { error: accessError } = await supabase
          .from('user_preferences')
          .select('id')
          .limit(1);
          
        if (accessError) {
          console.error('Cannot access user_preferences table:', accessError);
          throw new Error('Database access issue');
        }
        
        // Stringify settings to ensure consistent format
        const jsonSettings = JSON.stringify(visibleWidgets);
        console.log('Stringified settings:', jsonSettings);
        
        // Try to update existing record first
        const { data: existingPrefs, error: fetchError } = await supabase
          .from('user_preferences')
          .select('id')
          .eq('user_id', session.user.id)
          .maybeSingle();
          
        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error fetching existing preferences:', fetchError);
        } else {
          // Either update or insert based on whether we found an existing record
          if (existingPrefs) {
            console.log('Updating existing preferences with ID:', existingPrefs.id);
            const { error: updateError } = await supabase
              .from('user_preferences')
              .update({
                dashboard_settings: jsonSettings,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingPrefs.id);
              
            if (updateError) {
              console.error('Error updating preferences:', updateError);
            } else {
              savedSuccessfully = true;
            }
          } else {
            console.log('Creating new preference record');
            const { error: insertError } = await supabase
              .from('user_preferences')
              .insert({
                user_id: session.user.id,
                dashboard_settings: jsonSettings,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
              
            if (insertError) {
              console.error('Error inserting preferences:', insertError);
            } else {
              savedSuccessfully = true;
            }
          }
        }
      } catch (dbError) {
        console.error('Database error when saving preferences:', dbError);
      }
      
      // Fall back to localStorage if database save failed
      if (!savedSuccessfully) {
        console.log('Falling back to localStorage for preferences');
        try {
          localStorage.setItem('dashboard_preferences', JSON.stringify(visibleWidgets));
          savedSuccessfully = true;
        } catch (storageError) {
          console.error('Failed to save to localStorage:', storageError);
        }
      }
      
      // Show success message if we saved somewhere
      if (savedSuccessfully) {
        toast({
          title: "Dashboard updated",
          description: "Your dashboard settings have been saved.",
          variant: "default"
        });
      } else {
        toast({
          title: "Settings applied",
          description: "Your settings are applied for this session only.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error in saveDashboardPreferences:', error);
      toast({
        title: "Settings applied temporarily",
        description: "Settings could not be saved permanently.",
        variant: "destructive"
      });
    }
  }, [session?.user?.id, visibleWidgets, toast]);

  // Apply changes and exit customization mode
  const applyChanges = async () => {
    try {
      await saveDashboardPreferences();
      setIsCustomizing(false);
    } catch (error) {
      console.error('Error applying changes:', error);
    }
  };

  // Load dashboard preferences
  useEffect(() => {
    const loadDashboardPreferences = async () => {
      if (!session?.user?.id) return;
      
      try {
        console.log('Loading dashboard preferences for user:', session.user.id);
        
        // First try to get preferences from database
        try {
          const { data: prefsData, error: prefsError } = await supabase
            .from('user_preferences')
            .select('dashboard_settings')
            .eq('user_id', session.user.id) // Add this line to properly filter by user_id
            .maybeSingle();
            
          if (prefsError) {
            console.error('Error loading preferences from DB:', prefsError);
          } else if (prefsData?.dashboard_settings) {
            try {
              const settings = typeof prefsData.dashboard_settings === 'string' 
                ? JSON.parse(prefsData.dashboard_settings)
                : prefsData.dashboard_settings;
              
              console.log('Loaded dashboard preferences from DB:', settings);
              setVisibleWidgets(prev => ({ ...prev, ...settings }));
              return; // Exit early since we loaded from DB
            } catch (parseError) {
              console.error('Error parsing dashboard settings from DB:', parseError);
            }
          } else {
            console.log('No dashboard preferences found in DB for user:', session.user.id);
          }
        } catch (dbError) {
          console.error('Failed to access user_preferences table:', dbError);
        }
        
        // If database failed, try localStorage as fallback
        try {
          const localPrefs = localStorage.getItem('dashboard_preferences');
          if (localPrefs) {
            const settings = JSON.parse(localPrefs);
            console.log('Loaded dashboard preferences from localStorage:', settings);
            setVisibleWidgets(prev => ({ ...prev, ...settings }));
          }
        } catch (localStorageError) {
          console.error('Error loading preferences from localStorage:', localStorageError);
        }
      } catch (error) {
        console.error('Error in loadDashboardPreferences:', error);
      }
    };

    // Main function to load data
    const initializeDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load preferences
        await loadDashboardPreferences();
        
        // Fetch actual dashboard data
        await fetchData();
      } catch (error) {
        console.error('Error initializing dashboard:', error);
        setError('Failed to initialize dashboard. Please reload the page.');
        setLoading(false);
      }
    };
    
    // Initialize dashboard if we have a session
    if (session?.user?.id) {
      initializeDashboard();
    } else {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Function to fetch data from various sources
  const fetchData = useCallback(async () => {
    if (!session?.user?.id) {
      console.error('No user session found');
      setLoading(false);
      setDebugInfo({
        message: 'No user session found. Please log in again.',
        type: 'error'
      });
      return;
    }
    
    if (!activeWorkspace) {
      console.log('No active workspace selected, skipping data fetch');
      setLoading(false);
      return;
    }
    
    try {
      setRefreshing(true);
      console.log('Fetching dashboard data for user:', session.user.id, 'workspace:', activeWorkspace);
      
      // DEBUG SECTION - Test basic Supabase connection
      console.log('DEBUG: Starting fetchData with session:', !!session?.user?.id, 'workspace:', activeWorkspace);
      try {
        const { data: testData, error: testError } = await supabase.from('profiles').select('*').limit(1);
        console.log('DEBUG: Basic query test result:', testData?.length > 0 ? 'SUCCESS' : 'EMPTY', testError ? 'ERROR' : '');
        if (testError) {
          console.error('DEBUG: Basic query test error:', testError);
          setDebugInfo({
            message: `Database connection issue: ${testError.message}`,
            type: 'error'
          });
        }
      } catch (err) {
        console.error('DEBUG: Critical Supabase error:', err);
        setDebugInfo({
          message: `Critical database error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          type: 'error'
        });
      }
      
      // CALENDAR EVENTS - filtering by workspace_id
      try {
        console.log('DEBUG: Attempting to fetch calendar events for workspace:', activeWorkspace);
        
        // First try to get recent events directly from the calendar_events table
        const { data: calendarEventsData, error: calendarError } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('workspace_id', activeWorkspace)
          .gte('start_time', new Date(new Date().setDate(new Date().getDate() - 1)).toISOString()) // From yesterday
          .lte('start_time', new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()) // To one month ahead
          .order('start_time', { ascending: true })
          .limit(10);

        if (calendarError) {
          console.error('DEBUG: Calendar fetch error:', calendarError);
        } else {
          console.log('DEBUG: Calendar events fetched from database:', calendarEventsData?.length || 0);
          console.log('DEBUG: Sample calendar event:', calendarEventsData?.[0] || 'No events found');
          
          if (calendarEventsData && calendarEventsData.length > 0) {
            const transformedMeetings = calendarEventsData.map(event => ({
              id: event.id,
              title: event.title,
              start_time: event.start_time,
              end_time: event.end_time,
              description: event.description || ''
            }));
            setMeetings(transformedMeetings);
            console.log('DEBUG: Set calendar events to meetings state:', transformedMeetings.length);
          } else {
            // If no events found in the database, try fetching from the API
            console.log('DEBUG: No calendar events found in database, trying API endpoint');
            try {
              const apiResponse = await fetch(`/api/calendar/workspace-events?workspaceId=${activeWorkspace}`, {
                headers: {
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                }
              });
              
              if (apiResponse.ok) {
                const eventsData = await apiResponse.json();
                console.log('DEBUG: Calendar events fetched from API:', eventsData?.length || 0);
                
                if (eventsData && eventsData.length > 0) {
                  const transformedMeetings = eventsData.map(event => ({
                    id: event.id,
                    title: event.title,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    description: event.description || ''
                  }));
                  setMeetings(transformedMeetings);
                  console.log('DEBUG: Set calendar events from API to meetings state:', transformedMeetings.length);
                } else {
                  console.log('DEBUG: No calendar events found in API response');
                  setMeetings([]);
                }
              } else {
                console.error('DEBUG: API response error:', apiResponse.status);
                setMeetings([]);
              }
            } catch (apiError) {
              console.error('DEBUG: Error fetching from calendar API:', apiError);
              setMeetings([]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to query calendar_events table:', err);
        setMeetings([]);
      }

      // TASKS - filter by workspace_id
      try {
        console.log('DEBUG: Attempting to fetch tasks');
        
        // Use the new /api/tasks endpoint
        const taskResponse = await fetch(`/api/tasks?workspaceId=${activeWorkspace}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (taskResponse.ok) {
          const tasksData = await taskResponse.json();
          console.log('DEBUG: Tasks fetched from API:', tasksData.length || 0);
          
          if (tasksData && tasksData.length > 0) {
            console.log('DEBUG: Sample task:', tasksData[0]);
            setTasks(tasksData);
          } else {
            console.log('DEBUG: No tasks returned from API');
            setTasks([]);
          }
        } else {
          console.error('DEBUG: Error fetching tasks from API:', taskResponse.status);
          setTasks([]);
        }
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
        setTasks([]);
      }

      // DOMAIN LOGIC - filter by workspace_id
      try {
        console.log('DEBUG: Attempting to fetch domains for workspace:', activeWorkspace);
        const { data: domainsData, error: domainsError } = await supabase
          .from('domains')
          .select('*')
          .eq('workspace_id', activeWorkspace)
          .order('expiry_date', { ascending: true })
          .limit(5);

        if (domainsError) {
          console.error('DEBUG: Domains fetch error:', domainsError);
        } else {
          console.log('DEBUG: Domains fetched successfully:', domainsData?.length || 0);
          
          // Make sure domain data is formatted correctly
          const formattedDomains = domainsData?.map(domain => ({
            id: domain.id,
            name: domain.display_domain || domain.domain || '',
            expiry_date: domain.expiry_date,
            status: domain.status
          })) || [];
          
          setDomains(formattedDomains);
        }
      } catch (err) {
        console.error('Failed to query domains table:', err);
        setDomains([]);
      }

      // LEADS - filter by workspace_id
      try {
        const { data: leadsData, error: leadsError } = await supabase
          .from('leads')
          .select('*')
          .eq('workspace_id', activeWorkspace)
          .order('created_at', { ascending: false })
          .limit(5);

        if (leadsError) {
          console.error('Error fetching leads:', leadsError);
        } else {
          console.log('Leads fetched:', leadsData?.length || 0);
          setLeads(leadsData || []);
        }
      } catch (err) {
        console.error('Failed to query leads table:', err);
        setLeads([]);
      }

      // SALES/DEALS - filter by workspace_id
      try {
        console.log('Attempting to fetch deals data for workspace:', activeWorkspace);
        
        const { data: dealsData, error: dealsError } = await supabase
          .from('deals')
          .select('*')
          .eq('workspace_id', activeWorkspace)
          .order('created_at', { ascending: false })
          .limit(10);

        if (dealsError) {
          console.error('Error fetching deals:', dealsError);
          } else {
          console.log('Deals fetched successfully:', dealsData?.length || 0);
          if (dealsData && dealsData.length > 0) {
            console.log('Sample deals data:', dealsData[0]); // Log first item for debugging
            setSales(dealsData);
          } else {
            console.log('No deals data found during fetch');
            setSales([]);
          }
        }
      } catch (err) {
        console.error('Failed to query deals table:', err);
        setSales([]);
      }

      // We will use the useDashboardStats hook instead of fetching stats directly
      // The stats fetching is now handled by the hook
      
      // INVOICES - filter by workspace_id (still need this for the invoice list)
      try {
        console.log('DEBUG: Attempting to fetch invoices for workspace:', activeWorkspace);
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('invoices')
          .select(`
            id,
            document_number,
            invoice_date,
            due_date,
            total,
            balance,
            workspace_id,
            customers (
              name
            ),
            currencies (
              code
            )
          `)
          .eq('workspace_id', activeWorkspace)
          .order('invoice_date', { ascending: false });

        if (invoicesError) {
          console.error('DEBUG: Invoices fetch error:', invoicesError);
        } else {
          console.log('DEBUG: Invoices fetched successfully:', invoicesData?.length || 0);
          if (invoicesData && invoicesData.length > 0) {
            console.log('DEBUG: First invoice sample:', invoicesData[0]);
            setInvoices(invoicesData || []);
          } else {
            console.warn('No invoices found in database');
            setInvoices([]);
          }
        }
      } catch (err) {
        console.error('Failed to query invoices table:', err);
        setInvoices([]);
      }

      // Try API endpoints omitted for brevity...

      // EMAILS - Gmail integration
      try {
        console.log('DEBUG: Attempting to fetch emails');
        // Use the correct endpoint /api/gmail/fetch
        const response = await fetch('/api/gmail/fetch', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const data = await response.json();
          console.log('Gmail API response:', data);
          if (data.emails && data.emails.length > 0) {
            const formattedEmails = data.emails.map((email: any) => ({
              id: email.id,
              subject: email.subject || 'No Subject',
              from: email.from || 'Unknown Sender',
              date: email.date || new Date().toISOString(),
              unread: email.unread || false
            }));
            console.log('Formatted emails from Gmail:', formattedEmails);
            // Limit to 5 emails for display
            setEmails(formattedEmails.slice(0, 5));
          } else {
            console.log('No emails returned from Gmail API');
            setEmails([]);
          }
        } else {
          console.error('Failed to fetch emails from Gmail API:', response.status);
          setEmails([]);
        }
      } catch (error) {
        console.error('Error fetching emails:', error);
        setEmails([]);
      }
      
      // CRON JOBS - using workspace filter if possible
      try {
        console.log('DEBUG: Attempting to fetch cron jobs');
        let cronJobsQuery = supabase
          .from('cron_jobs')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(5);
          
        // Add workspace filter if the table supports it
        if (activeWorkspace) {
          try {
            // Check if workspace_id column exists in cron_jobs table
            const { data: columnExists } = await supabase
              .from('information_schema.columns')
              .select('column_name')
              .eq('table_schema', 'public')
              .eq('table_name', 'cron_jobs')
              .eq('column_name', 'workspace_id')
              .maybeSingle();
              
            if (columnExists) {
              cronJobsQuery = cronJobsQuery.eq('workspace_id', activeWorkspace);
              console.log('Adding workspace filter to cron jobs query');
            }
          } catch (err) {
            console.error('Error checking cron_jobs columns:', err);
          }
        }
        
        const { data: cronJobsData, error: cronJobsError } = await cronJobsQuery;

        if (cronJobsError) {
          console.error('Error fetching cron jobs:', cronJobsError);
        } else {
          // Map data to include proper defaults
          const formattedJobs = (cronJobsData || []).map(job => ({
            ...job,
            name: job.name || job.job_type || 'Unknown Task',
            schedule: job.settings?.frequency ? 
              `${job.settings.frequency} (${job.settings.send_day || 'Any day'} at ${job.settings.send_time || 'Any time'})` : 
              'Not scheduled',
            status: job.status || 'pending',
            execution_status: job.execution_status || (job.last_run ? 'success' : 'pending')
          }));
          console.log('Cron jobs fetched:', formattedJobs.length);
          setCronJobs(formattedJobs);
        }
      } catch (err) {
        console.error('Failed to query cron_jobs table:', err);
        setCronJobs([]);
      }

      // Also try to fetch analytics data (optional)
      try {
        console.log('DEBUG: Attempting to fetch analytics data');
        const response = await fetch('/api/analytics/overview', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const data = await response.json();
          console.log('Analytics response:', data);
          if (data.analytics) {
            setAnalyticsData(data.analytics);
          }
        }
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id, activeWorkspace]);

  // Function to refresh all dashboard data - improved version
  const refreshDashboard = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      console.log('Forcing complete dashboard refresh...');
      
      // Step 1: Trigger a stats recalculation in the database first
      if (activeWorkspace) {
        try {
          console.log('Triggering stats recalculation for workspace:', activeWorkspace);
          const recalcResponse = await fetch(`/api/cron/refresh-stats?workspaceId=${activeWorkspace}`);
          
          if (!recalcResponse.ok) {
            console.warn('Stats recalculation may have failed, but continuing with refresh');
          } else {
            const recalcData = await recalcResponse.json();
            console.log('Stats recalculation complete:', recalcData);
          }
        } catch (recalcError) {
          console.error('Error during stats recalculation:', recalcError);
          // Continue with the refresh even if recalculation fails
        }
      }
      
      // Step 2: Now fetch the freshly calculated stats
      const timestamp = new Date().getTime();
      const refreshUrl = `/api/dashboard/stats?workspaceId=${activeWorkspace}&nocache=${timestamp}`;
      
      console.log(`Making direct API call to: ${refreshUrl}`);
      const response = await fetch(refreshUrl);
      
      if (!response.ok) {
        throw new Error('Failed to refresh dashboard stats');
      }
      
      const freshData = await response.json();
      console.log('Received fresh dashboard stats:', freshData);
      
      // Update local stats state directly
      if (freshData?.invoices) {
        setStats({
          totalRevenue: freshData.invoices.totalAmount || 0,
          invoiceCount: freshData.invoices.totalCount || 0,
          averageInvoiceValue: freshData.invoices.averageAmount || 0,
          revenueGrowth: 0
        });
      }
      
      // Then also fetch other dashboard data
      await fetchData();
      
      toast({
        title: "Dashboard fully refreshed",
        description: `Stats updated at ${new Date().toLocaleTimeString()} and saved to database`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error during complete dashboard refresh:', error);
      toast({
        title: "Refresh failed",
        description: "Could not refresh dashboard data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, activeWorkspace, fetchData, setStats, toast]);

  // Use effect for auto-refresh
  useEffect(() => {
    // Set up a refresh interval (every 5 minutes)
    const refreshInterval = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculateStats = (invoices: Invoice[]) => {
    console.log('Calculating stats from invoices, count:', invoices.length);
    
    // Validate each invoice has the required data
    const validInvoices = invoices.filter(inv => {
      if (inv.total === undefined || inv.total === null) {
        console.warn('Invoice missing total:', inv.document_number);
        return false;
      }
      return true;
    });
    
    console.log('Valid invoices for calculation:', validInvoices.length);
    
    // Calculate total revenue
    const total = validInvoices.reduce((sum, inv) => {
      // Handle both string and number formats
      const amount = typeof inv.total === 'string' ? parseFloat(inv.total) : inv.total;
      // Only add if it's a valid number
      const validAmount = !isNaN(amount) ? amount : 0;
      return sum + validAmount;
    }, 0);
    
    const count = validInvoices.length;
    const average = count > 0 ? total / count : 0;

    // Calculate growth by comparing last month to previous month
    const now = new Date();
    const lastMonthInvoices = validInvoices.filter(inv => {
      if (!inv.invoice_date) return false;
      const date = new Date(inv.invoice_date);
      return date.getMonth() === now.getMonth() - 1 && date.getFullYear() === now.getFullYear();
    });
    
    const previousMonthInvoices = validInvoices.filter(inv => {
      if (!inv.invoice_date) return false;
      const date = new Date(inv.invoice_date);
      return date.getMonth() === now.getMonth() - 2 && date.getFullYear() === now.getFullYear();
    });

    console.log('Last month invoices:', lastMonthInvoices.length);
    console.log('Previous month invoices:', previousMonthInvoices.length);

    const lastMonthTotal = lastMonthInvoices.reduce((sum, inv) => {
      const amount = typeof inv.total === 'string' ? parseFloat(inv.total) : inv.total;
      return sum + (!isNaN(amount) ? amount : 0);
    }, 0);
    
    const previousMonthTotal = previousMonthInvoices.reduce((sum, inv) => {
      const amount = typeof inv.total === 'string' ? parseFloat(inv.total) : inv.total;
      return sum + (!isNaN(amount) ? amount : 0);
    }, 0);

    const growth = previousMonthTotal > 0 
      ? ((lastMonthTotal - previousMonthTotal) / previousMonthTotal) * 100 
      : 0;

    console.log('Calculated invoice stats:', {
      totalRevenue: total,
      invoiceCount: count,
      averageInvoiceValue: average,
      revenueGrowth: growth,
      lastMonthTotal,
      previousMonthTotal
    });

    setStats({
      totalRevenue: total,
      invoiceCount: count,
      averageInvoiceValue: average,
      revenueGrowth: growth
    });
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    const name = session?.user?.name || 'there' // Use session user's name or fallback to 'there'
    
    if (hour < 12) return `Good morning, ${name}`
    if (hour < 17) return `Good afternoon, ${name}`
    return `Good evening, ${name}`
  }

  const getUpcomingDeadlines = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return tasks
      .filter(task => {
        if (!task.deadline) return false;
        const deadline = new Date(task.deadline)
        deadline.setHours(0, 0, 0, 0)
        // Only include future deadlines that aren't urgent (already shown in urgent tasks)
        return deadline > today && task.progress < 100
      })
      .sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      })
      .slice(0, 5)
  }

  const getUrgentTasks = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    return tasks
      .filter(task => {
        if (!task.deadline) return false;
        const deadline = new Date(task.deadline);
        // Consider tasks urgent if deadline is today or in the past, or if status is explicitly set to urgent
        return (deadline <= today && task.progress < 100) || task.status === 'urgent';
      })
      .sort((a, b) => {
        // If no deadline, put at the end
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        // Sort by deadline (oldest first)
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  }

  const handleTaskComplete = async (taskId: string) => {
    if (!session?.user?.id) {
      console.log('No user session found, cannot complete task');
      toast({
        title: "Authentication required",
        description: "Please log in to complete tasks",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Find the task in our local state
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        console.log('Task not found:', taskId);
        return;
      }
      
      console.log('Completing task:', task);
      
      // If the task doesn't have any checklist items, let's mark it as complete
      if (!task.checklist || task.checklist.length === 0) {
        console.log('Task has no checklist, marking as complete');
        // Update progress to 100%
        const { error } = await supabase
          .from('project_tasks')
          .update({ progress: 100 })
          .eq('id', taskId);
        
        if (error) {
          console.error('Supabase update error:', error);
          throw error;
        }
        
        // Update local state
        setTasks(prev => prev.map(t => 
          t.id === taskId ? { ...t, progress: 100 } : t
        ));
        
        // Show success message
        toast({
          title: "Task completed",
          description: "The task has been marked as complete",
        });
        
        // Trigger a dashboard refresh to update display
        refreshDashboard();
        return;
      }
      
      // If the task has checklist items, mark them all as complete
      console.log('Task has checklist, marking all items as complete');
      const updatedChecklist = task.checklist.map(item => ({
        ...item,
        done: true
      }));
      
      // Update in Supabase
      const { error } = await supabase
        .from('project_tasks')
        .update({ 
          checklist: updatedChecklist,
          progress: 100 
        })
        .eq('id', taskId);
      
      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }
      
      // Update local state
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { 
          ...t, 
          checklist: updatedChecklist,
          progress: 100 
        } : t
      ));
      
      // Show success message
      toast({
        title: "Task completed",
        description: "All checklist items have been marked as complete",
      });
      
      // Trigger a dashboard refresh to update display
      refreshDashboard();
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: "Error",
        description: "Failed to complete task",
        variant: "destructive",
      });
    }
  };

  // Add function to calculate total pipeline sales
  const calculateTotalPipeline = (salesData: Sale[]) => {
    return salesData.reduce((total, sale) => total + Number(sale.value), 0);
  };

  // Create state variables for top websites
  const [topWebsites, setTopWebsites] = useState<{url: string, pageviews: number}[]>([]);
  const [topSearchTerms, setTopSearchTerms] = useState<{term: string, clicks: number}[]>([]);

  // Function to refresh sales data specifically
  const refreshSalesData = async () => {
    try {
      setRefreshing(true);
      console.log('Refreshing deals data specifically');
      
      // Get workspace_id if available
      let workspaceId = null;
      
      if (session?.user?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('workspace_id')
          .eq('user_id', session.user.id)
          .single();
          
        if (profileData?.workspace_id) {
          workspaceId = profileData.workspace_id;
          console.log('Found workspace ID for refresh:', workspaceId);
        }
      }
      
      // Query based on workspace if available, otherwise fetch all
      let dealsQuery = supabase.from('deals').select('*');
      
      if (workspaceId) {
        dealsQuery = dealsQuery.eq('workspace_id', workspaceId);
      }
      
      const { data: dealsData, error: dealsError } = await dealsQuery
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (dealsError) {
        console.error('Error refreshing deals:', dealsError);
        toast({
          title: "Error",
          description: "Failed to refresh deals data",
          variant: "destructive",
        });
      } else {
        console.log('Deals refreshed successfully:', dealsData?.length || 0);
        if (dealsData && dealsData.length > 0) {
          console.log('Sample refreshed deals data:', dealsData[0]);
          setSales(dealsData);
        } else {
          console.log('No deals data found');
          setSales([]);
        }
        toast({
          title: "Success",
          description: "Deals data refreshed",
          variant: "default",
        });
      }
    } catch (err) {
      console.error('Failed to refresh deals:', err);
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Function to force a manual refresh of dashboard data
  const forceRefresh = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      console.log('Forcing complete manual dashboard refresh...');
      
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const workspaceParam = activeWorkspace ? `workspaceId=${activeWorkspace}` : '';
      const refreshUrl = `/api/dashboard/stats?${workspaceParam}&nocache=${timestamp}`;
      
      console.log(`Making direct API call to: ${refreshUrl}`);
      const response = await fetch(refreshUrl);
      
      if (!response.ok) {
        throw new Error('Failed to refresh dashboard stats');
      }
      
      const freshData = await response.json();
      console.log('Received fresh dashboard data:', freshData);
      
      // Update our local state with the fresh data
      if (freshData?.invoices) {
        setStats({
          totalRevenue: freshData.invoices.totalAmount || 0,
          invoiceCount: freshData.invoices.totalCount || 0,
          averageInvoiceValue: freshData.invoices.averageAmount || 0,
          revenueGrowth: 0 // Calculate this separately if needed
        });
      }
      
      // Also update other data sources if needed
      setRefreshing(false);
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      setRefreshing(false);
    }
  }, [refreshing, activeWorkspace]);

  // Add a state to track if the user has a Google Calendar integration
  const [hasGoogleCalendarIntegration, setHasGoogleCalendarIntegration] = useState<boolean | null>(null);

  // Check for Google Calendar integration when component mounts
  useEffect(() => {
    const checkForGoogleCalendarIntegration = async () => {
      if (!session?.user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('integrations')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('service_name', 'google-calendar')
          .maybeSingle();
          
        if (error) {
          console.error('Error checking for Google Calendar integration:', error);
          return;
        }
        
        // Check if integration exists and token is valid
        const hasValidIntegration = data && new Date(data.expires_at) > new Date();
        setHasGoogleCalendarIntegration(!!hasValidIntegration);
      } catch (err) {
        console.error('Failed to check Google Calendar integration:', err);
      }
    };
    
    checkForGoogleCalendarIntegration();
  }, [session?.user?.id]);

  // Update the calendar sync function to handle the case where integration is not set up
  const syncGoogleCalendarToWorkspace = async () => {
    if (!session?.user?.id || !activeWorkspace) {
      console.log('No user session or active workspace found, cannot sync calendar');
      toast({
        title: "Cannot sync calendar",
        description: "Please ensure you are logged in and have an active workspace",
        variant: "destructive",
      });
      return;
    }
    
    // If no Google Calendar integration, redirect to setup page
    if (hasGoogleCalendarIntegration === false) {
      router.push('/settings/integrations');
      return;
    }
    
    try {
      setRefreshing(true);
      console.log('Syncing Google Calendar events to workspace:', activeWorkspace);
      
      const response = await fetch('/api/calendar/sync-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync calendar events');
      }
      
      const result = await response.json();
      console.log('Calendar sync result:', result);
      
      // Refresh the calendar data to show newly synced events
      await fetchData();
      
      toast({
        title: "Calendar synced",
        description: `Synced ${result.stats.newEvents} new and ${result.stats.updatedEvents} updated events`,
        variant: "default",
      });
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Failed to sync calendar events",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Add a function to save calendar events directly to the database for workspace users
  const saveCalendarEventsToDatabase = async () => {
    if (!session?.user?.id || !activeWorkspace) {
      console.log('No user session or active workspace found, cannot save calendar events');
      toast({
        title: "Cannot save events",
        description: "Please ensure you are logged in and have an active workspace",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setRefreshing(true);
      console.log('Saving calendar events to database for workspace:', activeWorkspace);
      
      // First check if there are any existing events that need to be synced
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
                  toast({
                    title: "Calendar events saved",
                    description: `Saved ${result.stats.eventsSaved} events to database for workspace users`,
                    variant: "default",
                  });
                } else {
                  toast({
                    title: "No new events to save",
                    description: result.message || "No new calendar events were found to save",
                    variant: "default",
                  });
                }
                
                if (result.stats.isPartialSync) {
                  toast({
                    title: "Partial sync completed",
                    description: `Note: Only processed ${result.stats.eventsProcessed} of ${result.stats.eventsFound} events to avoid timeout.`,
                    variant: "default",
                  });
                }
                
                // Refresh the data immediately with a direct DB query
                try {
                  console.log('Directly querying for updated calendar events after save');
                  const { data: calendarEventsData, error: calendarError } = await supabase
                    .from('calendar_events')
                    .select('*')
                    .eq('workspace_id', activeWorkspace)
                    .gte('start_time', new Date(new Date().setDate(new Date().getDate() - 1)).toISOString()) // From yesterday
                    .lte('start_time', new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()) // To one month ahead
                    .order('start_time', { ascending: true })
                    .limit(10);
                    
                  if (calendarError) {
                    console.error('Error fetching calendar events after save:', calendarError);
                  } else if (calendarEventsData && calendarEventsData.length > 0) {
                    console.log(`Found ${calendarEventsData.length} calendar events after save, updating meetings state`);
                    const transformedMeetings = calendarEventsData.map(event => ({
                      id: event.id,
                      title: event.title,
                      start_time: event.start_time,
                      end_time: event.end_time,
                      description: event.description || ''
                    }));
                    setMeetings(transformedMeetings);
                  }
                } catch (refreshError) {
                  console.error('Error refreshing calendar data after save:', refreshError);
                }
                
                // Also do a full data refresh in the background
                await fetchData();
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
          const errorMessage = fetchError instanceof Error ? fetchError.message : "Failed to save calendar events to database";
          
          if (fetchError.name === 'AbortError') {
            console.warn('Request timed out, retrying...');
          } else {
            console.error('Error in save attempt:', fetchError);
          }
          
          retryCount++;
          
          // Only retry timeouts or network errors, not auth/permission issues
          if (retryCount <= maxRetries && (fetchError.name === 'AbortError' || !(errorMessage.includes('401') || errorMessage.includes('403')))) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw fetchError; // Re-throw to be caught by outer catch
          }
        }
      }
      
      if (!success && retryCount > maxRetries) {
        toast({
          title: "Save failed",
          description: "Failed to save events after multiple attempts. Please try again later.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error saving events to database:', error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save events to database",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  if (view === 'agenda') {
    return <div className="text-neutral-400">Agenda view removed.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-400"></div>
      </div>
    )
  }

  // If there's no active workspace, show a workspace selector instead of the dashboard
  if (!activeWorkspace && workspaces.length > 0) {
  return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <div className="w-full max-w-md p-6 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-white mb-4 text-center">Select a Workspace</h2>
          <p className="text-neutral-400 mb-6 text-center">
            You need to select a workspace to view your dashboard
          </p>
          
          <div className="space-y-4">
            {workspaces.map(workspace => (
              <button
                key={workspace.id}
                onClick={() => handleWorkspaceChange(workspace.id)}
                className="w-full p-4 bg-neutral-700 hover:bg-neutral-600 rounded-lg flex items-center transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center mr-4">
                  <Grid className="h-5 w-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-white">{workspace.name}</p>
                  <p className="text-xs text-neutral-400">Tap to select this workspace</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // If the user doesn't have any workspaces yet, show a message
  if (workspaces.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <div className="w-full max-w-md p-6 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg text-center">
          <Grid className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Workspaces Found</h2>
          <p className="text-neutral-400 mb-6">
            You don't have access to any workspaces yet. Please create a workspace or ask your administrator to invite you.
          </p>
          <Button
            onClick={() => router.push('/settings/team')}
            className="bg-blue-600 hover:bg-blue-500"
          >
            Go to Team Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Debug alert removed as everything is working correctly */}
    
      <div className="flex justify-between items-center mb-2">
        <div className="group relative flex-1 mr-4 overflow-hidden rounded-lg">
          <div className="relative z-10 m-[2px] bg-neutral-800 p-6 rounded-lg shadow-lg">
            <GlowingEffect 
              spread={30} 
              glow={true} 
              disabled={false} 
              proximity={60} 
              inactiveZone={0.01}
              borderWidth={1.5}
              movementDuration={1.5}
              variant="default"
            />
            <div className="relative z-20">
        <h2 className="text-2xl font-bold text-white">{getGreeting()}</h2>
        <p className="text-neutral-400 mt-2">Here's what's happening today</p>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          {/* Workspace Selector */}
          {workspaces.length > 1 && (
            <div className="group relative overflow-hidden rounded-lg">
              <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-green-500 via-blue-500 to-green-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
              
              <div className="relative z-10 m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
                <select
                  className="h-10 px-3 text-sm font-medium bg-transparent border-0 rounded-lg text-neutral-200 focus:outline-none focus:ring-0 appearance-none pr-8"
                  value={activeWorkspace || ''}
                  onChange={(e) => handleWorkspaceChange(e.target.value)}
                >
                  {workspaces.map(workspace => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-neutral-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )}
          
          <div className="group relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
            
            <div className="relative z-10 m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
              <Button 
                variant="ghost" 
                className="border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white"
                onClick={forceRefresh}
                disabled={refreshing || statsLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing || statsLoading ? 'animate-spin' : ''}`} />
                {refreshing || statsLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-green-500 via-blue-500 to-green-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
            
            <div className="relative z-10 m-[1px] bg-neutral-800 rounded-lg hover:bg-neutral-750 transition-colors duration-300">
              <Button 
                variant="ghost" 
                className="border-0 bg-transparent text-neutral-200 hover:bg-transparent hover:text-white"
                onClick={() => setIsCustomizing(!isCustomizing)}
              >
                {isCustomizing ? <X className="h-4 w-4 mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                {isCustomizing ? 'Cancel' : 'Customize Dashboard'}
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {isCustomizing && (
        <Card className="p-6 bg-neutral-800 border-neutral-700 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Customize Your Dashboard</h3>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                className="bg-neutral-700 border-neutral-600 text-neutral-200 hover:bg-neutral-600"
                onClick={() => setIsCustomizing(false)}
              >
                Cancel
              </Button>
              
              <Button 
                variant="default" 
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={applyChanges}
              >
                Save Changes
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.revenueStats ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.revenueStats ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, revenueStats: !prev.revenueStats }))}
              >
                {visibleWidgets.revenueStats ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Revenue Stats</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.invoiceStats ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.invoiceStats ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, invoiceStats: !prev.invoiceStats }))}
              >
                {visibleWidgets.invoiceStats ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Invoice Count</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.averageInvoice ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.averageInvoice ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, averageInvoice: !prev.averageInvoice }))}
              >
                {visibleWidgets.averageInvoice ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Average Invoice</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.recentInvoices ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.recentInvoices ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, recentInvoices: !prev.recentInvoices }))}
              >
                {visibleWidgets.recentInvoices ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Recent Invoices</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.invoiceTypes ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.invoiceTypes ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, invoiceTypes: !prev.invoiceTypes }))}
              >
                {visibleWidgets.invoiceTypes ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Invoice Types</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.upcomingEvents ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.upcomingEvents ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, upcomingEvents: !prev.upcomingEvents }))}
              >
                {visibleWidgets.upcomingEvents ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Upcoming Events</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.upcomingDeadlines ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.upcomingDeadlines ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, upcomingDeadlines: !prev.upcomingDeadlines }))}
              >
                {visibleWidgets.upcomingDeadlines ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Upcoming Deadlines</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.urgentTasks ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.urgentTasks ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, urgentTasks: !prev.urgentTasks }))}
              >
                {visibleWidgets.urgentTasks ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Urgent Tasks</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.domains ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.domains ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, domains: !prev.domains }))}
              >
                {visibleWidgets.domains ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Domains</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.leads ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.leads ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, leads: !prev.leads }))}
              >
                {visibleWidgets.leads ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Leads</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.sales ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.sales ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, sales: !prev.sales }))}
              >
                {visibleWidgets.sales ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Sales</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.gmailHub ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.gmailHub ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, gmailHub: !prev.gmailHub }))}
              >
                {visibleWidgets.gmailHub ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Gmail Hub</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.analyticsData ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.analyticsData ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, analyticsData: !prev.analyticsData }))}
              >
                {visibleWidgets.analyticsData ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Analytics</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.searchConsole ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.searchConsole ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, searchConsole: !prev.searchConsole }))}
              >
                {visibleWidgets.searchConsole ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Search Console</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-neutral-700 rounded-md bg-neutral-850">
              <Button 
                variant={visibleWidgets.cronJobs ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.cronJobs ? 'bg-green-600 hover:bg-green-700' : 'bg-neutral-700'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, cronJobs: !prev.cronJobs }))}
              >
                {visibleWidgets.cronJobs ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-neutral-300">Scheduled Tasks</span>
            </div>
          </div>
        </Card>
      )}

      {visibleWidgets.revenueStats || visibleWidgets.invoiceStats || visibleWidgets.averageInvoice ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {visibleWidgets.revenueStats && (
            <Link href="/invoices" className="block relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                View Details →
              </span>
              <AnimatedBorderCard className="p-6 bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[180px]" gradient="blue-purple">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-400">Total Revenue</p>
              <h3 className="text-2xl font-bold mt-2 text-white">
                {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                  .format(stats.totalRevenue)}
              </h3>
              <div className="mt-4 flex items-center gap-2">
                <div className={`flex items-center gap-1 ${stats.revenueGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stats.revenueGrowth >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  <span>{Math.abs(stats.revenueGrowth).toFixed(1)}%</span>
                </div>
                <p className="text-sm text-neutral-400">vs last month</p>
              </div>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-full">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
              </AnimatedBorderCard>
            </Link>
          )}

          {visibleWidgets.invoiceStats && (
            <Link href="/invoices" className="block relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                View Details →
              </span>
              <AnimatedBorderCard className="p-6 bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[180px]" gradient="green-blue">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-400">Total Invoices</p>
              <h3 className="text-2xl font-bold mt-2 text-white">{stats.invoiceCount}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-full">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
          </div>
              </AnimatedBorderCard>
            </Link>
          )}

          {visibleWidgets.averageInvoice && (
            <Link href="/invoices" className="block relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                View Details →
              </span>
              <AnimatedBorderCard className="p-6 bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[180px]" gradient="purple-pink">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-400">Average Invoice</p>
              <h3 className="text-2xl font-bold mt-2 text-white">
                {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' })
                  .format(stats.averageInvoiceValue)}
              </h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-full">
              <BarChart className="w-6 h-6 text-purple-400" />
            </div>
          </div>
              </AnimatedBorderCard>
            </Link>
          )}
      </div>
      ) : null}

      {visibleWidgets.recentInvoices || visibleWidgets.invoiceTypes ? (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {visibleWidgets.recentInvoices && (
            <Link href="/invoices" className="block lg:col-span-2 relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                View All Invoices →
              </span>
              <AnimatedBorderCard className="lg:col-span-2 bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[350px]" gradient="blue-purple">
          <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Recent Invoices</h3>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-auto">
              <table className="w-full">
                  <thead className="sticky top-0 bg-neutral-800 z-10">
                  <tr>
                    <th className="text-left text-sm font-medium text-neutral-400 pb-4">Customer</th>
                    <th className="text-left text-sm font-medium text-neutral-400 pb-4">Date</th>
                    <th className="text-right text-sm font-medium text-neutral-400 pb-4">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-700">
                  {invoices.slice(0, 5).map((invoice) => (
                    <tr key={invoice.document_number}>
                        <td className="py-4 text-sm text-white">
                          <div className="truncate max-w-[180px]" title={invoice.customers?.name}>
                            {invoice.customers?.name}
                          </div>
                        </td>
                      <td className="py-4 text-sm text-neutral-400">
                        {new Date(invoice.invoice_date).toLocaleDateString('sv-SE')}
                      </td>
                      <td className="py-4 text-sm text-right font-medium text-white">
                        {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: invoice.currencies?.code || 'SEK' })
                          .format(invoice.total)}
                      </td>
                    </tr>
                  ))}
                    {invoices.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-sm text-center text-neutral-400">No invoices found</td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
              </AnimatedBorderCard>
            </Link>
          )}

          {visibleWidgets.invoiceTypes && (
            <Link href="/invoices" className="block relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                View Details →
              </span>
              <AnimatedBorderCard className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[350px]" gradient="green-blue">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white">Invoice Types</h3>
            <div className="mt-6 space-y-4">
              {Object.entries(
                invoices.reduce((acc, inv) => {
                  const type = inv.balance === 0 ? 'Paid' : inv.balance === inv.total ? 'Unpaid' : 'Partial'
                  acc[type] = (acc[type] || 0) + 1
                  return acc
                }, {} as Record<string, number>)
              ).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">{type}</span>
                  <span className="text-sm font-medium text-white">{count}</span>
                </div>
              ))}
                    {invoices.length === 0 && (
                      <div className="text-sm text-center text-neutral-400">No invoice data</div>
                    )}
            </div>
          </div>
              </AnimatedBorderCard>
            </Link>
          )}
      </div>
      ) : null}

      {visibleWidgets.upcomingEvents || visibleWidgets.upcomingDeadlines || visibleWidgets.urgentTasks ? (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {visibleWidgets.upcomingEvents && (
            <Link href="/calendar" className="block relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                Go to Calendar →
              </span>
              <AnimatedBorderCard className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[350px]" gradient="blue-purple">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Upcoming Events</h3>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                className="text-xs bg-neutral-700 hover:bg-neutral-600"
                title="Save calendar events to database for workspace users"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  saveCalendarEventsToDatabase();
                }}
                disabled={refreshing}
              >
                Save to DB
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="p-2 h-9 hover:bg-neutral-700/50"
                title={hasGoogleCalendarIntegration === false ? "Connect Google Calendar" : "Sync Google Calendar to workspace"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  syncGoogleCalendarToWorkspace();
                }}
                disabled={refreshing}
              >
                {hasGoogleCalendarIntegration === false ? (
                  <Globe className="h-4 w-4" />
                ) : (
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="p-2 h-9 hover:bg-neutral-700/50"
                title="Calendar diagnostics"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(`/api/calendar/diagnose?workspaceId=${activeWorkspace}`, '_blank');
                }}
              >
                <HelpCircle className="h-4 w-4 text-neutral-400" />
              </Button>
              <Calendar className="w-5 h-5 text-neutral-400" />
            </div>
          </div>
          <div className="space-y-4">
            {meetings && meetings.length > 0 ? (
              meetings.slice(0, 5).map(meeting => (
                <div key={meeting.id} className="flex items-start space-x-4">
                  <div className="p-2 bg-blue-500/10 rounded-full">
                    <Clock className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-white truncate" title={meeting.title}>{meeting.title}</p>
                    <p className="text-xs text-neutral-400 truncate" title={`${new Date(meeting.start_time).toLocaleDateString()} at ${new Date(meeting.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`}>
                      {new Date(meeting.start_time).toLocaleDateString()} at {' '}
                      {new Date(meeting.start_time).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true
                      })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-4">
                <p className="text-sm text-neutral-400 mb-2">No upcoming events</p>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    className="text-xs bg-neutral-700 hover:bg-neutral-600"
                  >
                    <Link href="/calendar">Add Event</Link>
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="text-xs bg-neutral-700 hover:bg-neutral-600"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      saveCalendarEventsToDatabase();
                    }}
                  >
                    Save to Database
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="text-xs bg-neutral-700 hover:bg-neutral-600"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      syncGoogleCalendarToWorkspace();
                    }}
                  >
                    {refreshing ? 'Syncing...' : (hasGoogleCalendarIntegration === false ? 'Connect Calendar' : 'Sync Calendar')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </AnimatedBorderCard>
    </Link>
  )}

          {visibleWidgets.upcomingDeadlines && (
            <Link href="/projects" className="block relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                View All Deadlines →
              </span>
              <AnimatedBorderCard className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[350px]" gradient="green-blue">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Upcoming Deadlines</h3>
              <Clock className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="space-y-4">
                    {getUpcomingDeadlines().length > 0 ? (
                      getUpcomingDeadlines().map(task => (
                <div key={task.id} className="flex items-start space-x-4">
                  <div className="p-2 bg-yellow-500/10 rounded-full">
                    <Clock className="w-4 h-4 text-yellow-400" />
                  </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium text-white truncate" title={task.title}>{task.title}</p>
                            <div className="flex justify-between items-center mt-1">
                              <p className="text-xs text-yellow-400">
                                Due: {new Date(task.deadline as string).toLocaleDateString()}
                              </p>
                              <div className="bg-neutral-700 h-2 w-24 rounded-full overflow-hidden">
                                <div 
                                  className="bg-green-500 h-full" 
                                  style={{ width: `${task.progress}%` }} 
                                />
                  </div>
                </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4">
                        <p className="text-sm text-neutral-400 mb-2">No upcoming deadlines</p>
                        <Button 
                          variant="outline"
                          size="sm"
                          className="text-xs bg-neutral-700 hover:bg-neutral-600"
                          asChild
                        >
                          <Link href="/projects">View Projects</Link>
                        </Button>
                      </div>
              )}
            </div>
          </div>
              </AnimatedBorderCard>
            </Link>
          )}

          {visibleWidgets.urgentTasks && (
            <AnimatedBorderCard className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[350px]" gradient="orange-red">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Urgent Tasks</h3>
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div className="space-y-4">
                  {getUrgentTasks().length > 0 ? (
                    getUrgentTasks().slice(0, 5).map(task => (
                <div key={task.id} className="flex items-start space-x-4">
                        <button
                          onClick={() => handleTaskComplete(task.id)}
                          className={cn(
                            "p-2 rounded-full transition-colors",
                            task.progress >= 100 
                              ? "bg-green-500/20 text-green-400" 
                              : "bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300"
                          )}
                        >
                          {task.progress >= 100 ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <AlertCircle className="w-4 h-4" />
                          )}
                        </button>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-medium text-white truncate" title={task.title}>{task.title}</p>
                          <div className="flex justify-between items-center mt-1">
                            {task.deadline ? (
                              <p className="text-xs text-red-400">
                                Due: {new Date(task.deadline).toLocaleDateString()}
                              </p>
                            ) : (
                              <p className="text-xs text-red-400">Urgent</p>
                            )}
                            <div className="bg-neutral-700 h-2 w-24 rounded-full overflow-hidden">
                              <div 
                                className="bg-green-500 h-full" 
                                style={{ width: `${task.progress}%` }} 
                              />
                  </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4">
                      <p className="text-sm text-neutral-400 mb-2">No urgent tasks</p>
                      <Button 
                        variant="outline"
                        size="sm"
                        className="text-xs bg-neutral-700 hover:bg-neutral-600"
                        asChild
                      >
                        <Link href="/projects">View Projects</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </AnimatedBorderCard>
          )}
      </div>
      ) : null}

      {/* Domains, Leads and Sales section */}
      {visibleWidgets.domains || visibleWidgets.leads || visibleWidgets.sales ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {visibleWidgets.domains && (
            <Link href="/domains" className="block relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                View All Domains →
              </span>
              <AnimatedBorderCard className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[350px]" gradient="blue-purple">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">Domain Expiry</h3>
                    <Globe className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div className="space-y-4">
                    {domains.map(domain => (
                      <div key={domain.id} className="flex items-start space-x-4">
                        <div className="p-2 bg-blue-500/10 rounded-full">
                          <Globe className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-medium text-white truncate" title={domain.name}>{domain.name}</p>
                          <p className="text-xs text-neutral-400">
                            Expires: {new Date(domain.expiry_date).toLocaleDateString('sv-SE')}
                          </p>
                  </div>
                </div>
              ))}
                    {domains.length === 0 && (
                      <p className="text-sm text-neutral-400">No domains found</p>
              )}
            </div>
          </div>
              </AnimatedBorderCard>
            </Link>
          )}

          {visibleWidgets.leads && <RecentLeads />}

          {visibleWidgets.sales && (
            <Link href="/sales" className="block relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                View All Sales →
              </span>
              <AnimatedBorderCard className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[350px]" gradient="purple-pink">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">Recent Sales</h3>
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        className="h-8 w-8 p-0"
                        onClick={async (e) => {
                          e.preventDefault(); // Prevent navigation
                          e.stopPropagation(); // Stop event propagation
                          refreshSalesData();
                        }}
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                      </Button>
                      <TrendingUp className="w-5 h-5 text-neutral-400" />
                    </div>
                  </div>
                  
                  {sales.length > 0 && (
                    <div className="mb-4 p-3 bg-neutral-700/20 rounded-md">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-neutral-300">Pipeline Total:</span>
                        <span className="text-sm font-medium text-green-400">
                          {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(calculateTotalPipeline(sales))}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    {sales.map(sale => (
                      <div key={sale.id} className="flex items-start space-x-4">
                        <div className="p-2 bg-purple-500/10 rounded-full">
                          <TrendingUp className={`w-4 h-4 ${sale.stage === 'closed_won' ? 'text-green-400' : 'text-purple-400'}`} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-medium text-white truncate" title={sale.lead_name}>{sale.lead_name}</p>
                          <p className="text-xs text-neutral-400">
                            {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(sale.value)}
                          </p>
                          <p className="text-xs text-neutral-400">
                            <span className={`${
                              sale.stage === 'closed_won' ? 'text-green-400' : 
                              sale.stage === 'proposal' ? 'text-yellow-400' : 
                              'text-blue-400'
                            }`}>
                              {sale.stage.charAt(0).toUpperCase() + sale.stage.slice(1).replace('_', ' ')}
                            </span> - {new Date(sale.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {sales.length === 0 && (
                      <p className="text-sm text-neutral-400">No sales found</p>
                    )}
                  </div>
                </div>
              </AnimatedBorderCard>
            </Link>
          )}
        </div>
      ) : null}

      {visibleWidgets.invoiceSummary || visibleWidgets.salesMetrics ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {visibleWidgets.invoiceSummary && (
            <Link href="/finances" className="block relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                Open Finance Dashboard →
              </span>
              <AnimatedBorderCard className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl" gradient="blue-purple">
                <div className="p-6 relative overflow-hidden">
                  <Glow variant="top" className="opacity-30 group-hover:opacity-60 transition-opacity duration-700" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-white">Invoice Summary</h3>
                      <CreditCard className="w-5 h-5 text-neutral-400" />
                    </div>
                    {invoices.length > 0 ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-neutral-700/20 rounded-lg p-3">
                            <p className="text-xs text-neutral-400 mb-1">Outstanding</p>
                            <p className="text-lg font-semibold text-white">
                              {
                                new Intl.NumberFormat('sv-SE', { 
                                  style: 'currency', 
                                  currency: 'SEK'
                                }).format(
                                  invoices.reduce((total, invoice) => total + invoice.balance, 0)
                                )
                              }
                            </p>
                          </div>
                          <div className="bg-neutral-700/20 rounded-lg p-3">
                            <p className="text-xs text-neutral-400 mb-1">Total Invoiced</p>
                            <p className="text-lg font-semibold text-white">
                              {
                                new Intl.NumberFormat('sv-SE', { 
                                  style: 'currency', 
                                  currency: 'SEK'
                                }).format(
                                  invoices.reduce((total, invoice) => total + invoice.total, 0)
                                )
                              }
                            </p>
                          </div>
                        </div>
                        
                        <h4 className="text-sm font-medium text-white pt-2">Recent Invoices</h4>
                        <div className="space-y-2">
                          {invoices.slice(0, 3).map(invoice => (
                            <div key={invoice.document_number} className="flex justify-between items-center p-2 rounded-lg hover:bg-neutral-700/20">
                  <div>
                                <p className="text-sm font-medium text-white">{invoice.customers.name}</p>
                                <p className="text-xs text-neutral-400">
                                  #{invoice.document_number} · {new Date(invoice.invoice_date).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-white">
                                  {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: invoice.currencies?.code || "SEK" }).format(invoice.total)}
                                </p>
                                <p className={`text-xs ${invoice.balance > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                                  {invoice.balance > 0 ? 'Outstanding' : 'Paid'}
                                </p>
                  </div>
                </div>
              ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-400">No invoice data available</p>
              )}
            </div>
                </div>
              </AnimatedBorderCard>
            </Link>
          )}

          {visibleWidgets.salesMetrics && (
            <Link href="/sales" className="block relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                Open Sales Dashboard →
              </span>
              <AnimatedBorderCard className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl" gradient="purple-pink">
                <div className="p-6 relative overflow-hidden">
                  <Glow variant="top" className="opacity-30 group-hover:opacity-60 transition-opacity duration-700" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-white">Sales Pipeline</h3>
                      <TrendingUp className="w-5 h-5 text-neutral-400" />
                    </div>
                    {sales.length > 0 ? (
                      <div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-neutral-700/20 rounded-lg p-3">
                            <p className="text-xs text-neutral-400 mb-1">Active Deals</p>
                            <p className="text-lg font-semibold text-white">
                              {sales.filter(sale => sale.stage !== 'closed_won' && sale.stage !== 'closed_lost').length}
                            </p>
                          </div>
                          <div className="bg-neutral-700/20 rounded-lg p-3">
                            <p className="text-xs text-neutral-400 mb-1">Pipeline Total</p>
                            <p className="text-lg font-semibold text-white">
                              {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(calculateTotalPipeline(sales))}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-3 mt-3">
                          {sales.slice(0, 3).map(sale => (
                            <div key={sale.id} className="flex items-start space-x-3">
                              <div className="p-2 bg-purple-500/10 rounded-full">
                                <TrendingUp className={`w-4 h-4 ${sale.stage === 'closed_won' ? 'text-green-400' : 'text-purple-400'}`} />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium text-white truncate" title={sale.lead_name}>{sale.lead_name}</p>
                                <p className="text-xs text-neutral-400">
                                  {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(sale.value)}
                                </p>
                                <p className="text-xs text-neutral-400">
                                  <span className={`${
                                    sale.stage === 'closed_won' ? 'text-green-400' : 
                                    sale.stage === 'proposal' ? 'text-yellow-400' : 
                                    'text-blue-400'
                                  }`}>
                                    {sale.stage.charAt(0).toUpperCase() + sale.stage.slice(1).replace('_', ' ')}
                                  </span> - {new Date(sale.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-400">No sales data available</p>
                    )}
                  </div>
                </div>
              </AnimatedBorderCard>
            </Link>
          )}
        </div>
      ) : null}

      {/* Gmail Hub, Analytics and Search Console */}
      {visibleWidgets.gmailHub || visibleWidgets.analyticsData || visibleWidgets.searchConsole ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {visibleWidgets.gmailHub && (
            <Link href="/gmail-hub" className="block relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                Open Gmail Hub →
              </span>
              <AnimatedBorderCard className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[350px]" gradient="orange-red">
                <div className="p-6 relative overflow-hidden">
                  <Glow variant="right" className="opacity-30 group-hover:opacity-70 transition-opacity duration-700" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-white">Recent Emails</h3>
                      <Inbox className="w-5 h-5 text-neutral-400" />
                    </div>
                    <div className="space-y-4">
                      {emails.map(email => (
                        <div key={email.id} className="flex items-start space-x-4">
                          <div className={`p-2 ${email.unread ? 'bg-blue-500/20' : 'bg-neutral-700/20'} rounded-full`}>
                            <Inbox className={`w-4 h-4 ${email.unread ? 'text-blue-400' : 'text-neutral-400'}`} />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className={`text-sm font-medium ${email.unread ? 'text-white' : 'text-neutral-300'} truncate`} title={email.subject}>
                              {email.subject}
                            </p>
                            <p className="text-xs text-neutral-400 truncate" title={`${email.from} - ${new Date(email.date).toLocaleDateString('sv-SE')}`}>
                              {email.from} - {new Date(email.date).toLocaleDateString('sv-SE')}
                            </p>
                          </div>
                        </div>
                      ))}
                      {emails.length === 0 && (
                        <p className="text-sm text-neutral-400">No recent emails</p>
                      )}
                    </div>
                  </div>
                </div>
              </AnimatedBorderCard>
            </Link>
          )}

          {visibleWidgets.analyticsData && (
            <Link href="/analytics" className="block relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                View Analytics →
              </span>
              <AnimatedBorderCard className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[350px]" gradient="blue-purple">
                <div className="p-6 relative overflow-hidden">
                  <Glow variant="center" className="opacity-30 group-hover:opacity-70 transition-opacity duration-700" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-white">Analytics Overview</h3>
                      <LineChart className="w-5 h-5 text-neutral-400" />
                    </div>
                    {analyticsData ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-neutral-400">Pageviews</span>
                          <span className="text-sm font-medium text-white">{analyticsData.pageviews.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-neutral-400">Visitors</span>
                          <span className="text-sm font-medium text-white">{analyticsData.visitors.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-neutral-400">Bounce Rate</span>
                          <span className="text-sm font-medium text-white">{analyticsData.bounce_rate.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-neutral-400">Avg. Session</span>
                          <span className="text-sm font-medium text-white">{analyticsData.avg_session_duration.toFixed(1)}s</span>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-neutral-700">
                          <h4 className="text-sm font-medium text-white mb-2">Top Pages</h4>
                          {topWebsites && topWebsites.length > 0 ? (
                            topWebsites.map((site, index) => (
                              <div key={index} className="flex justify-between text-xs mb-1">
                                <span className="text-neutral-400 truncate max-w-[70%]" title={site.url}>{site.url}</span>
                                <span className="text-neutral-300">{site.pageviews.toLocaleString()}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-neutral-400">No data available</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-400">No analytics data available</p>
                    )}
                  </div>
                </div>
              </AnimatedBorderCard>
            </Link>
          )}

          {visibleWidgets.searchConsole && (
            <Link href="/marketing" className="block relative group">
              <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                View Search Console →
              </span>
              <AnimatedBorderCard className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[350px]" gradient="green-blue">
                <div className="p-6 relative overflow-hidden">
                  <Glow variant="left" className="opacity-30 group-hover:opacity-70 transition-opacity duration-700" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-white">Search Performance</h3>
                      <LineChart className="w-5 h-5 text-neutral-400" />
                    </div>
                    {searchConsoleData ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-neutral-400">Clicks</span>
                          <span className="text-sm font-medium text-white">{searchConsoleData.clicks.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-neutral-400">Impressions</span>
                          <span className="text-sm font-medium text-white">{searchConsoleData.impressions.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-neutral-400">CTR</span>
                          <span className="text-sm font-medium text-white">{searchConsoleData.ctr.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-neutral-400">Avg. Position</span>
                          <span className="text-sm font-medium text-white">{searchConsoleData.position.toFixed(1)}</span>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-neutral-700">
                          <h4 className="text-sm font-medium text-white mb-2">Top Search Terms</h4>
                          {topSearchTerms && topSearchTerms.length > 0 ? (
                            topSearchTerms.map((term, index) => (
                              <div key={index} className="flex justify-between text-xs mb-1">
                                <span className="text-neutral-400 truncate max-w-[70%]" title={term.term}>{term.term}</span>
                                <span className="text-neutral-300">{term.clicks} clicks</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-neutral-400">No data available</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-400">No search data available</p>
                    )}
                  </div>
                </div>
              </AnimatedBorderCard>
            </Link>
          )}
        </div>
      ) : null}

      {/* Scheduled Tasks - Split into two cards for better symmetry */}
      {visibleWidgets.cronJobs && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Link href="/settings/cron" className="block lg:col-span-2 relative group">
            <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              Manage Scheduled Tasks →
            </span>
            <AnimatedBorderCard className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl h-[350px]" gradient="purple-pink">
              <div className="p-6 relative overflow-hidden">
                <Glow variant="bottom" className="opacity-30 group-hover:opacity-70 transition-opacity duration-700" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">Scheduled Tasks</h3>
                    <Clock className="w-5 h-5 text-neutral-400" />
                  </div>
                  {cronJobs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="text-left text-sm font-medium text-neutral-400 pb-4">Task</th>
                            <th className="text-left text-sm font-medium text-neutral-400 pb-4">Schedule</th>
                            <th className="text-right text-sm font-medium text-neutral-400 pb-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-700">
                          {cronJobs.slice(0, 4).map((job) => (
                            <tr key={job.id}>
                              <td className="py-3 text-sm font-medium text-white">
                                <div className="truncate max-w-[180px]" title={job.name || job.job_type || "Unknown Task"}>
                                  {job.name || job.job_type || "Unknown Task"}
                                </div>
                              </td>
                              <td className="py-3 text-sm text-neutral-400">
                                {job.schedule || "Custom"}
                              </td>
                              <td className="py-3 text-sm text-right">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  job.status === 'active' 
                                    ? 'bg-green-500/20 text-green-400' 
                                    : 'bg-neutral-700/50 text-neutral-400'
                                }`}>
                                  {job.status === 'active' ? 'Active' : 'Paused'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48">
                      <p className="text-sm text-neutral-400 mb-4">No scheduled tasks configured</p>
                      <Button variant="outline" size="sm" className="bg-neutral-700 hover:bg-neutral-600">
                        Create Scheduled Task
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </AnimatedBorderCard>
          </Link>
          <AnimatedBorderCard className="p-6 bg-neutral-800 border-neutral-700 shadow-lg h-[350px] flex flex-col justify-between" gradient="green-blue">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Task Status</h3>
              <div className="space-y-4">
                {cronJobs.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400">Active Tasks</span>
                      <span className="text-sm font-medium text-white">
                        {cronJobs.filter(job => job.status === 'active').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400">Paused Tasks</span>
                      <span className="text-sm font-medium text-white">
                        {cronJobs.filter(job => job.status !== 'active').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400">Successful</span>
                      <span className="text-sm font-medium text-green-400">
                        {cronJobs.filter(job => !job.error_message).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-400">Failed</span>
                      <span className="text-sm font-medium text-red-400">
                        {cronJobs.filter(job => job.error_message).length}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-neutral-400">No tasks to display</p>
                )}
              </div>
            </div>
            <Button variant="outline" className="bg-neutral-700 hover:bg-neutral-600 w-full" asChild>
              <Link href="/settings/cron">Manage All Tasks</Link>
            </Button>
          </AnimatedBorderCard>
        </div>
      )}

      {/* Task Overview */}
      {visibleWidgets.taskOverview && (
        <div className="mb-6">
          <Link href="/tasks" className="block relative group">
            <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              Open Task Manager →
            </span>
            <Card className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl relative overflow-hidden">
              <GlowingEffect 
                spread={30} 
                glow={true} 
                disabled={false} 
                proximity={60} 
                inactiveZone={0.01}
                borderWidth={1.5}
                movementDuration={1.5}
                variant="default"
              />
              <div className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Task Overview</h3>
                  <div className="flex gap-2 items-center">
                    <CheckCircle className="w-5 h-5 text-neutral-400" />
                  </div>
                </div>
                {/* ... existing code ... */}
                <div className="space-y-4">
                  {tasks.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-neutral-700/20 rounded-lg p-3">
                          <p className="text-xs text-neutral-400 mb-1">Pending Tasks</p>
                          <p className="text-lg font-semibold text-white">
                            {tasks.filter(task => task.progress < 100).length}
                          </p>
                        </div>
                        <div className="bg-neutral-700/20 rounded-lg p-3">
                          <p className="text-xs text-neutral-400 mb-1">Completed Tasks</p>
                          <p className="text-lg font-semibold text-white">
                            {tasks.filter(task => task.progress >= 100).length}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-white mb-2">Recent Tasks</h4>
                        {tasks.slice(0, 5).map(task => (
                          <div key={task.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-neutral-700/20">
                            <div className="p-2 rounded-full bg-blue-500/10">
                              {task.progress >= 100 ? (
                                <CheckCircle className="h-4 w-4 text-green-400" />
                              ) : (
                                task.deadline && new Date(task.deadline) <= new Date() ? (
                                  <AlertCircle className="h-4 w-4 text-red-400" />
                                ) : (
                                  <Clock className="h-4 w-4 text-blue-400" />
                                )
                              )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="text-sm font-medium text-white truncate" title={task.title}>{task.title}</p>
                              {task.deadline && (
                                <p className="text-xs text-neutral-400">
                                  Due: {new Date(task.deadline).toLocaleDateString()}
                                </p>
                              )}
                              <div className="w-full bg-neutral-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div
                                  className={`h-full ${
                                    task.progress >= 100 
                                      ? 'bg-green-500' 
                                      : task.deadline && new Date(task.deadline) <= new Date()
                                        ? 'bg-red-500' 
                                        : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="p-1 h-7 text-neutral-400 hover:text-white"
                              title="Complete Task"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleTaskComplete(task.id);
                              }}
                            >
                              {task.progress >= 100 ? (
                                <CheckCircle className="h-4 w-4 text-green-400" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <p className="text-sm text-neutral-400 mb-3">No tasks found</p>
                      <Button variant="outline" size="sm" className="bg-neutral-700 hover:bg-neutral-600">
                        Create New Task
                      </Button>
                    </div>
                  )}
                </div>
          </div>
        </Card>
          </Link>
      </div>
      )}

      {/* Recent Meetings */}
      {visibleWidgets.recentMeetings && (
        <div className="mb-6">
          <Link href="/calendar" className="block relative group">
            <span className="absolute right-3 top-3 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              Open Calendar →
            </span>
            <Card className="bg-neutral-800 border-neutral-700 shadow-lg transition-all hover:bg-neutral-750 hover:shadow-xl relative overflow-hidden">
              <GlowingEffect 
                spread={30} 
                glow={true} 
                disabled={false} 
                proximity={100} 
                inactiveZone={0.01}
                borderWidth={1.5}
                movementDuration={1.5}
                variant="default"
              />
              <div className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Upcoming Meetings</h3>
                  <div className="flex gap-2 items-center">
                    <Calendar className="w-5 h-5 text-neutral-400" />
    </div>
                </div>
                {/* ... existing code ... */}
              </div>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
} 