'use client';

import React, { useState, useEffect } from 'react';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  TrendingUp,
  MousePointerClick,
  Search,
  Laptop,
  RefreshCw,
  ArrowUpRight,
  Mail,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from 'next-auth/react';
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface Site {
  url: string;
  permissionLevel: string;
}

interface SearchQuery {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: string;
  position: string;
  device: string;
  country: string;
}

interface SearchConsoleData {
  overview: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  topQueries: Array<{
    query: string;
    page: string;
    device: string;
    country: string;
    clicks: number;
    impressions: number;
    ctr: string;
    position: string;
  }>;
  byDevice: {
    [key: string]: {
      clicks: number;
      impressions: number;
    };
  };
  byCountry: {
    [key: string]: {
      clicks: number;
      impressions: number;
    };
  };
}

interface CachedData {
  searchData: {
    overview: {
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    };
    topQueries: SearchQuery[];
    byDevice: Record<string, any>;
    byCountry: Record<string, any>;
  } | null;
  sites: { url: string; permissionLevel: string }[];
  timestamp: number;
  expiresAt: number;
  selectedSite: string | null;
  user_id: string;
}

const CACHE_KEY_PREFIX = 'search_console_cache_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export default function SearchConsolePage() {
  const { data: session } = useSession();
  const [startDate, setStartDate] = useState('7days');
  const [endDate, setEndDate] = useState('today');
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [searchData, setSearchData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  useEffect(() => {
    if (session?.user?.id) {
      loadData();
    }
  }, [session]);

  useEffect(() => {
    console.log('Email settings modal state:', showEmailSettings);
  }, [showEmailSettings]);

  const getCacheKey = () => {
    return `${CACHE_KEY_PREFIX}${session?.user?.id || 'anonymous'}`;
  };

  const getCachedData = (): CachedData | null => {
    try {
      const cached = localStorage.getItem(getCacheKey());
      if (!cached) return null;

      const cachedData: CachedData = JSON.parse(cached);
      const now = Date.now();

      if (now > cachedData.expiresAt) {
        localStorage.removeItem(getCacheKey());
        return null;
      }

      if (cachedData.user_id !== session?.user?.id) {
        localStorage.removeItem(getCacheKey());
        return null;
      }

      return cachedData;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  };

  const setCachedData = (data: Partial<CachedData>) => {
    if (!session?.user?.id) return;
    
    try {
      const existingCache = getCachedData();
      const now = Date.now();
      
      const updatedCache: CachedData = {
        searchData: data.searchData || existingCache?.searchData || null,
        sites: data.sites || existingCache?.sites || [],
        timestamp: now,
        expiresAt: now + CACHE_DURATION,
        selectedSite: data.selectedSite !== undefined ? data.selectedSite : existingCache?.selectedSite || null,
        user_id: session.user.id
      };
      
      localStorage.setItem(getCacheKey(), JSON.stringify(updatedCache));
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  };

  const loadData = async (forceRefresh = false) => {
    if (!session?.user?.id) {
      console.error('No user session found for search console data');
      toast.error('User authentication required');
      setLoading(false);
      return;
    }

    if (!forceRefresh) {
      const cachedData = getCachedData();
      if (cachedData) {
        console.log('Using cached data:', {
          hasSearchData: !!cachedData.searchData,
          sitesCount: cachedData.sites.length,
          selectedSite: cachedData.selectedSite,
          cacheExpiry: new Date(cachedData.expiresAt).toISOString()
        });
        setSearchData(cachedData.searchData);
        setSites(cachedData.sites);
        setSelectedSite(cachedData.selectedSite);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      console.log('Fetching fresh data with params:', {
        startDate,
        endDate,
        siteUrl: selectedSite,
        userId: session.user.id
      });

      const response = await fetch('/api/search-console', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate || '7daysAgo',
          endDate: endDate || 'today',
          siteUrl: selectedSite,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('API error response:', {
          status: response.status,
          statusText: response.statusText,
          data
        });
        if (response.status === 401) {
          localStorage.removeItem(getCacheKey());
        }
        throw new Error(data.error || 'Failed to fetch search console data');
      }

      const data = await response.json();
      console.log('API success response:', {
        hasSearchData: !!data.searchData,
        sitesCount: data.sites?.length || 0,
        errors: data.errors
      });

      // Only update search data if we have a selected site
      if (selectedSite) {
        setSearchData(data.searchData);
      }
      
      // Always update sites list
      setSites(data.sites || []);

      // Update cache with new data
      setCachedData({
        searchData: selectedSite ? data.searchData : null,
        sites: data.sites || [],
        selectedSite
      });

    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error(error.message);
      setSearchData(null);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    localStorage.removeItem(getCacheKey());
    console.log('Cache cleared');
    
    setIsRefreshing(true);
    loadData(true).finally(() => {
      setIsRefreshing(false);
      toast.success('Data refreshed');
    });
  };

  const handleSiteChange = async (value: string) => {
    setSelectedSite(value);
    setCachedData({ selectedSite: value });
    
    // Fetch data for the new site
    setLoading(true);
    try {
      const response = await fetch('/api/search-console', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate || '7daysAgo',
          endDate: endDate || 'today',
          siteUrl: value,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data for selected site');
      }

      const data = await response.json();
      setSearchData(data.searchData);
      setCachedData({
        searchData: data.searchData,
        selectedSite: value
      });
    } catch (error: any) {
      console.error('Error fetching site data:', error);
      toast.error(error.message);
      setSearchData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      compactDisplay: 'short'
    }).format(num);
  };

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'mobile': return <Smartphone className="h-4 w-4" />;
      case 'desktop': return <Monitor className="h-4 w-4" />;
      case 'tablet': return <Tablet className="h-4 w-4" />;
      default: return <Laptop className="h-4 w-4" />;
    }
  };

  const handleShowEmailSettings = async () => {
    try {
      if (!selectedSite) {
        toast.error('Please select a site first');
        return;
      }

      // Load email settings and cron jobs in parallel
      const [settingsResponse, cronResponse] = await Promise.all([
        fetch(`/api/search-console/email-settings?siteUrl=${encodeURIComponent(selectedSite)}`),
        fetch(`/api/search-console/cron-jobs?siteUrl=${encodeURIComponent(selectedSite)}`)
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

  const handleSaveEmailSettings = async () => {
    try {
      if (!selectedSite) {
        toast.error('Please select a site first');
        return;
      }

      const weeklyRecipients = emailSettings.weeklyRecipients.split(',').map(email => email.trim()).filter(Boolean);
      if (emailSettings.enabled && weeklyRecipients.length === 0) {
        toast.error('Please add at least one recipient email for weekly reports');
        return;
      }

      const response = await fetch('/api/search-console/email-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteUrl: selectedSite,
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
      const cronResponse = await fetch(`/api/search-console/cron-jobs?siteUrl=${encodeURIComponent(selectedSite)}`);
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

  const handleSendTestReport = async () => {
    if (!selectedSite) {
      toast.error('Please select a site first');
      return;
    }
    if (!searchData) {
      toast.error('No search data available');
      return;
    }

    const testRecipients = emailSettings.testRecipients.split(',').map(email => email.trim()).filter(Boolean);
    if (testRecipients.length === 0) {
      toast.error('Please configure test recipients in Email Settings');
      return;
    }

    try {
      const response = await fetch('/api/search-console/send-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteUrl: selectedSite,
          recipients: testRecipients,
          searchData: searchData,
          isTest: true,
          dateRange: startDate
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Test report sent successfully');
      } else {
        throw new Error(data.error || 'Failed to send test report');
      }
    } catch (error) {
      console.error('Error sending test report:', error);
      toast.error('Failed to send test report');
    }
  };

  const handleSendManualReport = async () => {
    if (!selectedSite) {
      toast.error('Please select a site first');
      return;
    }
    if (!searchData) {
      toast.error('No search data available');
      return;
    }

    const manualRecipients = emailSettings.manualRecipients.split(',').map(email => email.trim()).filter(Boolean);
    if (manualRecipients.length === 0) {
      toast.error('Please configure manual report recipients in Email Settings');
      return;
    }

    try {
      const response = await fetch('/api/search-console/send-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteUrl: selectedSite,
          recipients: manualRecipients,
          searchData: searchData,
          isTest: false,
          dateRange: startDate
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Report sent successfully');
      } else {
        throw new Error(data.error || 'Failed to send report');
      }
    } catch (error) {
      console.error('Error sending report:', error);
      toast.error('Failed to send report');
    }
  };

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Search Console</h1>
            <p className="text-sm text-muted-foreground">
              View your website's search performance
            </p>
          </div>
          <div className="flex items-center gap-4">
            {sites.length > 0 && selectedSite && (
              <>
                <button
                  onClick={handleSendTestReport}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                    "bg-blue-600 text-foreground hover:bg-blue-500 transition-colors"
                  )}
                >
                  <Mail className="h-4 w-4" />
                  Send Test Report
                </button>
                <button
                  onClick={handleSendManualReport}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                    "bg-green-600 text-foreground hover:bg-green-500 transition-colors"
                  )}
                >
                  <Mail className="h-4 w-4" />
                  Send Report Now
                </button>
                <button
                  onClick={handleShowEmailSettings}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                    "bg-background text-foreground hover:bg-gray-200 dark:bg-muted transition-colors"
                  )}
                >
                  <Settings2 className="h-4 w-4" />
                  Email Settings
                </button>
              </>
            )}
            <button
              onClick={handleRefresh}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md",
                "bg-background text-foreground hover:bg-gray-200 dark:bg-muted transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", { "animate-spin": isRefreshing })} />
              Refresh
            </button>
          </div>
        </div>

        {/* Debug Info */}
        <div className="text-xs text-foreground0">
          Selected Site: {selectedSite || 'none'}<br />
          Has Search Data: {searchData ? 'yes' : 'no'}
        </div>

        {/* Site Selection */}
        <Card className="bg-background border-border text-foreground">
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Search Console Site ({sites.length} available)</label>
              <Select
                value={selectedSite || ''}
                onValueChange={handleSiteChange}
              >
                <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.url} value={site.url}>
                      {site.url}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add Date Range Selector */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Date Range</label>
              <Select
                value={startDate}
                onValueChange={(value) => {
                  setStartDate(value);
                  // Trigger data refresh with new date range
                  if (selectedSite) {
                    loadData(true);
                  }
                }}
              >
                <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="14days">Last 14 Days</SelectItem>
                  <SelectItem value="28days">Last 28 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-400 border-t-gray-900 dark:border-t-white" />
          </div>
        ) : (
          <>
            {/* Search Console Overview */}
            {searchData && (
              <Card className="bg-background border-border text-foreground">
                <div className="p-6">
                  <h2 className="text-lg font-medium text-foreground mb-4">Search Performance</h2>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-background/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <MousePointerClick className="h-4 w-4" />
                        <span>Clicks</span>
                      </div>
                      <div className="text-2xl font-semibold text-foreground">
                        {formatNumber(searchData.overview.clicks)}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-background/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Search className="h-4 w-4" />
                        <span>Impressions</span>
                      </div>
                      <div className="text-2xl font-semibold text-foreground">
                        {formatNumber(searchData.overview.impressions)}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-background/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <ArrowUpRight className="h-4 w-4" />
                        <span>CTR</span>
                      </div>
                      <div className="text-2xl font-semibold text-foreground">
                        {searchData.overview.ctr.toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-background/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <TrendingUp className="h-4 w-4" />
                        <span>Avg. Position</span>
                      </div>
                      <div className="text-2xl font-semibold text-foreground">
                        {searchData.overview.position.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Top Search Queries */}
            {searchData?.topQueries && (
              <Card className="bg-background border-border text-foreground">
                <div className="p-6">
                  <h2 className="text-lg font-medium text-foreground mb-4">Top Search Queries</h2>
                  <div className="relative overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-gray-800 dark:text-foreground">Query</TableHead>
                          <TableHead className="text-gray-800 dark:text-foreground">Page</TableHead>
                          <TableHead className="text-right text-gray-800 dark:text-foreground">Clicks</TableHead>
                          <TableHead className="text-right text-gray-800 dark:text-foreground">Impressions</TableHead>
                          <TableHead className="text-right text-gray-800 dark:text-foreground">CTR</TableHead>
                          <TableHead className="text-right text-gray-800 dark:text-foreground">Position</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchData.topQueries.map((query: SearchQuery, index: number) => (
                          <TableRow key={`${query.query}-${index}`} className="hover:bg-background">
                            <TableCell className="text-gray-900 dark:text-neutral-100 font-medium">{query.query}</TableCell>
                            <TableCell className="text-gray-900 dark:text-neutral-100 max-w-xs truncate">{query.page}</TableCell>
                            <TableCell className="text-right text-gray-900 dark:text-neutral-100">{query.clicks}</TableCell>
                            <TableCell className="text-right text-gray-900 dark:text-neutral-100">{query.impressions}</TableCell>
                            <TableCell className="text-right text-gray-900 dark:text-neutral-100">{query.ctr}</TableCell>
                            <TableCell className="text-right text-gray-900 dark:text-neutral-100">{query.position}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {/* Email Settings Modal */}
        {showEmailSettings && (
          <div className="fixed inset-0 bg-gray-900/50 dark:bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-8 rounded-lg w-full max-w-md border border-border">
              <h2 className="text-xl font-semibold text-foreground mb-6">Email Report Settings</h2>
              
              <div className="space-y-6">
                {/* Test Report Recipients */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-800 dark:text-foreground">Test Report Recipients</label>
                  <input
                    type="text"
                    value={emailSettings.testRecipients}
                    onChange={(e) => setEmailSettings(prev => ({ ...prev, testRecipients: e.target.value }))}
                    className="w-full p-3 rounded-md bg-background border border-border dark:border-border text-foreground text-sm placeholder:text-foreground0"
                    placeholder="email@example.com, another@example.com"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Recipients for test reports when using "Send Test Report"</p>
                </div>

                {/* Manual Report Recipients */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-800 dark:text-foreground">Manual Report Recipients</label>
                  <input
                    type="text"
                    value={emailSettings.manualRecipients}
                    onChange={(e) => setEmailSettings(prev => ({ ...prev, manualRecipients: e.target.value }))}
                    className="w-full p-3 rounded-md bg-background border border-border dark:border-border text-foreground text-sm placeholder:text-foreground0"
                    placeholder="email@example.com, another@example.com"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Recipients for manual reports when using "Send Report Now"</p>
                </div>

                <div className="p-4 bg-background rounded-md border border-border dark:border-border">
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
                      <label className="block mb-2 text-sm font-medium text-gray-800 dark:text-foreground">Weekly Report Recipients</label>
                      <input
                        type="text"
                        value={emailSettings.weeklyRecipients}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, weeklyRecipients: e.target.value }))}
                        className="w-full p-3 rounded-md bg-background border border-border dark:border-border text-foreground text-sm placeholder:text-foreground0"
                        placeholder="email@example.com, another@example.com"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Recipients for automated weekly reports</p>
                    </div>

                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-800 dark:text-foreground">Send Day</label>
                      <select
                        value={emailSettings.sendDay}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, sendDay: e.target.value }))}
                        className="w-full p-3 rounded-md bg-background border border-border dark:border-border text-foreground text-sm"
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
                      <label className="block mb-2 text-sm font-medium text-gray-800 dark:text-foreground">Send Time</label>
                      <input
                        type="time"
                        value={emailSettings.sendTime}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, sendTime: e.target.value }))}
                        className="w-full p-3 rounded-md bg-background border border-border dark:border-border text-foreground text-sm"
                      />
                    </div>

                    {cronJobs.length > 0 && (
                      <div className="pt-4 border-t border-border">
                        <h3 className="text-sm font-medium text-gray-800 dark:text-foreground mb-3">Current Schedule</h3>
                        {cronJobs.map((job) => (
                          <div key={job.id} className="p-3 rounded-md bg-background border border-border dark:border-border">
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
      </div>
    </SidebarDemo>
  );
} 