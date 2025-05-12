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
  CreditCard
} from "lucide-react";
import { saveServiceSettings, getServiceSettings, deleteServiceSettings } from '@/lib/settings';
import { getActiveWorkspaceId } from '@/lib/permission';
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
      icon: <BarChart className="h-5 w-5 text-neutral-400" />,
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
      icon: <Search className="h-5 w-5 text-neutral-400" />,
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
      icon: <Calendar className="h-5 w-5 text-neutral-400" />,
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
      icon: <FolderOpen className="h-5 w-5 text-neutral-400" />,
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
      icon: <Inbox className="h-5 w-5 text-neutral-400" />,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly']
    }
  ]);

  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [authenticating, setAuthenticating] = useState(false);
  const [fortnoxStatus, setFortnoxStatus] = useState<FortnoxStatus>({ connected: false });
  const [gmailConnected, setGmailConnected] = useState(false);

  const [openaiApiKey, setOpenaiApiKey] = useState('');
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
        const wsId = await getActiveWorkspaceId(session.user.id);
        setCurrentWorkspaceId(wsId);
        if (!wsId) {
          console.log("No active workspace found for user.");
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
          .select('openai_api_key, unsplash_api_key, loopia_api_key, loopia_api_user, blog_url')
          .eq('workspace_id', currentWorkspaceId)
          .maybeSingle();

        if (error) {
          throw error;
        }
        if (data) {
          if (data.openai_api_key) setOpenaiApiKey(data.openai_api_key);
          if (data.unsplash_api_key) setUnsplashApiKey(data.unsplash_api_key);
          if (data.loopia_api_key) setLoopiaApiKey(data.loopia_api_key);
          if (data.loopia_api_user) setLoopiaApiUser(data.loopia_api_user);
          if (data.blog_url) setBlogUrl(data.blog_url);
        } else {
          setOpenaiApiKey('');
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

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white">Settings</h1>
            <p className="text-sm text-neutral-400">
              Manage your account settings and service permissions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Google Integration Column */}
          <Card className="bg-neutral-900 border-neutral-800">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5 text-neutral-400" />
                <h2 className="text-lg font-medium text-white">Google Integrations</h2>
              </div>
              
              <div className="space-y-4">
                {/* Gmail Specific Card */}
                <div className="p-4 rounded-lg bg-neutral-800/50">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-md bg-neutral-700">
                      <Inbox className="h-5 w-5 text-neutral-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">Gmail Lead Hub</h3>
                        {gmailConnected && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-neutral-400">Connect Gmail to pull potential leads.</p>
                    </div>
                    {!gmailConnected ? (
                      <Button
                        onClick={() => handleAuthenticate()} // Generic connect triggers re-auth with all scopes
                        disabled={authenticating}
                      >
                        {authenticating ? 'Connecting...' : 'Connect Google'}
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        className="text-red-500 hover:bg-red-500/10 hover:text-red-400 border-red-500/20"
                        onClick={() => handleDisconnectService('google-gmail')}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                </div>

                {/* Other Google Services - Display Status Only */}
                {services.filter(s => s.id !== 'google-gmail' && s.id.startsWith('google-')).map(service => (
                   <div
                    key={service.id}
                    className="p-4 rounded-lg bg-neutral-800/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-md bg-neutral-700">
                        {service.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white">{service.name}</h3>
                          {service.isAuthenticated ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        <p className="text-sm text-neutral-400">
                          {service.isAuthenticated ? 'Connected' : 'Not Connected - Click Connect Google'}
                        </p>
                      </div>
                       {service.isAuthenticated && (
                         <Button 
                            variant="outline" 
                            className="text-red-500 hover:bg-red-500/10 hover:text-red-400 border-red-500/20"
                            onClick={() => handleDisconnectService(service.id)}
                          >
                            Disconnect
                          </Button>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Fortnox Integration Column */}
          <Card className="bg-neutral-900 border-neutral-800">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Receipt className="h-5 w-5 text-neutral-400" />
                <h2 className="text-lg font-medium text-white">Fortnox Integration</h2>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-neutral-800/50">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-md bg-neutral-700">
                      <Receipt className="h-5 w-5 text-neutral-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">Fortnox</h3>
                        {fortnoxStatus.connected && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-neutral-400">
                        Access invoices and financial data
                      </p>
                      {fortnoxStatus.connected && fortnoxStatus.company_info && (
                        <div className="mt-2 text-sm text-neutral-400">
                          Connected to: {fortnoxStatus.company_info.CompanyName}
                        </div>
                      )}
                    </div>
                    {!fortnoxStatus.connected ? (
                      <Button
                        onClick={() => window.location.href = '/api/fortnox/auth'}
                        className="ml-4"
                      >
                        Connect
                      </Button>
                    ) : (
                      <Button
                        onClick={handleFortnoxDisconnect}
                        variant="outline"
                        className="ml-4 bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20"
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="bg-neutral-900 border-neutral-800">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-neutral-400" />
              <h2 className="text-lg font-medium text-white">Account Information</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-neutral-400">Email</label>
                  <p className="text-white">{session?.user?.email || 'Not logged in'}</p>
                </div>
                <div>
                  <label className="text-sm text-neutral-400">Name</label>
                  <p className="text-white">{session?.user?.name || 'Not available'}</p>
                </div>
                <div>
                  <label className="text-sm text-neutral-400">Role</label>
                  <p className="text-white">Administrator</p>
                </div>
                <div>
                  <label className="text-sm text-neutral-400">User ID</label>
                  <p className="text-white">{session?.user?.id || 'Not available'}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-neutral-900 border-neutral-800">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-neutral-400" />
              <h2 className="text-lg font-medium text-white">Account Settings</h2>
            </div>
            
            <p className="text-neutral-400 mb-4">
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
        <section className="mb-12">
          <Card className="p-6 border-neutral-800 bg-neutral-900">
            <h2 className="mb-6 text-xl font-semibold text-white">Password Management</h2>
            
            {!showPasswordForm ? (
              <div>
                <p className="mb-4 text-neutral-400">
                  Change your password or reset it if you've forgotten it.
                </p>
                <Button 
                  onClick={() => setShowPasswordForm(true)}
                  className="mb-2 bg-blue-600 hover:bg-blue-500 text-white"
                >
                  Change Password
                </Button>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-neutral-200">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    id="currentPassword"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="newPassword" className="block text-sm font-medium text-neutral-200">
                    New Password
                  </label>
                  <Input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                    required
                    minLength={8}
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-200">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                    required
                    minLength={8}
                  />
                </div>
                
                <div className="flex space-x-2 pt-2">
                  <Button 
                    type="submit" 
                    disabled={passwordLoading}
                    className="bg-blue-600 hover:bg-blue-500 text-white"
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
                    className="border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </section>

        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-white">AI Configuration</h3>
          <p className="text-neutral-500 mb-6">Configure your OpenAI API key for chatbot features.</p>
          <div className="space-y-4">
            <Card className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between bg-neutral-900 border-neutral-800">
              <div className="flex items-start space-x-4 mb-4 md:mb-0">
                <div>
                  <h4 className="font-medium text-white">OpenAI API Key</h4>
                  <p className="text-sm text-neutral-500">
                    Used for powering AI chat functionalities within your workspace.
                  </p>
                </div>
              </div>
              <div className="w-full md:w-auto flex flex-col md:flex-row items-stretch md:items-center gap-2">
                <Input
                  type="password"
                  placeholder="Enter your OpenAI API Key"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  disabled={apiKeyLoading || !currentWorkspaceId}
                  className="flex-grow bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                />
                <Button 
                  onClick={handleSaveApiKey} 
                  disabled={apiKeyLoading || !currentWorkspaceId}
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white"
                  variant="default"
                >
                  {apiKeyLoading ? 'Saving...' : 'Save Key'}
                </Button>
              </div>
            </Card>
            {!currentWorkspaceId && status === 'authenticated' && (
              <p className="text-sm text-destructive">Please select a workspace to manage the API key.</p> 
            )}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold text-neutral-200 mb-4">External API Integrations</h2>
          
          {/* OpenAI API Key */}
          <Card className="bg-neutral-900 border-neutral-800 mb-4">
            <div className="px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-neutral-100">OpenAI API Key</h3>
                <p className="text-sm text-neutral-400 mt-1">Used for content generation</p>
              </div>
            </div>
            <div className="px-6 pb-5 flex flex-col space-y-3">
              <Input
                className="bg-neutral-800 border-neutral-700 text-neutral-200"
                type="password"
                placeholder="Enter your OpenAI API key"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
              />
            </div>
          </Card>
          
          {/* Unsplash API Key */}
          <Card className="bg-neutral-900 border-neutral-800 mb-4">
            <div className="px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-neutral-100">Unsplash API Key</h3>
                <p className="text-sm text-neutral-400 mt-1">Used for fetching images in content generation</p>
              </div>
            </div>
            <div className="px-6 pb-5 flex flex-col space-y-3">
              <Input
                className="bg-neutral-800 border-neutral-700 text-neutral-200"
                type="password"
                placeholder="Enter your Unsplash API key"
                value={unsplashApiKey}
                onChange={(e) => setUnsplashApiKey(e.target.value)}
              />
              <p className="text-xs text-neutral-500">
                Don't have an Unsplash API key? <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Get one here</a>
              </p>
            </div>
          </Card>
          
          {/* Loopia API */}
          <Card className="bg-neutral-900 border-neutral-800 mb-4">
            <div className="px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-neutral-100">Loopia API Access</h3>
                <p className="text-sm text-neutral-400 mt-1">Used for domain management</p>
              </div>
            </div>
            <div className="px-6 pb-5 flex flex-col space-y-3">
              <Input
                className="bg-neutral-800 border-neutral-700 text-neutral-200"
                type="text"
                placeholder="Loopia API Username"
                value={loopiaApiUser}
                onChange={(e) => setLoopiaApiUser(e.target.value)}
              />
              <Input
                className="bg-neutral-800 border-neutral-700 text-neutral-200"
                type="password"
                placeholder="Loopia API Password"
                value={loopiaApiKey}
                onChange={(e) => setLoopiaApiKey(e.target.value)}
              />
              <p className="text-xs text-neutral-500">
                Don't have Loopia API credentials? <a href="https://www.loopia.com/api/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Learn more here</a>
              </p>
            </div>
          </Card>
          
          {/* Blog URL */}
          <Card className="bg-neutral-900 border-neutral-800 mb-4">
            <div className="px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-neutral-100">Blog Connection</h3>
                <p className="text-sm text-neutral-400 mt-1">Connect your blog to publish content directly</p>
              </div>
            </div>
            <div className="px-6 pb-5 flex flex-col space-y-3">
              <Input
                className="bg-neutral-800 border-neutral-700 text-neutral-200"
                type="text"
                placeholder="Your blog URL (e.g., https://yourblog.com)"
                value={blogUrl}
                onChange={(e) => setBlogUrl(e.target.value)}
              />
              <p className="text-xs text-neutral-500">
                This URL will be used for publishing content from the Content Generator
              </p>
            </div>
          </Card>
          
          <Button
            className={buttonVariants.default}
            onClick={handleSaveApiKey}
            disabled={apiKeyLoading}
          >
            {apiKeyLoading ? 'Saving...' : 'Save All Settings'}
          </Button>
        </div>
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
    <div className="p-4 rounded-lg bg-neutral-800/50">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-md bg-neutral-700">
          {service.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white">{service.name}</h3>
            {service.isAuthenticated ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            )}
          </div>
          <p className="text-sm text-neutral-400">
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
    <div className="p-4 rounded-lg bg-neutral-800/50">
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-md bg-neutral-700">
          <Receipt className="h-5 w-5 text-neutral-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white">Fortnox</h3>
            {status.connected && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </div>
          <p className="text-sm text-neutral-400">
            Access invoices and financial data
          </p>
          {status.connected && status.company_info && (
            <div className="mt-2 text-sm text-neutral-400">
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