"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-client';
import { supabaseClient as supabase } from '@/lib/supabase-client'
import { Clock, AlertCircle, X, CreditCard } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface UserPreferences {
  plan_id: string
  trial_start_date: string
  trial_end_date: string
  dismissed_countdown?: boolean
}

const planNames = {
  'free': 'Privatpersoner',
  'team': 'Team',
  'business': 'Organisationer',
  'enterprise': 'Enterprise'
}

// Stripe price IDs are now in environment variables
const stripePriceIds = {
  'free': null,
  'team': {
    month: process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID,
    year: process.env.NEXT_PUBLIC_STRIPE_TEAM_YEARLY_PRICE_ID
  },
  'business': {
    month: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID,
    year: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID
  },
  'enterprise': {
    month: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
    year: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID
  }
}

export function TrialCountdown() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)

  useEffect(() => {
    console.log('TrialCountdown component mounted, user:', user)
    console.log('User ID:', user?.id)
    
    // Reset dismissed state on login
    if (user?.id) {
      setDismissed(false)
    }
    
    // Only run once we have an authenticated user
    if (!user?.id) {
      console.log('Waiting for authenticated user')
      return
    }
    
    // Prevent multiple fetches for the same session
    if (initialized && preferences) {
      console.log('Already initialized with preferences, skipping fetch')
      return
    }
    
    const fetchUserPreferences = async () => {
      console.log('Fetching user preferences for user ID:', user.id)
      
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('plan_id, trial_start_date, trial_end_date, dismissed_countdown')
          .eq('user_id', user.id)
          .single()
        
        console.log('Fetch result:', { data, error })
        
        if (error) {
          console.error('Error fetching user preferences:', error)
          
          // For new users, create default preferences
          if (error.code === 'PGRST116') {
            console.log('Creating default user preferences for new user')
            
            const now = new Date()
            const trialEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
            
            const defaultPreferences = {
              user_id: user.id,
              plan_id: 'free',
              trial_start_date: now.toISOString(),
              trial_end_date: trialEndDate.toISOString(),
              has_seen_welcome: false,
              dismissed_countdown: false,
              created_at: now.toISOString()
            }
            
            console.log('Inserting default preferences:', defaultPreferences)
            
            const { data: newPrefs, error: insertError } = await supabase
              .from('user_preferences')
              .insert(defaultPreferences)
              .select('plan_id, trial_start_date, trial_end_date, dismissed_countdown')
              .single()
              
            if (insertError) {
              console.error('Error creating default preferences:', insertError)
              setError('Failed to create preferences')
              setLoading(false)
              return
            }
            
            console.log('Successfully created default preferences:', newPrefs)
            setPreferences(newPrefs)
            setDaysRemaining(14) // New users get 14 days
            setInitialized(true)
            setLoading(false)
            return
          }
          
          setError(error.message)
          setLoading(false)
          return
        }
        
        setPreferences(data)
        setDismissed(data.dismissed_countdown || false)
        setInitialized(true)
        
        // Calculate days remaining in trial
        if (data?.trial_end_date) {
          const endDate = new Date(data.trial_end_date)
          const today = new Date()
          const diffTime = endDate.getTime() - today.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          setDaysRemaining(diffDays > 0 ? diffDays : 0)
          console.log('Days remaining in trial:', diffDays > 0 ? diffDays : 0)
        }
      } catch (error) {
        console.error('Error in fetchUserPreferences:', error)
        setError('Failed to fetch preferences')
      } finally {
        setLoading(false)
      }
    }
    
    fetchUserPreferences()
  }, [user, initialized, preferences])
  
  const handleDismiss = async () => {
    if (!user?.id) return
    
    try {
      setDismissed(true)
      
      // Update user preferences to mark countdown as dismissed
      await supabase
        .from('user_preferences')
        .update({ dismissed_countdown: true })
        .eq('user_id', user.id)
      
      console.log('Countdown dismissed')
    } catch (error) {
      console.error('Error dismissing countdown:', error)
      setDismissed(false)
    }
  }
  
  const handlePayNow = async () => {
    if (paymentLoading) return;
    
    setPaymentLoading(true);
    
    try {
      // Get the current plan or default to team
      const currentPlan = preferences?.plan_id || 'team';
      
      // Redirect to the direct checkout endpoint
      window.location.href = `/api/stripe/direct-checkout?plan=${currentPlan}&interval=month`;
    } catch (error) {
      console.error('Payment error:', error);
      setError('Failed to process payment. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };
  
  // Show loading state until we've completed initialization
  if (loading && !initialized) {
    return (
      <div className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 text-foreground py-2 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-medium">Loading plan information...</span>
          </div>
        </div>
      </div>
    )
  }
  
  // Don't show anything if not authenticated
  if (!user) {
    return null
  }
  
  // Don't show if dismissed by user
  if (dismissed) {
    return null
  }

  // Only show for free plan users
  if (preferences?.plan_id && preferences.plan_id !== 'free') {
    console.log('User has a paid plan:', preferences.plan_id)
    return null
  }

  // Don't show if trial has ended
  if (preferences?.trial_end_date) {
    const trialEnd = new Date(preferences.trial_end_date)
    const now = new Date()
    if (trialEnd < now) {
      console.log('Trial has ended')
      return null
    }
  }
  
  // Show error state but keep it visible
  if (error) {
    console.error('Trial countdown error:', error)
    return (
      <div className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 text-foreground py-2 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-medium">Free Plan</span>
            <div className="flex items-center space-x-1 text-sm">
              <Clock className="h-4 w-4" />
              <span>14 days left in trial</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePayNow}
              disabled={paymentLoading}
              className="bg-background text-indigo-600 hover:bg-background/90 px-3 py-1 rounded-md text-sm font-medium flex items-center space-x-1"
            >
              <CreditCard className="h-3 w-3 mr-1" />
              {paymentLoading ? 'Processing...' : 'Pay Now for Full Access'}
            </button>
            <button
              onClick={handleDismiss}
              className="text-foreground/80 hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // Show default if no preferences yet
  if (!preferences) {
    return (
      <div className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 text-foreground py-2 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-medium">Free Plan</span>
            <div className="flex items-center space-x-1 text-sm">
              <Clock className="h-4 w-4" />
              <span>14 days left in trial</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handlePayNow}
              disabled={paymentLoading}
              className="bg-background text-indigo-600 hover:bg-background/90 px-3 py-1 rounded-md text-sm font-medium flex items-center space-x-1"
            >
              <CreditCard className="h-3 w-3 mr-1" />
              {paymentLoading ? 'Processing...' : 'Pay Now for Full Access'}
            </button>
            <a 
              href="/checkout" 
              className="text-xs text-foreground/70 hover:text-foreground underline"
            >
              Direct link
            </a>
            <button
              onClick={handleDismiss}
              className="text-foreground/80 hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  const planName = planNames[preferences.plan_id as keyof typeof planNames] || 'Free'
  
  return (
    <div className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 text-foreground py-2 px-4">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-medium">
            {planName} Plan
          </span>
          {daysRemaining !== null && daysRemaining <= 14 && (
            <div className="flex items-center space-x-1 text-sm">
              <Clock className="h-4 w-4" />
              <span>
                {daysRemaining === 0 
                  ? 'Trial ended' 
                  : daysRemaining === 1 
                    ? '1 day left in trial' 
                    : `${daysRemaining} days left in trial`}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handlePayNow}
            disabled={paymentLoading}
            className="bg-background text-indigo-600 hover:bg-background/90 px-3 py-1 rounded-md text-sm font-medium flex items-center space-x-1"
          >
            <CreditCard className="h-3 w-3 mr-1" />
            {paymentLoading ? 'Processing...' : 'Pay Now for Full Access'}
          </button>
          <a 
            href="/checkout" 
            className="text-xs text-foreground/70 hover:text-foreground underline"
          >
            Direct link
          </a>
          <button
            onClick={handleDismiss}
            className="text-foreground/80 hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
} 