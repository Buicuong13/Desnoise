'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Check, X, Loader2, CreditCard, Sparkles, Building2, ArrowUpRight } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import type { ApiPayment, ApiPlan, ApiSubscription } from '@/lib/api/types'

type Period = 'monthly' | 'yearly'

const fmtVnd = (v: number) => new Intl.NumberFormat('vi-VN').format(v) + 'đ'
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN')

const PAYMENT_STATUS_LABEL: Record<ApiPayment['status'], { text: string; cls: string }> = {
  success: { text: 'Hoàn tất', cls: 'bg-success/10 text-success' },
  pending: { text: 'Đang chờ', cls: 'bg-warning/10 text-warning' },
  failed: { text: 'Thất bại', cls: 'bg-destructive/10 text-destructive' },
  refunded: { text: 'Hoàn tiền', cls: 'bg-muted text-muted-foreground' },
}

export default function BillingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useAuth()

  const [period, setPeriod] = useState<Period>('monthly')
  const [plans, setPlans] = useState<ApiPlan[]>([])
  const [subscription, setSubscription] = useState<ApiSubscription | null>(null)
  const [payments, setPayments] = useState<ApiPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutCode, setCheckoutCode] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [p, sub, pays] = await Promise.all([
        api.billing.plans(),
        api.billing.me(),
        api.billing.payments(),
      ])
      setPlans(p)
      setSubscription(sub)
      setPayments(pays)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không tải được thông tin thanh toán')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Handle the redirect back from Stripe Checkout.
  useEffect(() => {
    const status = searchParams.get('status')
    if (!status) return
    if (status === 'success') {
      toast.success('Thanh toán thành công! Gói của bạn đã được kích hoạt.')
      refreshUser()
      load()
    } else if (status === 'canceled') {
      toast.info('Bạn đã hủy thanh toán.')
    }
    // Clean the query string so a refresh doesn't re-toast.
    router.replace('/dashboard/billing')
  }, [searchParams, router, refreshUser, load])

  const currentTier = subscription?.plan.features?.tier ?? 'free'

  const personalPlan = plans.find((p) => p.code === 'personal')
  const proPlan = plans.find((p) => p.code === (period === 'monthly' ? 'pro_monthly' : 'pro_yearly'))
  const enterprisePlan = plans.find((p) => p.code === 'enterprise')

  const handleUpgrade = async (code: string) => {
    setCheckoutCode(code)
    try {
      const { checkout_url } = await api.billing.checkout(code)
      window.location.href = checkout_url
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không tạo được phiên thanh toán')
      setCheckoutCode(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Đang tải…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
            Thanh toán &amp; Gói dịch vụ
          </h1>
          <p className="text-sm text-muted-foreground">
            Quản lý gói đăng ký và xem lại lịch sử thanh toán của bạn.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-2.5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Gói hiện tại
          </p>
          <p className="text-sm font-bold text-foreground">
            {subscription ? subscription.plan.name : 'Cá nhân (miễn phí)'}
            {subscription && (
              <span className="ml-1 font-normal text-muted-foreground">
                · hết hạn {fmtDate(subscription.ends_at)}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Plans */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-sm font-extrabold text-foreground">Chọn gói phù hợp</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Nâng cấp để mở khóa toàn bộ tính năng.</p>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-muted p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setPeriod('monthly')}
              className={cn(
                'rounded-md px-3 py-1 transition-all',
                period === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              Hàng tháng
            </button>
            <button
              type="button"
              onClick={() => setPeriod('yearly')}
              className={cn(
                'flex items-center gap-1 rounded-md px-3 py-1 transition-all',
                period === 'yearly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              Hàng năm
              <span className="rounded bg-destructive/10 px-1 text-[10px] font-extrabold text-destructive">
                -20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Cá nhân */}
          <PlanColumn
            icon={<Sparkles className="h-4 w-4" />}
            name="Cá nhân"
            tagline="Dành cho người mới bắt đầu số hóa tài liệu."
            priceLabel="0đ"
            periodLabel="/tháng"
            features={personalPlan?.features?.highlights ?? ['Tối đa 10 ảnh', 'OCR cơ bản', 'Denoise ảnh chuẩn']}
            crossed={['Hỗ trợ LLM giới hạn', 'Ưu tiên xử lý cao']}
            current={currentTier === 'free'}
          />

          {/* Chuyên nghiệp (Pro) */}
          <PlanColumn
            highlighted
            icon={<CreditCard className="h-4 w-4" />}
            name="Chuyên nghiệp"
            tagline="Tối ưu cho cá nhân & nhóm nhỏ xử lý khối lượng lớn."
            priceLabel={
              proPlan
                ? fmtVnd(period === 'yearly' ? Math.round(proPlan.price_vnd / 12) : proPlan.price_vnd)
                : '—'
            }
            periodLabel="/tháng"
            subNote={
              period === 'yearly' && proPlan ? `Thanh toán ${fmtVnd(proPlan.price_vnd)}/năm` : undefined
            }
            features={
              proPlan?.features?.highlights ?? [
                'Tài liệu không giới hạn',
                'OCR nâng cao',
                'Xuất Word/PDF chất lượng',
                'Ưu tiên xử lý cao',
              ]
            }
            current={currentTier === 'pro'}
            action={
              currentTier === 'pro' ? undefined : (
                <Button
                  className="w-full"
                  onClick={() => proPlan && handleUpgrade(proPlan.code)}
                  disabled={!proPlan || checkoutCode !== null}
                >
                  {checkoutCode === proPlan?.code ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpRight className="mr-1.5 h-4 w-4" />
                  )}
                  Nâng cấp lên Pro
                </Button>
              )
            }
          />

          {/* Doanh nghiệp */}
          <PlanColumn
            icon={<Building2 className="h-4 w-4" />}
            name="Doanh nghiệp"
            tagline="Giải pháp tùy chỉnh cho quy trình doanh nghiệp."
            priceLabel="Liên hệ"
            features={
              enterprisePlan?.features?.highlights ?? [
                'Mọi tính năng bản Pro',
                'Quản lý Team & phân quyền',
                'API tích hợp riêng',
                'Hỗ trợ 24/7',
              ]
            }
            current={currentTier === 'enterprise'}
            action={
              <Button variant="outline" className="w-full" asChild>
                <a href="mailto:support@docrecover.vn">Liên hệ tư vấn</a>
              </Button>
            }
          />
        </div>
      </div>

      {/* Lịch sử thanh toán */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 border-b border-border pb-3 font-display text-sm font-extrabold text-foreground">
          Lịch sử thanh toán
        </h3>
        {payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Chưa có giao dịch nào. Nâng cấp gói để bắt đầu.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border font-mono uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2.5 font-bold">Mã GD</th>
                  <th className="pb-2.5 font-bold">Ngày</th>
                  <th className="pb-2.5 font-bold">Gói</th>
                  <th className="pb-2.5 text-right font-bold">Số tiền</th>
                  <th className="pb-2.5 text-right font-bold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((tx) => {
                  const s = PAYMENT_STATUS_LABEL[tx.status]
                  return (
                    <tr key={tx.id} className="text-foreground hover:bg-muted/40">
                      <td className="py-2.5 font-mono font-bold uppercase">
                        {tx.gateway_txn_id.slice(-10)}
                      </td>
                      <td className="py-2.5">{fmtDate(tx.created_at)}</td>
                      <td className="py-2.5">{tx.plan_name ?? '—'}</td>
                      <td className="py-2.5 text-right font-mono font-bold">{fmtVnd(tx.amount_vnd)}</td>
                      <td className="py-2.5 text-right">
                        <span className={cn('rounded px-2 py-0.5 text-[10px] font-semibold', s.cls)}>
                          {s.text}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function PlanColumn({
  icon,
  name,
  tagline,
  priceLabel,
  periodLabel,
  subNote,
  features,
  crossed = [],
  highlighted = false,
  current = false,
  action,
}: {
  icon: React.ReactNode
  name: string
  tagline: string
  priceLabel: string
  periodLabel?: string
  subNote?: string
  features: string[]
  crossed?: string[]
  highlighted?: boolean
  current?: boolean
  action?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col justify-between rounded-xl border p-4 transition-colors',
        highlighted ? 'border-primary bg-primary/5 ring-1 ring-primary/10' : 'border-border hover:border-primary/40',
      )}
    >
      {current && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-widest">
          Gói hiện tại
        </Badge>
      )}
      <div>
        <div className="flex items-center gap-2 text-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </span>
          <h4 className="font-display text-sm font-extrabold">{name}</h4>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{tagline}</p>

        <p className={cn('my-4 text-2xl font-extrabold', highlighted ? 'text-primary' : 'text-foreground')}>
          {priceLabel}
          {periodLabel && <span className="text-xs font-normal text-muted-foreground"> {periodLabel}</span>}
        </p>
        {subNote && <p className="-mt-3 mb-3 text-[10px] text-muted-foreground">{subNote}</p>}

        <ul className="space-y-2 text-[11px] font-medium text-muted-foreground">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-success" /> {f}
            </li>
          ))}
          {crossed.map((f) => (
            <li key={f} className="flex items-center gap-1.5 opacity-60">
              <X className="h-3.5 w-3.5" /> {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        {current ? (
          <Button variant="secondary" className="w-full" disabled>
            Đang sử dụng
          </Button>
        ) : (
          action
        )}
      </div>
    </div>
  )
}
