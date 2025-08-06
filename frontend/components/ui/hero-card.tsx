"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface HeroCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  hover?: boolean
  glow?: boolean
}

export const HeroCard = React.forwardRef<HTMLDivElement, HeroCardProps>(
  ({ className, children, hover = true, glow = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative group",
          "backdrop-blur-xl bg-white/[0.02] border border-white/10",
          "rounded-3xl p-8 shadow-2xl shadow-black/20",
          "transition-all duration-700 ease-out",
          hover && "hover:border-orange-500/20 hover:bg-white/[0.04] hover:scale-[1.02] hover:shadow-orange-500/10",
          glow && "shadow-orange-500/20",
          className
        )}
        {...props}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.03] via-transparent to-amber-500/[0.03] rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        {/* Top border gradient */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-400/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        {/* Shimmer effect */}
        <div className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-1000 rounded-3xl overflow-hidden" />
        
        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </div>
    )
  }
)
HeroCard.displayName = "HeroCard"
