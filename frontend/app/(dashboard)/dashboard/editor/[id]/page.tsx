'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Wand2,
  AlertCircle,
  RefreshCw,
  Download,
  ScanText,
  FileDown,
  Plus,
  CheckCircle2,
  ImageIcon,
  ImageOff,
  Type,
  UploadCloud,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CorrectionReviewEditor } from '@/components/editor/correction-review-editor'
import { CorrectionReviewModal } from '@/components/editor/correction-review-modal'
import { ProcessingIndicator } from '@/components/editor/processing-indicator'
import { PageUploadPanel } from '@/components/editor/page-upload-panel'
import { BeforeAfterCompare } from '@/components/editor/before-after-compare'
import { RestorationScore } from '@/components/editor/restoration-score'
import { cn } from '@/lib/utils'
import { cloudinaryUrl, TX_THUMB, TX_CANVAS } from '@/lib/cloudinary'
import { getWorkspaceColor, getWorkspaceIcon } from '@/lib/workspace-icons'
import { useAuth } from '@/lib/auth-store'
import { useUploadStore } from '@/lib/upload-store'
import { api, ApiError } from '@/lib/api'
import { downloadImage, saveBlob, safeFilename } from '@/lib/download'
import type {
  ApiCorrection,
  ApiDocument,
  ApiOcrDocument,
  ApiPage,
  LLMProvider,
  PageStatus,
  TiptapDoc,
} from '@/lib/api/types'

const ACTIVE_STATUSES: PageStatus[] = ['classifying', 'denoising', 'ocr_running', 'llm_running']
const HAS_OCR: PageStatus[] = ['ocr_done', 'llm_running', 'llm_done', 'reviewing', 'reviewed', 'exported']
const VIEWER_IMAGE_LIMIT = 10
const VIEWER_WORKSPACE_LIMIT = 2
const NEW_WORKSPACE = '__new__'

// Visual preview of the end-to-end pipeline shown on the "new document" screen.
const PIPELINE_PREVIEW = [
  { icon: UploadCloud, label: 'Upload', desc: 'Add a page image (JPG/PNG/WEBP…).' },
  { icon: ShieldCheck, label: 'Validate', desc: "We check it's really a document." },
  { icon: Wand2, label: 'Denoise', desc: 'Clean noise to improve accuracy.' },
  { icon: ScanText, label: 'OCR', desc: 'Extract the text content.' },
  { icon: Sparkles, label: 'Restore', desc: 'AI fixes low-confidence words.' },
] as const

type StepState = 'locked' | 'active' | 'done'

const sortByPageNumber = (ps: ApiPage[]) => [...ps].sort((a, b) => a.page_number - b.page_number)
const pageHasContent = (p: ApiPage) => HAS_OCR.includes(p.status) || !!p.tiptap_json

/** Lightweight read-only render of a page's restored text. Used for non-active
 *  pages in the text view so we only ever mount ONE heavy Tiptap editor (the
 *  active page) instead of one per page — clicking a page makes it active and
 *  swaps in the full editor. */
function StaticPageText({ doc }: { doc: TiptapDoc | null }) {
  const paragraphs = doc?.content ?? []
  return (
    <div className="tiptap-editor max-h-[560px] overflow-auto rounded-xl border border-border bg-white p-4 leading-[1.7]">
      {paragraphs.length === 0 ? (
        <p className="text-sm text-muted-foreground">(empty)</p>
      ) : (
        paragraphs.map((node, i) => {
          const text = (node.content ?? []).map((c) => c.text ?? '').join('')
          // Match the live editor's paragraph spacing so a page doesn't "lose"
          // its inter-paragraph gap when it switches from editor to static view.
          return <p key={i} className="mb-3 last:mb-0">{text || ' '}</p>
        })
      )}
    </div>
  )
}

/** Opens the raw (untransformed, full-resolution) image in a new tab. The canvas
 *  renders a downscaled copy for speed; this is the escape hatch for inspecting
 *  the page at native size. */
function ViewOriginalLink({ url, label }: { url: string | null; label: string }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
    >
      <ExternalLink className="h-3 w-3" />
      {label}
    </a>
  )
}

