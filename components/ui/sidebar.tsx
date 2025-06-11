"use client";

import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ChevronDown, ChevronRight } from "lucide-react";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
  onClick?: () => void;
  notificationCount?: number;
  highlight?: boolean;
}

interface SubMenuItem {
  label: string;
  href: string;
  icon?: React.JSX.Element | React.ReactNode;
  notificationCount?: number;
  highlight?: boolean;
}

interface MenuSection {
  label: string;
  icon: React.JSX.Element | React.ReactNode;
  items: SubMenuItem[];
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "h-full px-4 py-4 hidden md:flex md:flex-col bg-background w-[300px] flex-shrink-0 border-r border-border",
        className
      )}
      animate={{
        width: animate ? (open ? "300px" : "60px") : "300px",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-background w-full border-b border-border"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-foreground cursor-pointer"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-background p-10 z-[100] flex flex-col justify-between overflow-y-auto",
                className
              )}
            >
              <div
                className="absolute right-10 top-10 z-50 text-foreground cursor-pointer"
                onClick={() => setOpen(!open)}
              >
                <X />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
  props?: LinkProps;
}) => {
  const { open, animate } = useSidebar();
  
  const content = (
    <>
      <div className="relative">
        <div className="h-3.5 w-3.5 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
          {link.icon}
        </div>
        {link.notificationCount ? (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-1">
            {link.notificationCount}
          </div>
        ) : null}
      </div>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-muted-foreground text-xs group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        {link.label}
      </motion.span>
    </>
  );

  const sharedClassName = cn(
    "flex items-center justify-start gap-2 group group/sidebar py-1.5 px-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors",
    link.highlight && "relative after:absolute after:inset-0 after:bg-red-500/10 after:rounded-lg after:border after:border-red-500/20",
    className
  );

  return link.onClick ? (
    <div onClick={link.onClick} className={sharedClassName} {...props}>
      {content}
    </div>
  ) : (
    <Link href={link.href} className={sharedClassName} {...props}>
      {content}
    </Link>
  );
};

export const SidebarSection = ({
  section,
  className,
}: {
  section: MenuSection;
  className?: string;
}) => {
  const { open, animate } = useSidebar();
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    if (open) {
      setIsExpanded(!isExpanded);
    }
  };

  // Auto-expand when sidebar opens if it was previously expanded
  React.useEffect(() => {
    if (!open) {
      setIsExpanded(false);
    }
  }, [open]);

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors group",
          className
        )}
      >
        <div className="flex items-center gap-2">
          <div className="relative h-3.5 w-3.5 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
            {section.icon}
          </div>
          <motion.span
            animate={{
              display: animate ? (open ? "inline-block" : "none") : "inline-block",
              opacity: animate ? (open ? 1 : 0) : 1,
            }}
            className="text-muted-foreground text-xs whitespace-pre inline-block !p-0 !m-0"
          >
            {section.label}
          </motion.span>
        </div>
        {open && (
          <motion.div
            animate={{
              rotate: isExpanded ? 90 : 0,
            }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="h-3 w-3" />
          </motion.div>
        )}
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-6 space-y-0.5 border-l border-sidebar-border pl-2">
              {section.items.map((item, index) => (
                <Link
                  key={index}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors group",
                    item.highlight && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <div className="relative h-3 w-3 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                    {item.icon}
                    {item.notificationCount ? (
                      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[12px] h-3 flex items-center justify-center px-0.5">
                        {item.notificationCount}
                      </div>
                    ) : null}
                  </div>
                  <motion.span
                    animate={{
                      display: animate ? (open ? "inline-block" : "none") : "inline-block",
                      opacity: animate ? (open ? 1 : 0) : 1,
                    }}
                    className="text-muted-foreground text-xs whitespace-pre inline-block !p-0 !m-0"
                  >
                    {item.label}
                  </motion.span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}; 