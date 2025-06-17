'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarDemo } from "@/components/ui/code.demo";
import { Checkbox } from "@/components/ui/checkbox";
import { useSearchParams } from 'next/navigation';
import { toast } from "sonner";
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { useSession, signIn } from "next-auth/react";
import Image from 'next/image';
import { 
  Settings, 
  Search, 
  BarChart, 
  Calendar, 
  AlertCircle,
  CheckCircle2,
  Receipt,
  FolderOpen,
  Users,
  Inbox,
  CreditCard,
  Brain,
  Zap,
  Globe
} from "lucide-react";
import { saveServiceSettings, getServiceSettings, deleteServiceSettings } from '@/lib/settings';

import { Input } from "@/components/ui/input";

interface AuthService {
  id: string;
  name: string;
  description: string;
  isAuthenticated: boolean;
  icon: React.ReactNode;
  scopes: string[];
  authUrl?: string;
}

interface FortnoxStatus {
  connected: boolean;
  company_info?: {
    CompanyName: string;
    [key: string]: any;
  };
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  
  const [services, setServices] = useState<AuthService[]>([
    {
      id: 'google-analytics',
      name: 'Google Analytics',
      description: 'Track and analyze website traffic and user behavior',
      isAuthenticated: false,
      icon: <BarChart className="h-5 w-5 text-muted-foreground" />,
      scopes: [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/analytics',
        'https://www.googleapis.com/auth/analytics.edit',
        'https://www.googleapis.com/auth/analytics.manage.users',
        'https://www.googleapis.com/auth/analytics.manage.users.readonly'
      ]
    },
    {
      id: 'google-searchconsole',
      name: 'Search Console',
      description: 'Monitor search performance and optimize visibility',
      isAuthenticated: false,
      icon: <Search className="h-5 w-5 text-muted-foreground" />,
      scopes: [
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/webmasters'
      ]
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Manage appointments and schedule events',
      isAuthenticated: false,
      icon: <Calendar className="h-5 w-5 text-muted-foreground" />,
      scopes: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar'
      ]
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      description: 'Store and manage files and reports',
      isAuthenticated: false,
      icon: <FolderOpen className="h-5 w-5 text-muted-foreground" />,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/drive.readonly'
      ]
    },
    {
      id: 'google-gmail',
      name: 'Gmail Lead Hub',
      description: 'Connect Gmail to pull potential leads',
      isAuthenticated: false,
      icon: <Inbox className="h-5 w-5 text-muted-foreground" />,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly']
    }
  ]);

  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [authenticating, setAuthenticating] = useState(false);
  const [fortnoxStatus, setFortnoxStatus] = useState<FortnoxStatus>({ connected: false });
  const [gmailConnected, setGmailConnected] = useState(false);

  // AI Model Configuration
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [claudeModel, setClaudeModel] = useState('claude-3-sonnet');
  const [unsplashApiKey, setUnsplashApiKey] = useState('');
  const [loopiaApiKey, setLoopiaApiKey] = useState('');
  const [loopiaApiUser, setLoopiaApiUser] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Social Media Integration States
  const [socialMediaConnections, setSocialMediaConnections] = useState({
    instagram: false,
    facebook: false,
    threads: false,
    tiktok: false,
    linkedin: false,
    twitter: false,
    youtube: false
  });
  const [socialMediaLoading, setSocialMediaLoading] = useState(false);

  const buttonVariants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  } as const;

  const loadIntegrationStatus = useCallback(async () => {
    if (!session?.user?.id) return;
    
    try {
      const { data: integrations, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) throw error;

      let isGmailConnected = false;
      const verifiedServices = new Set<string>();

      if (integrations && integrations.length > 0) {
        for (const integration of integrations) {
          const expiresAt = new Date(integration.expires_at);
          if (expiresAt <= new Date()) {
            await supabase
              .from('integrations')
              .delete()
              .eq('user_id', session.user.id)
              .eq('service_name', integration.service_name);
            continue;
          }
          if (integration.access_token) {
            verifiedServices.add(integration.service_name);
            if (integration.service_name === 'google-gmail') {
              isGmailConnected = true;
            }
          }
        }
      }

      setServices(prev => prev.map(service => ({ 
        ...service, 
        isAuthenticated: verifiedServices.has(service.id) 
      })));
      setGmailConnected(isGmailConnected);

    } catch (error) {
      console.error("Error loading integrations:", error);
      toast.error('Failed to load integration status');
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      loadIntegrationStatus();
    }
  }, [session, status, loadIntegrationStatus]);

  useEffect(() => {
    const fetchActiveWorkspace = async () => {
      if (!session?.user?.id) return;
      try {
        const response = await fetch('/api/workspace/leave');
        if (response.ok) {
          const data = await response.json();
          const workspaces = data.workspaces || [];
          if (workspaces.length > 0) {
            setCurrentWorkspaceId(workspaces[0].id);
          } else {
            console.log("No active workspace found for user.");
          }
        }
      } catch (error) {
        console.error("Error fetching active workspace ID:", error);
        toast.error("Could not determine active workspace.");
      }
    };

    if (status === "authenticated") {
      fetchActiveWorkspace();
    }
  }, [session, status]);

  useEffect(() => {
    const loadApiKey = async () => {
      if (!currentWorkspaceId) return;
      setApiKeyLoading(true);
      try {
        const { data, error } = await supabase
          .from('workspace_settings')
          .select('openai_api_key, claude_api_key, claude_model, openai_model, unsplash_api_key, loopia_api_key, loopia_api_user, blog_url')
          .eq('workspace_id', currentWorkspaceId)
          .maybeSingle();

        if (error) {
          throw error;
        }
        if (data) {
          if (data.openai_api_key) setOpenaiApiKey(data.openai_api_key);
          if (data.openai_model) setOpenaiModel(data.openai_model);
          if (data.claude_api_key) setClaudeApiKey(data.claude_api_key);
          if (data.claude_model) setClaudeModel(data.claude_model);
          if (data.unsplash_api_key) setUnsplashApiKey(data.unsplash_api_key);
          if (data.loopia_api_key) setLoopiaApiKey(data.loopia_api_key);
          if (data.loopia_api_user) setLoopiaApiUser(data.loopia_api_user);
          if (data.blog_url) setBlogUrl(data.blog_url);
        } else {
          setOpenaiApiKey('');
          setOpenaiModel('gpt-4');
          setClaudeApiKey('');
          setClaudeModel('claude-3-sonnet');
          setUnsplashApiKey('');
          setLoopiaApiKey('');
          setLoopiaApiUser('');
          setBlogUrl('');
        }
      } catch (error) {
        console.error("Error loading API settings:", error);
        toast.error('Failed to load API settings');
      } finally {
        setApiKeyLoading(false);
      }
    };

    if (status === "authenticated" && currentWorkspaceId) {
      loadApiKey();
    }
  }, [session, status, currentWorkspaceId]);

  useEffect(() => {
    // Check for authentication callback
    const authService = searchParams.get('auth');
    const status = searchParams.get('status');
    const tokens = searchParams.get('tokens');

    if (authService && status && tokens && session?.user?.id) {
      if (status === 'success') {
        try {
          const tokenData = JSON.parse(atob(tokens));
          
          // Calculate expiration time
          const now = new Date();
          const expiresAt = new Date(now.getTime() + tokenData.expires_in * 1000);
          
          // Save tokens for each service
          const services = ['google-calendar', 'google-analytics', 'google-searchconsole'];
          Promise.all(services.map(async (service) => {
            const { error } = await supabase
              .from('integrations')
              .upsert({
                user_id: session.user.id,
                service_name: service,
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                scopes: tokenData.scope.split(' '),
                expires_at: expiresAt.toISOString(),
                updated_at: now.toISOString()
              }, {
                onConflict: 'user_id,service_name'
              });

            if (error) {
              throw error;
            }
          }))
          .then(async () => {
            // Force refresh integration status after saving
            await loadIntegrationStatus();
            
            // Clear URL parameters after successful auth
            const url = new URL(window.location.href);
            url.searchParams.delete('auth');
            url.searchParams.delete('status');
            url.searchParams.delete('tokens');
            window.history.replaceState({}, '', url.toString());
            toast.success('Successfully connected services');
          })
          .catch(() => {
            toast.error('Failed to save authentication tokens');
          });
        } catch (error) {
          toast.error('Failed to process authentication response');
        }
      } else {
        toast.error('Failed to authenticate services');
      }
      setAuthenticating(false);
    }
  }, [searchParams, session]);

  useEffect(() => {
    // Check Fortnox connection status
    const checkFortnoxStatus = async () => {
      if (!session?.user?.id) {
        return;
      }

      try {
        const response = await fetch(`/api/fortnox/status`, {
            headers: {
            'Content-Type': 'application/json'
            }
          });
        
        if (!response.ok) {
          setFortnoxStatus({ connected: false });
          return;
        }
        
        const data = await response.json();
        setFortnoxStatus(data);
      } catch (error) {
        console.error('Error checking Fortnox status:', error);
        setFortnoxStatus({ connected: false });
      }
    };

    if (session?.user?.id) {
      checkFortnoxStatus();
    }
  }, [session]);

  const handleToggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const handleAuthenticate = useCallback(async (serviceId?: string) => {
    // Determine scopes needed
    let scopesToRequest: string[] = [];
    if (serviceId) {
      scopesToRequest = services.find(s => s.id === serviceId)?.scopes || [];
    } else {
      // Request *all* potential Google scopes to refresh/grant everything
      scopesToRequest = services
        .filter(s => s.id.startsWith('google-'))
        .flatMap(s => s.scopes)
        .filter(Boolean); 
    }

    // Add standard scopes required by NextAuth/Google
    const baseScopes = ['openid', 'email', 'profile'];
    const allScopes = [...new Set([...baseScopes, ...scopesToRequest])]; // Combine and ensure uniqueness
      
    if (!session?.user?.id) {
      toast.error('Please sign in first');
      return;
    }

    setAuthenticating(true);
    try {
      // Always trigger sign-in with the determined scopes
      await signIn('google', {
        callbackUrl: `/settings`, 
        scope: allScopes.join(' ') // Use the combined unique scopes
      }, { prompt: 'consent' }); 
    } catch (error) {
      toast.error(`Failed to initiate Google authentication`);
      console.error("Google sign-in error:", error);
    } finally {
      setAuthenticating(false); 
    }
  }, [session?.user?.id, services]);

  const handleDisconnectService = useCallback(async (serviceId: string) => {
    if (!session?.user?.id) {
      toast.error('Please sign in first');
      return;
    }
    try {
      await supabase
        .from('integrations')
        .delete()
        .eq('user_id', session.user.id)
        .eq('service_name', serviceId);
      
      if(serviceId === 'google-gmail') setGmailConnected(false);
      setServices(prev => prev.map(service => 
        service.id === serviceId ? { ...service, isAuthenticated: false } : service
      ));

      toast.success(`${services.find(s => s.id === serviceId)?.name || serviceId} disconnected successfully`);
    } catch (error) {
      toast.error(`Failed to disconnect ${serviceId}`);
      console.error("Disconnect error:", error);
    }
  }, [session?.user?.id, services]);

  const handleFortnoxDisconnect = async () => {
    if (!session?.user?.id) {
      toast.error('User authentication required');
      return;
    }

    try {
      // Delete Fortnox settings from Supabase
      const { error } = await supabaseAdmin
        .from('settings')
        .delete()
        .eq('service_name', 'fortnox')
        .eq('user_id', session.user.id);
      
      if (error) {
        console.error('Error disconnecting from Fortnox:', error);
        toast.error('Failed to disconnect from Fortnox');
        return;
      }
      
        setFortnoxStatus({ connected: false });
        toast.success('Successfully disconnected from Fortnox');
    } catch (error) {
      console.error('Error disconnecting from Fortnox:', error);
      toast.error('Failed to disconnect from Fortnox');
    }
  };

  const handleSaveApiKey = async () => {
    if (!currentWorkspaceId) {
      toast.error("No workspace selected. Cannot save settings.");
        return;
    }

    setApiKeyLoading(true);
    try {
      const { error } = await supabase
        .from('workspace_settings')
        .upsert({
          workspace_id: currentWorkspaceId,
          openai_api_key: openaiApiKey,
          openai_model: openaiModel,
          claude_api_key: claudeApiKey,
          claude_model: claudeModel,
          unsplash_api_key: unsplashApiKey,
          loopia_api_key: loopiaApiKey,
          loopia_api_user: loopiaApiUser,
          blog_url: blogUrl,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'workspace_id'
        });

      if (error) throw error;
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error("Error saving API settings:", error);
      toast.error('Failed to save settings');
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }
    
    setPasswordLoading(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }
      
      toast.success('Password changed successfully');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Social Media OAuth Handlers
  const handleSocialMediaConnect = async (platform: string) => {
    setSocialMediaLoading(true);
    try {
      if (platform === 'youtube') {
        // YouTube uses Google OAuth - handle it specially
        if (!session?.user?.id) {
          toast.error('Please log in first');
          setSocialMediaLoading(false);
          return;
        }
        
        try {
          toast.info('Connecting to YouTube...');
          // Import signIn from next-auth/react
          const { signIn } = await import('next-auth/react');
          
          // Use the same pattern as other Google services
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
            callbackUrl: '/settings?success=youtube_connected',
            scope: youtubeScopes.join(' ')
          }, { prompt: 'consent' });
          return;
        } catch (error) {
          console.error('YouTube OAuth error:', error);
          toast.error('Failed to connect YouTube');
          setSocialMediaLoading(false);
          return;
        }
      }
      
      // For other platforms, use the existing OAuth URLs
      const oauthUrls = {
        instagram: '/api/oauth/instagram-business', // Use Instagram Business API (not deprecated Basic Display)
        facebook: '/api/oauth/facebook',
        threads: '/api/oauth/threads',
        tiktok: '/api/oauth/tiktok',
        linkedin: '/api/oauth/linkedin',
        twitter: '/api/oauth/twitter'
      };
      
      const url = oauthUrls[platform as keyof typeof oauthUrls];
      if (url) {
        // Add state parameter for the OAuth flow
        const state = encodeURIComponent(JSON.stringify({ 
          platform: platform, 
          userId: session?.user?.id,
          returnTo: '/settings'
        }));
        window.location.href = `${url}?state=${state}`;
      } else {
        toast.error(`OAuth flow not implemented for ${platform}`);
      }
    } catch (error) {
      console.error(`Error connecting to ${platform}:`, error);
      toast.error(`Failed to connect to ${platform}`);
    } finally {
      setSocialMediaLoading(false);
    }
  };

  const handleSocialMediaDisconnect = async (platform: string) => {
    if (!session?.user?.id) {
      toast.error('Please sign in first');
      return;
    }

    try {
      if (platform === 'youtube') {
        // YouTube is stored in integrations table
        const { error } = await supabase
          .from('integrations')
          .delete()
          .eq('user_id', session.user.id)
          .eq('service_name', 'youtube');

        if (error) throw error;
      } else {
        // Other platforms are in social_accounts table
        const { error } = await supabase
          .from('social_accounts')
          .delete()
          .eq('user_id', session.user.id)
          .eq('platform', platform);

        if (error) throw error;
      }

      setSocialMediaConnections(prev => ({
        ...prev,
        [platform]: false
      }));

      toast.success(`${platform} disconnected successfully`);
    } catch (error) {
      console.error(`Error disconnecting ${platform}:`, error);
      toast.error(`Failed to disconnect ${platform}`);
    }
  };

  // Load social media connection status
  const loadSocialMediaStatus = useCallback(async () => {
    if (!session?.user?.id) return;
    
    try {
      // Get workspace ID first
      let workspaceId = null;
      try {
        const response = await fetch('/api/workspace/leave');
        if (response.ok) {
          const data = await response.json();
          const workspaces = data.workspaces || [];
          if (workspaces.length > 0) {
            workspaceId = workspaces[0].id;
          }
        }
      } catch (error) {
        console.error('Error getting workspace ID:', error);
      }

      // Check social_accounts table for most platforms - use workspace_id if available
      const query = supabase
        .from('social_accounts')
        .select('platform, is_connected');
      
      if (workspaceId) {
        query.eq('workspace_id', workspaceId);
      } else {
        // Fallback to user_id if no workspace found
        query.eq('user_id', session.user.id);
      }
      
      const { data: connections, error } = await query;

      if (error) throw error;

      const connectionStatus = {
        instagram: false,
        facebook: false,
        threads: false,
        tiktok: false,
        linkedin: false,
        twitter: false,
        youtube: false
      };

      connections?.forEach(conn => {
        if (conn.platform && conn.is_connected) {
          // Map 'x' platform to 'twitter' for UI compatibility
          const platformKey = conn.platform === 'x' ? 'twitter' : conn.platform;
          if (platformKey in connectionStatus) {
            connectionStatus[platformKey as keyof typeof connectionStatus] = true;
          }
        }
      });

      // Also check for YouTube connection in integrations table
      const { data: youtubeIntegration, error: youtubeError } = await supabase
        .from('integrations')
        .select('service_name')
        .eq('user_id', session.user.id)
        .eq('service_name', 'youtube')
        .single();

      if (!youtubeError && youtubeIntegration) {
        connectionStatus.youtube = true;
      }

      setSocialMediaConnections(connectionStatus);
    } catch (error) {
      console.error('Error loading social media connections:', error);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      loadSocialMediaStatus();
    }
  }, [session, status, loadSocialMediaStatus]);

  // Handle social media OAuth success/error messages
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success) {
      // Handle different success cases
      switch (success) {
        case 'facebook_connected':
          toast.success('Facebook account connected successfully!');
          break;
        case 'instagram_connected':
          toast.success('Instagram account connected successfully!');
          break;
        case 'linkedin_connected':
          toast.success('LinkedIn account connected successfully!');
          break;
        case 'twitter_connected':
          toast.success('Twitter/X account connected successfully!');
          break;
        case 'youtube_connected':
          toast.success('YouTube account connected successfully!');
          break;
        case 'tiktok_connected':
          toast.success('TikTok account connected successfully!');
          break;
        case 'threads_connected':
          toast.success('Threads account connected successfully!');
          break;
        default:
          toast.success('Account connected successfully!');
      }
      
      // Reload social media connections to update UI
      loadSocialMediaStatus();
      
      // Clear the success parameter from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      window.history.replaceState({}, '', url.toString());
    }
    
    if (error) {
      // Handle different error cases
      switch (error) {
        case 'facebook_auth_failed':
          toast.error('Failed to connect Facebook account. Please try again.');
          break;
        case 'instagram_auth_failed':
          toast.error('Failed to connect Instagram account. Please try again.');
          break;
        case 'instagram_save_failed':
          toast.error('Instagram connection was cancelled or failed to save. Please try again and make sure to grant all required permissions.');
          break;
        case 'instagram_cancelled':
          toast.error('Instagram connection was cancelled. Please try again and grant the required permissions.');
          break;
        case 'instagram_config_missing':
          toast.error('Instagram configuration missing. Please check your environment variables.');
          break;
        case 'no_instagram_business_accounts':
          toast.error('No Instagram Business accounts found. Please connect an Instagram Business account to your Facebook page first.');
          break;
        case 'linkedin_auth_failed':
          toast.error('Failed to connect LinkedIn account. Please try again.');
          break;
        case 'twitter_auth_failed':
          toast.error('Failed to connect Twitter/X account. Please try again.');
          break;
        case 'youtube_auth_failed':
          toast.error('Failed to connect YouTube account. Please try again.');
          break;
        case 'tiktok_auth_failed':
          toast.error('Failed to connect TikTok account. Please try again.');
          break;
        case 'threads_auth_failed':
          toast.error('Failed to connect Threads account. Please try again.');
          break;
        case 'no_code':
          toast.error('Authorization was cancelled or no permission granted.');
          break;
        default:
          toast.error('Failed to connect account. Please try again.');
      }
      
      // Clear the error parameter from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      url.searchParams.delete('details'); // Also clear details if present
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, loadSocialMediaStatus]);

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your account settings and service permissions
            </p>
          </div>
        </div>

        {/* All Integrations Section */}
        <Card className="bg-background border-border">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="h-6 w-6 text-blue-500" />
              <h2 className="text-xl font-bold text-foreground">All Integrations</h2>
            </div>
            <p className="text-muted-foreground mb-6">Connect and configure all your services and AI models in one place</p>
            
            <div className="space-y-6">
              {/* AI Models Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-5 w-5 text-purple-500" />
                  <h3 className="text-lg font-semibold text-foreground">AI Models</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* OpenAI */}
                  <Card className="bg-background border-border">
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 flex items-center justify-center">
                          <Image src="/integration-logos/openai.svg" alt="OpenAI" width={24} height={24} className="object-contain" style={{ width: 'auto', height: '24px' }} />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">OpenAI (ChatGPT)</h4>
                          <p className="text-xs text-muted-foreground">GPT models for AI chat and content generation</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-foreground mb-1 block">Model</label>
                          <select
                            value={openaiModel}
                            onChange={(e) => setOpenaiModel(e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-muted border border-border rounded"
                          >
                            <option value="gpt-4">GPT-4</option>
                            <option value="gpt-4-turbo">GPT-4 Turbo</option>
                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                            <option value="gpt-4o">GPT-4o</option>
                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                          </select>
                        </div>
                        <Input
                          type="password"
                          placeholder="OpenAI API Key"
                          value={openaiApiKey}
                          onChange={(e) => setOpenaiApiKey(e.target.value)}
                          className="text-xs bg-muted border-border"
                        />
                      </div>
                    </div>
                  </Card>

                  {/* Claude */}
                  <Card className="bg-background border-border">
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 flex items-center justify-center">
                          <Image src="/integration-logos/Claude_AI_logo.svg" alt="Claude" width={24} height={24} className="object-contain" style={{ width: 'auto', height: '24px' }} />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">Claude (Anthropic)</h4>
                          <p className="text-xs text-muted-foreground">Advanced AI assistant with longer context</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-foreground mb-1 block">Model</label>
                          <select
                            value={claudeModel}
                            onChange={(e) => setClaudeModel(e.target.value)}
                            className="w-full px-2 py-1 text-xs bg-muted border border-border rounded"
                          >
                            <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                            <option value="claude-3-haiku">Claude 3 Haiku</option>
                            <option value="claude-3-opus">Claude 3 Opus</option>
                            <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                          </select>
                        </div>
                        <Input
                          type="password"
                          placeholder="Claude API Key"
                          value={claudeApiKey}
                          onChange={(e) => setClaudeApiKey(e.target.value)}
                          className="text-xs bg-muted border-border"
                        />
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Google Services Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Image src="/integration-logos/google.png" alt="Google" width={20} height={20} className="object-contain" />
                  <h3 className="text-lg font-semibold text-foreground">Google Services</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Gmail */}
                  <Card className="bg-background border-border">
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 flex items-center justify-center">
                          <Image src="/integration-logos/gmail.svg" alt="Gmail" width={24} height={24} className="object-contain" style={{ width: 'auto', height: '24px' }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-foreground">Gmail Lead Hub</h4>
                            {gmailConnected && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          </div>
                          <p className="text-xs text-muted-foreground">Connect Gmail to pull potential leads</p>
                        </div>
                        {!gmailConnected ? (
                          <Button size="sm" onClick={() => handleAuthenticate()} disabled={authenticating}>
                            {authenticating ? 'Connecting...' : 'Connect'}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-500/10" onClick={() => handleDisconnectService('google-gmail')}>
                            Disconnect
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* Other Google Services */}
                  {[
                    { id: 'google-analytics', name: 'Google Analytics', logo: '/integration-logos/google-analytics.png', desc: 'Website traffic analytics' },
                    { id: 'google-searchconsole', name: 'Search Console', logo: '/integration-logos/search-console-icon.png', desc: 'Search performance monitoring' },
                    { id: 'google-calendar', name: 'Google Calendar', logo: '/integration-logos/google-calendar.svg', desc: 'Calendar and event management' },
                    { id: 'google-drive', name: 'Google Drive', logo: '/integration-logos/google-drive.png', desc: 'File storage and sharing' }
                  ].map(service => {
                    const serviceData = services.find(s => s.id === service.id);
                    return (
                      <Card key={service.id} className="bg-background border-border">
                        <div className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 flex items-center justify-center">
                              <Image src={service.logo} alt={service.name} width={24} height={24} className="object-contain" style={{ width: 'auto', height: '24px' }} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-foreground">{service.name}</h4>
                                {serviceData?.isAuthenticated ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{service.desc}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {serviceData?.isAuthenticated ? 'Connected' : 'Use "Connect" button above'}
                              </p>
                            </div>
                            {serviceData?.isAuthenticated && (
                              <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-500/10" onClick={() => handleDisconnectService(service.id)}>
                                Disconnect
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Business Integrations */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Receipt className="h-5 w-5 text-green-500" />
                  <h3 className="text-lg font-semibold text-foreground">Business Services</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Fortnox */}
                  <Card className="bg-background border-border">
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center">
                          <Image src="/integration-logos/fortnox-icon.svg" alt="Fortnox" width={24} height={24} className="object-contain" style={{ width: 'auto', height: '24px' }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-foreground">Fortnox</h4>
                            {fortnoxStatus.connected && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          </div>
                          <p className="text-xs text-muted-foreground">Access invoices and financial data</p>
                          {fortnoxStatus.connected && fortnoxStatus.company_info && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Connected to: {fortnoxStatus.company_info.CompanyName}
                            </p>
                          )}
                        </div>
                        {!fortnoxStatus.connected ? (
                          <Button size="sm" onClick={() => window.location.href = '/api/fortnox/auth'}>
                            Connect
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-500/10" onClick={handleFortnoxDisconnect}>
                            Disconnect
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              </div>

              {/* Social Media */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold text-foreground">Social Media</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[
                    { platform: 'instagram', name: 'Instagram Business', desc: 'Post photos, videos and stories' },
                    { platform: 'facebook', name: 'Facebook Pages', desc: 'Share content to business page' },
                    { platform: 'threads', name: 'Threads', desc: 'Share text posts and conversations' },
                    { platform: 'tiktok', name: 'TikTok for Business', desc: 'Upload videos to TikTok' },
                    { platform: 'linkedin', name: 'LinkedIn Company', desc: 'Share professional content' },
                    { platform: 'twitter', name: 'X (Twitter)', desc: 'Post tweets and threads' },
                    { platform: 'youtube', name: 'YouTube', desc: 'Upload videos and manage channel' }
                  ].map(social => (
                    <Card key={social.platform} className="bg-background border-border">
                      <div className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center">
                            <Image src={`/social-logos/${social.platform === 'twitter' ? 'x-twitter' : social.platform}.png`} alt={social.name} width={24} height={24} className="object-contain" style={{ width: 'auto', height: '24px' }} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-foreground">{social.name}</h4>
                              {socialMediaConnections[social.platform as keyof typeof socialMediaConnections] && (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{social.desc}</p>
                          </div>
                          {!socialMediaConnections[social.platform as keyof typeof socialMediaConnections] ? (
                            <Button size="sm" onClick={() => handleSocialMediaConnect(social.platform)} disabled={socialMediaLoading}>
                              {socialMediaLoading ? 'Connecting...' : 'Connect'}
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-500/10" onClick={() => handleSocialMediaDisconnect(social.platform)}>
                              Disconnect
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* API Services */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="h-5 w-5 text-orange-500" />
                  <h3 className="text-lg font-semibold text-foreground">API Services</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Unsplash */}
                  <Card className="bg-background border-border">
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 flex items-center justify-center">
                          <Image src="/integration-logos/Unsplash_wordmark_logo.svg.png" alt="Unsplash" width={24} height={24} className="object-contain" style={{ width: 'auto', height: '24px' }} />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">Unsplash</h4>
                          <p className="text-xs text-muted-foreground">High-quality images for content</p>
                        </div>
                      </div>
                      <Input
                        type="password"
                        placeholder="Unsplash API Key"
                        value={unsplashApiKey}
                        onChange={(e) => setUnsplashApiKey(e.target.value)}
                        className="text-xs bg-muted border-border"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Don't have an API key? <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Get one here</a>
                      </p>
                    </div>
                  </Card>

                  {/* Loopia */}
                  <Card className="bg-background border-border">
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 flex items-center justify-center">
                          <Image src="/integration-logos/83fbae5dcce1421a_800x800ar.png" alt="Loopia" width={24} height={24} className="object-contain" style={{ width: 'auto', height: '24px' }} />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">Loopia</h4>
                          <p className="text-xs text-muted-foreground">Domain management and DNS</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Input
                          type="text"
                          placeholder="Loopia API Username"
                          value={loopiaApiUser}
                          onChange={(e) => setLoopiaApiUser(e.target.value)}
                          className="text-xs bg-muted border-border"
                        />
                        <Input
                          type="password"
                          placeholder="Loopia API Password"
                          value={loopiaApiKey}
                          onChange={(e) => setLoopiaApiKey(e.target.value)}
                          className="text-xs bg-muted border-border"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Don't have API credentials? <a href="https://www.loopia.com/api/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Learn more here</a>
                      </p>
                    </div>
                  </Card>

                  {/* Blog Connection */}
                  <Card className="bg-background border-border">
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                          <FolderOpen className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">Blog Connection</h4>
                          <p className="text-xs text-muted-foreground">Connect your blog for publishing</p>
                        </div>
                      </div>
                      <Input
                        type="text"
                        placeholder="Your blog URL (e.g., https://yourblog.com)"
                        value={blogUrl}
                        onChange={(e) => setBlogUrl(e.target.value)}
                        className="text-xs bg-muted border-border"
                      />
                    </div>
                  </Card>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveApiKey}
                  disabled={apiKeyLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {apiKeyLoading ? 'Saving...' : 'Save All Settings'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Account Information */}
        <Card className="bg-background border-border">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-medium text-foreground">Account Information</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Email</label>
                  <p className="text-foreground">{session?.user?.email || 'Not logged in'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Name</label>
                  <p className="text-foreground">{session?.user?.name || 'Not available'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Role</label>
                  <p className="text-foreground">Administrator</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">User ID</label>
                  <p className="text-foreground">{session?.user?.id || 'Not available'}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Account Settings */}
        <Card className="bg-background border-border">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-medium text-foreground">Account Settings</h2>
            </div>
            
            <p className="text-muted-foreground mb-4">
              Manage workspaces and invite team members to collaborate with you
            </p>
            
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => window.location.href = '/settings/team'}
                className="bg-blue-600 hover:bg-blue-500"
              >
                <Users className="h-4 w-4 mr-2" />
                Manage Team
              </Button>

              <Button 
                onClick={() => window.location.href = '/settings/billing'}
                className="bg-violet-600 hover:bg-violet-500"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Billing & Subscription
              </Button>
            </div>
          </div>
        </Card>

        {/* Password Management Section */}
        <Card className="p-6 border-border bg-background">
          <h2 className="mb-6 text-xl font-semibold text-foreground">Password Management</h2>
          
          {!showPasswordForm ? (
            <div>
              <p className="mb-4 text-muted-foreground">
                Change your password or reset it if you've forgotten it.
              </p>
              <Button 
                onClick={() => setShowPasswordForm(true)}
                className="mb-2 bg-blue-600 hover:bg-blue-500 text-foreground"
              >
                Change Password
              </Button>
            </div>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground">
                  Current Password
                </label>
                <Input
                  type="password"
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="newPassword" className="block text-sm font-medium text-foreground">
                  New Password
                </label>
                <Input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  required
                  minLength={8}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  required
                  minLength={8}
                />
              </div>
              
              <div className="flex space-x-2 pt-2">
                <Button 
                  type="submit" 
                  disabled={passwordLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-foreground"
                >
                  {passwordLoading ? 'Changing Password...' : 'Save New Password'}
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="border-border text-neutral-300 hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </SidebarDemo>
  );
}

interface IntegrationCardProps {
  service: AuthService;
  onToggle: () => void;
  buttonVariants: Record<string, string>;
}

function IntegrationCard({ service, onToggle, buttonVariants }: IntegrationCardProps) {
  return (
    <div className="p-4 rounded-lg bg-muted/50">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-md bg-muted">
          {service.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground">{service.name}</h3>
            {service.isAuthenticated ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {service.isAuthenticated ? 'Connected' : 'Not Connected - Click Connect Google'}
          </p>
        </div>
        {service.isAuthenticated && (
          <Button 
            variant="outline" 
            className="text-red-500 hover:bg-red-500/10 hover:text-red-400 border-red-500/20"
            onClick={onToggle}
          >
            Disconnect
          </Button>
        )}
      </div>
    </div>
  );
}

function FortnoxCard({ status, onConnect, onDisconnect, loading, buttonVariants }: {
  status: FortnoxStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  loading: boolean;
  buttonVariants: Record<string, string>;
}) {
  return (
    <div className="p-4 rounded-lg bg-muted/50">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-md bg-muted">
          <Receipt className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground">Fortnox</h3>
            {status.connected && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Access invoices and financial data
          </p>
          {status.connected && status.company_info && (
            <div className="mt-2 text-sm text-muted-foreground">
              Connected to: {status.company_info.CompanyName}
            </div>
          )}
        </div>
        {!status.connected ? (
          <Button
            onClick={onConnect}
            className="ml-4"
          >
            Connect
          </Button>
        ) : (
          <Button
            onClick={onDisconnect}
            variant="outline"
            className="ml-4 bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20"
          >
            Disconnect
          </Button>
        )}
      </div>
    </div>
  );
} 