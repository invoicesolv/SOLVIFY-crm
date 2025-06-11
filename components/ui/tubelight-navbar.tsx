"use client"

import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { LucideIcon, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/ui/theme-toggle"

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
}

interface NavBarProps {
  items: NavItem[]
  className?: string
}

export function NavBar({ items, className }: NavBarProps) {
  const [activeTab, setActiveTab] = useState(items[0].name)
  const [isMobile, setIsMobile] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileMenuOpen && !(event.target as Element).closest('.mobile-menu')) {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMobileMenuOpen])

  return (
    <>
      {/* Desktop Navigation */}
      <nav
        className={cn(
          "fixed top-4 left-1/2 -translate-x-1/2 z-40 w-auto pointer-events-none hidden md:block",
          className,
        )}
      >
        <div className="inline-flex items-center gap-3 bg-background/5 border border-white/10 backdrop-blur-sm py-1.5 px-2 rounded-full shadow-lg">
          <Link href="/" className="px-2 flex items-center pointer-events-auto">
            <div className="w-7 h-7 relative">
              <Image 
                src="/S-logo.png" 
                alt="Solvify Logo" 
                fill 
                className="object-contain"
              />
            </div>
          </Link>
          {items.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.name

            return (
              <Link
                key={item.name}
                href={item.url}
                onClick={() => setActiveTab(item.name)}
                className={cn(
                  "relative cursor-pointer text-sm font-medium px-4 py-1.5 rounded-full transition-colors pointer-events-auto",
                  "text-foreground/80 hover:text-foreground",
                  isActive && "bg-muted text-foreground",
                )}
              >
                <span>{item.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="lamp"
                    className="absolute inset-0 w-full bg-background/5 rounded-full -z-10"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                  >
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-background rounded-t-full opacity-50">
                      <div className="absolute w-12 h-6 bg-background/20 rounded-full blur-md -top-2 -left-2" />
                      <div className="absolute w-8 h-6 bg-background/20 rounded-full blur-md -top-1" />
                      <div className="absolute w-4 h-4 bg-background/20 rounded-full blur-sm top-0 left-2" />
                    </div>
                  </motion.div>
                )}
              </Link>
            )
          })}
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 md:hidden">
        <div className="flex items-center justify-between p-4 bg-background/80 backdrop-blur-sm border-b border-border">
          <Link href="/" className="flex items-center">
            <div className="w-8 h-8 relative">
              <Image 
                src="/S-logo.png" 
                alt="Solvify Logo" 
                fill 
                className="object-contain"
              />
            </div>
            <span className="ml-2 text-lg font-bold text-foreground">Solvify</span>
          </Link>
          
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg bg-background/50 border border-border hover:bg-background/80 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X size={24} className="text-foreground" />
            ) : (
              <Menu size={24} className="text-foreground" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Sidebar Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            
            {/* Sidebar */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="mobile-menu fixed top-0 right-0 h-full w-80 bg-background border-l border-border z-50 md:hidden"
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                  <div className="flex items-center">
                    <div className="w-8 h-8 relative">
                      <Image 
                        src="/S-logo.png" 
                        alt="Solvify Logo" 
                        fill 
                        className="object-contain"
                      />
                    </div>
                    <span className="ml-2 text-lg font-bold text-foreground">Solvify</span>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X size={20} className="text-foreground" />
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 py-6">
                  {items.map((item, index) => {
                    const Icon = item.icon
                    const isActive = activeTab === item.name

                    return (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Link
                          href={item.url}
                          onClick={() => {
                            setActiveTab(item.name)
                            setIsMobileMenuOpen(false)
                          }}
                          className={cn(
                            "flex items-center gap-3 px-6 py-4 text-foreground hover:bg-muted transition-colors",
                            isActive && "bg-muted border-r-2 border-primary"
                          )}
                        >
                          <Icon size={20} />
                          <span className="text-base font-medium">{item.name}</span>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Footer with Theme Toggle */}
                <div className="p-6 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Theme</span>
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
} 