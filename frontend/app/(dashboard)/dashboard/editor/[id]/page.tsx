'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Wand2,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Download,
  ScanText,
  FileDown,
  Plus,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CorrectionReviewEditor } from '@/components/editor/correction-review-editor'
import { ProcessingIndicator } from '@/components/editor/processing-indicator'
import { PageUploadPanel } from '@/components/editor/page-upload-panel'
import { BeforeAfterCompare } from '@/components/editor/before-after-compare'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-store'
import { api, ApiError } from '@/lib/api'
import type {
  ApiCorrection,
  ApiDocument,
  ApiOcrDocument,
  ApiPage,
  PageStatus,
  TiptapDoc,
} from '@/lib/api/types'

const ACTIVE_STATUSES: PageStatus[] = ['denoising', 'ocr_running', 'llm_running']
const HAS_OCR: PageStatus[] = ['ocr_done', 'llm_running', 'llm_done', 'reviewing', 'reviewed', 'exported']
const VIEWER_IMAGE_LIMIT = 10
const VIEWER_WORKSPACE_LIMIT = 2
const NEW_WORKSPACE = '__new__'

const sortByPageNumber = (ps: ApiPage[]) => [...ps].sort((a, b) => a.page_number - b.page_number)
const pageHasContent = (p: ApiPage) => HAS_OCR.includes(p.status) || !!p.tiptap_json

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const docId = params.id as string
  const isNew = docId === 'new'
  const { user } = useAuth()
  const isViewer = user?.role === 'viewer'
  const isViewerAtLimit = isViewer && (user?.images_used ?? 0) >= VIEWER_IMAGE_LIMIT

  const [doc, setDoc] = useState<ApiDocument | null>(null)
  const [pages, setPages] = useState<ApiPage[]>([])
  const [activePageId, setActivePageId] = useState<string>('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!isNew)

  // OCR layout + LLM suggestions. OCR is kept per-page (every section needs its
  // own low-confidence words); corrections only for the active page.
  const [ocrByPage, setOcrByPage] = useState<Record<string, ApiOcrDocument | null>>({})
  const [corrections, setCorrections] = useState<ApiCorrection[]>([])
  const [revisionByPage, setRevisionByPage] = useState<Record<string, number>>({})
  const fetchedOcr = useRef<Set<string>>(new Set())

  const [busyAction, setBusyAction] = useState<'denoise' | 'ocr' | 'llm' | 'export' | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  const bumpRevision = useCallback((pageId: string) => {
    setRevisionByPage((prev) => ({ ...prev, [pageId]: (prev[pageId] ?? 0) + 1 }))
  }, [])

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
    if (!activePage || !['llm_done', 'reviewing', 'reviewed', 'exported'].includes(activePage.status)) {
      setCorrections([])
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
    try {
      await runAndWait(() => api.pages.denoise(activePage.id, { source }), ['denoised'])
      toast.success(source === 'current_denoised' ? 'Denoised again' : 'Denoised')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to denoise')
    } finally {
      setBusyAction(null)
    }
  }

  const handleRunOcr = async () => {
    if (!activePage) return
    setBusyAction('ocr')
    try {
      const fresh = await runAndWait(() => api.ocr.trigger(activePage.id), ['ocr_done'])
      if (fresh?.status === 'ocr_done') {
        const r = await api.ocr.get(activePage.id)
        setOcrByPage((m) => ({ ...m, [activePage.id]: r }))
        fetchedOcr.current.add(activePage.id)
        bumpRevision(activePage.id)
        toast.success('OCR complete')
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to run OCR')
    } finally {
      setBusyAction(null)
    }
  }

  const handleRunLlm = async () => {
    if (!activePage) return
    setBusyAction('llm')
    try {
      await runAndWait(() => api.corrections.trigger(activePage.id), ['llm_done'])
      const c = await api.corrections.list(activePage.id)
      setCorrections(c)
      bumpRevision(activePage.id)
      toast.success(`LLM correction ready (${c.length} suggestions)`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to run LLM correction')
    } finally {
      setBusyAction(null)
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
    setBusyAction('export')
    try {
      const res = fmt === 'docx' ? await api.exports.docx(docId) : await api.exports.pdf(docId)
      if (res.file_url) {
        window.open(res.file_url, '_blank', 'noopener,noreferrer')
        toast.success(`Exported ${fmt.toUpperCase()}`)
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Export failed')
    } finally {
      setBusyAction(null)
    }
  }

  const handlePageRegistered = useCallback((page: ApiPage) => {
    setPages((prev) => sortByPageNumber([...prev.filter((p) => p.id !== page.id), page]))
    setActivePageId(page.id)
  }, [])

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
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/history">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">New document</h1>
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

        <Card>
          <CardHeader>
            <CardTitle>Start the end-to-end flow</CardTitle>
            <CardDescription>
              Upload → denoise → OCR → restore, all in one workspace. Add more pages later and they&apos;ll
              continue below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
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
              <div className="space-y-1">
                <Label htmlFor="title">New workspace title</Label>
                <Input
                  id="title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Lecture notes — Week 3"
                />
              </div>
            )}

            <PageUploadPanel
              mode={creatingNew ? { kind: 'new', title: newTitle } : { kind: 'existing', id: pickerTarget }}
              disabled={uploadDisabled}
              disabledReason={disabledReason}
              onComplete={(_page, documentId) => router.replace(`/dashboard/editor/${documentId}`)}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
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
  const isBusy = (status ? ACTIVE_STATUSES.includes(status) : false) || busyAction !== null
  const hasDenoised = !!activePage?.denoised_url
  const canDenoise = !!status && !ACTIVE_STATUSES.includes(status)
  const canOcr = hasDenoised && !!status && !ACTIVE_STATUSES.includes(status)
  const showActiveEditor = !!activePage && pageHasContent(activePage)
  const canLlm = !!status && ['ocr_done', 'llm_done', 'reviewing', 'reviewed', 'exported'].includes(status)
  const pendingCount = corrections.filter((c) => c.status === 'pending').length

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/history">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{doc.title}</h1>
            <p className="text-sm text-muted-foreground">
              {pages.length} page{pages.length !== 1 ? 's' : ''} · status {doc.status}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pages.length > 1 && (
            <Select value={activePageId} onValueChange={setActivePageId}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Active page" />
              </SelectTrigger>
              <SelectContent>
                {pages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    Active: Page {p.page_number} · {p.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!isViewer && pagesWithContent.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('docx')}
                disabled={busyAction === 'export'}
              >
                <FileDown className="h-4 w-4 mr-1" /> DOCX
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('pdf')}
                disabled={busyAction === 'export'}
              >
                <FileDown className="h-4 w-4 mr-1" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Pipeline zone: the active page being processed ────────────────────── */}
      {activePage ? (
        <>
          {activePage.processing_error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Processing error</AlertTitle>
              <AlertDescription>{activePage.processing_error}</AlertDescription>
            </Alert>
          )}

          {/* Denoise panel: original + current denoised */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Processing — Page {activePage.page_number}</CardTitle>
                  <CardDescription>
                    Denoise → OCR → restore this page
                    {activePage.denoise_version > 0 && ` · denoise v${activePage.denoise_version}`}
                  </CardDescription>
                </div>
                <Badge variant="outline">{activePage.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <figure className="space-y-1">
                  <figcaption className="text-xs text-muted-foreground">
                    Original
                    {activePage.width && activePage.height
                      ? ` · ${activePage.width}×${activePage.height}px`
                      : ''}
                  </figcaption>
                  <div className="rounded-lg overflow-hidden bg-muted border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activePage.original_url}
                      alt="Original"
                      className="w-full max-h-[360px] object-contain bg-white"
                    />
                  </div>
                </figure>
                <figure className="space-y-1">
                  <figcaption className="text-xs text-muted-foreground">
                    Denoised (current)
                    {hasDenoised && activePage.width && activePage.height
                      ? ` · ${activePage.width}×${activePage.height}px · same size`
                      : ''}
                  </figcaption>
                  <div className="rounded-lg overflow-hidden bg-muted border border-border flex items-center justify-center min-h-[120px]">
                    {status === 'denoising' ? (
                      <ProcessingIndicator label="Denoising…" hint="Running the U-Net model." />
                    ) : hasDenoised ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activePage.denoised_url!}
                        alt="Denoised"
                        className="w-full max-h-[360px] object-contain bg-white"
                      />
                    ) : (
                      <p className="p-8 text-center text-sm text-muted-foreground">Not denoised yet</p>
                    )}
                  </div>
                </figure>
              </div>

              {/* Review: before/after wipe — confirms the page is restored while
                  keeping its original dimensions. */}
              {hasDenoised && status !== 'denoising' && (
                <div className="space-y-1 pt-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Review — drag to compare before / after
                  </p>
                  <BeforeAfterCompare before={activePage.original_url} after={activePage.denoised_url!} />
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {!hasDenoised ? (
                  <Button onClick={() => handleDenoise('original')} disabled={!canDenoise || isBusy}>
                    {busyAction === 'denoise' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Run Denoise
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline">
                      <a href={activePage.denoised_url!} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4 mr-2" /> Download Denoised
                      </a>
                    </Button>
                    <Button variant="outline" onClick={() => handleDenoise('current_denoised')} disabled={isBusy}>
                      {busyAction === 'denoise' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Not good? Denoise again
                    </Button>
                    <Button onClick={handleRunOcr} disabled={!canOcr || isBusy}>
                      {busyAction === 'ocr' || status === 'ocr_running' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ScanText className="h-4 w-4 mr-2" />
                      )}
                      Run OCR
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* OCR running indicator */}
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

          {/* LLM correction for the active page */}
          {showActiveEditor && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">LLM correction — Page {activePage.page_number}</CardTitle>
                <CardDescription>
                  {status === 'llm_running'
                    ? 'Reviewing suspicious words…'
                    : corrections.length > 0
                      ? `${pendingCount} pending · ${corrections.length} total`
                      : 'Optional — only suggests fixes, never edits directly'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button onClick={handleRunLlm} disabled={!canLlm || isBusy} variant="secondary">
                  {busyAction === 'llm' || status === 'llm_running' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Run LLM Correction
                </Button>

                {isViewer && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Free viewer plan — LLM uses NVIDIA Nemotron Nano
                    (free, OpenRouter); export disabled.
                  </p>
                )}

                <div className="space-y-2 max-h-[360px] overflow-auto">
                  {status === 'llm_running' && (
                    <ProcessingIndicator
                      label="Generating corrections…"
                      hint={isViewer ? 'Using NVIDIA Nemotron Nano (free, OpenRouter).' : 'Using OpenAI ChatGPT.'}
                    />
                  )}
                  {corrections.map((c) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'p-3 rounded-lg border',
                        c.status === 'pending' && 'border-amber-300 bg-amber-50/40',
                        c.status === 'kept' && 'border-emerald-300 bg-emerald-50/40',
                        c.status === 'undone' && 'border-border bg-muted/30 opacity-70',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm flex flex-wrap items-center gap-2">
                            <span className="line-through text-muted-foreground">{c.original_text}</span>
                            <span className="text-foreground font-medium">→ {c.suggested_text}</span>
                          </div>
                          {c.reason && <p className="text-xs text-muted-foreground mt-1">{c.reason}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">
                              {c.llm_provider}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {c.status}
                            </Badge>
                          </div>
                        </div>
                        {c.status !== 'undone' && (
                          <div className="flex gap-1 shrink-0">
                            {c.status !== 'kept' && (
                              <Button size="sm" onClick={() => reviewSuggestion(c.id, 'keep')} className="h-7 px-2">
                                <Check className="h-3 w-3 mr-1" /> Keep
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reviewSuggestion(c.id, 'undo')}
                              className="h-7 px-2"
                            >
                              <X className="h-3 w-3 mr-1" /> Undo
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {corrections.length === 0 && status !== 'llm_running' && (
                    <p className="text-xs text-muted-foreground">
                      No suggestions yet. Run LLM correction, or skip straight to export.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No pages yet</AlertTitle>
          <AlertDescription>Upload the first page below to begin.</AlertDescription>
        </Alert>
      )}

      {/* ── Manuscript: all pages, in order, continuous ───────────────────────── */}
      {pagesWithContent.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Document</CardTitle>
            <CardDescription>
              All pages in order — each new page continues below. Low-confidence words are underlined;
              edit any page and save.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {pagesWithContent.map((p) => (
              <section
                key={p.id}
                className={cn(
                  'space-y-2 rounded-lg transition-colors',
                  p.id === activePageId && 'ring-2 ring-primary/30 p-3 -m-0',
                )}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActivePageId(p.id)}
                    className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                  >
                    —— Page {p.page_number} ——
                  </button>
                  {p.id === activePageId ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Active
                    </Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setActivePageId(p.id)}
                    >
                      Make active
                    </Button>
                  )}
                </div>
                <CorrectionReviewEditor
                  value={p.tiptap_json}
                  lowConfidenceWords={ocrByPage[p.id]?.low_confidence_words ?? []}
                  revision={revisionByPage[p.id] ?? 0}
                  editable
                  onSave={(tiptap) => handleSaveTiptap(p.id, tiptap)}
                />
              </section>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Add the next page (continues the document) ────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add next page
          </CardTitle>
          <CardDescription>
            Upload the next page — it becomes the active page and its restored text continues below the
            others.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PageUploadPanel
            mode={{ kind: 'existing', id: docId }}
            disabled={isViewerAtLimit}
            disabledReason="You've used all 10 free images. Upgrade to keep uploading."
            onComplete={handlePageRegistered}
          />
        </CardContent>
      </Card>
    </div>
  )
}
