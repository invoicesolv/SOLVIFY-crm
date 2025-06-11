'use client';

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { FileIcon, FileSpreadsheet, Upload, AlertCircle, Check, X } from "lucide-react";
import * as XLSX from 'xlsx';

// Create alert component inline since there's an issue with the import
const Alert = ({ 
  children, 
  variant = 'default', 
  className = '' 
}: { 
  children: React.ReactNode, 
  variant?: 'default' | 'destructive' | 'success',
  className?: string 
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'destructive':
        return 'border-red-500/50 text-red-600 dark:text-red-400 [&>svg]:text-red-600 dark:text-red-400';
      case 'success':
        return 'border-green-500/50 text-green-600 dark:text-green-400 [&>svg]:text-green-600 dark:text-green-400';
      default:
        return 'bg-background/50 border-border dark:border-border text-foreground';
    }
  };

  return (
    <div
      role="alert"
      className={`relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7 ${getVariantClasses()} ${className}`}
    >
      {children}
    </div>
  );
};

const AlertDescription = ({
  children,
  className = ''
}: {
  children: React.ReactNode,
  className?: string
}) => (
  <div className={`text-sm [&_p]:leading-relaxed ${className}`}>
    {children}
  </div>
);

// Lead sources and service categories
const LEAD_SOURCES = [
  { id: "website_form", name: "Website Form" },
  { id: "contact_page", name: "Contact Page" },
  { id: "blog_signup", name: "Blog Signup" },
  { id: "seo_audit", name: "SEO Audit Request" },
  { id: "keyword_research", name: "Keyword Research Request" },
  { id: "backlink_inquiry", name: "Backlink Inquiry" },
  { id: "content_optimization", name: "Content Optimization" },
  { id: "local_seo", name: "Local SEO Request" },
  { id: "referral", name: "Referral" },
  { id: "import", name: "Imported" },
  { id: "other", name: "Other" }
];

const SERVICE_CATEGORIES = [
  { id: "technical_seo", name: "Technical SEO" },
  { id: "content_seo", name: "Content SEO" },
  { id: "local_seo", name: "Local SEO" },
  { id: "ecommerce_seo", name: "E-commerce SEO" },
  { id: "international_seo", name: "International SEO" },
  { id: "link_building", name: "Link Building" }
];

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  userId: string;
  onSuccess: () => void;
}

interface LeadImportRow {
  'Lead Name': string;
  'Company'?: string;
  'Email'?: string;
  'Phone'?: string;
  'Source'?: string;
  'Service Category'?: string;
  'Website URL'?: string;
  'Monthly Traffic'?: number;
  'Current Rank'?: string;
  'Target Keywords'?: string;
  'Qualification Score'?: number;
  'Notes'?: string;
  'Status'?: string;
  [key: string]: any;
}

