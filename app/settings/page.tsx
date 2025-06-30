'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarDemo } from "@/components/ui/code.demo";
import { Checkbox } from "@/components/ui/checkbox";
import { useSearchParams } from 'next/navigation';
import { toast } from "sonner";
import { supabaseClient } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-client';
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
  const { user, session } = useAuth();
  
  // Memoize user ID to prevent unnecessary re-renders
  const userId = user?.id;
  const accessToken = session?.access_token;
  
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  
  // Use the existing authenticated Supabase client
  const supabase = supabaseClient;
  
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
      scopes: [
        'https://mail.google.com/'
      ]
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
  const [showLoopiaForm, setShowLoopiaForm] = useState(false);
  const [loopiaAccounts, setLoopiaAccounts] = useState<any[]>([]);
  const [newLoopiaCustomerNumber, setNewLoopiaCustomerNumber] = useState('');
  const [newLoopiaUsername, setNewLoopiaUsername] = useState('');
  const [newLoopiaPassword, setNewLoopiaPassword] = useState('');
  const [loopiaLoading, setLoopiaLoading] = useState(false);

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
    if (!userId || !accessToken) return;
    
    try {
      const { data: integrations, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', userId);

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
              .eq('user_id', userId)
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
  }, [userId, accessToken]);

  useEffect(() => {
    if (accessToken && userId) {
      loadIntegrationStatus();
    }
  }, [accessToken, userId, loadIntegrationStatus]);

  useEffect(() => {
    const fetchActiveWorkspace = async () => {
      if (!userId || currentWorkspaceId) return; // Don't fetch if we already have workspace ID
      try {
        const response = await fetch('/api/workspace/leave', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
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

    if (accessToken && userId && !currentWorkspaceId) { // Only fetch if we don't have workspace ID
      fetchActiveWorkspace();
    }
  }, [accessToken, userId, currentWorkspaceId]);

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

    if (accessToken && currentWorkspaceId) {
      loadApiKey();
    }
  }, [accessToken, currentWorkspaceId]);

  useEffect(() => {
    // Check for authentication callback
    const authService = searchParams.get('auth');
    const status = searchParams.get('status');
    const error = searchParams.get('error');

    if (authService && status && userId) {
      if (status === 'success') {
        // The OAuth route has already saved the tokens to Supabase
        // We just need to refresh the integration status and show success
        loadIntegrationStatus().then(() => {
          // Clear URL parameters after successful auth
          const url = new URL(window.location.href);
          url.searchParams.delete('auth');
          url.searchParams.delete('status');
          url.searchParams.delete('error');
          window.history.replaceState({}, '', url.toString());
          
          // Show success message with service names
          const serviceNames = authService.split(',').map(service => {
            const serviceObj = services.find(s => s.id === service);
            return serviceObj?.name || service;
          }).join(', ');
          
          toast.success(`Successfully connected: ${serviceNames}`);
        }).catch((error) => {
          console.error('Error refreshing integration status:', error);
          toast.error('Connected to services but failed to update status');
        });
      } else if (status === 'error' || error) {
        const errorMessage = error || 'Failed to authenticate services';
        toast.error(`Authentication failed: ${errorMessage}`);
        
        // Clear URL parameters after error
        const url = new URL(window.location.href);
        url.searchParams.delete('auth');
        url.searchParams.delete('status');
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.toString());
      }
      setAuthenticating(false);
    }
  }, [searchParams, accessToken, userId, loadIntegrationStatus, services]);

  useEffect(() => {
    // Check Fortnox connection status
    const checkFortnoxStatus = async () => {
      if (!userId) {
        return;
      }

      try {
        const response = await fetch(`/api/fortnox/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setFortnoxStatus(data);
        } else {
          console.error('Failed to fetch Fortnox status:', response.statusText);
        }
      } catch (error) {
        console.error('Error checking Fortnox status:', error);
      }
    };

    if (userId) {
      checkFortnoxStatus();
    }
  }, [userId]);

  useEffect(() => {
    if (userId && currentWorkspaceId) {
      loadLoopiaAccounts();
    }
  }, [userId, currentWorkspaceId]);

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
    console.log('🔍 Google Auth Debug:', { 
      serviceId, 
      user: userId, 
      session: !!accessToken, 
      access_token: !!accessToken 
    });

    if (!userId) {
      toast.error('Please sign in first');
      return;
    }

    // Determine scopes needed - get current services from state
    let scopesToRequest: string[] = [];
    let servicesToRequest: string[] = [];
    
    if (serviceId) {
      const service = services.find(s => s.id === serviceId);
      scopesToRequest = service?.scopes || [];
      servicesToRequest = [serviceId];
    } else {
      // Request *all* potential Google scopes to refresh/grant everything
      const googleServices = services.filter(s => s.id.startsWith('google-'));
      scopesToRequest = googleServices.flatMap(s => s.scopes).filter(Boolean);
      servicesToRequest = googleServices.map(s => s.id);
    }

    // Add standard scopes required by Google OAuth
    const baseScopes = ['openid', 'email', 'profile'];
    const allScopes = [...new Set([...baseScopes, ...scopesToRequest])]; // Combine and ensure uniqueness

    setAuthenticating(true);
    try {
      // Create state parameter with user ID and services
      const stateData = {
        userId: userId,
        services: servicesToRequest,
        returnTo: '/settings'
      };
      const state = btoa(JSON.stringify(stateData));
      
      // Redirect to OAuth with Google for the selected scopes
      const scopeParam = encodeURIComponent(allScopes.join(' '));
      const authUrl = `/api/oauth/google?scopes=${scopeParam}&state=${state}`;
      
      console.log('🚀 Google OAuth redirect:', { authUrl, scopes: allScopes, services: servicesToRequest });
      toast.info('Redirecting to Google authentication...');
      window.location.href = authUrl;
    } catch (error) {
      console.error("Google authentication error:", error);
      toast.error(`Failed to initiate Google authentication: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setAuthenticating(false); 
    }
  }, [userId, services]);

  const handleDisconnectService = useCallback(async (serviceId: string) => {
    if (!userId) {
      toast.error('Please sign in first');
      return;
    }
    try {
      await supabase
        .from('integrations')
        .delete()
        .eq('user_id', userId)
        .eq('service_name', serviceId);
      
      if(serviceId === 'google-gmail') setGmailConnected(false);
      setServices(prev => prev.map(service => 
        service.id === serviceId ? { ...service, isAuthenticated: false } : service
      ));

      const serviceName = services.find(s => s.id === serviceId)?.name || serviceId;
      toast.success(`${serviceName} disconnected successfully`);
    } catch (error) {
      toast.error(`Failed to disconnect ${serviceId}`);
      console.error("Disconnect error:", error);
    }
  }, [userId, services]);

  const handleFortnoxConnect = async () => {
    console.log('🔍 Fortnox Connect Debug:', { 
      user: userId, 
      session: !!accessToken, 
      access_token: !!accessToken 
    });

    if (!userId) {
      toast.error('Please log in first');
      return;
    }

    if (!accessToken) {
      console.error('No access token available:', accessToken);
      toast.error('Authentication session not available. Please refresh the page.');
      return;
    }

    try {
      console.log('🚀 Making Fortnox auth request...');
      const response = await fetch('/api/fortnox/auth', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Fortnox auth response:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Fortnox auth data:', data);
        
        if (data.authUrl) {
          toast.success('Redirecting to Fortnox authentication...');
          window.location.href = data.authUrl;
        } else {
          throw new Error('No auth URL returned from server');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Fortnox auth error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('💥 Error connecting to Fortnox:', error);
      toast.error(`Failed to connect to Fortnox: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleFortnoxDisconnect = async () => {
    if (!userId) {
      toast.error('User authentication required');
      return;
    }

    try {
      // Delete Fortnox settings from Supabase
      const { error } = await supabase
        .from('settings')
        .delete()
        .eq('service_name', 'fortnox')
        .eq('user_id', userId);
      
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

  const loadLoopiaAccounts = async () => {
    if (!userId || !currentWorkspaceId) return;
    
    try {
      const { data: accounts, error } = await supabase
        .from('loopia_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('workspace_id', currentWorkspaceId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setLoopiaAccounts(accounts || []);
    } catch (error) {
      console.error('Error loading Loopia accounts:', error);
      toast.error('Failed to load Loopia accounts');
    }
  };

  const saveLoopiaAccount = async () => {
    if (!userId || !currentWorkspaceId || !newLoopiaUsername || !newLoopiaPassword || !newLoopiaCustomerNumber) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setLoopiaLoading(true);
    try {
      const { data: account, error } = await supabase
        .from('loopia_accounts')
        .insert({
          user_id: userId,
          workspace_id: currentWorkspaceId,
          username: newLoopiaUsername,
          password: newLoopiaPassword,
          customer_number: newLoopiaCustomerNumber,
          display_name: newLoopiaUsername,
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('An account with this username already exists');
          return;
        }
        throw error;
      }

      setLoopiaAccounts(prev => [...prev, account]);
      setShowLoopiaForm(false);
      setNewLoopiaUsername('');
      setNewLoopiaPassword('');
      setNewLoopiaCustomerNumber('');
      toast.success('Loopia account added successfully!');
    } catch (error) {
      console.error('Error saving Loopia account:', error);
      toast.error('Failed to save Loopia account');
    } finally {
      setLoopiaLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    console.log('🔍 Save API Key Debug:', { 
      currentWorkspaceId, 
      userId, 
      accessToken: !!accessToken,
      hasOpenAI: !!openaiApiKey,
      hasClaude: !!claudeApiKey
    });

    if (!currentWorkspaceId) {
      toast.error("No workspace selected. Cannot save settings.");
      return;
    }

    if (!userId) {
      toast.error("User not authenticated. Please log in again.");
      return;
    }

    setApiKeyLoading(true);
    try {
      console.log('🚀 Attempting to save workspace settings via API...');
      
      const settingsData = {
        workspace_id: currentWorkspaceId,
        openai_api_key: openaiApiKey || null,
        openai_model: openaiModel || 'gpt-4',
        claude_api_key: claudeApiKey || null,
        claude_model: claudeModel || 'claude-3-sonnet',
        unsplash_api_key: unsplashApiKey || null,
        loopia_api_key: loopiaApiKey || null,
        loopia_api_user: loopiaApiUser || null,
        blog_url: blogUrl || null
      };

      console.log('📦 Settings data to save:', { 
        workspace_id: settingsData.workspace_id,
        has_openai: !!settingsData.openai_api_key,
        has_claude: !!settingsData.claude_api_key,
        openai_model: settingsData.openai_model,
        claude_model: settingsData.claude_model
      });

      // Use the create-settings-table API endpoint which already exists
      const response = await fetch('/api/create-settings-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(settingsData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Settings saved successfully:', result);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error("💥 Error saving API settings:", error);
      
      // More specific error messages
      if (error instanceof Error) {
        if (error.message.includes('permission') || error.message.includes('403')) {
          toast.error('Permission denied. Please check your workspace access.');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          toast.error('Network error. Please check your connection.');
        } else if (error.message.includes('401')) {
          toast.error('Authentication error. Please refresh the page and try again.');
        } else {
          toast.error(`Failed to save settings: ${error.message}`);
        }
      } else {
        toast.error('Failed to save settings: Unknown error');
      }
    } finally {
      console.log('🏁 Save operation completed, resetting loading state');
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
          'Authorization': `Bearer ${accessToken}`,
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
    console.log('🔍 Social Media Connect Debug:', { 
      platform, 
      user: userId, 
      session: !!accessToken, 
      access_token: !!accessToken 
    });

    if (!userId) {
      toast.error('Please log in first');
      return;
    }

    setSocialMediaLoading(true);
    try {
      if (platform === 'youtube') {
        // YouTube uses Google OAuth - handle it specially
        try {
          toast.info('Connecting to YouTube...');
          
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
          
          // Redirect to OAuth with Google for YouTube scopes
          const scopeParam = encodeURIComponent(youtubeScopes.join(' '));
          const redirectUrl = `/api/oauth/google?scopes=${scopeParam}&returnTo=/settings?success=youtube_connected`;
          console.log('🚀 YouTube OAuth redirect:', redirectUrl);
          window.location.href = redirectUrl;
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
          userId: userId,
          returnTo: '/settings'
        }));
        const redirectUrl = `${url}?state=${state}`;
        console.log(`🚀 ${platform} OAuth redirect:`, redirectUrl);
        toast.info(`Connecting to ${platform}...`);
        window.location.href = redirectUrl;
      } else {
        console.error(`No OAuth URL configured for platform: ${platform}`);
        toast.error(`OAuth flow not implemented for ${platform}`);
      }
    } catch (error) {
      console.error(`Error connecting to ${platform}:`, error);
      toast.error(`Failed to connect to ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSocialMediaLoading(false);
    }
  };

  const handleSocialMediaDisconnect = async (platform: string) => {
    if (!userId) {
      toast.error('Please sign in first');
      return;
    }

    try {
      if (platform === 'youtube') {
        // YouTube is stored in integrations table
        const { error } = await supabase
          .from('integrations')
          .delete()
          .eq('user_id', userId)
          .eq('service_name', 'youtube');

        if (error) throw error;
      } else {
        // Other platforms are in social_accounts table
        const { error } = await supabase
          .from('social_accounts')
          .delete()
          .eq('user_id', userId)
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

  // Load social media connection status with optimized dependencies
  const loadSocialMediaStatus = useCallback(async () => {
    if (!userId || !currentWorkspaceId) return;
    
    try {
      // Check social_accounts table for most platforms - use workspace_id
      const { data: connections, error } = await supabase
        .from('social_accounts')
        .select('platform, is_connected')
        .eq('workspace_id', currentWorkspaceId);

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
        .eq('user_id', userId)
        .eq('service_name', 'youtube')
        .single();

      if (!youtubeError && youtubeIntegration) {
        connectionStatus.youtube = true;
      }

      setSocialMediaConnections(connectionStatus);
    } catch (error) {
      console.error('Error loading social media connections:', error);
    }
  }, [userId, currentWorkspaceId]);

  useEffect(() => {
    if (accessToken && userId && currentWorkspaceId) {
      loadSocialMediaStatus();
    }
  }, [accessToken, userId, currentWorkspaceId, loadSocialMediaStatus]);

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
  }, [searchParams]);

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
                            <option value="o1">GPT-o1 - Latest reasoning model</option>
                            <option value="o1-mini">GPT-o1-mini - Faster reasoning</option>
                            <option value="o3-mini">GPT-o3-mini - Next-gen reasoning</option>
                            <option value="gpt-4o">GPT-4o - Advanced multimodal</option>
                            <option value="gpt-4o-mini">GPT-4o-mini - Efficient</option>
                            <option value="gpt-4-turbo">GPT-4 Turbo - Enhanced</option>
                            <option value="gpt-4">GPT-4 - Standard</option>
                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo - Fast & cost-effective</option>
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
                                                          <option value="claude-opus-4-20250514">🚀 Claude Opus 4 - Next-generation reasoning</option>
                              <option value="claude-sonnet-4-20250514">🚀 Claude Sonnet 4 - Next-generation reasoning</option>
                            <option value="claude-3-7-sonnet-20250219">🧠 Claude 3.7 Sonnet - Advanced reasoning</option>
                            <option value="claude-3-5-sonnet-20241022">💎 Claude 3.5 Sonnet (Latest) - Superior reasoning</option>
                            <option value="claude-3-5-haiku-20241022">⚡ Claude 3.5 Haiku (Latest) - Fast reasoning</option>
                            <option value="claude-3-opus-20240229">🎯 Claude 3 Opus - Most capable</option>
                            <option value="claude-3-sonnet-20240229">⚖️ Claude 3 Sonnet - Balanced</option>
                            <option value="claude-3-haiku-20240307">🚀 Claude 3 Haiku - Fastest</option>
                            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Legacy)</option>
                            <option value="claude-3-5-haiku">Claude 3.5 Haiku (Legacy)</option>
                            <option value="claude-3-opus">Claude 3 Opus (Legacy)</option>
                            <option value="claude-3-sonnet">Claude 3 Sonnet (Legacy)</option>
                            <option value="claude-3-haiku">Claude 3 Haiku (Legacy)</option>
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
                          <Button size="sm" onClick={handleFortnoxConnect}>
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
                      
                      {!showLoopiaForm ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            {loopiaAccounts.length > 0 ? loopiaAccounts.map((account) => (
                              <div key={account.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
                                <span className="text-foreground">{account.username}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`${account.is_active ? 'text-green-500' : 'text-red-500'}`}>●</span>
                                  <span className="text-muted-foreground">{account.customer_number}</span>
                                </div>
                              </div>
                            )) : (
                              <div className="text-xs text-muted-foreground text-center py-2">
                                No Loopia accounts configured
                              </div>
                            )}
                          </div>
                          
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-xs w-full"
                            onClick={() => setShowLoopiaForm(true)}
                          >
                            Add New Account
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input
                            type="text"
                            placeholder="Loopia API Username"
                            value={newLoopiaUsername}
                            onChange={(e) => setNewLoopiaUsername(e.target.value)}
                            className="text-xs bg-muted border-border"
                          />
                          <Input
                            type="password"
                            placeholder="Loopia API Password"
                            value={newLoopiaPassword}
                            onChange={(e) => setNewLoopiaPassword(e.target.value)}
                            className="text-xs bg-muted border-border"
                          />
                          <Input
                            type="text"
                            placeholder="Customer Number (e.g., FA40-22-85-8581)"
                            value={newLoopiaCustomerNumber}
                            onChange={(e) => setNewLoopiaCustomerNumber(e.target.value)}
                            className="text-xs bg-muted border-border"
                          />
                          <div className="flex gap-2 pt-2">
                            <Button 
                              size="sm" 
                              className="text-xs bg-green-600 hover:bg-green-500"
                              onClick={saveLoopiaAccount}
                              disabled={loopiaLoading}
                            >
                              {loopiaLoading ? 'Adding...' : 'Add Account'}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-xs"
                              onClick={() => {
                                setShowLoopiaForm(false);
                                setNewLoopiaUsername('');
                                setNewLoopiaPassword('');
                                setNewLoopiaCustomerNumber('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                      
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
                  <p className="text-foreground">{user?.email || 'Not logged in'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Name</label>
                  <p className="text-foreground">{user?.name || 'Not available'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Role</label>
                  <p className="text-foreground">Administrator</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">User ID</label>
                  <p className="text-foreground">{user?.id || 'Not available'}</p>
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