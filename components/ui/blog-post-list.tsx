import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

interface BlogPost {
  id: string;
  title: string;
  titleSv?: string; 
  excerpt: string;
  excerptSv?: string;
  category: string;
  categorySv?: string;
  slug: string;
  date: string;
  readTime: string;
  readTimeSv?: string;
  image: string;
  alt_text?: string;
  author: {
    name: string;
    avatar: string;
  };
  blog_post_url?: string;
  is_featured?: boolean;
}

interface BlogPostListProps {
  lang: "en" | "sv";
}

export function BlogPostList({ lang }: BlogPostListProps) {
  const isSwedish = lang === "sv";
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [featuredPost, setFeaturedPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchBlogPosts() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch blog posts from the API
        const response = await fetch('/api/blog/posts');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch blog posts: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.posts && Array.isArray(data.posts) && data.posts.length > 0) {
          setBlogPosts(data.posts);
          
          // Set featured post
          if (data.featuredPost) {
            setFeaturedPost(data.featuredPost);
          } else {
            setFeaturedPost(data.posts[0]);
          }
        } else {
          setError('No blog posts found');
          setBlogPosts([]);
          setFeaturedPost(null);
        }
      } catch (err) {
        console.error('Error fetching blog posts:', err);
        setError('Failed to load blog posts');
        setBlogPosts([]);
        setFeaturedPost(null);
      } finally {
        setLoading(false);
      }
    }
    
    fetchBlogPosts();
  }, []);

  // Labels translation
  const labels = {
    readMore: isSwedish ? "Läs mer" : "Read more",
    featured: isSwedish ? "Utvalda" : "Featured",
    latestPosts: isSwedish ? "Senaste inläggen" : "Latest Posts",
    viewAll: isSwedish ? "Visa alla" : "View all",
    loading: isSwedish ? "Laddar inlägg..." : "Loading posts...",
    error: isSwedish ? "Kunde inte ladda inlägg" : "Could not load posts",
    noPosts: isSwedish ? "Inga inlägg hittades" : "No posts found"
  };

  if (loading) {
    return (
      <section className="bg-background py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="animate-pulse text-gray-400">{labels.loading}</div>
        </div>
      </section>
    );
  }

  if (error || !blogPosts.length) {
    return (
      <section className="bg-background py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-red-400">{error || labels.noPosts}</div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background py-16 md:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Featured post */}
        {featuredPost && (
          <div className="mb-16">
            <h2 className="text-xl font-medium text-blue-400 mb-8">{labels.featured}</h2>
            <div className="grid lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3 relative rounded-xl overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent z-10"></div>
                <div className="relative h-[400px] w-full">
                  <Image
                    src={featuredPost.image}
                    alt={featuredPost.alt_text || featuredPost.title}
                    layout="fill"
                    objectFit="cover"
                    className="group-hover:scale-105 transition-transform duration-300"
                    priority
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 mb-3">
                    {featuredPost.category}
                  </span>
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {featuredPost.title}
                  </h3>
                  <div 
                    className="text-gray-300 mb-4 prose prose-base prose-invert max-w-none
                    prose-headings:text-foreground prose-headings:my-2
                    prose-h2:text-xl prose-h2:font-semibold
                    prose-h3:text-lg prose-h3:font-medium
                    prose-p:text-gray-300 prose-p:my-2
                    prose-strong:text-gray-200"
                    dangerouslySetInnerHTML={{ 
                      __html: featuredPost.excerpt.includes('<') && featuredPost.excerpt.includes('>')
                        ? featuredPost.excerpt 
                        : `<p>${featuredPost.excerpt}</p>` 
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full overflow-hidden mr-2">
                        <Image 
                          src={featuredPost.author.avatar} 
                          alt={featuredPost.author.name} 
                          width={32} 
                          height={32} 
                        />
                      </div>
                      <span className="text-sm text-gray-400">{featuredPost.author.name}</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      {featuredPost.date} · {featuredPost.readTime}
                    </div>
                  </div>
                  <Link href={`/blog/${featuredPost.slug}`} className="absolute inset-0 z-30" aria-label={featuredPost.title}></Link>
                </div>
              </div>
              
              <div className="lg:col-span-2 flex flex-col space-y-6">
                {blogPosts.slice(1, 3).map(post => (
                  <div key={post.id} className="rounded-xl overflow-hidden bg-background h-full flex flex-col">
                    <div className="relative h-48">
                      <Image
                        src={post.image}
                        alt={post.alt_text || post.title}
                        layout="fill"
                        objectFit="cover"
                      />
                    </div>
                    <div className="p-6 flex-grow flex flex-col">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 mb-3">
                        {post.category}
                      </span>
                      <h3 className="text-xl font-bold text-foreground mb-2">
                        {post.title}
                      </h3>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-6 h-6 rounded-full overflow-hidden mr-2">
                            <Image 
                              src={post.author.avatar} 
                              alt={post.author.name} 
                              width={24} 
                              height={24} 
                            />
                          </div>
                          <span className="text-xs text-gray-400">{post.author.name}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {post.date}
                        </div>
                      </div>
                      <Link href={`/blog/${post.slug}`} className="mt-4 text-blue-400 hover:text-blue-300 inline-flex items-center font-medium">
                        {labels.readMore}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Latest posts */}
        <div>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-medium text-blue-400">{labels.latestPosts}</h2>
            <Link href="/blog" className="text-sm text-gray-400 hover:text-blue-400 transition-colors">
              {labels.viewAll}
            </Link>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.slice(1).map(post => (
              <div key={post.id} className="rounded-xl overflow-hidden bg-background h-full flex flex-col group">
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src={post.image}
                    alt={post.alt_text || post.title}
                    layout="fill"
                    objectFit="cover"
                    className="group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-6 flex-grow flex flex-col">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 mb-3">
                    {post.category}
                  </span>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {post.title}
                  </h3>
                  <div 
                    className="text-gray-400 text-sm mb-4 flex-grow prose prose-sm prose-invert max-w-none
                    prose-headings:text-foreground prose-headings:my-2
                    prose-h2:text-lg prose-h2:font-semibold
                    prose-h3:text-base prose-h3:font-medium
                    prose-p:text-gray-400 prose-p:my-2
                    prose-strong:text-gray-200"
                    dangerouslySetInnerHTML={{ 
                      __html: post.excerpt.includes('<') && post.excerpt.includes('>')
                        ? post.excerpt 
                        : `<p>${post.excerpt}</p>` 
                    }}
                  />
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-6 h-6 rounded-full overflow-hidden mr-2">
                        <Image 
                          src={post.author.avatar} 
                          alt={post.author.name} 
                          width={24} 
                          height={24} 
                        />
                      </div>
                      <span className="text-xs text-gray-400">{post.author.name}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {post.date}
                    </div>
                  </div>
                  <Link href={`/blog/${post.slug}`} className="mt-4 text-blue-400 hover:text-blue-300 inline-flex items-center font-medium">
                    {labels.readMore}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
} 