/**
 * Billing / subscription endpoints (Stripe Checkout).
 *
 * Buying a plan returns a Stripe-hosted checkout URL — the caller navigates the
 * browser there. On return Stripe appends ?status=success|canceled to the
 * billing page, which then refetches the subscription + payment history.
 */
import { apiRequest } from './client'
import type { ApiPayment, ApiPlan, ApiSubscription } from './types'

export function listPlans(): Promise<ApiPlan[]> {
  return apiRequest<ApiPlan[]>('/api/v1/billing/plans')
}

/** Current active subscription, or null when the user is on the free tier. */
export function getMySubscription(): Promise<ApiSubscription | null> {
  return apiRequest<ApiSubscription | null>('/api/v1/billing/me')
}

export function listPayments(): Promise<ApiPayment[]> {
  return apiRequest<ApiPayment[]>('/api/v1/billing/payments')
}

export function createCheckout(planCode: string): Promise<{ checkout_url: string }> {
  return apiRequest<{ checkout_url: string }>('/api/v1/billing/checkout', {
    method: 'POST',
    body: { plan_code: planCode },
  })
}
