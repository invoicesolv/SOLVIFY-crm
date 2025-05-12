import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  indicatorClassName?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, indicatorClassName, ...props }, ref) => {
    const percentage = value >= 0 ? Math.min(100, (value / max) * 100) : 0

    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-neutral-800",
          className
        )}
        {...props}
      >
        <div
          className={cn("h-full w-full flex-1 bg-blue-500 transition-all", indicatorClassName)}
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    )
  }
)

Progress.displayName = "Progress"

export { Progress } 