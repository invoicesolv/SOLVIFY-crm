import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { getUserFromToken } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic';

// Using Supabase authentication - no NextAuth types needed

// Create Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Using imported getUserFromToken from auth-utils

export async function POST(request: NextRequest) {
  try {
    console.log('Stripe checkout API called')
    
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      console.log('No authenticated session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('User session found:', user.email)

    const body = await request.json()
    console.log('Request body:', body)
    
    const { priceId } = body

    // If no priceId provided, use the team plan monthly price ID
    const actualPriceId = priceId || 'price_1R3KiwKrzodQUsuF79bVaycE'
    
    if (!actualPriceId) {
      console.log('No price ID available')
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 })
    }

    console.log('Creating checkout session with priceId:', actualPriceId)
    
    try {
      // Create a checkout session
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: actualPriceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/dashboard?payment=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/dashboard?payment=canceled`,
        customer_email: user.email || undefined,
        metadata: {
          userId: user.id || 'anonymous', // Provide a default value for undefined
        },
      })
      
      console.log('Checkout session created:', {
        id: checkoutSession.id,
        url: checkoutSession.url
      })

      return NextResponse.json({ 
        sessionId: checkoutSession.id,
        url: checkoutSession.url
      })
    } catch (stripeError) {
      console.error('Error creating Stripe session:', stripeError)
      return NextResponse.json({ error: 'Error creating checkout session' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 })
  }
} 