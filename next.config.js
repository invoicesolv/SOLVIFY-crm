/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  experimental: {
    // This will allow us to deploy with dynamic API routes
    serverComponentsExternalPackages: ['nodemailer'],
    // Disable static optimization for API routes
    disableOptimizedLoading: true,
  },
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
  },
  // Disable static generation for API routes
  typescript: {
    // Ignore TypeScript errors during build
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignore ESLint errors during build
    ignoreDuringBuilds: true,
  },
  // These routes should be treated as dynamic and not pre-rendered
  excludeDefaultMomentLocales: true,
  transpilePackages: ['lucide-react'],
} 