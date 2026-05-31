'use client'

import Image from 'next/image'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/animations/fade-in'
import { 
  Sparkles, 
  Zap, 
  Shield, 
  Eye, 
  FileText, 
  History 
} from 'lucide-react'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: Zap,
    title: 'AI-Powered Denoising',
    description: 'Advanced neural networks remove noise, blur, and artifacts from your documents while preserving important details.',
    gradient: 'from-blue-500 to-cyan-500',
    image: '/images/feature-ai.jpg',
    span: 'md:col-span-2',
    imageSpan: true
  },
  {
    icon: Eye,
    title: 'Smart OCR',
    description: 'Extract text with high accuracy, even from damaged or low-quality scans.',
    gradient: 'from-violet-500 to-purple-500',
    image: '/images/feature-ocr.jpg'
  },
  {
    icon: Sparkles,
    title: 'Copilot-Style Suggestions',
    description: 'AI identifies potential OCR errors and suggests corrections inline. Accept or reject each change with a single click.',
    gradient: 'from-amber-500 to-orange-500',
    image: '/images/feature-correction.jpg'
  },
  {
    icon: Shield,
    title: 'Secure Processing',
    description: 'Your documents are encrypted and automatically deleted after processing.',
    gradient: 'from-emerald-500 to-teal-500'
  },
  {
    icon: FileText,
    title: 'Multiple Export Formats',
    description: 'Export recovered text as PDF, DOCX, TXT, or copy directly to clipboard.',
    gradient: 'from-pink-500 to-rose-500'
  },
  {
    icon: History,
    title: 'Document History',
    description: 'Access all your previously processed documents anytime. Track changes and re-export as needed.',
    gradient: 'from-indigo-500 to-blue-500'
  }
]

export function Features() {
  return (
    <section id="features" className="py-24 bg-gradient-to-b from-background to-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Features
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 text-balance">
            Everything You Need to Recover Documents
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            From denoising to text extraction to intelligent corrections - 
            all in one seamless workflow.
          </p>
        </FadeIn>
        
        <StaggerContainer className="grid md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <StaggerItem 
              key={feature.title}
              className={cn('group', feature.span)}
            >
              <div className="h-full p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 overflow-hidden">
                {feature.image && (
                  <div className={cn(
                    "relative rounded-xl overflow-hidden mb-4",
                    feature.imageSpan ? "h-48" : "h-32"
                  )}>
                    <Image
                      src={feature.image}
                      alt={feature.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                  </div>
                )}
                <div className={cn(
                  'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4',
                  feature.gradient
                )}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  )
}
