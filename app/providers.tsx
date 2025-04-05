"use client"

import { SessionProvider } from "next-auth/react"
import { ToastProvider } from "@/components/ui/toast"
import { Toaster } from "sonner"
import { AnimatePresence } from "framer-motion"
import SupabaseSessionSync from "@/components/ui/SupabaseSessionSync"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <SupabaseSessionSync>
          <AnimatePresence mode="wait">
            {children}
          </AnimatePresence>
          <Toaster richColors position="top-right" />
        </SupabaseSessionSync>
      </ToastProvider>
    </SessionProvider>
  )
} 