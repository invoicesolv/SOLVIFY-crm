"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { 
  Mail, 
  Users, 
  Send, 
  BarChart3, 
  Plus, 
  Search,
  Filter,
  Calendar,
  Eye,
  MousePointer,
  UserX,
  TrendingUp,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedBorderCard } from '@/components/ui/animated-border-card';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  created_at: string;
  scheduled_at?: string;
  sent_at?: string;
}

interface ContactList {
  id: string;
  name: string;
  total_contacts: number;
  active_contacts: number;
  created_at: string;
}

interface EmailStats {
  total_campaigns: number;
  total_contacts: number;
  total_sent: number;
  avg_open_rate: number;
  avg_click_rate: number;
  total_bounces: number;
}

export default function EmailMarketingPage() {
  const { data: session } = useSession();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [stats, setStats] = useState<EmailStats>({
    total_campaigns: 0,
    total_contacts: 0,
    total_sent: 0,
    avg_open_rate: 0,
    avg_click_rate: 0,
    total_bounces: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const initializeWorkspace = async () => {
      if (session?.user?.id) {
        try {
          const response = await fetch('/api/workspace/leave');
          if (response.ok) {
            const data = await response.json();
            const workspaces = data.workspaces || [];
            if (workspaces.length > 0) {
              setWorkspaceId(workspaces[0].id);
            }
          }
        } catch (error) {
          console.error('Error getting workspace ID:', error);
        }
      }
    };
    
    initializeWorkspace();
  }, [session?.user?.id]);

  useEffect(() => {
    if (workspaceId) {
      fetchData();
    }
  }, [workspaceId]);

  const fetchData = async () => {
    if (!workspaceId) return;
    
    try {
      setLoading(true);
      
      // Fetch campaigns
      const { data: campaignsData, error: campaignError } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (campaignError) throw campaignError;
      setCampaigns(campaignsData || []);

      // Fetch contact lists
      const { data: listsData, error: listsError } = await supabase
        .from('email_lists')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (listsError) throw listsError;
      setContactLists(listsData || []);

      // Calculate stats
      const totalContacts = listsData?.reduce((sum, list) => sum + list.active_contacts, 0) || 0;
      const totalSent = campaignsData?.reduce((sum, campaign) => sum + campaign.sent_count, 0) || 0;
      const totalOpened = campaignsData?.reduce((sum, campaign) => sum + campaign.opened_count, 0) || 0;
      const totalClicked = campaignsData?.reduce((sum, campaign) => sum + campaign.clicked_count, 0) || 0;
      const totalBounces = campaignsData?.reduce((sum, campaign) => sum + campaign.bounced_count, 0) || 0;

      const avgOpenRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
      const avgClickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

      setStats({
        total_campaigns: campaignsData?.length || 0,
        total_contacts: totalContacts,
        total_sent: totalSent,
        avg_open_rate: avgOpenRate,
        avg_click_rate: avgClickRate,
        total_bounces: totalBounces
      });

    } catch (error) {
      console.error('Error fetching email marketing data:', error);
      toast.error('Failed to load email marketing data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'sending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'paused':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarDemo>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Email Marketing</h1>
            <p className="text-muted-foreground">Create, send, and track email campaigns</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/email-marketing/settings">
              <Button variant="outline" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </Link>
            <Link href="/email-marketing/templates">
              <Button variant="outline" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Templates
              </Button>
            </Link>
            <Link href="/email-marketing/contacts">
              <Button variant="outline" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Contacts
              </Button>
            </Link>
            <Link href="/email-marketing/campaigns/new">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Campaign
              </Button>
            </Link>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-border/50 dark:bg-border/20"></div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_campaigns}</div>
              <p className="text-xs text-muted-foreground">
                All time campaigns
              </p>
            </CardContent>
          </AnimatedBorderCard>

          <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_contacts.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Active subscribers
              </p>
            </CardContent>
          </AnimatedBorderCard>

          <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Open Rate</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_open_rate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.total_sent.toLocaleString()} emails sent
              </p>
            </CardContent>
          </AnimatedBorderCard>

          <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Click Rate</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_click_rate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Engagement rate
              </p>
            </CardContent>
          </AnimatedBorderCard>
        </div>

        {/* Separator */}
        <div className="h-px bg-border/50 dark:bg-border/20"></div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Campaigns */}
          <div className="lg:col-span-2">
            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Campaigns</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search campaigns..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredCampaigns.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="relative">
                      <GlowingEffect className="text-primary" />
                      <Mail className="mx-auto h-12 w-12 text-muted-foreground relative z-10" />
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-foreground">No campaigns</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Get started by creating your first email campaign.
                    </p>
                    <div className="mt-6">
                      <Link href="/email-marketing/campaigns/new">
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          New Campaign
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredCampaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:bg-muted/50 transition-colors backdrop-blur-sm"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium text-foreground">{campaign.name}</h4>
                            <Badge className={getStatusColor(campaign.status)}>
                              {campaign.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{campaign.subject}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{campaign.total_recipients} recipients</span>
                            {campaign.sent_count > 0 && (
                              <>
                                <span>•</span>
                                <span>{((campaign.opened_count / campaign.sent_count) * 100).toFixed(1)}% opened</span>
                                <span>•</span>
                                <span>{((campaign.clicked_count / campaign.sent_count) * 100).toFixed(1)}% clicked</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {campaign.sent_at ? formatDate(campaign.sent_at) : 
                             campaign.scheduled_at ? `Scheduled: ${formatDate(campaign.scheduled_at)}` :
                             `Created: ${formatDate(campaign.created_at)}`}
                          </p>
                          <Link href={`/email-marketing/campaigns/${campaign.id}`}>
                            <Button variant="ghost" size="sm" className="mt-2">
                              View Details
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </AnimatedBorderCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Lists */}
            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Contact Lists
                  <Link href="/email-marketing/contacts">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contactLists.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="relative">
                      <GlowingEffect className="text-primary" />
                      <Users className="mx-auto h-8 w-8 text-muted-foreground relative z-10" />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">No contact lists yet</p>
                    <Link href="/email-marketing/contacts">
                      <Button variant="outline" size="sm" className="mt-2">
                        Create List
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contactLists.slice(0, 5).map((list) => (
                      <div key={list.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{list.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {list.active_contacts} active contacts
                          </p>
                        </div>
                        <Badge variant="outline">{list.total_contacts}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </AnimatedBorderCard>

            {/* Quick Actions */}
            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/email-marketing/campaigns/new">
                  <Button variant="outline" className="w-full justify-start">
                    <Send className="h-4 w-4 mr-2" />
                    Create Campaign
                  </Button>
                </Link>
                <Link href="/email-marketing/templates/new">
                  <Button variant="outline" className="w-full justify-start">
                    <Mail className="h-4 w-4 mr-2" />
                    New Template
                  </Button>
                </Link>
                <Link href="/email-marketing/contacts/import">
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="h-4 w-4 mr-2" />
                    Import Contacts
                  </Button>
                </Link>
                <Link href="/email-marketing/analytics">
                  <Button variant="outline" className="w-full justify-start">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Analytics
                  </Button>
                </Link>
              </CardContent>
            </AnimatedBorderCard>
          </div>
        </div>
      </div>
    </SidebarDemo>
  );
} 