"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import Image from 'next/image';
import { 
  Share2,
  Video,
  Type,
  Sparkles,
  Calendar,
  BarChart3,
  Settings,
  Plus,
  Upload,
  Image as ImageIcon,
  Play,
  Users,
  Heart,
  MessageCircle,
  Repeat2,
  Eye,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Bot,
  Wand2
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedBorderCard } from '@/components/ui/animated-border-card';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

import { SidebarDemo } from "@/components/ui/code.demo";
import { cn } from '@/lib/utils';

interface SocialAccount {
  id: string;
  platform: 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'x' | 'youtube' | 'threads';
  account_name: string;
  account_id: string;
  access_token: string;
  is_connected: boolean;
  followers_count?: number;
  engagement_rate?: number;
  last_post_date?: string;
  additional_data?: string; // JSON string with platform-specific data (e.g., Facebook page info)
}

interface SocialPost {
  id: string;
  content: string;
  media_urls?: string[];
  platforms: string[];
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduled_at?: string;
  published_at?: string;
  ai_generated: boolean;
  post_type: 'text' | 'image' | 'video' | 'carousel';
  engagement_stats?: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  };
}

const PLATFORMS = [
  {
    id: 'instagram',
    name: 'Instagram',
    color: 'bg-gradient-to-br from-purple-500 to-pink-500',
    logo: '/social-logos/instagram.png',
    features: ['Images', 'Videos', 'Stories', 'Reels'],
    maxChars: 2200
  },
  {
    id: 'facebook',
    name: 'Facebook',
    color: 'bg-gradient-to-br from-blue-600 to-blue-700',
    logo: '/social-logos/facebook.png',
    features: ['Text', 'Images', 'Videos', 'Events'],
    maxChars: 63206
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    color: 'bg-gradient-to-br from-black to-red-600',
    logo: '/social-logos/tiktok.png',
    features: ['Videos', 'Sounds', 'Effects'],
    maxChars: 300
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    color: 'bg-gradient-to-br from-blue-700 to-blue-800',
    logo: '/social-logos/linkedin.png',
    features: ['Professional', 'Articles', 'Updates'],
    maxChars: 3000
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    color: 'bg-gradient-to-br from-gray-800 to-black',
    logo: '/social-logos/x-twitter.png',
    features: ['Tweets', 'Threads', 'Spaces'],
    maxChars: 280
  },
  {
    id: 'youtube',
    name: 'YouTube',
    color: 'bg-gradient-to-br from-red-600 to-red-700',
    logo: '/social-logos/youtube.png',
    features: ['Videos', 'Shorts', 'Live Streams'],
    maxChars: 5000
  },
  {
    id: 'threads',
    name: 'Threads',
    color: 'bg-gradient-to-br from-gray-900 to-black',
    logo: '/social-logos/threads.png',
    features: ['Text', 'Images', 'Videos', 'Replies'],
    maxChars: 500
  }
];

