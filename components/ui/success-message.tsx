'use client';

import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function SuccessMessage() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    // Trigger confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    // Send welcome email
    fetch('/api/send-welcome-email', {
      method: 'POST',
    }).catch(console.error);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-foreground">🎉 Congratulations!</h2>
          <p className="text-foreground mb-6">
            Welcome to your premium subscription! We're excited to have you on board and can't wait to help you succeed.
          </p>
          <p className="text-sm text-foreground/80 mb-6">
            We've sent you a welcome email with some tips to get started.
          </p>
          <Button onClick={() => setOpen(false)} className="w-full">
            Get Started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 