"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

// Create a custom wrapper for the Root component that handles focus management
const DialogRoot = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>
>((props, ref) => {
  // This ensures that when the dialog opens, focus is properly managed
  // to avoid aria-hidden issues with focused elements
  const onOpenChange = React.useCallback((open: boolean) => {
    if (open) {
      // When opening, blur the active element to prevent focus remaining on the trigger
      // which can cause aria-hidden accessibility issues
      setTimeout(() => {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && activeElement.blur) {
          activeElement.blur();
        }
      }, 0);
    }
    
    if (props.onOpenChange) {
      props.onOpenChange(open);
    }
  }, [props.onOpenChange]);

  return <DialogPrimitive.Root {...props} onOpenChange={onOpenChange} />;
});
DialogRoot.displayName = "DialogRoot";

const Dialog = DialogRoot;

const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>((props, ref) => {
  return <DialogPrimitive.Trigger {...props} ref={ref} />;
});
DialogTrigger.displayName = DialogPrimitive.Trigger.displayName;

const DialogPortal = ({
  ...props
}: DialogPrimitive.DialogPortalProps) => (
  <DialogPrimitive.Portal {...props} />
)
DialogPortal.displayName = DialogPrimitive.Portal.displayName

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/20 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  // Use a ref to track the content element
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  
  // Track if the dialog is open
  const [isOpen, setIsOpen] = React.useState(false);
  
  // Use a callback ref to properly manage the ref
  const handleRef = React.useCallback((node: HTMLDivElement | null) => {
    // Set our local ref
    contentRef.current = node;
    
    // Forward the ref
    if (typeof ref === 'function') {
      ref(node);
    }
    
    // Check if the dialog is open
    if (node) {
      setIsOpen(node.getAttribute('data-state') === 'open');
    }
  }, [ref]);
  
  // Use a layout effect for immediate focus management before browser paint
  React.useLayoutEffect(() => {
    // Get the active element that might have focus before dialog opens
    const activeElement = document.activeElement as HTMLElement;
    
    // Handle when the dialog is open
    if (isOpen && contentRef.current) {
      // First, blur any active element to prevent aria-hidden issues
      if (activeElement && activeElement !== contentRef.current && activeElement.blur) {
        activeElement.blur();
      }
      
      // Ensure the dialog content is focusable
      contentRef.current.setAttribute('tabindex', '-1');
      
      // Focus the dialog content immediately
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.focus({preventScroll: true});
          
          // Ensure no child elements have focus that could cause aria-hidden issues
          const focusableElements = contentRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          
          // Remove focus from any focused element inside the dialog
          const focusedElement = Array.from(focusableElements).find(
            el => document.activeElement === el
          ) as HTMLElement;
          
          if (focusedElement && focusedElement.blur) {
            focusedElement.blur();
          }
        }
      }, 0);
    }
  }, [isOpen]);
  
  // Listen for data-state changes to detect when dialog opens/closes
  React.useEffect(() => {
    if (!contentRef.current) return;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' && 
          mutation.attributeName === 'data-state'
        ) {
          const state = (mutation.target as HTMLElement).getAttribute('data-state');
          setIsOpen(state === 'open');
        }
      });
    });
    
    observer.observe(contentRef.current, { attributes: true });
    
    return () => observer.disconnect();
  }, []);
  
  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
        ref={handleRef}
      className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[95vw] md:max-w-[1200px] translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-lg outline-none",
        className
      )}
        onOpenAutoFocus={(e) => {
          // Prevent default autofocus behavior to let our custom focus logic work
          e.preventDefault();
        }}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4 text-muted-foreground" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight text-foreground",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogPortal,
  DialogOverlay,
} 