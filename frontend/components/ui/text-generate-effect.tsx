"use client"

import { cn } from "@/lib/utils"
import { motion, stagger, useAnimate } from "framer-motion"
import { useEffect } from "react"

export const TextGenerateEffect = ({
  words,
  className,
  filter = true,
  duration = 0.5,
  after,
}: {
  words: string
  className?: string
  filter?: boolean
  duration?: number
  after?: React.ReactNode
}) => {
  const [scope, animate] = useAnimate()
  let wordsArray = words.split(" ")
  
  useEffect(() => {
    animate(
      "span",
      {
        opacity: 1,
        filter: filter ? "blur(0px)" : "none",
      },
      {
        duration: duration ? duration : 1,
        delay: stagger(0.2),
      }
    )
  }, [scope.current])

  const renderWords = () => {
    return (
      <motion.div ref={scope}>
        {wordsArray.map((word, idx) => {
          const isLast = idx === wordsArray.length - 1;
          return (
            <motion.span
              key={word + idx}
              className="text-white opacity-0"
              style={{
                filter: filter ? "blur(10px)" : "none",
              }}
            >
              {word}{!isLast && " "}
            </motion.span>
          )
        })}
        {after && (
          <motion.span
            className="opacity-0"
            style={{ filter: filter ? "blur(10px)" : "none" }}
          >
            {after}
          </motion.span>
        )}
      </motion.div>
    )
  }

  return (
    <div className={cn("font-bold", className)}>
      <div className="mt-4">
        <div className="text-white text-2xl leading-snug tracking-wide">
          {renderWords()}
        </div>
      </div>
    </div>
  )
}
