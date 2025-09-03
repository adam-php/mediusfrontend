"use client"

import type React from "react"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface CustomRadioProps {
  options: { value: string; label: string; icon?: React.ReactNode }[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function CustomRadio({ options, value, onChange, className }: CustomRadioProps) {
  return (
    <div className={cn("inline-flex rounded-lg border border-white/10 bg-black p-1 relative", className)}>
      {/* Animated background indicator */}
      <motion.div
        className="absolute inset-1 bg-white/10 rounded-md"
        initial={false}
        animate={{
          x: options.findIndex((opt) => opt.value === value) * 100 + "%",
          width: `${100 / options.length}%`,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        style={{
          width: `${100 / options.length}%`,
        }}
      />

      {options.map((option) => (
        <motion.button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative z-10 px-3 py-1.5 text-sm rounded-md transition-colors duration-200 flex items-center gap-2",
            value === option.value ? "text-white" : "text-gray-300 hover:text-white",
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{ width: `${100 / options.length}%` }}
        >
          {option.icon}
          {option.label}
        </motion.button>
      ))}
    </div>
  )
}
