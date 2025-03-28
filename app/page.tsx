"use client"

import { SidebarDemo } from "@/components/ui/code.demo";
import { WelcomeDialog } from "@/components/ui/welcome-dialog";
import { useSession } from "next-auth/react";
import { Suspense } from 'react';
import { SuccessMessage } from '@/components/ui/success-message';
import { useSearchParams } from 'next/navigation';

export default function Home() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const searchParams = useSearchParams();
  const showSuccess = searchParams?.get('success') === 'true';

  return (
    <main className="w-full h-screen">
      <SidebarDemo />
      {isAuthenticated && <WelcomeDialog />}
      {showSuccess && <SuccessMessage />}
    </main>
  );
} 