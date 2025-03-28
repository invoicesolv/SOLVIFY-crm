import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  try {
    // Get the pathname of the request (with defensive check)
    const pathname = request.nextUrl?.pathname || '/'
    
    // Skip middleware for API routes and auth callbacks
    if (pathname.startsWith('/api/')) {
      return NextResponse.next()
    }
    
    // Define public paths that don't require authentication
    const isPublicPath = [
      '/login', 
      '/landing', 
      '/sv', 
      '/register'
    ].includes(pathname)

    // Check if user is authenticated using NextAuth token
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET 
    })
    const isAuthenticated = !!token

    // Always redirect root to Swedish version for non-authenticated users
    if (pathname === '/') {
      if (!isAuthenticated) {
        return NextResponse.redirect(new URL('/sv', request.url))
      }
      return NextResponse.next()
    }

    // If trying to access /landing directly, keep it accessible
    if (pathname === '/landing') {
      return NextResponse.next()
    }

    if (isPublicPath && isAuthenticated && pathname !== '/sv') {
      // If user is authenticated and tries to access public pages (except Swedish landing),
      // redirect to root
      return NextResponse.redirect(new URL('/', request.url))
    }

    if (!isPublicPath && !isAuthenticated) {
      // If user is not authenticated and tries to access protected route,
      // redirect to login page
      const url = new URL('/login', request.url)
      url.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
} 