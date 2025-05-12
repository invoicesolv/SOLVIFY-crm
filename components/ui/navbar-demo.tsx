import { Home, Sparkles, CreditCard, Phone, LogIn, RefreshCw, Globe, BookOpen } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavBarDemoProps {
  lang?: 'en' | 'sv'
}

export function NavBarDemo({ lang = 'en' }: NavBarDemoProps) {
  const pathname = usePathname()
  const isSwedish = lang === 'sv'
  
  // Base navigation items - public items first, then items requiring login
  const navItemsEn = [
    { name: 'Home', url: isSwedish ? '/sv' : '/', icon: Home },
    { name: 'Features', url: '#features', icon: Sparkles },
    { name: 'Replace', url: '#features', icon: RefreshCw },
    { name: 'Blog', url: '/blog', icon: BookOpen },
    { name: 'Pricing', url: '#pricing', icon: CreditCard },
    { name: 'Contact', url: '#contact', icon: Phone },
    { name: 'Login', url: '/login', icon: LogIn }
  ]
  
  const navItemsSv = [
    { name: 'Hem', url: '/sv', icon: Home },
    { name: 'Funktioner', url: '#features', icon: Sparkles },
    { name: 'Ersätter', url: '#features', icon: RefreshCw },
    { name: 'Blogg', url: '/blog/sv', icon: BookOpen },
    { name: 'Priser', url: '#pricing', icon: CreditCard },
    { name: 'Kontakt', url: '#contact', icon: Phone },
    { name: 'Logga in', url: '/login', icon: LogIn }
  ]
  
  // Add language switcher with appropriate redirection
  const targetPath = isSwedish ? '/' : '/sv'
  
  // Create standard nav items
  const currentNavItems = isSwedish ? navItemsSv : navItemsEn
  
  // Use actual flag emoji in the name
  const flagEmoji = isSwedish ? '🇺🇸' : '🇸🇪'
  
  // Add language switcher with flag emoji
  const itemsWithLanguageSwitcher = [
    ...currentNavItems,
    {
      name: flagEmoji,  // Use the emoji as the name so it shows in desktop mode
      url: targetPath,
      icon: Globe       // Use standard Globe icon for mobile
    }
  ]

  return <NavBar items={itemsWithLanguageSwitcher} />
} 