export function ImportLeadsDialog({
  open,
  onOpenChange,
  workspaceId,
  userId,
  onSuccess,
}: ImportLeadsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<LeadImportRow[]>([]);
  const [defaultSource, setDefaultSource] = useState("import");
  const [defaultServiceCategory, setDefaultServiceCategory] = useState("technical_seo");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setParseError(null);
    
    try {
      const fileData = await readFileData(selectedFile);
      if (!fileData || !fileData.length) {
        setParseError("No data found in file");
        setPreviewData([]);
        return;
      }
      
      // Check if file has required Lead Name column
      if (!fileData[0]['Lead Name'] && !fileData[0]['lead_name'] && !fileData[0]['Name'] && !fileData[0]['name']) {
        setParseError("File must contain a 'Lead Name', 'lead_name', 'Name', or 'name' column");
        setPreviewData([]);
        return;
      }
      
      // Normalize data for preview
      const normalizedData = fileData.map(row => {
        return {
          'Lead Name': row['Lead Name'] || row['lead_name'] || row['Name'] || row['name'] || '',
          'Company': row['Company'] || row['company'] || '',
          'Email': row['Email'] || row['email'] || '',
          'Phone': row['Phone'] || row['phone'] || '',
          'Source': row['Source'] || row['source'] || defaultSource,
          'Service Category': row['Service Category'] || row['service_category'] || defaultServiceCategory,
          'Website URL': row['Website URL'] || row['website_url'] || '',
          'Monthly Traffic': row['Monthly Traffic'] || row['monthly_traffic'] || 0,
          'Current Rank': row['Current Rank'] || row['current_rank'] || '',
          'Target Keywords': row['Target Keywords'] || row['target_keywords'] || '',
          'Qualification Score': row['Qualification Score'] || row['qualification_score'] || 5,
          'Notes': row['Notes'] || row['notes'] || '',
          'Status': row['Status'] || row['status'] || 'New'
        };
      });
      
      setPreviewData(normalizedData.slice(0, 10)); // Show first 10 for preview
    } catch (error) {
      console.error('Error parsing file:', error);
      setParseError(error instanceof Error ? error.message : 'Failed to parse file');
      setPreviewData([]);
    }
  };
  
  const readFileData = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error('No data found in file'));
            return;
          }
          
          // Parse based on file type
          if (file.name.endsWith('.csv')) {
            // Parse CSV
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            resolve(jsonData);
          } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            // Parse XLSX
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            resolve(jsonData);
          } else {
            reject(new Error('Unsupported file format'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      
      reader.readAsBinaryString(file);
    });
  };
  
  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file to import');
      return;
    }
    
    try {
      setImporting(true);
      const fileData = await readFileData(file);
      
      if (!fileData || !fileData.length) {
        toast.error('No data found in file');
        return;
      }
      
      // Normalize data
      const leadsToInsert = fileData.map(row => {
        // Handle different column name formats
        const leadName = row['Lead Name'] || row['lead_name'] || row['Name'] || row['name'] || '';
        if (!leadName) return null; // Skip rows without names
        
        // Parse target keywords - could be string or array
        let targetKeywords = row['Target Keywords'] || row['target_keywords'] || '';
        if (typeof targetKeywords === 'string') {
          targetKeywords = targetKeywords.split(',').map(k => k.trim()).filter(Boolean);
        }
        
        return {
          lead_name: leadName,
          company: row['Company'] || row['company'] || '',
          email: row['Email'] || row['email'] || '',
          phone: row['Phone'] || row['phone'] || '',
          source: row['Source'] || row['source'] || defaultSource,
          service_category: row['Service Category'] || row['service_category'] || defaultServiceCategory,
          website_url: row['Website URL'] || row['website_url'] || '',
          monthly_traffic: Number(row['Monthly Traffic'] || row['monthly_traffic'] || 0),
          current_rank: row['Current Rank'] || row['current_rank'] || '',
          target_keywords: targetKeywords,
          qualification_score: Number(row['Qualification Score'] || row['qualification_score'] || 5),
          notes: row['Notes'] || row['notes'] || `Imported from ${file.name}`,
          status: row['Status'] || row['status'] || 'New',
          workspace_id: workspaceId,
          user_id: userId
        };
      }).filter(Boolean); // Remove null entries
      
      // Insert leads into database
      const { data, error } = await supabase
        .from('leads')
        .insert(leadsToInsert);
        
      if (error) throw error;
      
      toast.success(`Successfully imported ${leadsToInsert.length} leads`);
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFile(null);
      setPreviewData([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Error importing leads:', error);
      toast.error('Failed to import leads');
    } finally {
      setImporting(false);
    }
  };
  
  const handleClearFile = () => {
    setFile(null);
    setPreviewData([]);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const getFileIcon = () => {
    if (!file) return <Upload className="h-4 w-4" />;
    if (file.name.endsWith('.csv')) return <FileIcon className="h-4 w-4" />;
    return <FileSpreadsheet className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] bg-background border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Leads
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Import leads from CSV or Excel files into your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {parseError && (
            <Alert variant="destructive" className="bg-red-100 dark:bg-red-900/20 border-red-900 text-red-400">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="file-upload">File (CSV or Excel)</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="bg-background border-border dark:border-border"
              />
              {file && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleClearFile}
                  className="border-border dark:border-border"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Your file should contain at least a 'Lead Name' column. Other optional columns: Company, Email, Phone, Source, Service Category, Website URL, etc.
            </p>
          </div>
          
          {file && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Default Options (applied when values are missing)</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="default-source" className="text-sm">Default Source</Label>
                  <select
                    id="default-source"
                    value={defaultSource}
                    onChange={(e) => setDefaultSource(e.target.value)}
                    className="w-full bg-background border border-border dark:border-border rounded-md px-3 py-2 mt-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {LEAD_SOURCES.map(source => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="default-category" className="text-sm">Default Service Category</Label>
                  <select
                    id="default-category"
                    value={defaultServiceCategory}
                    onChange={(e) => setDefaultServiceCategory(e.target.value)}
                    className="w-full bg-background border border-border dark:border-border rounded-md px-3 py-2 mt-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SERVICE_CATEGORIES.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
          
          {previewData.length > 0 && (
            <div className="space-y-2">
              <Label>Preview Data (first 10 rows)</Label>
              <div className="border border-border dark:border-border rounded-md">
                <ScrollArea className="h-[200px]">
                  <div className="p-2">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border dark:border-border">
                          <th className="p-2 text-left text-sm font-medium text-muted-foreground">Lead Name</th>
                          <th className="p-2 text-left text-sm font-medium text-muted-foreground">Email</th>
                          <th className="p-2 text-left text-sm font-medium text-muted-foreground">Company</th>
                          <th className="p-2 text-left text-sm font-medium text-muted-foreground">Service</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, index) => (
                          <tr key={index} className="border-b border-border">
                            <td className="p-2 text-sm whitespace-nowrap">{row['Lead Name']}</td>
                            <td className="p-2 text-sm whitespace-nowrap">{row['Email'] || '-'}</td>
                            <td className="p-2 text-sm whitespace-nowrap">{row['Company'] || '-'}</td>
                            <td className="p-2 text-sm whitespace-nowrap">{row['Service Category'] || defaultServiceCategory}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </div>
              <p className="text-xs text-muted-foreground">
                {previewData.length < 10
                  ? `Showing all ${previewData.length} rows`
                  : `Showing 10 of ${file ? 'many' : previewData.length} rows`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex space-x-2 justify-end">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-border dark:border-border"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleImport}
            disabled={!file || importing || !!parseError}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {importing ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white/50 border-t-gray-900 dark:border-t-white rounded-full mr-2" />
                Importing...
              </>
            ) : (
              <>
                {getFileIcon()}
                <span className="ml-2">Import Leads</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 