"use client";
import React, { useState, ReactNode, Suspense } from "react";
import { Sidebar, SidebarBody, SidebarLink, SidebarSection } from "./sidebar";

import {
  LayoutDashboard,
  Users,
  UserPlus,
  Mail,
  DollarSign,
  FolderOpen,
  Receipt,
  Globe,
  BarChart3,
  Clock,
  Calendar,
  MessageCircle,
  User,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Target,
  Zap,
  TrendingUp,
  Megaphone,
  Bot,
  Share2,
  Search,
  BarChart,
  Activity,
  Bell,
  RefreshCw,
  CheckSquare
} from "lucide-react";
import type { LucideIcon } from 'lucide-react';
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Dashboard } from "./dashboard";
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/lib/notification-context';
import { NotificationsSidebar } from './notifications-sidebar';
import { NotificationPopup } from './notification-popup';

interface SidebarDemoProps {
  children?: ReactNode;
}

interface Links {
  label: string;
  href: string;
  icon: React.ReactNode;
  onClick?: () => Promise<void>;
  notificationCount?: number;
  highlight?: boolean;
}

export function SidebarDemo({ children }: SidebarDemoProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { totalUnread } = useNotifications();
  const userRole = user ? (user as any)?.app_metadata?.role : undefined;
  const isAdmin = userRole === "admin" || userRole === "Administrator";

  // Debug log for notifications
  React.useEffect(() => {
    console.log('SidebarDemo: Total unread messages:', totalUnread);
  }, [totalUnread]);

  const handleLogout = async () => {
    try {
      // Clear all auth-related cookies
      document.cookie = 'sb-jbspiufukrifntnwlrts-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'sb-jbspiufukrifntnwlrts-auth-token-code-verifier=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'next-auth.session-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      // Also try Supabase signOut if available
      try {
        await signOut();
      } catch (error) {
        console.log('Supabase signOut failed, but continuing with logout:', error);
      }
      
      // Force redirect to login
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout fails
      window.location.href = '/login';
    }
  };

  // Define menu sections with submenus
  const menuSections = [
    {
      label: user?.user_metadata?.full_name ? `Dashboard (${user.user_metadata.full_name.split(' ')[0]})` : "Dashboard",
      icon: <LayoutDashboard className="text-foreground h-5 w-5 flex-shrink-0" />,
      items: [
        {
          label: "Overview",
          href: "/dashboard",
          icon: <BarChart3 className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Analytics",
          href: "/analytics",
          icon: <TrendingUp className="text-foreground h-4 w-4 flex-shrink-0" />
        }
      ]
    },
    {
      label: "CRM",
      icon: <Users className="text-foreground h-5 w-5 flex-shrink-0" />,
      items: [
        {
          label: "Customers",
          href: "/customers",
          icon: <Users className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Leads",
          href: "/leads",
          icon: <UserPlus className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Gmail Hub",
          href: "/gmail-hub",
          icon: <Mail className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Sales",
          href: "/sales",
          icon: <DollarSign className="text-foreground h-4 w-4 flex-shrink-0" />
        }
      ]
    },
    {
      label: "Finance",
      icon: <CreditCard className="text-foreground h-5 w-5 flex-shrink-0" />,
      items: [

        {
          label: "Invoices",
          href: "/invoices",
          icon: <Receipt className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Recurring Invoices",
          href: "/invoices/recurring",
          icon: <RefreshCw className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Invoice Reminders",
          href: "/invoices/reminders",
          icon: <Bell className="text-foreground h-4 w-4 flex-shrink-0" />
        },


      ]
    },
    {
      label: "Project Management",
      icon: <FolderOpen className="text-foreground h-5 w-5 flex-shrink-0" />,
      items: [
        {
          label: "Projects",
          href: "/projects",
          icon: <FolderOpen className="text-foreground h-4 w-4 flex-shrink-0" />
        }
      ]
    },
    {
      label: "Marketing",
      icon: <Megaphone className="text-foreground h-5 w-5 flex-shrink-0" />,
      items: [
        {
          label: "Overview",
          href: "/marketing",
          icon: <BarChart3 className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Email Marketing",
          href: "/email-marketing",
          icon: <Mail className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Social Media",
          href: "/social-media",
          icon: <Share2 className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Google Analytics",
          href: "/analytics",
          icon: <BarChart className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Search Console",
          href: "/marketing",
          icon: <Search className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Domains",
          href: "/domains",
          icon: <Globe className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Content Generator",
          href: "/content-generator",
          icon: <FileText className="text-foreground h-4 w-4 flex-shrink-0" />
        }
      ]
    },
    {
      label: "Automation",
      icon: <Bot className="text-foreground h-5 w-5 flex-shrink-0" />,
      items: [
        {
          label: "Scheduled Tasks",
          href: "/settings/cron",
          icon: <Clock className="text-foreground h-4 w-4 flex-shrink-0" />
        }
      ]
    }
  ];

  // Standalone menu items (no submenus)
  const standaloneLinks = [
    {
      label: "Calendar",
      href: "/calendar",
      icon: <Calendar className="text-foreground h-5 w-5 flex-shrink-0" />,
    },
    {
      label: "Analytics & Notifications",
      href: "/notifications",
      icon: <Bell className="text-foreground h-5 w-5 flex-shrink-0" />,
      notificationCount: totalUnread > 0 ? totalUnread : undefined,
    },
    {
      label: "Chat",
      href: "/chat",
      icon: <MessageCircle className="text-foreground h-5 w-5 flex-shrink-0" />,
    },
    {
      label: "Profile",
      href: "/profile",
      icon: <User className="text-foreground h-5 w-5 flex-shrink-0" />,
    }
  ];

  // Bottom menu sections
  const bottomSections = [
    {
      label: "Settings",
      icon: <Settings className="text-foreground h-5 w-5 flex-shrink-0" />,
      items: [
        {
          label: "General",
          href: "/settings",
          icon: <Settings className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Team",
          href: "/settings/team",
          icon: <Users className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Integrations",
          href: "/settings/integrations",
          icon: <Zap className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Workspaces",
          href: "/settings/workspaces",
          icon: <FolderOpen className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Billing & Subscription",
          href: "/settings/billing",
          icon: <CreditCard className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "System Status",
          href: "/status",
          icon: <Activity className="text-foreground h-4 w-4 flex-shrink-0" />
        }
      ]
    },
    {
      label: "Legal",
      icon: <FileText className="text-foreground h-5 w-5 flex-shrink-0" />,
      items: [
        {
          label: "Privacy Policy",
          href: "/privacy-policy",
          icon: <FileText className="text-foreground h-4 w-4 flex-shrink-0" />
        },
        {
          label: "Terms of Service",
          href: "/terms-of-service",
          icon: <FileText className="text-foreground h-4 w-4 flex-shrink-0" />
        }
      ]
    }
  ];

  const logoutLink = {
    label: "Logout",
    href: "#",
    icon: <LogOut className="text-foreground h-5 w-5 flex-shrink-0" />,
    onClick: handleLogout,
  };

  const [open, setOpen] = useState(false);
  return (
    <div className={cn("flex flex-col md:flex-row w-full h-screen bg-background")}>
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-4">
          <div className="flex flex-col flex-1">
            {open ? <Logo /> : <LogoIcon />}
            <nav className="mt-8 flex flex-col gap-2 overflow-y-auto max-h-[60vh] md:max-h-none">
              {/* Menu Sections with Submenus */}
              {menuSections.map((section, idx) => (
                <SidebarSection key={idx} section={section} />
              ))}
              
              {/* Standalone Links */}
              <div className="mt-4 space-y-1">
                {standaloneLinks.map((link, idx) => (
                  <SidebarLink key={idx} link={link} />
                ))}
              </div>
            </nav>
          </div>
          <div className="space-y-2">
            {/* Bottom Sections */}
            {bottomSections.map((section, idx) => (
              <SidebarSection key={idx} section={section} />
            ))}
            
            {/* Logout */}
            <SidebarLink link={logoutLink} />
            
            <div className="flex items-center justify-start gap-2 py-2 cursor-pointer">
              <NotificationsSidebar />
              <ThemeToggle />
            </div>
            <SidebarLink
              link={{
                label: user?.user_metadata?.full_name || "User",
                href: "/profile",
                icon: (
                  <div className="h-7 w-7 flex-shrink-0 rounded-full bg-background flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
      <main className="flex-1 flex flex-col bg-background overflow-y-auto">
        {children || (
          <div className="p-6 flex-1 flex flex-col">
            <div className="rounded-xl border border-border bg-background flex flex-col gap-2 flex-1 w-full">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-400 border-t-gray-900 dark:border-t-white"></div>
                </div>
              }>
                <Dashboard />
              </Suspense>
            </div>
          </div>
        )}
        <NotificationPopup />
      </main>
    </div>
  );
}

export const Logo = () => {
  return (
    <Link
      href="/"
      className="font-normal flex items-center text-sm text-foreground pl-1 py-1 relative z-20 w-full"
    >
      <div className="relative w-[160px] h-[40px] -ml-1">
        <Image
          src="/Solvify-logo-WTE.png"
          alt="Solvify Logo"
          fill
          sizes="160px"
          priority
          className="object-contain object-left"
        />
      </div>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <Link
      href="/"
      className="font-normal flex items-center text-sm text-foreground px-2 py-1 relative z-20 w-full"
    >
      <div className="relative w-[40px] h-[40px]">
        <Image
          src="/S-logo.png"
          alt="Solvify Icon"
          fill
          sizes="40px"
          priority
          className="object-contain object-left"
        />
      </div>
    </Link>
  );
};