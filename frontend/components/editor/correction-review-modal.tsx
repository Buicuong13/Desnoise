'use client'

/**
 * AI correction review — a roomy modal with one card per suggestion (compact
 * `original → suggested` diff + reason + Keep/Undo), modelled on the design
 * system's "LLM Diff Review" (guide/.../AiProofingModal, visily_llm_review).
 *
 * Reviewing in a dialog instead of the cramped right inspector keeps the diffs
 * legible when there are many suggestions.
 */
import { Sparkles, Check, X, ArrowRight, CheckCheck } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ApiCorrection } from '@/lib/api/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  corrections: ApiCorrection[]
  onReview: (id: string, action: 'keep' | 'undo') => void | Promise<void>
  onKeepAll?: () => void | Promise<void>
  /** e.g. "ChatGPT (GPT-4o)" or "Ollama · gemma". */
  providerLabel?: string
  busy?: boolean
}

const STATUS_CHIP: Record<ApiCorrection['status'], { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-warning/10 text-warning' },
  kept: { label: 'Kept', cls: 'bg-success/10 text-success' },
  undone: { label: 'Undone', cls: 'bg-muted text-muted-foreground' },
}

export function CorrectionReviewModal({
  open,
  onOpenChange,
  corrections,
  onReview,
  onKeepAll,
  providerLabel,
  busy,
}: Props) {
  const total = corrections.length
  const pending = corrections.filter((c) => c.status === 'pending').length
  const reviewed = total - pending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-4 w-4 text-primary" />
            AI correction review
          </DialogTitle>
          <DialogDescription>
            Keep a suggestion to apply it to the text, or Undo to reject it.
            {providerLabel ? ` · ${providerLabel}` : ''}
          </DialogDescription>
          <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] font-bold uppercase tracking-wide">
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-warning">{pending} pending</span>
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-success">{reviewed} reviewed</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{total} total</span>
          </div>
        </DialogHeader>

        <div className="max-h-[58vh] space-y-3 overflow-y-auto px-6 py-4">
          {total === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No suggestions. The OCR text looked clean — you can export directly.
            </div>
          ) : (
            corrections.map((c) => {
              const chip = STATUS_CHIP[c.status]
              return (
                <div
                  key={c.id}
                  className={cn(
                    'rounded-xl border p-4 transition-colors',
                    c.status === 'pending' && 'border-border bg-card',
                    c.status === 'kept' && 'border-success/30 bg-success/5',
                    c.status === 'undone' && 'border-border bg-muted/30 opacity-70',
                  )}
                >
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider',
                        chip.cls,
                      )}
                    >
                      {chip.label}
                    </span>
                    <div className="flex shrink-0 gap-1.5">
                      {c.status !== 'kept' && (
                        <Button
                          size="sm"
                          className="h-7 bg-success px-2.5 text-[11px] text-success-foreground hover:bg-success/90"
                          onClick={() => onReview(c.id, 'keep')}
                        >
                          <Check className="mr-1 h-3 w-3" /> Keep
                        </Button>
                      )}
                      {c.status !== 'undone' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-[11px]"
                          onClick={() => onReview(c.id, 'undo')}
                        >
                          <X className="mr-1 h-3 w-3" /> Undo
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Compact diff: original → suggested */}
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm">
                    <span className="font-semibold text-destructive line-through">{c.original_text}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-semibold text-success">{c.suggested_text}</span>
                  </div>

                  {c.reason && (
                    <p className="mt-2 text-xs italic leading-snug text-muted-foreground">
                      Why: {c.reason}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <span className="font-mono text-[11px] text-muted-foreground">
            {reviewed} of {total} reviewed
          </span>
          <div className="flex gap-2">
            {onKeepAll && pending > 0 && (
              <Button variant="secondary" onClick={onKeepAll} disabled={busy}>
                <CheckCheck className="mr-1.5 h-4 w-4" /> Keep all ({pending})
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
