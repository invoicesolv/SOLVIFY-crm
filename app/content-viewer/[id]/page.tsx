'use client';

import { useEffect, useState } from 'react';
import { SidebarDemo } from '@/components/ui/code.demo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card-content';
import { FileText, ArrowLeft, Copy, Pencil, Save, Loader2, Globe, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { marked } from 'marked';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function ContentViewerPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const [content, setContent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [blogCategories, setBlogCategories] = useState<string[]>([
    'general', 'business', 'technology', 'marketing', 'lifestyle', 'health'
  ]);
  const [publishingToBlog, setPublishingToBlog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [blogUrl, setBlogUrl] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState('');

  // Fetch the content by ID
  useEffect(() => {
    async function fetchContent() {
      if (!session?.user?.id) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('generated_content')
          .select('*')
          .eq('id', params.id)
          .single();
          
        if (error) throw error;
        
        if (data) {
          setContent(data);
          setEditedContent(data.content);
          setEditedTitle(data.title);
        } else {
          setError('Content not found');
        }
      } catch (err) {
        console.error('Error fetching content:', err);
        setError('Failed to load content');
      } finally {
        setLoading(false);
      }
    }
    
    if (status === 'authenticated') {
      fetchContent();
    }
  }, [params.id, session?.user?.id, status]);

  // Load blog URL and check if content is published
  useEffect(() => {
    async function loadBlogSettings() {
      if (!content?.workspace_id) return;
      
      try {
        // First check if content was already published to a blog
        if (content.published_to_blog && content.blog_post_url) {
          setIsPublished(true);
          setPublishedUrl(content.blog_post_url);
        }
        
        // Then try to get blog URL from workspace settings
        const { data, error } = await supabase
          .from('workspace_settings')
          .select('blog_url')
          .eq('workspace_id', content.workspace_id)
          .maybeSingle();
        
        if (error) throw error;
        
        if (data?.blog_url) {
          setBlogUrl(data.blog_url);
        }
      } catch (err) {
        console.error('Error loading blog settings:', err);
      }
    }
    
    loadBlogSettings();
  }, [content]);

  // Handle saving edited content
  const handleSave = async () => {
    if (!session?.user?.id || !content) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('generated_content')
        .update({
          title: editedTitle,
          content: editedContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id);
        
      if (error) throw error;
      
      setContent({
        ...content,
        title: editedTitle,
        content: editedContent,
        updated_at: new Date().toISOString()
      });
      
      setIsEditing(false);
      toast.success('Content updated successfully');
    } catch (err) {
      console.error('Error updating content:', err);
      toast.error('Failed to update content');
    } finally {
      setIsSaving(false);
    }
  };

  // Add function to handle blog publishing
  const publishToBlog = async () => {
    if (!content || !blogUrl) return;
    
    setPublishingToBlog(true);
    try {
      const response = await fetch('/api/publish-to-blog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId: content.id,
          workspaceId: content.workspace_id,
          blogUrl: blogUrl,
          category: selectedCategory
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to publish to blog');
      }
      
      setIsPublished(true);
      setPublishedUrl(data.postUrl);
      toast.success('Content published to blog successfully');
      
      // Update local content state to reflect published status
      setContent({
        ...content,
        published_to_blog: true,
        blog_post_url: data.postUrl
      });
    } catch (err) {
      console.error('Error publishing to blog:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to publish to blog');
    } finally {
      setPublishingToBlog(false);
    }
  };

  // Add custom CSS for rendering content with proper styling
  const contentStyle = `
    .content-container {
      color: white;
      font-family: var(--font-sans);
      line-height: 1.6;
    }
    .content-container h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-top: 2rem;
      margin-bottom: 1rem;
      color: white;
    }
    .content-container h2 {
      font-size: 2rem;
      font-weight: 600;
      margin-top: 1.75rem;
      margin-bottom: 0.875rem;
      color: white;
    }
    .content-container h3 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: white;
    }
    .content-container p {
      margin-bottom: 1.25rem;
      color: white;
    }
    .content-container img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 1.5rem 0;
      border-radius: 0.375rem;
    }
    .content-container .image-container {
      margin: 2rem 0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .content-container .image-container img {
      width: 100%;
      max-width: 800px;
      margin: 0;
      aspect-ratio: 16/9;
      object-fit: cover;
      border-radius: 0.375rem;
      display: block;
    }
    .content-container .image-container small {
      margin-top: 0.5rem;
      text-align: center;
      color: #9CA3AF;
      font-size: 0.75rem;
    }
    .content-container p img {
      margin: 0 auto 0.5rem auto;
    }
    .content-container p img + small, 
    .content-container p img + em {
      display: block;
      text-align: center;
      color: #9CA3AF;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
    }
    .content-container ul, .content-container ol {
      margin-bottom: 1.25rem;
      padding-left: 1.5rem;
      color: white;
    }
    .content-container li {
      margin-bottom: 0.5rem;
      color: white;
    }
    .content-container blockquote {
      border-left: 4px solid #4B5563;
      padding-left: 1rem;
      margin-left: 0;
      margin-right: 0;
      font-style: italic;
      color: #D1D5DB;
    }
    .content-container table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1.25rem;
      color: white;
    }
    .content-container th, .content-container td {
      border: 1px solid #4B5563;
      padding: 0.5rem;
      text-align: left;
      color: white;
    }
    .content-container th {
      background-color: #374151;
      color: white;
    }
    .content-container code {
      background-color: #1F2937;
      padding: 0.2rem 0.4rem;
      border-radius: 0.25rem;
      font-family: monospace;
      color: #E5E7EB;
    }
    
    /* Explicit styles for WordPress output */
    .content-container figure.wp-block-image {
      margin: 2rem 0;
      text-align: center;
    }
    
    .content-container figure.wp-block-image img {
      max-width: 100%;
      height: auto;
      margin: 0 auto;
      border-radius: 0.375rem;
    }
    
    .content-container figure.wp-block-image figcaption {
      margin-top: 0.5rem;
      text-align: center;
      color: #9CA3AF;
      font-size: 0.75rem;
    }
  `;
  
  // Function to clean Unsplash URLs in content
  const cleanUnsplashUrls = (content: string): string => {
    if (!content) return '';
    
    // Replace Next.js image optimization URLs with direct Unsplash URLs
    // This prevents the 400 Bad Request errors when Next.js tries to optimize already complex Unsplash URLs
    return content.replace(
      /!\[(.*?)\]\(https:\/\/crm\.solvify\.se\/_next\/image\?url=(https%3A%2F%2Fimages\.unsplash\.com%2F.*?)&.*?\)/g,
      (match, altText, encodedUrl) => {
        try {
          // Decode the URL
          const decodedUrl = decodeURIComponent(encodedUrl);
          return `![${altText}](${decodedUrl})`;
        } catch (e) {
          // If decoding fails, keep the original
          return match;
        }
      }
    );
  };

  // Add a safeContent variable to avoid repeated null checks
  const safeContent = content || {};

  const wordCount = safeContent.content ? safeContent.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length : 0;

  if (loading) {
    return (
      <SidebarDemo>
        <div className="p-6 flex items-center justify-center min-h-screen bg-black text-white">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
        </div>
      </SidebarDemo>
    );
  }

  if (error) {
    return (
      <SidebarDemo>
        <div className="p-6 min-h-screen bg-black text-white">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-red-400 mb-2">Error</h2>
            <p className="text-neutral-400 mb-4">{error}</p>
            <Link href="/content-generator">
              <Button className="bg-neutral-800 hover:bg-neutral-700">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Content Generator
              </Button>
            </Link>
          </div>
        </div>
      </SidebarDemo>
    );
  }

  if (!content) {
    return (
      <SidebarDemo>
        <div className="p-6 min-h-screen bg-black text-white">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-neutral-300 mb-2">Content Not Found</h2>
            <p className="text-neutral-400 mb-4">The requested article could not be found.</p>
            <Link href="/content-generator">
              <Button className="bg-neutral-800 hover:bg-neutral-700">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Content Generator
              </Button>
            </Link>
          </div>
        </div>
      </SidebarDemo>
    );
  }

  return (
    <SidebarDemo>
      <div className="p-6 bg-black text-white min-h-screen">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/content-generator">
            <Button variant="outline" className="border-neutral-700 text-neutral-300">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
          </Link>
          
          <div className="flex gap-2">
            {!isEditing && (
              <Button 
                variant="outline" 
                className="border-neutral-700 text-neutral-300"
                onClick={() => {
                  navigator.clipboard.writeText(content.content);
                  toast.success('Content copied to clipboard');
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> Copy
              </Button>
            )}
            
            {isEditing ? (
                <Button 
                  variant="outline" 
                  className="border-neutral-700 text-neutral-300"
                onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
            ) : (
              <Button 
                variant="outline" 
                className="border-neutral-700 text-neutral-300"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </Button>
            )}
          </div>
        </div>
        
        <Card className="bg-neutral-900 border-neutral-800 mb-4">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5" /> 
              {isEditing ? (
                <input 
                  type="text" 
                  value={editedTitle} 
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-md px-3 py-1 text-white"
                />
              ) : (
                safeContent.title
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-neutral-400 grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
              <div>
                <span className="block text-neutral-500">Date</span>
                <span>{safeContent.created_at ? new Date(safeContent.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div>
                <span className="block text-neutral-500">Language</span>
                <span>{safeContent.language || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-neutral-500">Size</span>
                <span>{safeContent.size || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-neutral-500">Type</span>
                <span>{safeContent.article_type || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-neutral-500">Word Count</span>
                <span>{wordCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-6">
            {isEditing ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-white font-medium">Title</Label>
                <input
                  type="text"
                  id="title"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-md p-3 text-white mt-1"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="content" className="text-white font-medium">Content</Label>
              <Textarea 
                  id="content"
                  className="w-full h-[60vh] bg-neutral-800 border border-neutral-700 text-white font-mono mt-1"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  className="border-neutral-700 text-neutral-300"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" /> Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <style dangerouslySetInnerHTML={{ __html: contentStyle }} />
              <Card className="bg-neutral-900 border-neutral-800 text-white overflow-hidden">
                {safeContent.featured_image_url && (
                  <div className="relative w-full overflow-hidden border-b border-neutral-700">
                    <div className="aspect-video max-h-[500px] w-full overflow-hidden">
                      <img
                        src={safeContent.featured_image_url}
                        alt={safeContent.featured_image_alt || safeContent.title || ''}
                        className="w-full h-full object-cover"
                        loading="eager"
                      />
                    </div>
                    {safeContent.featured_image_attribution && (
                      <div className="absolute bottom-0 right-0 bg-black bg-opacity-75 text-white text-xs p-2">
                        Photo by{' '}
                        <a 
                          href={`${safeContent.featured_image_attribution.author_link}?utm_source=app&utm_medium=referral`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          {safeContent.featured_image_attribution.author_name}
                        </a>{' '}
                        on{' '}
                        <a 
                          href="https://unsplash.com/?utm_source=app&utm_medium=referral"
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          Unsplash
                        </a>
                      </div>
                    )}
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-white">{safeContent.title || 'Untitled'}</CardTitle>
                </CardHeader>
                                  <CardContent>
                   <div 
                     className="content-container text-white prose prose-lg prose-invert max-w-none
                       prose-headings:text-white prose-headings:font-bold
                       prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-6 
                       prose-h2:text-2xl prose-h2:font-bold prose-h2:mb-4 prose-h2:mt-8
                       prose-h3:text-xl prose-h3:font-bold prose-h3:mb-4 prose-h3:mt-6
                       prose-p:text-white prose-p:my-4 prose-p:opacity-90
                       prose-li:text-white prose-li:opacity-90
                       prose-strong:text-white prose-strong:font-bold
                       prose-a:text-blue-400 prose-a:hover:underline"
                     dangerouslySetInnerHTML={{ 
                       __html: marked.parse(cleanUnsplashUrls(safeContent.content || '')) 
                     }} 
                    />
                  </CardContent>
              </Card>
            </>
          )}
        </div>

        <Card className="bg-neutral-900 border-neutral-800 mb-4">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Globe className="h-5 w-5" /> Blog Publishing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isPublished ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Published to blog</span>
                </div>
                
                {publishedUrl && (
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-1 mt-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on blog
                  </a>
                )}
                
                {/* Add debug button only in development */}
                {process.env.NODE_ENV === 'development' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 border-amber-800 text-amber-400"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/debug-generation/trace-blog-issues', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            contentId: content.id,
                            blogUrl: publishedUrl
                          })
                        });
                        
                        const data = await response.json();
                        console.log('Blog publishing debug results:', data);
                        toast.info('Debug results logged to console');
                      } catch (error) {
                        console.error('Error running blog debug:', error);
                        toast.error('Failed to run blog debug');
                      }
                    }}
                  >
                    Debug Blog Publishing
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {!blogUrl ? (
                  <div className="text-amber-500 flex items-center gap-2">
                    <span className="text-sm">
                      No blog connected. Please add your blog URL in workspace settings.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="blog-category" className="text-neutral-300 mb-2 block">
                          Blog Category
                        </Label>
                        <Select
                          value={selectedCategory}
                          onValueChange={setSelectedCategory}
                        >
                          <SelectTrigger className="bg-neutral-800 border-neutral-700 text-neutral-300">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
                            {blogCategories.map(category => (
                              <SelectItem key={category} value={category} className="hover:bg-neutral-700">
                                {category.charAt(0).toUpperCase() + category.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center">
                        <Button
                          onClick={publishToBlog}
                          disabled={publishingToBlog || !blogUrl}
                          className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                        >
                          {publishingToBlog ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Publishing...
                            </>
                          ) : (
                            <>
                              <Globe className="h-4 w-4" />
                              Publish to Blog
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {/* Add debug button */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-amber-800 text-amber-400"
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/debug-generation/trace-blog-issues', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  contentId: content.id,
                                  blogUrl: blogUrl
                                })
                              });
                              
                              const data = await response.json();
                              console.log('Blog publishing debug results:', data);
                              toast.info('Debug results logged to console');
                            } catch (error) {
                              console.error('Error running blog debug:', error);
                              toast.error('Failed to run blog debug');
                            }
                          }}
                        >
                          Debug Blog Connection
                        </Button>
                      </div>
                    )}
                    
                    <p className="text-xs text-neutral-500">
                      Content will be published to {blogUrl} in the {selectedCategory} category.
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Debug buttons for development mode */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-amber-800 text-amber-400"
              onClick={async () => {
                try {
                  const response = await fetch('/api/debug-generation/add-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contentId: content.id,
                      keyword: content.title.split(' ')[0] || 'business'
                    })
                  });
                  
                  const data = await response.json();
                  if (response.ok) {
                    toast.success('Featured image added successfully');
                    // Refresh the page to show the new image
                    window.location.reload();
                  } else {
                    console.error('Error adding featured image:', data);
                    toast.error(data.error || 'Failed to add featured image');
                  }
                } catch (error) {
                  console.error('Exception adding featured image:', error);
                  toast.error('Failed to add featured image');
                }
              }}
            >
              Add Featured Image
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="border-blue-800 text-blue-400"
              onClick={async () => {
                try {
                  const response = await fetch(`/api/debug-generation/test-images?keyword=${encodeURIComponent(content.title)}&workspace_id=${content.workspace_id}`);
                  
                  const data = await response.json();
                  console.log('Image test results:', data);
                  toast.info('Image test results logged to console');
                } catch (error) {
                  console.error('Error testing images:', error);
                  toast.error('Failed to test images');
                }
              }}
            >
              Test Image API
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="border-green-800 text-green-400"
              onClick={async () => {
                try {
                  const response = await fetch('/api/debug-generation/fix-images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contentId: content.id
                    })
                  });
                  
                  const data = await response.json();
                  if (response.ok) {
                    toast.success(`Fixed ${data.details.replacementsCount} image URLs` + 
                      (data.details.featuredImageFixed ? ' and featured image' : ''));
                    // Refresh the page to show the fixed images
                    window.location.reload();
                  } else {
                    console.error('Error fixing images:', data);
                    toast.error(data.error || 'Failed to fix images');
                  }
                } catch (error) {
                  console.error('Exception fixing images:', error);
                  toast.error('Failed to fix images');
                }
              }}
            >
              Fix Image URLs
            </Button>
          </div>
        )}
      </div>
    </SidebarDemo>
  );
} 