"use client"

import { SessionProvider } from "next-auth/react"
import { ToastProvider } from "@/components/ui/toast"
import { Toaster } from "sonner"
import { AnimatePresence } from "framer-motion"
import SupabaseSessionSync from "@/components/ui/SupabaseSessionSync"
import { ChatWindow } from "@/components/ChatWindow"
import dynamic from "next/dynamic"
import { CustomerProvider } from './contexts/CustomerContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { NotificationProvider } from '@/lib/notification-context'

// Dynamically import the FortnoxNotification component with SSR disabled
const FortnoxNotification = dynamic(
  () => import("@/components/FortnoxNotification"),
  { ssr: false }
)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
      <ToastProvider>
        <SupabaseSessionSync>
          <NotificationProvider>
            <AnimatePresence mode="wait">
              <CustomerProvider>
                {children}
              </CustomerProvider>
            </AnimatePresence>
            <Toaster richColors position="top-right" />
            <ChatWindow />
            <FortnoxNotification />
          </NotificationProvider>
        </SupabaseSessionSync>
      </ToastProvider>
      </ThemeProvider>
    </SessionProvider>
  )
} 