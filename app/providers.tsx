"use client"

import { SessionProvider } from "next-auth/react"
import { ToastProvider } from "@/components/ui/toast"
import { Toaster } from "sonner"
import { AnimatePresence } from "framer-motion"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
        <Toaster richColors position="top-right" />
      </ToastProvider>
    </SessionProvider>
  )
} 