'use client'

/**
 * Visual placeholder shown while a long-running AI step is in flight
 * (OCR / LLM correction). Three pulsing "text" bars plus a labelled
 * progress strip — enough to make it obvious the system is doing something
 * without committing to a fake percentage.
 */
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface ProcessingIndicatorProps {
  label: string
  hint?: string
  className?: string
}

export function ProcessingIndicator({ label, hint, className }: ProcessingIndicatorProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-muted/30 p-4 space-y-3 font-mono text-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="font-medium">{label}</span>
      </div>

      {/* Pulsing skeleton lines */}
      <div className="space-y-2">
        {[100, 88, 72].map((width, i) => (
          <motion.div
            key={i}
            className="h-3 rounded bg-muted-foreground/20"
            style={{ width: `${width}%` }}
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              delay: i * 0.18,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Indeterminate progress bar */}
      <div className="relative h-1.5 rounded-full bg-muted-foreground/15 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent"
          animate={{ x: ['-100%', '300%'] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
