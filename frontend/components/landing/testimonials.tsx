'use client'

import Image from 'next/image'
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/animations/fade-in'
import { Star, Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Research Archivist',
    company: 'Stanford University',
    image: '/images/testimonial-1.jpg',
    content: 'DocRecover has transformed how we digitize historical documents. The AI suggestions catch errors our team would have missed. We have processed over 10,000 pages with remarkable accuracy.',
    rating: 5
  },
  {
    name: 'Michael Roberts',
    role: 'Legal Operations Director',
    company: 'Morrison & Associates',
    image: '/images/testimonial-2.jpg',
    content: 'When dealing with aged legal documents, accuracy is paramount. The Copilot-style suggestions give us confidence that every word is correct. This tool has saved us hundreds of hours.',
    rating: 5
  },
  {
    name: 'Aisha Williams',
    role: 'Digital Preservation Lead',
    company: 'National Archives',
    image: '/images/testimonial-3.jpg',
    content: 'The denoising quality is exceptional. Documents that were previously unreadable are now crystal clear. The inline correction workflow is intuitive and efficient.',
    rating: 5
  }
]

export function Testimonials() {
  return (
    <section className="py-24 bg-gradient-to-b from-secondary/30 to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 text-balance">
            Trusted by Professionals Worldwide
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            See what archivists, researchers, and legal professionals say about DocRecover.
          </p>
        </FadeIn>
        
        <StaggerContainer className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <StaggerItem key={testimonial.name}>
              <div className="h-full p-8 rounded-2xl bg-card border border-border relative overflow-hidden group hover:border-primary/50 transition-all duration-300">
                {/* Quote icon */}
                <Quote className="absolute top-6 right-6 w-10 h-10 text-primary/10" />
                
                {/* Rating */}
                <div className="flex gap-1 mb-6">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                
                {/* Content */}
                <p className="text-foreground mb-8 text-pretty leading-relaxed">
                  &quot;{testimonial.content}&quot;
                </p>
                
                {/* Author */}
                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-primary/20">
                    <Image
                      src={testimonial.image}
                      alt={testimonial.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    <div className="text-sm text-primary">{testimonial.company}</div>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
        
        {/* Logos */}
        <FadeIn className="mt-20">
          <p className="text-center text-sm text-muted-foreground mb-8">Trusted by teams at</p>
          <div className="flex flex-wrap items-center justify-center gap-12 opacity-60">
            {['Stanford', 'Harvard', 'MIT', 'Yale', 'Princeton'].map((name) => (
              <div key={name} className="text-2xl font-bold text-muted-foreground/60 tracking-tight">
                {name}
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
