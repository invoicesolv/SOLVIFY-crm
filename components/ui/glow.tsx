import { cn } from "@/lib/utils";

interface GlowProps {
  className?: string;
  variant?: "center" | "top" | "bottom" | "left" | "right";
}

export function Glow({ className, variant = "center" }: GlowProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 -z-10 overflow-hidden",
        className
      )}
    >
      <div
        className={cn(
          "absolute bg-blue-500/20 blur-[100px] w-[50%] h-[50%] rounded-full",
          variant === "center" && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          variant === "top" && "left-1/2 top-0 -translate-x-1/2",
          variant === "bottom" && "left-1/2 bottom-0 -translate-x-1/2",
          variant === "left" && "left-0 top-1/2 -translate-y-1/2",
          variant === "right" && "right-0 top-1/2 -translate-y-1/2"
        )}
      />
      <div
        className={cn(
          "absolute bg-indigo-500/20 blur-[100px] w-[30%] h-[30%] rounded-full",
          variant === "center" && "left-[40%] top-[40%]",
          variant === "top" && "right-[30%] top-[10%]",
          variant === "bottom" && "left-[30%] bottom-[10%]",
          variant === "left" && "left-[10%] bottom-[30%]",
          variant === "right" && "right-[10%] top-[30%]"
        )}
      />
    </div>
  );
} 