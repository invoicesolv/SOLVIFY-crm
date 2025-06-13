import { useEffect, useState, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { BarChart, Users, DollarSign, ArrowUpRight, ArrowDownRight, Calendar, Clock, AlertCircle, Settings, X, Eye, EyeOff, Globe, Grid, TrendingUp, Inbox, LineChart, RefreshCw, CheckCircle, Square, CheckSquare, CreditCard, PieChart, Crown, HelpCircle, Search, Move } from 'lucide-react'
import { MessageLoading } from '@/components/ui/message-loading'
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
import { useConsistentUserId } from '@/hooks/useConsistentUserId';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Add custom CSS for grid layouts
const gridLayoutStyles = `
.react-grid-item.react-grid-placeholder {
  background: rgba(59, 130, 246, 0.3);
  border: 2px dashed rgba(59, 130, 246, 0.5);
  border-radius: 0.5rem;
}

.react-grid-item {
  transition: all 200ms ease;
}

.react-resizable-handle {
  position: absolute !important;
  width: 24px !important;
  height: 24px !important;
  bottom: 0 !important;
  right: 0 !important;
  background-image: none !important;
  cursor: se-resize !important;
  z-index: 10 !important;
}

.react-resizable-handle:hover::after {
  content: '';
  position: absolute;
  bottom: 3px;
  right: 3px;
  width: 12px;
  height: 12px;
  border-right: 3px solid #60a5fa;
  border-bottom: 3px solid #60a5fa;
  opacity: 0.8;
}

.react-grid-item:hover .react-resizable-handle {
  opacity: 1;
}

.grid-item {
  position: relative;
}

.drag-handle {
  opacity: 0.5;
  transition: opacity 0.2s;
}

.grid-item:hover .drag-handle {
  opacity: 1;
}

.react-resizable {
  position: relative;
}

.react-resizable-handle {
  position: absolute;
  width: 20px;
  height: 20px;
  background-repeat: no-repeat;
  background-origin: content-box;
  box-sizing: border-box;
  background-position: bottom right;
  padding: 0 3px 3px 0;
}

.react-resizable-handle-se {
  bottom: 0;
  right: 0;
  cursor: se-resize;
}
`;

// Create the responsive grid layout component
const ResponsiveGridLayout = WidthProvider(Responsive);

// Add custom styles for grid items
const GridItemHandle = ({ isCustomizing }: { isCustomizing: boolean }) => {
  if (!isCustomizing) return null;
  
  return (
    <div className="absolute top-1 right-1 bg-blue-500/20 hover:bg-blue-500/40 w-6 h-6 flex items-center justify-center rounded cursor-move z-10 text-blue-400 transition-opacity opacity-50 hover:opacity-100 drag-handle">
      <Move className="h-4 w-4" />
    </div>
  );
};

// Add resize handle component
const ResizeHandle = ({ isCustomizing }: { isCustomizing: boolean }) => {
  if (!isCustomizing) return null;
  
  return (
    <div className="react-resizable-handle react-resizable-handle-se absolute bottom-0 right-0 w-10 h-10 cursor-se-resize z-20">
      <div className="absolute bottom-2 right-2 w-4 h-4 border-r-[3px] border-b-[3px] border-blue-400 transform rotate-[-45deg]"></div>
    </div>
  );
};

// Add resize help component
const ResizeHelp = ({ isCustomizing }: { isCustomizing: boolean }) => {
  if (!isCustomizing) return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-blue-600/90 text-foreground p-3 rounded-lg shadow-lg z-50 max-w-sm">
      <div className="flex items-center gap-2 mb-2">
        <Move className="h-4 w-4" />
        <span className="font-medium">Drag widgets</span> 
        <span className="text-xs bg-blue-500/40 px-2 py-1 rounded">from top-right handle</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-blue-500/50 rounded-sm"></div>
        <span className="font-medium">Resize widgets</span>
        <span className="text-xs bg-blue-500/40 px-2 py-1 rounded">from bottom-right corner</span>
      </div>
    </div>
  );
};

