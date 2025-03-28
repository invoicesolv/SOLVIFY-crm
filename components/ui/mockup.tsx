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
        "rounded-xl overflow-hidden border border-neutral-800 shadow-2xl",
        size === "small" && "max-w-md",
        size === "medium" && "max-w-2xl",
        size === "large" && "max-w-5xl",
        className
      )}
    >
      <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex items-center gap-1.5">
        <div className="h-3 w-3 rounded-full bg-neutral-700" />
        <div className="h-3 w-3 rounded-full bg-neutral-700" />
        <div className="h-3 w-3 rounded-full bg-neutral-700" />
        <div className="ml-4 h-6 w-full max-w-md rounded-full bg-neutral-800" />
      </div>
      {children}
    </div>
  );
}

export function Mockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-neutral-950 overflow-hidden">
      {children}
    </div>
  );
} 