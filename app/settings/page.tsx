'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarDemo } from "@/components/ui/code.demo";
import { Checkbox } from "@/components/ui/checkbox";
import { useSearchParams } from 'next/navigation';
import { toast } from "sonner";
import { supabase } from '@/lib/supabase';
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
  Users
} from "lucide-react";
import { saveServiceSettings, getServiceSettings, deleteServiceSettings } from '@/lib/settings';

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
    }
  ]);

  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [authenticating, setAuthenticating] = useState(false);
  const [fortnoxStatus, setFortnoxStatus] = useState<FortnoxStatus>({ connected: false });

  const buttonVariants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  } as const;

  useEffect(() => {
    if (status === "loading") return;
    
    if (!session?.user?.id) {
      console.error('No user session found');
      toast.error('User authentication required');
      return;
    }
    
    console.log('Using user ID:', session.user.id);
    loadIntegrationStatus();
  }, [session, status]);

  const loadIntegrationStatus = async () => {
    if (!session?.user?.id) {
      console.log('No user session found');
      return;
    }
    
    try {
      console.log('Loading integration status for user:', session.user.id);
      const { data: integrations, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) {
        console.error('Error fetching integrations:', error);
        throw error;
      }

      console.log('Raw integrations data:', integrations);

      if (integrations && integrations.length > 0) {
        console.log('Found integrations:', integrations.length);
        const verifiedServices = new Set<string>();
        
        for (const integration of integrations) {
          console.log('Processing integration:', {
            service: integration.service_name,
            hasToken: !!integration.access_token,
            expiresAt: integration.expires_at
          });

          // Skip expired tokens
          const expiresAt = new Date(integration.expires_at);
          if (expiresAt <= new Date()) {
            console.log(`Token expired for ${integration.service_name}`);
            // Delete expired integration
            await supabase
              .from('integrations')
              .delete()
              .eq('user_id', session.user.id)
              .eq('service_name', integration.service_name);
            continue;
          }

          // Add to verified services if token exists and not expired
          if (integration.access_token) {
            verifiedServices.add(integration.service_name);
            console.log(`Service ${integration.service_name} is authenticated`);
          } else {
            console.log(`Service ${integration.service_name} is missing access token`);
          }
        }
        
        // Update services state with verification results
        setServices(prev => {
          const updated = prev.map(service => {
            const isAuth = verifiedServices.has(service.id);
            console.log(`Setting ${service.id} authentication status to:`, isAuth);
            return {
              ...service,
              isAuthenticated: isAuth
            };
          });
          console.log('Updated services state:', updated);
          return updated;
        });
      } else {
        console.log('No integrations found');
        // Reset all services to unauthenticated state
        setServices(prev => prev.map(service => ({ ...service, isAuthenticated: false })));
      }
    } catch (error) {
      console.error('Error loading integration status:', error);
      toast.error('Failed to load integration status');
    }
  };

  useEffect(() => {
    // Check for authentication callback
    const authService = searchParams.get('auth');
    const status = searchParams.get('status');
    const tokens = searchParams.get('tokens');

    console.log('Auth callback params:', { authService, status, tokens: tokens ? 'present' : 'absent' });

    if (authService && status && tokens && session?.user?.id) {
      if (status === 'success') {
        try {
          const tokenData = JSON.parse(atob(tokens));
          console.log('Token data received:', { 
            service: authService, 
            scopes: tokenData.scope,
            expires_in: tokenData.expires_in,
            access_token: tokenData.access_token ? 'present' : 'absent',
            refresh_token: tokenData.refresh_token ? 'present' : 'absent'
          });
          
          // Calculate expiration time
          const now = new Date();
          const expiresAt = new Date(now.getTime() + tokenData.expires_in * 1000);
          
          // Save tokens for each service
          const services = ['google-calendar', 'google-analytics', 'google-searchconsole'];
          Promise.all(services.map(async (service) => {
            console.log(`Saving integration for ${service}...`);
            const { data, error } = await supabase
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
              console.error(`Failed to save integration for ${service}:`, error);
              throw error;
            } else {
              console.log(`Successfully saved integration for ${service}`);
            }
          }))
          .then(async () => {
            // Verify the integrations were saved
            const { data: savedIntegrations, error: fetchError } = await supabase
              .from('integrations')
              .select('*')
              .eq('user_id', session.user.id);
            
            console.log('Saved integrations:', savedIntegrations);
            
            if (fetchError) {
              console.error('Error fetching saved integrations:', fetchError);
            }
            
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
          .catch(error => {
            console.error('Failed to save tokens:', error);
            toast.error('Failed to save authentication tokens');
          });
        } catch (error) {
          console.error('Error processing authentication:', error);
          toast.error('Failed to process authentication response');
        }
      } else {
        console.error('Authentication failed:', status);
        toast.error('Failed to authenticate services');
      }
      setAuthenticating(false);
    }
  }, [searchParams, session]);

  useEffect(() => {
    // Check Fortnox connection status
    const checkFortnoxStatus = async () => {
      if (!session?.user?.id) {
        console.error('No user session found for Fortnox check');
        return;
      }

      try {
        // Get Fortnox settings from Supabase
        const settings = await getServiceSettings('fortnox', session.user.id);
        if (settings?.access_token) {
          // Verify the token
          const response = await fetch('http://localhost:5001/fortnox/status', {
            headers: {
              'Authorization': `Bearer ${settings.access_token}`
            }
          });
          const data = await response.json();
          setFortnoxStatus({
            connected: true,
            company_info: data
          });
        } else {
          setFortnoxStatus({ connected: false });
        }
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

  const handleAuthenticate = async () => {
    if (selectedServices.size === 0) {
      toast.error('Please select at least one service to authenticate');
      return;
    }

    if (!session?.user?.id) {
      toast.error('Please sign in first');
      return;
    }

    setAuthenticating(true);

    try {
      console.log('Starting authentication for services:', Array.from(selectedServices));
      
      // Get all required scopes for selected services
      const requiredScopes = Array.from(selectedServices).reduce((acc: string[], serviceId) => {
        const service = services.find(s => s.id === serviceId);
        if (service) {
          console.log(`Adding scopes for ${serviceId}:`, service.scopes);
          acc.push(...service.scopes);
        }
        return acc;
      }, []);

      console.log('Required scopes:', requiredScopes);

      // Start Google OAuth flow with all required scopes
      await signIn('google', {
        callbackUrl: `/settings`,
        redirect: true,
        scope: requiredScopes.join(' ')
      });

    } catch (error) {
      console.error('Authentication error:', error);
      toast.error('Failed to authenticate with selected services');
      setAuthenticating(false);
    }
  };

  // Handle the OAuth callback
  useEffect(() => {
    const handleAuthCallback = async () => {
      const authService = searchParams.get('auth');
      const status = searchParams.get('status');
      
      if (authService && status === 'success' && session?.user?.id) {
        try {
          // Update services state to reflect authentication
          const authenticatedServices = authService.split(',');
          setServices(prev => prev.map(service => ({
            ...service,
            isAuthenticated: authenticatedServices.includes(service.id)
          })));

          // Save to Supabase
          for (const serviceId of authenticatedServices) {
            await supabase.from('integrations').upsert({
              user_id: session.user.id,
              service_name: serviceId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }

          toast.success('Services connected successfully');
        } catch (error) {
          console.error('Error handling auth callback:', error);
          toast.error('Failed to complete service integration');
        }
      }
    };

    handleAuthCallback();
  }, [searchParams, session]);

  const handleDisconnectService = async (serviceId: string) => {
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

      setServices(prev => prev.map(service => 
        service.id === serviceId ? { ...service, isAuthenticated: false } : service
      ));

      toast.success(`${serviceId} disconnected successfully`);
    } catch (error) {
      console.error('Error disconnecting service:', error);
      toast.error(`Failed to disconnect ${serviceId}`);
    }
  };

  const handleFortnoxDisconnect = async () => {
    if (!session?.user?.id) {
      console.error('No user session found for Fortnox disconnect');
      toast.error('User authentication required');
      return;
    }

    try {
      // Delete Fortnox settings from Supabase
      await deleteServiceSettings('fortnox', session.user.id);
      
      // Call the disconnect endpoint
      const response = await fetch('http://localhost:5001/fortnox/disconnect', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setFortnoxStatus({ connected: false });
        toast.success('Successfully disconnected from Fortnox');
      } else {
        toast.error('Failed to disconnect from Fortnox');
      }
    } catch (error) {
      console.error('Error disconnecting from Fortnox:', error);
      toast.error('Failed to disconnect from Fortnox');
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

        <div className="grid grid-cols-2 gap-6">
          {/* Google Integration Column */}
          <Card className="bg-neutral-900 border-neutral-800">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5 text-neutral-400" />
                <h2 className="text-lg font-medium text-white">Google Integration</h2>
              </div>
              
              <div className="space-y-4">
                {services.filter(service => service.id.startsWith('google-')).map(service => (
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
                          {service.isAuthenticated && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-sm text-neutral-400">{service.description}</p>
                      </div>
                      {!service.isAuthenticated && (
                        <Checkbox
                          id={service.id}
                          checked={selectedServices.has(service.id)}
                          onCheckedChange={() => handleToggleService(service.id)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedServices.size > 0 && (
                <div className="mt-6">
                  <Button
                    onClick={handleAuthenticate}
                    disabled={authenticating}
                    className="w-full"
                  >
                    {authenticating ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-neutral-400 border-t-white" />
                        Authenticating...
                      </div>
                    ) : (
                      `Authenticate Selected Services (${selectedServices.size})`
                    )}
                  </Button>
                </div>
              )}
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
                        onClick={() => window.location.href = 'http://localhost:5001/fortnox/auth'}
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
              <h2 className="text-lg font-medium text-white">Team Management</h2>
            </div>
            
            <p className="text-neutral-400 mb-4">
              Manage workspaces and invite team members to collaborate with you
            </p>
            
            <Button 
              onClick={() => window.location.href = '/settings/team'}
              className="bg-blue-600 hover:bg-blue-500"
            >
              <Users className="h-4 w-4 mr-2" />
              Manage Team
            </Button>
          </div>
        </Card>
      </div>
    </SidebarDemo>
  );
} 