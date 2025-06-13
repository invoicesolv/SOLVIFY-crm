'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Clock, Database, Globe, Zap, Mail, Calendar, FileText, Users, DollarSign, BarChart3, Settings, Shield } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface StatusCheck {
  name: string;
  description: string;
  status: 'healthy' | 'warning' | 'error' | 'checking';
  responseTime?: number;
  lastChecked?: Date;
  details?: string;
  icon: any;
  category: string;
}

export default function StatusPage() {
  const { data: session } = useSession();
  const [checks, setChecks] = useState<StatusCheck[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const initialChecks: StatusCheck[] = [
    // Database & Core
    { name: 'Supabase Database', description: 'Main database connection', status: 'checking', icon: Database, category: 'Core' },
    { name: 'Authentication', description: 'NextAuth & Supabase Auth', status: 'checking', icon: Shield, category: 'Core' },
    { name: 'Workspace API', description: 'Workspace management', status: 'checking', icon: Users, category: 'Core' },
    
    // External APIs
    { name: 'Fortnox API', description: 'Accounting integration', status: 'checking', icon: DollarSign, category: 'External APIs' },
    { name: 'Google Analytics', description: 'Analytics data', status: 'checking', icon: BarChart3, category: 'External APIs' },
    { name: 'Google Search Console', description: 'SEO data', status: 'checking', icon: Globe, category: 'External APIs' },
    { name: 'Gmail API', description: 'Email integration', status: 'checking', icon: Mail, category: 'External APIs' },
    { name: 'Google Calendar', description: 'Calendar integration', status: 'checking', icon: Calendar, category: 'External APIs' },
    { name: 'Facebook API', description: 'Social media integration', status: 'checking', icon: Globe, category: 'External APIs' },
    
    // CRM Functions
    { name: 'Customer Management', description: 'Customer CRUD operations', status: 'checking', icon: Users, category: 'CRM Functions' },
    { name: 'Project Management', description: 'Project tracking', status: 'checking', icon: FileText, category: 'CRM Functions' },
    { name: 'Invoice Management', description: 'Invoice operations', status: 'checking', icon: DollarSign, category: 'CRM Functions' },
    { name: 'Lead Management', description: 'Lead tracking & automation', status: 'checking', icon: Users, category: 'CRM Functions' },
    { name: 'Email Marketing', description: 'Campaign management', status: 'checking', icon: Mail, category: 'CRM Functions' },
    { name: 'Content Generation', description: 'AI content creation', status: 'checking', icon: Zap, category: 'CRM Functions' },
    
    // System Health
    { name: 'Cron Jobs', description: 'Scheduled tasks', status: 'checking', icon: Clock, category: 'System' },
    { name: 'File Storage', description: 'Document management', status: 'checking', icon: FileText, category: 'System' },
    { name: 'Settings Management', description: 'Configuration storage', status: 'checking', icon: Settings, category: 'System' },
  ];

  useEffect(() => {
    setChecks(initialChecks);
    runHealthChecks();
  }, []);

  const runHealthChecks = async () => {
    setIsRefreshing(true);
    const updatedChecks = [...initialChecks];

    // Run all checks in parallel
    const checkPromises = updatedChecks.map(async (check, index) => {
      const startTime = Date.now();
      
      try {
        let result;
        
        switch (check.name) {
          case 'Supabase Database':
            result = await fetch('/api/health-check');
            break;
          case 'Authentication':
            result = await fetch('/api/auth/debug/auth-status');
            break;
          case 'Workspace API':
            result = await fetch('/api/workspace/leave');
            break;
          case 'Fortnox API':
            result = await fetch('/api/fortnox/status');
            break;
          case 'Google Analytics':
            result = await fetch('/api/analytics/verify');
            break;
          case 'Google Search Console':
            result = await fetch('/api/search-console');
            break;
          case 'Gmail API':
            result = await fetch('/api/gmail');
            break;
          case 'Google Calendar':
            result = await fetch('/api/calendar');
            break;
          case 'Facebook API':
            result = await fetch('/api/debug/facebook-comprehensive');
            break;
          case 'Customer Management':
            result = await fetch('/api/customers');
            break;
          case 'Project Management':
            result = await fetch('/api/project-folders');
            break;
          case 'Invoice Management':
            result = await fetch('/api/invoices/save', { method: 'GET' });
            break;
          case 'Lead Management':
            result = await fetch('/api/lead-folders');
            break;
          case 'Email Marketing':
            result = await fetch('/api/newsletter-signup', { method: 'GET' });
            break;
          case 'Content Generation':
            result = await fetch('/api/generate-content', { method: 'GET' });
            break;
          case 'Cron Jobs':
            result = await fetch('/api/cron/test');
            break;
          case 'File Storage':
            result = await fetch('/api/drive');
            break;
          case 'Settings Management':
            result = await fetch('/api/supabase-check');
            break;
          default:
            throw new Error('Unknown check');
        }

        const responseTime = Date.now() - startTime;
        
        if (result.ok) {
          updatedChecks[index] = {
            ...check,
            status: 'healthy',
            responseTime,
            lastChecked: new Date(),
            details: `Response: ${result.status}`
          };
        } else {
          updatedChecks[index] = {
            ...check,
            status: 'warning',
            responseTime,
            lastChecked: new Date(),
            details: `HTTP ${result.status}: ${result.statusText}`
          };
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;
        updatedChecks[index] = {
          ...check,
          status: 'error',
          responseTime,
          lastChecked: new Date(),
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    await Promise.all(checkPromises);
    setChecks(updatedChecks);
    setLastRefresh(new Date());
    setIsRefreshing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'checking':
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Warning</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Error</Badge>;
      case 'checking':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Checking</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Unknown</Badge>;
    }
  };

  const getOverallStatus = () => {
    const errorCount = checks.filter(c => c.status === 'error').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;
    const healthyCount = checks.filter(c => c.status === 'healthy').length;
    
    if (errorCount > 0) return 'error';
    if (warningCount > 0) return 'warning';
    if (healthyCount === checks.length) return 'healthy';
    return 'checking';
  };

  const groupedChecks = checks.reduce((acc, check) => {
    if (!acc[check.category]) {
      acc[check.category] = [];
    }
    acc[check.category].push(check);
    return acc;
  }, {} as Record<string, StatusCheck[]>);

  if (!session) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
              <p className="text-gray-600">Please log in to view the system status.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Status</h1>
          <p className="text-gray-600 mt-1">
            Real-time health monitoring for all CRM functions
          </p>
        </div>
        <Button 
          onClick={runHealthChecks} 
          disabled={isRefreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Checking...' : 'Refresh All'}
        </Button>
      </div>

      {/* Overall Status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(getOverallStatus())}
              <div>
                <h2 className="text-xl font-semibold">Overall System Status</h2>
                <p className="text-gray-600">
                  {lastRefresh ? `Last checked: ${lastRefresh.toLocaleTimeString()}` : 'Not checked yet'}
                </p>
              </div>
            </div>
            {getStatusBadge(getOverallStatus())}
          </div>
          
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {checks.filter(c => c.status === 'healthy').length}
              </div>
              <div className="text-sm text-gray-600">Healthy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {checks.filter(c => c.status === 'warning').length}
              </div>
              <div className="text-sm text-gray-600">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {checks.filter(c => c.status === 'error').length}
              </div>
              <div className="text-sm text-gray-600">Errors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {checks.filter(c => c.status === 'checking').length}
              </div>
              <div className="text-sm text-gray-600">Checking</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Checks by Category */}
      {Object.entries(groupedChecks).map(([category, categoryChecks]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {category === 'Core' && <Database className="h-5 w-5" />}
              {category === 'External APIs' && <Globe className="h-5 w-5" />}
              {category === 'CRM Functions' && <Users className="h-5 w-5" />}
              {category === 'System' && <Settings className="h-5 w-5" />}
              {category}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {categoryChecks.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <check.icon className="h-5 w-5 text-gray-500" />
                    <div>
                      <h3 className="font-medium">{check.name}</h3>
                      <p className="text-sm text-gray-600">{check.description}</p>
                      {check.details && (
                        <p className="text-xs text-gray-500 mt-1">{check.details}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {check.responseTime && (
                      <span className="text-xs text-gray-500">
                        {check.responseTime}ms
                      </span>
                    )}
                    {getStatusIcon(check.status)}
                    {getStatusBadge(check.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 