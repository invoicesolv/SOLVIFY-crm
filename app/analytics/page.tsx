"use client"

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-client';
import { Card } from "@/components/ui/card"
import { SidebarDemo } from "@/components/ui/code.demo"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Users,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Target,
  DollarSign,
  Clock,
  RefreshCw,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Mail,
  Settings2,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface AnalyticsStats {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  pageViews: number;
  sessions: number;
  avgSessionDuration: number;
  bounceRate: number;
  engagementRate: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  conversionEvents: Array<{
    name: string;
    count: number;
    value: number;
  }>;
}

interface DeviceStats {
  users: number;
  sessions: number;
  pageViews: number;
  conversions: number;
}

interface AnalyticsData {
  overview: AnalyticsStats;
  byDate: Array<{
    date: string;
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    pageViews: number;
    sessions: number;
  }>;
  byDatePrevious?: Array<{
    date: string;
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    pageViews: number;
    sessions: number;
  }>;
  previousPeriod?: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    pageViews: number;
    sessions: number;
    bounceRate: number;
    engagementRate: number;
    avgSessionDuration: number;
    conversions?: number;
    revenue?: number;
    conversionRate?: number;
    dateRange: {
      start: string;
      end: string;
    };
  } | null;
  bySource: Record<string, any>;
  byDevice: Record<string, DeviceStats>;
  byConversion: Record<string, {
    count: number;
    value: number;
    byDevice: Record<string, { count: number; value: number; }>;
    bySource: Record<string, { count: number; value: number; }>;
  }>;
  metadata?: {
    timeZone: string;
    currencyCode: string;
    dateRange: {
      start: string;
      end: string;
    };
  };
}

interface CachedData {
  analyticsData: AnalyticsData | null;
  properties: Array<{ id: string; displayName: string; account?: string; accountDisplayName?: string }>;
  timestamp: number;
  expiresAt: number;
  selectedProperty: { id: string; displayName: string; account?: string; accountDisplayName?: string } | null;
  user_id: string;
}

const StatsCard = ({ title, value, icon, previousValue }: { title: string; value: number; icon: React.ReactNode; previousValue?: number }) => {
  const formatValue = (title: string, value: number) => {
    if (title.includes('Rate')) {
      return `${value.toFixed(1)}%`;
    }
    if (title === 'Revenue') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    }
    if (title === 'Avg Duration') {
      const minutes = Math.floor(value / 60);
      const seconds = Math.floor(value % 60);
      return `${minutes}m ${seconds}s`;
    }
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      compactDisplay: 'short'
    }).format(value);
  };

  // Calculate percentage change if previous value is provided
  const percentChange = previousValue !== undefined && previousValue !== 0
    ? ((value - previousValue) / previousValue) * 100
    : null;

  // Assign different border colors based on title category
  const getBorderColor = (title: string) => {
    if (title.includes('User')) return 'border-blue-500/30';
    if (title.includes('View') || title.includes('Session')) return 'border-purple-500/30';
    if (title.includes('Conversion') || title.includes('Revenue')) return 'border-rose-500/30';
    if (title.includes('Rate')) return 'border-green-500/30';
    if (title.includes('Duration')) return 'border-cyan-500/30';
    return 'border-border';
  };

  return (
    <div className={`p-4 rounded-lg bg-card border shadow-lg ${getBorderColor(title)}`}>
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span>{title}</span>
      </div>
      <div className="text-2xl font-semibold text-foreground">
        {formatValue(title, value)}
      </div>
      {percentChange !== null && (
        <div className={cn(
          "text-xs mt-2 flex items-center gap-1",
          percentChange > 0 ? "text-emerald-400" : percentChange < 0 ? "text-rose-400" : "text-muted-foreground"
        )}>
          {percentChange > 0 ? <ArrowUp className="h-3 w-3" /> : 
           percentChange < 0 ? <ArrowDown className="h-3 w-3" /> : 
           <Minus className="h-3 w-3" />}
          <span>{Math.abs(percentChange).toFixed(1)}% vs previous</span>
        </div>
      )}
    </div>
  );
};

const getDeviceIcon = (device: string) => {
  switch (device.toLowerCase()) {
    case 'desktop':
      return <Monitor className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    case 'mobile':
      return <Smartphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    case 'tablet':
      return <Tablet className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
    default:
      return <Laptop className="h-4 w-4 text-muted-foreground" />;
  }
};

