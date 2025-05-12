'use client';

import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Link from 'next/link';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to request password reset');
      }
      
      setSubmitted(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 shadow-lg">
          <div className="mb-6 flex justify-center">
            <Image src="/logo.png" alt="Logo" width={150} height={40} />
          </div>
          <h1 className="mb-4 text-center text-2xl font-semibold">Check Your Email</h1>
          <p className="mb-6 text-center">
            If an account exists with the email <strong>{email}</strong>, we've sent a link to reset your password.
          </p>
          <p className="mb-8 text-center text-sm text-muted-foreground">
            Please check your spam folder if you don't see the email in your inbox.
          </p>
          <div className="flex justify-center">
            <Link href="/auth/signin">
              <Button>Return to Login</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 shadow-lg">
        <div className="mb-6 flex justify-center">
          <Image src="/logo.png" alt="Logo" width={150} height={40} />
        </div>
        <h1 className="mb-4 text-center text-2xl font-semibold">Forgot Password</h1>
        <p className="mb-6 text-center">
          Enter your email address and we'll send you a link to reset your password.
        </p>
        <form onSubmit={handleForgotPassword}>
          <div className="mb-6 space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full"
              required
            />
          </div>
          <Button 
            type="submit" 
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          <Link href="/auth/signin" className="text-primary hover:underline">
            Return to Login
          </Link>
        </div>
      </Card>
    </div>
  );
} 