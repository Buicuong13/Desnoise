'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Search, Shield, Users as UsersIcon } from 'lucide-react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth-store'
import type { AdminUser, UserRole, UserStatus } from '@/lib/api/types'

const ROLE_OPTIONS: UserRole[] = ['admin', 'user', 'viewer']
const STATUS_OPTIONS: UserStatus[] = ['active', 'banned', 'pending']
const PAGE_SIZE = 20

function roleBadgeVariant(role: UserRole): 'default' | 'secondary' | 'outline' {
  if (role === 'admin') return 'default'
  if (role === 'user') return 'secondary'
  return 'outline'
}

function statusBadgeClass(status: UserStatus): string {
  if (status === 'active') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
  if (status === 'banned') return 'bg-rose-500/10 text-rose-600 border-rose-500/20'
  return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function AdminUsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  // IDs currently being mutated (disables their controls).
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

  const fetchUsers = useCallback(async (searchTerm: string, pageNum: number) => {
    setLoading(true)
    try {
      const res = await api.admin.listUsers({
        search: searchTerm || undefined,
        page: pageNum,
        pageSize: PAGE_SIZE,
      })
      setUsers(res.items)
      setTotal(res.total)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce the search box; reset to page 1 whenever the term changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      fetchUsers(search, 1)
    }, 350)
    return () => clearTimeout(t)
  }, [search, fetchUsers])

  const goToPage = (next: number) => {
    setPage(next)
    fetchUsers(search, next)
  }

  const setSaving = (id: string, on: boolean) =>
    setSavingIds((prev) => {
      const copy = new Set(prev)
      if (on) copy.add(id)
      else copy.delete(id)
      return copy
    })

  const patchUser = async (u: AdminUser, patch: { role?: UserRole; status?: UserStatus }) => {
    setSaving(u.id, true)
    try {
      const updated = await api.admin.updateUser(u.id, patch)
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      toast.success('User updated')
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed')
    } finally {
      setSaving(u.id, false)
    }
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
              <UsersIcon className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Manage Users</h1>
            </div>
            <p className="text-muted-foreground">
              Change roles, ban or reactivate accounts. {total} user{total !== 1 ? 's' : ''} total.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-72"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Docs</TableHead>
                    <TableHead className="text-right">Images</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => {
                      const isSelf = u.id === me?.id
                      const isSaving = savingIds.has(u.id)
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="min-w-0">
                                <div className="font-medium text-foreground truncate flex items-center gap-1.5">
                                  {u.full_name || u.email.split('@')[0]}
                                  {u.role === 'admin' && (
                                    <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                                  )}
                                  {isSelf && (
                                    <span className="text-[10px] text-muted-foreground">(you)</span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground truncate">
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isSelf ? (
                              <Badge variant={roleBadgeVariant(u.role)}>{u.role}</Badge>
                            ) : (
                              <Select
                                value={u.role}
                                disabled={isSaving}
                                onValueChange={(v) => patchUser(u, { role: v as UserRole })}
                              >
                                <SelectTrigger className="w-[110px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROLE_OPTIONS.map((r) => (
                                    <SelectItem key={r} value={r}>
                                      {r}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {isSelf ? (
                              <Badge variant="outline" className={statusBadgeClass(u.status)}>
                                {u.status}
                              </Badge>
                            ) : (
                              <Select
                                value={u.status}
                                disabled={isSaving}
                                onValueChange={(v) => patchUser(u, { status: v as UserStatus })}
                              >
                                <SelectTrigger className="w-[110px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {s}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {u.documents_count}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{u.images_used}</TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {formatDate(u.created_at)}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
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
