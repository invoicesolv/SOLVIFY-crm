import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { useReducedMotion as useFramerReducedMotion } from "framer-motion";
import { useMemo } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const ANIMATION_VARIANTS = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  },
  fadeInUp: {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: 10, transition: { duration: 0.2 } }
  }
};

export function useReducedMotion() {
  const shouldReduceMotion = useFramerReducedMotion();
  
  const getReducedMotionVariants = useMemo(() => (fallback: any) => {
    return shouldReduceMotion ? ANIMATION_VARIANTS.fadeIn : fallback;
  }, [shouldReduceMotion]);
  
  return { shouldReduceMotion, getReducedMotionVariants };
}
