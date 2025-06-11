'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the correct page
    router.replace('/auth/forgot-password');
  }, [router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
      <div className="text-center text-foreground">
        <h2 className="text-2xl font-bold mb-4">Redirecting...</h2>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
      </div>
    </div>
  );
} 