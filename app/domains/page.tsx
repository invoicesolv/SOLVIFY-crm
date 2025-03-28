'use client';

import React, { useState, useEffect } from 'react';
import { SidebarDemo } from "@/components/ui/code.demo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  TrendingUp,
  Users,
  Link as LinkIcon,
  Upload,
  RefreshCw,
  Search as SearchIcon,
  Save
} from "lucide-react";
import { toast } from "sonner";

interface DomainData {
  domain: string;
  domainRating: number;
  trafficValue: number;
  organicTraffic: number;
  referringDomains: number;
  organicKeywords: number;
  source: 'ahrefs' | 'majestic';
  lastUpdated: string;
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'ahrefs' | 'majestic'>('ahrefs');
  const [filters, setFilters] = useState({
    minDomainRating: 0,
    minTrafficValue: 0,
    minKeywords: 0
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, source: 'ahrefs' | 'majestic') => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('Starting file upload:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      source: source
    });

    setLoading(true);
    try {
      // Read the file content
      const text = await file.text();
      console.log('File content preview:', text.substring(0, 200));

      // Clean up the CSV content
      const lines = text.split('\n');
      console.log('Total lines in file:', lines.length);

      // Find the complete header line
      let headerLine = '';
      let dataLines: string[] = [];
      let headerFound = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (!line) continue;

        if (!headerFound) {
          // Accumulate header line until we have all required columns
          headerLine += line;
          if ((source === 'ahrefs' && headerLine.includes('Target') && headerLine.includes('Domain Rating')) ||
              (source === 'majestic' && headerLine.includes('Item') && headerLine.includes('TrustFlow'))) {
            headerFound = true;
            console.log('Found complete header:', headerLine);
          }
        } else if (line.match(/^[#§\d]/)) {
          // Only include lines that start with #, §, or digits
          dataLines.push(line);
        }
      }

      if (!headerFound) {
        console.error('Could not find complete header');
        throw new Error('Invalid CSV format: Header not found');
      }

      // Parse CSV
      const headers = headerLine.split(',').map(h => h.trim());
      console.log('Parsed headers:', headers);

      const parsedRows = dataLines.map(line => {
        const cells = line.split(',').map(cell => cell.trim());
        return cells;
      });

      console.log('Number of data rows:', parsedRows.length);
      if (parsedRows.length > 0) {
        console.log('Sample row:', parsedRows[0]);
      }

      // Transform the data
      const newDomains = parsedRows
        .filter(row => {
          const isValid = row.length >= headers.length && row.some(cell => cell.trim());
          if (!isValid) {
            console.log('Invalid row:', row);
          }
          return isValid;
        })
        .map(row => {
          const record: { [key: string]: string } = {};
          headers.forEach((header, index) => {
            record[header] = row[index]?.trim() || '';
          });

          if (source === 'ahrefs') {
            const domain = {
              domain: record['Target'] || '',
              domainRating: parseFloat(record['Domain Rating'] || '0'),
              trafficValue: 0,
              organicTraffic: parseInt(record['Total Traffic (desc)'] || '0'),
              referringDomains: parseInt(record['Ref domains Dofollow'] || '0'),
              organicKeywords: parseInt(record['Total Keywords'] || '0'),
              source: source,
              lastUpdated: new Date().toISOString()
            };
            console.log('Processed Ahrefs domain:', domain);
            return domain;
          } else {
            // Majestic format
            const domain = {
              domain: record['Item'] || '',
              domainRating: parseFloat(record['TrustFlow'] || '0'),
              trafficValue: parseFloat(record['CitationFlow'] || '0'),
              organicTraffic: parseInt(record['OutLinksExternal'] || '0'),
              referringDomains: parseInt(record['RefDomainTypeLive'] || '0'),
              organicKeywords: parseInt(record['OutDomainsExternal'] || '0'),
              source: source,
              lastUpdated: new Date().toISOString()
            };
            console.log('Processed Majestic domain:', domain);
            return domain;
          }
        });

      console.log('Total domains processed:', newDomains.length);
      console.log('First few domains:', newDomains.slice(0, 3));

      // Update state with new domains
      setDomains(prev => {
        const updated = [...prev, ...newDomains];
        console.log('Updated domains state:', {
          previous: prev.length,
          added: newDomains.length,
          total: updated.length
        });
        return updated;
      });

      // Debug filtered domains
      const filtered = newDomains.filter(d => d.source === activeTab);
      console.log('Filtering debug:', {
        activeTab,
        totalDomains: newDomains.length,
        matchingSource: filtered.length,
        sampleDomainSource: newDomains[0]?.source
      });

      toast.success(`Successfully uploaded ${newDomains.length} domains from ${source}`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to parse CSV file');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  // Debug filtered domains whenever domains or activeTab changes
  useEffect(() => {
    console.log('Domains state changed:', {
      totalDomains: domains.length,
      activeTab,
      domainsWithCurrentSource: domains.filter(d => d.source === activeTab).length
    });
  }, [domains, activeTab]);

  const filteredDomains = domains
    .filter(domain => {
      const matchesSource = domain.source === activeTab;
      const matchesSearch = domain.domain.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilters = 
        domain.domainRating >= filters.minDomainRating &&
        domain.trafficValue >= filters.minTrafficValue &&
        domain.organicKeywords >= filters.minKeywords;
      
      return matchesSource && matchesSearch && matchesFilters;
    });

  console.log('Filtering results:', {
    total: domains.length,
    filtered: filteredDomains.length,
    activeTab,
    searchTerm,
    filters
  });

  return (
    <SidebarDemo>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white">Domain Portfolio</h1>
            <p className="text-sm text-neutral-400">
              Manage and monitor your domain portfolio metrics
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'ahrefs' | 'majestic')}>
          <TabsList className="bg-neutral-800">
            <TabsTrigger value="ahrefs" className="data-[state=active]:bg-neutral-900">Ahrefs Data</TabsTrigger>
            <TabsTrigger value="majestic" className="data-[state=active]:bg-neutral-900">Majestic Data</TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <Card className="bg-neutral-900 border-neutral-800">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="relative w-64">
                      <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <Input
                        placeholder="Search domains..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-neutral-800 border-neutral-700 focus:border-neutral-600"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById(`${activeTab}-upload`)?.click()}
                      className="flex items-center gap-2 bg-neutral-800 border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600"
                    >
                      <Upload className="h-4 w-4" />
                      Upload {activeTab === 'ahrefs' ? 'Ahrefs' : 'Majestic'} Data
                    </Button>
                    <input
                      type="file"
                      id={`${activeTab}-upload`}
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, activeTab)}
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        const domainsToSave = domains.filter(d => d.source === activeTab);
                        if (domainsToSave.length === 0) {
                          toast.error('No domains to save');
                          return;
                        }
                        // Here you would implement the save functionality
                        toast.success(`Saved ${domainsToSave.length} ${activeTab} domains`);
                      }}
                      className="flex items-center gap-2 bg-neutral-800 border-neutral-700 hover:bg-neutral-700 hover:border-neutral-600"
                    >
                      <Save className="h-4 w-4" />
                      Save {activeTab === 'ahrefs' ? 'Ahrefs' : 'Majestic'} Data
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

                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                ) : filteredDomains.length === 0 ? (
                  <div className="text-center py-12">
                    <Globe className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No domains found</h3>
                    <p className="text-neutral-400">
                      {domains.length === 0 
                        ? `Upload your ${activeTab === 'ahrefs' ? 'Ahrefs' : 'Majestic'} data to get started`
                        : `No ${activeTab} domains match your search criteria`
                      }
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border border-neutral-800">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-neutral-800">
                          <TableHead className="text-neutral-200">Domain</TableHead>
                          <TableHead className="text-neutral-200">
                            {activeTab === 'ahrefs' ? 'DR' : 'TF'}
                          </TableHead>
                          <TableHead className="text-neutral-200">
                            {activeTab === 'ahrefs' ? 'Traffic Value' : 'CF'}
                          </TableHead>
                          <TableHead className="text-neutral-200">
                            {activeTab === 'ahrefs' ? 'Organic Traffic' : 'External Backlinks'}
                          </TableHead>
                          <TableHead className="text-neutral-200">
                            {activeTab === 'ahrefs' ? 'Referring Domains' : 'Ref Domains'}
                          </TableHead>
                          <TableHead className="text-neutral-200">
                            {activeTab === 'ahrefs' ? 'Keywords' : 'Ref IPs'}
                          </TableHead>
                          <TableHead className="text-neutral-200">Last Updated</TableHead>
                          <TableHead className="text-neutral-200"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDomains.map((domain) => (
                          <TableRow key={domain.domain} className="border-neutral-800">
                            <TableCell className="font-medium text-white">
                              {domain.domain}
                            </TableCell>
                            <TableCell className="text-neutral-200">
                              <div className="flex items-center gap-2">
                                <TrendingUp className={`h-4 w-4 ${activeTab === 'ahrefs' ? 'text-green-500' : 'text-blue-500'}`} />
                                {domain.domainRating}
                              </div>
                            </TableCell>
                            <TableCell className="text-neutral-200">
                              {activeTab === 'ahrefs' ? '$' : ''}{domain.trafficValue.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-neutral-200">{domain.organicTraffic.toLocaleString()}</TableCell>
                            <TableCell className="text-neutral-200">
                              <div className="flex items-center gap-2">
                                <LinkIcon className={`h-4 w-4 ${activeTab === 'ahrefs' ? 'text-blue-500' : 'text-green-500'}`} />
                                {domain.referringDomains.toLocaleString()}
                              </div>
                            </TableCell>
                            <TableCell className="text-neutral-200">
                              <div className="flex items-center gap-2">
                                <SearchIcon className={`h-4 w-4 ${activeTab === 'ahrefs' ? 'text-purple-500' : 'text-orange-500'}`} />
                                {domain.organicKeywords.toLocaleString()}
                              </div>
                            </TableCell>
                            <TableCell className="text-neutral-400">
                              {new Date(domain.lastUpdated).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(`https://${domain.domain}`, '_blank')}
                                className="flex items-center gap-1 hover:bg-neutral-800 text-neutral-200 hover:text-white"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </Tabs>
      </div>
    </SidebarDemo>
  );
} 