/** Vertical pipeline step card (right inspector) — the design system's signature component. */
function PipelineStep({
  step,
  title,
  description,
  state,
  children,
}: {
  step: number
  title: string
  description: string
  state: StepState
  children?: React.ReactNode
}) {
  const done = state === 'done'
  const active = state === 'active'
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all',
        done && 'border-border bg-muted/40',
        active && 'border-primary/40 bg-primary/5 ring-1 ring-primary/10',
        state === 'locked' && 'border-border bg-card opacity-50',
      )}
    >
      <div className="flex gap-3">
        <div className="shrink-0">
          {done ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : (
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold',
                active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {step}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {title}
            {active && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
          </h4>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  )
}

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const docId = params.id as string
  const isNew = docId === 'new'
  const { user, refreshUser } = useAuth()
  const isViewer = user?.role === 'viewer'
  const isViewerAtLimit = isViewer && (user?.images_used ?? 0) >= VIEWER_IMAGE_LIMIT

  const [doc, setDoc] = useState<ApiDocument | null>(null)
  const [pages, setPages] = useState<ApiPage[]>([])
  const [activePageId, setActivePageId] = useState<string>('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!isNew)

  // Center pane: switch between the image canvas and the restored-text manuscript.
  const [centerView, setCenterView] = useState<'image' | 'text'>('image')
  // Toggle the "add page" uploader inside the canvas.
  const [showUpload, setShowUpload] = useState(false)
  // Toggle the in-place re-upload panel for a rejected page (replaces the same
  // page slot instead of adding a new page).
  const [replacingRejected, setReplacingRejected] = useState(false)
  // AI correction review modal (roomy diff view instead of the cramped pane).
  const [reviewOpen, setReviewOpen] = useState(false)
  // Which model a paid user runs AI correction with (gpt-4o-mini or Ollama).
  // Viewers are always forced onto Ollama by the backend.
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('openai')

  // OCR layout + LLM suggestions. OCR is kept per-page (every section needs its
  // own low-confidence words); corrections only for the active page.
  const [ocrByPage, setOcrByPage] = useState<Record<string, ApiOcrDocument | null>>({})
  const [corrections, setCorrections] = useState<ApiCorrection[]>([])
  const [revisionByPage, setRevisionByPage] = useState<Record<string, number>>({})
  const fetchedOcr = useRef<Set<string>>(new Set())

  const [busyAction, setBusyAction] = useState<'denoise' | 'ocr' | 'llm' | null>(null)
  // Export is document-level and tracked per-format, so clicking Word only spins
  // the Word button (not PDF), and vice-versa.
  const [exportingFmt, setExportingFmt] = useState<'docx' | 'pdf' | null>(null)
  // Which page the in-flight page-level action (denoise/ocr/llm) runs on, so the
  // busy lock + spinners apply only to that page — not to every page you switch
  // to while it runs. (export is document-level, so it leaves this null.)
  const [busyPageId, setBusyPageId] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Downloading the denoised image to the user's machine (independent of the
  // page-level pipeline actions, so it never locks Denoise/OCR/LLM).
  const [isDownloading, setIsDownloading] = useState(false)
  // Text-view page sections, so clicking a thumbnail scrolls to that page.
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  // New-document picker: choose an existing workspace to add to, or create one.
  const [pickerDocs, setPickerDocs] = useState<ApiDocument[]>([])
  const [pickerTarget, setPickerTarget] = useState<string>(NEW_WORKSPACE)
  const [newTitle, setNewTitle] = useState('')
  const [pickerError, setPickerError] = useState<string | null>(null)

  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) ?? null,
    [pages, activePageId],
  )
  const pagesWithContent = useMemo(() => pages.filter(pageHasContent), [pages])

  // Once a suggestion is *kept*, that word is fixed — drop it from the active
  // page's low-confidence (yellow) highlight set so the editor stops marking it.
  // Pending/undone corrections stay highlighted (still unresolved).
  const activeLowConfWords = useMemo(() => {
    const words = ocrByPage[activePageId]?.low_confidence_words ?? []
    const keptSpans = corrections
      .filter((c) => c.status === 'kept' && c.start_offset != null && c.end_offset != null)
      .map((c) => [c.start_offset as number, c.end_offset as number] as const)
    if (!keptSpans.length) return words
    return words.filter((w) => !keptSpans.some(([s, e]) => w.start_offset < e && w.end_offset > s))
  }, [ocrByPage, activePageId, corrections])

  const bumpRevision = useCallback((pageId: string) => {
    setRevisionByPage((prev) => ({ ...prev, [pageId]: (prev[pageId] ?? 0) + 1 }))
  }, [])

  // Close the in-place re-upload panel when the user switches pages.
  useEffect(() => {
    setReplacingRejected(false)
  }, [activePageId])

  // ── Initial load: document + pages list
  useEffect(() => {
    if (isNew) return
    let cancelled = false
    setIsLoading(true)
    Promise.all([api.documents.get(docId), api.pages.list(docId)])
      .then(([d, ps]) => {
        if (cancelled) return
        const sorted = sortByPageNumber(ps)
        setDoc(d)
        setPages(sorted)
        // Default the pipeline to the newest (last) page.
        setActivePageId(sorted[sorted.length - 1]?.id ?? '')
      })
      .catch((e) => {
        if (cancelled) return
        setLoadError(e instanceof ApiError ? e.message : 'Failed to load workspace')
      })
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [docId, isNew])

  // Reset per-page caches when the workspace changes.
  useEffect(() => {
    fetchedOcr.current = new Set()
    setOcrByPage({})
    setRevisionByPage({})
    setCorrections([])
  }, [docId])

  // New-document mode: load existing workspaces so the user can add a page to
  // one (instead of being forced to create a new workspace — important for
  // viewers capped at 2 workspaces).
  useEffect(() => {
    if (!isNew) return
    let cancelled = false
    api.documents
      .list()
      .then((docs) => {
        if (cancelled) return
        const active = docs.filter((d) => d.status !== 'archived')
        setPickerDocs(active)
        setPickerTarget(active[0]?.id ?? NEW_WORKSPACE)
      })
      .catch((e) => {
        if (!cancelled) setPickerError(e instanceof ApiError ? e.message : 'Failed to load documents')
      })
    return () => {
      cancelled = true
    }
  }, [isNew])

  // ── Fetch OCR layout for every page that has it (once each). Re-OCR refreshes
  //    the active page explicitly in handleRunOcr.
  useEffect(() => {
    let cancelled = false
    for (const p of pages) {
      if (!pageHasContent(p) || fetchedOcr.current.has(p.id)) continue
      fetchedOcr.current.add(p.id)
      api.ocr
        .get(p.id)
        .then((r) => {
          if (cancelled) return
          setOcrByPage((m) => ({ ...m, [p.id]: r }))
          bumpRevision(p.id)
        })
        .catch(() => !cancelled && setOcrByPage((m) => ({ ...m, [p.id]: null })))
    }
    return () => {
      cancelled = true
    }
  }, [pages, bumpRevision])

  // ── Load LLM suggestions for the active page when it has them.
  useEffect(() => {
    // Drop the previous page's suggestions immediately so the panel never shows
    // another page's corrections during the fetch (or for a page with none).
    setCorrections([])
    if (!activePage || !['llm_done', 'reviewing', 'reviewed', 'exported'].includes(activePage.status)) {
      return
    }
    let cancelled = false
    api.corrections
      .list(activePage.id)
      .then((c) => !cancelled && setCorrections(c))
      .catch(() => !cancelled && setCorrections([]))
    return () => {
      cancelled = true
    }
  }, [activePageId, activePage?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshPage = useCallback(async (pageId: string) => {
    try {
      const fresh = await api.pages.get(pageId)
      setPages((prev) => sortByPageNumber(prev.map((p) => (p.id === fresh.id ? fresh : p))))
      return fresh
    } catch {
      return null
    }
  }, [])

  // ── A page rejected by the async classifier had its image quota refunded by
  //    the worker — refresh the user so the images_used chip reflects it. Once
  //    per rejected page id.
  const refundedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (activePage?.status === 'rejected' && !refundedRef.current.has(activePage.id)) {
      refundedRef.current.add(activePage.id)
      refreshUser()
    }
  }, [activePage?.status, activePage?.id, refreshUser])

  // ── Poll the active page while a long-running task is in flight
  useEffect(() => {
    if (!activePage || !ACTIVE_STATUSES.includes(activePage.status)) return
    const id = activePage.id
    pollingRef.current = setInterval(() => refreshPage(id), 2000)
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [activePage, refreshPage])

  // ── In the text view, scroll the active page's section into view when the
  //    active page changes (e.g. user clicks a thumbnail).
  useEffect(() => {
    if (centerView !== 'text' || !activePageId) return
    const el = sectionRefs.current[activePageId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activePageId, centerView])

  // ── A direct upload runs in a store *outside* React, so it keeps going even
  //    if the upload panel unmounts mid-flight (user switches view/thumbnail or
  //    navigates). Pick the registered page up here so it shows up without a
  //    manual reload. setPages is idempotent, so this never double-adds when the
  //    panel's own onComplete also fires.
  const uploadStep = useUploadStore((s) => s.step)
  const uploadResultPage = useUploadStore((s) => s.resultPage)
  const uploadDocumentId = useUploadStore((s) => s.documentId)
  const mergedUploadId = useRef<string | null>(null)
  useEffect(() => {
    if (uploadStep !== 'complete' || !uploadResultPage || uploadDocumentId !== docId) return
    if (mergedUploadId.current === uploadResultPage.id) return
    mergedUploadId.current = uploadResultPage.id
    setPages((prev) =>
      prev.some((p) => p.id === uploadResultPage.id)
        ? prev
        : sortByPageNumber([...prev, uploadResultPage]),
    )
  }, [uploadStep, uploadResultPage, uploadDocumentId, docId])

  // ── Pipeline actions (operate on the active page) ────────────────────────────
  const runAndWait = useCallback(
    async (trigger: () => Promise<unknown>, until: PageStatus[]) => {
      const pageId = activePageId
      if (!pageId) return null
      await trigger()
      const final = await api.pages.pollStatus(pageId, {
        until: [...until, 'failed'],
        timeoutMs: 180_000,
        onTick: (s) =>
          setPages((prev) =>
            prev.map((p) =>
              p.id === pageId
                ? { ...p, status: s.status, denoised_url: s.denoised_url, denoise_version: s.denoise_version }
                : p,
            ),
          ),
      })
      const fresh = await refreshPage(pageId)
      if (final.status === 'failed') {
        toast.error(fresh?.processing_error || 'Processing failed')
      }
      return fresh
    },
    [activePageId, refreshPage],
  )

  const handleDenoise = async (source: 'original' | 'current_denoised') => {
    if (!activePage) return
    setBusyAction('denoise')
    setBusyPageId(activePage.id)
    try {
      await runAndWait(() => api.pages.denoise(activePage.id, { source }), ['denoised'])
      toast.success(source === 'current_denoised' ? 'Denoised again' : 'Denoised')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to denoise')
    } finally {
      setBusyAction(null)
      setBusyPageId(null)
    }
  }

  const handleDownloadDenoised = async () => {
    if (!activePage?.denoised_url) return
    setIsDownloading(true)
    try {
      await downloadImage({
        url: activePage.denoised_url,
        pageId: activePage.id,
        type: 'denoised',
        filename: `${doc?.title ?? 'page'}-p${activePage.page_number}-denoised.png`,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleRunOcr = async () => {
    if (!activePage) return
    setBusyAction('ocr')
    setBusyPageId(activePage.id)
    try {
      const fresh = await runAndWait(() => api.ocr.trigger(activePage.id), ['ocr_done'])
      if (fresh?.status === 'ocr_done') {
        const r = await api.ocr.get(activePage.id)
        setOcrByPage((m) => ({ ...m, [activePage.id]: r }))
        fetchedOcr.current.add(activePage.id)
        bumpRevision(activePage.id)
        setCenterView('text')
        toast.success('OCR complete')
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to run OCR')
    } finally {
      setBusyAction(null)
      setBusyPageId(null)
    }
  }

  const handleRunLlm = async () => {
    if (!activePage) return
    setBusyAction('llm')
    setBusyPageId(activePage.id)
    try {
      // Viewers are forced onto the free tier server-side, so only send a choice
      // for paid users.
      await runAndWait(
        () => api.corrections.trigger(activePage.id, isViewer ? undefined : llmProvider),
        ['llm_done'],
      )
      const c = await api.corrections.list(activePage.id)
      setCorrections(c)
      bumpRevision(activePage.id)
      if (c.length > 0) setReviewOpen(true) // pop the roomy review modal
      toast.success(`LLM correction ready (${c.length} suggestions)`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to run LLM correction')
    } finally {
      setBusyAction(null)
      setBusyPageId(null)
    }
  }

  const reviewSuggestion = async (id: string, action: 'keep' | 'undo') => {
    if (!activePage) return
    try {
      const updated = action === 'keep' ? await api.corrections.keep(id) : await api.corrections.undo(id)
      setCorrections((prev) => prev.map((c) => (c.id === id ? updated : c)))
      // Backend recomputed final_text + tiptap_json — reload that page's editor.
      await refreshPage(activePage.id)
      bumpRevision(activePage.id)
      toast[action === 'keep' ? 'success' : 'info'](action === 'keep' ? 'Kept' : 'Reverted')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed')
    }
  }

  const handleKeepAll = async () => {
    if (!activePage) return
    const ids = corrections.filter((c) => c.status === 'pending').map((c) => c.id)
    if (ids.length === 0) return
    try {
      const updated = await api.corrections.bulk({ accept_ids: ids })
      setCorrections(updated)
      await refreshPage(activePage.id)
      bumpRevision(activePage.id)
      toast.success(`Kept ${ids.length} suggestion${ids.length !== 1 ? 's' : ''}`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to keep all')
    }
  }

  const handleSaveTiptap = useCallback(async (pageId: string, tiptap: TiptapDoc) => {
    try {
      const fresh = await api.ocr.saveTiptap(pageId, tiptap)
      setPages((prev) => sortByPageNumber(prev.map((p) => (p.id === fresh.id ? fresh : p))))
      toast.success('Saved')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to save')
    }
  }, [])

  const handleExport = async (fmt: 'docx' | 'pdf') => {
    setExportingFmt(fmt)
    try {
      const { blob, filename } = fmt === 'docx' ? await api.exports.docx(docId) : await api.exports.pdf(docId)
      // Prefer the document title for the suggested name; fall back to the
      // server-provided filename. saveBlob opens a native "Save As" picker
      // (Chrome/Edge) so the user chooses where to download it.
      const name = safeFilename(doc?.title ? `${doc.title}.${fmt}` : filename)
      await saveBlob(blob, name)
      toast.success(`Exported ${fmt.toUpperCase()}`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Export failed')
    } finally {
      setExportingFmt(null)
    }
  }

  const handlePageRegistered = useCallback(
    (page: ApiPage) => {
      setPages((prev) => sortByPageNumber([...prev.filter((p) => p.id !== page.id), page]))
      setActivePageId(page.id)
      setShowUpload(false)
      setReplacingRejected(false)
      // Replacing reuses the page id — allow a fresh quota-refund refresh if this
      // re-uploaded page gets rejected again.
      refundedRef.current.delete(page.id)
      setCenterView('image')
      refreshUser() // upload consumed quota — refresh images_used so the chip updates now
    },
    [refreshUser],
  )

  // ── New document: pick a workspace (existing or new) + upload the first page ──
  if (isNew) {
    const creatingNew = pickerTarget === NEW_WORKSPACE
    const atWorkspaceLimit = isViewer && pickerDocs.length >= VIEWER_WORKSPACE_LIMIT
    const blockNew = creatingNew && atWorkspaceLimit
    const uploadDisabled = isViewerAtLimit || blockNew
    const disabledReason = isViewerAtLimit
      ? "You've used all 10 free images. Upgrade to keep uploading."
      : blockNew
        ? 'Free viewer is limited to 2 documents — pick an existing document above to add this page to.'
        : undefined

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
              New document
            </h1>
            <p className="text-sm text-muted-foreground">
              Pick a workspace (or create one), then upload the first page to start the pipeline.
            </p>
          </div>
        </div>

        {pickerError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Could not load documents</AlertTitle>
            <AlertDescription>{pickerError}</AlertDescription>
          </Alert>
        )}

        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Left: gradient info panel + vertical pipeline */}
          <div className="relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-gradient-start via-gradient-middle to-gradient-end p-6 text-white shadow-sm">
            <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
            <div className="relative flex items-center gap-4">
              <div className="rounded-xl bg-white/15 p-3 ring-1 ring-white/20 backdrop-blur">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-lg font-extrabold tracking-tight">
                  Start the end-to-end flow
                </h2>
                <p className="text-sm text-white/80">
                  We first check the image really is a document page.
                </p>
              </div>
            </div>

            <ol className="relative mt-7 space-y-1">
              {PIPELINE_PREVIEW.map((s, i) => (
                <li key={s.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                      <s.icon className="h-4 w-4" />
                    </span>
                    {i < PIPELINE_PREVIEW.length - 1 && <span className="my-1 w-px flex-1 bg-white/25" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-semibold leading-tight">{s.label}</p>
                    <p className="text-xs text-white/70">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Right: workspace picker + uploader (the action) */}
          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-1.5">
              <Label>Workspace</Label>
              <Select value={pickerTarget} onValueChange={setPickerTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a workspace" />
                </SelectTrigger>
                <SelectContent>
                  {pickerDocs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.title} · {d.total_pages} page{d.total_pages !== 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_WORKSPACE}>+ Create new workspace</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Add this page to an existing document, or create a new one.
              </p>
            </div>

            {creatingNew && (
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="title">New workspace title</Label>
                <Input
                  id="title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Lecture notes — Week 3"
                />
              </div>
            )}

            <div className="mt-5 flex-1">
              <PageUploadPanel
                mode={creatingNew ? { kind: 'new', title: newTitle } : { kind: 'existing', id: pickerTarget }}
                disabled={uploadDisabled}
                disabledReason={disabledReason}
                onComplete={(_page, documentId) => {
                  refreshUser() // upload consumed quota — refresh images_used
                  router.replace(`/dashboard/editor/${documentId}`)
                }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        Loading workspace…
      </div>
    )
  }
  if (loadError || !doc) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Workspace not found</AlertTitle>
        <AlertDescription>{loadError || 'No such workspace'}</AlertDescription>
      </Alert>
    )
  }

  const status = activePage?.status ?? null
  // The page-level action only counts as "busy" on the page it's running on, so
  // switching to another page doesn't show it locked/spinning. A page that is
  // genuinely processing still locks via its own status (ACTIVE_STATUSES).
  const pageAction = busyPageId && busyPageId === activePageId ? busyAction : null
  const isBusy = (status ? ACTIVE_STATUSES.includes(status) : false) || pageAction !== null
  const hasDenoised = !!activePage?.denoised_url
  const canDenoise = !!status && !ACTIVE_STATUSES.includes(status)
  const canOcr = hasDenoised && !!status && !ACTIVE_STATUSES.includes(status)
  const hasContent = !!activePage && pageHasContent(activePage)
  // Allow (re)running AI correction whenever the page has OCR content and isn't
  // mid-task — including after a `failed` LLM attempt, so the user can retry
  // instead of being stuck. (`failed` is not a happy-path status, so gating on
  // the status whitelist alone used to lock the button permanently.)
  const canLlm = hasContent && !!status && !ACTIVE_STATUSES.includes(status)
  const pendingCount = corrections.filter((c) => c.status === 'pending').length
  const canExport = !isViewer && pagesWithContent.length > 0

  const denoiseState: StepState = hasDenoised ? 'done' : canDenoise ? 'active' : 'locked'
  const ocrState: StepState = hasContent ? 'done' : canOcr ? 'active' : 'locked'
  const llmState: StepState = ['llm_done', 'reviewing', 'reviewed', 'exported'].includes(status ?? '')
    ? 'done'
    : canLlm
      ? 'active'
      : 'locked'

  const pageThumb = (p: ApiPage) => p.denoised_url || p.original_url

  return (
    <div className="-m-4 flex flex-col overflow-hidden lg:-m-6 lg:h-[calc(100svh-3.5rem)]">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="h-5 w-px bg-border" />
          {(() => {
            const WIcon = getWorkspaceIcon(doc.icon)
            return (
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm',
                  getWorkspaceColor(doc.color),
                )}
              >
                <WIcon className="h-4 w-4" />
              </div>
            )
          })()}
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate font-display text-sm font-extrabold leading-tight text-foreground">
              {doc.title}
              {activePage && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                  P.{activePage.page_number} / {pages.length}
                </span>
              )}
            </h1>
            <p className="truncate text-[11px] text-muted-foreground">Workspace · {doc.status}</p>
          </div>
        </div>

        {canExport && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('docx')} disabled={exportingFmt !== null}>
              {exportingFmt === 'docx' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />} DOCX
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={exportingFmt !== null}>
              {exportingFmt === 'pdf' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />} PDF
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        {/* ── Left pane: page thumbnails ────────────────────────────────────── */}
        <aside className="flex shrink-0 flex-col border-b border-border bg-muted/30 lg:w-56 lg:border-b-0 lg:border-r lg:overflow-y-auto">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Pages
            </span>
            <span className="rounded bg-primary/10 px-1.5 font-mono text-xs font-bold text-primary">
              {pages.length}
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto px-4 pb-3 lg:flex-col lg:gap-2 lg:overflow-x-visible">
            {pages.map((p) => {
              const isActive = p.id === activePageId
              const ocrDone = pageHasContent(p)
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    setActivePageId(p.id)
                    setShowUpload(false)
                  }}
                  className={cn(
                    'group w-32 shrink-0 rounded-xl border bg-card p-2 text-left transition-all hover:border-primary/40 lg:w-auto',
                    isActive ? 'border-primary ring-2 ring-primary/10' : 'border-border',
                  )}
                >
                  <div className="relative mb-1.5 h-24 overflow-hidden rounded-lg bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cloudinaryUrl(pageThumb(p), TX_THUMB)}
                      alt={`Page ${p.page_number}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-1.5 top-1.5 rounded bg-black/50 px-1.5 font-mono text-[9px] font-bold text-white">
                      P.{p.page_number}
                    </span>
                    <span className="absolute right-1.5 top-1.5">
                      {ocrDone ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : p.denoised_url ? (
                        <span className="rounded bg-warning px-1 py-px text-[8px] font-bold uppercase text-white">
                          Denoised
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground">P.{p.page_number}</span>
                    <span className="text-[9px] capitalize text-muted-foreground">{p.status}</span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-auto p-4">
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => {
                setShowUpload(true)
                setCenterView('image')
              }}
              disabled={isViewerAtLimit}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              Add page
            </Button>
          </div>
        </aside>

        {/* ── Center pane: canvas ───────────────────────────────────────────── */}
        <main className="flex min-h-[50vh] flex-1 flex-col bg-canvas lg:overflow-y-auto">
          {/* Canvas toolbar */}
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-card/80 px-4 py-2 backdrop-blur-sm">
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setShowUpload(false)
                  setCenterView('image')
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1 transition-colors',
                  centerView === 'image' && !showUpload ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ImageIcon className="h-3.5 w-3.5" /> Image
              </button>
              <button
                type="button"
                disabled={!hasContent && pagesWithContent.length === 0}
                onClick={() => {
                  setShowUpload(false)
                  setCenterView('text')
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1 transition-colors disabled:opacity-40',
                  centerView === 'text' && !showUpload ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Type className="h-3.5 w-3.5" /> Text
              </button>
            </div>
            {activePage && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {activePage.status}
              </Badge>
            )}
          </div>

          <div className="flex-1 p-4 lg:p-6">
            {/* `rejected` has its own dedicated block below — don't double up. */}
            {activePage?.processing_error && status !== 'rejected' && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Processing error</AlertTitle>
                <AlertDescription>{activePage.processing_error}</AlertDescription>
              </Alert>
            )}

            {showUpload ? (
              <Card className="mx-auto max-w-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-display">
                    <Plus className="h-4 w-4" /> Add next page
                  </CardTitle>
                  <CardDescription>
                    We validate the image is a document, then it becomes the active page.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PageUploadPanel
                    mode={{ kind: 'existing', id: docId }}
                    disabled={isViewerAtLimit}
                    disabledReason="You've used all 10 free images. Upgrade to keep uploading."
                    onComplete={handlePageRegistered}
                  />
                  <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowUpload(false)}>
                    Cancel
                  </Button>
                </CardContent>
              </Card>
            ) : !activePage ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <ImageIcon className="mb-3 h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">No pages yet</p>
                <Button className="mt-4" onClick={() => setShowUpload(true)}>
                  <UploadCloud className="mr-2 h-4 w-4" /> Upload the first page
                </Button>
              </div>
            ) : status === 'rejected' ? (
              /* Async classifier rejected this page (not a document). The quota
                 spent at upload has already been refunded by the worker. */
              <div className="mx-auto max-w-xl">
                <Card>
                  <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
                      <ImageOff className="h-7 w-7 text-destructive" />
                    </div>
                    <div>
                      <p className="font-display text-base font-semibold text-foreground">
                        Đây không giống một trang tài liệu
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {activePage.processing_error ||
                          'Ảnh này không phải tài liệu nên không được xử lý.'}{' '}
                        Hạn mức ảnh đã được hoàn lại — hãy tải lên ảnh chụp/scan một trang tài liệu rõ nét.
                      </p>
                    </div>
                    {replacingRejected ? (
                      /* Re-upload replaces this same page (P.{page_number}) in
                         place — it does NOT create a new page. */
                      <div className="w-full text-left">
                        <p className="mb-2 text-center font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                          Thay ảnh cho trang {activePage.page_number}
                        </p>
                        <PageUploadPanel
                          mode={{ kind: 'replace', id: docId, pageId: activePage.id }}
                          disabled={isViewerAtLimit}
                          disabledReason="You've used all 10 free images. Upgrade to keep uploading."
                          onComplete={handlePageRegistered}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => setReplacingRejected(false)}
                        >
                          Huỷ
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={() => setReplacingRejected(true)}>
                        <UploadCloud className="mr-2 h-4 w-4" /> Tải ảnh khác cho trang này
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : centerView === 'image' ? (
              <div className="mx-auto max-w-3xl space-y-4">
                {/* Active page image / before-after */}
                <div className="overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm">
                  {status === 'classifying' ? (
                    <div className="flex min-h-[320px] items-center justify-center">
                      <ProcessingIndicator
                        label="Đang kiểm tra ảnh…"
                        hint="Xác minh ảnh có phải một trang tài liệu (chạy nền)."
                      />
                    </div>
                  ) : status === 'denoising' ? (
                    <div className="flex min-h-[320px] items-center justify-center">
                      <ProcessingIndicator label="Denoising…" hint="Running the U-Net model." />
                    </div>
                  ) : hasDenoised ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          Drag to compare — before / after
                          {activePage.denoise_version > 0 && ` · v${activePage.denoise_version}`}
                        </p>
                        {/* Open the untransformed (full-resolution) images. The
                            canvas above is downscaled for speed; these are the
                            originals at native size. */}
                        <div className="flex items-center gap-3">
                          <ViewOriginalLink url={activePage.original_url} label="Ảnh gốc" />
                          <ViewOriginalLink url={activePage.denoised_url} label="Ảnh đã xử lý" />
                        </div>
                      </div>
                      <BeforeAfterCompare
                        before={cloudinaryUrl(activePage.original_url, TX_CANVAS)}
                        after={cloudinaryUrl(activePage.denoised_url!, TX_CANVAS)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                          Original{activePage.width && activePage.height ? ` · ${activePage.width}×${activePage.height}px` : ''}
                        </p>
                        <ViewOriginalLink url={activePage.original_url} label="Xem ảnh gốc" />
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cloudinaryUrl(activePage.original_url, TX_CANVAS)}
                        alt="Original"
                        decoding="async"
                        className="max-h-[60vh] w-full rounded-lg bg-white object-contain"
                      />
                    </div>
                  )}
                </div>
                {status === 'ocr_running' && (
                  <Card>
                    <CardContent className="py-6">
                      <ProcessingIndicator
                        label="Running OCR (Tesseract layout)…"
                        hint="Reconstructing the page into paragraphs, lines and words."
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              /* Text view — restored manuscript across all pages (incl. not-yet-OCR'd) */
              <div className="mx-auto max-w-3xl space-y-6">
                {pages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                    <Type className="mb-3 h-10 w-10 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No pages yet.</p>
                  </div>
                ) : (
                  pages.map((p) => {
                    const hasOcr = pageHasContent(p)
                    return (
                      <section
                        key={p.id}
                        ref={(el) => {
                          sectionRefs.current[p.id] = el
                        }}
                        // Clicking anywhere in a page's section (incl. its text
                        // editor) makes it the active page, so the right-hand
                        // pipeline + AI-correction panel follow the page you're
                        // actually working on.
                        onMouseDown={() => {
                          if (p.id !== activePageId) setActivePageId(p.id)
                        }}
                        className={cn(
                          'scroll-mt-16 rounded-xl border bg-card p-4 transition-colors',
                          p.id === activePageId ? 'border-primary/40 ring-1 ring-primary/10' : 'border-border',
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setActivePageId(p.id)}
                            className="font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
                          >
                            Page {p.page_number}
                          </button>
                          {p.id === activePageId ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Active
                            </Badge>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setActivePageId(p.id)}>
                              Make active
                            </Button>
                          )}
                        </div>
                        {hasOcr ? (
                          p.id === activePageId ? (
                            <CorrectionReviewEditor
                              value={p.tiptap_json}
                              lowConfidenceWords={activeLowConfWords}
                              revision={revisionByPage[p.id] ?? 0}
                              editable
                              pageId={p.id}
                              onSave={handleSaveTiptap}
                            />
                          ) : (
                            /* Non-active page: cheap read-only render — click to
                               edit (which makes it the active page). */
                            <StaticPageText doc={p.tiptap_json} />
                          )
                        ) : (
                          /* Page clicked but not OCR'd yet — guide the user to run OCR. */
                          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                            <ScanText className="h-8 w-8 text-muted-foreground/50" />
                            <div>
                              <p className="text-sm font-medium text-foreground">Not extracted yet</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {p.denoised_url
                                  ? 'This page is denoised — run OCR to read its text.'
                                  : 'Denoise this page, then run OCR to read its text.'}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActivePageId(p.id)
                                setCenterView('image')
                              }}
                            >
                              <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Open in Image view
                            </Button>
                          </div>
                        )}
                      </section>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </main>

        {/* ── Right pane: process pipeline ──────────────────────────────────── */}
        <aside className="flex shrink-0 flex-col border-t border-border bg-card lg:w-80 lg:border-t-0 lg:border-l lg:overflow-y-auto">
          <div className="border-b border-border px-5 py-3">
            <h3 className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Processing pipeline
            </h3>
          </div>

          <div className="space-y-4 p-5">
            {!activePage ? (
              <p className="text-sm text-muted-foreground">Upload a page to start the pipeline.</p>
            ) : (
              <>
                {/* Capstone — restoration / recovery result of the whole pipeline.
                    Hidden while the "add page" uploader is open: `activePage` still
                    points at the PREVIOUS page until the new upload registers, so
                    showing its score here would look like the new page already has
                    numbers. */}
                {!showUpload && (
                  <RestorationScore
                    score={activePage.recovery_score}
                    before={activePage.ocr_conf_before}
                    after={activePage.ocr_conf_after}
                    status={status}
                    hasDenoised={hasDenoised}
                  />
                )}

                {/* Step 1 — Denoise */}
                <PipelineStep
                  step={1}
                  title="Denoise"
                  description="Clean up the image to improve OCR accuracy."
                  state={denoiseState}
                >
                  <div className="flex flex-wrap gap-2">
                    {!hasDenoised ? (
                      <Button size="sm" onClick={() => handleDenoise('original')} disabled={!canDenoise || isBusy}>
                        {pageAction === 'denoise' ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Run Denoise
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDownloadDenoised}
                          disabled={isDownloading}
                        >
                          {isDownloading ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Download
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDenoise('current_denoised')} disabled={isBusy}>
                          {pageAction === 'denoise' ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Again
                        </Button>
                      </>
                    )}
                  </div>
                </PipelineStep>

                {/* Step 2 — OCR */}
                <PipelineStep
                  step={2}
                  title="Extract text (OCR)"
                  description="Read the text content from the cleaned image."
                  state={ocrState}
                >
                  <Button size="sm" onClick={handleRunOcr} disabled={!canOcr || isBusy}>
                    {pageAction === 'ocr' || status === 'ocr_running' ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ScanText className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Run OCR
                  </Button>
                </PipelineStep>

                {/* Step 3 — LLM correction */}
                <PipelineStep
                  step={3}
                  title="AI correction"
                  description="Optional — suggests fixes for low-confidence words. Never edits directly."
                  state={llmState}
                >
                  <div className="space-y-3">
                    {/* Paid users pick the model; viewers are locked to the free
                        local model (Ollama) server-side. */}
                    {!isViewer && (
                      <div>
                        <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          Model
                        </p>
                        <div className="inline-flex w-full rounded-lg border border-border bg-card p-0.5 text-xs font-semibold">
                          {([
                            ['openai', 'GPT-4o mini'],
                            ['ollama', 'Ollama'],
                          ] as const).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              disabled={isBusy}
                              onClick={() => setLlmProvider(value)}
                              className={cn(
                                'flex-1 rounded-md px-2 py-1 transition-colors disabled:opacity-50',
                                llmProvider === value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {llmProvider === 'openai'
                            ? 'OpenAI gpt-4o-mini (cloud).'
                            : 'Local/cloud Ollama model.'}
                        </p>
                      </div>
                    )}

                    <Button size="sm" variant="secondary" onClick={handleRunLlm} disabled={!canLlm || isBusy}>
                      {pageAction === 'llm' || status === 'llm_running' ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Run AI correction
                    </Button>

                    {isViewer && (
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Sparkles className="h-3 w-3" /> Free plan — uses a local model (Ollama); export disabled.
                      </p>
                    )}

                    {status === 'llm_running' && (
                      <ProcessingIndicator
                        label="Generating corrections…"
                        hint={isViewer ? 'Using a local model (Ollama).' : 'Using OpenAI ChatGPT.'}
                      />
                    )}

                    {corrections.length > 0 ? (
                      <div className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            {pendingCount} pending · {corrections.length} total
                          </p>
                          {pendingCount === 0 && <CheckCircle2 className="h-4 w-4 text-success" />}
                        </div>
                        <Button size="sm" className="mt-2 w-full" onClick={() => setReviewOpen(true)}>
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          Review {corrections.length} suggestion{corrections.length !== 1 ? 's' : ''}
                        </Button>
                      </div>
                    ) : (
                      status !== 'llm_running' &&
                      llmState !== 'locked' && (
                        <p className="text-[11px] text-muted-foreground">
                          No suggestions yet. Run AI correction, or skip straight to export.
                        </p>
                      )
                    )}
                  </div>
                </PipelineStep>
              </>
            )}
          </div>

          {/* Export footer */}
          <div className="mt-auto border-t border-border p-5">
            {isViewer ? (
              <p className="text-center text-[11px] text-muted-foreground">
                Export (Word/PDF) is available on paid plans.
              </p>
            ) : (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => handleExport('docx')}
                  disabled={!canExport || exportingFmt !== null}
                >
                  {exportingFmt === 'docx' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
                  Word
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleExport('pdf')}
                  disabled={!canExport || exportingFmt !== null}
                >
                  {exportingFmt === 'pdf' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
                  PDF
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>

      <CorrectionReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        corrections={corrections}
        onReview={reviewSuggestion}
        onKeepAll={handleKeepAll}
        providerLabel={
          isViewer ? 'Ollama (free)' : llmProvider === 'ollama' ? 'Ollama' : 'GPT-4o mini'
        }
        busy={busyAction !== null}
      />
    </div>
  )
}
