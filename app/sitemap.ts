import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://crm.solvify.se'
  const lastModified = new Date()
  
  // Define pages that exist in both languages
  const pages = [
    { path: '/', priority: 1.0 },
    { path: '/landing', priority: 0.9 },
    { path: '/login', priority: 0.8 },
    { path: '/register', priority: 0.8 },
    { path: '/dashboard', priority: 0.7 },
    { path: '/blog', priority: 0.9 },
  ]
  
  // Sample blog posts for sitemap
  const blogPosts = [
    { slug: 'ways-crm-boost-sales-performance', priority: 0.8 },
    { slug: 'ultimate-guide-customer-data-management', priority: 0.8 },
    { slug: 'automating-workflow-solvify-crm', priority: 0.8 },
    { slug: 'integrating-crm-business-tools', priority: 0.8 },
  ]
  
  // English pages (default language)
  const enPages = pages.map(({ path, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency: path.includes('landing') || path.includes('blog') ? 'weekly' : 'monthly' as 'weekly' | 'monthly',
    priority,
  }))
  
  // English blog posts
  const enBlogPosts = blogPosts.map(({ slug, priority }) => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified,
    changeFrequency: 'weekly' as 'weekly',
    priority,
  }))
  
  // Swedish pages
  const svPages = pages.map(({ path, priority }) => {
    // Special case for root in Swedish
    const svPath = path === '/' ? '/sv' : `${path}/sv`
    return {
      url: `${baseUrl}${svPath}`,
      lastModified,
      changeFrequency: path.includes('landing') || path.includes('blog') ? 'weekly' : 'monthly' as 'weekly' | 'monthly',
      priority: priority - 0.1, // Slightly lower priority for non-default language
    }
  })
  
  // Swedish blog posts
  const svBlogPosts = blogPosts.map(({ slug, priority }) => ({
    url: `${baseUrl}/blog/sv/${slug}`,
    lastModified,
    changeFrequency: 'weekly' as 'weekly',
    priority: priority - 0.1,
  }))
  
  return [...enPages, ...enBlogPosts, ...svPages, ...svBlogPosts]
} 