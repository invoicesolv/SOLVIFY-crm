import { NextRequest, NextResponse } from 'next/server'
import { getStripeSession } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
  
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      return null
    }
    return user
  } catch (error) {
    console.error('Error verifying token:', error)
    return null
  }
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('Direct checkout API called')
    
    // Get user from JWT token
    const user = await getUserFromToken(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get the plan from the URL query parameters
    const url = new URL(request.url)
    const plan = url.searchParams.get('plan') || 'team'
    const interval = url.searchParams.get('interval') || 'month'
    console.log('Selected plan:', plan, 'interval:', interval)
    
    // Select the appropriate price ID based on the plan and interval
    let priceId
    
    if (interval === 'year') {
      switch(plan) {
        case 'team':
          priceId = process.env.NEXT_PUBLIC_STRIPE_TEAM_YEARLY_PRICE_ID
          break
        case 'business':
          priceId = process.env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PRICE_ID
          break
        case 'enterprise':
          priceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_YEARLY_PRICE_ID
          break
        default:
          priceId = process.env.NEXT_PUBLIC_STRIPE_TEAM_YEARLY_PRICE_ID
      }
    } else {
      switch(plan) {
        case 'team':
          priceId = process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID
          break
        case 'business':
          priceId = process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID
          break
        case 'enterprise':
          priceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID
          break
        default:
          priceId = process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID
      }
    }
    
    console.log('Using price ID:', priceId)
    
    if (!priceId) {
      console.error('No price ID available for plan:', plan, 'interval:', interval)
      return new NextResponse('Invalid plan or interval selected', { status: 400 })
    }

    // Create checkout session using the helper function
    const checkoutSession = await getStripeSession(
      priceId,
      undefined, // No customer ID for now
      {
        plan,
        interval,
        userId: user.id || 'anonymous'
      }
    )

    if (!checkoutSession?.url) {
      console.error('No checkout URL returned from Stripe')
      return new NextResponse('Failed to create checkout URL', { status: 500 })
    }

    // Redirect to the checkout URL
    console.log('Redirecting to:', checkoutSession.url)
    return NextResponse.redirect(checkoutSession.url)
    
  } catch (error: any) {
    console.error('Error in direct checkout API:', error?.message || error)
    return new NextResponse(error?.message || 'Internal Error', { status: 500 })
  }
} 