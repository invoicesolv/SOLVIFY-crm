import { NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { getRandomImage, trackDownload, UnsplashImage, initializeWithApiKey } from '@/lib/unsplash';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Create Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables');
    return null;
  }
  
  console.log('Supabase client initialized with URL:', supabaseUrl.substring(0, 20) + '...');
  return createClient(supabaseUrl, supabaseKey);
}

// Keywords to use for finding relevant images based on post title/content
const IMAGE_KEYWORDS = ['crm', 'business', 'sales', 'customer', 'management', 'software', 'productivity'];

// Fetch the Unsplash API key from workspace settings
async function getUnsplashApiKey(supabase: any): Promise<string | null> {
  try {
    // Get the first workspace - in a multi-workspace setup, you might want to be more specific
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .limit(1)
      .single();
    
    if (workspaceError || !workspace) {
      console.error('Error getting workspace:', workspaceError);
      return null;
    }
    
    // Get the Unsplash API key from workspace settings
    const { data, error } = await supabase
      .from('workspace_settings')
      .select('unsplash_api_key')
      .eq('workspace_id', workspace.id)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching Unsplash API key:', error);
      return null;
    }
    
    if (data && data.unsplash_api_key) {
      console.log('Found Unsplash API key in workspace settings');
      return data.unsplash_api_key;
    }
    
    console.warn('No Unsplash API key found in workspace settings');
    return null;
  } catch (error) {
    console.error('Error getting Unsplash API key:', error);
    return null;
  }
}

