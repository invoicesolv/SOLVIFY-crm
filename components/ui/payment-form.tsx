"use client";

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from './button';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentFormProps {
  plan: string;
  amount: number;
}

function CheckoutForm({ plan, amount }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      // Create payment intent
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          plan,
        }),
      });

      const { clientSecret, error: backendError } = await response.json();
      
      if (backendError) {
        setError(backendError);
        return;
      }

      // Confirm payment
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success`,
        },
      });

      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <PaymentElement />
      {error && (
        <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>
      )}
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full"
      >
        {loading ? 'Processing...' : `Pay $${amount}`}
      </Button>
    </form>
  );
}

export function PaymentForm({ plan, amount }: PaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string>();

  useEffect(() => {
    // Initialize payment intent when component mounts
    fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        plan,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        }
      });
  }, [amount, plan]);

  if (!clientSecret) {
    return <div>Loading...</div>;
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#3b82f6',
          },
        },
      }}
    >
      <CheckoutForm plan={plan} amount={amount} />
    </Elements>
  );
} 