'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SidebarDemo } from '@/components/ui/code.demo';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Inbox, MoveRight, AlertCircle, Save, Trash2, Search, RefreshCw, SaveAll, Mail, Upload, Database } from 'lucide-react';
import { LeadDialog } from '@/components/leads/LeadDialog';
import { GmailFolderSidebar } from '@/components/gmail/GmailFolderSidebar';
import { EmailPopup } from '@/components/gmail/EmailPopup';
import { supabase } from "@/lib/supabase";
import { Input } from '@/components/ui/input';
import { LeadImportDialog } from '@/components/leads/LeadImportDialog';
import { ExistingLeadImportDialog } from '@/components/leads/ExistingLeadImportDialog';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Email {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  from_email?: string;
  subject: string;
  date: string;
  body?: string;
  unread?: boolean;
}

// Define the Lead type (matching LeadDialog structure)
interface Lead {
  id: string;
  lead_name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  service_category: string;
  website_url: string;
  monthly_traffic: number;
  current_rank: string;
  target_keywords: string[];
  qualification_score: number;
  notes: string;
}

export default function GmailHubPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [emails, setEmails] = useState<Email[]>([]);
  const [filteredEmails, setFilteredEmails] = useState<Email[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadInitialData, setLeadInitialData] = useState<Partial<Lead> | undefined>(undefined);
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [savingAllEmails, setSavingAllEmails] = useState(false);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emailPopupOpen, setEmailPopupOpen] = useState(false);
  
  // Setup the migration hook to ensure the saved_emails table exists
  useEffect(() => {
    const setupDatabase = async () => {
      try {
        // Call the migration endpoint to ensure the saved_emails table exists
        const response = await fetch('/api/migrations/create-saved-emails-table');
        if (!response.ok) {
          console.error('Failed to setup database:', await response.json());
        }
      } catch (error) {
        console.error('Error setting up database:', error);
      }
    };
    
    setupDatabase();
  }, []);
  
  // Fetch active workspace
  useEffect(() => {
    const fetchWorkspace = async () => {
      if (!session?.user?.id) return;

      try {
        // Instead of using is_personal, just get the first workspace owned by this user
        const { data: workspaces, error } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', session.user.id)
          .order('created_at', { ascending: true })
          .limit(1);

        if (error) throw error;
        if (workspaces && workspaces.length > 0) {
          setActiveWorkspace(workspaces[0].id);
        } else {
          // If no workspace exists, create a default one
          const { data: newWorkspace, error: createError } = await supabase
            .from('workspaces')
            .insert([{
              name: 'Default Workspace', 
              owner_id: session.user.id,
            }])
            .select()
            .single();
          
          if (createError) throw createError;
          if (newWorkspace) {
            setActiveWorkspace(newWorkspace.id);
          }
        }
      } catch (error) {
        console.error('Error fetching workspace:', error);
        toast.error('Failed to load workspace');
      }
    };

    fetchWorkspace();
  }, [session]);
  
  useEffect(() => {
    const fetchEmails = async () => {
      if (!session) return;
      setLoading(true);
      setError(null);
      setErrorCode(null);
      try {
        // If we have an active folder, get its query
        let searchQuery = '';
        if (activeFolder) {
          const { data: folder, error: folderError } = await supabase
            .from('gmail_folders')
            .select('query')
            .eq('id', activeFolder)
            .single();
          
          if (folderError) throw folderError;
          searchQuery = folder.query;
        }

        const response = await fetch('/api/gmail/fetch' + (searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''));
        if (!response.ok) {
          const errorData = await response.json();
          if (errorData.code) {
            setErrorCode(errorData.code);
          }
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setEmails(data.emails || []);
        setFilteredEmails(data.emails || []);
      } catch (err: any) {
        console.error("Failed to fetch emails:", err);
        setError(err.message || 'Failed to load emails. Please ensure Google permissions are granted and try again.');
        
        // Auto-show the connection dialog if this appears to be a connection issue
        if (errorCode && ['NO_INTEGRATION', 'INVALID_TOKEN', 'PERMISSION_DENIED', 'AUTH_FAILED_AFTER_REFRESH', 'REFRESH_FAILED'].includes(errorCode)) {
          setConnectionDialogOpen(true);
        } else {
          toast.error(err.message || 'Failed to load emails.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEmails();
  }, [session, activeFolder, errorCode]);

  // Filter emails based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEmails(emails);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = emails.filter(email => 
      email.from.toLowerCase().includes(query) || 
      email.subject.toLowerCase().includes(query) || 
      email.snippet.toLowerCase().includes(query)
    );
    
    setFilteredEmails(filtered);
  }, [searchQuery, emails]);

  const handleConvertToLead = (email: Email) => {
    // Basic parsing attempt (can be improved significantly)
    const fromParts = email.from.match(/^(.*)<(.*)>$/);
    const leadName = fromParts ? fromParts[1].trim() : email.from;
    const emailAddress = fromParts ? fromParts[2].trim() : email.from;
    
    // Look for potential company name in subject or snippet
    const companyGuess = email.subject.includes('Inquiry from') ? email.subject.split('Inquiry from')[1].trim() : '';

    setLeadInitialData({
      lead_name: leadName,
      email: emailAddress,
      company: companyGuess, // Needs refinement
      source: 'gmail_hub', // Indicate source
      notes: `Original Subject: ${email.subject}\n\nSnippet:\n${email.snippet}`,
      // TODO: Add more sophisticated parsing for other fields if possible
    });
    setLeadDialogOpen(true);
  };

  const saveEmailToDatabase = async (email: Email) => {
    if (!session?.user?.id || !activeWorkspace) {
      toast.error('No active workspace');
      return;
    }

    setSavingEmail(email.id);
    try {
      // Check if email already exists in database
      const { data: existingEmail, error: checkError } = await supabase
        .from('saved_emails')
        .select('id')
        .eq('email_id', email.id)
        .eq('workspace_id', activeWorkspace)
        .single();

      if (existingEmail) {
        toast.info('Email already saved');
        setSavingEmail(null);
        return;
      }
      
      // Save email to database
      const { error } = await supabase
        .from('saved_emails')
        .insert({
          email_id: email.id,
          thread_id: email.threadId,
          snippet: email.snippet,
          from_address: email.from,
          subject: email.subject,
          received_date: email.date,
          workspace_id: activeWorkspace,
          user_id: session.user.id,
          category: activeFolder || 'inbox'
        });

      if (error) throw error;
      toast.success('Email saved to database');
    } catch (error) {
      console.error('Error saving email:', error);
      toast.error('Failed to save email');
    } finally {
      setSavingEmail(null);
    }
  };

  const saveAllEmailsToDatabase = async () => {
    if (!session?.user?.id || !activeWorkspace) {
      toast.error('No active workspace');
      return;
    }

    if (filteredEmails.length === 0) {
      toast.info('No emails to save');
      return;
    }

    setSavingAllEmails(true);
    let savedCount = 0;
    let alreadySavedCount = 0;
    let errorCount = 0;

    try {
      // Create a progress toast
      toast.loading(`Saving ${filteredEmails.length} emails...`);

      // Process emails in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < filteredEmails.length; i += batchSize) {
        const batch = filteredEmails.slice(i, i + batchSize);
        
        // First check which emails already exist
        const emailIds = batch.map(email => email.id);
        const { data: existingEmails, error: checkError } = await supabase
          .from('saved_emails')
          .select('email_id')
          .in('email_id', emailIds)
          .eq('workspace_id', activeWorkspace);
        
        if (checkError) throw checkError;
        
        // Create a set of existing email IDs for quick lookup
        const existingEmailIds = new Set((existingEmails || []).map((e: { email_id: string }) => e.email_id));
        alreadySavedCount += existingEmailIds.size;
        
        // Filter out emails that already exist
        const newEmails = batch.filter(email => !existingEmailIds.has(email.id));
        
        // Skip if all emails in this batch already exist
        if (newEmails.length === 0) continue;
        
        // Prepare the data for insertion
        const emailsToInsert = newEmails.map(email => ({
          email_id: email.id,
          thread_id: email.threadId,
          snippet: email.snippet,
          from_address: email.from,
          subject: email.subject,
          received_date: email.date,
          workspace_id: activeWorkspace,
          user_id: session.user.id,
          category: activeFolder || 'inbox'
        }));
        
        // Insert the batch
        const { error } = await supabase
          .from('saved_emails')
          .insert(emailsToInsert);
        
        if (error) {
          console.error('Error saving batch:', error);
          errorCount += newEmails.length;
        } else {
          savedCount += newEmails.length;
        }
        
        // Update progress toast
        const progress = Math.round(((i + batch.length) / filteredEmails.length) * 100);
        toast.loading(`Saving emails: ${progress}% complete`);
      }
      
      // Show final result
      toast.dismiss();
      if (savedCount > 0) {
        toast.success(`Saved ${savedCount} emails to database`);
      }
      if (alreadySavedCount > 0) {
        toast.info(`${alreadySavedCount} emails were already saved`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to save ${errorCount} emails`);
      }
    } catch (error) {
      console.error('Error in save all operation:', error);
      toast.dismiss();
      toast.error('Failed to save all emails');
    } finally {
      setSavingAllEmails(false);
    }
  };

  const deleteEmail = async (emailId: string) => {
    if (!session) return;

    setDeletingEmail(emailId);
    try {
      const response = await fetch(`/api/gmail/delete?id=${emailId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Remove email from the list
      setEmails(prevEmails => prevEmails.filter(email => email.id !== emailId));
      setFilteredEmails(prevEmails => prevEmails.filter(email => email.id !== emailId));
      toast.success('Email deleted successfully');
    } catch (err: any) {
      console.error("Failed to delete email:", err);
      toast.error(err.message || 'Failed to delete email');
    } finally {
      setDeletingEmail(null);
    }
  };

  const handleReconnectGmail = () => {
    setReconnecting(true);
    
    // Use the existing NextAuth Google provider for authentication
    window.location.href = `/api/auth/signin/google?callbackUrl=${encodeURIComponent('/gmail-hub')}`;
  };

  // Function to open email popup
  const handleOpenEmail = (email: Email) => {
    setSelectedEmail(email);
    setEmailPopupOpen(true);
  };

  return (
    <SidebarDemo>
      <div className="flex h-[calc(100vh-2rem)] bg-background">
        {session?.user?.id && activeWorkspace && (
          <GmailFolderSidebar
            workspaceId={activeWorkspace}
            userId={session.user.id}
            activeFolder={activeFolder}
            onFolderChange={setActiveFolder}
          />
        )}

        <div className="flex-1 p-8 space-y-6 overflow-y-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Gmail Inbox</h1>
              <p className="text-muted-foreground">View and respond to all emails from your connected Gmail account.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConnectionDialogOpen(true)}
                disabled={reconnecting}
                className="flex items-center gap-2"
              >
                {reconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Reconnect Gmail
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={saveAllEmailsToDatabase}
                disabled={savingAllEmails || !activeWorkspace || filteredEmails.length === 0}
                className="flex items-center gap-2"
              >
                {savingAllEmails ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save All Emails
              </Button>
              
              {activeWorkspace && session?.user?.id && (
                <>
                  <LeadImportDialog
                    workspaceId={activeWorkspace}
                    userId={session.user.id}
                    trigger={
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 bg-green-100 hover:bg-green-200 dark:bg-green-600 dark:hover:bg-green-700 border-green-300 dark:border-green-600 text-green-800 dark:text-foreground"
                      >
                        <Upload className="h-4 w-4" />
                        Import from Gmail
                      </Button>
                    }
                  />
                  
                  <ExistingLeadImportDialog
                    workspaceId={activeWorkspace}
                    userId={session.user.id}
                    trigger={
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-600 dark:hover:bg-blue-700 border-blue-300 dark:border-blue-600 text-blue-800 dark:text-foreground"
                      >
                        <Database className="h-4 w-4" />
                        Import Leads
                      </Button>
                    }
                  />
                </>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emails by sender, subject, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background border-border"
            />
          </div>

          <Card className="bg-background/50 backdrop-blur-sm border-border">
            <div className="p-4">
              {loading && (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading emails...</span>
                </div>
              )}
              {error && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400 mb-2" />
                  <p className="text-red-400">Error loading emails:</p>
                  <p className="text-sm text-muted-foreground max-w-md">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setConnectionDialogOpen(true)}
                    className="mt-4"
                  >
                    Reconnect Gmail
                  </Button>
                </div>
              )}
              {!loading && !error && filteredEmails.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Inbox className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No emails found matching your criteria.</p>
                  <p className="text-sm text-muted-foreground">Try labeling potential leads in Gmail or adjust fetch criteria.</p>
                </div>
              )}
              {!loading && !error && filteredEmails.length > 0 && (
                <ul className="divide-y divide-neutral-800">
                  {filteredEmails.map((email) => (
                    <li key={email.id} className="py-4 px-2 flex items-center justify-between gap-4 hover:bg-muted rounded-md">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpenEmail(email)}>
                        <div className="flex items-center gap-2">
                          {email.unread && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                          <p className={`text-sm font-medium ${email.unread ? 'text-foreground' : 'text-foreground'} truncate font-sans`}>
                            {email.from}
                          </p>
                        </div>
                        <p className={`text-sm ${email.unread ? 'font-medium text-foreground' : 'text-muted-foreground'} truncate font-sans`}>
                          {email.subject}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 truncate font-sans leading-relaxed">
                          {email.snippet}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(email.date).toLocaleDateString()} {new Date(email.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEmail(email)}
                          className="flex items-center gap-1"
                        >
                          <Mail className="h-3 w-3" />
                          View
                        </Button>
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => saveEmailToDatabase(email)}
                          disabled={!activeWorkspace || savingEmail === email.id}
                          className="flex items-center gap-1"
                        >
                          {savingEmail === email.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          Save
                        </Button>
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => handleConvertToLead(email)}
                          disabled={!activeWorkspace}
                          className="flex items-center gap-1"
                        >
                          <MoveRight className="h-3 w-3" /> Convert
                        </Button>
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => deleteEmail(email.id)}
                          disabled={deletingEmail === email.id}
                          className="flex items-center gap-1 text-red-600 dark:text-red-400 hover:text-red-400 hover:bg-red-950/20"
                        >
                          {deletingEmail === email.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {session?.user?.id && activeWorkspace && (
          <LeadDialog
            open={leadDialogOpen}
            onOpenChange={setLeadDialogOpen}
            workspaceId={activeWorkspace}
            userId={session.user.id}
            initialData={leadInitialData}
            onSuccess={() => {
              setLeadDialogOpen(false);
              // Optionally, refresh emails or mark converted email as read/archived in Gmail
            }}
          />
        )}

        {session?.user?.id && activeWorkspace && (
          <EmailPopup
            email={selectedEmail}
            open={emailPopupOpen}
            onOpenChange={setEmailPopupOpen}
            workspaceId={activeWorkspace}
            userId={session.user.id}
          />
        )}

        <Dialog open={connectionDialogOpen} onOpenChange={setConnectionDialogOpen}>
          <DialogContent className="bg-background border-border text-foreground">
            <DialogHeader>
              <DialogTitle>Gmail Connection Issue</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {errorCode === 'NO_INTEGRATION' && "Your Gmail account isn't connected to this workspace."}
                {errorCode === 'INVALID_TOKEN' && "Your Gmail connection has expired or is invalid."}
                {errorCode === 'PERMISSION_DENIED' && "You don't have permission to access Gmail with the current connection."}
                {errorCode === 'AUTH_FAILED_AFTER_REFRESH' && "Authentication failed even after trying to refresh your connection."}
                {errorCode === 'REFRESH_FAILED' && "Failed to refresh your Gmail authentication."}
                {!errorCode && "There's an issue with your Gmail connection."}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              You need to reconnect your Gmail account to fix this issue. This will redirect you to Google's authentication page.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConnectionDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReconnectGmail} className="bg-primary hover:bg-primary/90">
                {reconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Reconnect Gmail
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarDemo>
  );
} 