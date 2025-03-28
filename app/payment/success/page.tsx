"use client";

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

function PaymentSuccessContent() {
  const [status, setStatus] = useState<'success' | 'processing' | 'error'>('processing');
  const searchParams = useSearchParams();
  const payment_intent = searchParams.get('payment_intent');
  const payment_intent_client_secret = searchParams.get('payment_intent_client_secret');

  useEffect(() => {
    if (payment_intent && payment_intent_client_secret) {
      // Verify the payment status
      fetch('/api/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_intent,
          payment_intent_client_secret,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'succeeded') {
            setStatus('success');
          } else {
            setStatus('error');
          }
        })
        .catch(() => {
          setStatus('error');
        });
    }
  }, [payment_intent, payment_intent_client_secret]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {status === 'processing' && (
          <>
            <h1 className="text-2xl font-bold text-white">Processing your payment...</h1>
            <p className="text-neutral-400">Please wait while we confirm your payment.</p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Payment Successful!</h1>
            <p className="text-neutral-400">Thank you for your purchase.</p>
            <Button asChild className="mt-8">
              <a href="/dashboard">Go to Dashboard</a>
            </Button>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Payment Failed</h1>
            <p className="text-neutral-400">There was an error processing your payment.</p>
            <Button asChild className="mt-8">
              <a href="/pricing">Try Again</a>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccess() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <h1 className="text-2xl font-bold text-white">Loading...</h1>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto" />
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
} 