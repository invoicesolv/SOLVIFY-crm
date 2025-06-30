import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip middleware for API auth routes
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }
  
  // Skip middleware for public routes
  const publicRoutes = ['/login', '/register', '/landing', '/api/webhook', '/api/cron', '/api/fortnox']
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }
  
  try {
    // Check for valid session token
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    // If accessing protected routes without token, redirect to login
    const protectedRoutes = ['/dashboard', '/api/analytics', '/api/gmail', '/api/search-console', '/api/integrations']
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
    
    if (isProtectedRoute && !token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
    
    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    // If there's an error with token validation, allow the request to proceed
    // and let the page handle authentication
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ]
}
