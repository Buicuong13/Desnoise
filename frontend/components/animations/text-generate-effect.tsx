'use client'

import { useEffect, useRef } from 'react'
import { motion, useAnimation, useInView } from 'framer-motion'

interface TextGenerateEffectProps {
  words: string
  className?: string
  delay?: number
}

export function TextGenerateEffect({ words, className = '', delay = 0 }: TextGenerateEffectProps) {
  const controls = useAnimation()
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  
  const wordsArray = words.split(' ')
  
  useEffect(() => {
    if (isInView) {
      controls.start('visible')
    }
  }, [isInView, controls])
  
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      className={className}
    >
      {wordsArray.map((word, idx) => (
        <motion.span
          key={`${word}-${idx}`}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: {
              opacity: 1,
              y: 0,
              transition: {
                delay: delay + idx * 0.08,
                duration: 0.4
              }
            }
          }}
          className="inline-block mr-2"
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  )
}
