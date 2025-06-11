import React from "react";
import { cn } from "@/lib/utils";

interface MockupFrameProps {
  children: React.ReactNode;
  className?: string;
  size?: "small" | "medium" | "large";
}

export function MockupFrame({
  children,
  className,
  size = "medium",
}: MockupFrameProps) {
  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden border border-border shadow-2xl",
        size === "small" && "max-w-md",
        size === "medium" && "max-w-2xl",
        size === "large" && "max-w-5xl",
        className
      )}
    >
      <div className="bg-background border-b border-border px-4 py-2 flex items-center gap-1.5">
        <div className="h-3 w-3 rounded-full bg-gray-200 dark:bg-muted" />
        <div className="h-3 w-3 rounded-full bg-gray-200 dark:bg-muted" />
        <div className="h-3 w-3 rounded-full bg-gray-200 dark:bg-muted" />
        <div className="ml-4 h-6 w-full max-w-md rounded-full bg-background" />
      </div>
      {children}
    </div>
  );
}

export function Mockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background overflow-hidden">
      {children}
    </div>
  );
} 