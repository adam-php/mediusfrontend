"use client"

import { useMemo } from "react"

type Props = {
  text: string
  className?: string
}

export default function GlitchText({ text, className = "" }: Props) {
  const id = useMemo(() => Math.random().toString(36).slice(2), [])
  return (
    <span className={`relative inline-block glitch-${id} ${className}`} aria-label={text}>
      <span aria-hidden className="block" data-glitch>{text}</span>
      <span aria-hidden className="block absolute left-0 top-0 clip-rect glitch-slice-1" data-glitch>{text}</span>
      <span aria-hidden className="block absolute left-0 top-0 clip-rect glitch-slice-2" data-glitch>{text}</span>
      <style>{`
        .glitch-${id} [data-glitch] { text-shadow: 0 0 0 rgba(0,0,0,0); }
        .glitch-${id} .glitch-slice-1 { animation: glitch-anim-1 2.2s infinite linear alternate-reverse; color: rgba(255,100,100,0.8); mix-blend-mode: screen; }
        .glitch-${id} .glitch-slice-2 { animation: glitch-anim-2 2.2s infinite linear alternate-reverse; color: rgba(100,200,255,0.8); mix-blend-mode: screen; }
        @keyframes glitch-anim-1 { 0% { transform: translate(0,0) } 20% { transform: translate(-1px,-1px) } 40% { transform: translate(1px,1px) } 60% { transform: translate(-1px,1px) } 80% { transform: translate(1px,-1px) } 100% { transform: translate(0,0) } }
        @keyframes glitch-anim-2 { 0% { transform: translate(0,0) } 20% { transform: translate(1px,0) } 40% { transform: translate(0,1px) } 60% { transform: translate(-1px,0) } 80% { transform: translate(0,-1px) } 100% { transform: translate(0,0) } }
      `}</style>
    </span>
  )
}


