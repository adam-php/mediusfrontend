"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface HeroButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md" | "lg"
  loading?: boolean
  children: React.ReactNode
}

export const HeroButton = React.forwardRef<HTMLButtonElement, HeroButtonProps>(
  ({ className, variant = "primary", size = "md", loading = false, children, disabled, ...props }, ref) => {
    const variants = {
      primary: "bg-gradient-to-r from-orange-500/90 to-amber-500/90 hover:from-orange-500 hover:to-amber-500 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50",
      secondary: "glass bg-white/[0.08] hover:bg-white/[0.12] border border-white/20 hover:border-white/30 text-white",
      ghost: "glass bg-orange-500/10 hover:bg-orange-500/20 border border-orange-400/20 hover:border-orange-400/40 text-orange-400 hover:text-orange-300"
    }

    const sizes = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg"
    }

    return (
      <button
        ref={ref}
        className={cn(
          "relative font-medium rounded-2xl transition-all duration-500 ease-out",
          "hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed",
          "overflow-hidden group",
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-amber-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Content */}
        <div className="relative z-10 flex items-center justify-center space-x-2">
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Loading...</span>
            </>
          ) : (
            children
          )}
        </div>
      </button>
    )
  }
)
HeroButton.displayName = "HeroButton"
