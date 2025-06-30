'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SidebarDemo } from '@/components/ui/code.demo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-client';
import { supabaseClient as supabase } from '@/lib/supabase-client';
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
import Link from 'next/link';

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
  workspace_id: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

// Add a new interface for blog publishing
interface BlogPublishing {
  publishToBlog: boolean;
  blogUrl: string;
  blogCategory: string;
}

export default function ContentGeneratorPage() {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<string>('');
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [generationTasks, setGenerationTasks] = useState<GenerationTask[]>([
    { mainKeyword: '', title: '', keywords: '', outline: '' }
  ]);
  
  // Add state for generated content
  const [generatedContent, setGeneratedContent] = useState<GeneratedItem[]>([]);
  const [previousContent, setPreviousContent] = useState<GeneratedItem[]>([]);
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

  // Add state for bulk import modal
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkKeywords, setBulkKeywords] = useState('');

  const loadWorkspaces = useCallback(async () => {
    if (!user) return;
      setLoadingWorkspaces(true);
    try {
      const { data: workspacesData, error: workspacesError } = await supabase
        .from('workspaces')
        .select('id, name');
      
      if (workspacesError) throw workspacesError;

      if (workspacesData) {
        setWorkspaces(workspacesData);
        // Try to get active workspace from the helper
        const activeId = await getActiveWorkspaceId(user.id);
        if (activeId && workspacesData.some(w => w.id === activeId)) {
          setActiveWorkspace(activeId);
        } else if (workspacesData.length > 0) {
          setActiveWorkspace(workspacesData[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
      toast.error('Failed to load workspaces.');
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [user]);

  const loadPreviousContent = useCallback(async () => {
    if (!user || !activeWorkspace) return;

    setLoadingPrevious(true);
    try {
      const { data, error } = await supabase
        .from('generated_content')
        .select('*')
        .eq('workspace_id', activeWorkspace)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      if(data) {
        setPreviousContent(data);
      }
    } catch (error) {
      console.error('Error loading previous content:', error);
      toast.error('Failed to load previous content');
    } finally {
      setLoadingPrevious(false);
    }
  }, [user, activeWorkspace]);

  const loadExternalApiSettings = useCallback(async () => {
    if (!user || !activeWorkspace) return;
    try {
      const { data, error } = await supabase
        .from('workspace_settings')
        .select('blog_url')
        .eq('workspace_id', activeWorkspace)
        .maybeSingle();

      if (error) {
        console.warn('Could not fetch blog settings:', error.message);
        return;
      }

      if (data?.blog_url) {
        setBlogPublishing(prev => ({ ...prev, blogUrl: data.blog_url }));
      }
    } catch (error) {
      console.warn('An error occurred loading blog settings:', error);
    }
  }, [user, activeWorkspace]);

  useEffect(() => {
    if (user) {
      loadWorkspaces();
    }
  }, [user, loadWorkspaces]);

  useEffect(() => {
    if (user && activeWorkspace) {
      loadPreviousContent();
      loadExternalApiSettings();
    }
  }, [user, activeWorkspace, loadPreviousContent, loadExternalApiSettings]);
  
  const handleWorkspaceChange = (workspaceId: string) => {
    if (!user) return;
    setActiveWorkspace(workspaceId);
    supabase
      .from('profiles')
      .update({ active_workspace: workspaceId })
      .eq('id', user.id)
      .then(({ error }) => {
        if (error) {
          toast.error('Failed to set active workspace.');
        }
      });
  };

  const addGenerationTask = () => {
    setGenerationTasks([...generationTasks, { mainKeyword: '', title: '', keywords: '', outline: '' }]);
  };

  const removeGenerationTask = (index: number) => {
    const newTasks = [...generationTasks];
    newTasks.splice(index, 1);
    setGenerationTasks(newTasks);
  };

  const updateGenerationTask = (index: number, field: keyof GenerationTask, value: string) => {
    const newTasks = [...generationTasks];
    newTasks[index][field] = value;
    setGenerationTasks(newTasks);
  };

  const handleGenerate = async () => {
    if (!user || !session?.access_token) {
      toast.error('You must be logged in to generate content.');
      return;
    }

    if (!activeWorkspace) {
      toast.error('Please select a workspace first.');
      return;
    }

    const payload = {
      tasks: generationTasks,
      settings: {
        core: coreSettings,
        content: contentSettings,
        ai: aiSettings,
        details: detailsToInclude,
        media: mediaHub,
        structure: structure,
        linking: linking,
        syndication: syndication,
        document: documentSettings,
        publishing: publishing,
        blog: blogPublishing,
      },
      workspaceId: activeWorkspace,
    };
    
    setLoading(true);
    setGeneratedContent([]); // Clear previous results for this session

    try {
      const response = await fetch('/api/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start content generation');
      }
      
      const { batchId } = await response.json();
      setCurrentBatchId(batchId);
      toast.success('Content generation started!');

    } catch (error) {
      console.error('Error generating content:', error);
      toast.error(error instanceof Error ? error.message : 'An unknown error occurred.');
    } finally {
        // Loading state will be handled by the GenerationProgress component
    }
  };
  
  const viewContent = (content: GeneratedItem) => {
    setSelectedContent(content);
    setShowContentModal(true);
  };

  const deleteContent = async (contentId: string) => {
    if (!user) return;

    if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
        return;
      }

      try {
      const { error } = await supabase
        .from('generated_content')
        .delete()
        .eq('id', contentId);
      
      if (error) throw error;
      setPreviousContent(previousContent.filter(c => c.id !== contentId));
      toast.success('Content deleted successfully.');
      } catch (error) {
      toast.error('Failed to delete content.');
    }
  };

  const saveEditedContent = async (contentId: string, title: string, content: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('generated_content')
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq('id', contentId);
        
        if (error) throw error;
        
      toast.success('Content saved!');
      // Optimistically update the local state
      setPreviousContent(prev => prev.map(c => 
        c.id === contentId ? { ...c, title, content, updated_at: new Date().toISOString() } : c
      ));
      if (selectedContent?.id === contentId) {
        setSelectedContent(prev => prev ? { ...prev, title, content } : null);
        }
      } catch (error) {
      toast.error('Failed to save content.');
    }
  };
  
  const publishToBlog = async (contentId: string, title: string, content: string) => {
    if (!blogPublishing.blogUrl) {
      toast.error('Blog URL is not configured.');
      return;
    }
    if (!user || !session?.access_token) {
      toast.error('You must be logged in to publish.');
      return;
    }
    
    const toastId = toast.loading('Publishing to blog...');
    try {
      const response = await fetch('/api/publish-to-blog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          contentId,
          title,
          content,
          workspaceId: activeWorkspace,
          blogUrl: blogPublishing.blogUrl,
          category: blogPublishing.blogCategory
        }),
      });
      
      if (response.ok) {
        const { postUrl } = await response.json();
        toast.success('Content published to blog successfully!');
        
        // Update local state to reflect published status
        const updateData = { published_to_blog: true, blog_post_url: postUrl };
        const { error } = await supabase.from('generated_content').update(updateData).eq('id', contentId);
        if (error) throw error;

        setPreviousContent(prev => prev.map(c => c.id === contentId ? {...c, ...updateData} : c));
        
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to publish content to blog.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred while publishing to blog.');
    } finally {
      toast.dismiss(toastId);
    }
  };

  if (loadingWorkspaces) {
    return (
      <SidebarDemo>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SidebarDemo>
    );
  }

  return (
    <SidebarDemo>
      <div className="container mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-2">Content Generator</h1>
        <p className="text-muted-foreground mb-6">Create high-quality articles and social media posts with AI.</p>
        
        <Card>
            <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Select the workspace for this content generation batch.</CardDescription>
              </CardHeader>
              <CardContent>
            <Select onValueChange={handleWorkspaceChange} value={activeWorkspace}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a workspace" />
                    </SelectTrigger>
              <SelectContent>
                {workspaces.map(ws => (
                  <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                ))}
                    </SelectContent>
                  </Select>
              </CardContent>
            </Card>

        {/* Generation Tasks */}
        <div className="space-y-4 mt-6">
            {generationTasks.map((task, index) => (
                <Card key={index}>
              <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Article {index + 1}</CardTitle>
                            {generationTasks.length > 1 && (
                                <Button variant="ghost" size="icon" onClick={() => removeGenerationTask(index)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                  </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                            <Label htmlFor={`main-keyword-${index}`}>Main Keyword</Label>
                            <Input id={`main-keyword-${index}`} value={task.mainKeyword} onChange={e => updateGenerationTask(index, 'mainKeyword', e.target.value)} />
                    </div>
                <div>
                            <Label htmlFor={`title-${index}`}>Title (optional)</Label>
                            <Input id={`title-${index}`} value={task.title} onChange={e => updateGenerationTask(index, 'title', e.target.value)} />
                </div>
              </CardContent>
            </Card>
            ))}
            <Button variant="outline" onClick={addGenerationTask}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add another article
            </Button>
          </div>

        {/* Generation Progress */}
        {activeWorkspace && user && (
            <div className="mt-6">
              <GenerationProgress 
                workspaceId={activeWorkspace} 
                    userId={user.id}
                batchId={currentBatchId || undefined}
                    onComplete={() => {
                        toast.success("All content has been generated!");
                        setCurrentBatchId(null);
                        loadPreviousContent(); // Refresh the list
                    }}
                />
            </div>
        )}
        
        <div className="mt-6">
            <Button onClick={handleGenerate} disabled={loading || !activeWorkspace}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate Content
                  </Button>
        </div>

        {/* Previously Generated Content */}
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>History</CardTitle>
                <CardDescription>View and manage previously generated content for this workspace.</CardDescription>
            </CardHeader>
            <CardContent>
            {loadingPrevious ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : previousContent.length === 0 ? (
                    <p className="text-muted-foreground text-center">No content has been generated in this workspace yet.</p>
            ) : (
              <div className="space-y-2">
                        {previousContent.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                <span className="font-medium">{item.title}</span>
                                <div className="flex items-center space-x-2">
                                    <Button variant="ghost" size="icon" onClick={() => viewContent(item)}>
                                        <Eye className="h-4 w-4" />
                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => deleteContent(item.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </CardContent>
        </Card>
        
        {/* Content Viewer Modal */}
        {showContentModal && selectedContent && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <Card className="w-full max-w-4xl h-[90vh] flex flex-col">
                    <CardHeader className="flex flex-row justify-between items-center">
                        <CardTitle>{selectedContent.title}</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => setShowContentModal(false)}>
                  <X className="h-5 w-5" />
                </Button>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: marked(selectedContent.content || '') }} />
                    </CardContent>
                </Card>
          </div>
        )}

      </div>
    </SidebarDemo>
  );
} 