interface Invoice {
  document_number: string
  invoice_date: string
  total: string | number
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
  name?: string
  lead_name?: string // Support both field names
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

// Dashboard configuration constants - move to environment variables or config in production
const REFRESH_INTERVALS = {
  URGENT_TASKS: 60 * 1000,        // 1 minute
  GENERAL_DATA: 5 * 60 * 1000,    // 5 minutes
  SEARCH_CONSOLE: 15 * 60 * 1000, // 15 minutes
  INITIAL_DELAY: 1000,            // 1 second before setting up refresh
  FETCH_DELAY: 500                // 500ms delay for workspace change
};

const API_LIMITS = {
  TASKS: 15,
  INVOICES: 10,
  CALENDAR_EVENTS: 10,
  DEFAULT: 5
};

const API_TIMEOUTS = {
  DEFAULT: 10000 // 10 seconds
};

// Add after the existing constants 
// Cache mechanism to prevent data loss during workspace transitions
const CACHE_KEYS = {
  INVOICES: 'dashboard_invoices_cache',
  TASKS: 'dashboard_tasks_cache',
  STATS: 'dashboard_stats_cache'
};

export function Dashboard() {
  const { data: session } = useSession()
  const { consistentId: hookConsistentId, isLoading: isLoadingUserId } = useConsistentUserId();
  const [consistentId, setConsistentId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  
  // Helper to store data in sessionStorage with proper expiration
  const cacheData = (key, data, ttlMinutes = 15) => {
    try {
      const cacheItem = {
        data,
        expiry: Date.now() + (ttlMinutes * 60 * 1000)
      };
      sessionStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (err) {
      console.warn('Failed to cache data:', err);
    }
  };

  // Helper to retrieve cached data if still valid
  const getCachedData = (key) => {
    try {
      const cachedItem = sessionStorage.getItem(key);
      if (!cachedItem) return null;
      
      const { data, expiry } = JSON.parse(cachedItem);
      if (Date.now() > expiry) {
        // Cache expired
        sessionStorage.removeItem(key);
        return null;
      }
      
      return data;
    } catch (err) {
      console.warn('Failed to retrieve cached data:', err);
      return null;
    }
  };

  // Modify setInvoices to update cache when data changes
  const updateInvoices = (invoicesData) => {
    if (invoicesData && invoicesData.length > 0) {
      console.log('Updating invoice data in state with', invoicesData.length, 'invoices');
      setInvoices(invoicesData);
      calculateStats(invoicesData);
      // Cache the invoice data
      cacheData(CACHE_KEYS.INVOICES, invoicesData);
    } else {
      console.log('No invoice data to update');
      // SECURITY: Don't fetch invoices without workspace filter
      setInvoices([]);
      setStats({
        totalRevenue: 0,
        invoiceCount: 0,
        averageInvoiceValue: 0,
        revenueGrowth: 0
        });
    }
  };
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [emails, setEmails] = useState<EmailThread[]>([])
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [searchConsoleData, setSearchConsoleData] = useState<SearchConsoleData | null>(null)
  const [cronJobs, setCronJobs] = useState<CronJob[]>([])
  const [searchConsoleRendered, setSearchConsoleRendered] = useState(false) // Track if Search Console has been rendered
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    invoiceCount: 0,
    averageInvoiceValue: 0,
    revenueGrowth: 0
  })
  
  // Add this state for layouts
  const [layouts, setLayouts] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const gridRef = useRef(null);
  
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
  
  // Ensure we have a consistent user ID even if the hook fails
  useEffect(() => {
    console.log('[Dashboard] Session status:', session ? 'active' : 'none');
    console.log('[Dashboard] Hook consistentId:', hookConsistentId);
    
    if (hookConsistentId) {
      setConsistentId(hookConsistentId);
    } else if (session?.user?.id) {
      // Fallback to using session ID directly
      console.log('[Dashboard] Falling back to session user ID:', session.user.id);
      setConsistentId(session.user.id);
    } else if (!isLoadingUserId) {
      // If we're not still loading but have no ID, don't use any workspace
      console.log('[Dashboard] No user ID available, not using any workspace');
      setActiveWorkspace(null); 
    }
  }, [hookConsistentId, session, isLoadingUserId]);
  
  // Use our dashboard stats hook after activeWorkspace is set
  const { 
    stats: apiStats, 
    loading: statsLoading, 
    error: statsError, 
    refreshStats 
  } = useDashboardStats(activeWorkspace || undefined);
  
  // Add CSS styles for grid layout
  useEffect(() => {
    // Add custom CSS for grid layouts
    const styleId = 'react-grid-styles';
    
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.innerHTML = gridLayoutStyles;
      document.head.appendChild(styleEl);
      
      return () => {
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
          document.head.removeChild(existingStyle);
        }
      };
    }
  }, []);
  
  // Load dashboard layouts - modified to use localStorage only
  useEffect(() => {
    const loadDashboardLayouts = async () => {
      try {
        console.log('[Dashboard] Loading layouts from localStorage');
        // Try localStorage first
        try {
          const localLayouts = localStorage.getItem('dashboard_layouts');
          if (localLayouts) {
            const layoutData = JSON.parse(localLayouts);
            console.log('[Dashboard] Loaded dashboard layouts from localStorage:', layoutData);
            
            // Validate that the layout data has the expected structure
            if (layoutData && typeof layoutData === 'object' && (layoutData.lg || layoutData.md || layoutData.sm || layoutData.xs)) {
              setLayouts(layoutData);
              return; // Exit early if we successfully loaded a valid layout
            } else {
              console.warn('[Dashboard] Invalid layout data structure, creating defaults');
            }
          } else {
            console.log('[Dashboard] No saved layouts found in localStorage');
          }
        } catch (localStorageError) {
          console.error('[Dashboard] Error parsing layouts from localStorage:', localStorageError);
        }
        
        // Only create default layouts if no valid saved layout was found
        const defaultLayouts = generateDefaultLayout();
        console.log('[Dashboard] Using default layouts:', defaultLayouts);
        setLayouts(defaultLayouts);
        
      } catch (error) {
        console.error('[Dashboard] Error in loadDashboardLayouts:', error);
        // Fallback to default layouts
        const defaultLayouts = generateDefaultLayout();
        setLayouts(defaultLayouts);
      }
    };

    loadDashboardLayouts();
  }, []);

  // Generate default layout function
  const generateDefaultLayout = () => {
    // Make sure all widget types have default positions
    const allWidgetTypes = [
      'revenueStats', 'invoiceStats', 'averageInvoice', 'recentInvoices',
      'invoiceTypes', 'upcomingEvents', 'upcomingDeadlines', 'urgentTasks',
      'domains', 'leads', 'sales', 'gmailHub', 'analyticsData', 'searchConsole',
      'cronJobs', 'taskOverview', 'recentMeetings', 'salesMetrics', 'invoiceSummary'
    ];
    
    // Create layout for large screens
    const lg = [
        { i: 'revenueStats', x: 0, y: 0, w: 1, h: 1 },
        { i: 'invoiceStats', x: 1, y: 0, w: 1, h: 1 },
        { i: 'averageInvoice', x: 2, y: 0, w: 1, h: 1 },
        { i: 'recentInvoices', x: 0, y: 1, w: 2, h: 2 },
        { i: 'invoiceTypes', x: 2, y: 1, w: 1, h: 2 },
        { i: 'upcomingEvents', x: 0, y: 3, w: 1, h: 2 },
        { i: 'upcomingDeadlines', x: 1, y: 3, w: 1, h: 2 },
        { i: 'urgentTasks', x: 2, y: 3, w: 1, h: 2 },
        { i: 'domains', x: 0, y: 5, w: 1, h: 2 },
        { i: 'leads', x: 1, y: 5, w: 1, h: 2 },
        { i: 'sales', x: 2, y: 5, w: 1, h: 2 },
        { i: 'gmailHub', x: 0, y: 7, w: 1, h: 2 },
        { i: 'analyticsData', x: 1, y: 7, w: 1, h: 2 },
      { i: 'searchConsole', x: 2, y: 7, w: 1, h: 2 },
        { i: 'cronJobs', x: 0, y: 9, w: 2, h: 2 },
        { i: 'taskOverview', x: 0, y: 11, w: 3, h: 2 },
      { i: 'recentMeetings', x: 0, y: 13, w: 3, h: 1 },
      { i: 'salesMetrics', x: 2, y: 9, w: 1, h: 2 },
      { i: 'invoiceSummary', x: 0, y: 14, w: 3, h: 1 }
    ];
    
    // Create layout for medium screens
    const md = lg.map(item => {
      const { i, w, h } = item;
      // For medium screens, we stack them in 2 columns instead of 3
      return { i, w: Math.min(w, 2), h, x: item.x % 2, y: Math.floor(item.x / 2) + item.y };
    });
    
    // Create layout for small screens
    const sm = md.map(item => {
      // For small screens, we keep the same layout as medium
      return { ...item };
    });
    
    // Create layout for extra small screens (mobile)
    const xs = allWidgetTypes.map((type, index) => {
      // For mobile, we stack everything in one column
      return { i: type, x: 0, y: index * 2, w: 1, h: type.includes('Invoice') ? 3 : 2 };
    });
    
    // Final layouts object for all breakpoints
    return { lg, md, sm, xs };
  };

  // Add handler for layout change
  const handleLayoutChange = (currentLayout: any, allLayouts: any) => {
    console.log('Layout changed:', allLayouts);
    
    // Only save if we're in customization mode to prevent unwanted saves
    if (isCustomizing) {
      setLayouts(allLayouts);
      
      // Store immediately in localStorage for better persistence between sessions
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('dashboard_layouts', JSON.stringify(allLayouts));
          console.log('Layout saved to localStorage:', allLayouts);
        } catch (error) {
          console.error('Error saving layouts to localStorage:', error);
        }
      }
    }
  };
  
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
      try {
        console.log('[Dashboard] Loading workspaces...');
        
        // If we have a consistent user ID, try to load workspaces normally
        if (consistentId) {
          try {
            console.log('[Dashboard] Loading workspaces for user ID:', consistentId);
        // Use the API endpoint instead of direct database query to avoid RLS issues
        const response = await fetch('/api/workspace/leave');
        if (!response.ok) {
          throw new Error('Failed to fetch workspaces');
        }
        const data = await response.json();
        
        if (data.success && data.workspaces) {
          const workspaceData = data.workspaces.map((w: any) => ({
            id: w.id,
            name: w.name,
          }));
          
          if (workspaceData.length > 0) {
            setWorkspaces(workspaceData);
            console.log('[Dashboard] Loaded workspaces:', workspaceData);
            
            // Set active workspace if none is selected
            if (!activeWorkspace) {
              setActiveWorkspace(workspaceData[0].id);
              console.log('[Dashboard] Set active workspace to:', workspaceData[0].id);
              
              // Store selection in localStorage
              localStorage.setItem(`workspace_${consistentId}`, workspaceData[0].id);
            }
            
            return; // Exit if we loaded workspaces successfully
          }
        }
        
        // If we get here, no workspaces were returned
        throw new Error('No workspaces found');
          } catch (err) {
            console.error("[Dashboard] Error loading user workspaces:", err);
          }
        }
        
        // SECURITY: Do not load other users' workspaces as fallback
        console.log('[Dashboard] User has no workspace access - creating default workspace');
            
        // If user has no workspaces, they need to create one or be invited
        // Do not show other users' data
        
        // Last resort - skip workspace filtering entirely
        console.log('[Dashboard] No workspaces found, disabling workspace filtering');
        // Set null activeWorkspace to indicate we should skip workspace filtering
        setActiveWorkspace(null);
        // Create empty workspaces array so UI knows there's no workspaces
        setWorkspaces([]);
        
      } catch (error) {
        console.error("[Dashboard] Error in loadWorkspaces:", error);
        // Ensure we don't use workspace filtering if there's an error
        setActiveWorkspace(null);
        setWorkspaces([]);
      }
    }

    // Only load workspaces if we're not still loading the user ID
    if (!isLoadingUserId) {
    loadWorkspaces();
    }
  }, [consistentId, isLoadingUserId, activeWorkspace]);

  // Handle workspace selection
  const handleWorkspaceChange = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
    
    // Store the selection in localStorage
    if (consistentId && typeof window !== 'undefined') {
      localStorage.setItem(`workspace_${consistentId}`, workspaceId);
    } else {
      // Fallback when no user ID
      localStorage.setItem('active_workspace', workspaceId);
    }
    
    // Refresh data with the new workspace
    fetchData();
  };

  // Function to reload the page
  const reloadPage = () => {
    router.refresh();
  };

  // Save layout with dashboard preferences
  const saveDashboardPreferences = useCallback(async () => {
    try {
      console.log('[Dashboard] Saving dashboard preferences to localStorage');
      
      // Store in localStorage
          localStorage.setItem('dashboard_preferences', JSON.stringify(visibleWidgets));
          localStorage.setItem('dashboard_layouts', JSON.stringify(layouts));
      
        toast({
          title: "Dashboard updated",
          description: "Your dashboard settings have been saved.",
          variant: "default"
        });
    } catch (error) {
      console.error('[Dashboard] Error in saveDashboardPreferences:', error);
      toast({
        title: "Settings applied temporarily",
        description: "Settings could not be saved permanently.",
        variant: "destructive"
      });
    }
  }, [visibleWidgets, layouts, toast]);

  // Reset layout to defaults
  const resetLayoutToDefaults = () => {
    const defaultLayouts = generateDefaultLayout();
    setLayouts(defaultLayouts);
    
    // Save the default layout
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard_layouts', JSON.stringify(defaultLayouts));
    }
    
    toast({
      title: "Layout reset",
      description: "Dashboard layout has been reset to defaults.",
      variant: "default"
    });
  };

  // Apply changes and exit customization mode
  const applyChanges = async () => {
    try {
      // Ensure we save the current layout state
      if (layouts && typeof window !== 'undefined') {
        localStorage.setItem('dashboard_layouts', JSON.stringify(layouts));
        console.log('[Dashboard] Layout saved on apply changes:', layouts);
      }
      
      // Save dashboard preferences
      await saveDashboardPreferences();
      
      // Exit customization mode
      setIsCustomizing(false);
      
      toast({
        title: "Dashboard updated",
        description: "Your layout changes have been saved and will persist between sessions.",
        variant: "default"
      });
    } catch (error) {
      console.error('[Dashboard] Error applying changes:', error);
      toast({
        title: "Error saving layout",
        description: "Your changes may not persist between sessions.",
        variant: "destructive"
      });
    }
  };

  // Load dashboard preferences - modified to use localStorage only
  useEffect(() => {
    const loadDashboardPreferences = async () => {
      try {
        console.log('[Dashboard] Loading dashboard preferences from localStorage');
        
          // Load widget visibility preferences
          const localPrefs = localStorage.getItem('dashboard_preferences');
          if (localPrefs) {
            const settings = JSON.parse(localPrefs);
          console.log('[Dashboard] Loaded dashboard preferences from localStorage:', settings);
            setVisibleWidgets(prev => ({ ...prev, ...settings }));
          }
          
          // Load layout configuration
          const localLayouts = localStorage.getItem('dashboard_layouts');
          if (localLayouts) {
            const layoutData = JSON.parse(localLayouts);
          console.log('[Dashboard] Loaded dashboard layouts from localStorage:', layoutData);
            setLayouts(layoutData);
          } else {
            // If no layouts found, create default layouts
          console.log('[Dashboard] No saved layouts found, creating default layout');
            const defaultLayouts = generateDefaultLayout();
            setLayouts(defaultLayouts);
          }
        } catch (localStorageError) {
        console.error('[Dashboard] Error loading preferences from localStorage:', localStorageError);
          // Set default layouts if nothing else works
          const defaultLayouts = generateDefaultLayout();
          setLayouts(defaultLayouts);
      }
    };

    // Main function to load data
    const initializeDashboard = async () => {
      if (!consistentId || !activeWorkspace) {
        console.log('Cannot initialize dashboard - missing user ID or workspace');
        return;
      }

      console.log('Initializing dashboard for user:', consistentId);
      console.log('Loading dashboard data for workspace:', activeWorkspace);
      setLoading(true);

      try {
        // Load preferences
        await loadDashboardPreferences();
        
        // Set a flag to indicate we need to do the data fetching after fetchData is defined
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(`dashboard_needs_data_${consistentId}_${activeWorkspace}`, 'true');
        }
      } catch (error) {
        console.error('Error initializing dashboard:', error);
        setError('Failed to initialize dashboard. Please reload the page.');
        setLoading(false);
      }
    };
    
    // Only initialize when we have both a user ID and workspace
    if (consistentId && activeWorkspace) {
      // Use a flag to prevent duplicate initialization
      const alreadyInitialized = sessionStorage.getItem(`dashboard_initialized_${consistentId}_${activeWorkspace}`);
      if (!alreadyInitialized) {
        console.log('First initialization for this session');
      initializeDashboard();
        // Mark as initialized
        sessionStorage.setItem(`dashboard_initialized_${consistentId}_${activeWorkspace}`, 'true');
    } else {
        console.log('Dashboard already initialized in this session');
      setLoading(false);
    }
    } else if (!isLoadingUserId) {
      setLoading(false);
    }
  }, [consistentId, activeWorkspace, isLoadingUserId]);

  // Function to fetch data from various sources
  const fetchData = useCallback(async () => {
    if (!consistentId) {
      console.error('No consistent user ID found');
      setLoading(false);
      setDebugInfo({
        message: 'No valid user ID found. Please log in again or visit /debug/user-id.',
        type: 'error'
      });
      return;
    }
    
    console.log('[Dashboard] Fetching data with activeWorkspace:', activeWorkspace);
    
    // Add debouncing mechanism to prevent duplicate fetches
    const debounceKey = `last_fetch_${consistentId}_${activeWorkspace || 'no-workspace'}`;
    const lastFetch = sessionStorage.getItem(debounceKey);
    const now = Date.now();
    
    // Force a refresh if there's no data currently displayed
    const forceRefresh = invoices.length === 0 || domains.length === 0 || leads.length === 0 || sales.length === 0;
    
    if (lastFetch && (now - parseInt(lastFetch)) < 2000 && !forceRefresh) {
      console.log('Skipping duplicate fetch - last fetch was less than 2 seconds ago');
      return;
    }
    
    // Record this fetch time
    sessionStorage.setItem(debounceKey, now.toString());
    
    try {
      setRefreshing(true);
      console.log('Fetching dashboard data for user:', consistentId, 'workspace:', activeWorkspace || 'ALL DATA (no workspace filter)');
      
      // PRIORITY FETCH: INVOICES - with workspace filtering for security
      try {
        console.log('DEBUG: Fetching invoices with workspace filtering');
        
        let invoicesQuery = supabase
          .from('invoices')
          .select('*, customers(*), currencies(*)')
          .order('invoice_date', { ascending: false });
          
        // SECURITY: Always apply workspace filter if available
        if (activeWorkspace) {
          invoicesQuery = invoicesQuery.eq('workspace_id', activeWorkspace);
        } else {
          // If no workspace, don't fetch any invoices for security
          console.log('DEBUG: No workspace - skipping invoices fetch for security');
          setInvoices([]);
          setStats({
            totalRevenue: 0,
            invoiceCount: 0,
            averageInvoiceValue: 0,
            revenueGrowth: 0
          });
          return;
        }
        
        const { data: invoicesData, error: invoicesError } = await invoicesQuery;

        if (invoicesError) {
          console.error('DEBUG: Invoices fetch error:', invoicesError);
          setInvoices([]);
        } else {
          console.log('DEBUG: Invoices fetched successfully:', invoicesData?.length || 0);
          
          if (invoicesData && invoicesData.length > 0) {
            // Log the raw invoice data for debugging
            console.log('First invoice sample:', invoicesData[0]);
            console.log('Raw invoice total:', invoicesData[0].total, 'Type:', typeof invoicesData[0].total);
            
            // Use the data directly without transformations
            setInvoices(invoicesData);
            calculateStats(invoicesData);
            
            // Cache the invoice data
            cacheData(CACHE_KEYS.INVOICES, invoicesData);
          } else {
            console.log('DEBUG: No invoices found in database');
            setInvoices([]);
            setStats({
              totalRevenue: 0,
              invoiceCount: 0,
              averageInvoiceValue: 0,
              revenueGrowth: 0
            });
          }
        }
      } catch (err) {
        console.error('Failed to query invoices table:', err);
        setInvoices([]);
      }
      
      // CALENDAR EVENTS - directly from Supabase calendar_events table
      try {
        console.log('DEBUG: Fetching calendar events', activeWorkspace ? `for workspace: ${activeWorkspace}` : 'without workspace filtering');
        
        // Create initial query with broader date range (3 months instead of 1)
        let calendarQuery = supabase
          .from('calendar_events')
          .select('*')
          .gte('start_time', new Date(new Date().setDate(new Date().getDate() - 7)).toISOString()) // From a week ago
          .lte('start_time', new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString()); // To three months ahead
          
        // Only apply workspace filter if we have an activeWorkspace
        if (activeWorkspace) {
          calendarQuery = calendarQuery.eq('workspace_id', activeWorkspace);
        }
        
        const { data: calendarEventsData, error: calendarError } = await calendarQuery
          .order('start_time', { ascending: true })
          .limit(API_LIMITS.CALENDAR_EVENTS);

        if (calendarError) {
          console.error('DEBUG: Calendar fetch error:', calendarError);
          // SECURITY: Don't fetch calendar events without workspace filter
          setMeetings([]);
        } else {
          console.log('DEBUG: Calendar events fetched successfully:', calendarEventsData?.length || 0);
          
          if (calendarEventsData && calendarEventsData.length > 0) {
            const transformedMeetings = calendarEventsData.map(event => ({
              id: event.id,
              title: event.title,
              start_time: event.start_time,
              end_time: event.end_time || event.start_time, // Ensure end_time has a value
              description: event.description || ''
            }));
            setMeetings(transformedMeetings);
            // Cache the calendar data
            try {
              sessionStorage.setItem('dashboard_calendar_cache', JSON.stringify({
                data: transformedMeetings,
                timestamp: Date.now(),
                expires: Date.now() + (30 * 60 * 1000) // 30 minute cache
              }));
            } catch (cacheErr) {
              console.warn('Failed to cache calendar data:', cacheErr);
            }
            } else {
            console.log('DEBUG: No calendar events found for workspace - this is expected for new workspaces');
              setMeetings([]);
          }
        }
      } catch (err) {
        console.error('Failed to query calendar_events table:', err);
        // Try to load from cache if available
        try {
          const cachedCalendar = sessionStorage.getItem('dashboard_calendar_cache');
          if (cachedCalendar) {
            const { data, expires } = JSON.parse(cachedCalendar);
            if (Date.now() < expires && data.length > 0) {
              console.log('Using cached calendar data:', data.length, 'events');
              setMeetings(data);
            }
          }
        } catch (cacheErr) {
          console.warn('Error accessing cache:', cacheErr);
          setMeetings([]);
        }
      }

      // TASKS - Skip fetching tasks as part of the main refresh to prevent twitching
      // We have a separate fetchUrgentTasks function that's called only once on initial load
      console.log('DEBUG: Skipping tasks fetch in main refresh to prevent UI twitching');

      // DOMAIN LOGIC - fetch domains with workspace filtering for security
      try {
        console.log('DEBUG: Fetching domains with workspace filtering');
        
        let domainsQuery = supabase
          .from('domains')
          .select('*')
          .order('expiry_date', { ascending: true })
          .limit(5);
          
        // SECURITY: Always apply workspace filter if available
        if (activeWorkspace) {
          domainsQuery = domainsQuery.eq('workspace_id', activeWorkspace);
        } else {
          // If no workspace, don't fetch any domains for security
          console.log('DEBUG: No workspace - skipping domains fetch for security');
          setDomains([]);
          return;
        }
        
        const { data: domainsData, error: domainsError } = await domainsQuery;

        if (domainsError) {
          console.error('DEBUG: Domains fetch error:', domainsError);
        } else {
          console.log('DEBUG: Domains fetched successfully:', domainsData?.length || 0);
          console.log('DEBUG: Sample domain data:', domainsData?.[0] || 'No domains found');
          
          // Make sure domain data is formatted correctly and status is preserved
          const formattedDomains = domainsData?.map(domain => {
            // Calculate domain status based on expiry date if not set
            let status = domain.status;
            
            // If no status is set but we have an expiry date, determine status
            if (!status && domain.expiry_date) {
              const expiryDate = new Date(domain.expiry_date);
              const now = new Date();
              const daysToExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              
              if (expiryDate < now) {
                status = 'expired';
              } else if (daysToExpiry < 30) {
                status = 'expiring';
              } else {
                status = 'active';
              }
            }
            
            return {
              id: domain.id,
              name: domain.display_domain || domain.domain || '',
              expiry_date: domain.expiry_date,
              status: status || 'pending'
            };
          }) || [];
          
          // Show warning if we received empty domains
          if (!domainsData || domainsData.length === 0) {
            console.warn('No domains found in database', activeWorkspace ? `for workspace: ${activeWorkspace}` : '');
          } else {
            console.log('First domain sample:', domainsData[0]); 
          }
          
          setDomains(formattedDomains);
        }
      } catch (err) {
        console.error('Failed to query domains table:', err);
        setDomains([]);
      }

      // LEADS - fetch with workspace filtering for security
      try {
        console.log('DEBUG: Fetching leads with workspace filtering');
        
        let leadsQuery = supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);
          
        // SECURITY: Always apply workspace filter if available
        if (activeWorkspace) {
          leadsQuery = leadsQuery.eq('workspace_id', activeWorkspace);
        } else {
          // If no workspace, don't fetch any leads for security
          console.log('DEBUG: No workspace - skipping leads fetch for security');
          setLeads([]);
          return;
        }
        
        const { data: leadsData, error: leadsError } = await leadsQuery;

        if (leadsError) {
          console.error('Error fetching leads:', leadsError);
        } else {
          console.log('Leads fetched:', leadsData?.length || 0);
          
          // Show warning if we received empty leads
          if (!leadsData || leadsData.length === 0) {
            console.warn('No leads found in database', activeWorkspace ? `for workspace: ${activeWorkspace}` : '');
          } else {
            console.log('First lead sample:', leadsData[0]);
          }
          
          // Map lead data to correctly match our interface
          const formattedLeads = (leadsData || []).map(lead => ({
            id: lead.id,
            name: lead.lead_name || lead.name || 'Unnamed Lead', // Support both field names
            company: lead.company || 'No company',
            email: lead.email || '',
            status: lead.status || 'new',
            created_at: lead.created_at,
            title: lead.title,
            value: lead.value
          }));
          
          setLeads(formattedLeads);
        }
      } catch (err) {
        console.error('Failed to query leads table:', err);
        setLeads([]);
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

      // ANALYTICS - fetch with workspace filtering for security
      try {
        console.log('DEBUG: Attempting to fetch analytics data with workspace filtering');
        
        if (!activeWorkspace) {
          console.log('DEBUG: No workspace - skipping analytics fetch for security');
          setAnalyticsData(null);
          return;
        }
        
        const response = await fetch('/api/analytics/overview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspaceId: activeWorkspace
          })
        });
        if (response.ok) {
          const data = await response.json();
          console.log('Analytics response:', data);
          if (data.analytics) {
            setAnalyticsData(data.analytics);
          }
        } else {
          console.log('Analytics API returned error, skipping analytics data');
          setAnalyticsData(null);
        }
      } catch (error) {
        console.error('Error fetching analytics data:', error);
        setAnalyticsData(null);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    // SECURITY: Removed fallback mechanism that bypassed workspace filtering
    // Users should only see data from their own workspaces
  }, [consistentId, activeWorkspace]);

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
      } else {
        console.log('No active workspace - skipping workspace-specific stats recalculation');
      }
      
      // Step 2: Now fetch the freshly calculated stats
      const timestamp = new Date().getTime();
      const workspaceParam = activeWorkspace ? `workspaceId=${activeWorkspace}` : '';
      const refreshUrl = `/api/dashboard/stats?${workspaceParam}&nocache=${timestamp}`;
      
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

  // Function to force a manual refresh of dashboard data
  const forceRefresh = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      console.log('Forcing complete manual dashboard refresh...');
      
      // PRIORITY: Directly fetch invoices first to ensure they're visible
      try {
        console.log('Directly fetching invoice data as top priority');
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('invoices')
          .select('*, customers(*), currencies(*)')
          .order('invoice_date', { ascending: false })
          // Remove limit to get all invoices
          // .limit(API_LIMITS.INVOICES);
        
        if (!invoicesError && invoicesData && invoicesData.length > 0) {
          console.log('Successfully fetched', invoicesData.length, 'invoices directly');
          updateInvoices(invoicesData);
        } else if (invoicesError) {
          console.error('Error fetching invoices directly:', invoicesError);
        } else {
          // SECURITY: Don't fetch invoices without workspace filter
          console.log('No invoices found for workspace - this is expected for new workspaces');
        }
      } catch (invoiceError) {
        console.error('Error in direct invoice fetch:', invoiceError);
      }
      
      // Add timestamp to prevent caching in API call
      const timestamp = new Date().getTime();
      const workspaceParam = activeWorkspace ? `workspaceId=${activeWorkspace}` : '';
      const refreshUrl = `/api/dashboard/stats?${workspaceParam}&nocache=${timestamp}`;
      
      console.log(`Making direct API call to: ${refreshUrl}`);
      
      try {
        const response = await fetch(refreshUrl);
        
        if (!response.ok) {
          console.warn('Stats API refresh failed. Falling back to direct data fetch.');
        } else {
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
        }
      } catch (apiError) {
        console.error('API-based refresh failed:', apiError);
      }
      
      // Also do a complete data fetch for all dashboard data
      console.log('Performing complete data fetch for all dashboard data');
      await fetchData();
      
      toast({
        title: "Dashboard refreshed",
        description: "Latest data loaded from database",
        variant: "default"
      });
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      toast({
        title: "Refresh failed",
        description: "Could not completely refresh dashboard. Some data may be stale.",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, activeWorkspace, fetchData, supabase, updateInvoices, toast]);

  // Use effect for auto-refresh
  useEffect(() => {
    // Set up a refresh interval (every 5 minutes)
    const refreshInterval = setInterval(() => {
      fetchData();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, [fetchData]);

  const calculateStats = (invoices: Invoice[]) => {
    console.log('Calculating stats from invoices, count:', invoices.length);
    
    // Skip invalid invoices
    const validInvoices = invoices.filter(inv => inv && typeof inv.total !== 'undefined');
    
    console.log('Valid invoices for calculation:', validInvoices.length);
    
    if (validInvoices.length === 0) {
      console.log('No valid invoices to calculate stats from');
      const emptyStats = {
        totalRevenue: 0,
        invoiceCount: 0,
        averageInvoiceValue: 0,
        revenueGrowth: 0
      };
      setStats(emptyStats);
      return;
    }
    
          // Log invoice values for debugging
      validInvoices.forEach(inv => {
        console.log(`Invoice #${inv.document_number}: raw total: ${inv.total}`);
      });
      
      // Get total directly from invoice data
      const total = validInvoices.reduce((sum, inv) => {
        // Convert string totals to numbers if needed
        const amount = typeof inv.total === 'number' ? inv.total : 
          (typeof inv.total === 'string' ? parseFloat(inv.total.replace(/[^0-9.,]/g, '').replace(',', '.')) : 0);
        return sum + amount;
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

      // Calculate month totals using the same direct approach
      const lastMonthTotal = lastMonthInvoices.reduce((sum, inv) => {
        const amount = typeof inv.total === 'number' ? inv.total : 
          (typeof inv.total === 'string' ? parseFloat(inv.total.replace(/[^0-9.,]/g, '').replace(',', '.')) : 0);
        return sum + amount;
      }, 0);
      
      const previousMonthTotal = previousMonthInvoices.reduce((sum, inv) => {
        const amount = typeof inv.total === 'number' ? inv.total : 
          (typeof inv.total === 'string' ? parseFloat(inv.total.replace(/[^0-9.,]/g, '').replace(',', '.')) : 0);
        return sum + amount;
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

    const newStats = {
      totalRevenue: total,
      invoiceCount: count,
      averageInvoiceValue: average,
      revenueGrowth: growth
    };
    
    setStats(newStats);
    // Cache the calculated stats
    cacheData(CACHE_KEYS.STATS, newStats);
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

  // Better function to get only truly urgent tasks
  const getUrgentTasks = () => {
    // Get current date for deadline comparison
    const now = new Date();
    
    return tasks
      .filter(task => {
        // Task must exist and not be complete
        if (!task || task.progress >= 100) return false;
        
        // Take any task explicitly flagged as urgent
        if (task.status && task.status.toLowerCase().includes('urgent')) 
          return true;
        
        // Take any task with "urgent" in the title
        if (task.title && task.title.toLowerCase().includes('urgent'))
          return true;
        
        // Check deadline - only consider tasks that have a deadline
        if (!task.deadline) return false;
        
        try {
          const deadline = new Date(task.deadline);
          // Only consider tasks due within 7 days or overdue
          const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return daysUntilDeadline <= 7;
        } catch (err) {
          // If date parsing fails, don't include it
          return false;
        }
      })
      .sort((a, b) => {
        // Sort first by status (urgent first)
        if (a.status?.toLowerCase().includes('urgent') && !b.status?.toLowerCase().includes('urgent')) 
          return -1;
        if (!a.status?.toLowerCase().includes('urgent') && b.status?.toLowerCase().includes('urgent')) 
          return 1;
          
        // Then by deadline
        try {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        } catch (err) {
          return 0;
        }
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
      
      if (consistentId) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('workspace_id')
          .eq('user_id', consistentId)
          .single();
          
        if (profileData?.workspace_id) {
          workspaceId = profileData.workspace_id;
          console.log('Found workspace ID for refresh:', workspaceId);
        }
      }
      
      // SECURITY: Only query with workspace filter for security
      if (!workspaceId && !activeWorkspace) {
        console.log('No workspace available - skipping deals fetch for security');
        setSales([]);
        return;
      }
      
      const finalWorkspaceId = workspaceId || activeWorkspace;
      let dealsQuery = supabase.from('deals').select('*').eq('workspace_id', finalWorkspaceId);
      
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

  // Add a state to track if the user has a Google Calendar integration
  const [hasGoogleCalendarIntegration, setHasGoogleCalendarIntegration] = useState<boolean | null>(null);

  // Check for Google Calendar integration when component mounts
  useEffect(() => {
    const checkForGoogleCalendarIntegration = async () => {
      if (!consistentId) return;
      
      try {
        const { data, error } = await supabase
          .from('integrations')
          .select('*')
          .eq('user_id', consistentId)
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
  }, [consistentId]);

  // Update the calendar sync function to handle the case where integration is not set up
  const syncGoogleCalendarToWorkspace = async () => {
    if (!consistentId || !activeWorkspace) {
      console.log('No valid user ID or active workspace found, cannot sync calendar');
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
    if (!consistentId || !activeWorkspace) {
      console.log('No valid user ID or active workspace found, cannot save calendar events');
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

  // Search Console data fetching with workspace filtering
  const fetchSearchConsoleData = async () => {
    console.log('[Dashboard] Starting Search Console data fetch...');
    
    if (!session?.user?.id || !activeWorkspace) {
      console.log('[Dashboard] No user session or workspace for Search Console data');
        return;
      }
      
    try {
      // Check for cached data first
      const cacheKey = `search_console_dashboard_cache_${session.user.id}`;
      const now = Date.now();
      const cacheExpiry = 4 * 60 * 60 * 1000; // 4 hours cache
      
      try {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          
          // Only use cache if not expired and from same user
          if (parsed.expiresAt > now && parsed.user_id === session.user.id) {
            console.log('[Dashboard] Using cached Search Console data');
            setSearchConsoleData(parsed.searchData?.overview || null);
        return;
          } else {
            console.log('[Dashboard] Cache expired, fetching fresh data');
            localStorage.removeItem(cacheKey);
          }
        }
      } catch (cacheError) {
        console.warn('[Dashboard] Cache error:', cacheError);
      }
      
      // Get user's default site from settings
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('default_search_console_site')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      // Default to a site if none found in settings
      const siteUrl = userSettings?.default_search_console_site || 'sc-domain:code.demo';
      
      // Make the request directly to the API with workspace filtering
      const response = await fetch('/api/search-console', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: '28days', // Using relative date format
          siteUrl,
          workspaceId: activeWorkspace // SECURITY: Include workspace filter
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.searchConsole) {
        // Cache the successful response
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            searchData: data.searchConsole,
            timestamp: now,
            expiresAt: now + cacheExpiry,
            user_id: session.user.id
          }));
        } catch (setCacheError) {
          console.warn('[Dashboard] Error setting cache:', setCacheError);
        }
        
        // Update state with the data
        setSearchConsoleData(data.searchConsole.overview);
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching Search Console data:', error);
      // Don't show error toast to avoid disrupting the dashboard UX
    }
  };

  // Add an effect to fetch Search Console data separately on component mount
  useEffect(() => {
    if (session?.user?.id && activeWorkspace) {
      console.log('[Dashboard] Auto-loading Search Console data on mount');
      fetchSearchConsoleData();
      
      // Set up a refresh interval for Search Console data (every 15 minutes)
      const searchConsoleInterval = setInterval(() => {
        console.log('[Dashboard] Auto-refreshing Search Console data');
        fetchSearchConsoleData();
      }, 15 * 60 * 1000);
      
      return () => {
        clearInterval(searchConsoleInterval);
      };
    }
  }, [session?.user?.id, activeWorkspace]);

  // Add effect to track Search Console rendering
  useEffect(() => {
    if (visibleWidgets.searchConsole) {
      setSearchConsoleRendered(true);
    }
  }, [visibleWidgets.searchConsole]);

  // Initialize with cached data if available
  useEffect(() => {
    // Try to load cached data first for immediate display
    const cachedInvoices = getCachedData(CACHE_KEYS.INVOICES);
    if (cachedInvoices && cachedInvoices.length > 0) {
      console.log('Using cached invoice data while fetching fresh data');
      setInvoices(cachedInvoices);
      calculateStats(cachedInvoices);
    }
    
    const cachedStats = getCachedData(CACHE_KEYS.STATS);
    if (cachedStats) {
      console.log('Using cached stats while fetching fresh data');
      setStats(cachedStats);
    }
  }, []);

  // Complete initialization after all functions are defined
  useEffect(() => {
    const completeInitialization = async () => {
      // Always fetch data regardless of workspace ID to ensure we get all data
      try {
        console.log('Forcing initial data fetch to ensure data is loaded');
        // Fetch the actual data immediately
        await fetchData();
        
        // Load Search Console data
        console.log('[Dashboard] Initializing Search Console data load');
        await fetchSearchConsoleData();
        console.log('[Dashboard] Search Console data initialization complete');
      } catch (error) {
        console.error('Error during initial data fetch:', error);
      }
    };
    
    // Execute data loading immediately when component mounts
    if (!loading) {
      completeInitialization();
    }
  }, [fetchData, loading]);

  // Also add this effect to ensure data is always refreshed when activeWorkspace changes
  useEffect(() => {
    // Refetch data when workspace changes, but with a small delay to avoid race conditions with urgent tasks
    console.log('Workspace changed, scheduling data fetch with delay');
    
    // Use a delay to ensure urgent tasks have time to load first
    const fetchTimer = setTimeout(() => {
      console.log('Executing delayed data fetch after workspace change');
      fetchData();
    }, REFRESH_INTERVALS.FETCH_DELAY);
    
    return () => clearTimeout(fetchTimer);
  }, [activeWorkspace, fetchData]);

  // Add debugging tools for user ID
  useEffect(() => {
    console.log('[DEBUG] Session data:', session);
    console.log('[DEBUG] Hook consistentId:', hookConsistentId);
    
    if (hookConsistentId) {
      setConsistentId(hookConsistentId);
    } else if (session?.user?.id) {
      // Fallback to using session ID directly
      console.log('[DEBUG] Falling back to session user ID:', session.user.id);
      setConsistentId(session.user.id);
    } else if (!isLoadingUserId) {
      // Don't set a hardcoded ID - notify console this is an error condition
      console.error('[DEBUG] Could not determine user ID - data may be limited');
      setConsistentId(null);
    }
  }, [hookConsistentId, session, isLoadingUserId]);

  // Fetch tasks with workspace filtering for security
  const fetchUrgentTasks = useCallback(async () => {
    console.log('Fetching tasks with workspace filtering');
    try {
      let tasksQuery = supabase
        .from('project_tasks')
        .select('*')
        .lt('progress', 100)
        .order('deadline', { ascending: true })
        .limit(API_LIMITS.TASKS);
        
      // SECURITY: Always apply workspace filter if available
      if (activeWorkspace) {
        tasksQuery = tasksQuery.eq('workspace_id', activeWorkspace);
      } else {
        // If no workspace, don't fetch any tasks for security
        console.log('DEBUG: No workspace - skipping tasks fetch for security');
        setTasks([]);
        return;
      }
      
      const { data: tasksData, error: tasksError } = await tasksQuery;

      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
      } else {
        console.log('Tasks fetched:', tasksData?.length || 0);
        if (tasksData && tasksData.length > 0) {
          // Just set the tasks directly without merging to prevent flickering
          setTasks(tasksData);
        } else {
          console.log('No tasks found for workspace - this is expected for new workspaces');
          setTasks([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  }, [supabase, activeWorkspace]);

  // Call this function when the component mounts and ONLY then - no auto-refreshing
  useEffect(() => {
    console.log('Fetching urgent tasks on initial load - one time only');
    fetchUrgentTasks();
    // No refresh interval to prevent twitching - use manual refresh only
  }, [fetchUrgentTasks]);
  
  // Add a function to refresh only urgent tasks when manually requested
  const refreshUrgentTasks = useCallback(async () => {
    if (refreshing) return;
    
    console.log('Manually refreshing urgent tasks');
    await fetchUrgentTasks();
    
    // Don't show a toast to avoid UI clutter
  }, [fetchUrgentTasks, refreshing]);

  // Use effect for auto-refresh of all data - WITH DELAYED START
  useEffect(() => {
    // Set up a refresh interval
    // Delay the first execution to prevent it from overwriting urgent tasks
    const initialDelay = setTimeout(() => {
      // Set up auto-refresh for general data
      const refreshInterval = setInterval(() => {
        fetchData();
      }, REFRESH_INTERVALS.GENERAL_DATA);
      
      return () => clearInterval(refreshInterval);
    }, REFRESH_INTERVALS.INITIAL_DELAY); 
    
    return () => clearTimeout(initialDelay);
  }, [fetchData]);
  
  // Function to force reload calendar events specifically with workspace filtering
  const refreshCalendarEvents = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      console.log('Refreshing calendar events specifically with workspace filtering');
      
      if (!activeWorkspace) {
        console.log('No workspace - skipping calendar refresh for security');
        setMeetings([]);
        setRefreshing(false);
        return;
      }
      
      // Direct fetch from calendar_events table with workspace filtering
      const { data: calendarData, error: calendarError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('workspace_id', activeWorkspace)
        .gte('start_time', new Date(new Date().setDate(new Date().getDate() - 7)).toISOString())
        .order('start_time', { ascending: true })
        .limit(API_LIMITS.CALENDAR_EVENTS);
        
      if (calendarError) {
        console.error('Error fetching calendar events:', calendarError);
        toast({
          title: "Error",
          description: "Failed to refresh calendar events",
          variant: "destructive",
        });
      } else if (calendarData && calendarData.length > 0) {
        console.log('Calendar events refreshed successfully:', calendarData.length);
        const transformedMeetings = calendarData.map(event => ({
          id: event.id,
          title: event.title,
          start_time: event.start_time,
          end_time: event.end_time || event.start_time,
          description: event.description || ''
        }));
        setMeetings(transformedMeetings);
        
        toast({
          title: "Calendar refreshed",
          description: `Found ${calendarData.length} upcoming events`,
          variant: "default",
        });
      } else {
        console.log('No calendar events found');
        toast({
          title: "No events found",
          description: "No upcoming calendar events were found",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error refreshing calendar events:', error);
      toast({
        title: "Refresh failed",
        description: "Could not refresh calendar events",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, supabase, toast]);
  
  // Function to refresh domains specifically
  const refreshDomains = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      console.log('Refreshing domains specifically');
      
      // Direct fetch from domains table with minimal filtering
      let domainsQuery = supabase
        .from('domains')
        .select('*');
        
      // Only apply workspace filter if we have an activeWorkspace
      if (activeWorkspace) {
        domainsQuery = domainsQuery.eq('workspace_id', activeWorkspace);
      }
      
      // Sort by expiry date if available, otherwise by domain
      const { data: domainsData, error: domainsError } = await domainsQuery
        .order('expiry_date', { ascending: true, nullsLast: true })
        .limit(10);
        
      if (domainsError) {
        console.error('Error fetching domains:', domainsError);
        toast({
          title: "Error",
          description: "Failed to refresh domains",
          variant: "destructive",
        });
      } else if (domainsData && domainsData.length > 0) {
        console.log('Domains refreshed successfully:', domainsData.length);
        
        // Format domain data for display
        const formattedDomains = domainsData.map(domain => {
          // Calculate domain status based on expiry date if not set
          let status = domain.status;
          
          // If no status is set but we have an expiry date, determine status
          if (!status && domain.expiry_date) {
            const expiryDate = new Date(domain.expiry_date);
            const now = new Date();
            const daysToExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            if (expiryDate < now) {
              status = 'expired';
            } else if (daysToExpiry < 30) {
              status = 'expiring';
            } else {
              status = 'active';
            }
          }
          
          return {
            id: domain.id,
            name: domain.display_domain || domain.domain || '',
            expiry_date: domain.expiry_date,
            status: status || 'pending'
          };
        });
        
        setDomains(formattedDomains);
        
        toast({
          title: "Domains refreshed",
          description: `Found ${domainsData.length} domains`,
          variant: "default",
        });
      } else {
        console.log('No domains found');
        setDomains([]);
        toast({
          title: "No domains found",
          description: "No domains were found in the database",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error refreshing domains:', error);
      toast({
        title: "Refresh failed",
        description: "Could not refresh domains",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, supabase, activeWorkspace, toast]);

  // Locale and currency settings - could be moved to user preferences
  const LOCALE_SETTINGS = {
    LOCALE: 'sv-SE',
    CURRENCY: 'SEK',
    DEFAULT_FORMAT: '0.00 kr'
  };
  
  // Simple function to format a number as krona without any complex transformations
  const formatKrona = (value: any): string => {
    // Handle null or undefined
    if (value === null || value === undefined) return "0 kr";
    
    // If it's already a number, format it
    if (typeof value === 'number') {
      return `${Math.round(value).toLocaleString()} kr`;
    }
    
    // If it's a string, try to parse it
    if (typeof value === 'string') {
      // If already includes currency symbol, return as is
      if (value.includes('kr')) return value;
      
      // Try to parse it
      try {
        const num = parseFloat(value.replace(/[^0-9.,]/g, '').replace(',', '.'));
        return isNaN(num) ? "0 kr" : `${Math.round(num).toLocaleString()} kr`;
      } catch (e) {
        return "0 kr";
      }
    }
    
    return "0 kr";
  };

  // These helper functions were moved to the component scope

  if (view === 'agenda') {
    return <div className="text-muted-foreground">Agenda view removed.</div>;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <MessageLoading />
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
          <p className="text-xs text-muted-foreground mt-1">
            {activeWorkspace && workspaces.length > 0 
              ? `Preparing ${workspaces.find(w => w.id === activeWorkspace)?.name || 'workspace'} data`
              : 'Setting up workspace...'
            }
          </p>
        </div>
      </div>
    )
  }

  // Render dashboard content based on the mode
  const renderDashboardContent = () => {
    // Only use grid layout in customize mode
    if (!isCustomizing) {
      // Regular stacked layout - ensure this renders widgets properly when not customizing
      return (
        <div className="space-y-6">
          {/* Stats row */}
          {(visibleWidgets.revenueStats || visibleWidgets.invoiceStats || visibleWidgets.averageInvoice) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleWidgets.revenueStats && (
                <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <h3 className="text-2xl font-bold mt-2 text-foreground">
                    {`${Math.round(stats.totalRevenue).toLocaleString()} kr`}
                  </h3>
                  <div className="mt-4 flex items-center gap-2">
                    <div className={`flex items-center gap-1 ${stats.revenueGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {stats.revenueGrowth >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      <span>{Math.abs(stats.revenueGrowth).toFixed(1)}%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">vs last month</p>
                  </div>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-full">
                  <DollarSign className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
                </Card>
              )}

              {visibleWidgets.invoiceStats && (
                <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Invoices</p>
                  <h3 className="text-2xl font-bold mt-2 text-foreground">{stats.invoiceCount}</h3>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
              </div>
                </Card>
              )}

              {visibleWidgets.averageInvoice && (
                <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Average Invoice</p>
                  <h3 className="text-2xl font-bold mt-2 text-foreground">
                    {`${Math.round(stats.averageInvoiceValue).toLocaleString()} kr`}
                  </h3>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-full">
                  <BarChart className="w-6 h-6 text-purple-400" />
                </div>
              </div>
                </Card>
              )}
            </div>
          )}
          
          {/* Second row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Invoice-related content */}
            {visibleWidgets.recentInvoices && (
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Recent Invoices</h3>
                  <span className="text-xs text-muted-foreground">from invoices table</span>
                </div>
                <div className="space-y-3">
                  {invoices.length > 0 ? (
                    invoices.slice(0, 5).map((invoice) => (
                      <div key={invoice.document_number} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{invoice.customers?.name || 'Unknown Customer'}</p>
                          <p className="text-xs text-muted-foreground">#{invoice.document_number}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">
                            {formatKrona(invoice.total)}
                          </p>
                          <p className="text-xs text-muted-foreground">{invoice.invoice_date ? format(new Date(invoice.invoice_date), 'PP') : 'No date'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent invoices</p>
                  )}
                </div>
              </Card>
            )}
            
            {/* Events and deadlines */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {visibleWidgets.upcomingEvents && (
                <Card className="p-6 bg-background border-border dark:border-border shadow-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Upcoming Events</h3>
                    <span className="text-xs text-muted-foreground">from calendar_events table</span>
                  </div>
                  <div className="space-y-3">
                    {meetings.length > 0 ? (
                      meetings.filter(meeting => new Date(meeting.start_time) > new Date())
                        .slice(0, 3)
                        .map((meeting) => (
                          <div key={meeting.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                            <div className="flex items-center gap-3">
                              <div className="bg-blue-500/20 p-2 rounded-md">
                                <Calendar className="h-4 w-4 text-blue-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{meeting.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {meeting.start_time 
                                    ? format(new Date(meeting.start_time), 'PP • p') 
                                    : 'No time set'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No upcoming events</p>
                    )}
                  </div>
                </Card>
              )}
              
              {visibleWidgets.urgentTasks && (
                <Card className="p-6 bg-background border-border dark:border-border shadow-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Urgent Tasks</h3>
                    <div className="flex items-center">
                      <span className="text-xs text-muted-foreground mr-2">from project_tasks table</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 hover:opacity-100 transition-opacity"
                        onClick={refreshUrgentTasks}
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {getUrgentTasks().length > 0 ? (
                      getUrgentTasks().slice(0, 3).map((task) => (
                        <div key={task.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div className="bg-red-500/20 p-2 rounded-md">
                              <AlertCircle className="h-4 w-4 text-red-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{task.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {task.deadline 
                                  ? isToday(new Date(task.deadline))
                                    ? 'Due today'
                                    : `Due ${format(new Date(task.deadline), 'PP')}` 
                                  : 'No deadline'}
                              </p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleTaskComplete(task.id)}
                          >
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No urgent tasks</p>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
          
          {/* Third row - Domains, Leads, Sales, and More */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {visibleWidgets.domains && (
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Domains</h3>
                  <span className="text-xs text-muted-foreground">from domains table</span>
                </div>
                <div className="space-y-3">
                  {domains.length > 0 ? (
                    domains.map((domain) => (
                      <div key={domain.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-500/20 p-2 rounded-md">
                            <Globe className="h-4 w-4 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{domain.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {domain.expiry_date 
                                ? `Expires ${format(new Date(domain.expiry_date), 'PP')}` 
                                : 'No expiry date'}
                            </p>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          domain.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          domain.status === 'expiring' ? 'bg-yellow-500/20 text-yellow-400' :
                          domain.status === 'expired' ? 'bg-red-500/20 text-red-400' :
                          'bg-neutral-500/20 text-foreground text-muted-foreground'
                        }`}>
                          {domain.status || 'pending'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No domains found</p>
                  )}
                </div>
              </Card>
            )}
            
            {visibleWidgets.leads && (
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Leads</h3>
                  <span className="text-xs text-muted-foreground">from leads table</span>
                </div>
                <div className="space-y-3">
                  {leads.length > 0 ? (
                    leads.map((lead) => (
                      <div key={lead.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.company || 'No company'}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          lead.status === 'new' ? 'bg-blue-500/20 text-blue-400' :
                          lead.status === 'contacted' ? 'bg-yellow-500/20 text-yellow-400' :
                          lead.status === 'qualified' ? 'bg-green-500/20 text-green-400' :
                          lead.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                          'bg-neutral-500/20 text-foreground text-muted-foreground'
                        }`}>
                          {lead.status || 'new'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No leads found</p>
                  )}
                </div>
              </Card>
            )}
            
            {visibleWidgets.sales && (
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Sales Pipeline</h3>
                  <span className="text-xs text-muted-foreground">from deals table</span>
                </div>
                <div className="mb-3">
                  <p className="text-sm text-muted-foreground">Total Pipeline Value</p>
                  <p className="text-xl font-bold text-foreground">
                    {formatKrona(calculateTotalPipeline(sales))}
                  </p>
                </div>
                <div className="space-y-2">
                  {sales.length > 0 ? (
                    sales.slice(0, 3).map((sale) => (
                      <div key={sale.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{sale.lead_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{sale.company || 'No company'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">
                            {formatKrona(sale.value)}
                          </p>
                          <p className="text-xs text-muted-foreground">{sale.stage || 'No stage'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No sales data</p>
                  )}
                </div>
              </Card>
            )}
          </div>
          
          {/* Fourth row - Analytics, Gmail, etc. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {visibleWidgets.gmailHub && (
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Gmail Hub</h3>
                  <span className="text-xs text-muted-foreground">from Gmail API</span>
                </div>
                <div className="space-y-3">
                  {emails.length > 0 ? (
                    emails.map((email) => (
                      <div key={email.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div className="flex-1 overflow-hidden">
                          <p className={`text-sm font-medium ${email.unread ? 'text-foreground' : 'text-foreground text-muted-foreground'}`}>
                            {email.subject.length > 30 ? email.subject.substring(0, 30) + '...' : email.subject}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{email.from}</p>
                        </div>
                        <p className="text-xs text-muted-foreground ml-2">
                          {email.date ? format(new Date(email.date), 'PP') : 'No date'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No emails found</p>
                  )}
                </div>
              </Card>
            )}
            
            {visibleWidgets.analyticsData && analyticsData && (
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Analytics Overview</h3>
                  <span className="text-xs text-muted-foreground">from Analytics API</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Pageviews</p>
                    <p className="text-lg font-bold text-foreground">{analyticsData.pageviews.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unique Visitors</p>
                    <p className="text-lg font-bold text-foreground">{analyticsData.visitors.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bounce Rate</p>
                    <p className="text-lg font-bold text-foreground">{analyticsData.bounce_rate.toFixed(1)}%</p>
                  </div>
                </div>
              </Card>
            )}
            
            {visibleWidgets.searchConsole && searchConsoleData && (
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Search Console</h3>
                  <span className="text-xs text-muted-foreground">from Search Console API</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Clicks (28 days)</p>
                    <p className="text-lg font-bold text-foreground">{searchConsoleData.clicks.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Impressions</p>
                    <p className="text-lg font-bold text-foreground">{searchConsoleData.impressions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CTR</p>
                    <p className="text-lg font-bold text-foreground">{(searchConsoleData.ctr * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
          
          {/* Fifth row - Other widgets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {visibleWidgets.cronJobs && (
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Scheduled Tasks</h3>
                  <span className="text-xs text-muted-foreground">from cron_jobs table</span>
                </div>
                <div className="space-y-3">
                  {cronJobs.length > 0 ? (
                    cronJobs.map((job) => (
                      <div key={job.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${
                            job.execution_status === 'success' ? 'bg-green-500/20' :
                            job.execution_status === 'pending' ? 'bg-blue-500/20' :
                            job.execution_status === 'running' ? 'bg-yellow-500/20' :
                            'bg-red-500/20'
                          }`}>
                            <Clock className={`h-4 w-4 ${
                              job.execution_status === 'success' ? 'text-green-400' :
                              job.execution_status === 'pending' ? 'text-blue-400' :
                              job.execution_status === 'running' ? 'text-yellow-400' :
                              'text-red-400'
                            }`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{job.name}</p>
                            <p className="text-xs text-muted-foreground">{job.schedule}</p>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          job.execution_status === 'success' ? 'bg-green-500/20 text-green-400' :
                          job.execution_status === 'pending' ? 'bg-blue-500/20 text-blue-400' :
                          job.execution_status === 'running' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {job.execution_status}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No scheduled tasks</p>
                  )}
                </div>
              </Card>
            )}
            
            {visibleWidgets.invoiceTypes && (
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg">
                <h3 className="text-lg font-semibold text-foreground mb-4">Invoice Types</h3>
                <div className="text-sm text-muted-foreground">
                  <p>Invoice type data visualization would go here</p>
                </div>
              </Card>
            )}
          </div>
          
          {/* Additional rows can be added here following the same pattern */}
        </div>
      );
    }
    
    // Return draggable grid layout in customize mode
    return (
      <div className="relative">
        {isDragging && (
          <div className="fixed inset-0 z-50 bg-gray-900 dark:bg-black bg-opacity-30 flex items-center justify-center pointer-events-none">
            <div className="bg-background p-3 rounded-md shadow-lg text-foreground">
              <Move className="h-5 w-5 mr-2 inline-block" /> Drag to reposition
            </div>
          </div>
        )}
        
        {/* Show resize help when in customization mode */}
        <ResizeHelp isCustomizing={isCustomizing} />
        
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 3, md: 2, sm: 2, xs: 1, xxs: 1 }}
          rowHeight={180}
          width={1200}
          isDraggable={isCustomizing}
          isResizable={isCustomizing}
          onLayoutChange={handleLayoutChange}
          onDragStart={() => setIsDragging(true)}
          onDragStop={() => setIsDragging(false)}
          onResizeStart={() => setIsDragging(false)}
          ref={gridRef}
          resizeHandles={['se']}
          compactType={null}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          draggableHandle=".drag-handle"
          useCSSTransforms={true}
          transformScale={1}
          preventCollision={true}
          autoSize={true}
          verticalCompact={false}
          isBounded={false}
          allowOverlap={false}
        >
          {visibleWidgets.revenueStats && (
            <div key="revenueStats" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                    <h3 className="text-2xl font-bold mt-2 text-foreground">
                      {formatKrona(stats.totalRevenue)}
                    </h3>
                    <div className="mt-4 flex items-center gap-2">
                      <div className={`flex items-center gap-1 ${stats.revenueGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {stats.revenueGrowth >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        <span>{Math.abs(stats.revenueGrowth).toFixed(1)}%</span>
                      </div>
                      <p className="text-sm text-muted-foreground">vs last month</p>
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-full">
                    <DollarSign className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.invoiceStats && (
            <div key="invoiceStats" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Invoices</p>
                    <h3 className="text-2xl font-bold mt-2 text-foreground">{stats.invoiceCount}</h3>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-full">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.averageInvoice && (
            <div key="averageInvoice" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Average Invoice</p>
                    <h3 className="text-2xl font-bold mt-2 text-foreground">
                      {formatKrona(stats.averageInvoiceValue)}
                    </h3>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-full">
                    <BarChart className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.recentInvoices && (
            <div key="recentInvoices" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Recent Invoices</h3>
                  <span className="text-xs text-muted-foreground">from invoices table</span>
                </div>
                <div className="space-y-3 overflow-auto max-h-[250px]">
                  {invoices.length > 0 ? (
                    invoices.slice(0, 5).map((invoice) => (
                      <div key={invoice.document_number} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{invoice.customers?.name || 'Unknown Customer'}</p>
                          <p className="text-xs text-muted-foreground">#{invoice.document_number}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">
                            {formatKrona(invoice.total)}
                          </p>
                          <p className="text-xs text-muted-foreground">{invoice.invoice_date ? format(new Date(invoice.invoice_date), 'PP') : 'No date'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent invoices</p>
                  )}
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.invoiceTypes && (
            <div key="invoiceTypes" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <h3 className="text-lg font-semibold text-foreground mb-4">Invoice Types</h3>
                <div className="text-sm text-muted-foreground">
                  <p>Invoice type data visualization would go here</p>
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.upcomingEvents && (
            <div key="upcomingEvents" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Upcoming Events</h3>
                  <span className="text-xs text-muted-foreground">from calendar_events table</span>
                </div>
                <div className="space-y-3 overflow-auto max-h-[250px]">
                  {meetings.length > 0 ? (
                    meetings.filter(meeting => new Date(meeting.start_time) > new Date())
                      .slice(0, 5)
                      .map((meeting) => (
                        <div key={meeting.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-500/20 p-2 rounded-md">
                              <Calendar className="h-4 w-4 text-blue-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{meeting.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {meeting.start_time 
                                  ? format(new Date(meeting.start_time), 'PP • p') 
                                  : 'No time set'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No upcoming events</p>
                  )}
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.upcomingDeadlines && (
            <div key="upcomingDeadlines" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <h3 className="text-lg font-semibold text-foreground mb-4">Upcoming Deadlines</h3>
                <div className="space-y-3 overflow-auto max-h-[250px]">
                  {getUpcomingDeadlines().length > 0 ? (
                    getUpcomingDeadlines().map((task) => (
                      <div key={task.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="bg-orange-500/20 p-2 rounded-md">
                            <Clock className="h-4 w-4 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.deadline 
                                ? `Due ${format(new Date(task.deadline), 'PP')}` 
                                : 'No deadline'}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleTaskComplete(task.id)}
                        >
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
                  )}
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.urgentTasks && (
            <div key="urgentTasks" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Urgent Tasks</h3>
                  <div className="flex items-center">
                    <span className="text-xs text-muted-foreground mr-2">from project_tasks table</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 hover:opacity-100 transition-opacity"
                      onClick={refreshUrgentTasks}
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-3 overflow-auto max-h-[250px]">
                  {getUrgentTasks().length > 0 ? (
                    getUrgentTasks().map((task) => (
                      <div key={task.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="bg-red-500/20 p-2 rounded-md">
                            <AlertCircle className="h-4 w-4 text-red-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.deadline 
                                ? isToday(new Date(task.deadline))
                                  ? 'Due today'
                                  : `Due ${format(new Date(task.deadline), 'PP')}` 
                                : 'No deadline'}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleTaskComplete(task.id)}
                        >
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No urgent tasks</p>
                  )}
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.domains && (
            <div key="domains" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Domains</h3>
                  <span className="text-xs text-muted-foreground">from domains table</span>
                </div>
                <div className="space-y-3 overflow-auto max-h-[250px]">
                  {domains.length > 0 ? (
                    domains.map((domain) => (
                      <div key={domain.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-500/20 p-2 rounded-md">
                            <Globe className="h-4 w-4 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{domain.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {domain.expiry_date 
                                ? `Expires ${format(new Date(domain.expiry_date), 'PP')}` 
                                : 'No expiry date'}
                            </p>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          domain.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          domain.status === 'expiring' ? 'bg-yellow-500/20 text-yellow-400' :
                          domain.status === 'expired' ? 'bg-red-500/20 text-red-400' :
                          'bg-neutral-500/20 text-foreground text-muted-foreground'
                        }`}>
                          {domain.status || 'pending'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No domains found</p>
                  )}
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.leads && (
            <div key="leads" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Leads</h3>
                  <span className="text-xs text-muted-foreground">from leads table</span>
                </div>
                <div className="space-y-3 overflow-auto max-h-[250px]">
                  {leads.length > 0 ? (
                    leads.map((lead) => (
                      <div key={lead.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.company || 'No company'}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          lead.status === 'new' ? 'bg-blue-500/20 text-blue-400' :
                          lead.status === 'contacted' ? 'bg-yellow-500/20 text-yellow-400' :
                          lead.status === 'qualified' ? 'bg-green-500/20 text-green-400' :
                          lead.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                          'bg-neutral-500/20 text-foreground text-muted-foreground'
                        }`}>
                          {lead.status || 'new'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No leads found</p>
                  )}
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.sales && (
            <div key="sales" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Sales Pipeline</h3>
                  <span className="text-xs text-muted-foreground">from deals table</span>
                </div>
                <div className="mb-3">
                  <p className="text-sm text-muted-foreground">Total Pipeline Value</p>
                  <p className="text-xl font-bold text-foreground">
                    {formatKrona(calculateTotalPipeline(sales))}
                  </p>
                </div>
                <div className="space-y-2">
                  {sales.length > 0 ? (
                    sales.slice(0, 3).map((sale) => (
                      <div key={sale.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium text-foreground">{sale.lead_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{sale.company || 'No company'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">
                            {formatKrona(sale.value)}
                          </p>
                          <p className="text-xs text-muted-foreground">{sale.stage || 'No stage'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No sales data</p>
                  )}
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.gmailHub && (
            <div key="gmailHub" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Gmail Hub</h3>
                  <span className="text-xs text-muted-foreground">from Gmail API</span>
                </div>
                <div className="space-y-3 overflow-auto max-h-[250px]">
                  {emails.length > 0 ? (
                    emails.map((email) => (
                      <div key={email.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div className="flex-1 overflow-hidden">
                          <p className={`text-sm font-medium ${email.unread ? 'text-foreground' : 'text-foreground text-muted-foreground'}`}>
                            {email.subject.length > 30 ? email.subject.substring(0, 30) + '...' : email.subject}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{email.from}</p>
                        </div>
                        <p className="text-xs text-muted-foreground ml-2">
                          {email.date ? format(new Date(email.date), 'PP') : 'No date'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No emails found</p>
                  )}
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.analyticsData && analyticsData && (
            <div key="analyticsData" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Analytics Overview</h3>
                  <span className="text-xs text-muted-foreground">from Analytics API</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Pageviews</p>
                    <p className="text-lg font-bold text-foreground">{analyticsData.pageviews.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unique Visitors</p>
                    <p className="text-lg font-bold text-foreground">{analyticsData.visitors.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bounce Rate</p>
                    <p className="text-lg font-bold text-foreground">{analyticsData.bounce_rate.toFixed(1)}%</p>
                  </div>
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.searchConsole && searchConsoleData && (
            <div key="searchConsole" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Search Console</h3>
                  <span className="text-xs text-muted-foreground">from Search Console API</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Clicks (28 days)</p>
                    <p className="text-lg font-bold text-foreground">{searchConsoleData.clicks.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Impressions</p>
                    <p className="text-lg font-bold text-foreground">{searchConsoleData.impressions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CTR</p>
                    <p className="text-lg font-bold text-foreground">{(searchConsoleData.ctr * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </Card>
            </div>
          )}
          
          {visibleWidgets.cronJobs && (
            <div key="cronJobs" className="grid-item relative">
              <GridItemHandle isCustomizing={isCustomizing} />
              <ResizeHandle isCustomizing={isCustomizing} />
              <Card className="p-6 bg-background border-border dark:border-border shadow-lg h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Scheduled Tasks</h3>
                  <span className="text-xs text-muted-foreground">from cron_jobs table</span>
                </div>
                <div className="space-y-3 overflow-auto max-h-[250px]">
                  {cronJobs.length > 0 ? (
                    cronJobs.map((job) => (
                      <div key={job.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${
                            job.execution_status === 'success' ? 'bg-green-500/20' :
                            job.execution_status === 'pending' ? 'bg-blue-500/20' :
                            job.execution_status === 'running' ? 'bg-yellow-500/20' :
                            'bg-red-500/20'
                          }`}>
                            <Clock className={`h-4 w-4 ${
                              job.execution_status === 'success' ? 'text-green-400' :
                              job.execution_status === 'pending' ? 'text-blue-400' :
                              job.execution_status === 'running' ? 'text-yellow-400' :
                              'text-red-400'
                            }`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{job.name}</p>
                            <p className="text-xs text-muted-foreground">{job.schedule}</p>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          job.execution_status === 'success' ? 'bg-green-500/20 text-green-400' :
                          job.execution_status === 'pending' ? 'bg-blue-500/20 text-blue-400' :
                          job.execution_status === 'running' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {job.execution_status}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No scheduled tasks</p>
                  )}
                </div>
              </Card>
            </div>
          )}
        </ResponsiveGridLayout>
      </div>
    );
  };

  // If there's no active workspace, show a workspace selector instead of the dashboard
  if (!activeWorkspace && workspaces.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <div className="w-full max-w-md p-6 bg-background border border-border dark:border-border rounded-lg shadow-lg">
          <h2 className="text-xl font-bold text-foreground mb-4 text-center">Select a Workspace</h2>
          <p className="text-muted-foreground mb-6 text-center">
            You need to select a workspace to view your dashboard
          </p>
          
          <div className="space-y-4">
            {workspaces.map(workspace => (
              <button
                key={workspace.id}
                onClick={() => handleWorkspaceChange(workspace.id)}
                className="w-full p-4 bg-muted hover:bg-gray-300 dark:hover:bg-neutral-600 rounded-lg flex items-center transition-colors"
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
  }
  
  // If the user doesn't have any workspaces yet, show a message but still display data
  if (workspaces.length === 0 && !loading && !activeWorkspace) {
    // Will still display data since we're not filtering by workspace
    return (
      <div className="space-y-6 p-6">
        <div className="bg-background border border-yellow-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <AlertCircle className="h-5 w-5" />
            <h3 className="font-medium">Workspace Not Found</h3>
          </div>
          <p className="text-foreground text-muted-foreground text-sm">
            No workspace is selected, so showing all available data. 
            To filter data by workspace, please create a workspace or ask your administrator to invite you to one.
          </p>
          <div className="mt-3">
            <Button
              onClick={() => router.push('/settings/team')}
              variant="outline"
              className="text-xs border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
              size="sm"
            >
              Go to Team Settings
            </Button>
          </div>
        </div>
        
        {/* Continue to render the dashboard */}
        {renderDashboardContent()}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Debug alert removed as everything is working correctly */}
    
      <div className="flex justify-between items-center mb-2">
        <div className="group relative flex-1 mr-4 overflow-hidden rounded-lg">
          <div className="relative z-10 m-[2px] bg-background p-6 rounded-lg shadow-lg">
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
        <h2 className="text-2xl font-bold text-foreground">{getGreeting()}</h2>
        <p className="text-muted-foreground mt-2">Here's what's happening today</p>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          {/* Show the user's actual workspace name */}
          <div className="bg-background rounded-lg px-4 py-2 flex items-center">
            <span className="text-foreground font-medium">
              {activeWorkspace && workspaces.length > 0 
                ? workspaces.find(w => w.id === activeWorkspace)?.name || 'Loading...'
                : 'Loading workspace...'
              }
            </span>
                </div>
          
          <div className="group relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-green-500 via-blue-500 to-green-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
            
            <div className="relative z-10 m-[1px] bg-background rounded-lg hover:bg-muted/80 transition-colors duration-300">
              <Button 
                variant="ghost" 
                className="border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
                onClick={forceRefresh}
                disabled={refreshing || statsLoading}
              >
                {refreshing || statsLoading ? (
                  <MessageLoading />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {refreshing || statsLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_200%] animate-gradient rounded-lg"></div>
            
            <div className="relative z-10 m-[1px] bg-background rounded-lg hover:bg-muted/80 transition-colors duration-300">
              <Button 
                variant="ghost" 
                className="border-0 bg-transparent text-foreground hover:bg-transparent hover:text-foreground"
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
        <Card className="p-6 bg-background border-border dark:border-border shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-foreground">Customize Your Dashboard</h3>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                className="bg-red-600/10 border-red-600/30 text-red-400 hover:bg-red-600/20"
                onClick={resetLayoutToDefaults}
                title="Reset layout to default positions"
              >
                Reset Layout
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                className="bg-muted border-gray-400 dark:border-border text-foreground hover:bg-gray-300 dark:hover:bg-neutral-600"
                onClick={() => setIsCustomizing(false)}
              >
                Cancel
              </Button>
              
              <Button 
                variant="default" 
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-foreground"
                onClick={applyChanges}
              >
                Save Changes
              </Button>
            </div>
          </div>
          
          <div className="mb-4 bg-blue-200 dark:bg-blue-900/30 border border-blue-600/30 p-4 rounded-lg">
            <h4 className="font-medium text-blue-300 mb-2">Dashboard Customization</h4>
            <p className="text-sm text-foreground text-muted-foreground mb-2">
              Make your dashboard your own by customizing it:
            </p>
            <ul className="text-sm text-foreground text-muted-foreground list-disc pl-5 space-y-1 mb-2">
              <li><span className="text-blue-300 font-medium">Drag and drop</span> widgets to rearrange them using the top-right handle</li>
              <li><span className="text-blue-300 font-medium">Resize widgets</span> by dragging from the bottom-right corner</li>
              <li><span className="text-blue-300 font-medium">Toggle visibility</span> of widgets using the buttons below</li>
            </ul>
            <p className="text-sm text-foreground text-muted-foreground">
              Once you're happy with your layout, click <span className="text-blue-300 font-medium">Save Changes</span> to apply.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.revenueStats ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.revenueStats ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, revenueStats: !prev.revenueStats }))}
              >
                {visibleWidgets.revenueStats ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Revenue Stats</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.invoiceStats ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.invoiceStats ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, invoiceStats: !prev.invoiceStats }))}
              >
                {visibleWidgets.invoiceStats ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Invoice Count</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.averageInvoice ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.averageInvoice ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, averageInvoice: !prev.averageInvoice }))}
              >
                {visibleWidgets.averageInvoice ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Average Invoice</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.recentInvoices ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.recentInvoices ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, recentInvoices: !prev.recentInvoices }))}
              >
                {visibleWidgets.recentInvoices ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Recent Invoices</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.invoiceTypes ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.invoiceTypes ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, invoiceTypes: !prev.invoiceTypes }))}
              >
                {visibleWidgets.invoiceTypes ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Invoice Types</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.upcomingEvents ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.upcomingEvents ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, upcomingEvents: !prev.upcomingEvents }))}
              >
                {visibleWidgets.upcomingEvents ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Upcoming Events</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.upcomingDeadlines ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.upcomingDeadlines ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, upcomingDeadlines: !prev.upcomingDeadlines }))}
              >
                {visibleWidgets.upcomingDeadlines ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Upcoming Deadlines</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.urgentTasks ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.urgentTasks ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, urgentTasks: !prev.urgentTasks }))}
              >
                {visibleWidgets.urgentTasks ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Urgent Tasks</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.domains ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.domains ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, domains: !prev.domains }))}
              >
                {visibleWidgets.domains ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Domains</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.leads ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.leads ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, leads: !prev.leads }))}
              >
                {visibleWidgets.leads ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Leads</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.sales ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.sales ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, sales: !prev.sales }))}
              >
                {visibleWidgets.sales ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Sales</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.gmailHub ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.gmailHub ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, gmailHub: !prev.gmailHub }))}
              >
                {visibleWidgets.gmailHub ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Gmail Hub</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.analyticsData ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.analyticsData ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, analyticsData: !prev.analyticsData }))}
              >
                {visibleWidgets.analyticsData ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Analytics</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.searchConsole ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.searchConsole ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, searchConsole: !prev.searchConsole }))}
              >
                {visibleWidgets.searchConsole ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Search Console</span>
            </div>
            
            <div className="flex items-center space-x-2 p-2 border border-border dark:border-border rounded-md bg-muted">
              <Button 
                variant={visibleWidgets.cronJobs ? "default" : "outline"}
                size="sm"
                className={`${visibleWidgets.cronJobs ? 'bg-green-600 hover:bg-green-700' : 'bg-muted'} w-8 h-8 p-0`}
                onClick={() => setVisibleWidgets(prev => ({ ...prev, cronJobs: !prev.cronJobs }))}
              >
                {visibleWidgets.cronJobs ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <span className="text-sm text-foreground text-muted-foreground">Scheduled Tasks</span>
            </div>
          </div>
        </Card>
      )}

      {/* Render dashboard content */}
      <div className="relative">
      {renderDashboardContent()}
        
        {/* Refreshing overlay */}
        {refreshing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
            <div className="flex flex-col items-center justify-center space-y-3 min-h-[200px]">
              <MessageLoading />
              <p className="text-sm text-muted-foreground">Refreshing data...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 