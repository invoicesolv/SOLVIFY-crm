"use client";

import React, { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Upload, 
  ArrowLeft, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Download,
  Users,
  Mail,
  User,
  Building,
  Phone,
  Tag,
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { getActiveWorkspaceId } from '@/lib/permission';
import { SidebarDemo } from "@/components/ui/code.demo";

interface CsvData {
  headers: string[];
  rows: string[][];
}

interface FieldMapping {
  csvField: string;
  targetField: string;
}

interface ContactList {
  id: string;
  name: string;
  active_contacts: number;
}

interface ImportResult {
  success: number;
  failed: number;
  duplicates: number;
  errors: string[];
}

const TARGET_FIELDS = [
  { value: 'email', label: 'Email Address *', required: true },
  { value: 'first_name', label: 'First Name', required: false },
  { value: 'last_name', label: 'Last Name', required: false },
  { value: 'phone', label: 'Phone Number', required: false },
  { value: 'company', label: 'Company', required: false },
  { value: 'ignore', label: 'Ignore Field', required: false }
];

export default function ImportContactsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [csvData, setCsvData] = useState<CsvData | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  React.useEffect(() => {
    const initializeWorkspace = async () => {
      if (session?.user?.id) {
        try {
          const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
          setWorkspaceId(activeWorkspaceId);
          if (activeWorkspaceId) {
            fetchContactLists(activeWorkspaceId);
          }
        } catch (error) {
          console.error('Error getting workspace ID:', error);
        }
      }
    };
    
    initializeWorkspace();
  }, [session?.user?.id]);

  const fetchContactLists = async (workspaceId: string) => {
    try {
      const { data, error } = await supabase
        .from('email_lists')
        .select('id, name, active_contacts')
        .eq('workspace_id', workspaceId)
        .order('name');

      if (error) throw error;
      setContactLists(data || []);
    } catch (error) {
      console.error('Error fetching contact lists:', error);
    }
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          toast.error('CSV file must contain at least a header row and one data row');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1).map(line => 
          line.split(',').map(cell => cell.trim().replace(/"/g, ''))
        );

        setCsvData({ headers, rows });
        
        // Initialize field mappings
        const mappings = headers.map(header => {
          // Try to auto-detect common field mappings
          const lowerHeader = header.toLowerCase();
          let targetField = 'ignore';
          
          if (lowerHeader.includes('email') || lowerHeader.includes('e-mail')) {
            targetField = 'email';
          } else if (lowerHeader.includes('first') && lowerHeader.includes('name')) {
            targetField = 'first_name';
          } else if (lowerHeader.includes('last') && lowerHeader.includes('name')) {
            targetField = 'last_name';
          } else if (lowerHeader.includes('phone') || lowerHeader.includes('mobile')) {
            targetField = 'phone';
          } else if (lowerHeader.includes('company') || lowerHeader.includes('organization')) {
            targetField = 'company';
          }

          return { csvField: header, targetField };
        });
        
        setFieldMappings(mappings);
        setCurrentStep(2);
        toast.success(`CSV file loaded successfully with ${rows.length} contacts`);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('Error parsing CSV file. Please check the format.');
      }
    };

    reader.readAsText(file);
  }, []);

  const updateFieldMapping = (csvField: string, targetField: string) => {
    setFieldMappings(prev => 
      prev.map(mapping => 
        mapping.csvField === csvField 
          ? { ...mapping, targetField }
          : mapping
      )
    );
  };

  const validateMappings = () => {
    const emailMapping = fieldMappings.find(m => m.targetField === 'email');
    if (!emailMapping) {
      toast.error('Email field mapping is required');
      return false;
    }

    // Check for duplicate mappings (except 'ignore')
    const nonIgnoreMappings = fieldMappings.filter(m => m.targetField !== 'ignore');
    const uniqueTargets = new Set(nonIgnoreMappings.map(m => m.targetField));
    if (uniqueTargets.size !== nonIgnoreMappings.length) {
      toast.error('Each target field can only be mapped once');
      return false;
    }

    return true;
  };

  const processImport = async () => {
    if (!workspaceId || !csvData || !validateMappings()) return;

    setImporting(true);
    setImportProgress(0);
    
    try {
      const result: ImportResult = {
        success: 0,
        failed: 0,
        duplicates: 0,
        errors: []
      };

      const emailFieldIndex = csvData.headers.findIndex(h => 
        fieldMappings.find(m => m.csvField === h && m.targetField === 'email')
      );

      if (emailFieldIndex === -1) {
        throw new Error('Email field not found');
      }

      const total = csvData.rows.length;
      const batchSize = 50; // Process in batches for better performance
      
      for (let i = 0; i < csvData.rows.length; i += batchSize) {
        const batch = csvData.rows.slice(i, i + batchSize);
        
        for (const row of batch) {
          try {
            if (row.length !== csvData.headers.length) {
              result.failed++;
              result.errors.push(`Row ${i + result.success + result.failed + 1}: Column count mismatch`);
              continue;
            }

            const email = row[emailFieldIndex]?.trim();
            if (!email || !email.includes('@')) {
              result.failed++;
              result.errors.push(`Row ${i + result.success + result.failed + 1}: Invalid email address`);
              continue;
            }

            // Check for existing contact
            const { data: existingContact } = await supabase
              .from('email_contacts')
              .select('id')
              .eq('workspace_id', workspaceId)
              .eq('email', email)
              .single();

            if (existingContact) {
              result.duplicates++;
              continue;
            }

            // Build contact object based on field mappings
            const contactData: any = {
              workspace_id: workspaceId,
              email: email,
              status: 'active',
              source: 'import'
            };

            fieldMappings.forEach((mapping, index) => {
              if (mapping.targetField !== 'ignore' && mapping.targetField !== 'email' && row[index]) {
                contactData[mapping.targetField] = row[index].trim();
              }
            });

            // Insert contact
            const { data: newContact, error } = await supabase
              .from('email_contacts')
              .insert(contactData)
              .select('id')
              .single();

            if (error) throw error;

            // Add to selected lists
            if (selectedLists.length > 0 && newContact) {
              const subscriptions = selectedLists.map(listId => ({
                contact_id: newContact.id,
                list_id: listId,
                status: 'subscribed' as const,
                subscribed_at: new Date().toISOString()
              }));

              await supabase
                .from('list_subscriptions')
                .insert(subscriptions);
            }

            result.success++;
          } catch (error: any) {
            result.failed++;
            result.errors.push(`Row ${i + result.success + result.failed + 1}: ${error?.message || 'Unknown error'}`);
          }
        }

        // Update progress
        setImportProgress(Math.round(((i + batch.length) / total) * 100));
      }

      // Update list counts
      if (selectedLists.length > 0) {
        for (const listId of selectedLists) {
          const { data: listContacts } = await supabase
            .from('list_subscriptions')
            .select('contact_id')
            .eq('list_id', listId)
            .eq('status', 'subscribed');

          const totalContacts = listContacts?.length || 0;
          
          // Get active contacts count
          const { data: activeContacts } = await supabase
            .from('list_subscriptions')
            .select('contact_id, email_contacts!inner(status)')
            .eq('list_id', listId)
            .eq('status', 'subscribed')
            .eq('email_contacts.status', 'active');

          const activeCount = activeContacts?.length || 0;

          await supabase
            .from('email_lists')
            .update({
              total_contacts: totalContacts,
              active_contacts: activeCount
            })
            .eq('id', listId);
        }
      }

      setImportResult(result);
      setCurrentStep(4);
      
      const successMessage = `Import completed: ${result.success} contacts added`;
      if (result.duplicates > 0) {
        toast.success(`${successMessage}, ${result.duplicates} duplicates skipped`);
      } else {
        toast.success(successMessage);
      }
      
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import contacts');
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const downloadSampleCsv = () => {
    const sampleData = [
      'email,first_name,last_name,phone,company',
      'john.doe@example.com,John,Doe,+1234567890,Acme Corp',
      'jane.smith@example.com,Jane,Smith,+0987654321,Tech Inc',
      'mike.jones@example.com,Mike,Jones,,Freelancer'
    ].join('\n');

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contacts_sample.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const steps = [
    { number: 1, title: 'Upload', description: 'Upload CSV file' },
    { number: 2, title: 'Map Fields', description: 'Map CSV columns' },
    { number: 3, title: 'Select Lists', description: 'Choose contact lists' },
    { number: 4, title: 'Complete', description: 'Import results' }
  ];

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div className={`flex flex-col items-center ${index < steps.length - 1 ? 'mr-8' : ''}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
              currentStep >= step.number 
                ? 'bg-primary text-primary-foreground border-primary' 
                : 'bg-background text-muted-foreground border-muted-foreground'
            }`}>
              {step.number}
            </div>
            <div className="mt-2 text-center">
              <div className="text-sm font-medium">{step.title}</div>
              <div className="text-xs text-muted-foreground">{step.description}</div>
            </div>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-16 h-0.5 mb-6 transition-colors ${
              currentStep > step.number ? 'bg-primary' : 'bg-muted'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <SidebarDemo>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <Link href="/email-marketing/contacts">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Contacts
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Import Contacts</h1>
                <p className="text-muted-foreground">Upload and import contacts from CSV files</p>
              </div>
            </div>
            
            <Button variant="outline" onClick={downloadSampleCsv}>
              <Download className="h-4 w-4 mr-2" />
              Download Sample CSV
            </Button>
          </div>
        </div>

        <div className="p-6">
          {renderStepIndicator()}

          {/* Step 1: File Upload */}
          {currentStep === 1 && (
            <div className="max-w-2xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload CSV File
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Upload a CSV file with your contacts. The first row should contain column headers.
                      Supported fields: Email (required), First Name, Last Name, Phone, Company.
                    </AlertDescription>
                  </Alert>

                  <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Choose CSV file</h3>
                    <p className="text-muted-foreground mb-4">
                      Upload a CSV file containing your contact information
                    </p>
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="max-w-xs mx-auto"
                    />
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold">CSV Format Requirements:</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        First row must contain column headers
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Email column is required
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Use commas to separate values
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Enclose values with commas in quotes
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Field Mapping */}
          {currentStep === 2 && csvData && (
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Map CSV Fields
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Map each CSV column to the appropriate contact field. Email mapping is required.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">CSV Columns ({csvData.headers.length})</Label>
                        <div className="text-xs text-muted-foreground">
                          Found {csvData.rows.length} contact records
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Target Fields</Label>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-3">
                      {fieldMappings.map((mapping, index) => (
                        <div key={mapping.csvField} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{mapping.csvField}</div>
                              <div className="text-xs text-muted-foreground">
                                Sample: {csvData.rows[0]?.[index] || 'No data'}
                              </div>
                            </div>
                          </div>
                          <Select
                            value={mapping.targetField}
                            onValueChange={(value) => updateFieldMapping(mapping.csvField, value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TARGET_FIELDS.map(field => (
                                <SelectItem key={field.value} value={field.value}>
                                  <div className="flex items-center gap-2">
                                    {field.value === 'email' && <Mail className="h-4 w-4" />}
                                    {field.value === 'first_name' && <User className="h-4 w-4" />}
                                    {field.value === 'last_name' && <User className="h-4 w-4" />}
                                    {field.value === 'phone' && <Phone className="h-4 w-4" />}
                                    {field.value === 'company' && <Building className="h-4 w-4" />}
                                    {field.value === 'ignore' && <Trash2 className="h-4 w-4" />}
                                    {field.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Upload
                    </Button>
                    <Button onClick={() => {
                      if (validateMappings()) {
                        setCurrentStep(3);
                      }
                    }}>
                      Next: Select Lists
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Select Lists */}
          {currentStep === 3 && (
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Add to Contact Lists
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Select which contact lists to add the imported contacts to. You can skip this step to import contacts without adding them to lists.
                    </AlertDescription>
                  </Alert>

                  {contactLists.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No contact lists found</h3>
                      <p className="text-muted-foreground mb-6">
                        Contacts will be imported without being added to any lists.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contactLists.map(list => (
                        <div
                          key={list.id}
                          className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedLists.includes(list.id) 
                              ? 'bg-primary/10 border-primary' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => {
                            setSelectedLists(prev => 
                              prev.includes(list.id)
                                ? prev.filter(id => id !== list.id)
                                : [...prev, list.id]
                            );
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              selectedLists.includes(list.id)
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground'
                            }`}>
                              {selectedLists.includes(list.id) && (
                                <CheckCircle className="h-3 w-3 text-primary-foreground" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-medium">{list.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {list.active_contacts} active contacts
                              </p>
                            </div>
                          </div>
                          {selectedLists.includes(list.id) && (
                            <Badge>Selected</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep(2)}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Field Mapping
                    </Button>
                    <Button onClick={processImport} disabled={importing}>
                      {importing ? 'Importing...' : 'Start Import'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 4: Import Results */}
          {currentStep === 4 && importResult && (
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Import Complete
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {importResult.success}
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-400">
                        Successfully Imported
                      </div>
                    </div>
                    
                    {importResult.duplicates > 0 && (
                      <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          {importResult.duplicates}
                        </div>
                        <div className="text-sm text-yellow-600 dark:text-yellow-400">
                          Duplicates Skipped
                        </div>
                      </div>
                    )}
                    
                    {importResult.failed > 0 && (
                      <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {importResult.failed}
                        </div>
                        <div className="text-sm text-red-600 dark:text-red-400">
                          Failed to Import
                        </div>
                      </div>
                    )}
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-red-600 dark:text-red-400">Import Errors:</h4>
                      <div className="max-h-32 overflow-y-auto bg-red-50 dark:bg-red-900/20 rounded p-3">
                        {importResult.errors.slice(0, 10).map((error, index) => (
                          <div key={index} className="text-sm text-red-600 dark:text-red-400">
                            {error}
                          </div>
                        ))}
                        {importResult.errors.length > 10 && (
                          <div className="text-sm text-red-500 mt-2">
                            ... and {importResult.errors.length - 10} more errors
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center gap-3">
                    <Link href="/email-marketing/contacts">
                      <Button>
                        View Contacts
                      </Button>
                    </Link>
                    <Button variant="outline" onClick={() => {
                      setCsvData(null);
                      setFieldMappings([]);
                      setSelectedLists([]);
                      setImportResult(null);
                      setCurrentStep(1);
                    }}>
                      Import More Contacts
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Import Progress */}
          {importing && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
              <Card className="w-96">
                <CardContent className="p-6 space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold">Importing Contacts</h3>
                    <p className="text-muted-foreground">Please wait while we process your contacts...</p>
                  </div>
                  <Progress value={importProgress} className="w-full" />
                  <div className="text-center text-sm text-muted-foreground">
                    {importProgress}% complete
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </SidebarDemo>
  );
} 