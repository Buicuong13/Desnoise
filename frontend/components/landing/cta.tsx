'use client'

import Link from 'next/link'
import { FadeIn } from '@/components/animations/fade-in'
import { ShimmerButton } from '@/components/animations/shimmer-button'
import { ArrowRight } from 'lucide-react'

export function CTA() {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">
            Ready to Recover Your Documents?
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto text-pretty">
            Join thousands of users who trust DocRecover for their document recovery needs. 
            Start with 5 free documents - no credit card required.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <ShimmerButton className="text-lg">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5 inline" />
              </ShimmerButton>
            </Link>
            <Link 
              href="/login" 
              className="text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Already have an account? Log in
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
