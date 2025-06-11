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

// Convert all markdown content to properly formatted HTML
function preProcessContent(content: string): string {
  if (!content) return '';
  
  let processedContent = content;
  
  // First, convert all **text** to bold HTML tags BEFORE any other processing
  processedContent = processedContent.replace(
    /\*\*(.*?)\*\*/g,
    '<strong>$1</strong>'
  );
  
  // Handle the Benefits section pattern: "- **Title:**" which may still have literal asterisks
  processedContent = processedContent.replace(
    /Benefits of Using CRM Software\s*\n([\s\S]*?)(?=\n\s*\n|$)/g,
    (match, benefitsContent) => {
      // Convert benefit items with proper formatting - specifically handle any remaining asterisks
      const formattedBenefits = benefitsContent.replace(
        /^\s*-\s+(?:\*\*)?(.*?)(?::\*\*)?(?:\s+|\:)(.*?)$/gm,
        '<li><strong>$1:</strong> $2</li>'
      );
      
      return `<h2 class="text-2xl font-bold text-foreground mt-8 mb-4">Benefits of Using CRM Software</h2>
      <ul class="blog-list benefit-list">
        ${formattedBenefits}
      </ul>`;
    }
  );
  
  // Add specific handling for remaining asterisks around text in any context without lookbehind
  processedContent = processedContent.replace(
    /(\s|^)\*\*(.*?)\*\*(\s|$|\.|\,)/g,
    '$1<strong>$2</strong>$3'
  );
  
  // Direct replacement for Key Takeaways section with proper HTML list structure - without 's' flag
  processedContent = processedContent.replace(
    /Key Takeaways\s*\n+\s*-\s*(.*?)\s*\n\s*-\s*(.*?)\s*\n\s*-\s*(.*?)(\n|$)/g,
    `<h2 class="text-2xl font-bold text-foreground mt-8 mb-4">Key Takeaways</h2>
    <ul class="blog-list">
      <li>$1</li>
      <li>$2</li>
      <li>$3</li>
    </ul>`
  );
  
  // More flexible Key Takeaways patterns (any number of items)
  processedContent = processedContent.replace(
    /Key Takeaways\s*\n([\s\S]*?)(?=\n\s*\n|$)/g,
    (match, takeawaysContent) => {
      // Process each line that starts with a hyphen in the Key Takeaways section
      const processedItems = takeawaysContent
        .split('\n')
        .map(line => {
          if (line.trim().startsWith('-')) {
            return `<li>${line.trim().substring(1).trim()}</li>`;
          }
          return line;
        })
        .join('\n');
      
      return `<h2 class="text-2xl font-bold text-foreground mt-8 mb-4">Key Takeaways</h2>
      <ul class="key-takeaways-list">
        ${processedItems}
      </ul>`;
    }
  );
  
  // Handle FAQ sections with direct replacement for common format - without 's' flag
  processedContent = processedContent.replace(
    /FAQ\s*\n+\s*\*\*Q:\s*(.*?)\*\*\s*\n+A:\s*(.*?)\s*\n+\s*\*\*Q:\s*(.*?)\*\*\s*\n+A:\s*(.*?)(\n|$)/g,
    `<h2 class="text-2xl font-bold text-foreground mt-8 mb-4">FAQ</h2>
    <div class="faq-question"><strong>Q: $1</strong></div>
    <div class="faq-answer">A: $2</div>
    <div class="faq-question"><strong>Q: $3</strong></div>
    <div class="faq-answer">A: $4</div>`
  );
  
  // Handle individual FAQ Q&A pairs
  processedContent = processedContent.replace(
    /\*\*Q:\s+(.*?)\*\*/g,
    '<div class="faq-question"><strong>Q: $1</strong></div>'
  );
  
  processedContent = processedContent.replace(
    /A:\s+(.*?)(?=\n\n|\n\*\*Q:|\n*$)/g,
    '<div class="faq-answer">A: $1</div>'
  );
  
  // Convert all regular dash/hyphen bullet points to HTML list items
  processedContent = processedContent.replace(
    /^[\s]*[-][\s]+(.*?)$/gm,
    '<li>$1</li>'
  );
  
  // Convert asterisk bullet points to HTML list items
  processedContent = processedContent.replace(
    /^[\s]*[*][\s]+(.*?)$/gm,
    '<li>$1</li>'
  );
  
  // Group adjacent <li> elements into <ul> blocks
  processedContent = processedContent.replace(
    /(<li>.*?<\/li>(\s*\n\s*)?)+/g,
    '<ul class="blog-list">$&</ul>'
  );
  
  // Handle numbered lists (match digits followed by period)
  processedContent = processedContent.replace(
    /^[\s]*(\d+)\.[\s]+(.*?)$/gm,
    '<li class="numbered-item"><strong>$1.</strong> $2</li>'
  );
  
  // Group adjacent numbered <li> elements into <ol> blocks
  processedContent = processedContent.replace(
    /(<li class="numbered-item">.*?<\/li>(\s*\n\s*)?)+/g,
    '<ol class="blog-numbered-list">$&</ol>'
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

// Benefits list specific styling CSS
const benefitsListCSS = `
/* Benefits list specific styling */
.blog-content .benefit-list {
  margin-top: 1rem !important;
  margin-bottom: 2rem !important;
}

.blog-content .benefit-list li {
  display: list-item !important;
  list-style-type: disc !important;
  margin-bottom: 1rem !important;
  line-height: 1.6 !important;
}

.blog-content .benefit-list li strong {
  font-weight: 700 !important;
  color: white !important;
}
`;

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
  
  /* Direct styling for manually converted elements */
  .blog-content .blog-list {
    list-style-type: disc;
    margin-left: 1.5rem;
    margin-bottom: 1.5rem;
    padding-left: 1rem;
  }
  
  .blog-content .blog-list li {
    margin-bottom: 0.75rem;
    display: list-item;
  }
  
  .blog-content .blog-numbered-list {
    list-style-type: none;
    margin-left: 0;
    margin-bottom: 1.5rem;
    counter-reset: item;
  }
  
  .blog-content .blog-numbered-list li {
    margin-bottom: 0.75rem;
    display: block;
  }
  
  .blog-content .numbered-item strong {
    margin-right: 0.5rem;
  }
  
  .blog-content .faq-question {
    font-size: 1.2rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    color: white;
  }
  
  .blog-content .faq-answer {
    margin-left: 1.5rem;
    margin-bottom: 1.5rem;
    color: #f8fafc;
  }
  
  /* Fix for special UI sections */
  .blog-content h2 + ul li {
    display: list-item !important;
    list-style-type: disc !important;
  }
  
  .blog-content h2 + ul {
    margin-top: 1rem;
    margin-bottom: 2rem;
  }
  
  /* Fix for Key Takeaways section specifically */
  .blog-content h2:contains("Key Takeaways") + ul {
    list-style-type: disc;
    margin-left: 1.5rem;
    margin-bottom: 1.5rem;
  }
  
  .blog-content h2:contains("Key Takeaways") + ul li {
    display: list-item;
    list-style-type: disc;
  }
  
  /* Force bullet points to display properly */
  .blog-content ul, 
  .blog-content .blog-list,
  .blog-content .key-takeaways-list {
    list-style-type: disc !important;
    padding-left: 2rem !important;
    margin-bottom: 1.5rem !important;
  }
  
  .blog-content li,
  .blog-content .blog-list li,
  .blog-content .key-takeaways-list li {
    display: list-item !important;
    list-style-type: disc !important;
    margin-bottom: 0.75rem !important;
    padding-left: 0.5rem !important;
  }
  
  /* Ensure Key Takeaways get proper styling */
  .key-takeaways-list {
    margin-top: 1rem !important;
    margin-left: 1rem !important;
  }
  
  .key-takeaways-list li:before {
    content: "• ";
    color: white;
    font-weight: bold;
    display: inline-block; 
    width: 1em;
    margin-left: -1em;
  }
  
  ${benefitsListCSS}
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
          // Fetch related posts
          const relatedPostsResponse = await fetchRelatedPosts(data.post.id);
          
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
            // Use fetched related posts or fallback to empty array
            relatedPosts: relatedPostsResponse.length > 0 ? relatedPostsResponse : []
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

  // Function to fetch related posts
  async function fetchRelatedPosts(excludeId: string) {
    try {
      console.log('Fetching related posts, excluding ID:', excludeId);
      // Fetch all blog posts
      const response = await fetch('/api/blog/posts');
      
      if (!response.ok) {
        console.error('Failed to fetch related posts:', response.status, response.statusText);
        return [];
      }
      
      const data = await response.json();
      
      if (!data.posts || !Array.isArray(data.posts)) {
        console.warn('No posts data returned for related posts');
        return [];
      }
      
      console.log(`Found ${data.posts.length} posts, filtering for related content`);
      
      // Filter out the current post and select up to 2 most recent posts
      const relatedPosts = data.posts
        .filter(post => post.id !== excludeId)
        .slice(0, 2)
        .map(post => ({
          title: post.title,
          slug: post.slug,
          image: post.image || "/blog/sales-performance.jpg", // Ensure fallback image
          alt_text: post.alt_text || post.title
        }));
      
      console.log(`Returning ${relatedPosts.length} related posts`);
      return relatedPosts;
    } catch (error) {
      console.error('Error fetching related posts:', error);
      return [];
    }
  }

  if (loading) {
    return (
      <main className="bg-background min-h-screen text-foreground">
        <NavBarDemo lang="en" />
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="animate-pulse text-foreground text-lg">Loading post...</div>
        </div>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="bg-background min-h-screen text-foreground">
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
  
  const htmlContent = marked.parse(preProcessContent(preProcessImages(cleanUnsplashUrls(post.content || ''))));
  
  return (
    <main className="bg-background min-h-screen text-foreground">
      <NavBarDemo lang="en" />
      
      <article className="pt-12 pb-24 text-foreground">
        {/* Header */}
        <header className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl mb-12">
          <div className="text-sm text-blue-400 mb-2">
            <Link href="/blog" className="hover:underline">
              Blog
            </Link>
            {" / "}
            <span>CRM</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
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
              <div className="text-foreground font-medium">{post.author.name}</div>
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
            className="prose prose-lg prose-invert max-w-none text-foreground blog-content
              prose-headings:text-foreground prose-headings:font-bold
              prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-6 
              prose-h2:text-2xl prose-h2:font-bold prose-h2:mb-4 prose-h2:mt-8
              prose-h3:text-xl prose-h3:font-bold prose-h3:mb-4 prose-h3:mt-6
              prose-p:text-foreground prose-p:my-4 prose-p:opacity-90
              prose-li:text-foreground prose-li:opacity-90
              prose-strong:text-foreground prose-strong:font-bold
              prose-a:text-blue-400 prose-a:hover:underline
              first-letter:text-4xl first-letter:font-bold first-letter:text-blue-400"
            dangerouslySetInnerHTML={{ __html: htmlContent }} 
          />
          
          {/* Author bio */}
          <div className="mt-16 p-6 bg-background rounded-xl">
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
                <div className="text-xl font-bold text-foreground">{post.author.name}</div>
                <div className="text-gray-400">{post.author.bio}</div>
              </div>
            </div>
          </div>
        </div>
      </article>
      
      {/* Related posts */}
      <section className="bg-background py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground mb-8">Related Articles</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {post.relatedPosts && post.relatedPosts.length > 0 ? (
              post.relatedPosts.map((relatedPost, index) => (
              <Link href={`/blog/${relatedPost.slug}`} key={index} className="group">
                <div className="rounded-xl overflow-hidden bg-background h-full">
                  <div className="relative h-48 overflow-hidden">
                    <Image
                        src={relatedPost.image || "/blog/sales-performance.jpg"}
                      alt={relatedPost.alt_text || relatedPost.title}
                      fill
                      style={{ objectFit: "cover" }}
                      className="group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-foreground group-hover:text-blue-400 transition-colors">
                      {relatedPost.title}
                    </h3>
                  </div>
                </div>
              </Link>
              ))
            ) : (
              <div className="col-span-2 text-center py-8 text-gray-400">
                <p>No related articles found</p>
              </div>
            )}
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