import { Home, Sparkles, CreditCard, Phone, LogIn } from 'lucide-react'
import { NavBar } from "@/components/ui/tubelight-navbar"

export function NavBarDemo() {
  const navItems = [
    { name: 'Home', url: '#', icon: Home },
    { name: 'Features', url: '#features', icon: Sparkles },
    { name: 'Pricing', url: '#pricing', icon: CreditCard },
    { name: 'Contact', url: '#contact', icon: Phone },
    { name: 'Login', url: '/login', icon: LogIn }
  ]

  return <NavBar items={navItems} />
} 