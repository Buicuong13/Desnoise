'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Users,
  FileText,
  Shield,
  TrendingUp,
  Clock,
  CheckCircle,
  Activity,
  CreditCard,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { api, ApiError } from '@/lib/api'
import type { AdminDashboard } from '@/lib/api/types'

const chartConfig = {
  created: { label: 'Created', color: 'hsl(217 91% 60%)' },
  completed: { label: 'Completed', color: 'hsl(160 84% 39%)' },
} satisfies ChartConfig

/** "2026-06-11" → "11/06" for the x-axis. */
function shortDay(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function initials(name: string | null, email: string): string {
  const base = name?.trim() || email
  return (
    base
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || 'U'
  )
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.admin
      .dashboard()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof ApiError ? e.message : 'Failed to load dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = data
    ? [
        {
          title: 'Total Users',
          value: formatNumber(data.stats.total_users),
          sub: `+${formatNumber(data.stats.new_users_30d)} in 30d`,
          icon: Users,
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
        },
        {
          title: 'Pages Processed',
          value: formatNumber(data.stats.pages_processed),
          sub: `${formatNumber(data.stats.total_pages)} total`,
          icon: FileText,
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500/10',
        },
        {
          title: 'Avg. Processing Time',
          value: formatDuration(data.stats.avg_processing_seconds),
          sub: 'per page',
          icon: Clock,
          color: 'text-violet-500',
          bgColor: 'bg-violet-500/10',
        },
        {
          title: 'Success Rate',
          value: `${data.stats.success_rate}%`,
          sub: 'completed vs failed',
          icon: CheckCircle,
          color: 'text-amber-500',
          bgColor: 'bg-amber-500/10',
        },
      ]
    : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-6 h-6 text-primary" />
              <Badge variant="secondary">Admin Panel</Badge>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground">Monitor system performance and manage users</p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild>
              <Link href="/admin/users">Manage Users</Link>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6 space-y-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </CardContent>
                </Card>
              ))
            : stats.map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                          <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <TrendingUp className="w-4 h-4" />
                          {stat.sub}
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                        <div className="text-sm text-muted-foreground">{stat.title}</div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
        </div>

        {/* Processing throughput — pages created vs completed per day (30d) */}
        <Card>
          <CardHeader>
            <CardTitle>Processing Activity</CardTitle>
            <CardDescription>Pages created vs. completed per day (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : data ? (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <AreaChart data={data.daily_pages} margin={{ left: 4, right: 12, top: 8 }}>
                  <defs>
                    <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-created)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-created)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-completed)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-completed)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDay}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={28}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent labelFormatter={(v) => shortDay(String(v))} />}
                  />
                  <Area
                    dataKey="created"
                    type="monotone"
                    stroke="var(--color-created)"
                    fill="url(#fillCreated)"
                    strokeWidth={2}
                  />
                  <Area
                    dataKey="completed"
                    type="monotone"
                    stroke="var(--color-completed)"
                    fill="url(#fillCompleted)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No data.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest admin actions (audit log)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : data && data.recent_activity.length > 0 ? (
                <div className="space-y-4">
                  {data.recent_activity.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="p-2 rounded-full bg-blue-500/10">
                        <Activity className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {activity.actor_email ?? 'System'}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {activity.action}
                          {activity.target_type ? ` · ${activity.target_type}` : ''}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground whitespace-nowrap">
                        {timeAgo(activity.created_at)}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No activity logged yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions + revenue */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common admin tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CreditCard className="w-4 h-4" />
                  Total revenue
                </div>
                <div className="mt-1 text-2xl font-bold text-foreground">
                  {loading ? '…' : data ? formatVnd(data.stats.revenue_vnd) : '—'}
                </div>
              </div>
              <Button variant="outline" className="w-full justify-start gap-3" asChild>
                <Link href="/admin/users">
                  <Users className="w-4 h-4" />
                  User Management
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3" asChild>
                <Link href="/admin/logs">
                  <FileText className="w-4 h-4" />
                  Processing Logs
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Users</CardTitle>
              <CardDescription>Newly registered accounts</CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link href="/admin/users">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-xl" />
                ))}
              </div>
            ) : data && data.recent_users.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.recent_users.slice(0, 4).map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-medium">
                        {initials(user.full_name, user.email)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {user.full_name || user.email.split('@')[0]}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {user.documents_count} docs
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No users yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
