"use client";

import { motion } from "framer-motion";
import { PropsWithChildren } from "react";
import { useReducedMotion, ANIMATION_VARIANTS } from "@/lib/utils";

export function PageTransition({ children }: PropsWithChildren) {
  const { shouldReduceMotion, getReducedMotionVariants } = useReducedMotion();
  
  const variants = shouldReduceMotion 
    ? getReducedMotionVariants(ANIMATION_VARIANTS.fadeIn)
    : ANIMATION_VARIANTS.fadeInUp;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variants}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
} 