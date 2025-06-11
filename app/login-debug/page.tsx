'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginDebug() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      console.log(`Attempting to sign in with email: ${email}`);
      
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });
      
      console.log('Sign in result:', result);
      
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess('Login successful! Redirecting...');
        setTimeout(() => {
          router.push('/');
        }, 1500);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-background p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-foreground mb-6">Debug Login</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-200">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded text-green-200">
            {success}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground dark:text-neutral-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-gray-200 dark:bg-muted border border-gray-400 dark:border-border rounded-md text-foreground"
              placeholder="Enter your email"
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground dark:text-neutral-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-gray-200 dark:bg-muted border border-gray-400 dark:border-border rounded-md text-foreground"
              placeholder="Enter your password"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-foreground font-medium rounded-md transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
          
          <div className="text-sm text-muted-foreground mt-2">
            <p>This is a debug login page to help troubleshoot session issues.</p>
            <p className="mt-2">Try using your regular credentials to test the authentication flow.</p>
          </div>
        </form>
        
        <div className="mt-4 pt-4 border-t border-border dark:border-border">
          <p className="text-muted-foreground text-sm">
            Remember to check browser console for debugging information.
          </p>
        </div>
      </div>
    </div>
  );
} 