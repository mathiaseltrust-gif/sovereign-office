"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return <span className="relative inline-flex group">{children}</span>
}

const TooltipTrigger = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { asChild?: boolean }
>(({ children, asChild: _asChild, ...props }, ref) => (
  <span ref={ref} {...props}>
    {children}
  </span>
))
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { sideOffset?: number }
>(({ className, sideOffset: _sideOffset = 4, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-sm group-hover:block group-focus-within:block",
      className,
    )}
    {...props}
  />
))
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
