"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Send, 
  Eye, 
  MousePointer, 
  Users, 
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Pause,
  BarChart3,
  Download,
  Copy,
  ExternalLink,
  TrendingUp,
  AlertCircle,
  Zap,
  Globe,
  Smartphone,
  Monitor,
  Tablet
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedBorderCard } from '@/components/ui/animated-border-card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { SidebarDemo } from "@/components/ui/code.demo";
import { cn } from '@/lib/utils';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  failed_count: number;
  created_at: string;
  sent_at: string;
  completed_at: string;
  from_name: string;
  from_email: string;
  html_content: string;
  plain_content: string;
}

interface SendProgress {
  total: number;
  sent: number;
  failed: number;
  bounced: number;
  status: 'sending' | 'completed' | 'failed' | 'paused';
  errors: string[];
}

interface AnalyticsData {
  opens_by_hour: Array<{ hour: number; opens: number }>;
  clicks_by_hour: Array<{ hour: number; clicks: number }>;
  device_breakdown: Array<{ device: string; count: number }>;
  top_links: Array<{ url: string; clicks: number }>;
  engagement_timeline: Array<{ time: string; opens: number; clicks: number }>;
}

export default function CampaignDetailsPage() {
  const { data: session } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const campaignId = params.id as string;
  const isNewlySent = searchParams.get('sending') === 'true';

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sendProgress, setSendProgress] = useState<SendProgress | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (campaignId) {
      fetchCampaignData();
      
      // If campaign is sending, poll for progress
      if (isNewlySent) {
        const interval = setInterval(fetchSendProgress, 2000);
        return () => clearInterval(interval);
      }
    }
  }, [campaignId, isNewlySent]);

  const fetchCampaignData = async () => {
    try {
      setLoading(true);
      
      const { data: campaignData, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (error) throw error;
      setCampaign(campaignData);

      // If campaign is sending or recently sent, fetch analytics
      if (campaignData.status === 'sent' || campaignData.status === 'sending') {
        await fetchAnalytics();
      }

    } catch (error) {
      console.error('Error fetching campaign:', error);
      toast.error('Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSendProgress = async () => {
    try {
      const response = await fetch(`/api/email-marketing/send-campaign?campaignId=${campaignId}`);
      if (response.ok) {
        const progress = await response.json();
        setSendProgress(progress);
        
        // Update campaign data when sending completes
        if (progress.status === 'completed' || progress.status === 'failed') {
          await fetchCampaignData();
        }
      }
    } catch (error) {
      console.error('Error fetching send progress:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      // Fetch detailed analytics data
      const [opensData, clicksData] = await Promise.all([
        supabase
          .from('email_campaign_opens')
          .select('opened_at, user_agent')
          .eq('campaign_id', campaignId),
        supabase
          .from('email_campaign_clicks')
          .select('clicked_at, url, user_agent')
          .eq('campaign_id', campaignId)
      ]);

      if (opensData.data && clicksData.data) {
        // Process analytics data
        const processedAnalytics = processAnalyticsData(opensData.data, clicksData.data);
        setAnalytics(processedAnalytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const processAnalyticsData = (opens: any[], clicks: any[]): AnalyticsData => {
    // Process opens by hour
    const opensByHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, opens: 0 }));
    opens.forEach(open => {
      const hour = new Date(open.opened_at).getHours();
      opensByHour[hour].opens++;
    });

    // Process clicks by hour
    const clicksByHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, clicks: 0 }));
    clicks.forEach(click => {
      const hour = new Date(click.clicked_at).getHours();
      clicksByHour[hour].clicks++;
    });

    // Process device breakdown
    const deviceCounts: Record<string, number> = {};
    [...opens, ...clicks].forEach(event => {
      const ua = event.user_agent?.toLowerCase() || '';
      let device = 'desktop';
      if (ua.includes('mobile')) device = 'mobile';
      else if (ua.includes('tablet') || ua.includes('ipad')) device = 'tablet';
      
      deviceCounts[device] = (deviceCounts[device] || 0) + 1;
    });

    const deviceBreakdown = Object.entries(deviceCounts).map(([device, count]) => ({
      device,
      count
    }));

    // Process top links
    const linkCounts: Record<string, number> = {};
    clicks.forEach(click => {
      linkCounts[click.url] = (linkCounts[click.url] || 0) + 1;
    });

    const topLinks = Object.entries(linkCounts)
      .map(([url, clicks]) => ({ url, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);

    // Create engagement timeline (last 24 hours)
    const timeline = Array.from({ length: 24 }, (_, i) => {
      const time = new Date();
      time.setHours(time.getHours() - (23 - i));
      return {
        time: time.toISOString(),
        opens: opensByHour[time.getHours()].opens,
        clicks: clicksByHour[time.getHours()].clicks
      };
    });

    return {
      opens_by_hour: opensByHour,
      clicks_by_hour: clicksByHour,
      device_breakdown: deviceBreakdown,
      top_links: topLinks,
      engagement_timeline: timeline
    };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'sending':
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'scheduled':
        return <Calendar className="h-5 w-5 text-blue-500" />;
      case 'draft':
        return <Mail className="h-5 w-5 text-gray-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Mail className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'sending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const calculateOpenRate = () => {
    if (!campaign || campaign.sent_count === 0) return 0;
    return (campaign.opened_count / campaign.sent_count) * 100;
  };

  const calculateClickRate = () => {
    if (!campaign || campaign.sent_count === 0) return 0;
    return (campaign.clicked_count / campaign.sent_count) * 100;
  };

  const calculateBounceRate = () => {
    if (!campaign || campaign.sent_count === 0) return 0;
    return (campaign.bounced_count / campaign.sent_count) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Campaign not found</h2>
          <p className="text-muted-foreground">This campaign doesn't exist or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarDemo>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <Link href="/email-marketing">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Campaigns
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{campaign.name}</h1>
                  <Badge className={getStatusColor(campaign.status)}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(campaign.status)}
                      {campaign.status}
                    </div>
                  </Badge>
                </div>
                <p className="text-muted-foreground">{campaign.subject}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {campaign.status === 'draft' && (
                <Button>
                  <Send className="h-4 w-4 mr-2" />
                  Send Campaign
                </Button>
              )}
              <Button variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
        </div>

        {/* Real-time sending progress */}
        {(campaign.status === 'sending' || sendProgress) && (
          <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
            <AnimatedBorderCard className="bg-background/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    <h3 className="text-lg font-semibold">Campaign Sending in Progress</h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Zap className="h-4 w-4" />
                    Live Updates
                  </div>
                </div>
                
                {sendProgress && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span>{sendProgress.sent} / {sendProgress.total} sent</span>
                    </div>
                    
                    <Progress 
                      value={(sendProgress.sent / sendProgress.total) * 100} 
                      className="h-2"
                    />
                    
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-green-600">{sendProgress.sent}</div>
                        <div className="text-sm text-muted-foreground">Sent</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">{sendProgress.failed}</div>
                        <div className="text-sm text-muted-foreground">Failed</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">
                          {Math.round(((sendProgress.sent / sendProgress.total) * 100))}%
                        </div>
                        <div className="text-sm text-muted-foreground">Complete</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </AnimatedBorderCard>
          </div>
        )}

        {/* Main Content */}
        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{campaign.total_recipients?.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      {campaign.sent_count} sent
                    </p>
                  </CardContent>
                </AnimatedBorderCard>

                <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{calculateOpenRate().toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">
                      {campaign.opened_count} opens
                    </p>
                  </CardContent>
                </AnimatedBorderCard>

                <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
                    <MousePointer className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{calculateClickRate().toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">
                      {campaign.clicked_count} clicks
                    </p>
                  </CardContent>
                </AnimatedBorderCard>

                <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{calculateBounceRate().toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">
                      {campaign.bounced_count} bounces
                    </p>
                  </CardContent>
                </AnimatedBorderCard>
              </div>

              {/* Campaign Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatedBorderCard>
                  <CardHeader>
                    <CardTitle>Campaign Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">From:</span>
                      <span>{campaign.from_name} &lt;{campaign.from_email}&gt;</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created:</span>
                      <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
                    </div>
                    {campaign.sent_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sent:</span>
                        <span>{new Date(campaign.sent_at).toLocaleDateString()}</span>
                      </div>
                    )}
                    {campaign.completed_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Completed:</span>
                        <span>{new Date(campaign.completed_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </CardContent>
                </AnimatedBorderCard>

                <AnimatedBorderCard>
                  <CardHeader>
                    <CardTitle>Performance Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Delivery Rate</span>
                        <span>{campaign.sent_count > 0 ? (((campaign.sent_count - campaign.bounced_count) / campaign.sent_count) * 100).toFixed(1) : 0}%</span>
                      </div>
                      <Progress value={campaign.sent_count > 0 ? (((campaign.sent_count - campaign.bounced_count) / campaign.sent_count) * 100) : 0} className="h-2" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Engagement Rate</span>
                        <span>{campaign.sent_count > 0 ? (((campaign.opened_count + campaign.clicked_count) / campaign.sent_count) * 100).toFixed(1) : 0}%</span>
                      </div>
                      <Progress value={campaign.sent_count > 0 ? (((campaign.opened_count + campaign.clicked_count) / campaign.sent_count) * 100) : 0} className="h-2" />
                    </div>
                  </CardContent>
                </AnimatedBorderCard>
              </div>
            </TabsContent>

            {/* Content Tab */}
            <TabsContent value="content" className="space-y-6">
              <AnimatedBorderCard>
                <CardHeader>
                  <CardTitle>Email Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <div 
                      className="p-6"
                      dangerouslySetInnerHTML={{ __html: campaign.html_content }}
                    />
                  </div>
                </CardContent>
              </AnimatedBorderCard>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <AnimatedBorderCard>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Detailed Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center text-muted-foreground py-8">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Advanced Analytics Coming Soon</h3>
                    <p>We're building detailed engagement analytics, device breakdowns, and click heatmaps.</p>
                  </div>
                </CardContent>
              </AnimatedBorderCard>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SidebarDemo>
  );
} 