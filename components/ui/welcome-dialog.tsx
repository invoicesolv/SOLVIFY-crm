"use client"

import { useState, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from '@/lib/supabase'
import { useSession } from 'next-auth/react'
import { Check, ArrowRight, LayoutDashboard, Users, Receipt, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function WelcomeDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const { data: session } = useSession()
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false)

  useEffect(() => {
    // Check localStorage first as a quick way to avoid showing the dialog
    // while we wait for the database check
    const localStorageCheck = localStorage.getItem('has_seen_welcome')
    if (localStorageCheck === 'true') {
      setHasCheckedStatus(true)
      return
    }

    const checkWelcomeStatus = async () => {
      if (!session?.user?.id) return;

      // Log the user ID for debugging
      console.log('Checking welcome status for user ID:', session.user.id);

      try {
        // First check if user_preferences table exists and has the user's record
        const { data, error } = await supabase
          .from('user_preferences')
          .select('has_seen_welcome')
          .eq('user_id', session.user.id)
          .single();

        if (error) {
          console.error('Supabase query error:', error);
          
          // If the table doesn't exist or there's no record, create it
          if (error.code === '42P01' || error.code === 'PGRST116') {
            console.log('Creating user preferences record');
            
            const { error: insertError } = await supabase
              .from('user_preferences')
              .upsert({
                user_id: session.user.id,
                has_seen_welcome: false,
                created_at: new Date().toISOString()
              });
              
            if (insertError) {
              console.error('Error creating user preferences:', insertError);
            }
          }
          
          // Show the dialog
          setIsOpen(true);
          setHasCheckedStatus(true);
          return;
        }

        if (!data || !data.has_seen_welcome) {
          setIsOpen(true);
        }
        
        setHasCheckedStatus(true);
      } catch (err) {
        console.error('Error in checkWelcomeStatus:', err);
        setIsOpen(true);
        setHasCheckedStatus(true);
      }
    };

    checkWelcomeStatus();
  }, [session?.user?.id]);

  const handleClose = async () => {
    if (!session?.user?.id) return;

    // Log the user ID for debugging
    console.log('Saving welcome status for user ID:', session.user.id);

    // Save preference to not show again
    try {
      // Save to localStorage as a fallback
      localStorage.setItem('has_seen_welcome', 'true');
      
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: session.user.id,
          has_seen_welcome: true,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving welcome status:', error);
      }
    } catch (err) {
      console.error('Error in handleClose:', err);
    }

    setIsOpen(false);
  };

  const steps = [
    {
      title: "Welcome to Solvify CRM",
      description: "Let's take a quick tour of your new CRM system. We'll show you the key features to help you get started.",
      icon: <Sparkles className="w-12 h-12 text-blue-600 dark:text-blue-400" />
    },
    {
      title: "Your Dashboard",
      description: "This is your command center. Track revenue, monitor customer activity, and stay on top of important tasks.",
      icon: <LayoutDashboard className="w-12 h-12 text-blue-600 dark:text-blue-400" />
    },
    {
      title: "Customer Management",
      description: "Manage your customers, track interactions, and build stronger relationships all in one place.",
      icon: <Users className="w-12 h-12 text-blue-600 dark:text-blue-400" />
    },
    {
      title: "Invoicing & Payments",
      description: "Create and send professional invoices, track payments, and manage your finances effortlessly.",
      icon: <Receipt className="w-12 h-12 text-blue-600 dark:text-blue-400" />
    },
    {
      title: "Ready to Start?",
      description: "You're all set! Start exploring your new CRM system. If you need help, click the support button in the bottom right.",
      icon: <Check className="w-12 h-12 text-green-600 dark:text-green-400" />
    }
  ]

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleClose()
    }
  }

  // Don't render anything until we've checked the status
  if (!hasCheckedStatus || !isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-900/50 dark:bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-background border-border p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          {steps[currentStep].icon}
          
          <h2 className="mt-6 text-2xl font-semibold text-foreground">
            {steps[currentStep].title}
          </h2>
          
          <p className="mt-2 text-muted-foreground">
            {steps[currentStep].description}
          </p>

          <div className="flex items-center justify-center gap-2 mt-8">
            {steps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  index === currentStep && 'bg-blue-500',
                  index < currentStep && 'bg-green-500',
                  index > currentStep && 'bg-gray-200 dark:bg-muted'
                )}
              />
            ))}
          </div>

          <Button
            onClick={nextStep}
            className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-foreground"
            size="lg"
          >
            {currentStep === steps.length - 1 ? (
              <>
                Get Started
                <Check className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
} 