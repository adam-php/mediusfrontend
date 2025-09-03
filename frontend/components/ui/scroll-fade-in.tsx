"use client"

import { useEffect, useRef, useState } from "react"

type Props = {
  className?: string
  children: React.ReactNode
  delay?: number
  distance?: number
}

export default function ScrollFadeIn({ className = "", children, delay = 0, distance = 16 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setVisible(true)
        })
      },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms`, transform: visible ? 'translateY(0px)' : `translateY(${distance}px)` }}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100' : 'opacity-0'} ${className}`}
    >
      {children}
    </div>
  )
}


