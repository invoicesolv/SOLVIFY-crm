"use client"

import { cn } from "@/lib/utils"

interface TabProps {
  text: string
  selected: boolean
  setSelected: (value: string) => void
  discount?: boolean
}

export function Tab({ text, selected, setSelected, discount }: TabProps) {
  return (
    <button
      onClick={() => setSelected(text)}
      className={cn(
        "relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
        selected ? "text-foreground" : "text-foreground/60 hover:text-foreground/80"
      )}
    >
      {selected && (
        <span className="absolute inset-0 rounded-full bg-primary" />
      )}
      <span className="relative flex items-center gap-2">
        {text.charAt(0).toUpperCase() + text.slice(1)}
        {discount && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-500">
            Save 20%
          </span>
        )}
      </span>
    </button>
  )
} 