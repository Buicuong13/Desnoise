'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { TextGenerateEffect } from '@/components/animations/text-generate-effect'
import { ShimmerButton } from '@/components/animations/shimmer-button'
import { Particles } from '@/components/animations/particles'
import { ArrowRight, Sparkles, Upload, FileCheck } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/50 via-background to-background" />
      <Particles className="opacity-30" quantity={30} />
      
      {/* Decorative blurs */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Document Recovery</span>
          </motion.div>
          
          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
            <TextGenerateEffect 
              words="Transform Blurry Documents Into Crystal Clear Text"
              className="text-balance"
            />
          </h1>
          
          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-pretty"
          >
            Upload your damaged, noisy, or blurry documents. Our AI denoises images, 
            extracts text with OCR, and suggests corrections like GitHub Copilot - 
            giving you full control over every change.
          </motion.p>
          
          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/register">
              <ShimmerButton className="text-lg">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5 inline" />
              </ShimmerButton>
            </Link>
            <Button variant="outline" size="lg" asChild className="text-lg px-8 py-6 rounded-xl">
              <Link href="#how-it-works">
                See How It Works
              </Link>
            </Button>
          </motion.div>
          
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="grid grid-cols-3 gap-8 max-w-lg mx-auto mt-16"
          >
            {[
              { value: '50K+', label: 'Documents Processed' },
              { value: '98%', label: 'Accuracy Rate' },
              { value: '< 10s', label: 'Avg. Process Time' }
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
        
        {/* Demo Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.4 }}
          className="mt-20 relative"
        >
          <div className="relative mx-auto max-w-5xl">
            {/* Browser mockup */}
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 border border-border bg-card">
              {/* Browser header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-success/60" />
                </div>
                <div className="flex-1 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-1 rounded-lg bg-background text-sm text-muted-foreground">
                    <span className="text-success">https://</span>
                    docrecover.app/editor
                  </div>
                </div>
              </div>
              
              {/* App preview */}
              <div className="p-6 bg-gradient-to-br from-background to-muted/30">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Image side */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Upload className="w-4 h-4" />
                      <span>Original Document</span>
                    </div>
                    <div className="aspect-[4/3] rounded-xl overflow-hidden border border-border relative group">
                      <Image 
                        src="/images/sample-document-blurry.jpg" 
                        alt="Blurry document before processing"
                        fill
                        className="object-cover transition-opacity duration-500 group-hover:opacity-0"
                      />
                      <Image 
                        src="/images/sample-document-clear.jpg" 
                        alt="Clear document after processing"
                        fill
                        className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="text-center">
                          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-success/20 flex items-center justify-center">
                            <FileCheck className="w-6 h-6 text-success" />
                          </div>
                          <p className="text-sm font-medium text-foreground">Denoised & Enhanced</p>
                          <p className="text-xs text-muted-foreground">Hover to see result</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Text side */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Sparkles className="w-4 h-4" />
                      <span>OCR Text with AI Suggestions</span>
                    </div>
                    <div className="rounded-xl bg-background border border-border p-4 font-mono text-sm space-y-2">
                      <p className="text-foreground">This agreement is made between...</p>
                      <p className="text-foreground">
                        Please{' '}
                        <span className="relative">
                          <span className="bg-suggestion/30 text-suggestion-foreground px-1 rounded border-b-2 border-dashed border-suggestion">
                            recieve
                          </span>
                          <span className="absolute -top-8 left-0 bg-card border border-border rounded-lg px-2 py-1 text-xs shadow-lg whitespace-nowrap">
                            <span className="text-success">receive</span>
                            <span className="text-muted-foreground ml-2">98% confident</span>
                          </span>
                        </span>
                        {' '}this document...
                      </p>
                      <p className="text-foreground">According to th{'\u25A1'} document...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
