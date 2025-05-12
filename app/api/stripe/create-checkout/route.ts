import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getServerSession } from 'next-auth'
import authOptions from "@/lib/auth";

export const dynamic = 'force-dynamic';

// Define the Session user type with expected properties
interface SessionUser {
  id?: string;
  name?: string;
  email?: string;
  image?: string;
}

// Extend the Session type
declare module "next-auth" {
  interface Session {
    user: SessionUser;
    access_token: string;
    refresh_token: string;
  }
}

export async function POST(req: Request) {
  try {
    console.log('Stripe checkout API called')
    
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.log('No authenticated session found')
      return new NextResponse('Unauthorized', { status: 401 })
    }
    
    console.log('User session found:', session.user.email)

    const body = await req.json()
    console.log('Request body:', body)
    
    const { priceId } = body

    // If no priceId provided, use the team plan monthly price ID
    const actualPriceId = priceId || 'price_1R3KiwKrzodQUsuF79bVaycE'
    
    if (!actualPriceId) {
      console.log('No price ID available')
      return new NextResponse('Price ID is required', { status: 400 })
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
        customer_email: session.user.email || undefined,
        metadata: {
          userId: session.user.id || 'anonymous', // Provide a default value for undefined
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
      return new NextResponse('Error creating checkout session', { status: 500 })
    }
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
} 