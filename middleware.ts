import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  try {
    // Get the pathname of the request (with defensive check)
    const pathname = request.nextUrl?.pathname || '/'
    
    // Handle Fortnox OAuth callback
    if (pathname === '/oauth/callback') {
      console.log('Handling Fortnox OAuth callback in middleware');
      const url = request.nextUrl.clone();
      url.pathname = '/api/oauth/callback';
      return NextResponse.rewrite(url);
    }
    
    // Create a debugging object with limited information
    const debug = {
      pathname,
      cookies: Object.fromEntries(request.cookies.getAll().map(c => [c.name, c.value.substring(0, 5) + '...'])),
      referer: request.headers.get('referer') || '',
    }
    
    console.log(`[Middleware Debug] Request: ${JSON.stringify(debug, null, 2)}`)
    
    // Skip middleware for API routes and auth callbacks
    if (pathname.startsWith('/api/')) {
      console.log(`[Middleware] Skipping API route: ${pathname}`)
      return NextResponse.next()
    }
    
    // Define public paths that don't require authentication
    const isPublicPath = [
      '/login', 
      '/landing', 
      '/register',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/blog'
    ].includes(pathname) || pathname.startsWith('/blog/')
    
    // Define settings paths that should always be accessible for authenticated users
    const isSettingsPath = pathname.startsWith('/settings/') || pathname === '/settings'
    
    // Add explicit logging for billing page for debugging
    if (pathname === '/settings/billing') {
      console.log('[Middleware] Billing page access detected')
    }
    
    console.log(`[Middleware] Path ${pathname} is ${isPublicPath ? 'public' : isSettingsPath ? 'settings' : 'protected'}`)

    // Check if user is authenticated using NextAuth token
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    // Check for session cookie presence - this helps detect in-progress auth
    const hasSessionCookie = request.cookies.has('next-auth.session-token') || 
                             request.cookies.has('__Secure-next-auth.session-token')
    
    // Additional debug info
    const userEmail = request.cookies.has('user_email') ? request.cookies.get('user_email')?.value : null;
    console.log(`[Middleware] User email from cookie: ${userEmail}`);

    // Determine authentication status
    const isAuthenticated = !!token
    const isAuthenticating = !token && hasSessionCookie
    
    console.log(`[Middleware] Auth status: isAuthenticated=${isAuthenticated}, isAuthenticating=${isAuthenticating}, hasToken=${!!token}, hasSessionCookie=${hasSessionCookie}`)

    // Allow requests in the authentication process even without a token
    if (isAuthenticating) {
      console.log(`[Middleware] In-progress authentication detected - allowing through`)
      return NextResponse.next()
    }

    // If the user is authenticated and tries to access the root path,
    // redirect them to the dashboard
    if (pathname === '/' && isAuthenticated) {
      console.log(`[Middleware] Authenticated user at root - redirecting to dashboard`)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    
    // Only redirect to landing page if the user is not authenticated
    // and trying to access the root
    if (pathname === '/' && !isAuthenticated) {
      console.log(`[Middleware] Unauthenticated user at root - redirecting to landing page`)
      return NextResponse.redirect(new URL('/landing', request.url))
    }

    // If trying to access /landing directly, keep it accessible
    if (pathname === '/landing') {
      console.log(`[Middleware] Allowing direct access to landing page`)
      return NextResponse.next()
    }

    // If user is authenticated and tries to access login/register pages,
    // redirect to dashboard - BUT allow reset password page and blog pages
    if (isPublicPath && isAuthenticated && !['/landing', '/blog', '/auth/reset-password', '/auth/forgot-password'].includes(pathname) && !pathname.startsWith('/blog/')) {
      console.log(`[Middleware] Authenticated user accessing public page - redirecting to dashboard`)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // If authenticated user is accessing settings pages (including billing),
    // allow access without redirection
    if (isSettingsPath && isAuthenticated) {
      console.log(`[Middleware] Authenticated user accessing settings - allowing access`)
      return NextResponse.next()
    }

    // If user is not authenticated and tries to access protected route,
    // redirect to login page
    if (!isPublicPath && !isAuthenticated) {
      console.log(`[Middleware] Unauthenticated user accessing protected page - redirecting to login`)
      const url = new URL('/login', request.url)
      url.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(url)
    }

    console.log(`[Middleware] Allowing access to ${pathname}`)
    return NextResponse.next()
  } catch (error) {
    console.error('[Middleware] Error:', error)
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
    '/oauth/callback'
  ],
} 