"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CheckoutPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    // Log Stripe public key for debugging
    console.log('Stripe public key:', process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    
    // Redirect to the direct checkout API
    try {
      router.push('/api/stripe/direct-checkout')
    } catch (error) {
      console.error('Error redirecting to checkout:', error)
      setError('Failed to redirect to checkout. Please try again.')
    }
  }, [router])
  
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Redirecting to checkout...</h1>
        {error && (
          <div className="text-red-500 mb-4">{error}</div>
        )}
        <p>If you are not redirected automatically, <a href="/api/stripe/direct-checkout" className="text-blue-500 underline">click here</a>.</p>
        <p className="mt-4 text-sm text-gray-500">Using Stripe key: {process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.substring(0, 10)}...</p>
      </div>
    </div>
  )
} 