export default function SocialMediaPage() {
  const { data: session } = useSession();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Post creation state
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedFacebookPage, setSelectedFacebookPage] = useState<string>(''); // Store page account_id
  const [selectedInstagramPage, setSelectedInstagramPage] = useState<string>(''); // Store page account_id
  const [selectedThreadsPage, setSelectedThreadsPage] = useState<string>(''); // Store page account_id
  const [postType, setPostType] = useState<'text' | 'video'>('text');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [publishImmediately, setPublishImmediately] = useState(true);
  
  // AI state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAIDialog, setShowAIDialog] = useState(false);

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

  // Reset form when opening create post dialog
  useEffect(() => {
    if (isCreatingPost) {
      // Only reset content and platforms if they're empty (preserve user input)
      if (!postContent) {
        setPostContent('');
      }
      if (selectedPlatforms.length === 0) {
        setSelectedPlatforms([]);
      }
      setMediaFiles([]);
    }
  }, [isCreatingPost]);

  const fetchData = async () => {
    if (!workspaceId) return;
    
    try {
      setLoading(true);
      
      // Fetch connected social accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (accountsError) throw accountsError;
      
      // Also check for YouTube connection in integrations table
      let youtubeConnected = false;
      if (session?.user?.id) {
        const { data: youtubeIntegration, error: youtubeError } = await supabase
          .from('integrations')
          .select('service_name')
          .eq('user_id', session.user.id)
          .eq('service_name', 'youtube')
          .single();
        
        if (!youtubeError && youtubeIntegration) {
          youtubeConnected = true;
        }
      }
      
      // Add YouTube to connected accounts if found in integrations
      const allConnectedAccounts = [...(accountsData || [])];
      if (youtubeConnected) {
        allConnectedAccounts.push({
          id: 'youtube-integration',
          platform: 'youtube',
          account_name: 'YouTube Account',
          account_id: 'youtube',
          access_token: '', // We don't need to expose this
          is_connected: true,
          followers_count: 0,
          engagement_rate: 0
        });
      }
      
      setConnectedAccounts(allConnectedAccounts);

      // Fetch recent posts
      const { data: postsData, error: postsError } = await supabase
        .from('social_posts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (postsError) throw postsError;
      setPosts(postsData || []);

    } catch (error) {
      console.error('Error fetching social media data:', error);
      toast.error('Failed to load social media data');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectPlatform = async (platformId: string) => {
    if (!session?.user?.id) {
      toast.error('Please log in to connect platforms');
      return;
    }

    try {
      let oauthUrl = '';
      
      switch (platformId) {
        case 'facebook':
          // Check if we have a basic Facebook connection that needs upgrading
          const basicFacebookAccount = connectedAccounts.find(
            account => account.platform === 'facebook' && !account.additional_data
          );
          
          if (basicFacebookAccount) {
            // User has basic connection, offer to upgrade to business permissions
            const upgradeConfirmed = window.confirm(
              'You have a basic Facebook connection. Would you like to disconnect and reconnect with business permissions to manage your Facebook pages?'
            );
            
            if (upgradeConfirmed) {
              // First disconnect the basic account
              try {
                const { error } = await supabase
                  .from('social_accounts')
                  .delete()
                  .eq('platform', 'facebook')
                  .eq('workspace_id', workspaceId);
                
                if (error) {
                  console.error('Error disconnecting Facebook:', error);
                  toast.error('Failed to disconnect existing Facebook account');
                  return;
                }
                
                toast.success('Disconnected basic Facebook account. Reconnecting with business permissions...');
                
                // Wait a moment then reconnect
                setTimeout(() => {
                  window.location.href = `/api/oauth/facebook?force_business=true&state=${encodeURIComponent(JSON.stringify({ platform: 'facebook', userId: session.user.id, upgrade: true }))}`;
                }, 1000);
                return;
              } catch (error) {
                console.error('Error during Facebook upgrade:', error);
                toast.error('Failed to upgrade Facebook connection');
                return;
              }
            }
          }
          
          // Regular Facebook connection with business permissions
          oauthUrl = `/api/oauth/facebook?advanced=true&state=${encodeURIComponent(JSON.stringify({ platform: 'facebook', userId: session.user.id }))}`;
          break;
        case 'instagram':
          oauthUrl = `/api/oauth/instagram?state=${encodeURIComponent(JSON.stringify({ platform: 'instagram', userId: session.user.id }))}`;
          break;
        case 'threads':
          oauthUrl = `/api/oauth/threads?state=${encodeURIComponent(JSON.stringify({ platform: 'threads', userId: session.user.id }))}`;
          break;
        case 'linkedin':
          oauthUrl = `/api/oauth/linkedin?state=${encodeURIComponent(JSON.stringify({ platform: 'linkedin', userId: session.user.id }))}`;
          break;
        case 'x':
        case 'twitter':
          oauthUrl = `/api/oauth/twitter?state=${encodeURIComponent(JSON.stringify({ platform: 'twitter', userId: session.user.id }))}`;
          break;
        case 'youtube':
          // YouTube uses the same Google OAuth pattern as other Google services
          if (!session?.user?.id) {
            toast.error('Please log in first');
            return;
          }
          
          try {
            toast.info('Connecting to YouTube...');
            // Import signIn from next-auth/react
            const { signIn } = await import('next-auth/react');
            
            // Use the same pattern as settings page for Google services
            const youtubeScopes = [
              'openid',
              'email', 
              'profile',
              'https://www.googleapis.com/auth/youtube',
              'https://www.googleapis.com/auth/youtube.upload',
              'https://www.googleapis.com/auth/youtube.readonly',
              'https://www.googleapis.com/auth/youtube.force-ssl'
            ];
            
            await signIn('google', {
              callbackUrl: '/social-media',
              scope: youtubeScopes.join(' ')
            }, { prompt: 'consent' });
          } catch (error) {
            console.error('YouTube OAuth error:', error);
            toast.error('Failed to connect YouTube');
          }
          return;
        default:
          toast.info(`${platformId} connection coming soon!`);
          return;
      }
      
      if (oauthUrl) {
        toast.info(`Redirecting to ${platformId} authentication...`);
        window.location.href = oauthUrl;
      }
    } catch (error) {
      console.error(`Error connecting to ${platformId}:`, error);
      toast.error(`Failed to connect to ${platformId}`);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsGeneratingAI(true);
    try {
      // TODO: Integrate with your AI service
      // For now, simulate AI generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const aiGeneratedContent = `🚀 Exciting news! ${aiPrompt}\n\n✨ Generated with AI to help you create engaging content that connects with your audience.\n\n#AI #Innovation #Growth`;
      
      setPostContent(aiGeneratedContent);
      setShowAIDialog(false);
      setAiPrompt('');
      toast.success('AI content generated successfully!');
    } catch (error) {
      console.error('Error generating AI content:', error);
      toast.error('Failed to generate AI content');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleCreatePost = async () => {
    if (!postContent.trim() || selectedPlatforms.length === 0) {
      toast.error('Please add content and select at least one platform');
      return;
    }

    // Validate Facebook page selection
    if (selectedPlatforms.includes('facebook') && !selectedFacebookPage) {
      toast.error('Please select a Facebook page to post to');
      return;
    }

    // Validate Instagram page selection
    if (selectedPlatforms.includes('instagram') && !selectedInstagramPage) {
      toast.error('Please select an Instagram page to post to');
      return;
    }

    // Validate Threads page selection
    if (selectedPlatforms.includes('threads') && !selectedThreadsPage) {
      toast.error('Please select a Threads page to post to');
      return;
    }

    try {
      const now = new Date().toISOString();
      
      const newPost = {
        workspace_id: workspaceId,
        user_id: session?.user?.id,
        content: postContent,
        platforms: selectedPlatforms,
        post_type: postType,
        status: isScheduled ? 'scheduled' : (publishImmediately ? 'published' : 'draft'),
        scheduled_at: isScheduled ? scheduledDate : null,
        published_at: publishImmediately && !isScheduled ? now : null,
        ai_generated: false // Track if generated by AI
      };

      const { data: savedPost, error } = await supabase
        .from('social_posts')
        .insert([newPost])
        .select()
        .single();

      if (error) throw error;

      // If publishing immediately, actually post to social platforms
      if (publishImmediately && !isScheduled) {
        await publishToSocialPlatforms(savedPost.id, postContent, selectedPlatforms, {
          facebook: selectedFacebookPage,
          instagram: selectedInstagramPage,
          threads: selectedThreadsPage
        });
      }

      toast.success(
        publishImmediately && !isScheduled 
          ? 'Post published successfully to social media!' 
          : isScheduled 
            ? 'Post scheduled successfully!' 
            : 'Post saved as draft!'
      );
      setIsCreatingPost(false);
      setPostContent('');
      setSelectedPlatforms([]);
      setSelectedFacebookPage(''); // Reset Facebook page selection
      setSelectedInstagramPage(''); // Reset Instagram page selection
      setSelectedThreadsPage(''); // Reset Threads page selection
      setMediaFiles([]);
      setPublishImmediately(true); // Reset to default
      setIsScheduled(false); // Reset scheduling
      setScheduledDate(''); // Reset date
      fetchData();
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    }
  };

  // Function to actually publish to social media platforms
  const publishToSocialPlatforms = async (postId: string, content: string, platforms: string[], selectedPages: {
    facebook?: string;
    instagram?: string;
    threads?: string;
  }) => {
    for (const platform of platforms) {
      try {
        if (platform === 'facebook') {
          await publishToFacebook(content, selectedPages.facebook);
        } else if (platform === 'instagram') {
          await publishToInstagram(content, selectedPages.instagram);
        } else if (platform === 'threads') {
          await publishToThreads(content, selectedPages.threads);
        } else if (platform === 'linkedin') {
          // LinkedIn posting will be implemented later  
          console.log('LinkedIn posting not yet implemented');
        } else if (platform === 'youtube') {
          await publishToYouTube(content);
        } else if (platform === 'x' || platform === 'twitter') {
          await publishToTwitter(content);
        }
        // Add other platforms as needed
      } catch (error) {
        console.error(`Error posting to ${platform}:`, error);
        toast.error(`Failed to post to ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Update post status to failed for this platform
        await supabase
          .from('social_posts')
          .update({ status: 'failed' })
          .eq('id', postId);
      }
    }
  };

  // Publish to Facebook using Graph API
  const publishToFacebook = async (content: string, selectedPageId?: string) => {
    if (!workspaceId) throw new Error('No workspace ID available');

    if (!selectedPageId) {
      throw new Error('No Facebook page selected');
    }

    console.log('🔍 Facebook publish debug:', {
      selectedPageId,
      workspaceId
    });

    try {
      // Call server-side API endpoint for Facebook posting
      const response = await fetch('/api/social/facebook/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          selectedPageId,
          workspaceId
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('Facebook API Error:', responseData);
        throw new Error(responseData.error || 'Failed to post to Facebook');
      }

      console.log(`Facebook page post successful:`, responseData);
      toast.success(`Successfully posted to Facebook page: ${responseData.pageName}!`);
      
      return responseData.data;
    } catch (error) {
      console.error('Facebook posting error:', error);
      throw error;
    }
  };

  // Publish to Instagram using Graph API
  const publishToInstagram = async (content: string, selectedPageId?: string) => {
    if (!workspaceId) throw new Error('No workspace ID available');

    if (!selectedPageId) {
      throw new Error('No Instagram page selected');
    }

    try {
      const response = await fetch('/api/social/instagram/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          selectedPageId,
          workspaceId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post to Instagram');
      }

      const result = await response.json();
      console.log('Instagram post successful:', result);
      toast.success(result.message || 'Successfully posted to Instagram!');
      return result;
    } catch (error) {
      console.error('Instagram posting error:', error);
      throw error;
    }
  };

  // Publish to Threads using Meta's Threads API
  const publishToThreads = async (content: string, selectedPageId?: string) => {
    if (!workspaceId) throw new Error('No workspace ID available');

    if (!selectedPageId) {
      throw new Error('No Threads page selected');
    }

    try {
      const response = await fetch('/api/social/threads/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          selectedPageId,
          workspaceId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post to Threads');
      }

      const result = await response.json();
      console.log('Threads post successful:', result);
      toast.success(result.message || 'Successfully posted to Threads!');
      return result;
    } catch (error) {
      console.error('Threads posting error:', error);
      throw error;
    }
  };

  // Publish to YouTube using YouTube Data API
  const publishToYouTube = async (content: string) => {
    if (!workspaceId || !session?.user?.id) throw new Error('No workspace ID or user ID available');

    // Get YouTube access token from integrations table (not social_accounts)
    const { data: youtubeIntegration, error } = await supabase
      .from('integrations')
      .select('access_token, refresh_token')
      .eq('user_id', session.user.id)
      .eq('service_name', 'youtube')
      .single();

    if (error || !youtubeIntegration) {
      throw new Error('YouTube account not connected or access token not found. Please connect your YouTube account first.');
    }

    try {
      // For text-only posts to YouTube, we can create a Community Post
      // Note: Community posts require the channel to be eligible (certain subscriber thresholds)
      const response = await fetch('https://www.googleapis.com/youtube/v3/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${youtubeIntegration.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            text: content
          }
        })
      });

      if (!response.ok) {
        // If community posts fail, we could fall back to creating a video description placeholder
        // or uploading a simple video with the text as description
        const errorData = await response.json();
        
        // Check if it's a community post eligibility issue
        if (errorData.error?.code === 403) {
          throw new Error('YouTube Community Posts not available for this channel. Channel may need more subscribers or to meet eligibility requirements.');
        }
        
        throw new Error(errorData.error?.message || 'Failed to post to YouTube');
      }

      const result = await response.json();
      console.log('YouTube post successful:', result);
      toast.success('Successfully posted to YouTube Community!');
      return result;
    } catch (error) {
      console.error('YouTube posting error:', error);
      throw error;
    }
  };

  // Publish to X (Twitter) using Twitter API v2
  const publishToTwitter = async (content: string) => {
    if (!workspaceId) throw new Error('No workspace ID available');

    // Get Twitter access token from database (platform stored as 'x')
    const { data: twitterAccount, error } = await supabase
      .from('social_accounts')
      .select('access_token, account_id')
      .eq('workspace_id', workspaceId)
      .eq('platform', 'x')
      .eq('is_connected', true)
      .single();

    if (error || !twitterAccount) {
      throw new Error('X (Twitter) account not connected or access token not found');
    }

    try {
      // Post tweet using Twitter API v2
      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${twitterAccount.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: content
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.title || 'Failed to post to X (Twitter)');
      }

      const result = await response.json();
      console.log('X (Twitter) post successful:', result);
      toast.success('Successfully posted to X (Twitter)!');
      return result;
    } catch (error) {
      console.error('X (Twitter) posting error:', error);
      throw error;
    }
  };

  const getConnectionStatus = (platformId: string) => {
    const account = connectedAccounts.find(acc => acc.platform === platformId);
    return account?.is_connected || false;
  };

  const getPlatformStats = (platformId: string) => {
    const account = connectedAccounts.find(acc => acc.platform === platformId);
    return {
      followers: account?.followers_count || 0,
      engagement: account?.engagement_rate || 0
    };
  };

  const getCharacterCount = () => {
    if (selectedPlatforms.length === 0) return 0;
    
    const minLimit = selectedPlatforms.reduce((min, platformId) => {
      const platform = PLATFORMS.find(p => p.id === platformId);
      return Math.min(min, platform?.maxChars || 280);
    }, Infinity);
    
    return minLimit;
  };

  // Get Facebook pages for selection
  const getFacebookPages = () => {
    return connectedAccounts.filter(account => 
      account.platform === 'facebook' && 
      account.account_name.includes('(Page)')
    );
  };

  // Get Instagram pages for selection
  const getInstagramPages = () => {
    return connectedAccounts.filter(account => 
      account.platform === 'instagram' && 
      account.account_name.includes('(Page)')
    );
  };

  // Get Threads pages for selection
  const getThreadsPages = () => {
    return connectedAccounts.filter(account => 
      account.platform === 'threads' && 
      account.account_name.includes('(Page)')
    );
  };

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
            <h1 className="text-3xl font-bold text-foreground">Social Media Management</h1>
            <p className="text-muted-foreground">Create, schedule, and manage posts across all platforms</p>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  AI Assistant
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>AI Content Generator</DialogTitle>
                  <DialogDescription>
                    Describe what you want to post and let AI create engaging content for you
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Textarea
                    placeholder="e.g., 'Announce our new product launch with excitement', 'Share tips about productivity', 'Celebrate our team achievement'..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={4}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAIDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAIGenerate} disabled={isGeneratingAI}>
                      {isGeneratingAI ? (
                        <>
                          <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 mr-2" />
                          Generate Content
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              onClick={() => setIsCreatingPost(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Post
            </Button>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-border/50 dark:bg-border/20"></div>

        {/* Facebook Upgrade Alert */}
        {connectedAccounts.some(account => 
          account.platform === 'facebook' && 
          !account.additional_data
        ) && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20 p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <div className="flex-1">
                <h3 className="font-medium text-orange-800 dark:text-orange-200">
                  Facebook Business Features Available
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  You have a basic Facebook connection. Upgrade to business permissions to manage your Facebook pages and post content.
                </p>
              </div>
              <Button 
                size="sm" 
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => handleConnectPlatform('facebook')}
              >
                Upgrade Now
              </Button>
            </div>
          </div>
        )}

        {/* Platform Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {PLATFORMS.map((platform) => {
            const isConnected = getConnectionStatus(platform.id);
            const stats = getPlatformStats(platform.id);
            
            return (
              <AnimatedBorderCard key={platform.id} className="bg-background/50 backdrop-blur-sm border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center p-2 bg-white">
                      <Image 
                        src={platform.logo} 
                        alt={platform.name} 
                        width={24} 
                        height={24} 
                        className="object-contain"
                      />
                    </div>
                    <Badge className={isConnected ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'}>
                      {isConnected ? 'Connected' : 'Not Connected'}
                    </Badge>
                  </div>
                  
                  <h3 className="font-semibold text-sm mb-1">{platform.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {platform.features.join(' • ')}
                  </p>
                  
                  {isConnected ? (
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Followers:</span>
                        <span className="font-medium">{stats.followers.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Engagement:</span>
                        <span className="font-medium">{stats.engagement.toFixed(1)}%</span>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleConnectPlatform(platform.id)}
                    >
                      Connect
                    </Button>
                  )}
                </CardContent>
              </AnimatedBorderCard>
            );
          })}
        </div>

        {/* Separator */}
        <div className="h-px bg-border/50 dark:bg-border/20"></div>

        {/* Connected Accounts */}
        {connectedAccounts.length > 0 && (
          <>
            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
              <CardHeader>
                <CardTitle className="text-lg">Connected Accounts</CardTitle>
                <CardDescription>
                  Manage your connected social media accounts and pages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {connectedAccounts.map((account) => {
                    const platform = PLATFORMS.find(p => p.id === account.platform);
                    let additionalInfo: any = null;
                    
                    // Parse additional data for Facebook pages
                    if (account.additional_data) {
                      try {
                        additionalInfo = JSON.parse(account.additional_data);
                      } catch (e) {
                        console.error('Error parsing additional_data:', e);
                      }
                    }
                    
                    return (
                      <div 
                        key={account.id} 
                        className="flex items-center gap-3 p-3 border border-border/50 rounded-lg hover:bg-muted/20 transition-colors"
                      >
                        {platform && (
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center p-1.5 bg-white">
                            <Image 
                              src={platform.logo} 
                              alt={platform.name} 
                              width={20} 
                              height={20} 
                              className="object-contain"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {account.account_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {additionalInfo?.is_page ? 'Facebook Page' : platform?.name || account.platform}
                            {additionalInfo?.page_category && ` • ${additionalInfo.page_category}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {account.platform === 'facebook' && !additionalInfo?.is_page && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs"
                              onClick={() => handleConnectPlatform('facebook')}
                            >
                              Upgrade to Business
                            </Button>
                          )}
                          <Badge 
                            className={account.is_connected 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                            }
                          >
                            {account.is_connected ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </AnimatedBorderCard>

            {/* Separator */}
            <div className="h-px bg-border/50 dark:bg-border/20"></div>
          </>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Posts */}
          <div className="lg:col-span-2">
            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
              <CardHeader>
                <CardTitle>Recent Posts</CardTitle>
              </CardHeader>
              <CardContent>
                {posts.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="relative">
                      <GlowingEffect className="text-primary" />
                      <Share2 className="mx-auto h-12 w-12 text-muted-foreground mb-4 relative z-10" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
                    <p className="text-muted-foreground mb-6">
                      Create your first social media post to get started.
                    </p>
                    <Button onClick={() => setIsCreatingPost(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Post
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <div 
                        key={post.id} 
                        className="border border-border/50 rounded-lg p-4 hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => {
                          const platformsList = post.platforms.map(p => 
                            PLATFORMS.find(platform => platform.id === p)?.name || p
                          ).join(', ');
                          
                          toast.info(
                            `Post: "${post.content.substring(0, 50)}..." ` +
                            `Status: ${post.status} | Platforms: ${platformsList}` +
                            (post.published_at ? ` | Published: ${new Date(post.published_at).toLocaleString()}` : '') +
                            (post.scheduled_at ? ` | Scheduled: ${new Date(post.scheduled_at).toLocaleString()}` : ''),
                            { duration: 5000 }
                          );
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {post.platforms.map(platformId => {
                              const platform = PLATFORMS.find(p => p.id === platformId);
                              return platform ? (
                                <div key={platformId} className="flex items-center p-1 bg-white rounded">
                                  <Image 
                                    src={platform.logo} 
                                    alt={platform.name} 
                                    width={16} 
                                    height={16} 
                                    className="object-contain"
                                  />
                                </div>
                              ) : null;
                            })}
                            <Badge className={
                              post.status === 'published' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              post.status === 'scheduled' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                              post.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                            }>
                              {post.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            {post.ai_generated && (
                              <Badge variant="outline" className="text-xs">
                                <Bot className="h-3 w-3 mr-1" />
                                AI
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {post.post_type === 'video' ? <Video className="h-3 w-3" /> : <Type className="h-3 w-3" />}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-sm text-foreground mb-3 line-clamp-3">
                          {post.content}
                        </p>
                        
                        {post.engagement_stats && (
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {post.engagement_stats.likes}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {post.engagement_stats.comments}
                            </span>
                            <span className="flex items-center gap-1">
                              <Repeat2 className="h-3 w-3" />
                              {post.engagement_stats.shares}
                            </span>
                            {post.engagement_stats.views && (
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {post.engagement_stats.views}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </AnimatedBorderCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
              <CardHeader>
                <CardTitle className="text-lg">Analytics Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Posts</span>
                  <span className="font-semibold">{posts.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Published</span>
                  <span className="font-semibold">{posts.filter(p => p.status === 'published').length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Scheduled</span>
                  <span className="font-semibold">{posts.filter(p => p.status === 'scheduled').length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Connected Platforms</span>
                  <span className="font-semibold">{connectedAccounts.filter(acc => acc.is_connected).length}</span>
                </div>
              </CardContent>
            </AnimatedBorderCard>

            {/* Quick Actions */}
            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" onClick={() => setShowAIDialog(true)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Content Generator
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => {
                  setIsCreatingPost(true);
                  setPublishImmediately(true);
                  setIsScheduled(false);
                }}>
                  <Send className="h-4 w-4 mr-2" />
                  Publish Now
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => {
                  setIsCreatingPost(true);
                  setIsScheduled(true);
                  setPublishImmediately(false);
                }}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Posts
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => toast.info('Analytics feature coming soon!')}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => toast.info('Platform settings feature coming soon!')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Platform Settings
                </Button>
              </CardContent>
            </AnimatedBorderCard>
          </div>
        </div>

        {/* Create Post Dialog */}
        <Dialog open={isCreatingPost} onOpenChange={setIsCreatingPost}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {isScheduled ? 'Schedule New Post' : publishImmediately ? 'Publish New Post' : 'Create New Post'}
              </DialogTitle>
              <DialogDescription>
                {isScheduled 
                  ? 'Create content and schedule it for later publication across multiple platforms'
                  : publishImmediately 
                    ? 'Create content and publish immediately across multiple platforms' 
                    : 'Create content for multiple social media platforms'
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Post Type Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Post Type</label>
                <Tabs value={postType} onValueChange={(value: any) => setPostType(value)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="text" className="flex items-center gap-2">
                      <Type className="h-4 w-4" />
                      Text Post
                    </TabsTrigger>
                    <TabsTrigger value="video" className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Video Post
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Platform Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Select Platforms</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map(platform => {
                    const isConnected = getConnectionStatus(platform.id);
                    const isSelected = selectedPlatforms.includes(platform.id);
                    
                    return (
                      <Button
                        key={platform.id}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        disabled={!isConnected}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedPlatforms(prev => prev.filter(p => p !== platform.id));
                            // Reset page selections when deselecting platforms
                            if (platform.id === 'facebook') {
                              setSelectedFacebookPage('');
                            } else if (platform.id === 'instagram') {
                              setSelectedInstagramPage('');
                            } else if (platform.id === 'threads') {
                              setSelectedThreadsPage('');
                            }
                          } else {
                            setSelectedPlatforms(prev => [...prev, platform.id]);
                            // Auto-select first page if available
                            if (platform.id === 'facebook') {
                              const facebookPages = getFacebookPages();
                              if (facebookPages.length > 0) {
                                setSelectedFacebookPage(facebookPages[0].account_id);
                              }
                            } else if (platform.id === 'instagram') {
                              const instagramPages = getInstagramPages();
                              if (instagramPages.length > 0) {
                                setSelectedInstagramPage(instagramPages[0].account_id);
                              }
                            } else if (platform.id === 'threads') {
                              const threadsPages = getThreadsPages();
                              if (threadsPages.length > 0) {
                                setSelectedThreadsPage(threadsPages[0].account_id);
                              }
                            }
                          }
                        }}
                        className="flex items-center gap-2 justify-start"
                      >
                        <div className="flex items-center p-1 bg-white rounded">
                          <Image 
                            src={platform.logo} 
                            alt={platform.name} 
                            width={16} 
                            height={16} 
                            className="object-contain"
                          />
                        </div>
                        <span className="text-xs">{platform.name}</span>
                        {!isConnected && <AlertCircle className="h-3 w-3 text-yellow-500" />}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Facebook Page Selection */}
              {selectedPlatforms.includes('facebook') && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Facebook Page</label>
                  <select
                    value={selectedFacebookPage}
                    onChange={(e) => setSelectedFacebookPage(e.target.value)}
                    className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="">Choose a Facebook page...</option>
                    {getFacebookPages().map(page => (
                      <option key={page.id} value={page.account_id}>
                        {page.account_name.replace(' (Page)', '')}
                      </option>
                    ))}
                  </select>
                  {selectedFacebookPage === '' && (
                    <p className="text-xs text-red-500 mt-1">
                      Please select a Facebook page to post to
                    </p>
                  )}
                </div>
              )}

              {/* Instagram Page Selection */}
              {selectedPlatforms.includes('instagram') && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Instagram Page</label>
                  <select
                    value={selectedInstagramPage}
                    onChange={(e) => setSelectedInstagramPage(e.target.value)}
                    className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="">Choose an Instagram page...</option>
                    {getInstagramPages().map(page => (
                      <option key={page.id} value={page.account_id}>
                        {page.account_name.replace(' (Page)', '')}
                      </option>
                    ))}
                  </select>
                  {selectedInstagramPage === '' && (
                    <p className="text-xs text-red-500 mt-1">
                      Please select an Instagram page to post to
                    </p>
                  )}
                </div>
              )}

              {/* Threads Page Selection */}
              {selectedPlatforms.includes('threads') && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Threads Page</label>
                  <select
                    value={selectedThreadsPage}
                    onChange={(e) => setSelectedThreadsPage(e.target.value)}
                    className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="">Choose a Threads page...</option>
                    {getThreadsPages().map(page => (
                      <option key={page.id} value={page.account_id}>
                        {page.account_name.replace(' (Page)', '')}
                      </option>
                    ))}
                  </select>
                  {selectedThreadsPage === '' && (
                    <p className="text-xs text-red-500 mt-1">
                      Please select a Threads page to post to
                    </p>
                  )}
                </div>
              )}

              {/* Content Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Content</label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAIDialog(true)}
                    >
                      <Bot className="h-4 w-4 mr-1" />
                      AI Generate
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {postContent.length}/{getCharacterCount()}
                    </span>
                  </div>
                </div>
                <Textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="What's happening?"
                  rows={6}
                  maxLength={getCharacterCount()}
                />
              </div>

              {/* Media Upload for Video Posts */}
              {postType === 'video' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Media Files</label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload videos or images for your post
                    </p>
                    <Button variant="outline" size="sm">
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Choose Files
                    </Button>
                  </div>
                </div>
              )}

              {/* Publishing Options */}
              <div className="space-y-3">
                <label className="text-sm font-medium block">Publishing Options</label>
                
                {/* Publish Immediately */}
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="publish-now"
                    name="publishOption"
                    checked={publishImmediately && !isScheduled}
                    onChange={() => {
                      setPublishImmediately(true);
                      setIsScheduled(false);
                    }}
                    className="rounded"
                  />
                  <label htmlFor="publish-now" className="text-sm font-medium">
                    Publish immediately
                  </label>
                </div>

                {/* Save as Draft */}
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="save-draft"
                    name="publishOption"
                    checked={!publishImmediately && !isScheduled}
                    onChange={() => {
                      setPublishImmediately(false);
                      setIsScheduled(false);
                    }}
                    className="rounded"
                  />
                  <label htmlFor="save-draft" className="text-sm font-medium">
                    Save as draft
                  </label>
                </div>

                {/* Schedule for Later */}
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="schedule"
                    name="publishOption"
                    checked={isScheduled}
                    onChange={() => {
                      setIsScheduled(true);
                      setPublishImmediately(false);
                    }}
                    className="rounded"
                  />
                  <label htmlFor="schedule" className="text-sm font-medium">
                    Schedule for later
                  </label>
                </div>
              </div>

              {isScheduled && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Schedule Date & Time</label>
                  <Input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsCreatingPost(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreatePost}>
                  <Send className="h-4 w-4 mr-2" />
                  {isScheduled ? 'Schedule Post' : publishImmediately ? 'Publish Now' : 'Save Draft'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarDemo>
  );
} 