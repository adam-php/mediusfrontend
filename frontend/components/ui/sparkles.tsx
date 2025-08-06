"use client"

import { cn } from "@/lib/utils"
import React from "react"

export const SparklesCore = ({
  id,
  className,
  background,
  minSize,
  maxSize,
  particleDensity,
  particleColor,
}: {
  id?: string
  className?: string
  background?: string
  minSize?: number
  maxSize?: number
  particleDensity?: number
  particleColor?: string
}) => {
  return (
    <div className={cn("relative", className)}>
      <div
        className="absolute inset-0"
        style={{
          background: background || "transparent",
        }}
      >
        {Array.from({ length: particleDensity || 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute animate-sparkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * (maxSize || 3) + (minSize || 1)}px`,
              height: `${Math.random() * (maxSize || 3) + (minSize || 1)}px`,
              backgroundColor: particleColor || "#fb923c",
              borderRadius: "50%",
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${Math.random() * 3 + 2}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
