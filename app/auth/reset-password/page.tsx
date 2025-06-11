'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(true);
  const [supabaseSession, setSupabaseSession] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // Validate the reset password session
  useEffect(() => {
    let hasRun = false; // Prevent multiple executions
    
    async function validateSession() {
      if (hasRun) return;
      hasRun = true;
      
      try {
        setIsValidating(true);
        
        // First, check if we're coming from an email link with hash parameters
        const hash = window.location.hash;
        console.log('Reset password page - Full URL:', window.location.href);
        console.log('Reset password page - URL hash:', hash);
        
        // Check for error in URL hash first
        if (hash.includes('error=')) {
          const urlParams = new URLSearchParams(hash.substring(1));
          const error = urlParams.get('error');
          const errorDescription = urlParams.get('error_description');
          
          console.log('Error in URL:', { error, errorDescription });
          
          if (error === 'access_denied' && errorDescription?.includes('expired')) {
            setError('The password reset link has expired. Please request a new password reset link.');
            return;
          } else if (error) {
            setError('Invalid password reset link. Please request a new password reset link.');
            return;
          }
        }
        
        // Check for auth tokens in hash
        if (hash && (hash.includes('access_token') || hash.includes('refresh_token'))) {
          console.log('Found auth tokens in URL hash');
          
          // Parse the hash parameters
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const tokenType = hashParams.get('token_type');
          const type = hashParams.get('type');
          
          console.log('Token details:', { 
            accessToken: accessToken ? 'present' : 'missing',
            refreshToken: refreshToken ? 'present' : 'missing',
            tokenType,
            type
          });
          
          // Check if this is specifically a recovery/password reset token
          if (type === 'recovery' && accessToken) {
            console.log('This is a password recovery token');
            
            try {
              // Set the session with the recovery tokens
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
              });
              
              if (error) {
                console.error('Error setting session with recovery token:', error);
                setError('Invalid or expired reset token. Please request a new password reset link.');
                return;
              }
              
              if (data.session) {
                console.log('Recovery session established successfully');
                console.log('Session details:', {
                  userId: data.session.user?.id,
                  email: data.session.user?.email,
                  accessToken: data.session.access_token ? 'present' : 'missing',
                  expiresAt: data.session.expires_at
                });
                
                setSupabaseSession(data.session);
                setValidSession(true);
                
                // Clear the hash from URL to prevent reuse
                window.history.replaceState(null, '', window.location.pathname);
                return;
              }
            } catch (sessionError) {
              console.error('Session error:', sessionError);
              setError('Failed to establish reset session. Please request a new password reset link.');
              return;
            }
          }
        }
        
        // Check for existing session (fallback)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting existing session:', sessionError);
          setError('Unable to validate reset session. Please request a new password reset link.');
          return;
        }
        
        if (sessionData.session) {
          console.log('Found existing valid session');
          setSupabaseSession(sessionData.session);
          setValidSession(true);
          return;
        }
        
        // No valid session or tokens found
        console.log('No valid session or recovery tokens found');
        setError('No reset token found. Please request a new password reset link.');
        
      } catch (error) {
        console.error('Error validating session:', error);
        setError('An error occurred. Please try again or request a new password reset link.');
      } finally {
        setIsValidating(false);
      }
    }

    // Add a small delay to ensure the page is fully loaded
    const timer = setTimeout(validateSession, 100);
    
    return () => {
      clearTimeout(timer);
    };
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
      console.log('Attempting to update password...');
      
      // Double-check we have a valid session before attempting password update
      const { data: currentSession, error: sessionCheckError } = await supabase.auth.getSession();
      
      if (sessionCheckError || !currentSession.session) {
        console.error('No valid session for password update:', sessionCheckError);
        
        // Try to re-establish session if we have stored session data
        if (supabaseSession) {
          console.log('Attempting to re-establish session...');
          const { data: reestablishedSession, error: reestablishError } = await supabase.auth.setSession({
            access_token: supabaseSession.access_token,
            refresh_token: supabaseSession.refresh_token || ''
          });
          
          if (reestablishError || !reestablishedSession.session) {
            console.error('Failed to re-establish session:', reestablishError);
            throw new Error('Session expired. Please request a new password reset link.');
          }
          
          console.log('Session re-established successfully');
        } else {
          throw new Error('Auth session missing! Please request a new password reset link.');
        }
      }
      
      console.log('Valid session confirmed, updating password...');
      
      const { error } = await supabase.auth.updateUser({
        password: password
      });
      
      if (error) {
        console.error('Password update error:', error);
        throw new Error(error.message);
      }
      
      console.log('Password updated successfully');
      toast.success('Password reset successful! Redirecting to login...');
      
      // Sign out to clear the session
      await supabase.auth.signOut();
      
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };
  
  if (isValidating) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 shadow-lg">
          <h1 className="mb-6 text-center text-2xl font-semibold">Validating Reset Link...</h1>
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Please wait while we verify your password reset link...
          </p>
        </Card>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 shadow-lg">
          <h1 className="mb-6 text-center text-2xl font-semibold">Password Reset Error</h1>
          <p className="mb-6 text-center text-red-600 dark:text-red-400">{error}</p>
          <div className="flex flex-col gap-3">
            <Link href="/auth/forgot-password">
              <Button className="w-full">Request New Reset Link</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="w-full">Return to Login</Button>
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
          <Link href="/login" className="text-primary hover:underline">
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