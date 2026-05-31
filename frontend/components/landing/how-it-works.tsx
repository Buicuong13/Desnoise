'use client'

import { FadeIn } from '@/components/animations/fade-in'
import { motion } from 'framer-motion'
import { Upload, Wand2, CheckCircle, Download } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Upload,
    title: 'Upload Your Document',
    description: 'Drag and drop your blurry, noisy, or damaged document. We support JPG, PNG, PDF, and more.',
    color: 'bg-blue-500'
  },
  {
    number: '02',
    icon: Wand2,
    title: 'AI Processing',
    description: 'Our AI denoises the image, enhances quality, and extracts text using advanced OCR technology.',
    color: 'bg-violet-500'
  },
  {
    number: '03',
    icon: CheckCircle,
    title: 'Review Suggestions',
    description: 'Like GitHub Copilot, review AI-suggested corrections. Accept, reject, or edit each suggestion.',
    color: 'bg-amber-500'
  },
  {
    number: '04',
    icon: Download,
    title: 'Export & Save',
    description: 'Download your recovered document in your preferred format. Access it anytime from your history.',
    color: 'bg-emerald-500'
  }
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            How It Works
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 text-balance">
            Four Simple Steps to Document Recovery
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            From upload to export in under a minute. No technical knowledge required.
          </p>
        </FadeIn>
        
        <div className="relative">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-24 left-1/2 transform -translate-x-1/2 w-3/4 h-0.5 bg-gradient-to-r from-blue-500 via-violet-500 via-amber-500 to-emerald-500 opacity-30" />
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <FadeIn key={step.number} delay={index * 0.15}>
                <motion.div
                  whileHover={{ y: -8 }}
                  className="relative text-center p-6"
                >
                  {/* Step number */}
                  <div className="text-6xl font-bold text-muted/20 absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2">
                    {step.number}
                  </div>
                  
                  {/* Icon */}
                  <div className={`relative z-10 w-16 h-16 mx-auto rounded-2xl ${step.color} flex items-center justify-center mb-6 shadow-lg`}>
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {step.description}
                  </p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
        
        {/* Before/After Demo */}
        <FadeIn delay={0.6} className="mt-20">
          <div className="relative rounded-2xl overflow-hidden bg-card border border-border p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Before */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <span className="text-sm font-medium text-muted-foreground">Before - Blurry Document</span>
                </div>
                <div className="aspect-[4/3] rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                  <div className="p-6 text-center blur-[2px] opacity-70">
                    <p className="font-mono text-lg text-muted-foreground">
                      Th1s docurn3nt h4s<br />
                      b33n d4m4g3d by<br />
                      n0ise 4nd blur...
                    </p>
                  </div>
                </div>
              </div>
              
              {/* After */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-sm font-medium text-muted-foreground">After - Recovered Text</span>
                </div>
                <div className="aspect-[4/3] rounded-xl bg-muted/50 flex items-center justify-center overflow-hidden border border-success/20">
                  <div className="p-6 text-center">
                    <p className="font-mono text-lg text-foreground">
                      This document has<br />
                      been damaged by<br />
                      noise and blur...
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 text-success text-sm">
                      <CheckCircle className="w-4 h-4" />
                      100% text recovered
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
