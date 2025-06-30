"use client"

import { ToastProvider } from "@/components/ui/toast"
import { Toaster } from "sonner"
import { AnimatePresence } from "framer-motion"
import { ChatWindow } from "@/components/ChatWindow"
import dynamic from "next/dynamic"
import { CustomerProvider } from './contexts/CustomerContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { NotificationProvider } from '@/lib/notification-context'
import { AuthProvider } from "@/lib/auth-client"

// Dynamically import the FortnoxNotification component with SSR disabled
const FortnoxNotification = dynamic(
  () => import("@/components/FortnoxNotification"),
  { ssr: false }
)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
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
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
