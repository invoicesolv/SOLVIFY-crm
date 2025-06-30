"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { 
  Mail, 
  Users, 
  Layout, 
  Settings, 
  Zap,
  BarChart3,
  Send
} from 'lucide-react';

const navigationItems = [
  {
    name: 'Overview',
    href: '/email-marketing',
    icon: BarChart3,
    description: 'Dashboard and analytics'
  },
  {
    name: 'Campaigns',
    href: '/email-marketing/campaigns',
    icon: Send,
    description: 'Create and manage campaigns'
  },
  {
    name: 'Templates',
    href: '/email-marketing/templates',
    icon: Layout,
    description: 'Email templates'
  },
  {
    name: 'Contacts',
    href: '/email-marketing/contacts',
    icon: Users,
    description: 'Manage contact lists'
  },
  {
    name: 'Automation',
    href: '/email-marketing/automation',
    icon: Zap,
    description: 'Automated workflows'
  },
  {
    name: 'Settings',
    href: '/email-marketing/settings',
    icon: Settings,
    description: 'Email settings'
  }
];

export function EmailMarketingNav() {
  const pathname = usePathname();

  return (
    <div className="border-b bg-background">
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center space-x-1">
          <Mail className="h-5 w-5 text-primary mr-3" />
          <h2 className="text-lg font-semibold mr-6">Email Marketing</h2>
          
          <nav className="flex items-center space-x-1">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/email-marketing' && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
} 