export default function AnalyticsPage() {
  const { user, loading: isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [properties, setProperties] = useState<Array<{ id: string; displayName: string; account?: string; accountDisplayName?: string }>>([]);
  const [selectedProperty, setSelectedProperty] = useState<{ id: string; displayName: string; account?: string; accountDisplayName?: string } | null>(null);
  const [gaPropertiesLoading, setGaPropertiesLoading] = useState(true);
  const [gaPropertiesError, setGaPropertiesError] = useState<string | null>(null);
  const [showEmailSettings, setShowEmailSettings] = useState(false);
  const [emailSettings, setEmailSettings] = useState({
    enabled: false,
    weeklyRecipients: '',
    testRecipients: '',
    manualRecipients: '',
    frequency: 'weekly',
    sendDay: 'monday',
    sendTime: '09:00'
  });
  const [cronJobs, setCronJobs] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState('7days');

  useEffect(() => {
    if (user?.id) {
      console.log('[Analytics] Session detected. Loading GA4 Properties...');
      loadGa4Properties();
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && selectedProperty?.id) {
      console.log(`[Analytics] Property or DateRange changed. Loading data for: ${selectedProperty.displayName} (${selectedProperty.id}), Range: ${dateRange}`);
      loadData(true);
    } else if (!selectedProperty?.id) {
      console.log('[Analytics] No property selected or available. Clearing analytics data.');
      setAnalyticsData(null);
      setLoading(false);
    }
  }, [user?.id, selectedProperty, dateRange]);

  useEffect(() => {
    // Get current theme from CSS variables
    const isDark = document.documentElement.classList.contains('dark');
    
    const colors = {
      primary: '210, 100%, 65%',      // Bright blue
      secondary: '150, 90%, 55%',     // Vibrant green
      tertiary: '280, 90%, 70%',      // Rich purple
      quaternary: '30, 95%, 65%',     // Bright orange
      rose: '340, 95%, 65%',          // Hot pink
      teal: '175, 85%, 50%',          // Teal
      gold: '45, 95%, 65%',           // Gold/yellow
      cyan: '190, 90%, 60%',          // Cyan blue
      lime: '85, 90%, 55%',           // Lime green
      magenta: '310, 90%, 65%',       // Magenta
      background: isDark ? '220, 13%, 15%' : '0, 0%, 100%',    // Theme-aware background
      card1: isDark ? '260, 15%, 18%' : '210, 20%, 98%',       // Theme-aware card
      card2: isDark ? '210, 15%, 18%' : '210, 20%, 98%',       // Theme-aware card
      card3: isDark ? '30, 15%, 18%' : '30, 20%, 98%',         // Theme-aware card
      grid: isDark ? '220, 13%, 25%' : '220, 13%, 90%',        // Theme-aware grid
      text: isDark ? '0, 0%, 95%' : '0, 0%, 10%',              // Theme-aware text
      subtext: isDark ? '220, 10%, 80%' : '220, 10%, 40%'      // Theme-aware subtext
    };

    document.documentElement.style.setProperty('--chart-1', colors.primary);
    document.documentElement.style.setProperty('--chart-2', colors.secondary);
    document.documentElement.style.setProperty('--chart-3', colors.tertiary);
    document.documentElement.style.setProperty('--chart-4', colors.quaternary);
    document.documentElement.style.setProperty('--chart-5', colors.rose);
    document.documentElement.style.setProperty('--chart-6', colors.teal);
    document.documentElement.style.setProperty('--chart-7', colors.gold);
    document.documentElement.style.setProperty('--chart-8', colors.cyan);
    document.documentElement.style.setProperty('--chart-9', colors.lime);
    document.documentElement.style.setProperty('--chart-10', colors.magenta);
    document.documentElement.style.setProperty('--chart-bg', colors.background);
    document.documentElement.style.setProperty('--card-bg-1', colors.card1);
    document.documentElement.style.setProperty('--card-bg-2', colors.card2);
    document.documentElement.style.setProperty('--card-bg-3', colors.card3);
    document.documentElement.style.setProperty('--chart-grid', colors.grid);
    document.documentElement.style.setProperty('--chart-text', colors.text);
    document.documentElement.style.setProperty('--chart-subtext', colors.subtext);
  }, []);

  const getCacheKey = () => {
    return `analytics_cache_${user?.id}`;
  };

  const getCachedData = (): CachedData | null => {
    if (typeof window === 'undefined') return null;
    
    const cached = localStorage.getItem(getCacheKey());
    if (!cached) return null;

    let data;
    try {
      data = JSON.parse(cached);
    } catch (e) {
      console.error("Failed to parse cached data:", e);
      localStorage.removeItem(getCacheKey());
      return null;
    }

    if (Date.now() > data.expiresAt || data.user_id !== user?.id) {
      localStorage.removeItem(getCacheKey());
      return null;
    }

    // Ensure properties in cache have displayName
    if (data.properties && Array.isArray(data.properties)) {
      data.properties = data.properties.map((p: any) => ({
        id: p.id,
        displayName: p.displayName || p.name || 'Unknown Property', // Handle old cache with name
        account: p.account,
        accountDisplayName: p.accountDisplayName
      }));
    }

    // Ensure selectedProperty in cache has displayName
    if (data.selectedProperty) {
      data.selectedProperty = {
        id: data.selectedProperty.id,
        displayName: data.selectedProperty.displayName || data.selectedProperty.name || 'Unknown Property',
        account: data.selectedProperty.account,
        accountDisplayName: data.selectedProperty.accountDisplayName
      };
    }
    
    return data as CachedData; // Assert as CachedData after migration
  };

  const setCachedData = (dataToCache: Partial<Omit<CachedData, 'timestamp' | 'expiresAt' | 'user_id'> & { analyticsData?: AnalyticsData | null }>) => {
    if (typeof window === 'undefined' || !user?.id) return;

    // Get the current full list of properties and selected property from component state
    // to ensure we cache the most up-to-date versions of these.
    const currentPropertiesToCache = properties;
    const currentSelectedPropertyToCache = selectedProperty;

    const cacheData: CachedData = {
      analyticsData: dataToCache.analyticsData !== undefined ? dataToCache.analyticsData : getCachedData()?.analyticsData || null,
      properties: currentPropertiesToCache, // Always use current state properties
      selectedProperty: currentSelectedPropertyToCache, // Always use current state selectedProperty
      timestamp: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
      user_id: user.id
    };

    localStorage.setItem(getCacheKey(), JSON.stringify(cacheData));
  };

  const loadGa4Properties = async () => {
    if (!user?.id || !session?.access_token) return;
    setGaPropertiesLoading(true);
    setGaPropertiesError(null);
    console.log('[Analytics] Fetching GA4 properties...');
    try {
      const response = await fetch('/api/ga4/properties', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) {
        let errorMessage = 'Failed to fetch GA4 properties';
        try {
          const errorData = await response.json();
          errorMessage = errorData.details || errorData.error || errorMessage;
        } catch (parseError) {
          console.error('[Analytics] Failed to parse error response for GA4 properties:', parseError);
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('[Analytics] Failed to parse GA4 properties response:', parseError);
        throw new Error('Invalid response format from server');
      }
      const fetchedProperties: Array<{ id: string; displayName: string; account?: string; accountDisplayName?: string }> = data.properties || [];
      setProperties(fetchedProperties);
      console.log('[Analytics] GA4 Properties fetched:', fetchedProperties);

      const currentSelectedId = selectedProperty?.id;
      if (fetchedProperties.length > 0) {
        const stillExists = fetchedProperties.find(p => p.id === currentSelectedId);
        if (!selectedProperty || !stillExists) {
          const cachedData = getCachedData(); // Assuming getCachedData can give us a preferred last selected property
          let lastSelectedPropId = cachedData?.selectedProperty?.id;
          
          let newSelectedProp = fetchedProperties.find(p => p.id === lastSelectedPropId);
          if (!newSelectedProp) { // If not found in cache or not in fetched list, pick first
             newSelectedProp = fetchedProperties[0];
             console.log('[Analytics] Auto-selecting first GA4 property:', newSelectedProp);
          } else {
             console.log('[Analytics] Restoring previously selected GA4 property:', newSelectedProp);
          }
          setSelectedProperty(newSelectedProp);
          // loadData will be triggered by the useEffect watching selectedProperty
        } else {
          console.log('[Analytics] Current selected property still valid:', selectedProperty);
        }
      } else {
        setSelectedProperty(null); // No properties, so nothing can be selected
        setAnalyticsData(null); // Clear analytics data if no properties
        console.log('[Analytics] No GA4 properties found for this service account.');
      }

    } catch (error: any) {
      console.error('[Analytics] Error fetching GA4 properties:', error);
      const errorMessage = error.message || 'An unknown error occurred while fetching properties.';
      setGaPropertiesError(errorMessage);
      toast.error(`Error loading GA4 properties: ${errorMessage}`);
      setProperties([]);
      setSelectedProperty(null);
      setAnalyticsData(null); // Clear analytics data on error
    } finally {
      setGaPropertiesLoading(false);
    }
  };

  const loadData = async (forceRefresh = false) => {
    if (!user?.id) {
      console.error('No user session found for analytics data');
      toast.error('User authentication required');
      setLoading(false);
      return;
    }

    if (!selectedProperty?.id) {
      console.log('[Analytics] No property selected. Skipping data load.');
      setLoading(false);
      setAnalyticsData(null);
      return;
    }

    if (!forceRefresh) {
      const cachedData = getCachedData();
      if (cachedData && cachedData.analyticsData && cachedData.selectedProperty?.id === selectedProperty.id) {
        setAnalyticsData(cachedData.analyticsData);
        setLoading(false);
        return;
      }
    }

    if (!session?.access_token) {
      toast.error('Authentication required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          startDate: dateRange, // This will be handled by the API's getDateRange function
          endDate: 'today',
          propertyId: selectedProperty?.id
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to fetch analytics data';
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch (parseError) {
          // If JSON parsing fails, try to get text response
          try {
            const textResponse = await response.text();
            console.error('[Analytics] Non-JSON error response:', textResponse);
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          } catch (textError) {
            console.error('[Analytics] Could not parse error response:', textError);
          }
        }
        
        if (response.status === 401) {
          localStorage.removeItem(getCacheKey());
          toast.error('Authentication required. Please reconnect Google Analytics in Settings.');
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('[Analytics] Failed to parse JSON response:', parseError);
        const textResponse = await response.text();
        console.error('[Analytics] Raw response:', textResponse);
        throw new Error('Invalid response format from server');
      }
      
      if (data.analytics) {
        setAnalyticsData(data.analytics);
        setCachedData({ analyticsData: data.analytics });
      } else {
        setAnalyticsData(null);
      }

    } catch (error: any) {
      console.error('[Analytics] Error fetching data:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    localStorage.removeItem(getCacheKey());
    console.log('[Analytics] Cache cleared');
    
    setIsRefreshing(true);
    loadData(true).finally(() => {
      setIsRefreshing(false);
      toast.success('Data refreshed');
    });
  };

  console.log('[Analytics] Render state:', {
    loading,
    isRefreshing,
    hasAnalyticsData: !!analyticsData,
    selectedProperty,
    propertiesCount: properties.length,
    analyticsOverview: analyticsData?.overview,
    hasDateData: analyticsData?.byDate && analyticsData.byDate.length > 0,
    hasDeviceData: analyticsData?.byDevice && Object.keys(analyticsData.byDevice || {}).length > 0,
    hasSourceData: analyticsData?.bySource && Object.keys(analyticsData.bySource || {}).length > 0
  });

  if (analyticsData) {
    console.log('[Analytics] Data structure:', {
      byDate: analyticsData.byDate?.slice(0, 2), // Show first two entries
      byDevice: analyticsData.byDevice || {},
      bySource: analyticsData.bySource || {}
    });
  }

  if (analyticsData?.byDevice) {
    console.log('[Analytics] Device data:', {
      devices: Object.keys(analyticsData.byDevice),
      sampleDevice: analyticsData.byDevice[Object.keys(analyticsData.byDevice)[0]],
      allDeviceData: analyticsData.byDevice
    });
    
    Object.entries(analyticsData.byDevice).forEach(([device, stats]) => {
      console.log(`[Analytics] Device ${device} stats:`, {
        device,
        users: stats.users,
        sessions: stats.sessions,
        pageViews: stats.pageViews,
        conversions: stats.conversions,
        hasConversions: stats.conversions !== undefined && stats.conversions !== null
      });
    });
  }

  const handleShowEmailSettings = async () => {
    try {
      if (!selectedProperty?.id) {
        toast.error('Please select a property first');
        return;
      }

      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }

      const [settingsResponse, cronResponse] = await Promise.all([
        fetch(`/api/analytics/email-settings?propertyId=${selectedProperty.id}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }),
        fetch(`/api/analytics/cron-jobs?propertyId=${selectedProperty.id}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
      ]);

      let settingsData, cronData;
      try {
        settingsData = await settingsResponse.json();
      } catch (parseError) {
        console.error('[Analytics] Failed to parse email settings response:', parseError);
        throw new Error('Invalid email settings response format');
      }
      
      try {
        cronData = await cronResponse.json();
      } catch (parseError) {
        console.error('[Analytics] Failed to parse cron jobs response:', parseError);
        throw new Error('Invalid cron jobs response format');
      }

      if (settingsResponse.ok && settingsData.data) {
        setEmailSettings({
          enabled: settingsData.data.enabled || false,
          weeklyRecipients: (settingsData.data.recipients || []).join(', '),
          testRecipients: '',
          manualRecipients: '',
          frequency: settingsData.data.frequency || 'weekly',
          sendDay: settingsData.data.send_day || 'monday',
          sendTime: settingsData.data.send_time || '09:00'
        });
      }

      if (cronResponse.ok) {
        console.log('Loaded cron jobs:', cronData.jobs);
        setCronJobs(cronData.jobs || []);
      }

      setShowEmailSettings(true);
    } catch (error) {
      console.error('Error loading email settings:', error);
      toast.error('Failed to load email settings');
    }
  };

  const handleSaveEmailSettings = async () => {
    try {
      if (!selectedProperty?.id) {
        toast.error('Please select a property first');
        return;
      }

      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }

      const weeklyRecipients = emailSettings.weeklyRecipients.split(',').map(email => email.trim()).filter(Boolean);
      if (emailSettings.enabled && weeklyRecipients.length === 0) {
        toast.error('Please add at least one recipient email for weekly reports');
        return;
      }

      const response = await fetch('/api/analytics/email-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          settings: {
            enabled: emailSettings.enabled,
            recipients: weeklyRecipients,
            frequency: 'weekly',
            send_day: emailSettings.sendDay,
            send_time: emailSettings.sendTime
          }
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('[Analytics] Failed to parse save settings response:', parseError);
        throw new Error('Invalid response format from server');
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      const cronResponse = await fetch(`/api/analytics/cron-jobs?propertyId=${selectedProperty.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      if (!cronResponse.ok) {
        throw new Error('Failed to fetch updated cron jobs');
      }
      
      let cronData;
      try {
        cronData = await cronResponse.json();
      } catch (parseError) {
        console.error('[Analytics] Failed to parse updated cron jobs response:', parseError);
        throw new Error('Invalid cron jobs response format');
      }
      setCronJobs(cronData.jobs || []);

      toast.success('Email schedule saved successfully');
      setShowEmailSettings(false);
    } catch (error) {
      console.error('Error saving email settings:', error);
      toast.error('Failed to save email settings');
    }
  };

  const calculateNextRunTime = (sendDay: string, sendTime: string) => {
    const [hours, minutes] = sendTime.split(':').map(Number);
    const now = new Date();
    const nextRun = new Date();
    
    nextRun.setHours(hours, minutes, 0, 0);

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = now.getDay();
    const targetDay = days.indexOf(sendDay.toLowerCase());
    
    let daysUntilNext = targetDay - today;
    if (daysUntilNext <= 0 || (daysUntilNext === 0 && now > nextRun)) {
      daysUntilNext += 7;
    }
    
    nextRun.setDate(nextRun.getDate() + daysUntilNext);
    return nextRun;
  };

  const handlePropertyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const propertyId = e.target.value;
    const selectedProp = properties.find((p) => p.id === propertyId);
    
    if (selectedProp) {
      setSelectedProperty(selectedProp);
      console.log('[Analytics] User selected property:', selectedProp);
    } else if (propertyId === "") { // User selected "Select a property"
        setSelectedProperty(null);
        setAnalyticsData(null); // Clear data
        console.log('[Analytics] User deselected property.');
    }
  };

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">Analytics Dashboard</h1>
          <div className="flex items-center gap-4">
            {gaPropertiesLoading && !properties.length ? (
              <p className="text-muted-foreground">Loading GA4 properties...</p>
            ) : gaPropertiesError ? (
              <p className="text-red-600 dark:text-red-400">Error loading properties: {gaPropertiesError}</p>
            ) : properties.length > 0 ? (
              <>
                <select
                  value={dateRange}
                  onChange={(e) => {
                    setDateRange(e.target.value);
                  }}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium",
                    "bg-background text-foreground border",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500",
                    "hover:border-blue-600 transition-colors",
                    "border-l-blue-400 border-t-purple-400 border-r-pink-400 border-b-teal-400",
                    "shadow-lg shadow-blue-900/10"
                  )}
                >
                  <option value="7days">Last 7 days</option>
                  <option value="14days">Last 14 days</option>
                  <option value="28days">Last 28 days</option>
                  <option value="30days">Last 30 days</option>
                </select>
                <select
                  value={selectedProperty?.id || ''}
                  onChange={handlePropertyChange}
                  disabled={gaPropertiesLoading}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium min-w-[200px]",
                    "bg-background text-foreground border",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500",
                    "hover:border-blue-600 transition-colors",
                    "border-l-blue-400 border-t-purple-400 border-r-pink-400 border-b-teal-400",
                    "shadow-lg shadow-blue-900/10"
                  )}
                >
                  <option value="">Select a GA4 Property</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.displayName} ({property.id.replace('properties/','')})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (!selectedProperty?.id) {
                      toast.error('Please select a GA4 property first');
                      return;
                    }
                    if (!analyticsData) {
                      toast.error('No analytics data available to generate a report');
                      return;
                    }
                    const testRecipients = emailSettings.testRecipients.split(',').map(email => email.trim()).filter(Boolean);
                    if (testRecipients.length === 0) {
                      toast.error('Please configure test recipients in Email Settings');
                      return;
                    }
                    const selectedIndex = properties.findIndex(p => p.id === selectedProperty.id);
                    const propertyFromArray = selectedIndex >= 0 ? properties[selectedIndex] : null;
                    console.log('Sending test report with property:', {
                      selectedProperty: selectedProperty,
                      propertyFromArray: propertyFromArray,
                      displayNameFromSelected: selectedProperty.displayName,
                      displayNameFromArray: propertyFromArray?.displayName,
                      selectedPropertyKeys: Object.keys(selectedProperty),
                      propertyFromArrayKeys: propertyFromArray ? Object.keys(propertyFromArray) : [],
                      propertiesCount: properties.length,
                      selectedIndex: selectedIndex
                    });
                    fetch('/api/analytics/send-report', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                      },
                      body: JSON.stringify({
                        propertyId: selectedProperty.id,
                        propertyName: selectedProperty.displayName || 
                                     propertyFromArray?.displayName ||
                                     (selectedProperty.id ? `Property ${selectedProperty.id.replace('properties/', '')}` : 'Unknown Property'),
                        recipients: testRecipients,
                        analyticsData: analyticsData,
                        isTest: true,
                        dateRange: dateRange
                      }),
                    })
                    .then(response => response.json())
                    .then(data => {
                      if (data.success) toast.success('Test report sent successfully');
                      else throw new Error(data.error || 'Failed to send test report');
                    })
                    .catch(error => {
                      console.error('Error sending test report:', error);
                      toast.error('Failed to send test report: ' + error.message);
                    });
                  }}
                  disabled={!selectedProperty || !analyticsData}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                    "bg-gradient-to-r from-blue-600 to-indigo-600 text-foreground hover:from-blue-500 hover:to-indigo-500 transition-colors",
                    "border border-blue-700 shadow-md shadow-blue-900/20",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Mail className="h-4 w-4" />
                  Send Test Report
                </button>
                <button
                  onClick={() => {
                    if (!selectedProperty?.id) {
                      toast.error('Please select a GA4 property first');
                      return;
                    }
                    if (!analyticsData) {
                      toast.error('No analytics data available to generate a report');
                      return;
                    }
                    const manualRecipients = emailSettings.manualRecipients.split(',').map(email => email.trim()).filter(Boolean);
                    if (manualRecipients.length === 0) {
                      toast.error('Please configure manual report recipients in Email Settings');
                      return;
                    }
                    const selectedIndex = properties.findIndex(p => p.id === selectedProperty.id);
                    const propertyFromArray = selectedIndex >= 0 ? properties[selectedIndex] : null;
                    fetch('/api/analytics/send-report', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                      },
                      body: JSON.stringify({
                        propertyId: selectedProperty.id,
                        propertyName: selectedProperty.displayName || 
                                     propertyFromArray?.displayName ||
                                     (selectedProperty.id ? `Property ${selectedProperty.id.replace('properties/', '')}` : 'Unknown Property'),
                        recipients: manualRecipients,
                        analyticsData: analyticsData,
                        isTest: false,
                        dateRange: dateRange
                      }),
                    })
                    .then(response => response.json())
                    .then(data => {
                      if (data.success) toast.success('Report sent successfully');
                      else throw new Error(data.error || 'Failed to send report');
                    })
                    .catch(error => {
                      console.error('Error sending report:', error);
                      toast.error('Failed to send report: ' + error.message);
                    });
                  }}
                  disabled={!selectedProperty || !analyticsData}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                    "bg-gradient-to-r from-emerald-600 to-teal-600 text-foreground hover:from-emerald-500 hover:to-teal-500 transition-colors",
                    "border border-emerald-700 shadow-md shadow-emerald-900/20",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Mail className="h-4 w-4" />
                  Send Report Now
                </button>
                <button
                  onClick={handleShowEmailSettings}
                  disabled={!selectedProperty}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                    "bg-gradient-to-r from-purple-600 to-violet-600 text-foreground hover:from-purple-500 hover:to-violet-500 transition-colors",
                    "border border-purple-700 shadow-md shadow-purple-900/20",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Settings2 className="h-4 w-4" />
                  Email Settings
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>No GA4 properties found for this account.</span>
              </div>
            )}
            <button
              onClick={handleRefresh}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                "bg-gradient-to-r from-rose-600 to-orange-600 text-foreground hover:from-rose-500 hover:to-orange-500 transition-colors",
                "border border-rose-700 shadow-md shadow-orange-900/20",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              disabled={isRefreshing || gaPropertiesLoading || loading}
            >
              <RefreshCw className={cn("h-4 w-4", { "animate-spin": isRefreshing || gaPropertiesLoading || loading })} />
              Refresh
            </button>
          </div>
        </div>

        {showEmailSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-8 rounded-lg w-full max-w-md border border-border">
              <h2 className="text-xl font-semibold text-foreground mb-6">Email Report Settings</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block mb-2 text-sm font-medium text-foreground">Test Report Recipients</label>
                  <input
                    type="text"
                    value={emailSettings.testRecipients}
                    onChange={(e) => setEmailSettings(prev => ({ ...prev, testRecipients: e.target.value }))}
                    className="w-full p-3 rounded-md bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground"
                    placeholder="email@example.com, another@example.com"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Recipients for test reports when using "Send Test Report"</p>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-foreground">Manual Report Recipients</label>
                  <input
                    type="text"
                    value={emailSettings.manualRecipients}
                    onChange={(e) => setEmailSettings(prev => ({ ...prev, manualRecipients: e.target.value }))}
                    className="w-full p-3 rounded-md bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground"
                    placeholder="email@example.com, another@example.com"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Recipients for manual reports when using "Send Report Now"</p>
                </div>

                <div className="p-4 bg-background rounded-md border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Switch
                        checked={emailSettings.enabled}
                        onCheckedChange={(checked: boolean) => setEmailSettings(prev => ({ ...prev, enabled: checked }))}
                        className="data-[state=checked]:bg-blue-600"
                      />
                      <div>
                        <label className="text-foreground text-sm font-medium">Enable Weekly Reports</label>
                        <p className="text-xs text-muted-foreground">Turn on to schedule automated weekly reports</p>
                      </div>
                    </div>
                  </div>
                </div>

                {emailSettings.enabled && (
                  <>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-foreground">Weekly Report Recipients</label>
                      <input
                        type="text"
                        value={emailSettings.weeklyRecipients}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, weeklyRecipients: e.target.value }))}
                        className="w-full p-3 rounded-md bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground"
                        placeholder="email@example.com, another@example.com"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Recipients for automated weekly reports</p>
                    </div>

                    <div>
                      <label className="block mb-2 text-sm font-medium text-foreground">Send Day</label>
                      <select
                        value={emailSettings.sendDay}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, sendDay: e.target.value }))}
                        className="w-full p-3 rounded-md bg-background border border-border text-foreground text-sm"
                      >
                        <option value="monday">Monday</option>
                        <option value="tuesday">Tuesday</option>
                        <option value="wednesday">Wednesday</option>
                        <option value="thursday">Thursday</option>
                        <option value="friday">Friday</option>
                        <option value="saturday">Saturday</option>
                        <option value="sunday">Sunday</option>
                      </select>
                    </div>

                    <div>
                      <label className="block mb-2 text-sm font-medium text-foreground">Send Time</label>
                      <input
                        type="time"
                        value={emailSettings.sendTime}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, sendTime: e.target.value }))}
                        className="w-full p-3 rounded-md bg-background border border-border text-foreground text-sm"
                      />
                    </div>

                    {cronJobs.length > 0 && (
                      <div className="pt-4 border-t border-border">
                        <h3 className="text-sm font-medium text-foreground mb-3">Current Schedule</h3>
                        {cronJobs.map((job) => (
                          <div key={job.id} className="p-3 rounded-md bg-background border border-border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-foreground">Weekly Report</span>
                              <span className={cn(
                                "text-xs px-2 py-1 rounded-full",
                                job.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-200 dark:bg-muted text-muted-foreground'
                              )}>
                                {job.status}
                              </span>
                            </div>
                            <div className="text-xs space-y-1 text-muted-foreground">
                              <p>Every {job.settings.send_day} at {job.settings.send_time}</p>
                              <p>Next run: {new Date(job.next_run).toLocaleString()}</p>
                              <p>Recipients: {job.settings.recipients.join(', ')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => setShowEmailSettings(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-background text-foreground hover:bg-gray-200 dark:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEmailSettings}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-foreground hover:bg-blue-500 transition-colors"
                >
                  Save Schedule
                </button>
              </div>
            </div>
          </div>
        )}

        {gaPropertiesLoading && !properties.length ? (
          <div className="flex items-center justify-center h-64">
          </div>
        ) : !selectedProperty && properties.length > 0 && !gaPropertiesError ? (
          <Card className="bg-background border-border overflow-hidden">
            <div className="p-6 flex flex-col items-center justify-center h-64 bg-muted/50">
              <h2 className="text-lg font-medium text-foreground mb-4">Select a GA4 Property</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Choose a Google Analytics property from the dropdown above to view its analytics data.
              </p>
            </div>
          </Card>
        ) : selectedProperty && loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted-foreground border-t-foreground" />
            <p className="ml-3 text-foreground">Loading analytics data for {selectedProperty.displayName}...</p>
          </div>
        ) : selectedProperty && !loading && !analyticsData && !gaPropertiesError ? (
          <Card className="bg-background border-border overflow-hidden">
            <div className="p-6 flex flex-col items-center justify-center h-64 bg-muted/50">
              <h2 className="text-lg font-medium text-foreground mb-4">No Data Available</h2>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                No analytics data found for "{selectedProperty.displayName}" for the selected date range.
                Ensure the service account has access or try a different date range.
              </p>
            </div>
          </Card>
        ) : analyticsData && selectedProperty && !loading ? (
          <>
            {analyticsData.overview && (
              <Card className="bg-background border-border overflow-hidden">
                <div className="p-6 bg-muted/30">
                  <h2 className="text-lg font-medium text-foreground mb-4">Analytics Overview</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatsCard
                      title="Total Users"
                      value={analyticsData.overview.totalUsers}
                      icon={<Users className="h-4 w-4" />}
                      previousValue={analyticsData.previousPeriod?.totalUsers}
                    />
                    <StatsCard
                      title="Active Users"
                      value={analyticsData.overview.activeUsers}
                      icon={<Users className="h-4 w-4" />}
                      previousValue={analyticsData.previousPeriod?.activeUsers}
                    />
                    <StatsCard
                      title="New Users"
                      value={analyticsData.overview.newUsers}
                      icon={<Users className="h-4 w-4" />}
                      previousValue={analyticsData.previousPeriod?.newUsers}
                    />
                    <StatsCard
                      title="Page Views"
                      value={analyticsData.overview.pageViews}
                      icon={<Eye className="h-4 w-4" />}
                      previousValue={analyticsData.previousPeriod?.pageViews}
                    />
                    <StatsCard
                      title="Sessions"
                      value={analyticsData.overview.sessions}
                      icon={<ArrowUpRight className="h-4 w-4" />}
                      previousValue={analyticsData.previousPeriod?.sessions}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
                    <StatsCard
                      title="Conversions"
                      value={analyticsData.overview.conversions}
                      icon={<Target className="h-4 w-4" />}
                      previousValue={analyticsData.previousPeriod?.conversions}
                    />
                    <StatsCard
                      title="Revenue"
                      value={analyticsData.overview.revenue}
                      icon={<DollarSign className="h-4 w-4" />}
                      previousValue={analyticsData.previousPeriod?.revenue}
                    />
                    <StatsCard
                      title="Bounce Rate"
                      value={analyticsData.overview.bounceRate}
                      icon={<ArrowDownRight className="h-4 w-4" />}
                      previousValue={analyticsData.previousPeriod?.bounceRate}
                    />
                    <StatsCard
                      title="Engagement Rate"
                      value={analyticsData.overview.engagementRate}
                      icon={<Activity className="h-4 w-4" />}
                      previousValue={analyticsData.previousPeriod?.engagementRate}
                    />
                    <StatsCard
                      title="Avg Duration"
                      value={analyticsData.overview.avgSessionDuration}
                      icon={<Clock className="h-4 w-4" />}
                      previousValue={analyticsData.previousPeriod?.avgSessionDuration}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <Card className="bg-background border-border overflow-hidden shadow-xl">
                      <div className="p-6 bg-muted/30">
                        <h3 className="text-lg font-medium text-foreground mb-2">User Trends</h3>
                        {analyticsData.previousPeriod && (
                          <div className="flex items-center gap-2 mb-4">
                            <p className="text-xs text-muted-foreground">Comparing to previous period:</p>
                            <span className="text-xs px-2 py-1 rounded-full bg-background">
                              {analyticsData.previousPeriod.dateRange.start} to {analyticsData.previousPeriod.dateRange.end}
                            </span>
                          </div>
                        )}
                        <div className="h-[300px]">
                          {analyticsData.byDate && analyticsData.byDate.length > 0 && (
                            <Line
                              data={{
                                labels: analyticsData.byDate.map(d => new Date(d.date).toLocaleDateString()),
                                datasets: [
                                  {
                                    label: 'Total Users',
                                    data: analyticsData.byDate.map(d => d.totalUsers),
                                    borderColor: 'hsl(var(--chart-1))',
                                    backgroundColor: 'hsla(var(--chart-1), 0.2)',
                                    borderWidth: 3,
                                    tension: 0.4,
                                    fill: true
                                  },
                                  {
                                    label: 'Active Users',
                                    data: analyticsData.byDate.map(d => d.activeUsers),
                                    borderColor: 'hsl(var(--chart-3))',
                                    backgroundColor: 'hsla(var(--chart-3), 0.2)',
                                    borderWidth: 3,
                                    tension: 0.4,
                                    fill: true
                                  },
                                  {
                                    label: 'New Users',
                                    data: analyticsData.byDate.map(d => d.newUsers),
                                    borderColor: 'hsl(var(--chart-6))',
                                    backgroundColor: 'hsla(var(--chart-6), 0.2)',
                                    borderWidth: 3,
                                    tension: 0.4,
                                    fill: true
                                  },
                                  ...(analyticsData.byDatePrevious && analyticsData.byDatePrevious.length > 0 ? [
                                    {
                                      label: 'Previous Total Users',
                                      data: analyticsData.byDatePrevious.map(d => d.totalUsers),
                                      borderColor: 'hsla(var(--chart-1), 0.6)',
                                      backgroundColor: 'transparent',
                                      borderDash: [5, 5],
                                      borderWidth: 2,
                                      tension: 0.4,
                                      fill: false
                                    },
                                    {
                                      label: 'Previous Active Users',
                                      data: analyticsData.byDatePrevious.map(d => d.activeUsers),
                                      borderColor: 'hsla(var(--chart-3), 0.6)',
                                      backgroundColor: 'transparent',
                                      borderDash: [5, 5],
                                      borderWidth: 2,
                                      tension: 0.4,
                                      fill: false
                                    },
                                    {
                                      label: 'Previous New Users',
                                      data: analyticsData.byDatePrevious.map(d => d.newUsers),
                                      borderColor: 'hsla(var(--chart-6), 0.6)',
                                      backgroundColor: 'transparent',
                                      borderDash: [5, 5],
                                      borderWidth: 2,
                                      tension: 0.4,
                                      fill: false
                                    }
                                  ] : [])
                                ]
                              }}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    position: 'top' as const,
                                    labels: {
                                      color: 'rgb(220 220 220)',
                                      padding: 20,
                                      font: {
                                        size: 12,
                                        weight: 'bold'
                                      },
                                      usePointStyle: true,
                                      pointStyle: 'circle'
                                    }
                                  },
                                  tooltip: {
                                    callbacks: {
                                      title: function(tooltipItems) {
                                        return tooltipItems[0].label;
                                      },
                                      label: function(context) {
                                        const label = context.dataset.label || '';
                                        const value = context.parsed.y || 0;
                                        return `${label}: ${new Intl.NumberFormat().format(value)}`;
                                      }
                                    },
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                    titleColor: 'rgb(220, 220, 220)',
                                    bodyColor: 'rgb(220, 220, 220)',
                                    borderColor: 'rgba(255, 255, 255, 0.2)',
                                    borderWidth: 1
                                  }
                                },
                                scales: {
                                  x: {
                                    grid: {
                                      color: 'hsla(var(--chart-grid), 0.3)'
                                    },
                                    ticks: {
                                      color: 'rgb(200, 200, 200)',
                                      maxRotation: 45,
                                      minRotation: 45
                                    }
                                  },
                                  y: {
                                    grid: {
                                      color: 'hsla(var(--chart-grid), 0.3)'
                                    },
                                    ticks: {
                                      color: 'rgb(200, 200, 200)',
                                      callback: (value) => {
                                        if (typeof value === 'number') {
                                          return new Intl.NumberFormat().format(value);
                                        }
                                        return value;
                                      }
                                    }
                                  }
                                }
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-background border-border overflow-hidden shadow-xl">
                      <div className="p-6 bg-muted/30">
                        <h3 className="text-lg font-bold text-foreground mb-4 shadow-sm text-shadow-sm">Device Distribution</h3>
                        <div className="h-[300px] flex items-center justify-center">
                          {analyticsData.byDevice && Object.keys(analyticsData.byDevice).length > 0 && (
                            <div style={{ width: '85%', height: '100%' }}>
                              <Pie
                                data={{
                                  labels: Object.keys(analyticsData.byDevice).map(device => 
                                    device.charAt(0).toUpperCase() + device.slice(1)
                                  ),
                                  datasets: [{
                                    data: Object.values(analyticsData.byDevice).map(stats => stats.users),
                                    backgroundColor: [
                                      'rgba(0, 204, 255, 0.95)',    // Electric blue
                                      'rgba(255, 64, 87, 0.95)',    // Hot pink/red
                                      'rgba(113, 255, 78, 0.95)',   // Neon green
                                      'rgba(255, 215, 0, 0.95)',    // Gold
                                      'rgba(211, 92, 255, 0.95)'    // Bright violet
                                    ],
                                    borderColor: [
                                      'rgba(255, 255, 255, 1)',     // White borders for all segments
                                      'rgba(255, 255, 255, 1)',
                                      'rgba(255, 255, 255, 1)',
                                      'rgba(255, 255, 255, 1)',
                                      'rgba(255, 255, 255, 1)'
                                    ],
                                    borderWidth: 3,                 // Thicker borders
                                    hoverBorderWidth: 5,
                                    hoverBorderColor: '#ffffff'
                                  }]
                                }}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: {
                                      position: 'bottom' as const,
                                      labels: {
                                        color: 'rgb(255, 255, 255)',  // White text
                                        padding: 20,
                                        font: {
                                          size: 14,                   // Larger font
                                          weight: 'bold'
                                        },
                                        usePointStyle: true,
                                        pointStyle: 'rectRounded',    // More visible style
                                        boxWidth: 15,                 // Larger legend items
                                        boxHeight: 15
                                      }
                                    },
                                    tooltip: {
                                      backgroundColor: 'rgba(20, 20, 20, 0.9)',
                                      titleColor: 'rgb(255, 255, 255)',
                                      bodyColor: 'rgb(255, 255, 255)',
                                      borderColor: 'rgba(255, 255, 255, 0.5)',
                                      borderWidth: 2,
                                      padding: 12,
                                      boxWidth: 12,
                                      boxHeight: 12,
                                      bodyFont: {
                                        size: 14,
                                        weight: 'bold'
                                      },
                                      callbacks: {
                                        label: (context) => {
                                          const value = context.raw as number;
                                          const percentage = context.parsed !== undefined ? 
                                            (context.parsed * 100).toFixed(1) + '%' : 
                                            '';
                                          return `${context.label}: ${new Intl.NumberFormat().format(value)} (${percentage})`;
                                        }
                                      }
                                    }
                                  },
                                  cutout: '50%',                     // Smaller hole = larger segments
                                  radius: '90%',                     // Larger overall pie
                                  rotation: 0.5 * Math.PI,           // Starts from the top
                                  animation: {
                                    animateScale: true,              // Animate scale on hover
                                    animateRotate: true              // Animate rotation on hover
                                  }
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-background border-border overflow-hidden shadow-xl lg:col-span-2">
                      <div className="p-6 bg-muted/30">
                        <h3 className="text-lg font-bold text-foreground mb-4 shadow-sm text-shadow-sm">Traffic by Source</h3>
                        <div className="h-[300px]">
                          {analyticsData.bySource && Object.keys(analyticsData.bySource).length > 0 && (
                            <Bar
                              data={{
                                labels: Object.keys(analyticsData.bySource).map(source => 
                                  source.charAt(0).toUpperCase() + source.slice(1)
                                ),
                                datasets: [{
                                  label: 'Sessions',
                                  data: Object.values(analyticsData.bySource).map((source: any) => source.sessions || 0),
                                  backgroundColor: [
                                    'rgba(0, 224, 255, 0.95)',    // Electric blue
                                    'rgba(255, 69, 87, 0.95)',    // Hot pink
                                    'rgba(123, 255, 90, 0.95)',   // Neon green
                                    'rgba(255, 230, 20, 0.95)',   // Bright yellow
                                    'rgba(221, 102, 255, 0.95)',  // Bright purple
                                    'rgba(255, 138, 20, 0.95)',   // Bright orange
                                    'rgba(10, 230, 200, 0.95)',   // Bright teal
                                    'rgba(255, 130, 210, 0.95)',  // Bright pink
                                    'rgba(90, 160, 255, 0.95)',   // Sky blue
                                    'rgba(200, 255, 70, 0.95)'    // Lime
                                  ],
                                  borderColor: [
                                    'rgba(255, 255, 255, 1)',     // White borders for all bars
                                    'rgba(255, 255, 255, 1)',
                                    'rgba(255, 255, 255, 1)',
                                    'rgba(255, 255, 255, 1)',
                                    'rgba(255, 255, 255, 1)',
                                    'rgba(255, 255, 255, 1)',
                                    'rgba(255, 255, 255, 1)',
                                    'rgba(255, 255, 255, 1)',
                                    'rgba(255, 255, 255, 1)',
                                    'rgba(255, 255, 255, 1)'
                                  ],
                                  borderRadius: 6,               // More rounded corners
                                  borderWidth: 3,                // Thicker borders
                                  hoverBorderWidth: 4,
                                  maxBarThickness: 60,           // Thicker bars
                                  hoverBackgroundColor: [       // Brighter colors on hover
                                    'rgba(40, 234, 255, 1)',
                                    'rgba(255, 89, 107, 1)',
                                    'rgba(143, 255, 110, 1)',
                                    'rgba(255, 240, 40, 1)',
                                    'rgba(231, 122, 255, 1)',
                                    'rgba(255, 158, 40, 1)',
                                    'rgba(30, 250, 220, 1)',
                                    'rgba(255, 150, 230, 1)',
                                    'rgba(110, 180, 255, 1)',
                                    'rgba(220, 255, 90, 1)'
                                  ]
                                }]
                              }}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    display: false
                                  },
                                  tooltip: {
                                    callbacks: {
                                      label: (context) => {
                                        const value = context.parsed.y;
                                        return `Sessions: ${new Intl.NumberFormat().format(value)}`;
                                      }
                                    },
                                    backgroundColor: 'rgba(20, 20, 20, 0.95)',
                                    titleColor: 'rgb(255, 255, 255)',
                                    bodyColor: 'rgb(255, 255, 255)',
                                    borderColor: 'rgba(255, 255, 255, 0.5)',
                                    borderWidth: 2,
                                    padding: 12,
                                    bodyFont: {
                                      size: 14,
                                      weight: 'bold'
                                    },
                                    titleFont: {
                                      size: 16,
                                      weight: 'bold'
                                    }
                                  }
                                },
                                scales: {
                                  x: {
                                    grid: {
                                      display: false
                                    },
                                    border: {
                                      display: true,
                                      color: 'rgba(255, 255, 255, 0.5)',
                                      width: 2
                                    },
                                    ticks: {
                                      color: 'rgb(255, 255, 255)',
                                      font: {
                                        size: 13,
                                        weight: 'bold'
                                      },
                                      maxRotation: 45,
                                      minRotation: 45,
                                      padding: 10
                                    }
                                  },
                                  y: {
                                    grid: {
                                      color: 'rgba(255, 255, 255, 0.2)',
                                      lineWidth: 1
                                    },
                                    border: {
                                      display: true,
                                      color: 'rgba(255, 255, 255, 0.5)',
                                      width: 2
                                    },
                                    ticks: {
                                      color: 'rgb(255, 255, 255)',
                                      font: {
                                        size: 13,
                                        weight: 'bold'
                                      },
                                      padding: 10,
                                      callback: (value) => {
                                        if (typeof value === 'number') {
                                          return new Intl.NumberFormat().format(value);
                                        }
                                        return value;
                                      }
                                    },
                                    beginAtZero: true // Always start y-axis from zero
                                    }
                                },
                                animation: {
                                  duration: 1000,
                                  easing: 'easeOutQuart'
                                },
                                hover: {
                                  mode: 'index',
                                  intersect: false
                                }
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </Card>
            )}

            {analyticsData?.overview?.conversionEvents && analyticsData.overview.conversionEvents.length > 0 && (
              <Card className="bg-background border-border overflow-hidden shadow-xl">
                <div className="p-6 bg-muted/30">
                  <h2 className="text-lg font-medium text-foreground mb-4">Conversion Details</h2>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-card border border-border shadow-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <Target className="h-4 w-4" />
                          <span>Total Conversions</span>
                        </div>
                        <div className="text-2xl font-semibold text-foreground">
                          {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(analyticsData.overview.conversions)}
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-card border border-border shadow-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <Activity className="h-4 w-4" />
                          <span>Conversion Rate</span>
                        </div>
                        <div className="text-2xl font-semibold text-foreground">
                          {analyticsData.overview.conversionRate.toFixed(2)}%
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-card border border-border shadow-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <DollarSign className="h-4 w-4" />
                          <span>Total Revenue</span>
                        </div>
                        <div className="text-2xl font-semibold text-foreground">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(analyticsData.overview.revenue)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-md font-medium text-foreground">Conversion Events</h3>
                      {analyticsData.overview.conversionEvents.map((event) => (
                        <div key={event.name} className="p-4 rounded-lg bg-card border border-border shadow-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-blue-400" />
                              <span className="text-foreground font-medium">{event.name}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-sm text-muted-foreground">
                                <span className="text-foreground font-medium">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(event.count)}</span> conversions
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <span className="text-foreground font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(event.value)}</span> value
                              </div>
                            </div>
                          </div>

                          {analyticsData.byConversion && analyticsData.byConversion[event.name] && (
                            <div className="mt-4 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground mb-2">By Device</h4>
                                  <div className="space-y-2">
                                    {Object.entries(analyticsData.byConversion[event.name].byDevice).map(([device, stats]) => (
                                      <div key={device} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                          {getDeviceIcon(device)}
                                          <span className="text-foreground capitalize">{device}</span>
                                        </div>
                                        <div className="text-muted-foreground">
                                          <span className="text-foreground font-medium">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(stats.count)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-muted-foreground mb-2">By Source</h4>
                                  <div className="space-y-2">
                                    {Object.entries(analyticsData.byConversion[event.name].bySource)
                                      .sort(([, aStats], [, bStats]) => bStats.count - aStats.count)
                                      .slice(0, 5)
                                      .map(([source, sourceStats]) => (
                                        <div key={source} className="flex items-center justify-between text-sm">
                                          <span className="text-foreground">{source || '(direct)'}</span>
                                          <div className="text-muted-foreground">
                                            <span className="text-foreground font-medium">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(sourceStats.count)}</span>
                                          </div>
                                        </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {analyticsData.byDevice && (
              <Card className="bg-background border-border overflow-hidden shadow-xl">
                <div className="p-6 bg-muted/30">
                  <h2 className="text-lg font-medium text-foreground mb-4">Device Breakdown</h2>
                  <div className="space-y-4">
                    {(Object.entries(analyticsData.byDevice) as [string, DeviceStats][]).map(([device, stats]) => (
                      <div key={device} className="flex items-center justify-between p-4 rounded-lg bg-card border border-border shadow-lg">
                        <div className="flex items-center gap-3">
                          {getDeviceIcon(device)}
                          <span className="text-foreground capitalize">{device}</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-sm text-muted-foreground">
                            <span className="text-foreground font-medium">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(stats.sessions)}</span> sessions
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="text-foreground font-medium">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(stats.pageViews)}</span> views
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="text-foreground font-medium">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(stats.conversions || 0)}</span> conversions
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </>
        ) : (
          !gaPropertiesError && !gaPropertiesLoading && properties.length === 0 && (
             <Card className="bg-background border-border overflow-hidden">
              <div className="p-6 flex flex-col items-center justify-center h-64 bg-muted/50">
                <h2 className="text-lg font-medium text-foreground mb-4">No GA4 Properties Found</h2>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  The service account does not have access to any Google Analytics 4 properties, or none were found.
                  Please check the service account permissions and configuration.
                </p>
              </div>
            </Card>
          )
        )}
      </div>
    </SidebarDemo>
  );
} 