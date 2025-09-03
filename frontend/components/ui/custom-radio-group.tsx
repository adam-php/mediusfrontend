"use client"

import type React from "react"

import { motion } from "framer-motion"

interface RadioOption {
  value: string
  label: string
  icon?: React.ReactNode
}

interface CustomRadioGroupProps {
  options: RadioOption[]
  value: string[]
  onChange: (value: string) => void
  multiple?: boolean
  className?: string
}

export function CustomRadioGroup({
  options,
  value,
  onChange,
  multiple = false,
  className = "",
}: CustomRadioGroupProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {options.map((option, index) => {
        const isSelected = value.includes(option.value)

        return (
          <motion.div
            key={option.value}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
            className="relative"
          >
            <motion.label
              className={`
                flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200
                border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20
                ${isSelected ? "border-orange-400/50 bg-orange-400/10" : ""}
              `}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative">
                <motion.div
                  className={`
                    w-5 h-5 rounded-full border-2 transition-all duration-200
                    ${isSelected ? "border-orange-400" : "border-white/30"}
                  `}
                  animate={{
                    borderColor: isSelected ? "#fb923c" : "rgba(255,255,255,0.3)",
                  }}
                >
                  <motion.div
                    className="absolute inset-0.5 rounded-full bg-orange-400"
                    initial={false}
                    animate={{
                      scale: isSelected ? 1 : 0,
                      opacity: isSelected ? 1 : 0,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                </motion.div>
              </div>

              {option.icon && (
                <motion.div
                  className={`transition-colors duration-200 ${isSelected ? "text-orange-400" : "text-gray-400"}`}
                  animate={{ color: isSelected ? "#fb923c" : "#9ca3af" }}
                >
                  {option.icon}
                </motion.div>
              )}

              <span className={`text-sm transition-colors duration-200 ${isSelected ? "text-white" : "text-gray-300"}`}>
                {option.label}
              </span>

              <input
                type={multiple ? "checkbox" : "radio"}
                checked={isSelected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
            </motion.label>
          </motion.div>
        )
      })}
    </div>
  )
}
