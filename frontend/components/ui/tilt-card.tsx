"use client"

import { useRef } from "react"

type Props = {
  className?: string
  children: React.ReactNode
  maxTilt?: number
  scale?: number
}

export default function TiltCard({ className = "", children, maxTilt = 8, scale = 1.02 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    const tiltX = (maxTilt / 2 - px * maxTilt).toFixed(2)
    const tiltY = (py * maxTilt - maxTilt / 2).toFixed(2)
    el.style.transform = `perspective(800px) rotateX(${tiltY}deg) rotateY(${tiltX}deg) scale(${scale})`
  }

  const reset = () => {
    const el = ref.current
    if (!el) return
    el.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)"
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={reset}
      className={`transition-transform duration-300 ease-out will-change-transform ${className}`}
    >
      {children}
    </div>
  )
}


