'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { GlowingEffect } from '@/components/ui/glowing-effect';

interface AnimatedBorderCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  children: React.ReactNode;
  gradient?: 'blue-purple' | 'green-blue' | 'purple-pink' | 'orange-red';
  enableGlow?: boolean;
}

export function AnimatedBorderCard({
  children,
  className,
  gradient = 'blue-purple',
  enableGlow = true, // Enable glow by default
  ...props
}: AnimatedBorderCardProps) {
  // Define gradient based on the prop
  const gradientClasses = {
    'blue-purple': 'from-blue-500 via-purple-500 to-blue-500',
    'green-blue': 'from-green-500 via-blue-500 to-green-500',
    'purple-pink': 'from-purple-500 via-pink-500 to-purple-500',
    'orange-red': 'from-orange-500 via-red-500 to-orange-500',
  };

  return (
    <div className="relative group">
      {/* Glowing Effect */}
      {enableGlow && (
        <GlowingEffect 
          disabled={false} 
          glow={true} 
          spread={40}
          blur={4}
          borderWidth={3}
          movementDuration={1.5}
          proximity={50}
        />
      )}

      {/* Animated border */}
      <div 
        className={`
          absolute -z-10 inset-0 rounded-lg opacity-0 group-hover:opacity-100
          transition-opacity duration-500 overflow-hidden p-[2px]
        `}
      >
        <div 
          className={`
            absolute inset-0 -z-10
            border border-border dark:border-border group-hover:border-gray-400 dark:border-border
            transition-colors rounded-lg
          `}
        />
      </div>
      
      {/* Card content */}
      <Card 
        className={cn(
          "relative transition-all duration-300 hover:shadow-lg z-10 border-transparent hover:border-transparent",
          className
        )} 
        {...props}
      >
        {children}
      </Card>
    </div>
  );
} 