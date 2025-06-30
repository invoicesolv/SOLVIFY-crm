import { Home, Sparkles, CreditCard, Phone, LogIn, RefreshCw, Globe, BookOpen, MessageSquare, LayoutDashboard } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-client';

interface NavBarDemoProps {
  lang?: 'en' | 'sv'
}

export function NavBarDemo({ lang = 'en' }: NavBarDemoProps) {
  const pathname = usePathname()
  const { user } = useAuth()
  
  // Get user display name from metadata
  const userDisplayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0]
  
  // Navigation items - show Dashboard for logged-in users, Login for others
  const navItems = [
    { name: 'Home', url: '/', icon: Home },
    { name: 'Features', url: '#features', icon: Sparkles },
    { name: 'Replace', url: '#features', icon: RefreshCw },
    { name: 'Blog', url: '/blog', icon: BookOpen },
    { name: 'Pricing', url: '#pricing', icon: CreditCard },
    { name: 'Contact', url: '#contact', icon: Phone },
    // Show Dashboard if logged in, Login if not
    user 
      ? { name: userDisplayName ? `Dashboard (${userDisplayName.split(' ')[0]})` : 'Dashboard', url: '/dashboard', icon: LayoutDashboard }
      : { name: 'Login', url: '/login', icon: LogIn }
  ]

  return <NavBar items={navItems} />
} 