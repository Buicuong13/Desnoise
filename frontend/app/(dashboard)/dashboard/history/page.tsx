'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Search,
  FileText,
  Eye,
  Filter,
  ArrowUpDown,
  Loader2,
  AlertCircle,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react'

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
import { api, ApiError } from '@/lib/api'
import type { ApiDocument, DocumentStatus } from '@/lib/api/types'
import { getWorkspaceColor, getWorkspaceIcon } from '@/lib/workspace-icons'

type SortField = 'title' | 'createdAt' | 'status'
type SortOrder = 'asc' | 'desc'

const STATUS_BADGE_STYLE: Record<DocumentStatus, string> = {
  ready: 'bg-emerald-500/10 text-emerald-600',
  processing: 'bg-amber-500/10 text-amber-700',
  draft: 'bg-slate-500/10 text-slate-600',
  archived: 'bg-muted text-muted-foreground',
}

export default function HistoryPage() {
  const [documents, setDocuments] = useState<ApiDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Edit dialog + delete confirmation.
  const [editingDoc, setEditingDoc] = useState<ApiDocument | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deletingDoc, setDeletingDoc] = useState<ApiDocument | null>(null)

  const openEdit = (doc: ApiDocument) => {
    setEditingDoc(doc)
    setDialogOpen(true)
  }
  const handleSaved = (saved: ApiDocument) => {
    setDocuments((prev) => prev.map((d) => (d.id === saved.id ? saved : d)))
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

  useEffect(() => {
    let cancelled = false
    api.documents
      .list()
      .then((docs) => {
        if (!cancelled) setDocuments(docs)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Failed to load history')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    let docs = documents.filter((d) => d.status !== 'archived')
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.description ?? '').toLowerCase().includes(q),
      )
    }
    if (statusFilter !== 'all') {
      docs = docs.filter((d) => d.status === statusFilter)
    }
    docs.sort((a, b) => {
      let cmp = 0
      if (sortField === 'title') cmp = a.title.localeCompare(b.title)
      else if (sortField === 'createdAt')
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status)
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return docs
  }, [documents, searchQuery, statusFilter, sortField, sortOrder])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Documents</h1>
        <p className="text-muted-foreground">
          Documents you&apos;ve processed. Open one to review and fix any pages that aren&apos;t right yet.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load history</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            {filtered.length} document{filtered.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="font-medium text-foreground">No documents yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first document to get started'}
              </p>
              <Button className="mt-4" asChild>
                <Link href="/dashboard/editor/new">New Document</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3 font-medium"
                        onClick={() => toggleSort('title')}
                      >
                        Title <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Pages</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3 font-medium"
                        onClick={() => toggleSort('status')}
                      >
                        Status <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3 font-medium"
                        onClick={() => toggleSort('createdAt')}
                      >
                        Created <ArrowUpDown className="ml-2 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((doc, idx) => (
                    <motion.tr
                      key={doc.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group"
                    >
                      <TableCell>
                        <Link
                          href={`/dashboard/editor/${doc.id}`}
                          className="flex items-center gap-3 hover:text-primary transition-colors"
                        >
                          {(() => {
                            const Icon = getWorkspaceIcon(doc.icon)
                            return (
                              <div
                                className={cn(
                                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm',
                                  getWorkspaceColor(doc.color),
                                )}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                            )
                          })()}
                          <div>
                            <p className="font-medium">{doc.title}</p>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                                {doc.description}
                              </p>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>{doc.total_pages}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE_STYLE[doc.status]}>{doc.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(doc.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/editor/${doc.id}`}>
                              <Eye className="h-3 w-3 mr-1" />
                              Open
                            </Link>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Workspace actions">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(doc)}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeletingDoc(doc)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
