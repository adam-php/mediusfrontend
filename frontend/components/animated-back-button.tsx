"use client"

import { useState } from "react"

interface AnimatedBackButtonProps {
  onClick: () => void
  text?: string
  className?: string
}

export default function AnimatedBackButton({
  onClick,
  text = "Back to Dashboard",
  className = "",
}: AnimatedBackButtonProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative text-gray-400 hover:text-orange-400 transition-colors duration-300 flex items-center ${className}`}
    >
      <div className="relative flex items-center min-w-0">
        {/* Arrow that slides in from the left */}
        <span
          className={`transition-all duration-300 ease-out ${
            isHovered ? "transform translate-x-0 opacity-100 mr-2" : "transform -translate-x-4 opacity-0 mr-0"
          }`}
        >
          ←
        </span>

        {/* Text that stays in place but makes room for arrow */}
        <span
          className={`transition-all duration-300 ease-out whitespace-nowrap ${
            isHovered ? "transform translate-x-0" : "transform -translate-x-2"
          }`}
        >
          {text}
        </span>
      </div>
    </button>
  )
}
