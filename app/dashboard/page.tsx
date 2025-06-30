"use client"

import { SidebarDemo } from "@/components/ui/code.demo";
import { WelcomeDialog } from "@/components/ui/welcome-dialog";
import { useAuth } from "@/lib/auth-client";
import { Suspense } from 'react';
import { SuccessMessage } from '@/components/ui/success-message';
import { useSearchParams } from 'next/navigation';

function DashboardContent() {
  const { isAuthenticated, loading } = useAuth();
  const searchParams = useSearchParams();
  const showSuccess = searchParams?.get('success') === 'true';

  return (
    <>
      {isAuthenticated && <WelcomeDialog />}
      {showSuccess && <SuccessMessage />}
    </>
  );
}

export default function Dashboard() {
  return (
    <main className="w-full min-h-screen">
      <SidebarDemo />
      <Suspense fallback={null}>
        <DashboardContent />
      </Suspense>
    </main>
  );
} 