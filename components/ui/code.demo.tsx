"use client";
import React, { useState, ReactNode } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { LayoutDashboard, UserCog, Settings, LogOut, User, Users, FolderKanban, LineChart, Calendar, Receipt, Globe, Calculator, ShieldAlert, Clock, Star, FolderOpen } from "lucide-react";
import type { LucideIcon } from 'lucide-react';
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Dashboard } from "./dashboard";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';

interface SidebarDemoProps {
  children?: ReactNode;
}

interface Links {
  label: string;
  href: string;
  icon: React.ReactNode;
  onClick?: () => Promise<void>;
}

export function SidebarDemo({ children }: SidebarDemoProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "Administrator";

  const handleLogout = async () => {
    await signOut({ 
      redirect: true,
      callbackUrl: "/login"
    });
  };

  const links = [
    {
      label: "Today's Agenda",
      href: "/?view=agenda",
      icon: <Star className="h-5 w-5 text-neutral-400" />,
    },
    {
      label: "Dashboard",
      href: "/",
      icon: <LayoutDashboard className="h-5 w-5 text-neutral-400" />,
    },
    {
      label: "Customers",
      href: "/customers",
      icon: <Users className="h-5 w-5 text-neutral-400" />,
    },
    {
      label: "Projects",
      href: "/projects",
      icon: <FolderKanban className="h-5 w-5 text-neutral-400" />,
    },
    {
      label: "Invoices",
      href: "/invoices",
      icon: <Receipt className="h-5 w-5 text-neutral-400" />,
    },
    {
      label: "Receipts",
      href: "/receipts",
      icon: <Receipt className="h-5 w-5 text-neutral-400" />,
    },
    {
      label: "Transactions",
      href: "/transactions",
      icon: <Calculator className="h-5 w-5 text-neutral-400" />,
    },
    {
      label: "Domains",
      href: "/domains",
      icon: <Globe className="h-5 w-5 text-neutral-400" />,
    },
    {
      label: "Search Console",
      href: "/marketing",
      icon: <LineChart className="h-5 w-5 text-neutral-400" />,
    },
    {
      label: "Analytics",
      href: "/analytics",
      icon: <LineChart className="h-5 w-5 text-neutral-400" />,
    },
    {
      label: "Scheduled Tasks",
      href: "/settings/cron",
      icon: <Clock className="h-5 w-5 text-neutral-400" />,
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: <Calendar className="h-5 w-5 text-neutral-400" />,
    },
    {
      label: "Profile",
      href: "/profile",
      icon: <UserCog className="h-5 w-5 text-neutral-400" />,
    },
    ...(isAdmin ? [{
      label: "Admin",
      href: "/admin",
      icon: <ShieldAlert className="text-red-500 dark:text-red-400 h-5 w-5 flex-shrink-0" />,
    }] : []),
    {
      label: "Settings",
      href: "/settings",
      icon: <Settings className="h-5 w-5 text-neutral-400" />,
    },
    {
      label: "Logout",
      href: "#",
      icon: <LogOut className="h-5 w-5 text-neutral-400" />,
      onClick: handleLogout,
    },
  ];
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("flex flex-col md:flex-row w-full h-screen overflow-hidden bg-neutral-950")}>
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-4">
          <div className="flex flex-col flex-1">
            {open ? <Logo /> : <LogoIcon />}
            <nav className="mt-8 flex flex-col gap-2 overflow-y-auto no-scrollbar">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </nav>
          </div>
          <div>
            <SidebarLink
              link={{
                label: "Kevin Negash",
                href: "#",
                icon: (
                  <div className="h-7 w-7 flex-shrink-0 rounded-full bg-neutral-800 flex items-center justify-center">
                    <User className="h-4 w-4 text-neutral-400" />
                  </div>
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
      <main className="flex-1 overflow-y-auto bg-neutral-900">
        {children || (
          <div className="p-6">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 flex flex-col gap-2 flex-1 w-full h-full">
              <Dashboard />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export const Logo = () => {
  return (
    <Link
      href="/"
      className="font-normal flex items-center text-sm text-white pl-1 py-1 relative z-20 w-full"
    >
      <div className="relative w-[160px] h-[40px] -ml-1">
        <Image
          src="/Solvify-logo-WTE.png"
          alt="Solvify Logo"
          fill
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
      className="font-normal flex items-center text-sm text-white px-2 py-1 relative z-20 w-full"
    >
      <div className="relative w-[40px] h-[40px]">
        <Image
          src="/S-logo.png"
          alt="Solvify Icon"
          fill
          priority
          className="object-contain object-left"
        />
      </div>
    </Link>
  );
}; 