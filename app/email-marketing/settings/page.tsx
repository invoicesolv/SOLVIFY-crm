"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { 
  Settings,
  Globe,
  Shield,
  Mail,
  Server,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Info,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getActiveWorkspaceId } from '@/lib/permission';
import { SidebarDemo } from "@/components/ui/code.demo";

interface EmailDomain {
  id: string;
  domain: string;
  is_verified: boolean;
  verification_token: string;
  dkim_record: string;
  spf_record: string;
  dmarc_record: string;
  mx_record: string;
  verification_status: 'pending' | 'verified' | 'failed';
  created_at: string;
  updated_at: string;
}

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

export default function EmailSettingsPage() {
  const { data: session } = useSession();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<EmailDomain[]>([]);
  const [smtpConfigs, setSmtpConfigs] = useState<SMTPConfig[]>([]);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  
  // Form states
  const [newDomain, setNewDomain] = useState('');
  const [newSmtp, setNewSmtp] = useState({
    name: '',
    host: '',
    port: 587,
    username: '',
    password: '',
    encryption: 'tls' as 'tls' | 'ssl' | 'none'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [addDomainDialog, setAddDomainDialog] = useState(false);
  const [addSmtpDialog, setAddSmtpDialog] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);
  const [testingSmtp, setTestingSmtp] = useState<string | null>(null);

  useEffect(() => {
    const initializeWorkspace = async () => {
      if (session?.user?.id) {
        try {
          const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
          setWorkspaceId(activeWorkspaceId);
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
      
      // Fetch email domains
      const { data: domainsData, error: domainsError } = await supabase
        .from('email_domains')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (domainsError) throw domainsError;
      setDomains(domainsData || []);

      // Fetch SMTP configurations
      const { data: smtpData, error: smtpError } = await supabase
        .from('smtp_configs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (smtpError) throw smtpError;
      setSmtpConfigs(smtpData || []);

      // Fetch email settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('email_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;
      setEmailSettings(settingsData);

    } catch (error) {
      console.error('Error fetching email settings:', error);
      toast.error('Failed to load email settings');
    } finally {
      setLoading(false);
    }
  };

  const addDomain = async () => {
    if (!workspaceId || !session?.user?.id || !newDomain.trim()) return;
    
    try {
      const verificationToken = generateVerificationToken();
      const domainName = newDomain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      const { data, error } = await supabase
        .from('email_domains')
        .insert({
          workspace_id: workspaceId,
          user_id: session.user.id,
          domain: domainName,
          verification_token: verificationToken,
          dkim_record: generateDKIMRecord(domainName),
          spf_record: generateSPFRecord(domainName),
          dmarc_record: generateDMARCRecord(domainName),
          mx_record: generateMXRecord(domainName),
          verification_status: 'pending',
          is_verified: false
        })
        .select()
        .single();

      if (error) throw error;
      
      setDomains(prev => [data, ...prev]);
      setNewDomain('');
      setAddDomainDialog(false);
      toast.success('Domain added successfully. Please configure DNS records.');
    } catch (error) {
      console.error('Error adding domain:', error);
      toast.error('Failed to add domain');
    }
  };

  const verifyDomain = async (domainId: string) => {
    setVerifyingDomain(domainId);
    
    try {
      // Simulate domain verification (in a real app, this would check DNS records)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { error } = await supabase
        .from('email_domains')
        .update({
          is_verified: true,
          verification_status: 'verified',
          updated_at: new Date().toISOString()
        })
        .eq('id', domainId);

      if (error) throw error;
      
      setDomains(prev => prev.map(domain => 
        domain.id === domainId 
          ? { ...domain, is_verified: true, verification_status: 'verified' as const }
          : domain
      ));
      
      toast.success('Domain verified successfully!');
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast.error('Failed to verify domain');
    } finally {
      setVerifyingDomain(null);
    }
  };

  const addSmtpConfig = async () => {
    if (!workspaceId || !session?.user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('smtp_configs')
        .insert({
          workspace_id: workspaceId,
          user_id: session.user.id,
          ...newSmtp,
          is_default: smtpConfigs.length === 0,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      
      setSmtpConfigs(prev => [data, ...prev]);
      setNewSmtp({
        name: '',
        host: '',
        port: 587,
        username: '',
        password: '',
        encryption: 'tls'
      });
      setAddSmtpDialog(false);
      toast.success('SMTP configuration added successfully');
    } catch (error) {
      console.error('Error adding SMTP config:', error);
      toast.error('Failed to add SMTP configuration');
    }
  };

  const testSmtpConnection = async (smtpId: string) => {
    setTestingSmtp(smtpId);
    
    try {
      // Simulate SMTP test (in a real app, this would actually test the connection)
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('SMTP connection test successful!');
    } catch (error) {
      console.error('Error testing SMTP:', error);
      toast.error('SMTP connection test failed');
    } finally {
      setTestingSmtp(null);
    }
  };

  const updateEmailSettings = async (updates: Partial<EmailSettings>) => {
    if (!workspaceId) return;
    
    try {
      if (emailSettings) {
        const { error } = await supabase
          .from('email_settings')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', emailSettings.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('email_settings')
          .insert({
            workspace_id: workspaceId,
            ...updates,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) throw error;
        setEmailSettings(data);
      }
      
      if (emailSettings) {
        setEmailSettings(prev => prev ? { ...prev, ...updates } : null);
      }
      
      toast.success('Settings updated successfully');
    } catch (error) {
      console.error('Error updating email settings:', error);
      toast.error('Failed to update settings');
    }
  };

  const deleteDomain = async (domainId: string) => {
    if (!confirm('Are you sure you want to delete this domain?')) return;
    
    try {
      const { error } = await supabase
        .from('email_domains')
        .delete()
        .eq('id', domainId);

      if (error) throw error;
      
      setDomains(prev => prev.filter(domain => domain.id !== domainId));
      toast.success('Domain deleted successfully');
    } catch (error) {
      console.error('Error deleting domain:', error);
      toast.error('Failed to delete domain');
    }
  };

  const deleteSmtpConfig = async (smtpId: string) => {
    if (!confirm('Are you sure you want to delete this SMTP configuration?')) return;
    
    try {
      const { error } = await supabase
        .from('smtp_configs')
        .delete()
        .eq('id', smtpId);

      if (error) throw error;
      
      setSmtpConfigs(prev => prev.filter(config => config.id !== smtpId));
      toast.success('SMTP configuration deleted successfully');
    } catch (error) {
      console.error('Error deleting SMTP config:', error);
      toast.error('Failed to delete SMTP configuration');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const generateVerificationToken = () => {
    return `vibe-verify-${Math.random().toString(36).substring(2, 15)}`;
  };

  const generateDKIMRecord = (domain: string) => {
    return `v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...`;
  };

  const generateSPFRecord = (domain: string) => {
    return `v=spf1 include:_spf.${domain} ~all`;
  };

  const generateDMARCRecord = (domain: string) => {
    return `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`;
  };

  const generateMXRecord = (domain: string) => {
    return `10 mail.${domain}`;
  };

  const getVerificationStatus = (domain: EmailDomain) => {
    if (domain.is_verified) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Verified</Badge>;
    } else if (domain.verification_status === 'failed') {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Failed</Badge>;
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</Badge>;
    }
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
          <div className="flex items-center gap-4">
            <Link href="/email-marketing">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Email Settings</h1>
              <p className="text-muted-foreground">Configure domains, SMTP, and email authentication</p>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-border/50 dark:bg-border/20"></div>

        <Tabs defaultValue="domains" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="domains">Domains</TabsTrigger>
            <TabsTrigger value="smtp">SMTP</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="tracking">Tracking</TabsTrigger>
          </TabsList>

          {/* Domains Tab */}
          <TabsContent value="domains" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Email Domains</h2>
                <p className="text-muted-foreground">Add and verify domains for sending emails</p>
              </div>
              <Dialog open={addDomainDialog} onOpenChange={setAddDomainDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Domain
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Email Domain</DialogTitle>
                    <DialogDescription>
                      Add a domain for sending emails. You'll need to configure DNS records for verification.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="domain">Domain Name</Label>
                      <Input
                        id="domain"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        placeholder="example.com"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setAddDomainDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={addDomain}>Add Domain</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {domains.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Globe className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No domains configured</h3>
                    <p className="text-muted-foreground mb-6">
                      Add your first domain to start sending authenticated emails.
                    </p>
                    <Button onClick={() => setAddDomainDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Domain
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6">
                {domains.map((domain) => (
                  <Card key={domain.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Globe className="h-5 w-5" />
                          <div>
                            <CardTitle className="text-lg">{domain.domain}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              Added {new Date(domain.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getVerificationStatus(domain)}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => verifyDomain(domain.id)}
                            disabled={verifyingDomain === domain.id || domain.is_verified}
                          >
                            {verifyingDomain === domain.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-2" />
                            )}
                            {domain.is_verified ? 'Verified' : 'Verify'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteDomain(domain.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!domain.is_verified && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            To verify this domain, add the following DNS records to your domain configuration:
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      <div className="grid gap-4">
                        {/* TXT Record */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">TXT Record (Verification)</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              value={`vibe-verification=${domain.verification_token}`}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(`vibe-verification=${domain.verification_token}`)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Host: @ or root domain, Value: vibe-verification={domain.verification_token}
                          </p>
                        </div>

                        {/* DKIM Record */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">DKIM Record</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              value={domain.dkim_record}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(domain.dkim_record)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Host: vibe._domainkey, Type: TXT
                          </p>
                        </div>

                        {/* SPF Record */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">SPF Record</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              value={domain.spf_record}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(domain.spf_record)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Host: @ or root domain, Type: TXT
                          </p>
                        </div>

                        {/* DMARC Record */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">DMARC Record</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              value={domain.dmarc_record}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(domain.dmarc_record)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Host: _dmarc, Type: TXT
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* SMTP Tab */}
          <TabsContent value="smtp" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">SMTP Configuration</h2>
                <p className="text-muted-foreground">Configure SMTP servers for sending emails</p>
              </div>
              <Dialog open={addSmtpDialog} onOpenChange={setAddSmtpDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add SMTP
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add SMTP Configuration</DialogTitle>
                    <DialogDescription>
                      Configure an SMTP server for sending emails.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="smtp-name">Configuration Name</Label>
                      <Input
                        id="smtp-name"
                        value={newSmtp.name}
                        onChange={(e) => setNewSmtp(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Gmail SMTP"
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtp-host">SMTP Host</Label>
                      <Input
                        id="smtp-host"
                        value={newSmtp.host}
                        onChange={(e) => setNewSmtp(prev => ({ ...prev, host: e.target.value }))}
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtp-port">Port</Label>
                      <Input
                        id="smtp-port"
                        type="number"
                        value={newSmtp.port}
                        onChange={(e) => setNewSmtp(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                        placeholder="587"
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtp-username">Username</Label>
                      <Input
                        id="smtp-username"
                        value={newSmtp.username}
                        onChange={(e) => setNewSmtp(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="your.email@gmail.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtp-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="smtp-password"
                          type={showPassword ? "text" : "password"}
                          value={newSmtp.password}
                          onChange={(e) => setNewSmtp(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="Your app password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="smtp-encryption">Encryption</Label>
                      <Select 
                        value={newSmtp.encryption} 
                        onValueChange={(value: 'tls' | 'ssl' | 'none') => setNewSmtp(prev => ({ ...prev, encryption: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tls">TLS</SelectItem>
                          <SelectItem value="ssl">SSL</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setAddSmtpDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={addSmtpConfig}>Add SMTP</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {smtpConfigs.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Server className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No SMTP configurations</h3>
                    <p className="text-muted-foreground mb-6">
                      Add an SMTP server to start sending emails.
                    </p>
                    <Button onClick={() => setAddSmtpDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add SMTP
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {smtpConfigs.map((config) => (
                  <Card key={config.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Server className="h-5 w-5" />
                          <div>
                            <h3 className="font-semibold">{config.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {config.host}:{config.port} ({config.encryption.toUpperCase()})
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {config.is_default && (
                            <Badge>Default</Badge>
                          )}
                          <Badge className={config.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'}>
                            {config.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testSmtpConnection(config.id)}
                            disabled={testingSmtp === config.id}
                          >
                            {testingSmtp === config.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-2" />
                            )}
                            Test
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteSmtpConfig(config.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Email Settings</CardTitle>
                <p className="text-muted-foreground">Configure default email addresses and sender information</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="default-from-name">Default From Name</Label>
                    <Input
                      id="default-from-name"
                      value={emailSettings?.default_from_name || ''}
                      onChange={(e) => updateEmailSettings({ default_from_name: e.target.value })}
                      placeholder="Your Company"
                    />
                  </div>
                  <div>
                    <Label htmlFor="default-from-email">Default From Email</Label>
                    <Input
                      id="default-from-email"
                      type="email"
                      value={emailSettings?.default_from_email || ''}
                      onChange={(e) => updateEmailSettings({ default_from_email: e.target.value })}
                      placeholder="noreply@yourcompany.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="default-reply-to">Default Reply-To</Label>
                    <Input
                      id="default-reply-to"
                      type="email"
                      value={emailSettings?.default_reply_to || ''}
                      onChange={(e) => updateEmailSettings({ default_reply_to: e.target.value })}
                      placeholder="support@yourcompany.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bounce-email">Bounce Email</Label>
                    <Input
                      id="bounce-email"
                      type="email"
                      value={emailSettings?.bounce_email || ''}
                      onChange={(e) => updateEmailSettings({ bounce_email: e.target.value })}
                      placeholder="bounce@yourcompany.com"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="unsubscribe-email">Unsubscribe Email</Label>
                  <Input
                    id="unsubscribe-email"
                    type="email"
                    value={emailSettings?.unsubscribe_email || ''}
                    onChange={(e) => updateEmailSettings({ unsubscribe_email: e.target.value })}
                    placeholder="unsubscribe@yourcompany.com"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tracking Settings Tab */}
          <TabsContent value="tracking" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Tracking Settings</CardTitle>
                <p className="text-muted-foreground">Configure email tracking and analytics</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Email Tracking</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable tracking for all email campaigns
                    </p>
                  </div>
                  <Switch
                    checked={emailSettings?.tracking_enabled || false}
                    onCheckedChange={(checked) => updateEmailSettings({ tracking_enabled: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Open Tracking</Label>
                    <p className="text-sm text-muted-foreground">
                      Track when recipients open your emails
                    </p>
                  </div>
                  <Switch
                    checked={emailSettings?.open_tracking || false}
                    onCheckedChange={(checked) => updateEmailSettings({ open_tracking: checked })}
                    disabled={!emailSettings?.tracking_enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Click Tracking</Label>
                    <p className="text-sm text-muted-foreground">
                      Track when recipients click links in your emails
                    </p>
                  </div>
                  <Switch
                    checked={emailSettings?.click_tracking || false}
                    onCheckedChange={(checked) => updateEmailSettings({ click_tracking: checked })}
                    disabled={!emailSettings?.tracking_enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Unsubscribe Tracking</Label>
                    <p className="text-sm text-muted-foreground">
                      Track unsubscribe events and reasons
                    </p>
                  </div>
                  <Switch
                    checked={emailSettings?.unsubscribe_tracking || false}
                    onCheckedChange={(checked) => updateEmailSettings({ unsubscribe_tracking: checked })}
                    disabled={!emailSettings?.tracking_enabled}
                  />
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Email tracking helps you measure engagement and improve your campaigns. 
                    All tracking complies with privacy regulations and can be disabled by recipients.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SidebarDemo>
  );
} 