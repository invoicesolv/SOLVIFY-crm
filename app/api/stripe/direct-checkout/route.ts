import { NextResponse } from 'next/server'
import { getStripeSession } from '@/lib/stripe'
import { getServerSession } from 'next-auth'
import authOptions from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    console.log('Direct checkout API called')
    
    // Get the session for authentication
    const session = await getServerSession(authOptions)
    
    // Get the plan from the URL query parameters
    const url = new URL(req.url)
    const plan = url.searchParams.get('plan') || 'team'
    const interval = url.searchParams.get('interval') || 'month'
    console.log('Selected plan:', plan, 'interval:', interval)
    
    // Select the appropriate price ID based on the plan and interval
    let priceId;
    
    if (interval === 'year') {
      switch(plan) {
        case 'team':
          priceId = process.env.NEXT_PUBLIC_STRIPE_TEAM_YEARLY_PRICE_ID;
          break;
        case 'business':
          priceId = process.env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY_PRICE_ID;
          break;
        case 'enterprise':
          priceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_YEARLY_PRICE_ID;
          break;
        default:
          priceId = process.env.NEXT_PUBLIC_STRIPE_TEAM_YEARLY_PRICE_ID;
      }
    } else {
      switch(plan) {
        case 'team':
          priceId = process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID;
          break;
        case 'business':
          priceId = process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID;
          break;
        case 'enterprise':
          priceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID;
          break;
        default:
          priceId = process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID;
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
        userId: session?.user?.id || 'anonymous'
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