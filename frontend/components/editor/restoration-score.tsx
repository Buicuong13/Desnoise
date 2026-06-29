'use client'

import { Sparkles, Info, TrendingUp, Loader2 } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { PageStatus } from '@/lib/api/types'

interface RestorationScoreProps {
  /** recovery_score (== ocr_conf_after), 0..100, or null before OCR runs. */
  score: number | null
  /** Avg OCR confidence on the ORIGINAL (noisy) image, 0..100. */
  before: number | null
  /** Avg OCR confidence on the current (denoised) image, 0..100. */
  after: number | null
  /** Active page status — drives the placeholder / loading states. */
  status: PageStatus | null
  /** Whether the page already has a denoised image (for the hint copy). */
  hasDenoised: boolean
}

/** Map a 0..100 score to a colour tier + human label. Thresholds match the
 *  rest of the app's success/warning/destructive tokens. */
function tierOf(value: number) {
  if (value >= 75) return { label: 'Tốt', text: 'text-success', stroke: 'text-success', soft: 'bg-success' }
  if (value >= 50) return { label: 'Khá', text: 'text-warning', stroke: 'text-warning', soft: 'bg-warning' }
  return { label: 'Cần xử lý thêm', text: 'text-destructive', stroke: 'text-destructive', soft: 'bg-destructive' }
}

/** Circular SVG gauge (no chart dependency). */
function Gauge({ value }: { value: number }) {
  const size = 104
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const tier = tierOf(pct)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          className={cn('transition-[stroke-dashoffset] duration-700 ease-out', tier.stroke)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-display text-2xl font-extrabold leading-none', tier.text)}>
          {Math.round(pct)}
          <span className="text-sm">%</span>
        </span>
        <span className="mt-0.5 text-[10px] font-semibold text-muted-foreground">{tier.label}</span>
      </div>
    </div>
  )
}

/** One before/after readability bar. */
function ConfBar({ label, value, emphasise }: { label: string; value: number; emphasise?: boolean }) {
  const pct = Math.max(0, Math.min(100, value))
  const tier = tierOf(pct)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-mono font-bold', emphasise ? tier.text : 'text-foreground')}>
          {Math.round(pct)}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-out', emphasise ? tier.soft : 'bg-muted-foreground/40')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Shell({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-4 transition-all',
        dim && 'opacity-60',
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Khả năng phục hồi
        </h4>
        <Tooltip>
          <TooltipTrigger aria-label="Cách tính" className="text-muted-foreground hover:text-foreground">
            <Info className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent className="max-w-[240px]">
            Đo bằng <b>độ tin cậy OCR</b> (trung bình mức tự tin của Tesseract trên từng chữ),
            không phải độ chính xác tuyệt đối. Chữ càng rõ nét → máy đọc càng tự tin → điểm càng cao.
          </TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  )
}

export function RestorationScore({ score, before, after, status, hasDenoised }: RestorationScoreProps) {
  // Pre-document states: the page was just uploaded and is still being validated
  // (classifying), or it was rejected / failed outright. There's no readability
  // metric to show yet, so hide the panel entirely instead of flashing an empty
  // "run the pipeline" placeholder during upload/classification.
  if (status == null || status === 'classifying' || status === 'rejected' || status === 'failed') {
    return null
  }

  // Measuring in progress.
  if (status === 'ocr_running') {
    return (
      <Shell>
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang đo khả năng đọc…
        </div>
      </Shell>
    )
  }

  // The full OCR step hasn't produced an "after" score yet. But if we measured
  // the ORIGINAL image's readability at upload time, show that baseline now so
  // the user sees a "before denoise" number the moment the page is accepted.
  if (score == null) {
    if (before != null) {
      return (
        <Shell>
          <ConfBar label="Khả năng đọc ảnh gốc" value={before} emphasise />
          <p className="mt-3 text-xs leading-snug text-muted-foreground">
            {hasDenoised
              ? 'Chạy OCR (bước 2) để đo khả năng đọc sau khi xử lý.'
              : 'Denoise rồi chạy OCR để xem pipeline cải thiện được bao nhiêu.'}
          </p>
        </Shell>
      )
    }
    return (
      <Shell dim>
        <p className="text-xs leading-snug text-muted-foreground">
          {hasDenoised
            ? 'Chạy OCR (bước 2) để đo pipeline phục hồi được bao nhiêu phần khả năng đọc.'
            : 'Denoise rồi chạy OCR để đo khả năng phục hồi của trang này.'}
        </p>
      </Shell>
    )
  }

  // Show the before→after gain only when we actually have a distinct "before"
  // (the original was OCR'd). If denoise was skipped, before == after → no story.
  const hasBefore = before != null && after != null
  const delta = hasBefore ? Math.round((after as number) - (before as number)) : null

  return (
    <Shell>
      <div className="flex items-center gap-4">
        <Gauge value={score} />
        <div className="min-w-0 flex-1 space-y-2.5">
          {hasBefore ? (
            <>
              <ConfBar label="Ảnh gốc" value={before as number} />
              <ConfBar label="Sau xử lý" value={after as number} emphasise />
            </>
          ) : (
            <ConfBar label="Khả năng đọc" value={after as number} emphasise />
          )}
        </div>
      </div>

      {delta != null && delta > 0 && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-success/10 px-2.5 py-1.5 text-xs font-semibold text-success">
          <TrendingUp className="h-3.5 w-3.5" />
          Pipeline cải thiện khả năng đọc +{delta} điểm
        </div>
      )}
    </Shell>
  )
}
