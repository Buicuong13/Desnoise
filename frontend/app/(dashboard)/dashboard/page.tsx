'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { WorkspaceDialog } from '@/components/dashboard/workspace-dialog'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-store'
import { api, ApiError } from '@/lib/api'
import type { ApiDocument, DocumentStatus } from '@/lib/api/types'
import { getWorkspaceColor, getWorkspaceIcon } from '@/lib/workspace-icons'
import {
  FileText,
  FilePlus,
  CheckCircle,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Loader2,
  Layers,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react'

const VIEWER_IMAGE_LIMIT = 10
const VIEWER_WORKSPACE_LIMIT = 2

const STATUS_META: Record<DocumentStatus, { label: string; dot: string; chip: string }> = {
  draft: { label: 'Draft', dot: 'bg-slate-400', chip: 'bg-muted text-muted-foreground' },
  processing: { label: 'Processing', dot: 'bg-warning', chip: 'bg-warning/10 text-warning' },
  ready: { label: 'Ready', dot: 'bg-success', chip: 'bg-success/10 text-success' },
  archived: { label: 'Archived', dot: 'bg-slate-300', chip: 'bg-muted text-muted-foreground' },
}

function WorkspaceCard({
  doc,
  index,
  onEdit,
  onDelete,
}: {
  doc: ApiDocument
  index: number
  onEdit: (doc: ApiDocument) => void
  onDelete: (doc: ApiDocument) => void
}) {
  const meta = STATUS_META[doc.status] ?? STATUS_META.draft
  const Icon = getWorkspaceIcon(doc.icon)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
    >
      <Link href={`/dashboard/editor/${doc.id}`} className="block">
        {/* Banner — chosen color + icon. */}
        <div className={cn('relative h-24 bg-gradient-to-br', getWorkspaceColor(doc.color))}>
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:14px_14px]" />
          <Icon className="absolute left-4 top-4 h-7 w-7 text-white/90" />
        </div>
        <div className="p-4">
          <h3 className="truncate font-display font-bold text-foreground group-hover:text-primary transition-colors">
            {doc.title}
          </h3>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {format(new Date(doc.created_at), 'dd MMM yyyy')} · {doc.total_pages} page
            {doc.total_pages !== 1 ? 's' : ''}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                meta.chip,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
              {meta.label}
            </span>
            <ArrowRight className="h-4 w-4 text-primary opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
          </div>
        </div>
      </Link>

      {/* Actions menu (sits above the link banner). */}
      <div className="absolute right-2 top-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-md bg-white/20 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-white/35"
              aria-label="Workspace actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(doc)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(doc)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [documents, setDocuments] = useState<ApiDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create / edit dialog + delete confirmation.
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<ApiDocument | null>(null)
  const [deletingDoc, setDeletingDoc] = useState<ApiDocument | null>(null)

  useEffect(() => {
    let cancelled = false
    api.documents
      .list()
      .then((docs) => {
        if (!cancelled) setDocuments(docs)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Failed to load workspaces')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activeDocuments = documents.filter((d) => d.status !== 'archived')
  const totalPages = activeDocuments.reduce((sum, d) => sum + (d.total_pages ?? 0), 0)

  const isViewer = user?.role === 'viewer'
  const imagesUsed = user?.images_used ?? 0
  const greetingName =
    user?.full_name?.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || 'there'

  const openCreate = () => {
    setEditingDoc(null)
    setDialogOpen(true)
  }
  const openEdit = (doc: ApiDocument) => {
    setEditingDoc(doc)
    setDialogOpen(true)
  }
  const handleSaved = (saved: ApiDocument) => {
    if (editingDoc) {
      setDocuments((prev) => prev.map((d) => (d.id === saved.id ? saved : d)))
    } else {
      // New workspace — open it so the user can upload the first page.
      router.push(`/dashboard/editor/${saved.id}`)
    }
  }
  const handleConfirmDelete = async () => {
    const doc = deletingDoc
    if (!doc) return
    try {
      await api.documents.archive(doc.id)
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete workspace')
    } finally {
      setDeletingDoc(null)
    }
  }

  const statsCards = [
    {
      title: 'Workspaces',
      value: activeDocuments.length,
      description: isViewer ? `${activeDocuments.length} / ${VIEWER_WORKSPACE_LIMIT} (free)` : 'active',
      icon: Layers,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Images processed',
      value: totalPages,
      description: 'across all workspaces',
      icon: FileText,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Free quota',
      value: isViewer ? `${imagesUsed} / ${VIEWER_IMAGE_LIMIT}` : 'Unlimited',
      description: isViewer ? 'images used' : 'paid plan',
      icon: Sparkles,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Welcome back, {greetingName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isViewer
              ? 'You’re on the free viewer tier — up to 10 images across 2 workspaces.'
              : 'Digitize documents with denoise → OCR → AI correction.'}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/dashboard/editor/new">
            <FilePlus className="mr-2 h-4 w-4" />
            New Document
          </Link>
        </Button>
      </motion.div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statsCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 * (i + 1) }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
              <div className={cn('rounded-lg p-2', stat.bgColor)}>
                <stat.icon className={cn('h-4 w-4', stat.color)} />
              </div>
            </div>
            <div className="mt-3 font-display text-3xl font-extrabold tracking-tight">
              {stat.value}
            </div>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {stat.description}
            </p>
          </motion.div>
        ))}
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">Your workspaces</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/history">
              View all
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-card py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading workspaces…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeDocuments.slice(0, 8).map((doc, i) => (
              <WorkspaceCard key={doc.id} doc={doc} index={i} onEdit={openEdit} onDelete={setDeletingDoc} />
            ))}

            {/* Create-new card */}
            <button
              type="button"
              onClick={openCreate}
              className="group flex min-h-[208px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card/50 p-6 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="mb-3 rounded-full bg-primary/10 p-3 transition-transform group-hover:scale-110">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <p className="font-display font-bold text-foreground">New workspace</p>
              <p className="mt-1 text-xs text-muted-foreground">Name it, pick an icon &amp; color</p>
            </button>
          </div>
        )}
      </div>

      {isViewer && imagesUsed >= VIEWER_IMAGE_LIMIT && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>You’ve used your free quota</AlertTitle>
          <AlertDescription>
            Upgrade to a paid plan to keep processing more documents.
          </AlertDescription>
        </Alert>
      )}

      <WorkspaceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        document={editingDoc}
        onSaved={handleSaved}
      />

      <AlertDialog open={!!deletingDoc} onOpenChange={(o) => !o && setDeletingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingDoc?.title}” will be removed from your workspaces. Its pages stay archived and
              won’t appear in your list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
