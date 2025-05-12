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
  // Disable the language switcher to avoid conflict with NavBarDemo
  return null;
} 