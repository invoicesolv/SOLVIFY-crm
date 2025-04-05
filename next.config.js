/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  experimental: {
    // This will allow us to deploy with dynamic API routes
    serverComponentsExternalPackages: ['nodemailer'],
  },
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
  },
  // These routes should be treated as dynamic and not pre-rendered
  excludeDefaultMomentLocales: true,
  transpilePackages: ['lucide-react'],
} 