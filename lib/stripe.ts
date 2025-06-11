import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

// Create a simple Stripe instance with the secret key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16' as const,
  typescript: true,
});

export const getStripeSession = async (
  priceId: string, 
  customerId?: string,
  metadata?: Record<string, string>
) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  
  console.log('Creating Stripe checkout session with:', {
    priceId,
    customerId,
    metadata,
    siteUrl: baseUrl
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/settings/billing?success=true`,
      cancel_url: `${baseUrl}/settings/billing`,
      customer: customerId,
      metadata: metadata,
      subscription_data: {
        trial_period_days: 14
      }
    });

    console.log('Stripe session created successfully:', {
      id: session.id,
      url: session.url
    });

    return session;
  } catch (error) {
    console.error('Error creating Stripe session:', error);
    throw error;
  }
};

export const getStripeInstance = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe secret key is not set');
  }
  return stripe;
}; 