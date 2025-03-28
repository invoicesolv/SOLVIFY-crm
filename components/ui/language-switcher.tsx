"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useRouter, usePathname } from "next/navigation"

interface Language {
  code: string
  flag: string
  name: string
  path: string
}

const languages: Language[] = [
  {
    code: "sv",
    flag: "🇸🇪",
    name: "Svenska",
    path: "/sv",
  },
  {
    code: "en",
    flag: "🇺🇸",
    name: "English",
    path: "/landing",
  },
]

export function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedLang, setSelectedLang] = useState<Language | null>(null)

  useEffect(() => {
    // Set initial language based on current path
    const currentLang = languages.find(lang => pathname === lang.path) || languages[0]
    setSelectedLang(currentLang)
  }, [pathname])

  const handleLanguageChange = (lang: Language) => {
    setSelectedLang(lang)
    setIsOpen(false)
    router.push(lang.path)
  }

  if (!selectedLang) return null

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center rounded-full px-2 py-1.5 text-sm text-white/80 hover:text-white transition-colors"
      >
        <span className="text-lg">{selectedLang.flag}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 rounded-lg border border-white/10 bg-background/5 backdrop-blur-sm p-1 shadow-lg">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang)}
              className={cn(
                "flex w-full items-center rounded-md px-2 py-1.5 text-lg",
                selectedLang.code === lang.code ? "text-white" : "text-white/80 hover:text-white"
              )}
            >
              <span>{lang.flag}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
} 