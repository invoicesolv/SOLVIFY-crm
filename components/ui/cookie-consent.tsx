"use client";

import { useState, useEffect } from 'react';
import { X, Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const hasConsented = localStorage.getItem('cookieConsent');
    if (!hasConsented) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto md:max-w-lg">
      <Card className="bg-background border-border shadow-lg">
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Cookie className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-2">Cookie Consent</h3>
              <p className="text-sm text-muted-foreground mb-3">
                We use cookies to enhance your experience, analyze site traffic, and serve personalized content. 
                By continuing to use our site, you consent to our use of cookies.
              </p>
              <div className="flex items-center gap-2 text-xs">
                <Link 
                  href="/privacy-policy#cookies" 
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  Learn more
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link 
                  href="/privacy-policy" 
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  Privacy Policy
                </Link>
              </div>
            </div>
            <button
              onClick={handleDecline}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDecline}
              className="flex-1"
            >
              Decline
            </Button>
            <Button
              size="sm"
              onClick={handleAccept}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Accept All
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
} 