"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-client';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { 
  Settings,
  Mail,
  Server,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  Shield,
  Globe,
  Eye,
  EyeOff,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { getActiveWorkspaceId } from '@/lib/permission';
import { SidebarDemo } from "@/components/ui/code.demo";
import { EmailMarketingNav } from '@/components/email-marketing/EmailMarketingNav';

interface SMTPConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'tls' | 'ssl' | 'none';
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

interface EmailSettings {
  id: string;
  workspace_id: string;
  default_from_email: string;
  default_from_name: string;
  default_reply_to: string;
  bounce_email: string;
  unsubscribe_email: string;
  tracking_enabled: boolean;
  open_tracking: boolean;
  click_tracking: boolean;
  unsubscribe_tracking: boolean;
  updated_at: string;
}

interface EmailDomain {
  id: string;
  domain: string;
  is_verified: boolean;
  verification_status: 'pending' | 'verified' | 'failed';
  created_at: string;
}

export default function EmailSettingsPage() {
  const { user, session } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [smtpConfig, setSmtpConfig] = useState<SMTPConfig | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [domain, setDomain] = useState<EmailDomain | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  
  // Form states for Resend configuration
  const [resendApiKey, setResendApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [domainName, setDomainName] = useState('');

  useEffect(() => {
    const initializeWorkspace = async () => {
      if (user?.id) {
        try {
          const activeWorkspaceId = await getActiveWorkspaceId(user.id);
          setWorkspaceId(activeWorkspaceId);
        } catch (error) {
          console.error('Error getting workspace ID:', error);
        }
      }
    };
    
    initializeWorkspace();
  }, [user?.id]);

  useEffect(() => {
    if (workspaceId) {
      fetchData();
    }
  }, [workspaceId]);

  const fetchData = async () => {
    if (!workspaceId) return;
    
    try {
      setLoading(true);
      
      // Fetch SMTP configuration
      const { data: smtpData, error: smtpError } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .single();

      if (smtpError && smtpError.code !== 'PGRST116') throw smtpError;
      setSmtpConfig(smtpData);
      
      if (smtpData) {
        setResendApiKey(smtpData.password || '');
      }

      // Fetch email settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('email_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;
      setEmailSettings(settingsData);
      
      if (settingsData) {
        setFromEmail(settingsData.default_from_email || '');
        setFromName(settingsData.default_from_name || '');
      }

      // Fetch domain
      const { data: domainData, error: domainError } = await supabase
        .from('email_domains')
        .select('*')
        .eq('workspace_id', workspaceId)
        .single();

      if (domainError && domainError.code !== 'PGRST116') throw domainError;
      setDomain(domainData);
      
      if (domainData) {
        setDomainName(domainData.domain || '');
      }

    } catch (error) {
      console.error('Error fetching email settings:', error);
      toast.error('Failed to load email settings');
    } finally {
      setLoading(false);
    }
  };

  const saveResendConfig = async () => {
    if (!workspaceId || !resendApiKey.trim()) {
      toast.error('Please enter your Resend API key');
      return;
    }

    try {
      // Update or create SMTP config
      const { error: smtpError } = await supabase
        .from('smtp_configs')
        .upsert({
          workspace_id: workspaceId,
          name: 'Resend',
          host: 'smtp.resend.com',
          port: 587,
          username: 'resend',
          password: resendApiKey,
          encryption: 'tls',
          is_default: true,
          is_active: true,
          updated_at: new Date().toISOString()
        });

      if (smtpError) throw smtpError;

      // Update or create email settings
      const { error: settingsError } = await supabase
        .from('email_settings')
        .upsert({
          workspace_id: workspaceId,
          default_from_email: fromEmail,
          default_from_name: fromName,
          default_reply_to: fromEmail,
          bounce_email: `bounce@${domainName}`,
          unsubscribe_email: `unsubscribe@${domainName}`,
          tracking_enabled: true,
          open_tracking: true,
          click_tracking: true,
          unsubscribe_tracking: true,
          updated_at: new Date().toISOString()
        });

      if (settingsError) throw settingsError;

      toast.success('Resend configuration saved successfully!');
      await fetchData();
      
    } catch (error) {
      console.error('Error saving Resend config:', error);
      toast.error('Failed to save Resend configuration');
    }
  };

  const testConnection = async () => {
    if (!smtpConfig) {
      toast.error('No SMTP configuration found');
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/email-marketing/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: session?.user?.email || 'test@example.com',
          subject: 'Test Email from Resend',
          html: '<h1>Test Email</h1><p>This is a test email sent from your Resend configuration.</p>',
          workspaceId
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Test email sent successfully! Check your inbox.');
      } else {
        throw new Error(result.error || 'Failed to send test email');
      }
      
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isConfigured = smtpConfig && emailSettings && domain;

  return (
    <SidebarDemo>
      <EmailMarketingNav />
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/email-marketing">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Email Settings</h1>
              <p className="text-muted-foreground">Configure Resend for email marketing</p>
            </div>
          </div>
          {isConfigured && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <CheckCircle className="h-4 w-4 mr-1" />
              Configured
            </Badge>
          )}
        </div>

        <Separator />

        {/* Configuration Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SMTP Status</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {smtpConfig ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Connected to Resend</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Not configured</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Domain Status</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {domain?.is_verified ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{domain.domain} verified</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">Domain not verified</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Email Settings</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {emailSettings ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Configured</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Not configured</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resend Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              <CardTitle>Resend Configuration</CardTitle>
            </div>
            <CardDescription>
              Configure your Resend API key and email settings for sending campaigns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="api-key">Resend API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="api-key"
                    type={showApiKey ? "text" : "password"}
                    value={resendApiKey}
                    onChange={(e) => setResendApiKey(e.target.value)}
                    placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  asChild
                >
                  <a
                    href="https://resend.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Get API Key
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your Resend API key (starts with "re_"). Get one from your Resend dashboard.
              </p>
            </div>

            {/* Domain */}
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
                placeholder="yourdomain.com"
              />
              <p className="text-xs text-muted-foreground">
                The domain you've verified with Resend for sending emails.
              </p>
            </div>

            {/* From Email */}
            <div className="space-y-2">
              <Label htmlFor="from-email">From Email</Label>
              <Input
                id="from-email"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@yourdomain.com"
              />
              <p className="text-xs text-muted-foreground">
                The email address that will appear as the sender of your campaigns.
              </p>
            </div>

            {/* From Name */}
            <div className="space-y-2">
              <Label htmlFor="from-name">From Name</Label>
              <Input
                id="from-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Company"
              />
              <p className="text-xs text-muted-foreground">
                The name that will appear as the sender of your campaigns.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={saveResendConfig}>
                <Settings className="h-4 w-4 mr-2" />
                Save Configuration
              </Button>
              
              {smtpConfig && (
                <Button variant="outline" onClick={testConnection} disabled={testing}>
                  {testing ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Test Connection
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current Configuration Display */}
        {smtpConfig && (
          <Card>
            <CardHeader>
              <CardTitle>Current Configuration</CardTitle>
              <CardDescription>
                Your active email sending configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">SMTP Host</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{smtpConfig.host}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(smtpConfig.host)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Port</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{smtpConfig.port}</code>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Username</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{smtpConfig.username}</code>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Encryption</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{smtpConfig.encryption.toUpperCase()}</code>
                  </div>
                </div>
              </div>
              
              {emailSettings && (
                <div className="mt-6">
                  <Label className="text-sm font-medium">Default From Address</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {emailSettings.default_from_name} &lt;{emailSettings.default_from_email}&gt;
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(emailSettings.default_from_email)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Resend Setup Instructions */}
        {!isConfigured && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>Setup Required</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>To start sending emails, you need to:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Sign up for a Resend account at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">resend.com</a></li>
                <li>Add and verify your domain in the Resend dashboard</li>
                <li>Create an API key with sending permissions</li>
                <li>Enter your API key and domain information above</li>
              </ol>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </SidebarDemo>
  );
} 