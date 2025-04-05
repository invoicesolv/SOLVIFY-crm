'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Globe,
  ArrowUpRight,
  Search as SearchIcon,
  Upload,
  RefreshCw,
  Save,
  Info,
  XCircle,
  AlertTriangle,
  CheckCircle,
  CirclePlus,
  Download,
  FileUp,
  HelpCircle,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from '@/lib/supabase';
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import punycode from 'punycode';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { checkPermission } from '@/lib/permission';

interface DomainData {
  domain: string;
  domain_rating?: number;
  traffic_value?: number;
  organic_traffic?: number;
  referring_domains?: number;
  organic_keywords?: number;
  source: 'ahrefs' | 'Loopia';
  last_updated: string;
  workspace_id?: string;
  expiry_date?: string;
  auto_renew?: boolean;
  status?: string;
  error?: string;
  loopia_account?: string;
  customer_number?: string;
  normalized_domain?: string;
  original_domain?: string;
  display_domain?: string;
  lStatus?: string;
}

interface Filters {
  minDomainRating: number;
  minTrafficValue: number;
  minKeywords: number;
}

interface DomainStatusInfo {
  status: string;
  statusColor: string;
  tooltip: string;
}

interface SortConfig {
  key: keyof DomainData | null;
  direction: 'asc' | 'desc';
}

