'use client';

import React, { useEffect, useState } from 'react';
import { Progress } from './progress';
import { Card } from '@/components/ui/card';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card-content';
import { Loader2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface GenerationProgressProps {
  workspaceId: string;
  userId: string;
  batchId?: string;
  onComplete?: () => void;
}

export function GenerationProgress({ workspaceId, userId, batchId, onComplete }: GenerationProgressProps) {
  const [generatedArticles, setGeneratedArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState(false);

  // Helper function to deduplicate articles by title
  const deduplicateArticles = (articles: any[]) => {
    // First sort by created_at in descending order (newest first)
    const sortedArticles = [...articles].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA; // Newest first
    });
    
    // Keep track of titles we've seen
    const seenTitles = new Set<string>();
    const uniqueArticles: any[] = [];
    
    for (const article of sortedArticles) {
      // Skip invalid articles
      if (!article || !article.title) continue;
      
      // Skip duplicates, keeping only the first (newest) occurrence
      if (seenTitles.has(article.title)) continue;
      
      // Add to unique list and mark title as seen
      seenTitles.add(article.title);
      uniqueArticles.push(article);
    }
    
    console.log(`Deduplicated articles: ${articles.length} → ${uniqueArticles.length}`);
    return uniqueArticles;
  };

  // Load the latest generated articles
  const loadArticles = async () => {
    try {
      console.log('Loading articles with params:', { workspaceId, userId, batchId });
      
      // If there's a batch ID, use the /api/content endpoint which now supports batch filtering
      if (batchId) {
        try {
          console.log('Fetching content from API with batch ID:', batchId);
          const response = await fetch(`/api/content?workspaceId=${workspaceId}&batchId=${batchId}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (!response.ok) {
            console.error('Error loading articles from API:', response.status);
            const errorText = await response.text().catch(() => 'Unable to read error details');
            console.error('Error details:', errorText);
            
            // Try to parse the error as JSON if possible
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              // If parsing fails, just use the text
              errorData = { message: errorText };
            }
            console.error('Error fetching content:', errorData);
            
            // If API fails with 500 error, try direct database access as fallback
            if (response.status === 500) {
              console.log('Falling back to direct database query...');
              await loadArticlesDirectly();
              return;
            }
            
            throw new Error('Failed to load articles');
          }
          
          // First try to get the response as text to debug any JSON parsing issues
          const responseText = await response.text();
          
          let data;
          try {
            data = JSON.parse(responseText);
            console.log('Articles loaded from API:', data);
          } catch (parseError) {
            console.error('Error parsing API response:', parseError);
            console.error('Raw response text:', responseText);
            throw new Error('Invalid JSON response from server');
          }
          
          // Ensure content is always an array
          const contentArray = Array.isArray(data.content) ? data.content : 
                              data.content ? [data.content] : [];
          
          if (contentArray.length > 0) {
            setGeneratedArticles(contentArray);
            
            // Update progress and status information
            const initialProgress: Record<string, number> = {};
            const initialStatuses: Record<string, string> = {};
            const initialTitles: Record<string, string> = {};
            const initialErrors: Record<string, string> = {};
            
            for (const record of contentArray) {
              initialProgress[record.id] = record.generation_progress || 0;
              initialStatuses[record.id] = record.status || 'unknown';
              initialTitles[record.id] = record.title || 'Untitled Content';
              
              if (record.error_message) {
                initialErrors[record.id] = record.error_message;
              } else if (record.status === 'error') {
                initialErrors[record.id] = 'Content generation failed';
              }
            }
            
            setProgress(initialProgress);
            setStatuses(initialStatuses);
            setTitles(initialTitles);
            setErrors(initialErrors);
            
            // Check if all items are completed
            const hasInProgress = contentArray.some(article => article.status === 'generating');
            if (!hasInProgress && refreshInterval) {
              clearInterval(refreshInterval);
              setRefreshInterval(null);
              setIsCompleted(true);
              onComplete?.();
            }
          } else {
            console.log('No articles found for batch ID:', batchId);
          }
        } catch (apiError) {
          console.error('Error loading articles from API:', apiError);
          // Fall back to direct query if API fails
          await loadArticlesDirectly();
        }
      } else {
        // No batch ID provided, still try API first with just workspace ID
        try {
          console.log('Fetching recent content from API for workspace:', workspaceId);
          const response = await fetch(`/api/content?workspaceId=${workspaceId}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (!response.ok) {
            console.error('Error loading recent articles from API:', response.status);
            // Fall back to direct query
            await loadArticlesDirectly();
            return;
          }
          
          const responseText = await response.text();
          
          try {
            const data = JSON.parse(responseText);
            // Ensure content is always an array
            const contentArray = Array.isArray(data.content) ? data.content : 
                                data.content ? [data.content] : [];
            processArticlesData(contentArray);
          } catch (parseError) {
            console.error('Error parsing API response:', parseError);
            console.error('Raw response text:', responseText);
            // Fall back to direct query
            await loadArticlesDirectly();
          }
        } catch (apiError) {
          console.error('Error loading recent articles from API:', apiError);
          // Fall back to direct query
          await loadArticlesDirectly();
        }
      }
    } catch (err) {
      console.error('Error loading generated articles:', err);
      setError('Failed to load generation progress');
    } finally {
      setLoading(false);
    }
  };
  
  // Direct database query as fallback
  const loadArticlesDirectly = async () => {
    try {
      console.log('Using direct database query as fallback');
      
      // Start with a basic query to get recent articles for this workspace
      let query = supabase
        .from('generated_content')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      // If batch ID is provided, filter by it if it's valid
      if (batchId) {
        console.log('Filtering by batch ID:', batchId);
        query = query.eq('batch_id', batchId);
      }

      // Limit to 10 most recent articles
      const { data, error } = await query.limit(10);

      console.log('Direct query results:', { dataCount: data?.length, error });

      if (error) {
        console.error('Error in direct database query:', error);
        throw error;
      }
      
      // Use the common processor to ensure consistent state updates
      processArticlesData(data || []);
      
      // Return true if there are any articles still in progress
      const hasInProgress = data?.some(article => article.status === 'generating');
      return hasInProgress;
      
    } catch (dbError) {
      console.error('Fatal error in direct database query:', dbError);
      setError('Database query failed. Please try again later.');
      return false;
    }
  };

  // Set up polling for progress updates
  useEffect(() => {
    console.log('GenerationProgress mounted with:', { workspaceId, userId, batchId });
    loadArticles();
    
    // Set up refresh interval (every 5 seconds)
    const interval = setInterval(() => {
      loadArticles();
    }, 5000);
    
    setRefreshInterval(interval);
    
    // Clean up on unmount
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [workspaceId, batchId]);

  useEffect(() => {
    if (!batchId) return;
    
    // Initialize subscription to real-time changes
    const subscribeToUpdates = () => {
      console.log('Setting up Supabase subscription for batch ID:', batchId);
      
      const channel = supabase
        .channel(`public:generated_content:batch_id:${batchId}`)
        .on(
          'postgres_changes',
          {
            event: '*', 
            schema: 'public',
            table: 'generated_content',
            filter: `batch_id=eq.${batchId}`
          },
          (payload) => {
            console.log('Received Supabase update:', payload);
            console.log('Progress update for record:', payload.new.id, 'Progress:', payload.new.generation_progress);
            const { new: newRecord } = payload;
            
            if (!newRecord) {
              console.error('Received payload without new record data:', payload);
              return;
            }
            
            // Update progress for this record
            setProgress(prev => ({
              ...prev,
              [newRecord.id]: newRecord.generation_progress || 0
            }));
            
            // Update status
            setStatuses(prev => ({
              ...prev,
              [newRecord.id]: newRecord.status || prev[newRecord.id]
            }));
            
            // Update error if present - safely check if column exists
            if (newRecord.error_message !== undefined) {
              setErrors(prev => ({
                ...prev,
                [newRecord.id]: newRecord.error_message
              }));
            } else if (newRecord.status === 'error') {
              // If status is error but no error_message, set a generic error
              setErrors(prev => ({
                ...prev,
                [newRecord.id]: 'Content generation failed'
              }));
            }
            
            // Check if all are completed
            if (newRecord.status === 'success' || newRecord.status === 'error') {
              checkCompletionStatus();
            }
          }
        )
        .subscribe((status) => {
          console.log('Supabase subscription status:', status);
        });
      
      return () => {
        console.log('Cleaning up subscription');
        channel.unsubscribe();
      };
    };
    
    // Fetch initial data
    const fetchInitialData = async () => {
      console.log('Fetching initial data for batch:', batchId);
      
      try {
        // Use the enhanced API endpoint to get batch data
        const response = await fetch(`/api/content?workspaceId=${workspaceId}&batchId=${batchId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          console.error('Error fetching initial data from API:', response.status);
          // Fall back to direct query
          await fetchDirectFromDatabase();
          return;
        }
        
        // Try to get the response text first
        let responseText;
        try {
          responseText = await response.text();
          
          // Check if the response is empty
          if (!responseText || responseText.trim() === '') {
            console.error('Empty response from API');
            await fetchDirectFromDatabase();
            return;
          }
          
          // Try to parse the response text
          const data = JSON.parse(responseText);
          console.log('Initial data from API:', data);
          
          if (!data || !data.content) {
            console.log('No content in API response, falling back to direct query');
            await fetchDirectFromDatabase();
            return;
          }
          
          // Handle both array and single object cases
          const contentArray = Array.isArray(data.content) ? data.content : 
                              data.content ? [data.content] : [];
                              
          if (contentArray.length > 0) {
            processRecords(contentArray);
          } else {
            console.log('No records found for batch:', batchId);
            // Try direct database access as fallback
            await fetchDirectFromDatabase();
          }
        } catch (parseError) {
          console.error('Error parsing API response:', parseError);
          if (responseText) console.error('Raw response text:', responseText);
          // Try direct database access as fallback
          await fetchDirectFromDatabase();
        }
      } catch (err) {
        console.error('Error fetching initial data from API:', err);
        // Try direct database access as fallback
        await fetchDirectFromDatabase();
      }
    };
    
    // Fallback to direct database access
    const fetchDirectFromDatabase = async () => {
      try {
        console.log('Fetching directly from database for batch:', batchId);
        
        if (!batchId) {
          console.error('No batch ID provided for direct database fetch');
          return;
        }
        
        // First check if error_message column exists by trying to select it
        const testQuery = await supabase
          .from('generated_content')
          .select('id, error_message')
          .limit(1);
          
        const hasErrorMessageColumn = !testQuery.error;
        console.log('Has error_message column:', hasErrorMessageColumn);
        
        // Adjust the select statement based on column existence
        let query;
        if (hasErrorMessageColumn) {
          query = await supabase
            .from('generated_content')
            .select('id, title, generation_progress, status, error_message, batch_id')
            .eq('batch_id', batchId);
        } else {
          query = await supabase
            .from('generated_content')
            .select('id, title, generation_progress, status, batch_id')
            .eq('batch_id', batchId);
        }
        
        const { data, error } = query;
          
        if (error) {
          console.error('Error fetching initial data from database:', error);
          return;
        }
        
        if (!data || data.length === 0) {
          console.log('No records found for batch ID in direct database query:', batchId);
          return;
        }
        
        console.log('Direct database query results:', { count: data.length });
        
        // Validate records before processing
        const validRecords = data.filter(record => record && record.id);
        if (validRecords.length !== data.length) {
          console.warn(`Found ${data.length - validRecords.length} invalid records in database query`);
        }
        
        processRecords(validRecords);
      } catch (err) {
        console.error('Error in fetchDirectFromDatabase:', err);
        setError('Failed to load generation progress');
      }
    };
    
    // Process records and update state
    const processRecords = (records: any[]) => {
      if (!records || records.length === 0) {
        return;
      }
      
      // Deduplicate records by title
      const uniqueRecords = deduplicateArticles(records);
      setGeneratedArticles(uniqueRecords);
      
      // Initialize progress, statuses, and titles
      const initialProgress: Record<string, number> = {};
      const initialStatuses: Record<string, string> = {};
      const initialTitles: Record<string, string> = {};
      const initialErrors: Record<string, string> = {};
      
      for (const record of uniqueRecords) {
        if (!record || !record.id) continue;
        
        initialProgress[record.id] = record.generation_progress || 0;
        initialStatuses[record.id] = record.status || 'unknown';
        initialTitles[record.id] = record.title || 'Untitled Content';
        
        // Handle error message safely
        if (record.error_message) {
          initialErrors[record.id] = record.error_message;
        } else if (record.status === 'error') {
          // If status is error but no error_message column or value, set a generic error
          initialErrors[record.id] = 'Content generation failed';
        }
      }
      
      setProgress(initialProgress);
      setStatuses(initialStatuses);
      setTitles(initialTitles);
      setErrors(initialErrors);
      
      // Check if all are already completed
      checkCompletionStatus();
    };
    
    // Function to check if all generation tasks are completed
    const checkCompletionStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('generated_content')
          .select('status')
          .eq('batch_id', batchId);
          
        if (error) {
          console.error('Error checking completion status:', error);
          return;
        }
        
        if (!data || data.length === 0) {
          console.log('No records found when checking completion status');
          return;
        }
        
        // Check if all records have a final status (success or error)
        const allCompleted = data.every(record => 
          record.status === 'success' || record.status === 'error'
        );
        
        if (allCompleted && !isCompleted) {
          console.log('All generation tasks completed');
          setIsCompleted(true);
          onComplete?.();
        }
      } catch (error) {
        console.error('Error in checkCompletionStatus:', error);
      }
    };
    
    // Run initial fetch and set up subscription
    fetchInitialData();
    const cleanup = subscribeToUpdates();
    
    // Set up polling as a fallback
    const pollInterval = setInterval(() => {
      if (!isCompleted) {
        fetchInitialData();
      }
    }, 5000); // Poll every 5 seconds
    
    // Cleanup function
    return () => {
      cleanup();
      clearInterval(pollInterval);
    };
  }, [batchId, isCompleted, onComplete]);

  // Add a helper function to process article data consistently
  const processArticlesData = (articles: any[]) => {
    if (!Array.isArray(articles) || articles.length === 0) {
      setGeneratedArticles([]);
      return;
    }
    
    // Deduplicate articles by title - keep only the most recent version of each title
    const uniqueArticles = deduplicateArticles(articles);
    
    setGeneratedArticles(uniqueArticles);
    
    // Update progress and status information
    const initialProgress: Record<string, number> = {};
    const initialStatuses: Record<string, string> = {};
    const initialTitles: Record<string, string> = {};
    const initialErrors: Record<string, string> = {};
    
    for (const record of uniqueArticles) {
      if (!record || !record.id) {
        console.warn('Invalid article record found:', record);
        continue;
      }
      
      initialProgress[record.id] = record.generation_progress || 0;
      initialStatuses[record.id] = record.status || 'unknown';
      initialTitles[record.id] = record.title || 'Untitled Content';
      
      if (record.error_message) {
        initialErrors[record.id] = record.error_message;
      } else if (record.status === 'error') {
        initialErrors[record.id] = 'Content generation failed';
      }
    }
    
    setProgress(initialProgress);
    setStatuses(initialStatuses);
    setTitles(initialTitles);
    setErrors(initialErrors);
    
    // Check if all items are completed
    const hasInProgress = uniqueArticles.some(article => article?.status === 'generating');
    if (!hasInProgress && refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
      setIsCompleted(true);
      onComplete?.();
    }
  };

  if (loading) {
    return (
      <Card className="bg-background border-border text-foreground">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Generation Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-background border-border text-foreground">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" /> Error Loading Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2" 
            onClick={() => {
              setLoading(true);
              setError(null);
              loadArticles();
            }}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (generatedArticles.length === 0) {
    return (
      <Card className="bg-background border-border text-foreground">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5" /> Generation Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">No previously generated content found for this workspace.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background border-border text-foreground">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5" /> Generation Progress 
          {refreshInterval && (
            <span className="ml-2">
              <Loader2 className="h-4 w-4 inline animate-spin text-muted-foreground" />
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(progress).map(([id, progressValue]) => (
          <div 
            key={id} 
            className="border border-border rounded-md p-3 space-y-2"
          >
            <div className="flex justify-between items-start">
              <h3 className="font-medium text-foreground">{titles[id] || 'Content'}</h3>
              <div className="flex">
                {statuses[id] === 'success' && (
                  <span className="bg-green-900/30 text-green-400 text-xs rounded-full px-2 py-1 flex items-center">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                  </span>
                )}
                {statuses[id] === 'generating' && (
                  <span className="bg-blue-200 dark:bg-blue-900/30 text-blue-400 text-xs rounded-full px-2 py-1 flex items-center">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating
                  </span>
                )}
                {statuses[id] === 'error' && (
                  <span className="bg-red-900/30 text-red-400 text-xs rounded-full px-2 py-1 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" /> Error
                  </span>
                )}
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{statuses[id] === 'success' ? 'Completed' : 
                         statuses[id] === 'error' ? 'Failed' : 
                         `${progressValue}%`}</span>
              </div>
              <Progress 
                value={progressValue} 
                className="h-1.5 bg-background" 
                indicatorClassName={
                  statuses[id] === 'error' ? 'bg-red-500' : 
                  statuses[id] === 'success' ? 'bg-green-500' : 
                  'bg-blue-500'
                }
              />
            </div>
            
            {statuses[id] === 'success' && (
              <div className="pt-1">
                <Link 
                  href={`/content-viewer/${id}`} 
                  className="inline-block text-sm px-3 py-1.5 bg-background hover:bg-gray-200 dark:bg-muted text-foreground rounded-md"
                >
                  View Article
                </Link>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
} 