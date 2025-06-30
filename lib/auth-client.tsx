'use client'

import { useSession, signIn, signOut, SessionProvider } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'

// Create auth context for global state
interface AuthContextType {
  user: any
  session: any
  loading: boolean
  signIn: () => void
  signOut: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Auth Provider Component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthContextProvider>
        {children}
      </AuthContextProvider>
    </SessionProvider>
  )
}

function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  const handleSignIn = () => {
    signIn('google', { callbackUrl: '/dashboard' })
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/landing' })
  }

  const value = {
    user: session?.user || null,
    session: session || null, // Include the full session object
    loading: status === 'loading',
    signIn: handleSignIn,
    signOut: handleSignOut,
    isAuthenticated: !!session?.user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Replacement for Supabase useUser hook
export function useUser() {
  const { data: session, status } = useSession()
  
  return {
    user: session?.user || null,
    loading: status === 'loading',
    error: status === 'unauthenticated' ? new Error('Not authenticated') : null
  }
}

// Protected Route Component
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (!session) {
      router.push('/login')
      return
    }
  }, [session, status, router])

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  if (!session) {
    return null
  }

  return <>{children}</>
}

// Sign In Button Component
export function SignInButton() {
  const { signIn } = useAuth()
  
  return (
    <button
      onClick={signIn}
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
    >
      Sign in with Google
    </button>
  )
}

// Sign Out Button Component
export function SignOutButton() {
  const { signOut } = useAuth()
  
  return (
    <button
      onClick={signOut}
      className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
    >
      Sign out
    </button>
  )
}

// User Profile Component
export function UserProfile() {
  const { user } = useAuth()
  
  if (!user) return null
  
  return (
    <div className="flex items-center space-x-2">
      {user.image && (
        <img 
          src={user.image} 
          alt={user.name || 'User'} 
          className="w-8 h-8 rounded-full"
        />
      )}
      <span className="text-sm font-medium">{user.name || user.email}</span>
    </div>
  )
}
