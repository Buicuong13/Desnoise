'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ShimmerButtonProps {
  children: ReactNode
  className?: string
  shimmerColor?: string
  onClick?: () => void
}

export function ShimmerButton({ 
  children, 
  className = '',
  shimmerColor = 'rgba(255, 255, 255, 0.3)',
  onClick
}: ShimmerButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'relative overflow-hidden rounded-xl px-8 py-4 font-semibold',
        'bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%]',
        'text-primary-foreground shadow-lg shadow-primary/25',
        'transition-all duration-300',
        className
      )}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, transparent, ${shimmerColor}, transparent)`
        }}
        animate={{
          x: ['-100%', '100%']
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 1,
          ease: 'linear'
        }}
      />
      <span className="relative z-10">{children}</span>
    </motion.button>
  )
}

interface GradientTextProps {
  children: ReactNode
  className?: string
  animate?: boolean
}

export function GradientText({ children, className = '', animate = true }: GradientTextProps) {
  return (
    <span
      className={cn(
        'bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent',
        animate && 'bg-[length:200%_100%] animate-gradient',
        className
      )}
    >
      {children}
    </span>
  )
}

// Add this to globals.css: @keyframes gradient { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
