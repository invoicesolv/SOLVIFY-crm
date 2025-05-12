'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Validate the reset password session
  useEffect(() => {
    async function validateSession() {
      try {
        // Get hash fragment from URL which contains the access token
        const hash = window.location.hash;
        if (!hash) {
          setError('No reset token found. Please request a new password reset link.');
          return;
        }

        // Attempt to use the recovery token (Supabase will validate it)
        const { data, error } = await supabase.auth.getSession();
        
        if (error || !data.session) {
          setError('Invalid or expired reset token. Please request a new password reset link.');
          return;
        }
        
        setValidSession(true);
      } catch (error) {
        setError('An error occurred. Please try again or request a new password reset link.');
      }
    }

    validateSession();
  }, []);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }
      
      toast.success('Password reset successful');
      
      // Redirect to login
      setTimeout(() => {
        router.push('/auth/signin');
      }, 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };
  
  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 shadow-lg">
          <div className="mb-6 flex justify-center">
            <Image src="/logo.png" alt="Logo" width={150} height={40} />
          </div>
          <h1 className="mb-6 text-center text-2xl font-semibold">Password Reset Error</h1>
          <p className="mb-4 text-center text-red-500">{error}</p>
          <div className="flex justify-center">
            <Link href="/auth/signin">
              <Button>Return to Login</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }
  
  if (!validSession) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 shadow-lg">
          <div className="mb-6 flex justify-center">
            <Image src="/logo.png" alt="Logo" width={150} height={40} />
          </div>
          <h1 className="mb-6 text-center text-2xl font-semibold">Validating Reset Link...</h1>
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
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
        <h1 className="mb-6 text-center text-2xl font-semibold">Reset Your Password</h1>
        <form onSubmit={handlePasswordReset}>
          <div className="mb-4 space-y-2">
            <label htmlFor="password" className="block text-sm font-medium">
              New Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your new password"
              className="w-full"
              required
              minLength={8}
            />
          </div>
          <div className="mb-6 space-y-2">
            <label htmlFor="confirmPassword" className="block text-sm font-medium">
              Confirm New Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              className="w-full"
              required
              minLength={8}
            />
          </div>
          <Button 
            type="submit" 
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Resetting Password...' : 'Reset Password'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 shadow-lg">
          <div className="mb-6 flex justify-center">
            <Image src="/logo.png" alt="Logo" width={150} height={40} />
          </div>
          <h1 className="mb-6 text-center text-2xl font-semibold">Loading...</h1>
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
          </div>
        </Card>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
} 