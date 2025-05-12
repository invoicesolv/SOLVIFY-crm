"use client";

import { useParams } from "next/navigation";
import { NavBarDemo } from "@/components/ui/navbar-demo";
import { Footer } from "@/components/ui/landing-sections";
import { BlogSignupSection } from "@/components/ui/blog-signup-section";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { marked } from 'marked';

interface BlogPost {
  id: string;
  title: string;
  content: string;
  date: string;
  readTime: string;
  excerpt: string;
  slug: string;
  blog_post_url?: string;
  image: string;
  alt_text?: string;
  author: {
    name: string;
    avatar: string;
    bio: string;
  };
  relatedPosts: Array<{
    title: string;
    slug: string;
    image: string;
    alt_text?: string;
  }>;
}

// Clean Unsplash/optimized image URLs before rendering
function cleanUnsplashUrls(content: string): string {
  if (!content) return '';
  return content.replace(
    /!\[(.*?)\]\(https:\/\/crm\.solvify\.se\/_next\/image\?url=(https%3A%2F%2Fimages\.unsplash\.com%2F.*?)&.*?\)/g,
    (match, altText, encodedUrl) => {
      try {
        const decodedUrl = decodeURIComponent(encodedUrl);
        return `![${altText}](${decodedUrl})`;
      } catch (e) {
        return match;
      }
    }
  );
}

// Convert all markdown images to HTML img tags before marked parsing
function preProcessImages(content: string): string {
  if (!content) return '';
  
  // Convert all markdown image syntax to HTML img tags
  return content.replace(
    /!\[(.*?)\]\((.*?)\)/g, 
    '<img src="$2" alt="$1" class="my-8 rounded-lg shadow-lg w-full max-w-2xl mx-auto object-cover" loading="lazy" />'
  );
}

// Enhance markdown content formatting for FAQ and lists
function enhanceFormatting(content: string): string {
  if (!content) return '';
  
  // Process content in steps
  let processedContent = content;
  
  // Fix bullet points formatting (both - and * types)
  processedContent = processedContent.replace(
    /^[\s]*[-*][\s]+(.*?)$/gm, 
    '<li class="text-white my-2">$1</li>'
  );
  
  // Wrap adjacent list items in <ul> tags
  processedContent = processedContent.replace(
    /(<li class="text-white my-2">.*?<\/li>(\s*\n\s*)?)+/g,
    '<ul class="list-disc pl-6 my-4">$&</ul>'
  );
  
  // Enhance FAQ formatting with proper styling
  processedContent = processedContent.replace(
    /Q:[\s]+(.*?)$/gm,
    '<div class="mt-6"><strong class="text-white text-lg">Q: $1</strong></div>'
  );
  
  processedContent = processedContent.replace(
    /A:[\s]+(.*?)$/gm,
    '<div class="ml-4 mb-4"><span class="text-white">A: $1</span></div>'
  );
  
  return processedContent;
}

// Custom image renderer for marked v5+ using correct extension structure
const imageExtension = {
  renderers: {
    image(token: any) {
      return `<img src="${token.href}" alt="${token.text}" class="my-8 rounded-lg shadow-lg w-full max-w-2xl mx-auto object-cover" loading="lazy" />`;
    }
  },
  childTokens: {
    image: []
  }
};

