'use client';

import React, { useState, useEffect } from 'react';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useAuth } from '@/lib/auth-client';
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { useTheme } from "@/contexts/ThemeContext";

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
  const { user, session } = useAuth();
  const { theme } = useTheme();
  const [startDate, setStartDate] = useState<Date | undefined>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // 7 days ago
  const [endDate, setEndDate] = useState<Date | undefined>(new Date()); // today
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
    if (user) {
      loadData();
    }
  }, [user]);

  // Reload data when date range changes
  useEffect(() => {
    if (user && selectedSite && (startDate || endDate)) {
      loadData(true);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    console.log('Email settings modal state:', showEmailSettings);
  }, [showEmailSettings]);

  const getCacheKey = () => {
    return `${CACHE_KEY_PREFIX}${user?.id || 'anonymous'}`;
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

      if (cachedData.user_id !== user?.id) {
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
    if (!user?.id) return;
    
    try {
      const existingCache = getCachedData();
      const now = Date.now();
      
      const updatedCache: CachedData = {
        searchData: data.searchData || existingCache?.searchData || null,
        sites: data.sites || existingCache?.sites || [],
        timestamp: now,
        expiresAt: now + CACHE_DURATION,
        selectedSite: data.selectedSite !== undefined ? data.selectedSite : existingCache?.selectedSite || null,
        user_id: user.id
      };
      
      localStorage.setItem(getCacheKey(), JSON.stringify(updatedCache));
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  };

  const loadData = async (forceRefresh = false) => {
    if (!user || !session?.access_token) {
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
        userId: user.id
      });

      // Format dates to YYYY-MM-DD format that Google Search Console expects
      const formatDateForAPI = (date: Date | undefined) => {
        if (!date) return undefined;
        return date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
      };

      const response = await fetch('/api/search-console', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          startDate: formatDateForAPI(startDate) || '7daysAgo',
          endDate: formatDateForAPI(endDate) || 'today',
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
      const searchData = data.searchData;

      setSearchData(searchData);
      setSites(data.sites);
      
      let currentSelectedSite = selectedSite;
      if (!currentSelectedSite && data.sites.length > 0) {
        currentSelectedSite = data.sites[0].url;
        setSelectedSite(currentSelectedSite);
      }

      setCachedData({
        searchData: searchData,
        sites: data.sites,
        selectedSite: currentSelectedSite,
      });

    } catch (error) {
      console.error('Error loading search console data:', error);
      toast.error(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData(true).finally(() => setIsRefreshing(false));
  };

  const handleSiteChange = async (value: string) => {
    setSelectedSite(value);
    setLoading(true);
    
    if (!session?.access_token) {
        toast.error("Authentication required");
        setLoading(false);
        return;
    }

    try {
      // Format dates to YYYY-MM-DD format that Google Search Console expects
      const formatDateForAPI = (date: Date | undefined) => {
        if (!date) return undefined;
        return date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
      };

      const response = await fetch('/api/search-console', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          startDate: formatDateForAPI(startDate),
          endDate: formatDateForAPI(endDate),
          siteUrl: value,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data for the new site.');
      }

      const data = await response.json();
      setSearchData(data.searchData);
      setCachedData({
        searchData: data.searchData,
        selectedSite: value,
      });

    } catch (error) {
      console.error('Error changing site:', error);
      toast.error(error instanceof Error ? error.message : "Failed to load data for selected site.");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num === null || num === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'DESKTOP': return <Monitor className="h-5 w-5" />;
      case 'MOBILE': return <Smartphone className="h-5 w-5" />;
      case 'TABLET': return <Tablet className="h-5 w-5" />;
      default: return <Laptop className="h-5 w-5" />;
    }
  };

  const handleShowEmailSettings = async () => {
    setShowEmailSettings(true);
    // Fetch existing settings when opening the modal
    if (!session?.access_token) {
      toast.error("Authentication required to fetch settings.");
      return;
    }
    try {
      const response = await fetch('/api/analytics/email-settings', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const cronResponse = await fetch('/api/analytics/cron-jobs', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data) {
          setEmailSettings({
            enabled: data.enabled || false,
            weeklyRecipients: data.weekly_recipients?.join(', ') || '',
            testRecipients: data.test_recipients?.join(', ') || '',
            manualRecipients: data.manual_recipients?.join(', ') || '',
            frequency: data.frequency || 'weekly',
            sendDay: data.send_day || 'monday',
            sendTime: data.send_time || '09:00'
          });
        }
      }
      if (cronResponse.ok) {
        const data = await cronResponse.json();
        setCronJobs(data);
      }
    } catch (error) {
      toast.error("Failed to fetch email settings.");
      console.error(error);
    }
  };

  const handleSaveEmailSettings = async () => {
    if (!session?.access_token) {
      toast.error("Authentication required to save settings.");
      return;
    }
    const settingsToSave = {
      ...emailSettings,
      weeklyRecipients: emailSettings.weeklyRecipients.split(',').map(e => e.trim()).filter(e => e),
      testRecipients: emailSettings.testRecipients.split(',').map(e => e.trim()).filter(e => e),
      manualRecipients: emailSettings.manualRecipients.split(',').map(e => e.trim()).filter(e => e),
    };

    try {
      const response = await fetch('/api/analytics/email-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(settingsToSave),
      });

      if (response.ok) {
        toast.success("Email settings saved successfully.");
        setShowEmailSettings(false);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save settings.");
      }
    } catch (error) {
      toast.error("An error occurred while saving settings.");
      console.error(error);
    }
  };

  const handleSendTestReport = async () => {
    if (!session?.access_token) {
      toast.error("Authentication required to send report.");
      return;
    }
    try {
      const response = await fetch('/api/analytics/send-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          siteUrl: selectedSite,
          type: 'test',
        }),
      });

      if (response.ok) {
        toast.success("Test report sent successfully.");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to send test report.");
      }
    } catch (error) {
      toast.error("An error occurred while sending the test report.");
      console.error(error);
    }
  };

  const handleSendManualReport = async () => {
    if (!session?.access_token) {
      toast.error("Authentication required to send report.");
      return;
    }
    try {
      const response = await fetch('/api/analytics/send-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          siteUrl: selectedSite,
          type: 'manual',
        }),
      });

      if (response.ok) {
        toast.success("Manual report sent successfully.");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to send manual report.");
      }
    } catch (error) {
      toast.error("An error occurred while sending the manual report.");
      console.error(error);
    }
  };

  const verifyDomain = async () => {
    if (!session?.access_token) {
      toast.error("Authentication required to verify domain.");
      return;
    }
    try {
      toast.info("Verifying domain ownership...");
      const response = await fetch('/api/search-console/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ siteUrl: selectedSite }),
      });

      if (response.ok) {
        toast.success("Domain verification successful.");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to verify domain.");
      }
    } catch (error) {
      toast.error("An error occurred while verifying the domain.");
      console.error(error);
    }
  };

  if (loading && !searchData) {
    return (
        <SidebarDemo>
            <div className="flex items-center justify-center h-screen">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        </SidebarDemo>
    );
  }

  return (
    <SidebarDemo>
      <div className="min-h-screen bg-background text-foreground">
        <main className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-foreground">Marketing Analytics</h1>
            <div className="flex items-center space-x-4">
              {/* Date Range Picker */}
              <div className="flex items-center space-x-2">
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Start date"
                  className="w-[140px]"
                />
                <span className="text-muted-foreground">to</span>
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="End date"
                  className="w-[140px]"
                />
              </div>
              <Select onValueChange={handleSiteChange} value={selectedSite || ''}>
                <SelectTrigger className="w-[280px] bg-background border-border text-foreground rounded-md">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border text-foreground rounded-md">
                  {sites.map(site => (
                    <SelectItem key={site.url} value={site.url}>{site.url}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleRefresh} disabled={isRefreshing || loading} variant="outline" className="bg-background border-border text-foreground hover:bg-muted rounded-md">
                <RefreshCw className={cn("w-4 h-4 mr-2", (isRefreshing || loading) && "animate-spin")} />
                Refresh
              </Button>
              <Button onClick={handleShowEmailSettings} variant="outline" className="bg-background border-border text-foreground hover:bg-muted rounded-md">
                <Mail className="w-4 h-4 mr-2" />
                Email Reports
              </Button>
            </div>
          </div>

          {searchData ? (
            <>
              {/* Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="bg-card border-border rounded-lg">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Clicks</CardTitle>
                    <MousePointerClick className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">{formatNumber(searchData.overview.clicks)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Impressions</CardTitle>
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{formatNumber(searchData.overview.impressions)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Average CTR</CardTitle>
                        <Search className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{searchData.overview.ctr.toFixed(2)}%</div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border rounded-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Average Position</CardTitle>
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{searchData.overview.position.toFixed(2)}</div>
                    </CardContent>
                </Card>
              </div>

              {/* Main Content Area */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Top Queries Table */}
                <div className="lg:col-span-2">
                  <Card className="bg-card border-border rounded-lg">
                    <CardHeader>
                      <CardTitle className="text-foreground">Top Queries</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Header Row */}
                      <div className="grid grid-cols-5 gap-4 p-3 mb-4 bg-muted/20 rounded-md border border-border">
                        <div className="text-sm font-medium text-muted-foreground">Query</div>
                        <div className="text-sm font-medium text-muted-foreground text-center">Clicks</div>
                        <div className="text-sm font-medium text-muted-foreground text-center">Impressions</div>
                        <div className="text-sm font-medium text-muted-foreground text-center">CTR</div>
                        <div className="text-sm font-medium text-muted-foreground text-center">Position</div>
                      </div>
                      
                      {/* Query Rows as Cards */}
                      <div className="space-y-2">
                        {searchData.topQueries.map((query: SearchQuery, index: number) => (
                          <div key={index} className="grid grid-cols-5 gap-4 p-3 bg-card border border-border rounded-md hover:bg-muted/50 transition-colors">
                            <div className="font-medium text-foreground truncate">{query.query}</div>
                            <div className="text-foreground text-center">{formatNumber(query.clicks)}</div>
                            <div className="text-foreground text-center">{formatNumber(query.impressions)}</div>
                            <div className="text-foreground text-center">{query.ctr}%</div>
                            <div className="text-foreground text-center">{query.position}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Device & Country Breakdown */}
                <div>
                  <Card className="bg-card border-border rounded-lg mb-8">
                    <CardHeader>
                      <CardTitle className="text-foreground">Clicks by Device</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-4">
                        {Object.entries(searchData.byDevice).map(([device, data]: [string, any]) => (
                          <li key={device} className="flex items-center justify-between">
                            <div className="flex items-center">
                              {getDeviceIcon(device)}
                              <span className="ml-2 capitalize text-foreground">{device.toLowerCase()}</span>
                            </div>
                            <span className="font-bold text-foreground">{formatNumber(data.clicks)}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card border-border rounded-lg">
                    <CardHeader>
                      <CardTitle className="text-foreground">Top Countries by Clicks</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-4">
                        {Object.entries(searchData.byCountry).sort(([,a]:[string, any], [,b]:[string, any]) => b.clicks - a.clicks).slice(0, 5).map(([country, data]: [string, any]) => (
                          <li key={country} className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Globe className="w-5 h-5 text-muted-foreground" />
                                <span className="ml-2 text-foreground">{country}</span>
                            </div>
                            <span className="font-bold text-foreground">{formatNumber(data.clicks)}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground">No data available. Please select a site and ensure you have Search Console access.</p>
              {!selectedSite && sites.length === 0 && (
                <div className="mt-4">
                  <p className="text-muted-foreground">No sites found. Please connect your Google account in settings.</p>
                  <Button className="mt-2" onClick={verifyDomain}>Verify Site Ownership</Button>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Email Settings Modal */}
        {showEmailSettings && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className="bg-card border-border rounded-lg w-full max-w-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between text-foreground">
                            <span>Email Report Settings for {selectedSite}</span>
                            <Button variant="ghost" size="sm" onClick={() => setShowEmailSettings(false)} className="text-foreground hover:bg-muted">X</Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <label className="flex items-center justify-between">
                                <span className="text-foreground">Enable Weekly Reports</span>
                                <Switch
                                    checked={emailSettings.enabled}
                                    onCheckedChange={(checked) => setEmailSettings({...emailSettings, enabled: checked})}
                                />
                            </label>
                            <p className="text-sm text-muted-foreground">Automatically send a weekly performance report.</p>
                        </div>
                        
                        {emailSettings.enabled && (
                             <div>
                                <label htmlFor="weeklyRecipients" className="block text-sm font-medium mb-1 text-foreground">Weekly Report Recipients</label>
                                <input
                                    id="weeklyRecipients"
                                    type="text"
                                    value={emailSettings.weeklyRecipients}
                                    onChange={(e) => setEmailSettings({...emailSettings, weeklyRecipients: e.target.value})}
                                    placeholder="email1@example.com, email2@example.com"
                                    className="w-full bg-background border-border text-foreground rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-primary"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Comma-separated email addresses.</p>
                            </div>
                        )}

                        <div>
                            <h3 className="text-lg font-semibold border-t border-border pt-4 mt-4 text-foreground">Scheduled Jobs</h3>
                            {cronJobs.length > 0 ? (
                                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                                    {cronJobs.map(job => (
                                        <li key={job.id} className="text-foreground">`{job.schedule}` - `{job.url}`</li>
                                    ))}
                                </ul>
                            ) : <p className="text-sm text-muted-foreground mt-2">No scheduled jobs found.</p>}
                        </div>

                        <div className="border-t border-border pt-4">
                            <h3 className="text-lg font-semibold text-foreground">Manual Reports</h3>
                            <div>
                                <label htmlFor="testRecipients" className="block text-sm font-medium mb-1 text-foreground">Test Report Recipients</label>
                                <input
                                    id="testRecipients"
                                    type="text"
                                    value={emailSettings.testRecipients}
                                    onChange={(e) => setEmailSettings({...emailSettings, testRecipients: e.target.value})}
                                    placeholder="test1@example.com"
                                    className="w-full bg-background border-border text-foreground rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-primary"
                                />
                                <Button onClick={handleSendTestReport} className="mt-2 rounded-md">Send Test Report</Button>
                            </div>
                            <div className="mt-4">
                                <label htmlFor="manualRecipients" className="block text-sm font-medium mb-1 text-foreground">Manual Report Recipients</label>
                                <input
                                    id="manualRecipients"
                                    type="text"
                                    value={emailSettings.manualRecipients}
                                    onChange={(e) => setEmailSettings({...emailSettings, manualRecipients: e.target.value})}
                                    placeholder="manual1@example.com"
                                    className="w-full bg-background border-border text-foreground rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-primary"
                                />
                                <Button onClick={handleSendManualReport} className="mt-2">Send Manual Report</Button>
                            </div>
                        </div>

                    </CardContent>
                    <CardFooter className="flex justify-end space-x-2 border-t border-border pt-4">
                        <Button variant="outline" onClick={() => setShowEmailSettings(false)} className="bg-background border-border text-foreground hover:bg-muted rounded-md">Cancel</Button>
                        <Button onClick={handleSaveEmailSettings} className="rounded-md">Save Settings</Button>
                    </CardFooter>
                </Card>
            </div>
        )}
      </div>
    </SidebarDemo>
  );
}
