'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Activity, ArrowLeft, Search } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, ApiError } from '@/lib/api'
import type { AdminHistoryItem, PageStatus } from '@/lib/api/types'

const PAGE_SIZE = 20

// Coarse colour buckets for the many granular page statuses.
function statusClass(status: PageStatus): string {
  if (status === 'failed' || status === 'rejected')
    return 'bg-rose-500/10 text-rose-600 border-rose-500/20'
  if (status === 'reviewed' || status === 'exported')
    return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
  if (status === 'uploaded' || status === 'classifying')
    return 'bg-slate-500/10 text-slate-600 border-slate-500/20'
  return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminLogsPage() {
  const [items, setItems] = useState<AdminHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async (searchTerm: string, pageNum: number) => {
    setLoading(true)
    try {
      const res = await api.admin.listHistory({
        search: searchTerm || undefined,
        page: pageNum,
        pageSize: PAGE_SIZE,
      })
      setItems(res.items)
      setTotal(res.total)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load processing logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      fetchHistory(search, 1)
    }, 350)
    return () => clearTimeout(t)
  }, [search, fetchHistory])

  const goToPage = (next: number) => {
    setPage(next)
    fetchHistory(search, next)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to dashboard
            </Link>
            <div className="flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Processing Logs</h1>
            </div>
            <p className="text-muted-foreground">
              Every processed page across all users. {total} record{total !== 1 ? 's' : ''} total.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by owner email or document…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-72"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Page activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Page</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Denoise v.</TableHead>
                    <TableHead>OCR</TableHead>
                    <TableHead className="text-right">Fixes</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={9}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                        No processing records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((it) => (
                      <TableRow key={it.page_id}>
                        <TableCell className="max-w-[200px]">
                          <div className="font-medium text-foreground truncate">
                            {it.document_title}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[180px]">
                          {it.owner_email}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{it.page_number}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusClass(it.status)}>
                            {it.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {it.denoise_version}
                        </TableCell>
                        <TableCell>
                          {it.ocr_done ? (
                            <span className="text-emerald-600">✓</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {it.corrections_count}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDateTime(it.created_at)}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDateTime(it.completed_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => goToPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => goToPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