export default function DomainsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [hasEditPermission, setHasEditPermission] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Filters>({
    minDomainRating: 0,
    minTrafficValue: 0,
    minKeywords: 0
  });
  const [syncController, setSyncController] = useState<AbortController | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: 'asc'
  });

  const normalizeDomain = (domain: string): { normalized: string; display: string } => {
    try {
      const cleanDomain = domain.replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
      const normalized = cleanDomain.startsWith('xn--') ? cleanDomain : punycode.toASCII(cleanDomain);
      const display = cleanDomain.startsWith('xn--') ? punycode.toUnicode(cleanDomain) : cleanDomain;
      return { normalized, display };
    } catch (e) {
      return { normalized: domain.toLowerCase(), display: domain.toLowerCase() };
    }
  };

  // Check user's permission to view and edit domains
  useEffect(() => {
    const checkUserPermissions = async () => {
      if (!session?.user?.id || !session?.user?.email) return;
      
      try {
        setPermissionLoading(true);
        
        // First, get the active workspace
        // Check both user_id and email to handle cases where IDs don't match
        const { data: teamMembersById } = await supabase
          .from('team_members')
          .select('workspace_id, is_admin, permissions')
          .eq('user_id', session.user.id);
          
        const { data: teamMembersByEmail } = await supabase
          .from('team_members')
          .select('workspace_id, is_admin, permissions')
          .eq('email', session.user.email);
          
        // Combine results from both queries
        const allTeamMembers = [
          ...(teamMembersById || []),
          ...(teamMembersByEmail || [])
        ];
        
        // Remove duplicates (if any)
        const uniqueTeamMembers = allTeamMembers.filter((member, index, self) =>
          index === self.findIndex((m) => m.workspace_id === member.workspace_id)
        );
        
        if (uniqueTeamMembers.length === 0) {
          setHasPermission(false);
          setHasEditPermission(false);
          return;
        }
        
        // Get first workspace ID or active one if set previously
        const workspaceId = activeWorkspace || uniqueTeamMembers[0].workspace_id;
        setActiveWorkspace(workspaceId);
        
        // Continue with permission checking...
        const viewPermission = await checkPermission(
          session.user.id,
          workspaceId,
          'view_domains'
        );
        
        const editPermission = await checkPermission(
          session.user.id,
          workspaceId,
          'edit_domains'
        );
        
        setHasPermission(viewPermission);
        setHasEditPermission(editPermission);
      } catch (error) {
        setHasPermission(false);
        setHasEditPermission(false);
      } finally {
        setPermissionLoading(false);
      }
    };
    
    checkUserPermissions();
  }, [session?.user?.id, activeWorkspace]);

  const loadDomains = async () => {
    if (!hasPermission || !activeWorkspace) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Ensure we have a string workspace ID for all operations
      const workspaceId = activeWorkspace;
      
      let allDomains: DomainData[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: domains, error } = await supabase
          .from('domains')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('domain', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        allDomains = [...allDomains, ...domains];
        hasMore = domains.length === pageSize;
        page++;
      }

      const domainGroups: Record<string, DomainData[]> = {};
      allDomains.forEach(domain => {
        const normalized = domain.normalized_domain || normalizeDomain(domain.domain).normalized;
        if (!domainGroups[normalized]) domainGroups[normalized] = [];
        domainGroups[normalized].push({
          ...domain,
          normalized_domain: normalized,
          original_domain: domain.original_domain || domain.domain,
          display_domain: domain.display_domain || normalizeDomain(domain.domain).display
        });
      });

      const mergedDomains = Object.entries(domainGroups).map(([key, group]) => {
        const ahrefs = group.find(d => d.source === 'ahrefs');
        const loopia = group.find(d => d.source === 'Loopia');

        if (ahrefs && loopia) {
          return {
            domain: loopia.display_domain || ahrefs.display_domain,
            display_domain: loopia.display_domain || ahrefs.display_domain,
            normalized_domain: key,
            original_domain: ahrefs.original_domain || ahrefs.domain,
            domain_rating: ahrefs.domain_rating,
            traffic_value: ahrefs.traffic_value,
            organic_traffic: ahrefs.organic_traffic,
            referring_domains: ahrefs.referring_domains,
            organic_keywords: ahrefs.organic_keywords,
            source: 'ahrefs' as const,
            last_updated: ahrefs.last_updated,
            expiry_date: loopia.expiry_date,
            auto_renew: loopia.auto_renew,
            status: loopia.status,
            loopia_account: loopia.loopia_account,
            customer_number: loopia.customer_number,
            error: loopia.error,
            workspace_id: workspaceId
          } as DomainData;
        }
        return ahrefs || loopia;
      }).filter((domain): domain is DomainData => domain !== null);

      setDomains(mergedDomains);
    } catch (error) {
      toast.error('Failed to load domains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionLoading && hasPermission) {
      loadDomains();
    }
  }, [permissionLoading, hasPermission, activeWorkspace]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasEditPermission) {
      toast.error('You do not have permission to add domains');
      return;
    }
    
    if (!activeWorkspace) {
      toast.error('No active workspace selected');
      return;
    }
    
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Ensure we have a string workspace ID for all operations
    const workspaceId = activeWorkspace;

    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n');
      let headerLine = '';
      let dataLines: string[] = [];
      let headerFound = false;

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (!headerFound) {
          headerLine += trimmedLine;
          if (headerLine.includes('Target') && headerLine.includes('Domain Rating')) {
            headerFound = true;
          }
        } else if (trimmedLine.match(/^[#§\d]/)) {
          dataLines.push(trimmedLine);
        }
      }

      if (!headerFound) throw new Error('Invalid CSV format: Header not found');

      const headers = headerLine.split(',').map(h => h.trim());
      const parsedRows = dataLines.map(line => line.split(',').map(cell => cell.trim()));

      const newDomains = parsedRows
        .filter(row => row.length >= headers.length && row.some(cell => cell.trim()))
        .map(row => {
          const record: { [key: string]: string } = {};
          headers.forEach((header, index) => {
            record[header] = row[index]?.trim() || '';
          });
          const { normalized, display } = normalizeDomain(record['Target'] || '');
          return {
            domain: display,
            display_domain: display,
            normalized_domain: normalized,
            original_domain: record['Target'] || '',
            domain_rating: parseFloat(record['Domain Rating'] || '0'),
            traffic_value: parseFloat(record['Traffic Value'] || '0'),
            organic_traffic: parseInt(record['Total Traffic (desc)'] || '0'),
            referring_domains: parseInt(record['Ref domains Dofollow'] || '0'),
            organic_keywords: parseInt(record['Total Keywords'] || '0'),
            source: 'ahrefs' as const,
            last_updated: new Date().toISOString(),
            workspace_id: workspaceId
          };
        });

      setDomains(prev => {
        const updatedGroups: Record<string, DomainData[]> = {};
        [...prev, ...newDomains].forEach(domain => {
          const normalized = domain.normalized_domain || normalizeDomain(domain.domain).normalized;
          if (!updatedGroups[normalized]) updatedGroups[normalized] = [];
          updatedGroups[normalized].push(domain);
        });

        return Object.entries(updatedGroups).map(([key, group]) => {
          const ahrefs = group.find(d => d.source === 'ahrefs');
          const loopia = group.find(d => d.source === 'Loopia');

          if (ahrefs && loopia) {
            return {
              domain: loopia.display_domain || ahrefs.display_domain,
              display_domain: loopia.display_domain || ahrefs.display_domain,
              normalized_domain: key,
              original_domain: ahrefs.original_domain || ahrefs.domain,
              domain_rating: ahrefs.domain_rating,
              traffic_value: ahrefs.traffic_value,
              organic_traffic: ahrefs.organic_traffic,
              referring_domains: ahrefs.referring_domains,
              organic_keywords: ahrefs.organic_keywords,
              source: 'ahrefs' as const,
              last_updated: ahrefs.last_updated,
              expiry_date: loopia.expiry_date,
              auto_renew: loopia.auto_renew,
              status: loopia.status,
              loopia_account: loopia.loopia_account,
              customer_number: loopia.customer_number,
              error: loopia.error,
              workspace_id: workspaceId
            } as DomainData;
          }
          return ahrefs || loopia;
        }).filter((domain): domain is DomainData => domain !== null);
      });
      toast.success(`Successfully uploaded ${newDomains.length} domains`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to parse CSV file');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const filteredDomains = React.useMemo(() => {
    return domains.filter(domain => {
      const displayDomain = domain.display_domain || domain.domain;
      const normalizedDomain = domain.normalized_domain || normalizeDomain(domain.domain).normalized;

      // Normalize Unicode for consistent search
      const searchLower = searchTerm.toLowerCase().normalize('NFC');
      const matchesSearch = searchTerm === '' || 
        displayDomain.toLowerCase().normalize('NFC').includes(searchLower) ||
        normalizedDomain.toLowerCase().normalize('NFC').includes(searchLower) ||
        domain.domain.toLowerCase().normalize('NFC').includes(searchLower);

      const dr = Number(domain.domain_rating) || 0;
      const tv = Number(domain.traffic_value) || 0;
      const kw = Number(domain.organic_keywords) || 0;

      const matchesFilters = 
        dr >= filters.minDomainRating &&
        tv >= filters.minTrafficValue &&
        kw >= filters.minKeywords;

      return matchesSearch && matchesFilters;
    });
  }, [domains, searchTerm, filters]);

  const sortedDomains = React.useMemo(() => {
    const sorted = [...filteredDomains];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aValue = a[sortConfig.key as keyof DomainData];
        let bValue = b[sortConfig.key as keyof DomainData];

        if (sortConfig.key === 'domain') {
          aValue = a.display_domain || a.domain;
          bValue = b.display_domain || b.domain;
        } else if (sortConfig.key === 'status') {
          aValue = getDomainStatusInfo(a).status;
          bValue = getDomainStatusInfo(b).status;
        } else if (sortConfig.key === 'expiry_date' || sortConfig.key === 'last_updated') {
          aValue = aValue ? new Date(aValue as string).getTime() : 0;
          bValue = bValue ? new Date(bValue as string).getTime() : 0;
        }

        const numericFields = [
          'domain_rating',
          'traffic_value',
          'organic_traffic',
          'referring_domains',
          'organic_keywords',
        ];
        if (sortConfig.key && numericFields.includes(sortConfig.key)) {
          aValue = Number(aValue) || 0;
          bValue = Number(bValue) || 0;
        }

        if (aValue === null || aValue === undefined) {
          aValue = typeof bValue === 'number' ? 0 : '';
        }
        if (bValue === null || bValue === undefined) {
          bValue = typeof aValue === 'number' ? 0 : '';
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [filteredDomains, sortConfig]);

  const handleSort = (key: keyof DomainData) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleDomainAction = async (domain: string, action: 'order' | 'renew', account?: string) => {
    if (!hasEditPermission) {
      toast.error('You do not have permission to modify domains');
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch('/api/domains/loopia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          domain,
          accountUsername: account
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Operation failed');
      }

      toast.success(result.message);
      await loadDomains(); // Refresh the domain list
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action} domain`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDomains = async () => {
    if (!hasEditPermission) {
      toast.error('You do not have permission to modify domains');
      return;
    }
    
    if (domains.length === 0) {
      toast.error('No domains to save');
      return;
    }
    
    if (!activeWorkspace) {
      toast.error('No active workspace selected');
      return;
    }
    
    // Ensure we have a string workspace ID for all operations
    const workspaceId = activeWorkspace;

    setLoading(true);
    try {
      const upsertData = domains.map(domain => ({
        domain: domain.normalized_domain || normalizeDomain(domain.domain).normalized,
        display_domain: domain.display_domain || normalizeDomain(domain.domain).display,
        original_domain: domain.original_domain || domain.domain,
        workspace_id: workspaceId,
        domain_rating: domain.domain_rating,
        traffic_value: domain.traffic_value,
        organic_traffic: domain.organic_traffic,
        referring_domains: domain.referring_domains,
        organic_keywords: domain.organic_keywords,
        source: domain.source,
        last_updated: domain.last_updated,
        expiry_date: domain.expiry_date,
        auto_renew: domain.auto_renew,
        status: domain.status,
        loopia_account: domain.loopia_account,
        customer_number: domain.customer_number,
        error: domain.error,
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('domains')
        .upsert(upsertData, { onConflict: 'domain,workspace_id,source' });

      if (error) throw error;

      toast.success(`Saved ${domains.length} domains`);
      await loadDomains();
    } catch (error) {
      toast.error('Failed to save domains');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExample = () => {
    const csvContent = `Target,Domain Rating,Traffic Value,Total Traffic (desc),Ref domains Dofollow,Total Keywords
example.com,85,15000,25000,1500,12000
domain.com,75,12000,18000,1200,8000`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'ahrefs_example.csv';
    link.click();
  };

  const syncLoopiaData = async () => {
    if (!hasEditPermission) {
      toast.error('You do not have permission to sync domain data');
      return;
    }
    
    if (syncing) {
      syncController?.abort();
      setSyncController(null);
      setSyncing(false);
      return;
    }

    setSyncing(true);
    setLoading(true);
    const controller = new AbortController();
    setSyncController(controller);

    try {
      const response = await fetch('/api/domains/loopia', { signal: controller.signal });
      if (!response.ok) throw new Error('Failed to sync with Loopia');
      const result = await response.json();

      await loadDomains();

      if (result.completed) {
        toast.success('Successfully synced domains with Loopia');
      } else {
        toast.info(result.message || 'Sync cancelled');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('Sync cancelled');
      } else {
        toast.error('Failed to sync with Loopia');
      }
    } finally {
      setLoading(false);
      setSyncing(false);
      setSyncController(null);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (syncing) {
      interval = setInterval(async () => {
        try {
          if (!activeWorkspace) {
            return;
          }
          
          const { data: fetchedDomains, error } = await supabase
            .from('domains')
            .select('*')
            .eq('workspace_id', activeWorkspace)
            .order('domain', { ascending: true });

          if (error) throw error;

          setDomains(prevDomains => {
            // Create a map of existing domains by normalized domain
            const existingDomainsMap = new Map<string, DomainData>();
            prevDomains.forEach(domain => {
              const normalized = domain.normalized_domain || normalizeDomain(domain.domain).normalized;
              existingDomainsMap.set(normalized, domain);
            });

            // Process fetched domains
            fetchedDomains.forEach((domain: any) => {
              const normalized = domain.normalized_domain || normalizeDomain(domain.domain).normalized;
              const existing = existingDomainsMap.get(normalized);

              if (domain.source === 'Loopia') {
                if (existing) {
                  // Update existing domain with Loopia data
                  existingDomainsMap.set(normalized, {
                    ...existing,
                    expiry_date: domain.expiry_date,
                    auto_renew: domain.auto_renew,
                    status: domain.status,
                    lStatus: domain.status,
                    loopia_account: domain.loopia_account,
                    customer_number: domain.customer_number,
                    error: domain.error
                  });
                } else {
                  // Add new Loopia domain
                  existingDomainsMap.set(normalized, {
                    ...domain,
                    normalized_domain: normalized,
                    display_domain: normalizeDomain(domain.domain).display,
                    domain_rating: 0,
                    traffic_value: 0,
                    organic_traffic: 0,
                    referring_domains: 0,
                    organic_keywords: 0
                  });
                }
              } else if (domain.source === 'ahrefs') {
                if (!existing) {
                  // Add new Ahrefs domain
                  existingDomainsMap.set(normalized, {
                    ...domain,
                    normalized_domain: normalized,
                    display_domain: normalizeDomain(domain.domain).display
                  });
                }
              }
            });

            const mergedDomains = Array.from(existingDomainsMap.values());
            return mergedDomains;
          });
        } catch (error) {
          // Error handling is silent during sync
        }
      }, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [syncing, activeWorkspace]);

  const getDomainStatusInfo = (domain: DomainData): DomainStatusInfo => {
    const displayDomain = domain.display_domain || 
      (domain.domain.startsWith('xn--') ? punycode.toUnicode(domain.domain) : domain.domain);

    if (domain.lStatus || domain.loopia_account) {
      const expiryDate = domain.expiry_date ? new Date(domain.expiry_date) : null;
      const daysUntilExpiry = expiryDate ? 
        Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
      const accountInfo = domain.loopia_account ? ` (${domain.loopia_account})` : '';

      if (daysUntilExpiry !== null) {
        if (daysUntilExpiry <= 0) {
          return { status: `Expired${accountInfo}`, statusColor: 'red', tooltip: `Expired on ${domain.expiry_date}` };
        } else if (daysUntilExpiry <= 30) {
          return { status: `Expires in ${daysUntilExpiry} days${accountInfo}`, statusColor: 'yellow', tooltip: `Expires on ${domain.expiry_date}` };
        } else {
          return { status: `Active${accountInfo}`, statusColor: 'emerald', tooltip: `Expires on ${domain.expiry_date}` };
        }
      }
      return { status: `Active${accountInfo}`, statusColor: 'emerald', tooltip: 'Domain registered in Loopia' };
    }
    return { status: 'Not in Loopia', statusColor: 'neutral', tooltip: 'Domain not found in Loopia' };
  };

  // Render content based on permissions
  if (status === 'loading' || permissionLoading) {
    return (
      <SidebarDemo>
        <div className="p-6 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </SidebarDemo>
    );
  }

  if (!session?.user) {
    router.push('/login');
    return null;
  }

  if (!hasPermission) {
    return (
      <SidebarDemo>
        <div className="p-6">
          <Card className="p-8 bg-neutral-800 border-neutral-700">
            <h1 className="text-xl font-semibold text-white mb-4">Access Denied</h1>
            <p className="text-neutral-400">
              You do not have permission to view the domains page. Please contact your workspace administrator.
            </p>
          </Card>
        </div>
      </SidebarDemo>
    );
  }

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white">Domain Portfolio</h1>
            <p className="text-sm text-neutral-400">
              Manage and monitor your domain metrics from Ahrefs and Loopia
            </p>
          </div>
        </div>

        <Card className="bg-neutral-900 border-neutral-800">
          <div className="p-6">
            <div className="flex flex-col gap-6">
              <div className="bg-neutral-800/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-400" />
                  <h3 className="text-sm font-medium text-white">CSV Upload Instructions</h3>
                </div>
                <div className="text-sm text-neutral-400 space-y-2">
                  <p>1. Export your domains from Ahrefs in CSV format</p>
                  <p>2. Ensure the CSV is saved with UTF-8 encoding</p>
                  <p>3. Required columns: Target, Domain Rating, Traffic Value, Total Traffic (desc), Ref domains Dofollow, Total Keywords</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadExample}
                      className="text-xs bg-neutral-800 border-neutral-700 hover:bg-neutral-700"
                    >
                      Download Example CSV
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white">Filters</h3>
                <div className="grid grid-cols-3 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-neutral-400">Min Domain Rating</Label>
                      <span className="text-sm text-neutral-400">{filters.minDomainRating}</span>
                    </div>
                    <Slider
                      value={[filters.minDomainRating]}
                      onValueChange={(value: number[]) => setFilters(prev => ({ ...prev, minDomainRating: value[0] }))}
                      max={100}
                      step={1}
                      className="[&_[role=slider]]:bg-blue-500"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-neutral-400">Min Traffic Value ($)</Label>
                      <span className="text-sm text-neutral-400">${filters.minTrafficValue.toLocaleString()}</span>
                    </div>
                    <Slider
                      value={[filters.minTrafficValue]}
                      onValueChange={(value: number[]) => setFilters(prev => ({ ...prev, minTrafficValue: value[0] }))}
                      max={100000}
                      step={100}
                      className="[&_[role=slider]]:bg-green-500"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-neutral-400">Min Keywords</Label>
                      <span className="text-sm text-neutral-400">{filters.minKeywords.toLocaleString()}</span>
                    </div>
                    <Slider
                      value={[filters.minKeywords]}
                      onValueChange={(value: number[]) => setFilters(prev => ({ ...prev, minKeywords: value[0] }))}
                      max={50000}
                      step={100}
                      className="[&_[role=slider]]:bg-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative w-64">
                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <Input
                      placeholder="Search domains..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-neutral-800 border-neutral-700 focus:border-neutral-600 text-white placeholder:text-neutral-400"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('ahrefs-upload')?.click()}
                    className="flex items-center gap-2 bg-neutral-800 border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Ahrefs Data
                  </Button>
                  <input
                    type="file"
                    id="ahrefs-upload"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    variant="outline"
                    onClick={syncLoopiaData}
                    className={`flex items-center gap-2 ${
                      syncing 
                        ? 'bg-red-900/20 border-red-700 hover:bg-red-900/40 hover:border-red-600'
                        : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Stop Sync' : 'Sync Loopia Domains'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSaveDomains}
                    className="flex items-center gap-2 bg-neutral-800 border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600"
                  >
                    <Save className="h-4 w-4" />
                    Save Domains
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setDomains([])}
                  className="flex items-center gap-2 bg-neutral-800 border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600"
                >
                  <RefreshCw className="h-4 w-4" />
                  Clear All
                </Button>
              </div>

              {syncing && (
                <div className="text-sm text-neutral-400">
                  Syncing domains... Updates will appear automatically
                </div>
              )}

              {loading && !syncing ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                </div>
              ) : filteredDomains.length === 0 ? (
                <div className="text-center py-12">
                  <Globe className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No domains found</h3>
                  <p className="text-neutral-400">
                    {domains.length === 0 
                      ? 'Upload your Ahrefs data to get started'
                      : 'No domains match your search criteria'
                    }
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-neutral-800">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-neutral-800">
                        <TableHead className="text-neutral-200 w-14">
                          #
                        </TableHead>
                        <TableHead 
                          className="text-neutral-200 cursor-pointer hover:text-white"
                          onClick={() => handleSort('domain')}
                        >
                          Domain {sortConfig.key === 'domain' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-neutral-200 cursor-pointer hover:text-white"
                          onClick={() => handleSort('status')}
                        >
                          Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-neutral-200 cursor-pointer hover:text-white"
                          onClick={() => handleSort('loopia_account')}
                        >
                          Account {sortConfig.key === 'loopia_account' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-neutral-200 cursor-pointer hover:text-white"
                          onClick={() => handleSort('customer_number')}
                        >
                          Customer {sortConfig.key === 'customer_number' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-neutral-200 cursor-pointer hover:text-white"
                          onClick={() => handleSort('expiry_date')}
                        >
                          Expiry Date {sortConfig.key === 'expiry_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-neutral-200 cursor-pointer hover:text-white"
                          onClick={() => handleSort('domain_rating')}
                        >
                          DR {sortConfig.key === 'domain_rating' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-neutral-200 cursor-pointer hover:text-white"
                          onClick={() => handleSort('traffic_value')}
                        >
                          Traffic Value {sortConfig.key === 'traffic_value' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-neutral-200 cursor-pointer hover:text-white"
                          onClick={() => handleSort('organic_traffic')}
                        >
                          Organic Traffic {sortConfig.key === 'organic_traffic' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-neutral-200 cursor-pointer hover:text-white"
                          onClick={() => handleSort('organic_keywords')}
                        >
                          Keywords {sortConfig.key === 'organic_keywords' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-neutral-200 cursor-pointer hover:text-white"
                          onClick={() => handleSort('last_updated')}
                        >
                          Last Updated {sortConfig.key === 'last_updated' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead className="text-neutral-200"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDomains.map((domain, index) => {
                        const statusInfo = getDomainStatusInfo(domain);
                        const displayDomain = domain.display_domain || 
                          (domain.domain.startsWith('xn--') ? punycode.toUnicode(domain.domain) : domain.domain);

                        return (
                          <TableRow key={domain.domain} className="border-neutral-800">
                            <TableCell className="text-neutral-400 w-14">
                              {index + 1}
                            </TableCell>
                            <TableCell className="font-medium text-white">
                              {displayDomain}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2" title={statusInfo.tooltip}>
                                {statusInfo.statusColor === 'emerald' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                                {statusInfo.statusColor === 'yellow' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                                {statusInfo.statusColor === 'red' && <XCircle className="h-4 w-4 text-red-500" />}
                                {statusInfo.statusColor === 'neutral' && <AlertTriangle className="h-4 w-4 text-neutral-400" />}
                                <span className={`text-sm ${
                                  statusInfo.statusColor === 'emerald' ? 'text-emerald-500' :
                                  statusInfo.statusColor === 'yellow' ? 'text-yellow-500' :
                                  statusInfo.statusColor === 'red' ? 'text-red-500' :
                                  'text-neutral-400'
                                }`}>
                                  {statusInfo.status}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-neutral-200">
                              {domain.loopia_account || '-'}
                            </TableCell>
                            <TableCell className="text-neutral-200">
                              {domain.customer_number || '-'}
                            </TableCell>
                            <TableCell className="text-neutral-200">
                              {domain.expiry_date ? new Date(domain.expiry_date).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell className="text-neutral-200">
                              {domain.domain_rating || '-'}
                            </TableCell>
                            <TableCell className="text-neutral-200">
                              {domain.traffic_value ? `$${domain.traffic_value.toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className="text-neutral-200">
                              {domain.organic_traffic?.toLocaleString() || '-'}
                            </TableCell>
                            <TableCell className="text-neutral-200">
                              {domain.organic_keywords?.toLocaleString() || '-'}
                            </TableCell>
                            <TableCell className="text-neutral-400">
                              {new Date(domain.last_updated).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (typeof displayDomain === 'string') {
                                      window.open(`https://${displayDomain}`, '_blank');
                                    }
                                  }}
                                  className="flex items-center gap-1 hover:bg-neutral-800 text-neutral-200 hover:text-white"
                                >
                                  <ArrowUpRight className="h-4 w-4" />
                                </Button>
                                {(!domain.loopia_account || statusInfo.status === 'Expired') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDomainAction(domain.domain, 'order')}
                                    className="flex items-center gap-1 hover:bg-neutral-800 text-neutral-200 hover:text-white"
                                    title={domain.loopia_account ? "Renew domain" : "Order domain"}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                )}
                                {domain.loopia_account && statusInfo.statusColor === 'yellow' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDomainAction(domain.domain, 'renew', domain.loopia_account)}
                                    className="flex items-center gap-1 hover:bg-neutral-800 text-yellow-500 hover:text-yellow-400"
                                    title="Renew domain"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </SidebarDemo>
  );
}