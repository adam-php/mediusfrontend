"use client"

import React, { useCallback, useRef, useState } from "react"

type AnimationPhase = 'idle' | 'enter' | 'preExit' | 'exit' | 'reset'

type StatefulButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onClick: () => Promise<unknown>
  success?: React.ReactNode
  successDurationMs?: number
  animateSuccess?: boolean
}

export function StatefulButton(props: StatefulButtonProps) {
  const { onClick, children, className = "", disabled, success, successDurationMs = 1000, animateSuccess = true, ...rest } = props

  const [isPending, setIsPending] = useState(false)
  const [phase, setPhase] = useState<AnimationPhase>('idle')
  const timeoutsRef = useRef<number[]>([])

  const clearTimers = () => {
    for (const id of timeoutsRef.current) window.clearTimeout(id)
    timeoutsRef.current = []
  }

  const handleClick = useCallback(async () => {
    if (isPending) return
    setIsPending(true)
    try {
      await onClick()
      if (!animateSuccess) {
        setIsPending(false)
        setPhase('idle')
        return
      }
      // Success animation sequence: default slides up, success slides up, then success slides up out, default slides up back in
      setPhase('enter')
      const t1 = window.setTimeout(() => {
        setPhase('preExit')
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setPhase('exit')
            const t2 = window.setTimeout(() => {
              // Reset instantly without transition to avoid post-animation flicker
              setPhase('reset')
              const t3 = window.setTimeout(() => {
                setPhase('idle')
                setIsPending(false)
              }, 20)
              timeoutsRef.current.push(t3)
            }, 350)
            timeoutsRef.current.push(t2)
          })
        })
      }, Math.max(300, successDurationMs - 300))
      timeoutsRef.current.push(t1)
    } catch (e) {
      // On error just revert to idle state
      setIsPending(false)
      setPhase('idle')
    }
  }, [isPending, onClick, successDurationMs])

  // Cleanup timers if unmounted
  React.useEffect(() => () => clearTimers(), [])

  const isAnimating = phase !== 'idle'
  const isDisabled = Boolean(disabled) || isPending || isAnimating

  return (
    <button
      type="button"
      {...rest}
      onClick={handleClick}
      disabled={isDisabled}
      aria-busy={isPending || undefined}
      className={`relative overflow-hidden ${className}`}
    >
      {/* Default label */}
      <span
        className="inline-flex items-center justify-center gap-2 transition-transform duration-300"
        style={{
          transform:
            phase === 'enter' ? 'translateY(-120%)' :
            phase === 'preExit' ? 'translateY(120%)' :
            phase === 'exit' ? 'translateY(0%)' :
            phase === 'reset' ? 'translateY(0%)' :
            'translateY(0%)',
          transition: (phase === 'preExit' || phase === 'reset') ? 'none' as const : undefined,
        }}
      >
        {children}
      </span>

      {/* Success label */}
      <span
        className="absolute inset-0 flex items-center justify-center gap-2 transition-transform duration-300"
        style={{
          transform:
            phase === 'idle' ? 'translateY(120%)' :
            phase === 'enter' ? 'translateY(0%)' :
            phase === 'preExit' ? 'translateY(0%)' :
            phase === 'exit' ? 'translateY(-120%)' :
            phase === 'reset' ? 'translateY(120%)' :
            'translateY(120%)',
          transition: (phase === 'reset') ? 'none' as const : undefined,
        }}
      >
        {success}
      </span>

      {/* Right-side spinner, does not affect text layout */}
      <span
        className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 transition-opacity duration-150 ${isPending && phase === 'idle' ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      >
        <svg className="h-4 w-4 animate-spin text-white/90" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-100" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"></path>
        </svg>
      </span>
    </button>
  )
}

// Convenience alias to match example usage
export const Button = StatefulButton


