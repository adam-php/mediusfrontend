"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface HeroInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export const HeroInput = React.forwardRef<HTMLInputElement, HeroInputProps>(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full px-4 py-4 glass bg-white/[0.08] border border-white/20 rounded-2xl",
              "text-white placeholder-gray-400 focus:outline-none focus:ring-2",
              "focus:ring-orange-500/50 focus:border-orange-400/50 focus:bg-white/[0.12]",
              "transition-all duration-500 ease-out hover:bg-white/[0.10] hover:border-white/30",
              icon && "pl-10",
              error && "border-red-400/50 focus:border-red-400/50 focus:ring-red-500/50",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm text-red-400 flex items-center space-x-1">
            <span>⚠️</span>
            <span>{error}</span>
          </p>
        )}
      </div>
    )
  }
)
HeroInput.displayName = "HeroInput"
