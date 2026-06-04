'use client'

/**
 * Before/after wipe comparator for denoise review. Both images share the same
 * box and `object-contain`; since denoising preserves the original dimensions
 * they render at the identical rect, so a `clip-path` inset on the denoised
 * image gives a pixel-aligned wipe — no width measurement needed.
 */
import { useState } from 'react'

interface Props {
  /** Original (noisy) image URL — shown on the right. */
  before: string
  /** Denoised image URL — revealed from the left. */
  after: string
}

export function BeforeAfterCompare({ before, after }: Props) {
  const [pos, setPos] = useState(50)

  return (
    <div className="space-y-2">
      <div className="relative select-none rounded-lg overflow-hidden border border-border bg-white">
        {/* Base layer: original (defines the box height via its aspect ratio). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before}
          alt="Original"
          draggable={false}
          className="block w-full max-h-[85vh] object-contain"
        />
        {/* Top layer: denoised, clipped to the left `pos`%. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={after}
          alt="Denoised"
          draggable={false}
          className="absolute inset-0 block w-full h-full object-contain"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-primary/80 pointer-events-none"
          style={{ left: `${pos}%` }}
        />
        <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white pointer-events-none">
          Denoised
        </span>
        <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white pointer-events-none">
          Original
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare before/after"
        className="w-full accent-primary cursor-ew-resize"
      />
    </div>
  )
}
