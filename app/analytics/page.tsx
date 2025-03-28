"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
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
  Settings2
} from "lucide-react"

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
  properties: Array<{ id: string; name: string }>;
  timestamp: number;
  expiresAt: number;
  selectedProperty: { id: string; name: string } | null;
  user_id: string;
}

const StatsCard = ({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) => {
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

  return (
    <div className="p-4 rounded-lg bg-neutral-800/50">
      <div className="flex items-center gap-2 text-neutral-400 mb-2">
        {icon}
        <span>{title}</span>
      </div>
      <div className="text-2xl font-semibold text-white">
        {formatValue(title, value)}
      </div>
    </div>
  );
};

const getDeviceIcon = (device: string) => {
  switch (device.toLowerCase()) {
    case 'desktop':
      return <Monitor className="h-4 w-4 text-blue-500" />;
    case 'mobile':
      return <Smartphone className="h-4 w-4 text-green-500" />;
    case 'tablet':
      return <Tablet className="h-4 w-4 text-purple-500" />;
    default:
      return <Laptop className="h-4 w-4 text-neutral-500" />;
  }
};

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProperty, setSelectedProperty] = useState<{ id: string; name: string } | null>(null);
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

  // Remove the separate useEffect for cron jobs and consolidate into one main effect
  useEffect(() => {
    if (session?.user?.id) {
      console.log('[Analytics] Initial load or session changed');
      loadData();
    }
  }, [session?.user?.id]); // Only depend on session

  const getCacheKey = () => {
    return `analytics_cache_${session?.user?.id}`;
  };

  const getCachedData = (): CachedData | null => {
    if (typeof window === 'undefined') return null;
    
    const cached = localStorage.getItem(getCacheKey());
    if (!cached) return null;

    const data = JSON.parse(cached);
    if (Date.now() > data.expiresAt || data.user_id !== session?.user?.id) {
      localStorage.removeItem(getCacheKey());
      return null;
    }

    // Convert selectedProperty from string to object if needed
    if (data.selectedProperty && typeof data.selectedProperty === 'string') {
      const property = data.properties.find((p: { id: string; name: string }) => p.id === data.selectedProperty);
      data.selectedProperty = property || null;
    }

    return data;
  };

  const setCachedData = (data: Partial<CachedData>) => {
    if (typeof window === 'undefined' || !session?.user?.id) return;

    const cacheData = {
      ...data,
      timestamp: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
      user_id: session.user.id
    };

    localStorage.setItem(getCacheKey(), JSON.stringify(cacheData));
  };

  const loadData = async (forceRefresh = false) => {
    if (!session?.user?.id) {
      console.error('No user session found for analytics data');
      toast.error('User authentication required');
      setLoading(false);
      return;
    }

    if (!forceRefresh) {
      const cachedData = getCachedData();
      if (cachedData) {
        setAnalyticsData(cachedData.analyticsData);
        setProperties(cachedData.properties);
        setSelectedProperty(cachedData.selectedProperty);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: dateRange, // This will be handled by the API's getDateRange function
          endDate: 'today',
          propertyId: selectedProperty?.id
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401) {
          localStorage.removeItem(getCacheKey());
          toast.error('Authentication required. Please reconnect Google Analytics in Settings.');
        }
        throw new Error(data.error || 'Failed to fetch analytics data');
      }

      const data = await response.json();
      
      if (data.properties && Array.isArray(data.properties)) {
        setProperties(data.properties);
      } else {
        setProperties([]);
      }

      if (data.analytics) {
        setAnalyticsData(data.analytics);
        setCachedData({
          analyticsData: data.analytics,
          properties: data.properties || [],
          selectedProperty: selectedProperty
        });
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

  // Add logging for render phase
  console.log('[Analytics] Render state:', {
    loading,
    isRefreshing,
    hasAnalyticsData: !!analyticsData,
    selectedProperty,
    propertiesCount: properties.length,
    analyticsOverview: analyticsData?.overview
  });

  // Debug device data
  if (analyticsData?.byDevice) {
    console.log('[Analytics] Device data:', {
      devices: Object.keys(analyticsData.byDevice),
      sampleDevice: analyticsData.byDevice[Object.keys(analyticsData.byDevice)[0]],
      allDeviceData: analyticsData.byDevice
    });
    
    // Loop through each device to check conversions specifically
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

  // Update handleShowEmailSettings to handle all loading
  const handleShowEmailSettings = async () => {
    try {
      if (!selectedProperty?.id) {
        toast.error('Please select a property first');
        return;
      }

      // Load email settings and cron jobs in parallel
      const [settingsResponse, cronResponse] = await Promise.all([
        fetch(`/api/analytics/email-settings?propertyId=${selectedProperty.id}`),
        fetch(`/api/analytics/cron-jobs?propertyId=${selectedProperty.id}`)
      ]);

      const [settingsData, cronData] = await Promise.all([
        settingsResponse.json(),
        cronResponse.json()
      ]);

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

  // Update handleSaveEmailSettings
  const handleSaveEmailSettings = async () => {
    try {
      if (!selectedProperty?.id) {
        toast.error('Please select a property first');
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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      // Fetch updated cron jobs
      const cronResponse = await fetch(`/api/analytics/cron-jobs?propertyId=${selectedProperty.id}`);
      if (!cronResponse.ok) {
        throw new Error('Failed to fetch updated cron jobs');
      }
      const cronData = await cronResponse.json();
      setCronJobs(cronData.jobs || []);

      toast.success('Email schedule saved successfully');
      setShowEmailSettings(false);
    } catch (error) {
      console.error('Error saving email settings:', error);
      toast.error('Failed to save email settings');
    }
  };

  // Add helper function to calculate next run time
  const calculateNextRunTime = (sendDay: string, sendTime: string) => {
    const [hours, minutes] = sendTime.split(':').map(Number);
    const now = new Date();
    const nextRun = new Date();
    
    // Set the time
    nextRun.setHours(hours, minutes, 0, 0);

    // Find the next occurrence of the specified day
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

  // Update property selection handler to not trigger loadData automatically
  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const propertyId = e.target.value;
    const selectedProp = properties.find((p: { id: string; name: string }) => p.id === propertyId);
    setSelectedProperty(selectedProp || null);
  };

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
          <div className="flex items-center gap-4">
            {properties.length > 0 ? (
              <>
                <select
                  value={dateRange}
                  onChange={(e) => {
                    setDateRange(e.target.value);
                    loadData(true); // Reload data when date range changes
                  }}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium",
                    "bg-neutral-800 text-white border border-neutral-700",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-600"
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
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium min-w-[200px]",
                    "bg-neutral-800 text-white border border-neutral-700",
                    "focus:outline-none focus:ring-2 focus:ring-neutral-600"
                  )}
                >
                  <option value="">Select a property</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (!selectedProperty?.id) {
                      toast.error('Please select a property first');
                      return;
                    }
                    if (!analyticsData) {
                      toast.error('No analytics data available');
                      return;
                    }

                    const testRecipients = emailSettings.testRecipients.split(',').map(email => email.trim()).filter(Boolean);
                    if (testRecipients.length === 0) {
                      toast.error('Please configure test recipients in Email Settings');
                      return;
                    }

                    fetch('/api/analytics/send-report', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        propertyId: selectedProperty.id,
                        recipients: testRecipients,
                        analyticsData: analyticsData,
                        isTest: true,
                        dateRange: dateRange
                      }),
                    })
                    .then(response => response.json())
                    .then(data => {
                      if (data.success) {
                        toast.success('Test report sent successfully');
                      } else {
                        throw new Error(data.error || 'Failed to send test report');
                      }
                    })
                    .catch(error => {
                      console.error('Error sending test report:', error);
                      toast.error('Failed to send test report');
                    });
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                    "bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                  )}
                >
                  <Mail className="h-4 w-4" />
                  Send Test Report
                </button>
                <button
                  onClick={() => {
                    if (!selectedProperty?.id) {
                      toast.error('Please select a property first');
                      return;
                    }
                    if (!analyticsData) {
                      toast.error('No analytics data available');
                      return;
                    }

                    const manualRecipients = emailSettings.manualRecipients.split(',').map(email => email.trim()).filter(Boolean);
                    if (manualRecipients.length === 0) {
                      toast.error('Please configure manual report recipients in Email Settings');
                      return;
                    }

                    fetch('/api/analytics/send-report', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        propertyId: selectedProperty.id,
                        recipients: manualRecipients,
                        analyticsData: analyticsData,
                        isTest: false,
                        dateRange: dateRange
                      }),
                    })
                    .then(response => response.json())
                    .then(data => {
                      if (data.success) {
                        toast.success('Report sent successfully');
                      } else {
                        throw new Error(data.error || 'Failed to send report');
                      }
                    })
                    .catch(error => {
                      console.error('Error sending report:', error);
                      toast.error('Failed to send report');
                    });
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                    "bg-green-600 text-white hover:bg-green-500 transition-colors"
                  )}
                >
                  <Mail className="h-4 w-4" />
                  Send Report Now
                </button>
                <button
                  onClick={handleShowEmailSettings}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                    "bg-neutral-800 text-white hover:bg-neutral-700 transition-colors"
                  )}
                >
                  <Settings2 className="h-4 w-4" />
                  Email Settings
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-neutral-400">
                <span>No properties found</span>
                <a 
                  href="/settings"
                  className="text-blue-500 hover:text-blue-400 underline"
                >
                  Connect Google Analytics
                </a>
              </div>
            )}
            <button
              onClick={handleRefresh}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                "bg-neutral-800 text-white hover:bg-neutral-700 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", { "animate-spin": isRefreshing })} />
              Refresh
            </button>
          </div>
        </div>

        {/* Email Settings Modal */}
        {showEmailSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-neutral-900 p-8 rounded-lg w-full max-w-md border border-neutral-800">
              <h2 className="text-xl font-semibold text-white mb-6">Email Report Settings</h2>
              
              <div className="space-y-6">
                {/* Test Report Recipients */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-neutral-200">Test Report Recipients</label>
                  <input
                    type="text"
                    value={emailSettings.testRecipients}
                    onChange={(e) => setEmailSettings(prev => ({ ...prev, testRecipients: e.target.value }))}
                    className="w-full p-3 rounded-md bg-neutral-800 border border-neutral-700 text-white text-sm placeholder:text-neutral-500"
                    placeholder="email@example.com, another@example.com"
                  />
                  <p className="mt-1 text-xs text-neutral-400">Recipients for test reports when using "Send Test Report"</p>
                </div>

                {/* Manual Report Recipients */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-neutral-200">Manual Report Recipients</label>
                  <input
                    type="text"
                    value={emailSettings.manualRecipients}
                    onChange={(e) => setEmailSettings(prev => ({ ...prev, manualRecipients: e.target.value }))}
                    className="w-full p-3 rounded-md bg-neutral-800 border border-neutral-700 text-white text-sm placeholder:text-neutral-500"
                    placeholder="email@example.com, another@example.com"
                  />
                  <p className="mt-1 text-xs text-neutral-400">Recipients for manual reports when using "Send Report Now"</p>
                </div>

                <div className="p-4 bg-neutral-800 rounded-md border border-neutral-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Switch
                        checked={emailSettings.enabled}
                        onCheckedChange={(checked: boolean) => setEmailSettings(prev => ({ ...prev, enabled: checked }))}
                        className="data-[state=checked]:bg-blue-600"
                      />
                      <div>
                        <label className="text-white text-sm font-medium">Enable Weekly Reports</label>
                        <p className="text-xs text-neutral-400">Turn on to schedule automated weekly reports</p>
                      </div>
                    </div>
                  </div>
                </div>

                {emailSettings.enabled && (
                  <>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-neutral-200">Weekly Report Recipients</label>
                      <input
                        type="text"
                        value={emailSettings.weeklyRecipients}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, weeklyRecipients: e.target.value }))}
                        className="w-full p-3 rounded-md bg-neutral-800 border border-neutral-700 text-white text-sm placeholder:text-neutral-500"
                        placeholder="email@example.com, another@example.com"
                      />
                      <p className="mt-1 text-xs text-neutral-400">Recipients for automated weekly reports</p>
                    </div>

                    <div>
                      <label className="block mb-2 text-sm font-medium text-neutral-200">Send Day</label>
                      <select
                        value={emailSettings.sendDay}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, sendDay: e.target.value }))}
                        className="w-full p-3 rounded-md bg-neutral-800 border border-neutral-700 text-white text-sm"
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
                      <label className="block mb-2 text-sm font-medium text-neutral-200">Send Time</label>
                      <input
                        type="time"
                        value={emailSettings.sendTime}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, sendTime: e.target.value }))}
                        className="w-full p-3 rounded-md bg-neutral-800 border border-neutral-700 text-white text-sm"
                      />
                    </div>

                    {cronJobs.length > 0 && (
                      <div className="pt-4 border-t border-neutral-800">
                        <h3 className="text-sm font-medium text-neutral-200 mb-3">Current Schedule</h3>
                        {cronJobs.map((job) => (
                          <div key={job.id} className="p-3 rounded-md bg-neutral-800 border border-neutral-700">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-white">Weekly Report</span>
                              <span className={cn(
                                "text-xs px-2 py-1 rounded-full",
                                job.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-neutral-700 text-neutral-400'
                              )}>
                                {job.status}
                              </span>
                            </div>
                            <div className="text-xs space-y-1 text-neutral-400">
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
                  className="px-4 py-2 text-sm font-medium rounded-md bg-neutral-800 text-white hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEmailSettings}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                >
                  Save Schedule
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-400 border-t-white" />
          </div>
        ) : (
          <>
            {!selectedProperty && (
              <Card className="bg-neutral-900 border-neutral-800">
                <div className="p-6 flex flex-col items-center justify-center h-64">
                  <h2 className="text-lg font-medium text-white mb-4">Select a Property to View Analytics</h2>
                  <p className="text-neutral-400 text-center max-w-md mb-6">
                    Choose a Google Analytics property from the dropdown above to view analytics data.
                  </p>
                </div>
              </Card>
            )}
          
            {analyticsData?.overview && (
              <Card className="bg-neutral-900 border-neutral-800">
                <div className="p-6">
                  <h2 className="text-lg font-medium text-white mb-4">Analytics Overview</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatsCard
                      title="Total Users"
                      value={analyticsData.overview.totalUsers}
                      icon={<Users className="h-4 w-4" />}
                    />
                    <StatsCard
                      title="Active Users"
                      value={analyticsData.overview.activeUsers}
                      icon={<Users className="h-4 w-4" />}
                    />
                    <StatsCard
                      title="New Users"
                      value={analyticsData.overview.newUsers}
                      icon={<Users className="h-4 w-4" />}
                    />
                    <StatsCard
                      title="Page Views"
                      value={analyticsData.overview.pageViews}
                      icon={<Eye className="h-4 w-4" />}
                    />
                    <StatsCard
                      title="Sessions"
                      value={analyticsData.overview.sessions}
                      icon={<ArrowUpRight className="h-4 w-4" />}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
                    <StatsCard
                      title="Conversions"
                      value={analyticsData.overview.conversions}
                      icon={<Target className="h-4 w-4" />}
                    />
                    <StatsCard
                      title="Revenue"
                      value={analyticsData.overview.revenue}
                      icon={<DollarSign className="h-4 w-4" />}
                    />
                    <StatsCard
                      title="Bounce Rate"
                      value={analyticsData.overview.bounceRate}
                      icon={<ArrowDownRight className="h-4 w-4" />}
                    />
                    <StatsCard
                      title="Engagement Rate"
                      value={analyticsData.overview.engagementRate}
                      icon={<Activity className="h-4 w-4" />}
                    />
                    <StatsCard
                      title="Avg Duration"
                      value={analyticsData.overview.avgSessionDuration}
                      icon={<Clock className="h-4 w-4" />}
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Conversion Stats */}
            {analyticsData?.overview?.conversionEvents && analyticsData.overview.conversionEvents.length > 0 && (
              <Card className="bg-neutral-900 border-neutral-800">
                <div className="p-6">
                  <h2 className="text-lg font-medium text-white mb-4">Conversion Details</h2>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-neutral-800/50">
                        <div className="flex items-center gap-2 text-neutral-400 mb-2">
                          <Target className="h-4 w-4" />
                          <span>Total Conversions</span>
                        </div>
                        <div className="text-2xl font-semibold text-white">
                          {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(analyticsData.overview.conversions)}
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-neutral-800/50">
                        <div className="flex items-center gap-2 text-neutral-400 mb-2">
                          <Activity className="h-4 w-4" />
                          <span>Conversion Rate</span>
                        </div>
                        <div className="text-2xl font-semibold text-white">
                          {analyticsData.overview.conversionRate.toFixed(2)}%
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-neutral-800/50">
                        <div className="flex items-center gap-2 text-neutral-400 mb-2">
                          <DollarSign className="h-4 w-4" />
                          <span>Total Revenue</span>
                        </div>
                        <div className="text-2xl font-semibold text-white">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(analyticsData.overview.revenue)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-md font-medium text-white">Conversion Events</h3>
                      {analyticsData.overview.conversionEvents.map((event) => (
                        <div key={event.name} className="p-4 rounded-lg bg-neutral-800/50">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-blue-500" />
                              <span className="text-white font-medium">{event.name}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-sm text-neutral-400">
                                <span className="text-white font-medium">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(event.count)}</span> conversions
                              </div>
                              <div className="text-sm text-neutral-400">
                                <span className="text-white font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(event.value)}</span> value
                              </div>
                            </div>
                          </div>

                          {analyticsData.byConversion[event.name] && (
                            <div className="mt-4 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-sm font-medium text-neutral-400 mb-2">By Device</h4>
                                  <div className="space-y-2">
                                    {Object.entries(analyticsData.byConversion[event.name].byDevice).map(([device, stats]) => (
                                      <div key={device} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                          {getDeviceIcon(device)}
                                          <span className="text-white capitalize">{device}</span>
                                        </div>
                                        <div className="text-neutral-400">
                                          <span className="text-white font-medium">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(stats.count)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-neutral-400 mb-2">By Source</h4>
                                  <div className="space-y-2">
                                    {Object.entries(analyticsData.byConversion[event.name].bySource)
                                      .sort((a, b) => b[1].count - a[1].count)
                                      .slice(0, 5)
                                      .map(([source, stats]) => (
                                        <div key={source} className="flex items-center justify-between text-sm">
                                          <span className="text-white">{source || '(direct)'}</span>
                                          <div className="text-neutral-400">
                                            <span className="text-white font-medium">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(stats.count)}</span>
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

            {/* Device Stats */}
            {analyticsData?.byDevice && (
              <Card className="bg-neutral-900 border-neutral-800">
                <div className="p-6">
                  <h2 className="text-lg font-medium text-white mb-4">Device Breakdown</h2>
                  <div className="space-y-4">
                    {(Object.entries(analyticsData.byDevice) as [string, DeviceStats][]).map(([device, stats]) => (
                      <div key={device} className="flex items-center justify-between p-4 rounded-lg bg-neutral-800/50">
                        <div className="flex items-center gap-3">
                          {getDeviceIcon(device)}
                          <span className="text-white capitalize">{device}</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-sm text-neutral-400">
                            <span className="text-white font-medium">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(stats.sessions)}</span> sessions
                          </div>
                          <div className="text-sm text-neutral-400">
                            <span className="text-white font-medium">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(stats.pageViews)}</span> views
                          </div>
                          <div className="text-sm text-neutral-400">
                            <span className="text-white font-medium">{new Intl.NumberFormat('en-US', { notation: 'compact' }).format(stats.conversions || 0)}</span> conversions
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </SidebarDemo>
  );
} 