// Add custom CSS for proper rendering of content including lists, FAQ, tables and other elements
const contentStyle = `
  .blog-content {
    color: white;
    font-family: var(--font-sans);
    line-height: 1.6;
  }
  .blog-content h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-top: 2rem;
    margin-bottom: 1rem;
    color: white;
  }
  .blog-content h2 {
    font-size: 2rem;
    font-weight: 600;
    margin-top: 1.75rem;
    margin-bottom: 0.875rem;
    color: white;
  }
  .blog-content h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    color: white;
  }
  .blog-content p {
    margin-bottom: 1.25rem;
    color: white;
  }
  .blog-content img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 1.5rem auto;
    border-radius: 0.375rem;
  }
  .blog-content ul, .blog-content ol {
    margin-bottom: 1.25rem;
    padding-left: 1.5rem;
    list-style-type: disc;
    color: white;
  }
  .blog-content li {
    margin-bottom: 0.5rem;
    color: white;
  }
  .blog-content blockquote {
    border-left: 4px solid #4B5563;
    padding-left: 1rem;
    margin-left: 0;
    margin-right: 0;
    font-style: italic;
    color: #D1D5DB;
  }
  .blog-content table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.25rem;
    color: white;
  }
  .blog-content th, .blog-content td {
    border: 1px solid #4B5563;
    padding: 0.5rem;
    text-align: left;
    color: white;
  }
  .blog-content th {
    background-color: #374151;
    color: white;
  }
  .blog-content code {
    background-color: #1F2937;
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    font-family: monospace;
    color: #E5E7EB;
  }
  
  /* FAQ styling */
  .blog-content strong {
    color: white;
    font-weight: bold;
  }
  
  /* Explicit styling for lists */
  .blog-content ul {
    list-style-type: disc;
    margin-left: 1rem;
    margin-bottom: 1.5rem;
  }
  .blog-content ol {
    list-style-type: decimal;
    margin-left: 1rem;
    margin-bottom: 1.5rem;
  }
  
  /* Fix for Q and A formatting */
  .blog-content p:has(strong:first-child:contains("Q:")) {
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
  }
  
  .blog-content p:has(strong:first-child:contains("A:")) {
    margin-left: 1rem;
    margin-bottom: 1.5rem;
  }
`;

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBlogPost() {
      if (!slug) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Fetch the specific blog post by slug
        const response = await fetch(`/api/blog/posts?slug=${slug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Blog post not found');
          }
          throw new Error(`Failed to fetch blog post: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.post) {
          // Set default values for missing fields
          const formattedPost: BlogPost = {
            ...data.post,
            image: data.post.image || "/blog/sales-performance.jpg",
            alt_text: data.post.alt_text || data.post.title,
            author: data.post.author || {
              name: "Solvify Team",
      avatar: "/blog/authors/alex-johnson.jpg",
              bio: "Solvify CRM Team"
    },
            // Placeholder related posts with proper alt text
            relatedPosts: data.post.relatedPosts || [
      {
        title: "The Ultimate Guide to Customer Data Management",
        slug: "ultimate-guide-customer-data-management",
                image: "/blog/data-management.jpg",
                alt_text: "Customer data management visualization"
      },
      {
        title: "Automating Your Workflow with Solvify CRM",
        slug: "automating-workflow-solvify-crm",
                image: "/blog/automation.jpg",
                alt_text: "Workflow automation illustration"
      }
    ]
  };
          
          setPost(formattedPost);
        } else {
          throw new Error('Blog post data is missing');
        }
      } catch (err) {
        console.error('Error fetching blog post:', err);
        setError(err instanceof Error ? err.message : 'Failed to load blog post');
      } finally {
        setLoading(false);
      }
    }
    
    fetchBlogPost();
  }, [slug]);

  if (loading) {
    return (
      <main className="bg-neutral-950 min-h-screen text-white">
        <NavBarDemo lang="en" />
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="animate-pulse text-white text-lg">Loading post...</div>
        </div>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="bg-neutral-950 min-h-screen text-white">
        <NavBarDemo lang="en" />
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="text-red-400 text-lg font-semibold">{error || 'Blog post not found'}</div>
          <Link href="/blog" className="text-blue-400 hover:underline mt-4 inline-block font-medium">
            Return to blog
          </Link>
        </div>
      </main>
    );
  }
  
  const htmlContent = marked.parse(preProcessImages(cleanUnsplashUrls(post.content || '')));

  return (
    <main className="bg-neutral-950 min-h-screen text-white">
      <NavBarDemo lang="en" />
      
      <article className="pt-12 pb-24 text-white">
        {/* Header */}
        <header className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl mb-12">
          <div className="text-sm text-blue-400 mb-2">
            <Link href="/blog" className="hover:underline">
              Blog
            </Link>
            {" / "}
            <span>CRM</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            {post.title}
          </h1>
          
          <div className="flex items-center mb-8">
            <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
              <Image 
                src={post.author.avatar} 
                alt={post.author.name} 
                width={40} 
                height={40} 
              />
            </div>
            <div>
              <div className="text-white font-medium">{post.author.name}</div>
              <div className="text-sm text-gray-400">{post.date} · {post.readTime}</div>
            </div>
          </div>
          
          <div className="relative w-full h-[400px] rounded-xl overflow-hidden mb-12">
            <Image
              src={post.image}
              alt={post.alt_text || post.title}
              fill
              style={{ objectFit: "cover" }}
              priority
            />
          </div>
        </header>
        
        {/* Content */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <style dangerouslySetInnerHTML={{ __html: contentStyle }} />
          <div 
            className="prose prose-lg prose-invert max-w-none text-white blog-content
              prose-headings:text-white prose-headings:font-bold
              prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-6 
              prose-h2:text-2xl prose-h2:font-bold prose-h2:mb-4 prose-h2:mt-8
              prose-h3:text-xl prose-h3:font-bold prose-h3:mb-4 prose-h3:mt-6
              prose-p:text-white prose-p:my-4 prose-p:opacity-90
              prose-li:text-white prose-li:opacity-90
              prose-strong:text-white prose-strong:font-bold
              prose-a:text-blue-400 prose-a:hover:underline
              first-letter:text-4xl first-letter:font-bold first-letter:text-blue-400"
            dangerouslySetInnerHTML={{ __html: htmlContent }} 
          />
          
          {/* Author bio */}
          <div className="mt-16 p-6 bg-neutral-900 rounded-xl">
            <div className="flex items-center">
              <div className="w-16 h-16 rounded-full overflow-hidden mr-4">
                <Image 
                  src={post.author.avatar} 
                  alt={post.author.name} 
                  width={64} 
                  height={64} 
                />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{post.author.name}</div>
                <div className="text-gray-400">{post.author.bio}</div>
              </div>
            </div>
          </div>
        </div>
      </article>
      
      {/* Related posts */}
      <section className="bg-neutral-950 py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-8">Related Articles</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {post.relatedPosts.map((relatedPost, index) => (
              <Link href={`/blog/${relatedPost.slug}`} key={index} className="group">
                <div className="rounded-xl overflow-hidden bg-neutral-900 h-full">
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={relatedPost.image}
                      alt={relatedPost.alt_text || relatedPost.title}
                      fill
                      style={{ objectFit: "cover" }}
                      className="group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                      {relatedPost.title}
                    </h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      
      <BlogSignupSection
        title="Get the latest CRM insights straight to your inbox"
        subtitle="Join our newsletter for exclusive tips and strategies to help your business grow"
        buttonText="Subscribe"
      />
      
      <Footer />
    </main>
  );
} 