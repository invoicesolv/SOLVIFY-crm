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
  Loader2,
  FolderOpen
} from "lucide-react";
import { toast } from "sonner";
import { supabase, supabaseAdmin } from '@/lib/supabase';
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
  linked_projects?: Array<{
    id: string;
    name: string;
  }>;
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
  const [loopiaApiUser, setLoopiaApiUser] = useState<string | null>(null);
  const [loopiaApiKey, setLoopiaApiKey] = useState<string | null>(null);
  const [loopiaDomainsLoading, setLoopiaDomainsLoading] = useState(false);
  const [loopiaConnected, setLoopiaConnected] = useState(false);

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
        
        // Get workspace using API endpoint
        const response = await fetch('/api/workspace/leave');
        if (!response.ok) {
          throw new Error('Failed to fetch workspaces');
        }
        
        const data = await response.json();
        const workspaces = data.workspaces || [];
        
        if (workspaces.length === 0) {
          setHasPermission(false);
          setHasEditPermission(false);
          return;
        }
        
        // Get first workspace ID or active one if set previously
        const workspaceId = activeWorkspace || workspaces[0].id;
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

  // Function to load project connections for existing domains
  const loadProjectConnections = async () => {
    if (!activeWorkspace) return;
    
    try {
      const domainsWithProjects = await Promise.all(
        domains.map(async (domain) => {
          try {
            // Get project links for this domain
            const { data: projectLinks, error: linksError } = await supabase
              .from('project_domain_links')
              .select(`
                project_id,
                projects:project_id (
                  id,
                  name
                )
              `)
              .eq('domain_id', domain.domain);

            if (linksError) {
              console.error('Error fetching project links for domain:', domain.domain, linksError);
              return { ...domain, linked_projects: [] };
            }

            const linkedProjects = projectLinks?.map(link => ({
              id: link.projects?.id || link.project_id,
              name: link.projects?.name || 'Unnamed Project'
            })) || [];

            return {
              ...domain,
              linked_projects: linkedProjects
            };
          } catch (error) {
            console.error('Error processing domain:', domain.domain, error);
            return { ...domain, linked_projects: [] };
          }
        })
      );

      setDomains(domainsWithProjects);
    } catch (error) {
      console.error('Error loading project connections:', error);
    }
  };

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

      // Fetch project connections for each domain
      console.log('Loading project connections for domains...');
      const domainsWithProjects = await Promise.all(
        mergedDomains.map(async (domain) => {
          try {
            // Get project links for this domain
            const { data: projectLinks, error: linksError } = await supabase
              .from('project_domain_links')
              .select(`
                project_id,
                projects:project_id (
                  id,
                  name
                )
              `)
              .eq('domain_id', domain.domain);

            if (linksError) {
              console.error('Error fetching project links for domain:', domain.domain, linksError);
              return { ...domain, linked_projects: [] };
            }

            const linkedProjects = projectLinks?.map(link => ({
              id: link.projects?.id || link.project_id,
              name: link.projects?.name || 'Unnamed Project'
            })) || [];

            return {
              ...domain,
              linked_projects: linkedProjects
            };
          } catch (error) {
            console.error('Error processing domain:', domain.domain, error);
            return { ...domain, linked_projects: [] };
          }
        })
      );

      setDomains(domainsWithProjects);
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

        const mergedDomains = Object.entries(updatedGroups).map(([key, group]) => {
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

        return mergedDomains;
      });

      // Load project connections for all domains after upload
      setTimeout(async () => {
        await loadProjectConnections();
      }, 100);

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

  // Add useEffect to load Loopia API credentials
  useEffect(() => {
    const loadLoopiaCredentials = async () => {
      if (!activeWorkspace) return;
      
      try {
        const { data, error } = await supabase
          .from('workspace_settings')
          .select('loopia_api_user, loopia_api_key')
          .eq('workspace_id', activeWorkspace)
          .maybeSingle();
        
        if (error) throw error;
        
        if (data && data.loopia_api_user && data.loopia_api_key) {
          setLoopiaApiUser(data.loopia_api_user);
          setLoopiaApiKey(data.loopia_api_key);
          setLoopiaConnected(true);
          
          // Since we have valid credentials, load Loopia domains
          fetchLoopiaDomainsIfConnected();
        }
      } catch (error) {
        console.error("Error loading Loopia credentials:", error);
      }
    };
    
    loadLoopiaCredentials();
  }, [activeWorkspace]);

  // Add function to fetch domains from Loopia API
  const fetchLoopiaDomainsIfConnected = async () => {
    if (!loopiaConnected || !loopiaApiUser || !loopiaApiKey || !activeWorkspace) {
      return;
    }
    
    setLoopiaDomainsLoading(true);
    try {
      // This would typically be a real API call to Loopia
      // For this implementation, we'll simulate the API call
      toast.info('Fetching domains from Loopia...');
      
      // In a real implementation, you would make an API call to Loopia
      // We're simulating it here for demonstration purposes
      const sampleLoopiaData: DomainData[] = [
        {
          domain: 'example.com',
          domain_rating: 25,
          status: 'active',
          expiry_date: '2025-12-31',
          auto_renew: true,
          source: 'Loopia' as 'Loopia', // Explicitly cast to the correct type
          last_updated: new Date().toISOString(),
          loopia_account: loopiaApiUser || undefined,
          normalized_domain: 'example.com',
          display_domain: 'example.com'
        },
        {
          domain: 'solvify.se',
          domain_rating: 35,
          status: 'active',
          expiry_date: '2025-10-15',
          auto_renew: true,
          source: 'Loopia' as 'Loopia', // Explicitly cast to the correct type
          last_updated: new Date().toISOString(),
          loopia_account: loopiaApiUser || undefined,
          normalized_domain: 'solvify.se',
          display_domain: 'solvify.se'
        }
      ];
      
      // Merge the Loopia domains with existing domains
      const loopiaSourceDomains: DomainData[] = sampleLoopiaData.map(domain => ({
        ...domain,
        workspace_id: activeWorkspace
      }));
      
      // Add Loopia domains to the list
      setDomains(prev => {
        // Remove existing Loopia domains
        const filteredDomains = prev.filter(d => d.source !== 'Loopia');
        
        // Add new Loopia domains
        return [...filteredDomains, ...loopiaSourceDomains];
      });
      
      toast.success(`Successfully loaded ${loopiaSourceDomains.length} domains from Loopia`);
    } catch (error) {
      console.error("Error fetching Loopia domains:", error);
      toast.error("Failed to fetch domains from Loopia");
    } finally {
      setLoopiaDomainsLoading(false);
    }
  };

  // Add Loopia connection card component
  const LoopiaConnectionCard = () => {
    if (!hasPermission) return null;
    
    return (
      <Card className="bg-background border-border mb-6">
        <div className="px-6 py-5">
          <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Globe className="text-muted-foreground" /> Loopia API Connection
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Connect to your Loopia account to manage your domains
          </p>
        </div>
        <div className="px-6 pb-5">
          {loopiaConnected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="text-green-600 dark:text-green-400 h-5 w-5" />
                  <span className="text-foreground dark:text-neutral-300">Connected to Loopia account: {loopiaApiUser}</span>
                </div>
                <Button
                  variant="outline"
                  className="border-border text-foreground dark:text-neutral-300"
                  onClick={fetchLoopiaDomainsIfConnected}
                  disabled={loopiaDomainsLoading}
                >
                  {loopiaDomainsLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" /> Sync Domains
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-foreground0">
                To update your Loopia API credentials, please visit the Settings page.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="h-5 w-5" />
                <span className="text-sm">
                  No Loopia API credentials found. Configure in Settings to connect.
                </span>
              </div>
              <Button
                variant="outline" 
                className="border-border text-foreground dark:text-neutral-300"
                onClick={() => window.location.href = '/settings'}
              >
                Go to Settings
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
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
          <Card className="p-8 bg-muted border-border">
            <h1 className="text-xl font-semibold text-foreground mb-4">Access Denied</h1>
            <p className="text-muted-foreground">
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
            <h1 className="text-2xl font-semibold text-foreground">Domain Portfolio</h1>
            <p className="text-sm text-muted-foreground">
              Manage and monitor your domain metrics from Ahrefs and Loopia
            </p>
          </div>
        </div>

        <Card className="bg-background border-border text-foreground">
          <div className="p-6">
            <div className="flex flex-col gap-6">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-400" />
                  <h3 className="text-sm font-medium text-foreground">CSV Upload Instructions</h3>
                </div>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>1. Export your domains from Ahrefs in CSV format</p>
                  <p>2. Ensure the CSV is saved with UTF-8 encoding</p>
                  <p>3. Required columns: Target, Domain Rating, Traffic Value, Total Traffic (desc), Ref domains Dofollow, Total Keywords</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadExample}
                      className="text-xs bg-muted border-border hover:bg-gray-200 dark:bg-muted"
                    >
                      Download Example CSV
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Filters</h3>
                <div className="grid grid-cols-3 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground">Min Domain Rating</Label>
                      <span className="text-sm text-muted-foreground">{filters.minDomainRating}</span>
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
                      <Label className="text-muted-foreground">Min Traffic Value ($)</Label>
                      <span className="text-sm text-muted-foreground">${filters.minTrafficValue.toLocaleString()}</span>
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
                      <Label className="text-muted-foreground">Min Keywords</Label>
                      <span className="text-sm text-muted-foreground">{filters.minKeywords.toLocaleString()}</span>
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
                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search domains..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-muted border-border focus:border-gray-400 dark:border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('ahrefs-upload')?.click()}
                    className="flex items-center gap-2 bg-muted border-border hover:bg-gray-200 dark:bg-muted hover:border-gray-400 dark:border-border"
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
                        ? 'bg-red-100 dark:bg-red-900/20 border-red-700 hover:bg-red-900/40 hover:border-red-600'
                        : 'bg-muted border-border hover:bg-gray-200 dark:bg-muted hover:border-gray-400 dark:border-border'
                    }`}
                  >
                    <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Stop Sync' : 'Sync Loopia Domains'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSaveDomains}
                    className="flex items-center gap-2 bg-muted border-border hover:bg-gray-200 dark:bg-muted hover:border-gray-400 dark:border-border"
                  >
                    <Save className="h-4 w-4" />
                    Save Domains
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setDomains([])}
                  className="flex items-center gap-2 bg-muted border-border hover:bg-gray-200 dark:bg-muted hover:border-gray-400 dark:border-border"
                >
                  <RefreshCw className="h-4 w-4" />
                  Clear All
                </Button>
              </div>

              {syncing && (
                <div className="text-sm text-muted-foreground">
                  Syncing domains... Updates will appear automatically
                </div>
              )}

              {loading && !syncing ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                </div>
              ) : filteredDomains.length === 0 ? (
                <div className="text-center py-12">
                  <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No domains found</h3>
                  <p className="text-muted-foreground">
                    {domains.length === 0 
                      ? 'Upload your Ahrefs data to get started'
                      : 'No domains match your search criteria'
                    }
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-foreground w-14">
                          #
                        </TableHead>
                        <TableHead 
                          className="text-foreground cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('domain')}
                        >
                          Domain {sortConfig.key === 'domain' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-foreground cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('status')}
                        >
                          Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-foreground cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('loopia_account')}
                        >
                          Account {sortConfig.key === 'loopia_account' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-foreground cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('customer_number')}
                        >
                          Customer {sortConfig.key === 'customer_number' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-foreground cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('expiry_date')}
                        >
                          Expiry Date {sortConfig.key === 'expiry_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead className="text-foreground">
                          Projects
                        </TableHead>
                        <TableHead 
                          className="text-foreground cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('domain_rating')}
                        >
                          DR {sortConfig.key === 'domain_rating' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-foreground cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('traffic_value')}
                        >
                          Traffic Value {sortConfig.key === 'traffic_value' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-foreground cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('organic_traffic')}
                        >
                          Organic Traffic {sortConfig.key === 'organic_traffic' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-foreground cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('organic_keywords')}
                        >
                          Keywords {sortConfig.key === 'organic_keywords' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead 
                          className="text-foreground cursor-pointer hover:text-foreground"
                          onClick={() => handleSort('last_updated')}
                        >
                          Last Updated {sortConfig.key === 'last_updated' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </TableHead>
                        <TableHead className="text-foreground"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedDomains.map((domain, index) => {
                        const statusInfo = getDomainStatusInfo(domain);
                        const displayDomain = domain.display_domain || 
                          (domain.domain.startsWith('xn--') ? punycode.toUnicode(domain.domain) : domain.domain);

                        return (
                          <TableRow key={domain.domain} className="border-border">
                            <TableCell className="text-muted-foreground w-14">
                              {index + 1}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {displayDomain}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2" title={statusInfo.tooltip}>
                                {statusInfo.statusColor === 'emerald' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                                {statusInfo.statusColor === 'yellow' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                                {statusInfo.statusColor === 'red' && <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
                                {statusInfo.statusColor === 'neutral' && <AlertTriangle className="h-4 w-4 text-muted-foreground" />}
                                <span className={`text-sm ${
                                  statusInfo.statusColor === 'emerald' ? 'text-emerald-500' :
                                  statusInfo.statusColor === 'yellow' ? 'text-yellow-500' :
                                  statusInfo.statusColor === 'red' ? 'text-red-600 dark:text-red-400' :
                                  'text-muted-foreground'
                                }`}>
                                  {statusInfo.status}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-foreground">
                              {domain.loopia_account || '-'}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {domain.customer_number || '-'}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {domain.expiry_date ? new Date(domain.expiry_date).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {domain.linked_projects && domain.linked_projects.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-48">
                                  {domain.linked_projects.map((project, idx) => (
                                    <span
                                      key={project.id}
                                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                                      title={`Linked to project: ${project.name}`}
                                    >
                                      <FolderOpen className="h-3 w-3 mr-1" />
                                      {project.name}
                                    </span>
                                  ))}
                                  <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-1 w-full">
                                    ✓ Worth renewing ({domain.linked_projects.length} active project{domain.linked_projects.length > 1 ? 's' : ''})
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                                    ⚠️ Not linked to any projects
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    (Consider if renewal is needed)
                                  </span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {domain.domain_rating || '-'}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {domain.traffic_value ? `$${domain.traffic_value.toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {domain.organic_traffic?.toLocaleString() || '-'}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {domain.organic_keywords?.toLocaleString() || '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
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
                                  className="flex items-center gap-1 hover:bg-muted text-foreground hover:text-foreground"
                                >
                                  <ArrowUpRight className="h-4 w-4" />
                                </Button>
                                {(!domain.loopia_account || statusInfo.status === 'Expired') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDomainAction(domain.domain, 'order')}
                                    className="flex items-center gap-1 hover:bg-muted text-foreground hover:text-foreground"
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
                                    className="flex items-center gap-1 hover:bg-muted text-yellow-500 hover:text-yellow-400"
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

        <LoopiaConnectionCard />
      </div>
    </SidebarDemo>
  );
}