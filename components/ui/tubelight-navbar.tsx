"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "@/components/ui/language-switcher"

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

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <nav
      className={cn(
        "fixed bottom-4 sm:top-4 left-1/2 -translate-x-1/2 z-40 w-auto pointer-events-none",
        className,
      )}
    >
      <div className="inline-flex items-center gap-3 bg-background/5 border border-white/10 backdrop-blur-sm py-1.5 px-2 rounded-full shadow-lg">
        <Link href="/" className="px-2 flex items-center pointer-events-auto">
          <div className="relative w-[100px] h-[32px] hidden md:block">
            <Image
              src="/Solvify-logo-WTE.png"
              alt="Solvify Logo"
              fill
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <div className="relative w-[28px] h-[28px] md:hidden">
            <Image
              src="/Solvify-logo-WTE.png"
              alt="Solvify Logo"
              fill
              style={{ objectFit: "contain" }}
              priority
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
                "text-white/80 hover:text-white",
                isActive && "bg-muted text-white",
              )}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="md:hidden">
                <Icon size={16} strokeWidth={2.5} />
              </span>
              {isActive && (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full bg-white/5 rounded-full -z-10"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-white rounded-t-full opacity-50">
                    <div className="absolute w-12 h-6 bg-white/20 rounded-full blur-md -top-2 -left-2" />
                    <div className="absolute w-8 h-6 bg-white/20 rounded-full blur-md -top-1" />
                    <div className="absolute w-4 h-4 bg-white/20 rounded-full blur-sm top-0 left-2" />
                  </div>
                </motion.div>
              )}
            </Link>
          )
        })}
        <div className="pointer-events-auto">
          <LanguageSwitcher />
        </div>
      </div>
    </nav>
  )
} 