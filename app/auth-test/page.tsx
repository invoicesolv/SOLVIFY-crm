'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function AuthTestPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === 'loading') {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Auth Test Page</h1>
      
      <div className="space-y-4">
        <div>
          <strong>Status:</strong> {status}
        </div>
        
        {session ? (
          <div>
            <div><strong>Email:</strong> {session.user?.email}</div>
            <div><strong>Name:</strong> {session.user?.name}</div>
            <div><strong>ID:</strong> {session.user?.id}</div>
            
            <div className="mt-4 space-x-2">
              <button 
                onClick={() => router.push('/dashboard')}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Go to Dashboard
              </button>
              <button 
                onClick={() => signOut()}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p>Not signed in</p>
            <button 
              onClick={() => signIn('google')}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Sign In with Google
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
