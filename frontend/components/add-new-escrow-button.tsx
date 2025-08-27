"use client"

import React from "react"
import { ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface InteractiveHoverButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const InteractiveHoverButton = React.forwardRef<HTMLButtonElement, InteractiveHoverButtonProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "group relative w-auto cursor-pointer overflow-hidden rounded-full border border-orange-500/30 bg-transparent p-2 px-6 text-center font-semibold text-white transition-colors duration-500 ease-out hover:border-orange-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-orange-500 transition-all duration-500 ease-out group-hover:scale-[100.8]"></div>
          <span className="inline-block transition-all duration-500 ease-out group-hover:translate-x-12 group-hover:opacity-0">
            {children}
          </span>
        </div>
        <div className="absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 text-white opacity-0 transition-all duration-500 ease-out group-hover:-translate-x-5 group-hover:opacity-100">
          <span>{children}</span>
          <ArrowRight />
        </div>
      </button>
    )
  },
)
InteractiveHoverButton.displayName = "InteractiveHoverButton"

export function AddNewEscrowButton({ className, ...props }: Omit<InteractiveHoverButtonProps, "children" | "onClick">) {
  const router = useRouter()
  return (
    <InteractiveHoverButton
      aria-label="Add new escrow"
      onClick={() => router.push("/create-escrow")}
      className={cn("", className)}
      {...props}
    >
      {"Create new escrow"}
    </InteractiveHoverButton>
  )
}
