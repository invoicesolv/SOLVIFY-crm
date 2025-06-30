"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { useAuth } from '@/lib/auth-client';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export interface PricingTier {
  id: string
  name: string
  description: string
  price: {
    monthly: number | string
    yearly: number | string
  }
  features: string[]
  cta: {
    text: string
    href: string
  }
  trial?: string
  stripePriceId?: {
    monthly: string | null
    yearly: string | null
  }
  popular?: boolean
  highlighted?: boolean
}

interface PricingCardProps {
  tier: PricingTier
  paymentFrequency: string
}

export function PricingCard({ tier, paymentFrequency }: PricingCardProps) {
  const { user, session } = useAuth()
  const [loading, setLoading] = useState(false)
  const isMonthly = paymentFrequency?.toLowerCase().includes("month") || paymentFrequency?.toLowerCase().includes("månad")
  const frequency = isMonthly ? "monthly" : "yearly"
  
  const price =
    typeof tier.price[frequency] === "number"
      ? `$${tier.price[frequency]}`
      : tier.price[frequency]

  const handleSubscribe = async () => {
    try {
      setLoading(true)

      // For free tier or if the user wants to try a paid plan first
      if (tier.id === 'free' || tier.cta.text.toLowerCase().includes('test') || tier.cta.text.toLowerCase().includes('try')) {
        // Redirect to register page with plan parameter
        window.location.href = `/register?plan=${tier.id}`;
        return;
      }

      if (!user) {
        // Redirect to register page with plan parameter instead of login
        window.location.href = `/register?plan=${tier.id}`;
        return;
      }

      if (!session?.access_token) {
        // Redirect to login if no valid session
        window.location.href = `/login?plan=${tier.id}`;
        return;
      }

      const priceId = tier.stripePriceId?.[frequency]
      
      if (!priceId) {
        console.error('No Stripe price ID found for this tier')
        return
      }

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          priceId,
        }),
      })

      const { sessionId } = await response.json()
      const stripe = await stripePromise

      if (!stripe) {
        console.error('Stripe not initialized')
        return
      }

      // Redirect to Stripe checkout
      const { error } = await stripe.redirectToCheckout({ sessionId })

      if (error) {
        console.error('Stripe checkout error:', error)
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/10 bg-background/5 backdrop-blur-sm p-6 shadow-lg",
        tier.highlighted && "border-primary shadow-primary/10",
      )}
    >
      {tier.popular && (
        <div className="absolute -top-3 left-0 right-0 mx-auto w-fit rounded-full bg-primary px-3 py-1 text-xs text-foreground">
          Popular
        </div>
      )}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">{tier.name}</h3>
          <p className="text-sm text-foreground/60">{tier.description}</p>
        </div>

        <div className="space-y-1">
          <div className="text-3xl font-bold text-foreground">{price}</div>
          {typeof tier.price[frequency] === "number" && (
            <div className="text-sm font-medium text-foreground/60">
              per {isMonthly ? "month" : "year"}
            </div>
          )}
          {tier.trial && (
            <div className="text-sm font-semibold text-foreground bg-primary/20 px-2 py-1 rounded-md mt-2 inline-block">
              {tier.trial}
            </div>
          )}
        </div>

        <div className="space-y-2 text-sm text-foreground">
          {tier.features.map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <div className="p-6">
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className={cn(
              "w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              tier.highlighted
                ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-foreground hover:from-violet-600 hover:to-indigo-600"
                : "bg-background/5 text-foreground hover:bg-background/10"
            )}
          >
            {loading ? "Loading..." : tier.cta.text}
          </button>
        </div>
      </div>
    </div>
  )
} 