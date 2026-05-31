'use client'

import { FadeIn, StaggerContainer, StaggerItem } from '@/components/animations/fade-in'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const plans = [
  {
    name: 'Free',
    description: 'Perfect for trying out DocRecover',
    price: '$0',
    period: '/month',
    features: [
      '5 documents per month',
      'Basic denoising',
      'Standard OCR',
      'AI suggestions',
      'Export to TXT',
      '7-day history'
    ],
    cta: 'Get Started',
    href: '/register',
    popular: false
  },
  {
    name: 'Pro',
    description: 'For professionals and regular users',
    price: '$19',
    period: '/month',
    features: [
      'Unlimited documents',
      'Advanced denoising',
      'Premium OCR accuracy',
      'Priority AI suggestions',
      'Export to PDF, DOCX, TXT',
      'Unlimited history',
      'Priority support',
      'API access'
    ],
    cta: 'Start Free Trial',
    href: '/register?plan=pro',
    popular: true
  },
  {
    name: 'Enterprise',
    description: 'For teams and organizations',
    price: 'Custom',
    period: '',
    features: [
      'Everything in Pro',
      'Dedicated infrastructure',
      'Custom AI training',
      'SSO & SAML',
      'Admin dashboard',
      'SLA guarantee',
      'Dedicated account manager',
      'On-premise option'
    ],
    cta: 'Contact Sales',
    href: '/contact',
    popular: false
  }
]

export function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-gradient-to-b from-secondary/30 to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 text-balance">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Start free and upgrade when you need more. No hidden fees, cancel anytime.
          </p>
        </FadeIn>
        
        <StaggerContainer className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <StaggerItem key={plan.name}>
              <div className={cn(
                'relative h-full flex flex-col p-8 rounded-2xl border bg-card transition-all duration-300',
                plan.popular 
                  ? 'border-primary shadow-xl shadow-primary/10 scale-105' 
                  : 'border-border hover:border-primary/50'
              )}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm">{plan.description}</p>
                </div>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                
                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  asChild
                  variant={plan.popular ? 'default' : 'outline'}
                  className={cn(
                    'w-full',
                    plan.popular && 'bg-primary hover:bg-primary/90'
                  )}
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  )
}
