'use client'

/**
 * PageUploadPanel — the reusable upload mechanism that lives *inside* the
 * end-to-end workspace (editor). It drives the direct-to-Cloudinary upload via
 * `useUploadStore` and reports the registered page back through `onComplete`.
 *
 * Two modes:
 *   - { kind: 'new', title }      → first page of a brand-new workspace; the
 *                                    store creates the document before upload.
 *   - { kind: 'existing', id }    → "Add next page" into the current workspace;
 *                                    the backend assigns the next page_number.
 *
 * This panel renders only the dropzone / preview / progress mechanism. The
 * parent supplies the surrounding Card chrome (and, for `new`, the title input).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Upload, FileImage, X, Loader2, Wand2, AlertCircle, ImageOff, ScanSearch } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useUploadStore } from '@/lib/upload-store'
import type { ApiPage } from '@/lib/api/types'

export type UploadPanelMode =
  | { kind: 'new'; title: string }
  | { kind: 'existing'; id: string }

interface Props {
  mode: UploadPanelMode
  onComplete: (page: ApiPage, documentId: string) => void
  /** Disable interaction (e.g. viewer quota reached). */
  disabled?: boolean
  disabledReason?: string
}

export function PageUploadPanel({ mode, onComplete, disabled, disabledReason }: Props) {
  const upload = useUploadStore()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const completedRef = useRef(false)

  const onDrop = useCallback(
    (files: File[]) => {
      const selected = files[0]
      if (!selected) return
      // New file = fresh attempt. Drop any leftover store state.
      upload.reset()
      completedRef.current = false
      setFile(selected)
      const reader = new FileReader()
      reader.onload = () => setPreview(reader.result as string)
      reader.readAsDataURL(selected)
    },
    [upload],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/tiff': ['.tif', '.tiff'],
      'image/bmp': ['.bmp'],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
    disabled,
  })

  const reset = useCallback(() => {
    setFile(null)
    setPreview(null)
    upload.reset()
  }, [upload])

  // The upload store is a global singleton, so a failed/complete attempt from a
  // previous mount can leak its error/result here. Clear it on mount.
  useEffect(() => {
    if (['error', 'complete', 'rejected'].includes(upload.step)) upload.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStart = async () => {
    if (!file || !preview) return
    const workspace =
      mode.kind === 'new'
        ? ({ kind: 'new', title: mode.title.trim() || file.name.replace(/\.[^.]+$/, '') } as const)
        : ({ kind: 'existing', id: mode.id } as const)
    await upload.startUpload(workspace, file, preview)
  }

  // Hand the registered page back to the parent exactly once, then reset so the
  // panel is ready for the next image.
  useEffect(() => {
    if (upload.step === 'complete' && upload.resultPage && upload.documentId && !completedRef.current) {
      completedRef.current = true
      const page = upload.resultPage
      const documentId = upload.documentId
      onComplete(page, documentId)
      reset()
    }
  }, [upload.step, upload.resultPage, upload.documentId, onComplete, reset])

  const isBusy = ['signing', 'uploading', 'validating', 'registering'].includes(upload.step)
  const isRejected = upload.step === 'rejected'
  const rejectionPct = upload.rejection ? Math.round(upload.rejection.confidence * 100) : null

  return (
    <div className="space-y-3">
      {disabled && disabledReason && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Can&apos;t upload</AlertTitle>
          <AlertDescription>{disabledReason}</AlertDescription>
        </Alert>
      )}

      {upload.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Upload failed</AlertTitle>
          <AlertDescription>{upload.error}</AlertDescription>
        </Alert>
      )}

      {isRejected && (
        <Alert variant="destructive">
          <ImageOff className="h-4 w-4" />
          <AlertTitle>This doesn&apos;t look like a document</AlertTitle>
          <AlertDescription>
            We&apos;re {rejectionPct}% sure this isn&apos;t a document page, so we didn&apos;t add it.
            Please upload a clear photo or scan of a document page and try again.
          </AlertDescription>
        </Alert>
      )}

      {!file && !isBusy && !isRejected ? (
        <div
          {...getRootProps()}
          className={cn(
            'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
            disabled
              ? 'border-border opacity-60 cursor-not-allowed'
              : 'cursor-pointer ' +
                (isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'),
          )}
        >
          <input {...getInputProps()} />
          <motion.div animate={isDragActive ? { scale: 1.05 } : { scale: 1 }} className="space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {isDragActive ? 'Drop your file here' : 'Drag & drop a page image'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse · JPG / PNG / WEBP / TIFF / BMP · max 20MB
              </p>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="space-y-3">
          {preview && (
            <div className="relative">
              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-muted border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
              </div>
              {!isBusy && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={reset}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}

          {file && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <FileImage className="w-7 h-7 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}

          {isBusy ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  {upload.step === 'validating' ? (
                    <ScanSearch className="w-4 h-4 animate-pulse text-primary" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {upload.statusMessage || 'Uploading…'}
                </span>
                <span className="font-medium">{upload.progress}%</span>
              </div>
              <Progress value={upload.progress} className="h-2" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {isRejected ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Button variant="outline" className="w-full" onClick={reset}>
                    <ImageOff className="mr-2 h-4 w-4" />
                    Choose another image
                  </Button>
                </motion.div>
              ) : upload.step === 'error' ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Button variant="outline" className="w-full" onClick={reset}>
                    Try again
                  </Button>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <Button className="w-full" size="lg" onClick={handleStart} disabled={disabled}>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Upload &amp; continue
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  )
}
