"use client"

import { Suspense, useRef, useEffect } from 'react'
import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession, signIn } from "next-auth/react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import ReCAPTCHA from 'react-google-recaptcha'

// reCAPTCHA site key from Google
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LflizkrAAAAACU7692bUxrhSuhzqOUnKXbQOuQC';

function LoginContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const recaptchaRef = useRef<ReCAPTCHA>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  let callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  // Debug session status
  useEffect(() => {
    console.log('Login page - Session status:', status)
    console.log('Login page - Session data:', session)
    console.log('Login page - Callback URL:', callbackUrl)
  }, [status, session, callbackUrl])

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated' && session) {
      console.log('User is authenticated, redirecting to:', callbackUrl)
      router.push(callbackUrl)
    }
  }, [status, session, callbackUrl, router])

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold text-foreground">Checking authentication...</h2>
            <div className="mt-4 animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  // If user is authenticated, show redirecting message
  if (status === 'authenticated' && session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold text-foreground">Redirecting to dashboard...</h2>
            <div className="mt-4 animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  const handleCaptchaChange = (token: string | null) => {
    setCaptchaToken(token);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
      setError('Please enter both email and password')
      setLoading(false)
      return
    }

    // Skip reCAPTCHA for localhost development
    if (process.env.NODE_ENV === 'production' && !captchaToken) {
      setError('Please complete the reCAPTCHA verification')
      setLoading(false)
      return
    }

    try {
      // Use NextAuth credentials provider
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error === 'CredentialsSignin' ? 'Invalid email or password' : result.error)
      } else if (result?.ok) {
        console.log('Login successful, redirecting to:', callbackUrl)
        router.push(callbackUrl)
      } else {
        setError('Login failed. Please try again.')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('An error occurred during login')
    } finally {
      setLoading(false)
      // Reset captcha
      if (recaptchaRef.current) {
        recaptchaRef.current.reset()
      }
      setCaptchaToken(null)
    }
  }

  const handleGoogleSignIn = async () => {
    console.log('Google sign-in button clicked')
    setLoading(true)
    setError("")
    
    try {
      console.log('Calling signIn with callbackUrl:', callbackUrl)
      
      // Direct redirect to Google OAuth URL
      const result = await signIn('google', { 
        callbackUrl,
        redirect: false // Don't auto-redirect, handle manually
      })
      
      console.log('signIn result:', result)
      
      if (result?.url) {
        console.log('Redirecting to:', result.url)
        window.location.href = result.url
      } else if (result?.error) {
        console.error('SignIn error:', result.error)
        setError('Failed to sign in: ' + result.error)
        setLoading(false)
      } else {
        console.log('Success, redirecting to dashboard')
        window.location.href = callbackUrl
      }
    } catch (error) {
      console.error('Google sign-in error:', error)
      setError('Failed to sign in with Google: ' + (error as Error)?.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-foreground">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-foreground/60">
            Sign in to your account
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleGoogleSignIn();
          }}
          disabled={loading}
          type="button"
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border border-white/10 bg-background/5 text-foreground hover:bg-background/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[#0A0A0A] text-foreground/60">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground/80">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full px-3 py-2 bg-background/5 border border-white/10 rounded-lg text-foreground placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground/80">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 block w-full px-3 py-2 bg-background/5 border border-white/10 rounded-lg text-foreground placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
              />
              <div className="mt-2 text-right">
                <Link 
                  href="/auth/forgot-password"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-400"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
          </div>

          {/* Only show reCAPTCHA in production */}
          {process.env.NODE_ENV === 'production' && (
            <div className="mt-6 flex justify-center">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={RECAPTCHA_SITE_KEY}
                onChange={handleCaptchaChange}
                theme="dark"
              />
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-foreground bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-foreground/60">
          Don't have an account?{" "}
          <Link href="/register" className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-400">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold text-foreground">Loading...</h2>
            <div className="mt-4 animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
          </div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
} 