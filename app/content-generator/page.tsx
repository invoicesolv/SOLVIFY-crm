'use client';

import React, { useState, useEffect } from 'react';
import { SidebarDemo } from '@/components/ui/code.demo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card-content';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { getActiveWorkspaceId } from '@/lib/permission';
import { GenerationProgress } from '@/components/ui/generation-progress';
import { 
  Database, 
  Globe, 
  Home, 
  PlusCircle, 
  Trash2,
  History,
  Eye,
  X,
  Copy,
  Loader2,
  Pencil,
  Save,
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// For Markdown rendering
import { marked } from 'marked';

// Define interfaces for form state based on options
interface GenerationTask {
  mainKeyword: string;
  title: string;
  keywords: string;
  outline: string;
}

interface CoreSettings {
  language: string;
  articleType: string;
  articleSize: string;
}

interface ContentSettings {
  toneOfVoice: string;
}

interface AISettings {
  useApiKey: boolean;
  aiModel: string;
  pointOfView: string;
  textReadability: string;
  targetCountry: string;
  aiContentCleaning: string;
  brandVoice: string;
}

interface DetailsToInclude {
  details: string;
}

interface MediaHub {
  aiImages: string;
  numberOfImages: number;
  imageStyle: string;
  imageSize: string;
  additionalInstructions: string;
  brandName: string;
  youtubeVideos: string;
  numberOfVideos: number;
  distributeEvenly: boolean;
}

interface Structure {
  introHook: string;
  hookBrief: string;
  includeConclusion: boolean;
  includeTables: boolean;
  includeH3: boolean;
  includeLists: boolean;
  includeItalics: boolean;
  includeQuotes: boolean;
  includeTakeaways: boolean;
  includeFaq: boolean;
  includeBold: boolean;
}

interface Linking {
  website: string;
  linkType: string;
  webAccess: string;
}

interface Syndication {
  twitterPost: boolean;
  linkedinPost: boolean;
  facebookPost: boolean;
  emailNewsletter: boolean;
  whatsappMessage: boolean;
  pinterestPin: boolean;
  linkToPage: string;
}

interface DocumentSettings {
  saveDirectory: string;
}

interface Publishing {
  targetWebsite: string;
}

interface Workspace {
  id: string;
  name: string;
}

interface GeneratedItem {
  id: string;
  title: string;
  content: string;
  status: 'success' | 'error';
  workspace: string;
  error?: string;
}

// Add a new interface for blog publishing
interface BlogPublishing {
  publishToBlog: boolean;
  blogUrl: string;
  blogCategory: string;
}

export default function ContentGeneratorPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<string>('');
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [generationTasks, setGenerationTasks] = useState<GenerationTask[]>([
    { mainKeyword: '', title: '', keywords: '', outline: '' }
  ]);
  
  // Add state for generated content
  const [generatedContent, setGeneratedContent] = useState<GeneratedItem[]>([]);
  const [previousContent, setPreviousContent] = useState<any[]>([]);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [selectedContent, setSelectedContent] = useState<GeneratedItem | null>(null);
  const [showContentModal, setShowContentModal] = useState(false);
  
  // Core Settings
  const [coreSettings, setCoreSettings] = useState<CoreSettings>({
    language: 'en-us',
    articleType: 'none',
    articleSize: 'medium'
  });
  
  // Content Settings
  const [contentSettings, setContentSettings] = useState<ContentSettings>({
    toneOfVoice: 'friendly'
  });
  
  // AI Settings
  const [aiSettings, setAiSettings] = useState<AISettings>({
    useApiKey: false,
    aiModel: 'default',
    pointOfView: 'none',
    textReadability: 'none',
    targetCountry: 'us',
    aiContentCleaning: 'none',
    brandVoice: 'none'
  });
  
  // Details to Include
  const [detailsToInclude, setDetailsToInclude] = useState<DetailsToInclude>({
    details: ''
  });
  
  // Media Hub
  const [mediaHub, setMediaHub] = useState<MediaHub>({
    aiImages: 'none',
    numberOfImages: 3,
    imageStyle: '',
    imageSize: '1344x768',
    additionalInstructions: '',
    brandName: '',
    youtubeVideos: 'none',
    numberOfVideos: 1,
    distributeEvenly: true
  });
  
  // Structure
  const [structure, setStructure] = useState<Structure>({
    introHook: 'question',
    hookBrief: '',
    includeConclusion: true,
    includeTables: true,
    includeH3: true,
    includeLists: true,
    includeItalics: true,
    includeQuotes: true,
    includeTakeaways: true,
    includeFaq: true,
    includeBold: true
  });
  
  // Linking
  const [linking, setLinking] = useState<Linking>({
    website: 'none',
    linkType: 'none',
    webAccess: 'none'
  });
  
  // Syndication
  const [syndication, setSyndication] = useState<Syndication>({
    twitterPost: false,
    linkedinPost: false,
    facebookPost: false,
    emailNewsletter: false,
    whatsappMessage: false,
    pinterestPin: false,
    linkToPage: 'no-link'
  });
  
  // Document
  const [documentSettings, setDocumentSettings] = useState<DocumentSettings>({
    saveDirectory: 'home'
  });
  
  // Publishing
  const [publishing, setPublishing] = useState<Publishing>({
    targetWebsite: 'none'
  });

  // Add state for batch ID
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

  // Add the blog publishing state to the component
  const [blogPublishing, setBlogPublishing] = useState<BlogPublishing>({
    publishToBlog: false,
    blogUrl: '',
    blogCategory: 'general'
  });

  // Add a state for the blog categories
  const [blogCategories, setBlogCategories] = useState<string[]>([
    'general', 'business', 'technology', 'marketing', 'lifestyle', 'health'
  ]);

  // Add Unsplash API key state
  const [unsplashApiKey, setUnsplashApiKey] = useState<string>('');

  // Add state for website URLs
  const [websiteUrls, setWebsiteUrls] = useState<{id: string, url: string}[]>([]);

  // Add state for bulk import modal
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkKeywords, setBulkKeywords] = useState('');

  // Load workspaces when component mounts
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      loadWorkspaces();
    }
  }, [session, status]);

  // Function to load workspaces
  const loadWorkspaces = async () => {
    try {
      setLoadingWorkspaces(true);
      
      // Try to get the active workspace ID from localStorage or backend
      let workspaceId: string | null = null;
      
      if (typeof window !== 'undefined') {
        workspaceId = localStorage.getItem(`workspace_${session?.user?.id}`);
      }
      
      if (!workspaceId) {
        // If no workspace found in localStorage, try to get from backend
        workspaceId = await getActiveWorkspaceId(session?.user?.id as string);
      }
      
      // Get team memberships for the user
      const { data: teamData, error: teamError } = await supabase
        .from("team_members")
        .select(`
          workspace_id,
          workspaces:workspace_id (
            id,
            name
          )
        `)
        .eq("user_id", session?.user?.id);

      if (teamError) {
        console.error("Error loading team data:", teamError);
        toast.error("Failed to load workspaces");
        return;
      }

      const workspaceData = teamData?.map(item => item.workspaces) || [];
      setWorkspaces(workspaceData);
      
      if (workspaceId && workspaceData.some(ws => ws.id === workspaceId)) {
        setActiveWorkspace(workspaceId);
      } else if (workspaceData.length > 0) {
        // If no matching workspace found, use the first one
        setActiveWorkspace(workspaceData[0].id);
        
        // Store this selection
        if (typeof window !== 'undefined' && session?.user?.id) {
          localStorage.setItem(`workspace_${session.user.id}`, workspaceData[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading workspaces:", error);
      toast.error("Failed to load workspaces");
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  // Handle workspace selection
  const handleWorkspaceChange = (workspaceId: string) => {
    setActiveWorkspace(workspaceId);
    
    // Store the selection in localStorage
    if (session?.user?.id && typeof window !== 'undefined') {
      localStorage.setItem(`workspace_${session.user.id}`, workspaceId);
    }
  };

  // Add/remove task functions
  const addGenerationTask = () => {
    setGenerationTasks([...generationTasks, { mainKeyword: '', title: '', keywords: '', outline: '' }]);
  };

  const removeGenerationTask = (index: number) => {
    const updatedTasks = [...generationTasks];
    updatedTasks.splice(index, 1);
    setGenerationTasks(updatedTasks);
  };

  // Update task functions
  const updateGenerationTask = (index: number, field: keyof GenerationTask, value: string) => {
    const updatedTasks = [...generationTasks];
    updatedTasks[index] = { ...updatedTasks[index], [field]: value };
    setGenerationTasks(updatedTasks);
  };

  // Bulk keyword processing function
  const handleKeywordPaste = (index: number, pastedText: string) => {
    // Split by common delimiters: newlines, commas, semicolons, tabs
    const keywords = pastedText
      .split(/[\n,;\t]+/)
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 0);

    if (keywords.length <= 1) {
      // If only one keyword or no keywords, just update the current field
      updateGenerationTask(index, 'mainKeyword', pastedText);
      return;
    }

    // Fill existing empty rows first, then create new ones if needed
    const updatedTasks = [...generationTasks];
    let currentIndex = index;

    keywords.forEach((keyword, keywordIndex) => {
      if (currentIndex < updatedTasks.length) {
        // Update existing row
        updatedTasks[currentIndex] = {
          ...updatedTasks[currentIndex],
          mainKeyword: keyword
        };
      } else {
        // Create new row only if we've run out of existing rows
        updatedTasks.push({
          mainKeyword: keyword,
          title: '',
          keywords: '',
          outline: ''
        });
      }
      currentIndex++;
    });

    setGenerationTasks(updatedTasks);

    // Show success message
    toast.success(`Filled ${keywords.length} main keywords into rows`);
  };

  // Bulk title processing function
  const handleTitlePaste = (index: number, pastedText: string) => {
    // Split by common delimiters: newlines, commas, semicolons, tabs
    const titles = pastedText
      .split(/[\n,;\t]+/)
      .map(title => title.trim())
      .filter(title => title.length > 0);

    if (titles.length <= 1) {
      // If only one title or no titles, just update the current field
      updateGenerationTask(index, 'title', pastedText);
      return;
    }

    // Fill existing rows first, then create new ones if needed
    const updatedTasks = [...generationTasks];
    let currentIndex = index;

    titles.forEach((title, titleIndex) => {
      if (currentIndex < updatedTasks.length) {
        // Update existing row
        updatedTasks[currentIndex] = {
          ...updatedTasks[currentIndex],
          title: title
        };
      } else {
        // Create new row only if we've run out of existing rows
        updatedTasks.push({
          mainKeyword: '',
          title: title,
          keywords: '',
          outline: ''
        });
      }
      currentIndex++;
    });

    setGenerationTasks(updatedTasks);

    // Show success message
    toast.success(`Filled ${titles.length} titles into rows`);
  };

  // Bulk additional keywords processing function
  const handleAdditionalKeywordsPaste = (index: number, pastedText: string) => {
    // Split by common delimiters: newlines, commas, semicolons, tabs
    const keywords = pastedText
      .split(/[\n,;\t]+/)
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 0);

    if (keywords.length <= 1) {
      // If only one keyword or no keywords, just update the current field
      updateGenerationTask(index, 'keywords', pastedText);
      return;
    }

    // Fill existing rows first, then create new ones if needed
    const updatedTasks = [...generationTasks];
    let currentIndex = index;

    keywords.forEach((keyword, keywordIndex) => {
      if (currentIndex < updatedTasks.length) {
        // Update existing row
        updatedTasks[currentIndex] = {
          ...updatedTasks[currentIndex],
          keywords: keyword
        };
      } else {
        // Create new row only if we've run out of existing rows
        updatedTasks.push({
          mainKeyword: '',
          title: '',
          keywords: keyword,
          outline: ''
        });
      }
      currentIndex++;
    });

    setGenerationTasks(updatedTasks);

    // Show success message
    toast.success(`Filled ${keywords.length} additional keywords into rows`);
  };

  // Bulk import function
  const handleBulkImport = () => {
    if (!bulkKeywords.trim()) {
      toast.error('Please enter some keywords to import');
      return;
    }

    // Split by common delimiters: newlines, commas, semicolons, tabs
    const keywords = bulkKeywords
      .split(/[\n,;\t]+/)
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 0);

    if (keywords.length === 0) {
      toast.error('No valid keywords found');
      return;
    }

    // Create new tasks for each keyword
    const newTasks: GenerationTask[] = keywords.map(keyword => ({
      mainKeyword: keyword,
      title: '', // Will be auto-generated or user can fill
      keywords: '',
      outline: ''
    }));

    // Replace all existing tasks with new ones
    setGenerationTasks(newTasks);
    
    // Close modal and reset
    setShowBulkImportModal(false);
    setBulkKeywords('');

    // Show success message
    toast.success(`Imported ${keywords.length} keywords as generation tasks`);
  };

  // Add function to load previous content
  const loadPreviousContent = async () => {
    if (!activeWorkspace) {
      console.log('Cannot load previous content - no active workspace');
      return;
    }
    
    console.log('Loading previous content for workspace:', activeWorkspace);
    setLoadingPrevious(true);
    
    try {
      console.log('Fetching from /api/content endpoint...');
      const response = await fetch(`/api/content?workspaceId=${activeWorkspace}`, {
        // Add cache: no-store to prevent caching
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      console.log('API response status:', response.status);
      
      // Handle non-OK responses
      if (!response.ok) {
        console.error('Error response status:', response.status);
        // Don't show error toast, just log it and continue with empty array
        console.log('Setting empty previous content due to API error');
        setPreviousContent([]);
        setLoadingPrevious(false);
        return;
      }
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Error parsing response as JSON:', jsonError);
        // Don't show error toast, just log it and continue
        setPreviousContent([]);
        setLoadingPrevious(false);
        return;
      }
      
      console.log('Previous content loaded. Items:', data.content?.length);
      
      if (data.content && Array.isArray(data.content)) {
        // Format the content items
        const formattedContent = data.content.map((item: any) => ({
          id: item.id,
          title: item.title,
          content: item.content || '',
          status: item.status || 'error',
          workspace: item.workspace_id,
          error: item.error_message || (item.status === 'error' ? 'Content generation failed' : ''),
          createdAt: item.created_at,
          updatedAt: item.updated_at
        }));
        
        console.log('Formatted content items:', formattedContent.length);
        setPreviousContent(formattedContent);
      } else {
        console.log('No previous content found or invalid response format');
        setPreviousContent([]);
      }
    } catch (error) {
      console.error('Error loading previous content:', error);
      // Don't show error to user, just log it and continue
      console.log('Setting empty previous content due to error');
      setPreviousContent([]);
    } finally {
      setLoadingPrevious(false);
    }
  };

  // Modify the useEffect for workspace loading
  useEffect(() => {
    async function loadWorkspaces() {
      if (!session?.user?.id) {
        setLoadingWorkspaces(false);
        return;
      }

      try {
        setLoadingWorkspaces(true);
        // First try to get active workspace from localStorage
        if (typeof window !== 'undefined') {
          const storedWorkspace = localStorage.getItem(`workspace_${session.user.id}`);
          if (storedWorkspace) {
            setActiveWorkspace(storedWorkspace);
            console.log('Loaded active workspace from localStorage:', storedWorkspace);
          }
        }

        // Fetch workspaces from database
        const { data: memberships, error: membershipError } = await supabase
          .from('team_members')
          .select('workspace_id, workspaces(id, name)')
          .eq('user_id', session.user.id);

        if (membershipError) throw membershipError;

        // Also fetch workspaces where user is an owner
        const { data: ownedWorkspaces, error: ownedError } = await supabase
          .from('workspaces')
          .select('id, name')
          .eq('owner_id', session.user.id);

        if (ownedError) throw ownedError;

        // Combine team memberships and owned workspaces
        const memberWorkspaces = (memberships as any[] | null)
          ?.filter(m => m.workspaces)
          .map(m => ({
            id: m.workspaces.id,
            name: m.workspaces.name,
          })) || [];

        const ownedWorkspacesFormatted = (ownedWorkspaces as any[] | null)?.map(w => ({
          id: w.id,
          name: w.name,
        })) || [];

        // Combine and deduplicate workspaces
        const allWorkspaces = [...memberWorkspaces];
        ownedWorkspacesFormatted.forEach(owned => {
          if (!allWorkspaces.some(w => w.id === owned.id)) {
            allWorkspaces.push(owned);
          }
        });

        setWorkspaces(allWorkspaces);
        
        // If we have workspaces but no active workspace set yet, use the first one
        if (allWorkspaces.length > 0 && !activeWorkspace) {
          setActiveWorkspace(allWorkspaces[0].id);
          
          // Store this selection
          if (typeof window !== 'undefined' && session.user.id) {
            localStorage.setItem(`workspace_${session.user.id}`, allWorkspaces[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading workspaces:', error);
        toast.error('Failed to load workspaces');
      } finally {
        setLoadingWorkspaces(false);
      }
    }

    loadWorkspaces();
  }, [session?.user?.id]);

  // Modify the effect to load previous content when activeWorkspace changes
  useEffect(() => {
    if (activeWorkspace) {
      loadPreviousContent();
    }
  }, [activeWorkspace]);

  // Load Unsplash and blog settings from workspace_settings
  useEffect(() => {
    const loadExternalApiSettings = async () => {
      if (!activeWorkspace) return;
      
      try {
        const { data, error } = await supabase
          .from('workspace_settings')
          .select('unsplash_api_key, blog_url')
          .eq('workspace_id', activeWorkspace)
          .maybeSingle();
        
        if (error) throw error;
        
        if (data) {
          if (data.unsplash_api_key) {
            setUnsplashApiKey(data.unsplash_api_key);
            
            // Update media hub settings to enable Unsplash if we have a key
            if (data.unsplash_api_key.trim() !== '') {
              setMediaHub(prev => ({
                ...prev,
                aiImages: 'unsplash' // Enable Unsplash if we have a key
              }));
            }
          }
          
          if (data.blog_url) {
            const blogUrl = data.blog_url;
            setBlogPublishing(prev => ({
              ...prev,
              blogUrl: blogUrl
            }));
            
            // Also add the blog URL as a website option for publishing
            setWebsiteUrls([{ id: 'blog', url: blogUrl }]);
            
            // Set as the default targetWebsite if we don't have one selected yet
            if (publishing.targetWebsite === 'none') {
              setPublishing(prev => ({
                ...prev,
                targetWebsite: blogUrl
              }));
            }
          }
        }
      } catch (error) {
        console.error("Error loading external API settings:", error);
      }
    };
    
    loadExternalApiSettings();
  }, [activeWorkspace]);

  // Update handleGenerate to include Unsplash API and blog publishing options
  const handleGenerate = async () => {
    if (!session?.user?.id) {
      toast.error('Please sign in to generate content');
      return;
    }
    
    if (!activeWorkspace) {
      toast.error('Please select a workspace first');
      return;
    }
    
    if (generationTasks.some(task => !task.mainKeyword.trim())) {
      toast.error('Please provide keywords for all generation tasks');
      return;
    }
    
    // Validate if trying to use Unsplash without API key
    if (mediaHub.aiImages === 'unsplash' && (!unsplashApiKey || unsplashApiKey.trim() === '')) {
      toast.error('Unsplash API key is required for using Unsplash images. Please add it in Settings.');
      return;
    }
    
    // Validate if trying to publish to blog without URL
    if (blogPublishing.publishToBlog && (!blogPublishing.blogUrl || blogPublishing.blogUrl.trim() === '')) {
      toast.error('Blog URL is required for publishing. Please add it in Settings.');
      return;
    }
    
    setLoading(true);

    try {
      // Initialize batch ID for this generation run
    const batchId = crypto.randomUUID();
      console.log(`Starting content generation with batch ID: ${batchId}`);

      // Prepare the initial records
      const initialRecords = generationTasks.map(task => ({
        workspace_id: activeWorkspace,
        user_id: session.user.id,
        batch_id: batchId,
        title: task.title || task.mainKeyword,
        main_keyword: task.mainKeyword,
        status: 'initializing',
        generation_progress: 0,
        created_at: new Date().toISOString()
      }));
      
      // Create initial records in the database
      const { data: createdRecords, error: recordError } = await supabase
        .from('generated_content')
        .insert(initialRecords)
        .select();
      
      if (recordError) {
        console.error("Error creating initial records:", recordError);
        toast.error('Failed to initialize content generation');
        setLoading(false);
        return;
      }
      
      console.log("Created initial records:", createdRecords);
      
      // Initialize the content generation
      const response = await fetch('/api/generate-content/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks: generationTasks,
          coreSettings,
          contentSettings,
          aiSettings,
          detailsToInclude,
          mediaHub: {
            ...mediaHub,
            unsplashApiKey: unsplashApiKey // Include Unsplash API key
          },
          structure,
          linking,
          syndication,
          documentSettings,
          publishing, // Include website publishing options
          blogPublishing, // Include blog publishing options
          batchId,
          workspaceId: activeWorkspace,
        }),
      });
      
      const data = await response.json();

      if (!response.ok) {
        console.error("Error initializing content generation:", data);
        toast.error(data.error || 'Failed to initialize content generation');
        setLoading(false);
        return;
      }
      
      console.log("Content generation initialized:", data);
      
      // Now start the actual content generation process
      const generateResponse = await fetch('/api/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generationTasks,
          coreSettings,
          contentSettings,
          aiSettings,
          detailsToInclude,
          mediaHub: {
            ...mediaHub,
            unsplashApiKey: unsplashApiKey
          },
          structure,
          linking,
          syndication,
          documentSettings,
          publishing, // Include website publishing options
          blogPublishing,
          batchId,
          workspaceId: activeWorkspace,
        }),
      });
      
      // We don't need to wait for this to complete as it runs asynchronously
      // Just check if the request was accepted
      if (!generateResponse.ok) {
        const generateError = await generateResponse.json();
        console.error("Error starting content generation:", generateError);
        toast.error(generateError.error || 'Failed to start content generation');
        setLoading(false);
        return;
      }
      
      toast.success('Content generation started');
      
      // Set current batch ID for tracking
      setCurrentBatchId(batchId);

    } catch (error) {
      console.error("Error during content generation:", error);
      toast.error('Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  // Add a function to view content
  const viewContent = (content: GeneratedItem) => {
    console.log('Viewing content:', content);
    setSelectedContent(content);
    setShowContentModal(true);
  };

  // Add a function to delete content
  const deleteContent = async (contentId: string) => {
    if (!contentId) return;
    
    if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error deleting content:', errorData);
        toast.error(errorData.error || 'Failed to delete content');
        return;
      }
      
      // Remove the deleted content from the list
      setPreviousContent(previousContent.filter(item => item.id !== contentId));
      toast.success('Content deleted successfully');
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete content');
    }
  };

  return (
    <SidebarDemo>
      <div className="min-h-screen bg-background dark:bg-gray-900 text-foreground">
        <div className="container mx-auto p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Bulk Content Generation</h1>
              <p className="text-sm text-muted-foreground">
                Configure and generate multiple SEO-optimized articles based on your settings.
              </p>
            </div>
            
            {/* Workspace selector */}
            <div className="relative">
              <select
                value={activeWorkspace || ''}
                onChange={(e) => handleWorkspaceChange(e.target.value)}
                disabled={loadingWorkspaces || workspaces.length === 0}
                className="appearance-none bg-background border border-border dark:border-border rounded-md px-4 py-2 pr-8 text-foreground focus:outline-none focus:ring-2 focus:ring-neutral-600 min-w-40"
              >
                <option value="" disabled>Select Workspace</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <Card className="bg-background border-border text-foreground">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5" /> Generation Tasks
              </CardTitle>
              <CardDescription>
                Add keywords, titles, and additional keywords for the articles you want to generate.
                <br />
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  💡 Tip: Paste multiple items (separated by commas or new lines) to fill existing rows. New rows are only created when both Main Keyword and Title are filled.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {generationTasks.map((task, index) => (
                <div key={index} className="border-b border-border dark:border-border pb-4 mb-4">
                  <div className="flex items-end gap-2 mb-2">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`main-keyword-${index}`} className="text-xs text-muted-foreground">Main Keyword*</Label>
                      <div className="flex gap-2">
                        <Input 
                          id={`main-keyword-${index}`} 
                          value={task.mainKeyword}
                          onChange={(e) => updateGenerationTask(index, 'mainKeyword', e.target.value)}
                          onPaste={(e) => {
                            e.preventDefault();
                            const pastedText = e.clipboardData.getData('text');
                            handleKeywordPaste(index, pastedText);
                          }}
                          placeholder="Enter your main keyword (paste multiple to fill rows)" 
                          className="bg-background border-border dark:border-border text-foreground" 
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="whitespace-nowrap border-border dark:border-border text-foreground dark:text-neutral-300 hover:bg-background"
                        >
                          Generate
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`title-${index}`} className="text-xs text-muted-foreground">Title*</Label>
                      <div className="flex gap-2">
                        <Input 
                          id={`title-${index}`} 
                          value={task.title}
                          onChange={(e) => updateGenerationTask(index, 'title', e.target.value)}
                          onPaste={(e) => {
                            e.preventDefault();
                            const pastedText = e.clipboardData.getData('text');
                            handleTitlePaste(index, pastedText);
                          }}
                          placeholder="Enter your blog title or topic (paste multiple to fill rows)" 
                          className="bg-background border-border dark:border-border text-foreground" 
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="whitespace-nowrap border-border dark:border-border text-foreground dark:text-neutral-300 hover:bg-background"
                        >
                          Generate
                        </Button>
                      </div>
                    </div>
                    
                    <Button 
                      type="button"
                      onClick={() => removeGenerationTask(index)}
                      disabled={generationTasks.length === 1} 
                      variant="ghost" 
                      size="icon" 
                      className="text-foreground0 hover:text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`keywords-${index}`} className="text-xs text-muted-foreground">Additional Keywords</Label>
                    <Input 
                      id={`keywords-${index}`} 
                      value={task.keywords}
                      onChange={(e) => updateGenerationTask(index, 'keywords', e.target.value)}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedText = e.clipboardData.getData('text');
                        handleAdditionalKeywordsPaste(index, pastedText);
                      }}
                      placeholder="Enter additional keywords (paste multiple to fill rows)" 
                      className="bg-background border-border dark:border-border text-foreground" 
                    />
                  </div>
                </div>
              ))}
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  type="button"
                  onClick={addGenerationTask} 
                  variant="outline" 
                  size="sm" 
                  className="border-border dark:border-border text-foreground dark:text-neutral-300 hover:bg-background"
                >
                  <PlusCircle className="h-4 w-4 mr-2" /> Add Row
                </Button>
                <Button 
                  type="button"
                  onClick={() => setShowBulkImportModal(true)}
                  variant="outline" 
                  size="sm" 
                  className="border-border dark:border-border text-foreground dark:text-neutral-300 hover:bg-background"
                >
                  Bulk Import Keywords
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm" 
                  className="border-border dark:border-border text-foreground dark:text-neutral-300 hover:bg-background"
                >
                  Save Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* --- Configuration Sections --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Core Settings Card */}
            <Card className="bg-background border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Core Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="language" className="text-sm text-muted-foreground">Language</Label>
                  <Select>
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="en-us">English (US)</SelectItem>
                      <SelectItem value="en-uk">English (UK)</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="sv">Swedish</SelectItem>
                      {/* More languages can be added */}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="articleType" className="text-sm text-muted-foreground">Article Type</Label>
                  <Select>
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select article type" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="how-to">How To Guide</SelectItem>
                      <SelectItem value="listicle">Listicle</SelectItem>
                      <SelectItem value="product-review">Product Review</SelectItem>
                      <SelectItem value="comparison">Comparison Article</SelectItem>
                      <SelectItem value="news">News Article</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="articleSize" className="text-sm text-muted-foreground">Article Size</Label>
                  <Select>
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select article size" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="small">Small (1200-1800 words, 5-7 H2)</SelectItem>
                      <SelectItem value="medium">Medium (2400-3600 words, 9-12 H2)</SelectItem>
                      <SelectItem value="large">Large (4800-6000 words, 12-15 H2)</SelectItem>
                      <SelectItem value="extra-large">Extra Large (7200+ words, 15+ H2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Content Settings Card */}
            <Card className="bg-background border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Content Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="tone" className="text-sm text-muted-foreground">Tone of voice</Label>
                  <Select>
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                      <SelectItem value="authoritative">Authoritative</SelectItem>
                      <SelectItem value="informative">Informative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* AI Settings Card */}
            <Card className="bg-background border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5" /> AI Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Checkbox id="use-api-key" className="bg-background border-border dark:border-border" />
                  <Label htmlFor="use-api-key" className="text-muted-foreground">Use API Key</Label>
                </div>
                
                <div>
                  <Label htmlFor="ai-model" className="text-sm text-muted-foreground">AI Model</Label>
                  <Select>
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="default">Default (1 credit)</SelectItem>
                      <SelectItem value="llama4">Llama 4 (2 credits)</SelectItem>
                      <SelectItem value="gpt4">GPT-4 (3 credits)</SelectItem>
                      <SelectItem value="deepseek">DeepSeek R1 (2 credits)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="point-of-view" className="text-sm text-muted-foreground">Point of view</Label>
                  <Select>
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select point of view" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="first-person">First Person (I, We)</SelectItem>
                      <SelectItem value="second-person">Second Person (You)</SelectItem>
                      <SelectItem value="third-person">Third Person (He, She, They)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="readability" className="text-sm text-muted-foreground">Text Readability</Label>
                  <Select>
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select readability" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="basic">Basic (8-10 grade level)</SelectItem>
                      <SelectItem value="intermediate">Intermediate (11-12 grade level)</SelectItem>
                      <SelectItem value="advanced">Advanced (College level)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="target-country" className="text-sm text-muted-foreground">Target country</Label>
                  <Select>
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="us">United States</SelectItem>
                      <SelectItem value="uk">United Kingdom</SelectItem>
                      <SelectItem value="ca">Canada</SelectItem>
                      <SelectItem value="au">Australia</SelectItem>
                      <SelectItem value="se">Sweden</SelectItem>
                      {/* More countries can be added */}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="ai-cleaning" className="text-sm text-muted-foreground">AI Content Cleaning</Label>
                  <Select>
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select cleaning level" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="none">No AI Words Removal</SelectItem>
                      <SelectItem value="light">Light Cleaning</SelectItem>
                      <SelectItem value="moderate">Moderate Cleaning</SelectItem>
                      <SelectItem value="heavy">Heavy Cleaning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="brand-voice" className="text-sm text-muted-foreground">Brand Voice</Label>
                  <Select>
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select brand voice" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      {/* More brand voices can be added */}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-foreground0 mt-1">Create unique styles and tones for different situations using Brand Voice, ensuring your content always remains consistent.</p>
                </div>
              </CardContent>
            </Card>

            {/* Details to Include Card */}
            <Card className="bg-background border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Details to Include
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="details" className="text-sm text-muted-foreground mb-2 block">
                  What details would you like to include in your article?
                </Label>
                <Textarea 
                  id="details" 
                  placeholder="e.g. phone number as 212-555-1234" 
                  className="bg-background border-border dark:border-border text-foreground h-32 resize-none"
                />
                <p className="text-xs text-foreground0 mt-2">Include specific details, facts, or information you want included in the generated content.</p>
              </CardContent>
            </Card>
            
            {/* Media Hub Card */}
            <Card className="bg-background border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Media Hub
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="aiImages" className="text-foreground dark:text-neutral-300 mb-2 block">
                      AI Images
                    </Label>
                    <Select
                      value={mediaHub.aiImages}
                      onValueChange={(value) => setMediaHub({...mediaHub, aiImages: value})}
                    >
                      <SelectTrigger className="bg-background border-border dark:border-border text-foreground dark:text-neutral-300">
                        <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                      <SelectContent className="bg-background border-border dark:border-border text-gray-800 dark:text-foreground">
                        <SelectItem value="none" className="hover:bg-gray-200 dark:bg-muted">None</SelectItem>
                        <SelectItem value="dall-e" className="hover:bg-gray-200 dark:bg-muted">DALL-E</SelectItem>
                        <SelectItem value="stable-diffusion" className="hover:bg-gray-200 dark:bg-muted">Stable Diffusion</SelectItem>
                        <SelectItem value="unsplash" className="hover:bg-gray-200 dark:bg-muted">Unsplash Images</SelectItem>
                    </SelectContent>
                  </Select>
                    {mediaHub.aiImages === 'unsplash' && !unsplashApiKey && (
                      <p className="text-amber-500 text-sm mt-1 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" /> 
                        Unsplash API key required. Add in Settings.
                      </p>
                    )}
                </div>
                
                  {mediaHub.aiImages !== 'none' && (
                    <>
                <div>
                  <Label htmlFor="num-images" className="text-sm text-muted-foreground">Number of images</Label>
                  <Select 
                    value={mediaHub.numberOfImages.toString()}
                    onValueChange={(value) => setMediaHub({...mediaHub, numberOfImages: parseInt(value)})}
                  >
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select number" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="6">6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="image-style" className="text-sm text-muted-foreground">Image Style</Label>
                  <Input 
                    id="image-style" 
                    placeholder="Enter image style (e.g., vibrant, minimalist)" 
                    className="bg-background border-border dark:border-border text-foreground mt-1"
                    value={mediaHub.imageStyle}
                    onChange={(e) => setMediaHub({...mediaHub, imageStyle: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="image-size" className="text-sm text-muted-foreground">Image Size</Label>
                  <Select
                    value={mediaHub.imageSize}
                    onValueChange={(value) => setMediaHub({...mediaHub, imageSize: value})}
                  >
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="1344x768">1344×768 (16:9)</SelectItem>
                      <SelectItem value="1024x1024">1024×1024 (1:1)</SelectItem>
                      <SelectItem value="768x1024">768×1024 (3:4)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="additional-instructions" className="text-sm text-muted-foreground">Additional Instructions</Label>
                  <Input 
                    id="additional-instructions" 
                    placeholder="Enter details or creative directions" 
                    className="bg-background border-border dark:border-border text-foreground mt-1"
                    value={mediaHub.additionalInstructions}
                    onChange={(e) => setMediaHub({...mediaHub, additionalInstructions: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label htmlFor="brand-name" className="text-sm text-muted-foreground">Brand Name</Label>
                  <Input 
                    id="brand-name" 
                    placeholder="Enter your brand name" 
                    className="bg-background border-border dark:border-border text-foreground mt-1"
                    value={mediaHub.brandName}
                    onChange={(e) => setMediaHub({...mediaHub, brandName: e.target.value})}
                  />
                </div>
                
                <p className="text-xs text-foreground0 mt-2">Include the main keyword in the first image as Alt-text. Relevant keywords will be picked up and added to the rest of the images.</p>
                
                <div className="mt-4">
                  <Label htmlFor="youtube-videos" className="text-sm text-muted-foreground">YouTube videos</Label>
                  <Select
                    value={mediaHub.youtubeVideos}
                    onValueChange={(value) => setMediaHub({...mediaHub, youtubeVideos: value})}
                  >
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select video option" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="auto">Auto-select relevant videos</SelectItem>
                      <SelectItem value="manual">Manual URL input</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="num-videos" className="text-sm text-muted-foreground">Number of videos</Label>
                  <Select
                    value={mediaHub.numberOfVideos.toString()}
                    onValueChange={(value) => setMediaHub({...mediaHub, numberOfVideos: parseInt(value)})}
                  >
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select number" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2 mt-4">
                  <Checkbox 
                    id="distribute-evenly" 
                    className="bg-background border-border dark:border-border" 
                    checked={mediaHub.distributeEvenly}
                    onCheckedChange={(checked) => setMediaHub({...mediaHub, distributeEvenly: checked === true})}
                  />
                  <Label htmlFor="distribute-evenly" className="text-muted-foreground">Distribute evenly</Label>
                </div>
                <p className="text-xs text-foreground0 mt-1">All media elements will be placed strictly under the headings. If disabled, the AI will decide and find the best placement.</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Structure Card */}
            <Card className="bg-background border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Structure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="intro-hook" className="text-sm text-muted-foreground">Introductory Hook Brief</Label>
                  <Select>
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select hook type" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="statistic">Statistical or Fact</SelectItem>
                      <SelectItem value="quotation">Quotation</SelectItem>
                      <SelectItem value="anecdotal">Anecdotal or Story</SelectItem>
                      <SelectItem value="emotional">Personal or Emotional</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea 
                    id="hook-brief" 
                    placeholder="Enter the type of hook for the article's opening sentence" 
                    className="bg-background border-border dark:border-border text-foreground mt-2 h-20" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-conclusion" className="bg-background border-border dark:border-border" defaultChecked />
                    <Label htmlFor="include-conclusion" className="text-muted-foreground">Conclusion</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-tables" className="bg-background border-border dark:border-border" defaultChecked />
                    <Label htmlFor="include-tables" className="text-muted-foreground">Tables</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-h3" className="bg-background border-border dark:border-border" defaultChecked />
                    <Label htmlFor="include-h3" className="text-muted-foreground">H3</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-lists" className="bg-background border-border dark:border-border" defaultChecked />
                    <Label htmlFor="include-lists" className="text-muted-foreground">Lists</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-italics" className="bg-background border-border dark:border-border" defaultChecked />
                    <Label htmlFor="include-italics" className="text-muted-foreground">Italics</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-quotes" className="bg-background border-border dark:border-border" defaultChecked />
                    <Label htmlFor="include-quotes" className="text-muted-foreground">Quotes</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-takeaways" className="bg-background border-border dark:border-border" defaultChecked />
                    <Label htmlFor="include-takeaways" className="text-muted-foreground">Key Takeaways</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-faq" className="bg-background border-border dark:border-border" defaultChecked />
                    <Label htmlFor="include-faq" className="text-muted-foreground">FAQ</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-bold" className="bg-background border-border dark:border-border" defaultChecked />
                    <Label htmlFor="include-bold" className="text-muted-foreground">Bold</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Internal Linking Card */}
            <Card className="bg-background border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Internal Linking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Automatically index your site and add links relevant to your content. Select a Website and our semantic search will find the best pages to link to within your article.</p>
                
                <div>
                  <Label htmlFor="website-select" className="text-sm text-muted-foreground">Select a Website</Label>
                  <Select>
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select website" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="none">None</SelectItem>
                      {/* Here you would dynamically populate with user's websites */}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-foreground0 mt-1">Unlimited internal URLs crawlable.</p>
                </div>
                
                <div className="mt-6">
                  <h3 className="font-medium text-foreground mb-2">External Linking</h3>
                  <div>
                    <Label htmlFor="link-type" className="text-sm text-muted-foreground">Link Type</Label>
                    <Select>
                      <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                        <SelectValue placeholder="Select link type" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border dark:border-border text-foreground">
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="authority">Authority Sites</SelectItem>
                        <SelectItem value="reference">Reference Links</SelectItem>
                        <SelectItem value="custom">Custom URLs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <p className="text-xs text-foreground0 mt-3">External Linking automatically integrates authoritative and relevant external links into your content, while also allowing you to manually specify desired links.</p>
                </div>
                
                <div className="mt-6">
                  <h3 className="font-medium text-foreground mb-2">Connect to Web</h3>
                  <div>
                    <Label htmlFor="web-access" className="text-sm text-muted-foreground">Access</Label>
                    <Select>
                      <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                        <SelectValue placeholder="Select access option" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border dark:border-border text-foreground">
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="basic">Basic (1 credit)</SelectItem>
                        <SelectItem value="pro">Pro (3 credits)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <p className="text-xs text-foreground0 mt-2">Currently, your "Connect to Web" is off, limiting you to pre-trained data. Enabling it reduces AI hallucinations and improves accuracy.</p>
                </div>
              </CardContent>
            </Card>

            {/* Syndication Card */}
            <Card className="bg-background border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Syndication
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Create marketing materials based on the article for various platforms.</p>
                
                {/* Success/error message display */}
                {generatedContent.length > 0 && (
                  <div className={`p-3 rounded-md mt-2 mb-2 ${
                    generatedContent[0]?.status === 'success' 
                      ? 'bg-green-100 dark:bg-green-900/20 border border-green-600/20 text-green-600 dark:text-green-400' 
                      : 'bg-red-100 dark:bg-red-900/20 border border-red-600/20 text-red-600 dark:text-red-400'
                  }`}>
                    <p className="text-sm flex items-center">
                      {generatedContent[0]?.status === 'success' 
                        ? <><CheckCircle2 className="h-4 w-4 mr-2" /> Content generated successfully!</>
                        : <><AlertCircle className="h-4 w-4 mr-2" /> Failed to generate content: {generatedContent[0]?.error || 'Unknown error'}</>
                      }
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="twitter-post" className="bg-background border-border dark:border-border" />
                    <Label htmlFor="twitter-post" className="text-muted-foreground">Twitter post</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="linkedin-post" className="bg-background border-border dark:border-border" />
                    <Label htmlFor="linkedin-post" className="text-muted-foreground">LinkedIn post</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="facebook-post" className="bg-background border-border dark:border-border" />
                    <Label htmlFor="facebook-post" className="text-muted-foreground">Facebook post</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="email-newsletter" className="bg-background border-border dark:border-border" />
                    <Label htmlFor="email-newsletter" className="text-muted-foreground">Email newsletter</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="whatsapp-message" className="bg-background border-border dark:border-border" />
                    <Label htmlFor="whatsapp-message" className="text-muted-foreground">WhatsApp message</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox id="pinterest-pin" className="bg-background border-border dark:border-border" />
                    <Label htmlFor="pinterest-pin" className="text-muted-foreground">Pinterest Pin</Label>
                  </div>
                </div>
                
                <div className="mt-4">
                  <Label htmlFor="link-to-page" className="text-sm text-muted-foreground">Link to page</Label>
                  <Select>
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select link option" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="no-link">No Link</SelectItem>
                      <SelectItem value="auto">Auto-generated Link</SelectItem>
                      <SelectItem value="custom">Custom URL</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-foreground0 mt-1">No link will be used in the creation of marketing materials, ensuring clean and appealing content.</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Document Card */}
            <Card className="bg-background border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Document
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="save-to-directory" className="text-sm text-muted-foreground">Save to</Label>
                  <div className="flex items-center mt-1">
                    <div className="bg-background border border-border dark:border-border rounded-l-md px-3 py-2 text-muted-foreground">
                      Directory: Home
                    </div>
                    <Button variant="outline" className="rounded-l-none bg-gray-200 dark:bg-muted hover:bg-gray-300 dark:hover:bg-neutral-600 text-foreground border-0">
                      Change
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Publishing Card */}
            <Card className="bg-background border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Publishing to Website
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="target-website" className="text-sm text-muted-foreground">Target Website</Label>
                  <Select 
                    value={publishing.targetWebsite}
                    onValueChange={(value) => setPublishing({...publishing, targetWebsite: value})}
                  >
                    <SelectTrigger className="w-full bg-background border-border dark:border-border text-foreground mt-1">
                      <SelectValue placeholder="Select website" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border dark:border-border text-foreground">
                      <SelectItem value="none">None</SelectItem>
                      {websiteUrls.map(site => (
                        <SelectItem key={site.id} value={site.url}>
                          {site.url}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {websiteUrls.length === 0 ? (
                    <p className="text-xs text-amber-500 mt-1">
                      No websites found. Add a blog URL in Settings to enable publishing.
                    </p>
                  ) : (
                    <p className="text-xs text-foreground0 mt-1">
                      Select the website where the content will be published.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Add this new section before the Generate button */}
          <Card className="bg-background border-border mb-4">
            <CardHeader>
              <CardTitle className="text-xl text-foreground flex items-center gap-2">
                <Globe className="h-5 w-5 text-muted-foreground" /> 
                Blog Publishing
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Publish the generated content directly to your blog
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="publishToBlog"
                  checked={blogPublishing.publishToBlog}
                  onCheckedChange={(checked) => setBlogPublishing(prev => ({ ...prev, publishToBlog: checked }))}
                />
                <Label htmlFor="publishToBlog" className="text-foreground dark:text-neutral-300">
                  Publish to blog after generation
                </Label>
              </div>
              
              {blogPublishing.publishToBlog && (
                <>
                  <div className="mt-4">
                    <Label htmlFor="blogUrl" className="text-foreground dark:text-neutral-300 mb-2 block">
                      Blog URL
                    </Label>
                    <Input
                      id="blogUrl"
                      disabled={true}
                      value={blogPublishing.blogUrl || 'No blog connected. Configure in Settings.'}
                      className="bg-background border-border dark:border-border text-foreground dark:text-neutral-300"
                    />
                    {!blogPublishing.blogUrl && (
                      <p className="text-amber-500 text-sm mt-1 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        You need to connect your blog in Settings
                      </p>
                    )}
                  </div>
                  
                  <div className="mt-4">
                    <Label htmlFor="blogCategory" className="text-foreground dark:text-neutral-300 mb-2 block">
                      Blog Category
                    </Label>
                    <Select
                      value={blogPublishing.blogCategory}
                      onValueChange={(value) => setBlogPublishing(prev => ({ ...prev, blogCategory: value }))}
                    >
                      <SelectTrigger className="bg-background border-border dark:border-border text-foreground dark:text-neutral-300">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border dark:border-border text-gray-800 dark:text-foreground">
                        {blogCategories.map(category => (
                          <SelectItem key={category} value={category} className="hover:bg-gray-200 dark:bg-muted">
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleGenerate} 
              disabled={loading || generationTasks.some(task => !task.mainKeyword.trim() || !task.title.trim())}
              className="bg-gradient-to-r from-violet-500 to-indigo-500 text-foreground hover:from-violet-600 hover:to-indigo-600"
            >
              {loading ? 'Generating...' : 'Run Bulk Article Generation'}
            </Button>
          </div>

          {/* Add Generation Progress component if we have an active workspace */}
          {activeWorkspace && session?.user?.id && (
            <div className="mt-6">
              <GenerationProgress 
                workspaceId={activeWorkspace} 
                userId={session.user.id}
                batchId={currentBatchId || undefined}
              />
              
              {/* Debug button - only visible during development */}
              {process.env.NODE_ENV !== 'production' && currentBatchId && (
                <div className="mt-4 flex flex-col space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        // First get the record ID
                        const response = await fetch(`/api/content?workspaceId=${activeWorkspace}&batchId=${currentBatchId}`);
                        const data = await response.json();
                        
                        if (data.content && data.content.length > 0) {
                          const recordId = data.content[0].id;
                          
                          // Test updating progress
                          const debugResponse = await fetch(`/api/debug-generation?recordId=${recordId}`);
                          const debugData = await debugResponse.json();
                          
                          console.log('Debug response:', debugData);
                          toast.success(`Manually updated progress to ${debugData.newProgress}%`);
                        } else {
                          toast.error('No content records found to debug');
                        }
                      } catch (error) {
                        console.error('Debug error:', error);
                        toast.error('Failed to test progress updates');
                      }
                    }}
                  >
                    Test Progress Update
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        // Manually trigger content generation again
                        const response = await fetch('/api/generate-content', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            generationTasks,
                            coreSettings,
                            contentSettings,
                            aiSettings,
                            detailsToInclude,
                            mediaHub: {
                              ...mediaHub,
                              unsplashApiKey: unsplashApiKey
                            },
                            structure,
                            linking,
                            syndication,
                            documentSettings,
                            blogPublishing,
                            batchId: currentBatchId,
                            workspaceId: activeWorkspace,
                          }),
                        });
                        
                        if (response.ok) {
                          toast.success('Manually triggered content generation');
                        } else {
                          const errorData = await response.json();
                          toast.error(`Failed to trigger generation: ${errorData.error}`);
                        }
                      } catch (error) {
                        console.error('Retry error:', error);
                        toast.error('Failed to retry content generation');
                      }
                    }}
                  >
                    Retry Content Generation
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-yellow-600 text-yellow-500 hover:bg-yellow-950"
                    onClick={async () => {
                      try {
                        // First get the record ID
                        const response = await fetch(`/api/content?workspaceId=${activeWorkspace}&batchId=${currentBatchId}`);
                        const data = await response.json();
                        
                        if (data.content && data.content.length > 0) {
                          const recordId = data.content[0].id;
                          
                          // Force progress to 100%
                          const forceResponse = await fetch('/api/generate-content/force-progress', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              recordId,
                              progress: 100
                            }),
                          });
                          
                          const forceData = await forceResponse.json();
                          
                          if (forceResponse.ok) {
                            console.log('Force complete response:', forceData);
                            toast.success('Forced content completion');
                          } else {
                            toast.error(`Failed to force completion: ${forceData.error}`);
                          }
                        } else {
                          toast.error('No content records found to force complete');
                        }
                      } catch (error) {
                        console.error('Force complete error:', error);
                        toast.error('Failed to force content completion');
                      }
                    }}
                  >
                    Force Complete (100%)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add section to show previous content after the form */}
        <div className="container mx-auto mt-8 pb-12">
          <div className="bg-background border border-border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" /> Previously Generated Content
            </h2>
            
            {loadingPrevious ? (
              <div className="py-4 text-center">
                <Loader2 className="animate-spin h-6 w-6 mx-auto mb-2" />
                <p className="text-muted-foreground">Loading previous content...</p>
              </div>
            ) : previousContent.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center">
                No previously generated content found for this workspace.
              </p>
            ) : (
              <div className="space-y-2">
                {previousContent.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 bg-background rounded border border-border dark:border-border"
                  >
                    <div>
                      <h3 className="font-medium text-foreground">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => viewContent({
                        id: item.id,
                        title: item.title,
                        content: item.content,
                        status: item.status,
                        workspace: item.workspace
                      })}
                    >
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                      <Button 
                        variant="outline"
                        className="bg-red-100 dark:bg-red-900/20 border-red-600/20 text-red-600 dark:text-red-400 hover:bg-red-900/30 hover:text-red-400"
                        onClick={() => deleteContent(item.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Modal to display content */}
        {showContentModal && selectedContent && (
          <div className="fixed inset-0 bg-gray-900/50 dark:bg-black/80 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-xl font-semibold">{selectedContent.title}</h3>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowContentModal(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="overflow-auto p-6 flex-1">
                <div className="prose prose-invert max-w-none">
                  {/* Render content as Markdown */}
                  <div dangerouslySetInnerHTML={{ 
                    __html: marked.parse(selectedContent.content) 
                  }} />
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    navigator.clipboard.writeText(selectedContent.content);
                    toast.success('Content copied to clipboard');
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
                <Button 
                  variant="outline"
                  className="bg-red-100 dark:bg-red-900/20 border-red-600/20 text-red-600 dark:text-red-400 hover:bg-red-900/30 hover:text-red-400"
                  onClick={() => {
                    deleteContent(selectedContent.id);
                    setShowContentModal(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
                <Button onClick={() => setShowContentModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Import Modal */}
        {showBulkImportModal && (
          <div className="fixed inset-0 bg-gray-900/50 dark:bg-black/80 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-xl font-semibold">Bulk Import Keywords</h3>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowBulkImportModal(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="p-6 flex-1">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bulk-keywords" className="text-sm font-medium">
                      Keywords
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Enter multiple keywords separated by commas, semicolons, or new lines. Each keyword will become a separate generation task.
                    </p>
                    <Textarea
                      id="bulk-keywords"
                      value={bulkKeywords}
                      onChange={(e) => setBulkKeywords(e.target.value)}
                      placeholder={`Example:
CRM software
customer relationship management
best CRM tools
CRM for small business
sales automation software`}
                      className="bg-background border-border dark:border-border text-foreground min-h-[200px]"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <strong>Preview:</strong> {bulkKeywords.trim() ? 
                      bulkKeywords.split(/[\n,;\t]+/).filter(k => k.trim()).length + ' keywords will be imported' : 
                      'No keywords entered'
                    }
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowBulkImportModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleBulkImport}
                  disabled={!bulkKeywords.trim()}
                  className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600"
                >
                  Import Keywords
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarDemo>
  );
} 