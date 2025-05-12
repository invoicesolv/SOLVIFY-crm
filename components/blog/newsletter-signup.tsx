'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const response = await fetch('/api/newsletter-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        setMessage(data.message || 'Thank you for subscribing!');
        setEmail('');
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError('Failed to subscribe. Please try again later.');
      console.error('Newsletter signup error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="newsletter-signup">
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <div className="relative">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email address"
            disabled={loading || success}
            className={`w-full ${error ? 'border-red-500' : ''}`}
            required
          />
        </div>
        
        {error && (
          <div className="text-red-500 flex items-center text-sm">
            <AlertCircle className="h-4 w-4 mr-1" />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="text-green-500 flex items-center text-sm">
            <CheckCircle className="h-4 w-4 mr-1" />
            <span>{message}</span>
          </div>
        )}
        
        <Button 
          type="submit" 
          disabled={loading || success || !email}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Subscribing...
            </>
          ) : success ? 'Subscribed!' : 'Subscribe'}
        </Button>
      </form>
    </div>
  );
} 