// Add a helper function to properly clean markdown from content
function cleanMarkdownContent(content: string): string {
  if (!content) return '';
  
  // Clean markdown image syntax ![alt](url)
  let cleaned = content.replace(/!\[(.*?)\]\((.*?)\)/g, '');
  
  // Clean markdown links [text](url)
  cleaned = cleaned.replace(/\[(.*?)\]\((.*?)\)/g, '$1');
  
  // Clean markdown headings (# Title)
  cleaned = cleaned.replace(/^#+\s+(.*)$/gm, '$1');
  
  // Clean markdown bold/italic
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');
  
  // Clean HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  
  // Clean extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * GET endpoint to fetch all published blog posts
 * This endpoint is public and doesn't require authentication
 */
export async function GET(req: Request) {
  try {
    console.log('GET /api/blog/posts - Request received');
    
    // Get URL parameters
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    
    console.log('Fetching posts with slug param:', slug || 'none');
    
    // Get Supabase client
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Failed to initialize Supabase client');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    // Get Unsplash API key from workspace settings
    const unsplashApiKey = await getUnsplashApiKey(supabase);
    if (unsplashApiKey) {
      // Initialize Unsplash API with the key from settings
      initializeWithApiKey(unsplashApiKey);
    } else {
      console.warn('No Unsplash API key available - will use fallback images');
    }
    
    // If a slug is provided, get that specific post
    if (slug) {
      // Extract the slug from URL to handle potential formatting issues
      const cleanSlug = slug.split('/').pop();
      console.log('Cleaned slug:', cleanSlug);
      
      // Find the post by matching the end of the URL
      console.log('Fetching single post with slug pattern:', `%/${cleanSlug}`);
      const { data: post, error } = await supabase
        .from('generated_content')
        .select('id, title, content, blog_post_url, created_at, updated_at, featured_image_url, featured_image_alt, featured_image_attribution')
        .eq('published_to_blog', true)
        .filter('blog_post_url', 'ilike', `%/${cleanSlug}`)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching blog post:', error);
        return NextResponse.json({ error: 'Failed to fetch blog post' }, { status: 500 });
      }
      
      if (!post) {
        console.log('No post found with slug:', cleanSlug);
        return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
      }
      
      console.log('Post found:', post.title);
      
      // Format post date for display
      const postDate = new Date(post.created_at || post.updated_at);
      const formattedDate = postDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Extract a formatted excerpt from the content with proper styling
      let excerpt = '';
      if (post.content) {
        // First clean any markdown
        const cleanedContent = cleanMarkdownContent(post.content);
        
        // Check if content has proper headings
        const hasHeadings = /<h[1-3][^>]*>/i.test(post.content);
        
        if (hasHeadings) {
          // Try to extract the first section with heading
          const firstHeadingMatch = post.content.match(/<h[1-3][^>]*>(.+?)<\/h[1-3]>[\s\S]*?<p>(.+?)<\/p>/i);
          if (firstHeadingMatch) {
            excerpt = `<h3 class="text-white font-semibold mb-2">${firstHeadingMatch[1]}</h3><p class="text-gray-300">${firstHeadingMatch[2].substring(0, 120)}...</p>`;
          } else {
            // Fallback to first paragraph
            const firstParagraph = post.content.match(/<p>(.+?)<\/p>/i);
            excerpt = firstParagraph 
              ? `<p class="text-gray-300">${firstParagraph[1].substring(0, 150)}...</p>` 
              : `<p class="text-gray-300">${cleanedContent.substring(0, 150)}...</p>`;
          }
        } else {
          // No headings, just get the beginning text
          excerpt = `<p class="text-gray-300">${cleanedContent.substring(0, 150)}...</p>`;
        }
      }
      
      // Format content with proper structure for list view
      let formattedListContent = post.content;
      
      // Apply the same heading structure enhancement for consistency
      if (formattedListContent) {
        const hasHeadings = /<h[1-3][^>]*>/i.test(formattedListContent);
        
        if (!hasHeadings) {
          formattedListContent = formattedListContent
            .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
            .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
            .replace(/(?:^|\n)([A-Z][A-Za-z\s]+:)(?=\s)/g, '<h3>$1</h3>')
            .replace(/(?:^|\n)([A-Z][A-Z\s]+)(?=\s|\n)/g, '<h2>$1</h2>');
        }
        
        formattedListContent = formattedListContent
          .replace(/(?:^|\n)([^<\n].+)(?=\n|$)/gm, (match, p1) => {
            if (p1.trim().startsWith('<') || p1.trim().startsWith('#')) {
              return match;
            }
            return `<p>${p1}</p>`;
          });
      }
      
      // Calculate read time (rough estimate: 200 words per minute)
      const wordCount = post.content ? post.content.replace(/<[^>]*>/g, '').split(/\s+/).length : 0;
      const readTimeMinutes = Math.max(1, Math.round(wordCount / 200));
      
      // Use the featured image from the generated content if available
      let featuredImage: UnsplashImage | null = null;
      
      if (post.featured_image_url) {
        // Use the existing featured image from the content
        featuredImage = {
          id: 'generated-content',
          url: post.featured_image_url,
          small_url: post.featured_image_url,
          download_url: post.featured_image_url,
          alt_text: post.featured_image_alt || post.title,
          width: 1080,
          height: 720,
          author: {
            name: post.featured_image_attribution?.authorName || 'Unknown',
            username: post.featured_image_attribution?.authorName || 'unknown',
            link: post.featured_image_attribution?.authorLink || '#'
          }
        };
      } else {
        // Fallback: Get a keyword from the title and fetch from Unsplash
        const titleWords = post.title.toLowerCase().split(/\s+/);
        const keyword = titleWords.find(word => 
          word.length > 3 && IMAGE_KEYWORDS.includes(word)
        ) || 'business';
        
        try {
          // Pass the API key directly to ensure it's used for this request
          featuredImage = await getRandomImage(keyword, unsplashApiKey || undefined);
          
          if (featuredImage && featuredImage.id !== 'local-fallback') {
            // Track the download as required by Unsplash API terms
            // (only for actual Unsplash images, not our local fallbacks)
            await trackDownload(featuredImage.id);
          }
        } catch (imageError) {
          console.error('Error fetching image for post:', imageError);
          // Continue without image if there's an error
        }
      }
      
      // Format content with proper headings and structure for API response
      let formattedContent = post.content;
      
      // Ensure heading hierarchy is maintained when returning HTML content
      if (formattedContent) {
        // Check if the content already has proper heading structure (h1, h2, h3)
        const hasHeadings = /<h[1-3][^>]*>/i.test(formattedContent);
        
        if (!hasHeadings) {
          // Try to identify heading patterns like "## Heading" and convert to HTML
          formattedContent = formattedContent
            // Convert markdown-style headings to HTML
            .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
            .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
            // Convert sections labeled with heading patterns
            .replace(/(?:^|\n)([A-Z][A-Za-z\s]+:)(?=\s)/g, '<h3>$1</h3>')
            // Convert all-caps sections to headings
            .replace(/(?:^|\n)([A-Z][A-Z\s]+)(?=\s|\n)/g, '<h2>$1</h2>');
        }
        
        // Ensure paragraphs are properly wrapped
        formattedContent = formattedContent
          .replace(/(?:^|\n)([^<\n].+)(?=\n|$)/gm, (match, p1) => {
            // Skip if it's already in an HTML tag or is a markdown heading
            if (p1.trim().startsWith('<') || p1.trim().startsWith('#')) {
              return match;
            }
            return `<p>${p1}</p>`;
          });
      }
      
      // Format content with proper structure for the post
      let postFormattedContent = post.content;
      
      // Apply the same heading structure enhancement for consistency
      if (postFormattedContent) {
        const hasHeadings = /<h[1-3][^>]*>/i.test(postFormattedContent);
        
        if (!hasHeadings) {
          postFormattedContent = postFormattedContent
            .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
            .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
            .replace(/(?:^|\n)([A-Z][A-Za-z\s]+:)(?=\s)/g, '<h3>$1</h3>')
            .replace(/(?:^|\n)([A-Z][A-Z\s]+)(?=\s|\n)/g, '<h2>$1</h2>');
        }
        
        postFormattedContent = postFormattedContent
          .replace(/(?:^|\n)([^<\n].+)(?=\n|$)/gm, (match, p1) => {
            if (p1.trim().startsWith('<') || p1.trim().startsWith('#')) {
              return match;
            }
            return `<p>${p1}</p>`;
          });
      }
      
      // Enhance the blog post content with Unsplash attribution if we have an image
      let enhancedContent = postFormattedContent;
      if (featuredImage && featuredImage.id !== 'local-fallback') {
        // Add Unsplash attribution at the end of the content (only for Unsplash images)
        const attributionHtml = `
          <div class="unsplash-attribution mt-6 text-sm text-gray-400">
            <p>Featured image by <a href="${featuredImage.author.link}?utm_source=solvify_crm&utm_medium=referral" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${featuredImage.author.name}</a> on <a href="https://unsplash.com/?utm_source=solvify_crm&utm_medium=referral" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">Unsplash</a></p>
          </div>
        `;
        enhancedContent = `${postFormattedContent}${attributionHtml}`;
      }
      
      return NextResponse.json({
        post: {
          ...post,
          content: enhancedContent,
          date: formattedDate,
          readTime: `${readTimeMinutes} min read`,
          excerpt,
          slug: cleanSlug,
          image: featuredImage?.url || "/blog/sales-performance.jpg",
          alt_text: featuredImage?.alt_text || post.title,
          author: {
            name: "Solvify Team",
            avatar: "/blog/authors/alex-johnson.jpg",
            bio: "Solvify CRM Team"
          }
        }
      });
    }
    
    // Otherwise, get all published posts
    console.log('Fetching all published blog posts');
    const { data: posts, error } = await supabase
      .from('generated_content')
      .select('id, title, content, blog_post_url, is_featured, created_at, updated_at, featured_image_url, featured_image_alt, featured_image_attribution')
      .eq('published_to_blog', true)
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching blog posts:', error);
      return NextResponse.json({ error: 'Failed to fetch blog posts', details: error }, { status: 500 });
    }
    
    console.log('Found posts:', posts?.length || 0);
    
    // If no posts were found
    if (!posts || posts.length === 0) {
      console.log('No blog posts found');
      return NextResponse.json({ 
        posts: [],
        featuredPost: null,
        message: 'No blog posts found'
      });
    }
    
    // Format posts for display
    console.log('Formatting posts for display');
    const formattedPostsPromises = posts.map(async post => {
      // Extract the slug from the URL
      const urlParts = post.blog_post_url?.split('/') || [];
      const slug = urlParts[urlParts.length - 1] || '';
      
      // Format date
      const postDate = new Date(post.created_at || post.updated_at);
      const formattedDate = postDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Extract a formatted excerpt from the content with proper styling
      let excerpt = '';
      if (post.content) {
        // First clean any markdown
        const cleanedContent = cleanMarkdownContent(post.content);
        
        // Check if content has proper headings
        const hasHeadings = /<h[1-3][^>]*>/i.test(post.content);
        
        if (hasHeadings) {
          // Try to extract the first section with heading
          const firstHeadingMatch = post.content.match(/<h[1-3][^>]*>(.+?)<\/h[1-3]>[\s\S]*?<p>(.+?)<\/p>/i);
          if (firstHeadingMatch) {
            excerpt = `<h3 class="text-white font-semibold mb-2">${firstHeadingMatch[1]}</h3><p class="text-gray-300">${firstHeadingMatch[2].substring(0, 120)}...</p>`;
          } else {
            // Fallback to first paragraph
            const firstParagraph = post.content.match(/<p>(.+?)<\/p>/i);
            excerpt = firstParagraph 
              ? `<p class="text-gray-300">${firstParagraph[1].substring(0, 150)}...</p>` 
              : `<p class="text-gray-300">${cleanedContent.substring(0, 150)}...</p>`;
          }
        } else {
          // No headings, just get the beginning text
          excerpt = `<p class="text-gray-300">${cleanedContent.substring(0, 150)}...</p>`;
        }
      }
      
      // Format content with proper structure for list view
      let formattedListContent = post.content;
      
      // Apply the same heading structure enhancement for consistency
      if (formattedListContent) {
        const hasHeadings = /<h[1-3][^>]*>/i.test(formattedListContent);
        
        if (!hasHeadings) {
          formattedListContent = formattedListContent
            .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
            .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
            .replace(/(?:^|\n)([A-Z][A-Za-z\s]+:)(?=\s)/g, '<h3>$1</h3>')
            .replace(/(?:^|\n)([A-Z][A-Z\s]+)(?=\s|\n)/g, '<h2>$1</h2>');
        }
        
        formattedListContent = formattedListContent
          .replace(/(?:^|\n)([^<\n].+)(?=\n|$)/gm, (match, p1) => {
            if (p1.trim().startsWith('<') || p1.trim().startsWith('#')) {
              return match;
            }
            return `<p>${p1}</p>`;
          });
      }
      
      // Calculate read time (rough estimate: 200 words per minute)
      const wordCount = post.content ? post.content.replace(/<[^>]*>/g, '').split(/\s+/).length : 0;
      const readTimeMinutes = Math.max(1, Math.round(wordCount / 200));
      
      // Use the featured image from the generated content if available
      let featuredImage: UnsplashImage | null = null;
      
      if (post.featured_image_url) {
        // Use the existing featured image from the content
        featuredImage = {
          id: 'generated-content',
          url: post.featured_image_url,
          small_url: post.featured_image_url,
          download_url: post.featured_image_url,
          alt_text: post.featured_image_alt || post.title,
          width: 1080,
          height: 720,
          author: {
            name: post.featured_image_attribution?.authorName || 'Unknown',
            username: post.featured_image_attribution?.authorName || 'unknown',
            link: post.featured_image_attribution?.authorLink || '#'
          }
        };
      } else {
        // Fallback: Get a keyword from the title and fetch from Unsplash
        const titleWords = post.title.toLowerCase().split(/\s+/);
        const keyword = titleWords.find(word => 
          word.length > 3 && IMAGE_KEYWORDS.includes(word)
        ) || 'business';
        
        try {
          // Pass the API key directly to ensure it's used for this request
          featuredImage = await getRandomImage(keyword, unsplashApiKey || undefined);
          // Note: We're not tracking downloads here to avoid hitting Unsplash rate limits
          // The actual download/usage will be tracked when viewing the individual post
        } catch (imageError) {
          console.error('Error fetching image for post list:', imageError);
          // Continue without image if there's an error
        }
      }
      
      return {
        id: post.id,
        title: post.title,
        excerpt,
        category: 'CRM',  // Default category
        slug,
        date: formattedDate,
        readTime: `${readTimeMinutes} min read`,
        is_featured: post.is_featured || false,
        blog_post_url: post.blog_post_url,
        // Image from Unsplash or fallback
        image: featuredImage?.url || "/blog/sales-performance.jpg",
        alt_text: featuredImage?.alt_text || post.title,
        author: {
          name: "Solvify Team",
          avatar: "/blog/authors/alex-johnson.jpg"
        }
      };
    });
    
    // Wait for all posts to be processed with their images
    const formattedPosts = await Promise.all(formattedPostsPromises);
    
    console.log('API response ready with', formattedPosts.length, 'posts');
    
    return NextResponse.json({
      posts: formattedPosts,
      featuredPost: formattedPosts.find(post => post.is_featured) || formattedPosts[0]
    });
    
  } catch (error) {
    console.error('Error handling blog posts request:', error);
    return NextResponse.json({ 
      error: `An error occurred: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
} 